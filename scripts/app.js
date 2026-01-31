class App {
    constructor() {
        this.api = new MockAPI();
        this.currentUser = null;

        this.mapManager = new MapManager('map',
            (latlng) => this.onMapClick(latlng),
            (obj) => this.onObjectClick(obj)
        );
        this.uiManager = new UIManager(this);

        this.placementType = null;
    }

    async init() {
        this.mapManager.init();
        await this.refreshObjects();
        this.checkSession();
    }

    checkSession() {
        const storedUser = localStorage.getItem('wm_user_session');
        if (storedUser) {
            this.currentUser = JSON.parse(storedUser);
            this.uiManager.updateAuthNav(this.currentUser);
        } else {
            this.uiManager.updateAuthNav(null);
        }
    }

    async refreshObjects() {
        const objects = await this.api.getObjects();
        this.mapManager.renderObjects(objects);
    }

    // --- Workflow: Add Object ---

    enablePlacementMode(type) {
        this.placementType = type;
        this.uiManager.closeSidebar(true); // true = fail-safe, do NOT cancel mode
        this.mapManager.setPlacementMode(true);
        alert(`Platzierungsmodus: Bitte klicken Sie auf die Position für ${type}.`);
    }

    cancelPlacementMode() {
        this.placementType = null;
        this.mapManager.removeTemporaryMarker();
        this.mapManager.setPlacementMode(false);
    }

    onMapClick(latlng) {
        if (this.placementType) {
            this.mapManager.addTemporaryMarker(latlng);
            this.uiManager.showAddForm(this.placementType, latlng);
            this.mapManager.setPlacementMode(false);
            this.placementType = null;
        }
    }

    onObjectClick(obj) {
        if (!this.mapManager.isPlacementMode) {
            this.selectObject(obj);
        }
    }

    selectObject(obj) {
        this.selectedObject = obj; // Store reference
        this.mapManager.removeTemporaryMarker();
        this.uiManager.showObjectDetails(obj);
        this.mapManager.flyTo(obj.geom.lat, obj.geom.lng, 17);
    }

    // --- Search (Real Nominatim API) ---

    async handleSearch(query) {
        query = query.toLowerCase();

        // 1. Try to find in mock objects first
        const mockMatch = (await this.api.getObjects()).find(o =>
            (o.name && o.name.toLowerCase().includes(query)) ||
            (o.address && o.address.toLowerCase().includes(query))
        );

        if (mockMatch) {
            this.mapManager.flyTo(mockMatch.geom.lat, mockMatch.geom.lng, 17);
            this.selectObject(mockMatch);
            return;
        }

        // 2. Fallback to Nominatim
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ", Berlin")}`;
        try {
            const res = await fetch(url);
            const data = await res.json();
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                this.mapManager.flyTo(lat, lon, 16);
            } else {
                alert("Keine Ergebnisse gefunden.");
            }
        } catch (e) {
            console.error(e);
            alert("Fehler bei der Adresssuche.");
        }
    }

    handleLocateMe() {
        if (!navigator.geolocation) {
            alert("Geolokalisierung wird von Ihrem Browser nicht unterstützt.");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                this.mapManager.flyTo(lat, lng, 16);
                // Optional: visual feedback
                const marker = L.circleMarker([lat, lng], { radius: 8, color: 'blue', fillColor: '#2196F3', fillOpacity: 1 }).addTo(this.mapManager.map).bindPopup("Ihr Standort").openPopup();
                setTimeout(() => this.mapManager.map.removeLayer(marker), 5000);
            },
            (err) => {
                console.error(err);
                alert("Standort konnte nicht abgerufen werden. Bitte erlauben Sie den Zugriff.");
            }
        );
    }

    // --- User Profile ---

    async handleUpdateProfile(data) {
        // Update local object
        this.currentUser.displayName = data.displayName;
        this.currentUser.realName = data.realName;
        this.currentUser.email = data.email;
        this.currentUser.phone = data.phone;

        // Persist (MockAPI needs an update method, or we simulate)
        // In this prototype, MockAPI holds users in memory/localStorage.
        // We need a proper update method in MockAPI.
        const res = await this.api.updateUser(this.currentUser);

        if (res.success) {
            this.uiManager.updateAuthNav(this.currentUser);
            this.uiManager.showProfile(this.currentUser); // Refresh view
            alert("Profil aktualisiert.");
        } else {
            alert("Fehler: " + res.message);
        }
    }

    // --- API Bridges ---

    async handleLogin(email, password) {
        const result = await this.api.login(email, password);
        if (result.success) {
            this.currentUser = result.user;
            localStorage.setItem('wm_user_session', JSON.stringify(this.currentUser));
            this.uiManager.updateAuthNav(this.currentUser);
            this.uiManager.closeAuthModal();

            // Refresh View: If User was viewing details, now they can comment
            if (this.uiManager.sidebar.classList.contains('active') && this.selectedObject) {
                this.uiManager.showObjectDetails(this.selectedObject);
            }
        } else {
            alert(result.message);
        }
    }

    async handleRegister(data) {
        const result = await this.api.register(data.displayName, data.realName, data.email, "", data.password);
        if (result.success) {
            this.currentUser = result.user;
            localStorage.setItem('wm_user_session', JSON.stringify(this.currentUser));
            this.uiManager.updateAuthNav(this.currentUser);
            this.uiManager.closeAuthModal();

            if (this.uiManager.sidebar.classList.contains('active') && this.selectedObject) {
                this.uiManager.showObjectDetails(this.selectedObject);
            }
        } else {
            alert(result.message);
        }
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('wm_user_session');
        this.placementType = null;
        this.mapManager.setPlacementMode(false);
        this.uiManager.updateAuthNav(null);
        this.uiManager.closeSidebar();
    }

    async handleSaveObject(data) {
        const newObj = await this.api.addObject(data, this.currentUser);
        await this.refreshObjects();
        this.uiManager.closeSidebar();
        this.selectObject(newObj);
    }

    async handleUpdateObject(data) {
        const res = await this.api.updateObject(data, this.currentUser.id);
        if (res.success) {
            await this.refreshObjects(); // Refreshes markers if needed
            // Select (view details) of updated object
            // The object ref from API might be new, fetch it
            const objects = await this.api.getObjects();
            const updatedObj = objects.find(o => o.id === data.id);
            this.selectObject(updatedObj);
        } else {
            alert("Fehler: " + res.message);
        }
    }

    async handleDeleteObject(id) {
        const res = await this.api.deleteObject(id, this.currentUser.id);
        if (res.success) {
            await this.refreshObjects();
            this.uiManager.closeSidebar();
        } else {
            alert("Fehler: " + res.message);
        }
    }

    async handleAddComment(objId, text) {
        const authorName = this.currentUser.displayName || this.currentUser.realName;
        const res = await this.api.addComment(objId, this.currentUser.id, text, authorName);
        if (res.success) {
            const objects = await this.api.getObjects();
            const obj = objects.find(o => o.id === objId);
            this.uiManager.showObjectDetails(obj);
        }
    }
}

const app = new App();
window.app = app;
document.addEventListener('DOMContentLoaded', () => { app.init(); });
