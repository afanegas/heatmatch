class App {
    constructor() {
        this.api = new SupabaseService();
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

        // Initialize info sidebar
        this.initInfoSidebar();

        // Listen for auth changes
        this.api.onAuthStateChange((event, user) => {
            console.log("Auth Event:", event, user);
            this.currentUser = user;
            this.uiManager.updateAuthNav(user);

            // Handle session persistence or logout cleanup
            if (user) {
                localStorage.setItem('wm_user_session', JSON.stringify(user));
            } else {
                localStorage.removeItem('wm_user_session');
                this.uiManager.closeSidebar();
            }

            // If we just logged in and were viewing an object, refresh details (to show comment form)
            if (event === 'SIGNED_IN' && this.uiManager.sidebar.classList.contains('active') && this.selectedObject) {
                this.uiManager.showObjectDetails(this.selectedObject);
            }
        });

        await this.checkSession();
        this.handleUrlHash();
    }

    initInfoSidebar() {
        const infoSidebar = document.getElementById('info-sidebar');
        const toggleBtn = document.getElementById('info-sidebar-toggle');
        const closeBtn = document.getElementById('btn-close-info-sidebar');

        // Always show the info sidebar on page load
        const hasVisited = localStorage.getItem('wm_has_visited');

        if (!hasVisited) {
            // First visit - show the info sidebar
            setTimeout(() => {
                infoSidebar.classList.add('active');
            }, 500); // Small delay for better UX

            // Mark as visited
            localStorage.setItem('wm_has_visited', 'true');
        }

        // Toggle button click
        toggleBtn.addEventListener('click', () => {
            infoSidebar.classList.add('active');
        });

        // Close button click
        closeBtn.addEventListener('click', () => {
            infoSidebar.classList.remove('active');
        });
    }

    async checkSession() {
        const user = await this.api.getSession();
        if (user) {
            this.currentUser = user;
            this.uiManager.updateAuthNav(user);
        } else {
            // Clear local storage if no Supabase session exists
            localStorage.removeItem('wm_user_session');
            this.uiManager.updateAuthNav(null);
        }
    }

    handleUrlHash() {
        const hash = window.location.hash;
        if (hash.includes('error=')) {
            const params = new URLSearchParams(hash.substring(1));
            const errorMsg = params.get('error_description') || params.get('error');
            const errorCode = params.get('error_code');

            if (errorCode === 'otp_expired') {
                console.warn("Email link expired or invalid, checking session anyway.");
            } else {
                this.uiManager.showAlert(`Authentifizierungsfehler: ${this.translateModuleError(errorMsg)}`, "Fehler");
            }
            // Clean hash
            window.history.replaceState(null, null, window.location.pathname);
        }
    }

    translateModuleError(msg) {
        if (!msg) return "";
        const lowMsg = msg.toLowerCase();
        if (lowMsg.includes("invalid login credentials")) return "Ungültige Anmeldedaten.";
        if (lowMsg.includes("user already registered")) return "Benutzer bereits registriert.";
        if (lowMsg.includes("email not confirmed")) return "Email-Adresse noch nicht bestätigt.";
        if (lowMsg.includes("password should be")) return "Das Passwort ist zu kurz (mind. 6 Zeichen).";
        if (lowMsg.includes("network request failed")) return "Netzwerkfehler. Bitte prüfen Sie Ihre Verbindung.";
        return msg; // Fallback
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
        this.uiManager.showAlert(`Platzierungsmodus: Bitte klicken Sie auf die Position für ${this.uiManager.getCategoryLabel(type)}.`, "Objekt platzieren");
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
                this.uiManager.showAlert("Keine Ergebnisse gefunden.", "Suche");
            }
        } catch (e) {
            console.error(e);
            this.uiManager.showAlert("Fehler bei der Adresssuche.", "Fehler");
        }
    }

    handleLocateMe() {
        if (!navigator.geolocation) {
            this.uiManager.showAlert("Geolokalisierung wird von Ihrem Browser nicht unterstützt.", "Info");
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
                this.uiManager.showAlert("Standort konnte nicht abgerufen werden. Bitte erlauben Sie den Zugriff.", "Standort-Fehler");
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
            this.uiManager.showAlert("Profil aktualisiert.", "Erfolg");
        } else {
            this.uiManager.showAlert("Fehler: " + this.translateModuleError(res.message), "Fehler");
        }
    }

    // --- API Bridges ---

    async handleLogin(email, password) {
        const result = await this.api.login(email, password);
        if (result.success) {
            this.uiManager.closeAuthModal();
        } else {
            this.uiManager.showAlert(this.translateModuleError(result.message), "Anmeldefehler");
        }
    }

    async handleRegister(data) {
        const result = await this.api.register(data.displayName, data.realName, data.email, "", data.password);
        if (result.success) {
            // Successful registration with immediate login
            this.uiManager.closeAuthModal();
            this.uiManager.showAlert("Registrierung erfolgreich! Sie sind jetzt angemeldet.", "Willkommen");
        } else if (result.requiresConfirmation) {
            // Successful registration but email confirmation required
            this.uiManager.closeAuthModal();
            this.uiManager.showAlert(result.message, "Registrierung erfolgreich");
            // After the alert is dismissed, show login form
            setTimeout(() => {
                this.uiManager.showLoginForm();
            }, 100);
        } else {
            // Registration failed
            this.uiManager.showAlert(this.translateModuleError(result.message), "Registrierungsfehler");
        }
    }

    async logout() {
        await this.api.logout();
        // onAuthStateChange will handle UI update
    }

    async handleSaveObject(data) {
        if (!this.currentUser || String(this.currentUser.id).length < 10) {
            this.uiManager.showAlert("Sitzungsfehler: Bitte melden Sie sich erneut an.", "Sitzung abgelaufen");
            this.logout();
            return;
        }

        try {
            const newObj = await this.api.addObject(data, this.currentUser);
            await this.refreshObjects();
            this.uiManager.closeSidebar();
            this.selectObject(newObj);
        } catch (e) {
            console.error("Save Error:", e);
            this.uiManager.showAlert("Fehler beim Speichern: " + e.message, "Fehler");
        }
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
            this.uiManager.showAlert("Fehler: " + this.translateModuleError(res.message), "Fehler");
        }
    }

    async handleDeleteObject(id) {
        const res = await this.api.deleteObject(id, this.currentUser.id);
        if (res.success) {
            await this.refreshObjects();
            this.uiManager.closeSidebar();
        } else {
            this.uiManager.showAlert("Fehler: " + this.translateModuleError(res.message), "Fehler");
        }
    }

    async handleAddComment(objId, text) {
        const authorName = this.currentUser.displayName || this.currentUser.realName;
        const res = await this.api.addComment(objId, this.currentUser.id, text, authorName);
        if (res.success) {
            const objects = await this.api.getObjects();
            const obj = objects.find(o => String(o.id) === String(objId));
            if (obj) {
                this.uiManager.showObjectDetails(obj);
            }
        }
    }
}

const app = new App();
window.app = app;
document.addEventListener('DOMContentLoaded', () => { app.init(); });
