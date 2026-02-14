class SupabaseService {
    constructor() {
        if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.key) {
            console.error("Supabase configuration missing!");
        }
        this.client = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
        this.user = null;
    }

    onAuthStateChange(callback) {
        return this.client.auth.onAuthStateChange(async (event, session) => {
            if (session?.user) {
                const profile = await this._getProfile(session.user.id);
                const user = {
                    id: session.user.id,
                    email: session.user.email,
                    displayName: profile?.display_name ?? session.user.email.split('@')[0],
                    realName: profile?.real_name ?? session.user.email.split('@')[0],
                    phone: profile?.phone
                };
                callback(event, user);
            } else {
                callback(event, null);
            }
        });
    }

    async getSession() {
        const { data: { session }, error } = await this.client.auth.getSession();
        if (error || !session) return null;

        const profile = await this._getProfile(session.user.id);
        return {
            id: session.user.id,
            email: session.user.email,
            displayName: profile?.display_name ?? session.user.email.split('@')[0],
            realName: profile?.real_name ?? session.user.email.split('@')[0],
            phone: profile?.phone
        };
    }

    // --- Auth ---

    async login(email, password) {
        const { data, error } = await this.client.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            return { success: false, message: error.message };
        }

        // Fetch additional profile info
        let profile = await this._getProfile(data.user.id);

        if (!profile) {
            const displayName = data.user.email.split('@')[0];
            await this.client.from('profiles').insert([
                { id: data.user.id, display_name: displayName, real_name: displayName }
            ]);
            profile = { display_name: displayName, real_name: displayName };
        }

        const user = {
            id: data.user.id,
            email: data.user.email,
            displayName: profile?.display_name,
            realName: profile?.real_name,
            phone: profile?.phone
        };

        return { success: true, user };
    }

    async register(displayName, realName, email, phone, password) {
        // Validate that displayName and realName are not empty
        if (!displayName || displayName.trim() === '') {
            return { success: false, message: "Anzeigename darf nicht leer sein." };
        }
        if (!realName || realName.trim() === '') {
            return { success: false, message: "Vor- und Nachname dürfen nicht leer sein." };
        }

        const { data, error } = await this.client.auth.signUp({
            email: email,
            password: password
        });

        if (error) return { success: false, message: error.message };

        if (data.user && !data.session) {
            // Email confirmation required
            return {
                success: false,
                requiresConfirmation: true,
                message: "Registrierung erfolgreich. Bitte bestätigen Sie Ihre Email-Adresse, bevor Sie sich anmelden."
            };
        }

        if (data.user) {
            // Create Profile with trimmed values
            const { error: profileError } = await this.client
                .from('profiles')
                .insert([
                    {
                        id: data.user.id,
                        display_name: displayName.trim(),
                        real_name: realName.trim(),
                        phone: phone || null
                        // email is in auth.users, but we also stored it in profiles in schema, let's keep it consistent
                    }
                ]);

            if (profileError) {
                console.error("Error creating profile:", profileError);
                // We should probably fail here or at least warn
            }

            return {
                success: true,
                user: {
                    id: data.user.id,
                    email: data.user.email,
                    displayName: displayName.trim(),
                    realName: realName.trim(),
                    phone
                }
            };
        }
        return { success: false, message: "Registrierung fehlgeschlagen." };
    }

    async _getProfile(userId) {
        const { data, error } = await this.client.from('profiles').select('*').eq('id', userId).single();
        if (error) return null;
        return data;
    }

    async updateUser(userData) {
        const updates = {
            display_name: userData.displayName,
            real_name: userData.realName,
            phone: userData.phone,
            email: userData.email // Note: Updating email in auth requires different flow in Supabase
        };

        const { error } = await this.client
            .from('profiles')
            .update(updates)
            .eq('id', userData.id);

        if (error) return { success: false, message: error.message };
        return { success: true };
    }

    // --- Objects ---

    async getObjects() {
        // Fetch objects via the secure RPC function (masked)
        const { data: objects, error: objError } = await this.client.rpc('get_objects');

        if (objError) {
            console.error("Error fetching objects:", objError);
            return [];
        }

        // Fetch all comments separately to avoid join issues with the view
        const { data: comments, error: commError } = await this.client
            .from('comments')
            .select('*')
            .order('timestamp', { ascending: true });

        if (commError) {
            console.error("Error fetching comments:", commError);
            // We can still return objects without comments
        }

        // Map comments to their objects (use String key to be safe)
        const commentsMap = {};
        if (comments) {
            comments.forEach(c => {
                const oid = String(c.object_id);
                if (!commentsMap[oid]) commentsMap[oid] = [];
                commentsMap[oid].push(c);
            });
        }

        // Transform data to match App expects (camelCase) and attach comments
        return (objects || []).map(o => {
            const objComments = commentsMap[String(o.id)] || [];
            return this._mapObject(o, objComments);
        });
    }

    _mapObject(o, comments = []) {
        if (!o) return null;
        return {
            id: o.id,
            userId: o.user_id,
            category: o.category,
            name: o.name,
            address: o.address,
            type: o.type,
            sizeSqm: o.size_sqm,
            heatingSystem: o.heating_system,
            energySource: o.energy_source,
            heatingYear: o.heating_year,
            plannedReplacementYear: o.planned_replacement_year,
            estimatedDemand: o.estimated_demand,
            geom: o.geom,
            contact: o.contact,
            website: o.website,
            orgType: o.org_type,
            goal: o.goal,
            sourceType: o.source_type,
            info: o.info,
            status: o.status,
            implementationSchedule: o.implementation_schedule,
            additionalConsumersPossible: o.additional_consumers_possible,
            comments: (comments || []).map(c => ({
                id: c.id,
                userId: c.user_id,
                authorName: c.author_name,
                text: c.text,
                timestamp: c.timestamp
            }))
        };
    }

    async addObject(objectData, user) {
        const dbObj = {
            user_id: user.id,
            category: objectData.category,
            name: objectData.name,
            address: objectData.address,
            type: objectData.type,
            size_sqm: objectData.sizeSqm ? parseFloat(objectData.sizeSqm) : null,
            heating_system: objectData.heatingSystem,
            energy_source: objectData.energySource,
            heating_year: objectData.heatingYear ? parseInt(objectData.heatingYear) : null,
            planned_replacement_year: objectData.plannedReplacementYear ? parseInt(objectData.plannedReplacementYear) : null,
            estimated_demand: objectData.estimatedDemand ? parseFloat(objectData.estimatedDemand) : null,
            geom: objectData.geom,
            contact: objectData.contact,
            website: objectData.website,
            org_type: objectData.orgType,
            goal: objectData.goal,
            source_type: objectData.sourceType,
            status: objectData.status,
            info: objectData.info
        };

        const { data, error } = await this.client
            .from('objects_data')
            .insert([dbObj])
            .select()
            .single();

        if (error) {
            console.error("Error adding object:", error);
            throw error;
        }

        return this._mapObject(data);
    }

    async updateObject(objectData, userId) {
        const updates = {
            category: objectData.category,
            name: objectData.name,
            address: objectData.address,
            type: objectData.type,
            size_sqm: objectData.sizeSqm ? parseFloat(objectData.sizeSqm) : null,
            heating_system: objectData.heatingSystem,
            energy_source: objectData.energySource,
            heating_year: objectData.heatingYear ? parseInt(objectData.heatingYear) : null,
            planned_replacement_year: objectData.plannedReplacementYear ? parseInt(objectData.plannedReplacementYear) : null,
            estimated_demand: objectData.estimatedDemand ? parseFloat(objectData.estimatedDemand) : null,
            geom: objectData.geom,
            contact: objectData.contact,
            website: objectData.website,
            org_type: objectData.orgType,
            goal: objectData.goal,
            source_type: objectData.sourceType,
            info: objectData.info,
            status: objectData.status,
            implementation_schedule: objectData.implementationSchedule,
            additional_consumers_possible: objectData.additionalConsumersPossible
        };

        // Filter out undefined
        Object.keys(updates).forEach(key => updates[key] === undefined && delete updates[key]);

        const { error } = await this.client
            .from('objects_data')
            .update(updates)
            .eq('id', objectData.id)
            .eq('user_id', userId); // Security check handled by RLS too, but good for feedback

        if (error) return { success: false, message: error.message };
        return { success: true };
    }

    async deleteObject(id, userId) {
        const { error } = await this.client
            .from('objects_data')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

        if (error) return { success: false, message: error.message };
        return { success: true };
    }

    async logout() {
        const { error } = await this.client.auth.signOut();
        if (error) return { success: false, message: error.message };
        return { success: true };
    }

    async addComment(objectId, userId, text, authorName) {
        const { data, error } = await this.client
            .from('comments')
            .insert([
                {
                    object_id: objectId,
                    user_id: userId,
                    author_name: authorName,
                    text: text
                }
            ])
            .select()
            .single();

        if (error) return { success: false, message: error.message };
        return {
            success: true, comment: {
                id: data.id,
                userId: data.user_id,
                authorName: data.author_name,
                text: data.text,
                timestamp: data.timestamp
            }
        };
    }
}
