class MapManager {
    constructor(mapId, onMapClick, onObjectClick) {
        this.mapId = mapId;
        this.onMapClick = onMapClick;
        this.onObjectClick = onObjectClick;
        this.map = null;
        this.markers = [];
        this.tempMarker = null;

        // Placement Mode
        this.isPlacementMode = false;

        this.colors = {
            building: '#004591',
            initiative: '#28a745',
            project: '#E30613',
            wasteheat: '#fd7e14'
        };
    }

    init() {
        this.map = L.map(this.mapId).setView([52.5200, 13.4050], 12);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende'
        }).addTo(this.map);

        this.map.on('click', (e) => {
            if (this.isPlacementMode) {
                if (this.onMapClick) {
                    this.onMapClick(e.latlng);
                }
            } else {
                // Determine if we should clear temp marker or do nothing
                // "Objects are not created by simply clicking the map."
                this.removeTemporaryMarker();
            }
        });
    }

    setPlacementMode(active) {
        this.isPlacementMode = active;
        if (active) {
            document.getElementById(this.mapId).style.cursor = 'crosshair';
        } else {
            document.getElementById(this.mapId).style.cursor = '';
        }
    }

    renderObjects(objects) {
        this.clearMarkers();
        objects.forEach(obj => {
            if (obj.geom) {
                const color = this.colors[obj.category] || '#333';
                const marker = L.circleMarker([obj.geom.lat, obj.geom.lng], {
                    radius: 8, fillColor: color, color: '#fff', weight: 2, opacity: 1, fillOpacity: 0.8
                })
                    .addTo(this.map)
                    .bindTooltip(obj.name || obj.category, { direction: 'top' });

                marker.on('click', () => {
                    // Ignore clicks on objects if in placement mode? usually yes.
                    if (!this.isPlacementMode && this.onObjectClick) {
                        this.onObjectClick(obj);
                    }
                });
                this.markers.push(marker);
            }
        });
    }

    addTemporaryMarker(latlng) {
        this.removeTemporaryMarker();
        this.tempMarker = L.circleMarker([latlng.lat, latlng.lng], {
            radius: 8, fillColor: '#999', color: '#fff', weight: 2, opacity: 1, fillOpacity: 0.5
        }).addTo(this.map);
    }

    removeTemporaryMarker() {
        if (this.tempMarker) {
            this.map.removeLayer(this.tempMarker);
            this.tempMarker = null;
        }
    }

    clearMarkers() {
        this.markers.forEach(marker => this.map.removeLayer(marker));
        this.markers = [];
    }

    flyTo(lat, lng, zoom = 14) {
        this.map.flyTo([lat, lng], zoom);
    }
}
