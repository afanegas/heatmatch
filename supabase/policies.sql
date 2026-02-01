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
-- 3. MASKING VIEW
-- =========================================================
create or replace view objects as
select
  id, user_id, category, name, address, type, size_sqm, heating_system, energy_source, 
  heating_year, planned_replacement_year, estimated_demand, geom, website, org_type, 
  goal, source_type, info,
  (
    case 
      when (contact->>'hideEmail')::boolean = true and (auth.uid() is null or auth.uid() != user_id) then contact - 'email'
      else contact 
    end
  ) - (
    case 
      when (contact->>'hidePhone')::boolean = true and (auth.uid() is null or auth.uid() != user_id) then 'phone'
      else 'none_existing_key' 
    end
  ) as contact
from objects_data;

grant select on objects to anon, authenticated;


-- =========================================================
-- 4. COMMENTS
-- =========================================================
create policy "Comments are public" on comments for select using ( true );
create policy "Authenticated users can create comments" on comments for insert to authenticated with check ( auth.uid() = user_id );
