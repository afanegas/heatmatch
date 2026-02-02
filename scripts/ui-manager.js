class UIManager {
    constructor(app) {
        this.app = app;
        this.sidebar = document.getElementById('main-sidebar');
        this.sidebarContent = document.getElementById('sidebar-content');
        this.sidebarTitle = document.getElementById('sidebar-title');
        this.authModal = document.getElementById('auth-modal');
        this.authModalContent = document.getElementById('auth-modal-content');

        this.appModal = document.getElementById('app-modal');
        this.modalTitle = document.getElementById('modal-title');
        this.modalMessage = document.getElementById('modal-message');
        this.btnModalPrimary = document.getElementById('btn-modal-primary');
        this.btnModalSecondary = document.getElementById('btn-modal-secondary');

        this.initListeners();
    }

    initListeners() {
        document.getElementById('btn-close-sidebar').addEventListener('click', () => this.closeSidebar());
        document.getElementById('close-auth-modal').addEventListener('click', () => this.closeAuthModal());

        document.getElementById('btn-search').addEventListener('click', () => this.handleSearch());
        document.getElementById('btn-locate').addEventListener('click', () => this.app.handleLocateMe());
        document.getElementById('search-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });
    }

    handleSearch() {
        const query = document.getElementById('search-input').value;
        if (query) this.app.handleSearch(query);
    }

    updateAuthNav(user) {
        const nav = document.getElementById('auth-nav');
        if (user) {
            // Extract initials from realName (format: "Firstname Lastname")
            const getInitials = (name) => {
                if (!name) return '??';
                const parts = name.trim().split(/\s+/);
                if (parts.length >= 2) {
                    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                }
                return name.substring(0, 2).toUpperCase();
            };
            const initials = getInitials(user.realName);

            nav.innerHTML = `
                <button class="btn btn-primary" id="btn-create-object" style="display: flex; align-items: center; gap: 8px;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Neuer Antrag
                </button>
                <button class="btn btn-outline" id="btn-my-entries">Meine Anträge</button>
                <button class="btn btn-icon btn-outline user-initials-btn" id="btn-profile" title="Profil">${initials}</button>
                <button class="btn btn-icon btn-outline" id="btn-logout" title="Abmelden">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                </button>
            `;
            document.getElementById('btn-logout').addEventListener('click', () => this.app.logout());
            document.getElementById('btn-my-entries').addEventListener('click', () => this.showUserEntries(user));
            document.getElementById('btn-create-object').addEventListener('click', () => this.startCreationFlow());
            document.getElementById('btn-profile').addEventListener('click', () => this.showProfile(user));

            // Add tooltip functionality
            this.addTooltips();
        } else {
            nav.innerHTML = `
                <button class="btn btn-primary" id="btn-login">Anmelden</button>
                <button class="btn btn-outline" id="btn-register">Registrieren</button>
            `;
            document.getElementById('btn-login').addEventListener('click', () => this.showLoginForm());
            document.getElementById('btn-register').addEventListener('click', () => this.showRegisterForm());
        }
    }

    openSidebar(title, htmlContent) {
        this.sidebarTitle.textContent = title;
        this.sidebarContent.innerHTML = htmlContent;
        this.sidebar.classList.add('active');
    }

    closeSidebar(isFailSafe = false) {
        if (this.app.placementType && !isFailSafe) {
            // If we are in placement mode, closing sidebar should explicitly cancel it?
            // Logic in app.js enablePlacementMode handles closeSidebar(true)
            this.app.cancelPlacementMode();
            return;
        }
        this.sidebar.classList.remove('active');
        this.app.selectedObject = null;
    }

    // --- PROFILE ---

    showProfile(user) {
        const html = `
            <form id="profile-form">
                <div class="form-group"><label class="form-label">Anzeigename (Öffentlich)</label><input type="text" class="form-control" name="displayName" value="${user.displayName || ''}"></div>
                <div class="form-group"><label class="form-label">Echter Name (Privat)</label><input type="text" class="form-control" name="realName" value="${user.realName || ''}"></div>
                <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-control" name="email" value="${user.email}"></div>
                <div class="form-group"><label class="form-label">Telefon</label><input type="text" class="form-control" name="phone" value="${user.phone || ''}"></div>
                <button type="submit" class="btn btn-primary" style="width:100%">Speichern</button>
            </form>
        `;
        this.openSidebar("Mein Profil", html);

        document.getElementById('profile-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.target).entries());
            this.app.handleUpdateProfile(data);
        });
    }

    // --- CREATION FLOW ---

    startCreationFlow() {
        const html = `
            <h3>Was möchten Sie hinzufügen?</h3>
            <p>Wählen Sie einen Typ aus und klicken Sie anschließend auf die Karte.</p>
            <div style="display:flex; flex-direction:column; gap:10px; margin-top:20px;">
                <button class="btn btn-primary" id="select-building" style="background-color: var(--color-primary);">Interessensbekundung (Gebäude)</button>
                <button class="btn btn-primary" id="select-project" style="background-color: #E30613; border-color: #E30613;">Wärmenetzprojekt</button>
                <button class="btn btn-primary" id="select-initiative" style="background-color: #28a745; border-color: #28a745;">Wärmenetzinitiative</button>
                <button class="btn btn-primary" id="select-wasteheat" style="background-color: #fd7e14; border-color: #fd7e14;">Abwärme-Quelle</button>
            </div>
        `;
        this.openSidebar("Neues Objekt", html);

        document.getElementById('select-building').addEventListener('click', () => this.app.enablePlacementMode('building'));
        document.getElementById('select-project').addEventListener('click', () => this.app.enablePlacementMode('project'));
        document.getElementById('select-initiative').addEventListener('click', () => this.app.enablePlacementMode('initiative'));
        document.getElementById('select-wasteheat').addEventListener('click', () => this.app.enablePlacementMode('wasteheat'));
    }

    showAddForm(type, latlng) {
        let formHTML = '';
        if (type === 'building') {
            formHTML = `
                <div class="form-group"><label class="form-label">Name des Gebäudes / Projekts *</label><input type="text" class="form-control" name="name" required></div>
                <div class="form-group"><label class="form-label">Adresse *</label><input type="text" class="form-control" name="address" required></div>
                <div class="form-group"><label class="form-label">Gebäudetyp *</label>
                    <select class="form-control" name="type" required>
                        <option value="Wohngebäude">Wohngebäude</option>
                        <option value="Gewerbegebäude">Gewerbegebäude</option>
                        <option value="Gemischt">Gemischt</option>
                    </select>
                </div>
                <div class="form-group"><label class="form-label">Größe (m²)</label><input type="number" class="form-control" name="sizeSqm"></div>
                <div class="form-group"><label class="form-label">Heizsystem</label><input type="text" class="form-control" name="heatingSystem"></div>
                <div class="form-group"><label class="form-label">Energieträger</label>
                    <select class="form-control" name="energySource">
                         <option value="Gas">Gas</option>
                        <option value="Öl">Öl</option>
                        <option value="Fernwärme">Fernwärme</option>
                        <option value="Strom">Strom</option>
                        <option value="Wärmepumpe">Wärmepumpe</option>
                        <option value="Sonstiges">Sonstiges</option>
                    </select>
                </div>
                <div class="form-group"><label class="form-label">Baujahr Heizung</label><input type="number" class="form-control" name="heatingYear"></div>
                <div class="form-group"><label class="form-label">Geplanter Tausch (Jahr)</label><input type="number" class="form-control" name="plannedReplacementYear"></div>
                <div class="form-group"><label class="form-label">Jahresbedarf (kWh) *</label><input type="number" class="form-control" name="estimatedDemand" required></div>
                <div class="form-group"><label class="form-label">Zusätzliche Informationen</label><textarea class="form-control" name="info"></textarea></div>
            `;
        } else if (type === 'initiative') {
            formHTML = `
                <div class="form-group"><label class="form-label">Name der Initiative *</label><input type="text" class="form-control" name="name" required></div>
                 <div class="form-group"><label class="form-label">Website</label><input type="url" class="form-control" name="website"></div>
                 <div class="form-group"><label class="form-label">Typ</label><input type="text" class="form-control" name="orgType"></div>
                 <div class="form-group"><label class="form-label">Zielsetzung</label><textarea class="form-control" name="goal"></textarea></div>
                 <div class="form-group"><label class="form-label">Zusätzliche Informationen</label><textarea class="form-control" name="info"></textarea></div>
            `;
        } else if (type === 'project') {
            formHTML = `
                <div class="form-group"><label class="form-label">Name des Projekts *</label><input type="text" class="form-control" name="name" required></div>
                <div class="form-group"><label class="form-label">Website</label><input type="url" class="form-control" name="website"></div>
                <div class="form-group"><label class="form-label">Umsetzungszeitplan</label><input type="text" class="form-control" name="implementationSchedule"></div>
                <div class="form-group">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <input type="checkbox" id="additionalConsumersPossible" name="additionalConsumersPossible" value="true">
                        <label for="additionalConsumersPossible" style="margin:0;">Weitere Abnehmer möglich</label>
                    </div>
                </div>
                <div class="form-group"><label class="form-label">Zusätzliche Informationen</label><textarea class="form-control" name="info"></textarea></div>
            `;
        } else if (type === 'wasteheat') {
            formHTML = `
                <div class="form-group"><label class="form-label">Quelle / Name *</label><input type="text" class="form-control" name="name" required></div>
                <div class="form-group"><label class="form-label">Typ</label><input type="text" class="form-control" name="sourceType"></div>
                <div class="form-group"><label class="form-label">Zusätzliche Informationen</label><textarea class="form-control" name="info"></textarea></div>
            `;
        }

        const html = `
            <form id="add-object-form">
                <input type="hidden" name="category" value="${type}">
                <input type="hidden" name="lat" value="${latlng.lat}">
                <input type="hidden" name="lng" value="${latlng.lng}">
                ${formHTML}
                <hr>
                <h4>Kontakt (Pflichtfeld)</h4>
                <div class="form-group"><label class="form-label">Name *</label><input type="text" class="form-control" name="contactName" value="${this.app.currentUser.realName || this.app.currentUser.displayName}" required></div>
                <div class="form-group"><label class="form-label">Email *</label><input type="email" class="form-control" name="contactEmail" value="${this.app.currentUser.email}" required></div>
                <div class="form-group">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <input type="checkbox" id="hideEmail" name="hideEmail">
                        <label for="hideEmail" style="margin:0;">Email nicht öffentlich anzeigen</label>
                    </div>
                </div>
                <div class="form-group"><label class="form-label">Telefon</label><input type="text" class="form-control" name="contactPhone" value="${this.app.currentUser.phone || ''}"></div>
                <div class="form-group">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <input type="checkbox" id="hidePhone" name="hidePhone">
                        <label for="hidePhone" style="margin:0;">Telefon nicht öffentlich anzeigen</label>
                    </div>
                </div>
                <button type="submit" class="btn btn-primary" style="width:100%; margin-top:20px;">Objekt speichern</button>
            </form>
        `;

        this.openSidebar("Daten eingeben", html);

        document.getElementById('add-object-form').addEventListener('submit', (e) => {
            e.preventDefault();
            if (!e.target.checkValidity()) { e.target.reportValidity(); return; }
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            data.contact = {
                name: data.contactName,
                email: data.contactEmail,
                phone: data.contactPhone,
                hideEmail: !!data.hideEmail,
                hidePhone: !!data.hidePhone
            };
            data.geom = { lat: parseFloat(data.lat), lng: parseFloat(data.lng) };
            delete data.contactName; delete data.contactEmail; delete data.contactPhone; delete data.hideEmail; delete data.hidePhone;
            this.app.handleSaveObject(data);
        });
    }

    getCategoryLabel(category) {
        const labels = {
            'building': 'Interessensbekundung (Gebäude)',
            'initiative': 'Wärmenetzinitiative',
            'project': 'Wärmenetzprojekt',
            'wasteheat': 'Abwärme'
        };
        return labels[category] || category;
    }

    showObjectDetails(obj) {
        const isOwner = this.app.currentUser && this.app.currentUser.id === obj.userId;
        const categoryLabel = this.getCategoryLabel(obj.category);

        let detailsHtml = `<p><strong>Kategorie:</strong> <span class="badge badge-${obj.category}">${categoryLabel}</span></p>`;

        if (obj.category === 'building') {
            detailsHtml += `
                <p><strong>Name:</strong> ${obj.name || 'Unbenannt'}</p>
                <p><strong>Adresse:</strong> ${obj.address}</p>
                <p><strong>Bedarf:</strong> ${obj.estimatedDemand ? obj.estimatedDemand.toLocaleString('de-DE') : '-'} kWh/Jahr</p>
                ${obj.type ? `<p><strong>Gebäudetyp:</strong> ${obj.type}</p>` : ''}
                ${obj.sizeSqm ? `<p><strong>Größe:</strong> ${obj.sizeSqm} m²</p>` : ''}
                ${obj.heatingSystem ? `<p><strong>Heizsystem:</strong> ${obj.heatingSystem}</p>` : ''}
                ${obj.energySource ? `<p><strong>Energieträger:</strong> ${obj.energySource}</p>` : ''}
                ${obj.heatingYear ? `<p><strong>Baujahr Heizung:</strong> ${obj.heatingYear}</p>` : ''}
                ${obj.plannedReplacementYear ? `<p><strong>Geplanter Tausch:</strong> ${obj.plannedReplacementYear}</p>` : ''}
            `;
        } else if (obj.category === 'initiative') {
            detailsHtml += `
                <p><strong>Name:</strong> ${obj.name}</p>
                ${obj.website ? `<p><strong>Website:</strong> <a href="${obj.website}" target="_blank" rel="noopener noreferrer">${obj.website}</a></p>` : ''}
                ${obj.orgType ? `<p><strong>Typ:</strong> ${obj.orgType}</p>` : ''}
                <p><strong>Ziel:</strong> ${obj.goal || '-'}</p>
            `;
        } else if (obj.category === 'project') {
            detailsHtml += `
                <p><strong>Name:</strong> ${obj.name}</p>
                ${obj.website ? `<p><strong>Website:</strong> <a href="${obj.website}" target="_blank" rel="noopener noreferrer">${obj.website}</a></p>` : ''}
                ${obj.implementationSchedule ? `<p><strong>Umsetzungszeitplan:</strong> ${obj.implementationSchedule}</p>` : ''}
                <p><strong>Weitere Abnehmer möglich:</strong> ${obj.additionalConsumersPossible ? 'Ja' : 'Nein'}</p>
            `;
        } else if (obj.category === 'wasteheat') {
            detailsHtml += `
                <p><strong>Quelle:</strong> ${obj.name}</p>
                ${obj.sourceType ? `<p><strong>Typ:</strong> ${obj.sourceType}</p>` : ''}
            `;
        }

        if (obj.info) {
            detailsHtml += `<p><strong>Informationen:</strong> ${obj.info}</p>`;
        }

        const contactHtml = obj.contact ? `
            <p>${obj.contact.name} | 
            ${obj.contact.hideEmail ? '<span style="color:#777; font-style:italic;">(Email nicht öffentlich)</span>' : obj.contact.email} | 
            ${obj.contact.hidePhone ? '<span style="color:#777; font-style:italic;">(Telefon nicht öffentlich)</span>' : (obj.contact.phone || '-')}</p>
        ` : '';
        const commentsHtml = (obj.comments || []).map(c => {
            let timeStr = '';
            if (c.timestamp) {
                const date = new Date(c.timestamp);
                timeStr = date.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            }
            return `<div class="comment" style="margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                <div style="font-size: 0.85em; color: #555; display: flex; justify-content: space-between;">
                    <strong>${c.authorName || 'User #' + c.userId}</strong>
                    <span>${timeStr}</span>
                </div>
                <div style="margin-top: 2px;">${c.text}</div>
            </div>`;
        }).join('');

        const html = `
            <div class="building-card" style="border:none;">
                ${detailsHtml}
                <hr>
                <h4>Kontakt</h4>
                ${contactHtml}
            </div>
            ${isOwner ? `
                <div style="display:flex; gap:10px; width:100%;">
                    <button id="btn-edit" class="btn btn-primary" style="flex:1;">Bearbeiten</button>
                    <button id="btn-delete" class="btn btn-outline" style="flex:1; color:red; border-color:red;">Löschen</button>
                </div>
            ` : ''}
            <div class="comments-section">
                <h4>Kommentare</h4>
                <div class="comments-list">
                    ${commentsHtml.length > 0 ? commentsHtml : '<p style="font-style:italic; color:#777;">Keine Kommentare vorhanden.</p>'}
                </div>
                ${this.app.currentUser ? `<form id="comment-form" style="margin-top:10px;"><input class="form-control" name="text" placeholder="Kommentar..." required><button class="btn btn-primary" style="width:100%; margin-top:5px;">Senden</button></form>` : ''}
            </div>
        `;
        this.openSidebar("Details", html);

        if (isOwner) {
            document.getElementById('btn-delete').addEventListener('click', () => {
                this.showConfirm("Sind Sie sicher, dass Sie dieses Objekt dauerhaft löschen möchten?", "Objekt löschen", () => {
                    this.app.handleDeleteObject(obj.id);
                });
            });
            document.getElementById('btn-edit').addEventListener('click', () => this.showEditForm(obj));
        }
        if (this.app.currentUser) document.getElementById('comment-form').addEventListener('submit', (e) => { e.preventDefault(); this.app.handleAddComment(obj.id, e.target.elements.text.value); });
    }

    showEditForm(obj) {
        const type = obj.category;
        let formHTML = '';
        if (type === 'building') {
            formHTML = `
                <div class="form-group"><label class="form-label">Name des Gebäudes / Projekts *</label><input type="text" class="form-control" name="name" value="${obj.name || ''}" required></div>
                <div class="form-group"><label class="form-label">Adresse *</label><input type="text" class="form-control" name="address" value="${obj.address}" required></div>
                <div class="form-group"><label class="form-label">Gebäudetyp *</label>
                    <select class="form-control" name="type" required>
                        <option value="Wohngebäude" ${obj.type === 'Wohngebäude' ? 'selected' : ''}>Wohngebäude</option>
                        <option value="Gewerbegebäude" ${obj.type === 'Gewerbegebäude' ? 'selected' : ''}>Gewerbegebäude</option>
                        <option value="Gemischt" ${obj.type === 'Gemischt' ? 'selected' : ''}>Gemischt</option>
                    </select>
                </div>
                <div class="form-group"><label class="form-label">Größe (m²)</label><input type="number" class="form-control" name="sizeSqm" value="${obj.sizeSqm || ''}"></div>
                <div class="form-group"><label class="form-label">Heizsystem</label><input type="text" class="form-control" name="heatingSystem" value="${obj.heatingSystem || ''}"></div>
                <div class="form-group"><label class="form-label">Energieträger</label>
                    <select class="form-control" name="energySource">
                         <option value="Gas" ${obj.energySource === 'Gas' ? 'selected' : ''}>Gas</option>
                         <option value="Öl" ${obj.energySource === 'Öl' ? 'selected' : ''}>Öl</option>
                         <option value="Fernwärme" ${obj.energySource === 'Fernwärme' ? 'selected' : ''}>Fernwärme</option>
                         <option value="Strom" ${obj.energySource === 'Strom' ? 'selected' : ''}>Strom</option>
                         <option value="Wärmepumpe" ${obj.energySource === 'Wärmepumpe' ? 'selected' : ''}>Wärmepumpe</option>
                         <option value="Sonstiges" ${obj.energySource === 'Sonstiges' ? 'selected' : ''}>Sonstiges</option>
                    </select>
                </div>
                <div class="form-group"><label class="form-label">Baujahr Heizung</label><input type="number" class="form-control" name="heatingYear" value="${obj.heatingYear || ''}"></div>
                <div class="form-group"><label class="form-label">Geplanter Tausch (Jahr)</label><input type="number" class="form-control" name="plannedReplacementYear" value="${obj.plannedReplacementYear || ''}"></div>
                <div class="form-group"><label class="form-label">Jahresbedarf (kWh) *</label><input type="number" class="form-control" name="estimatedDemand" value="${obj.estimatedDemand}" required></div>
                <div class="form-group"><label class="form-label">Zusätzliche Informationen</label><textarea class="form-control" name="info">${obj.info || ''}</textarea></div>
            `;
        } else if (type === 'initiative') {
            formHTML = `
                <div class="form-group"><label class="form-label">Name der Initiative *</label><input type="text" class="form-control" name="name" value="${obj.name}" required></div>
                 <div class="form-group"><label class="form-label">Website</label><input type="url" class="form-control" name="website" value="${obj.website || ''}"></div>
                 <div class="form-group"><label class="form-label">Typ</label><input type="text" class="form-control" name="orgType" value="${obj.orgType || ''}"></div>
                 <div class="form-group"><label class="form-label">Zielsetzung</label><textarea class="form-control" name="goal">${obj.goal || ''}</textarea></div>
                 <div class="form-group"><label class="form-label">Zusätzliche Informationen</label><textarea class="form-control" name="info">${obj.info || ''}</textarea></div>
            `;
        } else if (type === 'project') {
            formHTML = `
                <div class="form-group"><label class="form-label">Name des Projekts *</label><input type="text" class="form-control" name="name" value="${obj.name || ''}" required></div>
                <div class="form-group"><label class="form-label">Website</label><input type="url" class="form-control" name="website" value="${obj.website || ''}"></div>
                <div class="form-group"><label class="form-label">Umsetzungszeitplan</label><input type="text" class="form-control" name="implementationSchedule" value="${obj.implementationSchedule || ''}"></div>
                <div class="form-group">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <input type="checkbox" id="editAdditionalConsumersPossible" name="additionalConsumersPossible" value="true" ${obj.additionalConsumersPossible ? 'checked' : ''}>
                        <label for="editAdditionalConsumersPossible" style="margin:0;">Weitere Abnehmer möglich</label>
                    </div>
                </div>
                <div class="form-group"><label class="form-label">Zusätzliche Informationen</label><textarea class="form-control" name="info">${obj.info || ''}</textarea></div>
            `;
        } else if (type === 'wasteheat') {
            formHTML = `
                <div class="form-group"><label class="form-label">Quelle / Name *</label><input type="text" class="form-control" name="name" value="${obj.name}" required></div>
                <div class="form-group"><label class="form-label">Typ</label><input type="text" class="form-control" name="sourceType" value="${obj.sourceType || ''}"></div>
                <div class="form-group"><label class="form-label">Zusätzliche Informationen</label><textarea class="form-control" name="info">${obj.info || ''}</textarea></div>
            `;
        }

        const html = `
            <form id="edit-object-form">
                <input type="hidden" name="id" value="${obj.id}">
                <input type="hidden" name="category" value="${obj.category}">
                ${formHTML}
                <hr>
                <h4>Kontakt (Pflichtfeld)</h4>
                <div class="form-group"><label class="form-label">Name *</label><input type="text" class="form-control" name="contactName" value="${obj.contact.name}" required></div>
                <div class="form-group"><label class="form-label">Email *</label><input type="email" class="form-control" name="contactEmail" value="${obj.contact.email}" required></div>
                <div class="form-group">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <input type="checkbox" id="editHideEmail" name="hideEmail" ${obj.contact.hideEmail ? 'checked' : ''}>
                        <label for="editHideEmail" style="margin:0;">Email nicht öffentlich anzeigen</label>
                    </div>
                </div>
                <div class="form-group"><label class="form-label">Telefon</label><input type="text" class="form-control" name="contactPhone" value="${obj.contact.phone || ''}"></div>
                <div class="form-group">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <input type="checkbox" id="editHidePhone" name="hidePhone" ${obj.contact.hidePhone ? 'checked' : ''}>
                        <label for="editHidePhone" style="margin:0;">Telefon nicht öffentlich anzeigen</label>
                    </div>
                </div>
                <button type="submit" class="btn btn-primary" style="width:100%; margin-top:20px;">Änderungen speichern</button>
            </form>
        `;

        this.openSidebar("Objekt bearbeiten", html);

        document.getElementById('edit-object-form').addEventListener('submit', (e) => {
            e.preventDefault();
            if (!e.target.checkValidity()) { e.target.reportValidity(); return; }
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            data.contact = {
                name: data.contactName,
                email: data.contactEmail,
                phone: data.contactPhone,
                hideEmail: !!data.hideEmail,
                hidePhone: !!data.hidePhone
            };
            data.id = parseInt(data.id);
            delete data.contactName; delete data.contactEmail; delete data.contactPhone; delete data.hideEmail; delete data.hidePhone;
            this.app.handleUpdateObject(data);
        });
    }

    showUserEntries(user) {
        this.app.api.getObjects().then(objects => {
            const myObjects = objects.filter(o => o.userId === user.id);
            const html = myObjects.length ? `<div class="list-group">${myObjects.map(o => `<div class="building-card item-my-entry" data-id="${o.id}" style="cursor:pointer;"><strong>${o.name || o.address}</strong> <span class="badge badge-${o.category}">${this.getCategoryLabel(o.category)}</span></div>`).join('')}</div>` : "<p>Keine Einträge.</p>";
            this.openSidebar("Meine Anträge", html);
            document.querySelectorAll('.item-my-entry').forEach(el => el.addEventListener('click', () => this.app.selectObject(objects.find(x => x.id == el.dataset.id))));
        });
    }

    showLoginForm() { this.openAuthModal(`<h2>Anmelden</h2><form id="login-form"><div class="form-group"><input type="email" class="form-control" name="email" placeholder="E-Mail-Adresse" required></div><div class="form-group"><input type="password" class="form-control" name="password" placeholder="Passwort" required></div><button type="submit" class="btn btn-primary" style="width:100%">Anmelden</button></form>`); document.getElementById('login-form').addEventListener('submit', (e) => { e.preventDefault(); this.app.handleLogin(e.target.elements.email.value, e.target.elements.password.value); }); }
    showRegisterForm() { this.openAuthModal(`<h2>Registrieren</h2><form id="register-form"><div class="form-group"><label>Vorname *</label><input type="text" class="form-control" name="firstName" required></div><div class="form-group"><label>Nachname *</label><input type="text" class="form-control" name="lastName" required></div><div class="form-group"><label>Anzeigename (z.B. Firma/Inititative)</label><input type="text" class="form-control" name="displayName" required></div><div class="form-group"><label>Email</label><input type="email" class="form-control" name="email" required></div><div class="form-group"><label>Passwort</label><input type="password" class="form-control" name="password" required></div><button type="submit" class="btn btn-primary" style="width:100%">Registrieren</button></form>`); document.getElementById('register-form').addEventListener('submit', (e) => { e.preventDefault(); const formData = Object.fromEntries(new FormData(e.target).entries()); formData.realName = `${formData.firstName} ${formData.lastName}`; delete formData.firstName; delete formData.lastName; this.app.handleRegister(formData); }); }
    openAuthModal(html) { this.authModalContent.innerHTML = html; this.authModal.style.display = 'flex'; }
    closeAuthModal() { this.authModal.style.display = 'none'; }

    // --- MODALS ---

    showAlert(message, title = null) {
        this.modalTitle.textContent = title || '';
        this.modalTitle.style.display = title ? 'block' : 'none';
        this.modalMessage.textContent = message;
        this.btnModalPrimary.textContent = 'OK';
        this.btnModalSecondary.style.display = 'none';

        this.appModal.style.display = 'flex';

        const handleOk = () => {
            this.appModal.style.display = 'none';
            this.btnModalPrimary.removeEventListener('click', handleOk);
        };

        this.btnModalPrimary.addEventListener('click', handleOk);
    }

    showConfirm(message, title = null, onConfirm) {
        this.modalTitle.textContent = title || 'Bestätigen';
        this.modalTitle.style.display = title ? 'block' : 'none';
        this.modalMessage.textContent = message;
        this.btnModalPrimary.textContent = 'Ja';
        this.btnModalSecondary.textContent = 'Abbrechen';
        this.btnModalSecondary.style.display = 'block';

        this.appModal.style.display = 'flex';

        const cleanup = () => {
            this.appModal.style.display = 'none';
            this.btnModalPrimary.removeEventListener('click', handleConfirm);
            this.btnModalSecondary.removeEventListener('click', handleCancel);
        };

        const handleConfirm = () => {
            cleanup();
            if (onConfirm) onConfirm();
        };

        const handleCancel = () => {
            cleanup();
        };

        this.btnModalPrimary.addEventListener('click', handleConfirm);
        this.btnModalSecondary.addEventListener('click', handleCancel);
    }

    addTooltips() {
        // Simple tooltip implementation
        const buttons = document.querySelectorAll('[title]');
        buttons.forEach(btn => {
            let tooltipTimeout;
            let tooltip;

            btn.addEventListener('mouseenter', () => {
                tooltipTimeout = setTimeout(() => {
                    tooltip = document.createElement('div');
                    tooltip.className = 'custom-tooltip';
                    tooltip.textContent = btn.getAttribute('title');
                    document.body.appendChild(tooltip);

                    const rect = btn.getBoundingClientRect();
                    tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
                    tooltip.style.top = rect.bottom + 8 + 'px';
                }, 500);
            });

            btn.addEventListener('mouseleave', () => {
                clearTimeout(tooltipTimeout);
                if (tooltip) {
                    tooltip.remove();
                    tooltip = null;
                }
            });
        });
    }
}
