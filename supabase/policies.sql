-- =========================================================
-- 0. NUCLEAR RESET: Clear all existing policies for our tables
-- =========================================================
do $$
declare
    pol record;
begin
    -- Drop all policies for our app tables to ensure a clean slate
    for pol in (
        select policyname, tablename 
        from pg_policies 
        where schemaname = 'public' 
        and tablename in ('profiles', 'objects', 'objects_data', 'comments')
    ) loop
        execute format('drop policy %I on %I', pol.policyname, pol.tablename);
    end loop;
end $$;


-- =========================================================
-- 1. TABLE STRUCTURE & RLS ENABLEMENT
-- =========================================================

-- Rename 'objects' to 'objects_data' if it hasn't happened yet
do $$
begin
  if exists (
    select 1 from pg_class c 
    join pg_namespace n on n.oid = c.relnamespace 
    where n.nspname = 'public' and c.relname = 'objects' and c.relkind = 'r'
  ) and not exists (
    select 1 from pg_class c 
    join pg_namespace n on n.oid = c.relnamespace 
    where n.nspname = 'public' and c.relname = 'objects_data'
  ) then
    alter table objects rename to objects_data;
  end if;
end $$;

-- Enable RLS
alter table if exists profiles enable row level security;
alter table if exists objects_data enable row level security;
alter table if exists comments enable row level security;

-- Add new columns for Project type
alter table if exists objects_data add column if not exists implementation_schedule text;
alter table if exists objects_data add column if not exists additional_consumers_possible boolean default false;

-- TABLE GRANTS (Required for users to perform any actions)
grant select, insert, update, delete on objects_data to authenticated;
grant select, insert, update, delete on profiles to authenticated;
grant select, insert on comments to authenticated;


-- =========================================================
-- 2. NEW POLICIES (CLEAN SLATE)
-- =========================================================

-- PROFILES
create policy "Users can view own profile" on profiles for select using ( auth.uid() = id );
create policy "Users can update own profile" on profiles for update using ( auth.uid() = id );
create policy "Users can insert own profile" on profiles for insert with check ( auth.uid() = id );

-- OBJECTS_DATA (Owners only)
-- Nobody else can directly select from objects_data, they MUST use the view.
create policy "Owners can manage own objects" on objects_data for all using ( auth.uid() = user_id );
create policy "Authenticated users can insert objects" on objects_data for insert to authenticated with check ( auth.uid() = user_id );


-- =========================================================
-- 3. MASKING FUNCTION (Replaces View for Security)
-- =========================================================
-- Drop the old view if it exists
drop view if exists objects;
-- Drop the existing function if it exists (necessary if return type changes)
drop function if exists get_objects;

-- Create a secure function to fetch objects.
-- SECURITY DEFINER allows it to access the contact data in objects_data.
-- search_path = public prevents search path hijacking.
create or replace function get_objects()
returns table (
  id bigint,
  user_id uuid,
  category text,
  name text,
  address text,
  type text,
  size_sqm numeric,
  heating_system text,
  energy_source text,
  heating_year int,
  planned_replacement_year int,
  estimated_demand numeric,
  geom jsonb,
  website text,
  org_type text,
  goal text,
  source_type text,
  info text,
  implementation_schedule text,
  additional_consumers_possible boolean,
  contact jsonb
) 
security definer
set search_path = public
language plpgsql
as $$
begin
  return query
  select
    o.id, 
    o.user_id, 
    o.category, 
    o.name, 
    o.address, 
    o.type, 
    o.size_sqm, 
    o.heating_system, 
    o.energy_source, 
    o.heating_year, 
    o.planned_replacement_year, 
    o.estimated_demand, 
    o.geom, 
    o.website, 
    o.org_type, 
    o.goal, 
    o.source_type, 
    o.info, 
    o.implementation_schedule, 
    o.additional_consumers_possible,
    (
      case 
        when (o.contact->>'hideEmail')::boolean = true and (auth.uid() is null or auth.uid() != o.user_id) then o.contact - 'email'
        else o.contact 
      end
    ) - (
      case 
        when (o.contact->>'hidePhone')::boolean = true and (auth.uid() is null or auth.uid() != o.user_id) then 'phone'
        else 'none_existing_key' 
      end
    ) as contact
  from objects_data o;
end;
$$;

-- Grant execute permission to everyone
grant execute on function get_objects to anon, authenticated;


-- =========================================================
-- 4. COMMENTS
-- =========================================================
create policy "Comments are public" on comments for select using ( true );
create policy "Authenticated users can create comments" on comments for insert to authenticated with check ( auth.uid() = user_id );

grant select on comments to anon, authenticated;
