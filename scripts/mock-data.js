const MOCK_DATA = {
    users: [
        {
            id: 1,
            displayName: "MaxM",
            realName: "Max Mustermann",
            email: "max@example.com",
            password: "password123", // Plain text for prototype
            phone: "030 1234567"
        },
        {
            id: 2,
            displayName: "SolarMaria",
            realName: "Maria Musterfrau",
            email: "maria@example.com",
            password: "password456",
            phone: "030 9876543"
        }
    ],
    objects: [
        {
            id: 1,
            userId: 1,
            category: 'building',
            name: "Wohnblock Mitte",
            address: "Torstraße 1, 10119 Berlin",
            type: "Wohngebäude",
            sizeSqm: 1200,
            heatingSystem: "Gaszentralheizung",
            energySource: "Gas",
            heatingYear: 1995,
            plannedReplacementYear: 2027,
            estimatedDemand: 150000,
            geom: { lat: 52.5280, lng: 13.4100 },
            contact: { name: "Max Mustermann", email: "max@example.com", phone: "030 1234567" },
            comments: []
        },
        {
            id: 2,
            userId: 2,
            category: 'initiative',
            name: "Solar-Inititative Pankow",
            website: "https://solar-pankow.de",
            orgType: "Bürgerinitiative",
            goal: "Errichtung von PV-Anlagen auf Dächern.",
            geom: { lat: 52.5700, lng: 13.4000 },
            contact: { name: "Maria Musterfrau", email: "maria@example.com", phone: "030 9876543" },
            comments: [
                { id: 101, userId: 1, text: "Tolle idee! Wir haben Interesse.", timestamp: "2025-10-01T10:00:00Z" }
            ]
        },
        {
            id: 3,
            userId: 1,
            category: 'wasteheat',
            name: "Rechenzentrum Ost",
            sourceType: "Rechenzentrum",
            info: "Konstante Abwärme 40°C ganzjährig verfügbar.",
            geom: { lat: 52.5210, lng: 13.4300 },
            contact: { name: "Max Mustermann", email: "max@example.com", phone: "030 1234567" },
            comments: []
        }
    ]
};
