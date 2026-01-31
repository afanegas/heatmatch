class MockAPI {
    constructor() {
        this.STORAGE_KEY = 'wärmematch_data_v2';
        this.init();
    }

    init() {
        if (!localStorage.getItem(this.STORAGE_KEY)) {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(MOCK_DATA));
        } else {
            // Migration for version update (Name -> DisplayName/RealName)
            const data = JSON.parse(localStorage.getItem(this.STORAGE_KEY));
            let changed = false;
            data.users.forEach(u => {
                if (!u.displayName && u.name) {
                    u.displayName = u.name;
                    u.realName = u.name;
                    delete u.name;
                    changed = true;
                }
            });
            if (changed) {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
                console.log("Migrated user data to new format.");
            }
        }
    }

    _getData() {
        return JSON.parse(localStorage.getItem(this.STORAGE_KEY));
    }

    _saveData(data) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    }

    // --- Auth ---

    async login(email, password) {
        await new Promise(r => setTimeout(r, 200));
        const data = this._getData();
        const user = data.users.find(u => u.email === email && u.password === password);
        return user ? { success: true, user: { id: user.id, displayName: user.displayName, realName: user.realName, email: user.email, phone: user.phone } }
            : { success: false, message: "Ungültige Anmeldedaten." };
    }

    async register(displayName, realName, email, phone, password) {
        await new Promise(r => setTimeout(r, 200));
        const data = this._getData();
        if (data.users.find(u => u.email === email)) {
            return { success: false, message: "Email bereits registriert." };
        }
        const newUser = { id: Date.now(), displayName, realName, email, phone, password };
        data.users.push(newUser);
        this._saveData(data);
        return { success: true, user: { id: newUser.id, displayName: newUser.displayName, realName: newUser.realName, email: newUser.email, phone: newUser.phone } };
    }

    async updateUser(userData) {
        await new Promise(r => setTimeout(r, 200));
        const data = this._getData();
        const userIdx = data.users.findIndex(u => u.id === userData.id);

        if (userIdx !== -1) {
            // Update fields
            data.users[userIdx].displayName = userData.displayName;
            data.users[userIdx].realName = userData.realName;
            data.users[userIdx].email = userData.email;
            data.users[userIdx].phone = userData.phone;
            this._saveData(data);
            return { success: true };
        }
        return { success: false, message: "User nicht gefunden." };
    }

    // --- Objects ---

    async getObjects() {
        await new Promise(r => setTimeout(r, 100));
        return this._getData().objects;
    }

    async addObject(objectData, user) {
        await new Promise(r => setTimeout(r, 200));
        const data = this._getData();
        const newObj = {
            id: Date.now(),
            userId: user.id,
            comments: [],
            ...objectData,
            contact: objectData.contact || { name: user.name, email: user.email, phone: user.phone }
        };
        data.objects.push(newObj);
        this._saveData(data);
        return newObj;
    }

    async updateObject(objectData, userId) {
        await new Promise(r => setTimeout(r, 200));
        const data = this._getData();
        const idx = data.objects.findIndex(o => o.id === objectData.id && o.userId === userId);

        if (idx !== -1) {
            const existing = data.objects[idx];
            data.objects[idx] = { ...existing, ...objectData };
            this._saveData(data);
            return { success: true };
        }
        return { success: false, message: "Objekt nicht gefunden oder keine Berechtigung." };
    }

    async deleteObject(id, userId) {
        await new Promise(r => setTimeout(r, 200));
        const data = this._getData();
        const idx = data.objects.findIndex(o => o.id === id && o.userId === userId);
        if (idx !== -1) {
            data.objects.splice(idx, 1);
            this._saveData(data);
            return { success: true };
        }
        return { success: false, message: "Nicht befugt oder Element nicht gefunden." };
    }

    async addComment(objectId, userId, text, authorName) {
        await new Promise(r => setTimeout(r, 200));
        const data = this._getData();
        const obj = data.objects.find(o => o.id === objectId);
        if (obj) {
            const comment = { id: Date.now(), userId, authorName, text, timestamp: new Date().toISOString() };
            if (!obj.comments) obj.comments = [];
            obj.comments.push(comment);
            this._saveData(data);
            return { success: true, comment };
        }
        return { success: false, message: "Element nicht gefunden." };
    }
}
