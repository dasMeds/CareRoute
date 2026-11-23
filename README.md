# CareRoute

**Design and Development of CareRoute: A Web and Mobile-Based Hospital Capacity Tracker and Patient Navigation System for Valenzuela City**

CareRoute is a browser-based capstone prototype for Valenzuela City hospital ER capacity discovery, privacy-minimized pre-arrival triage, ambulance dispatch coordination, and facility status management.

## Project layout

```text
careroute-prototype/
├── .gitignore
├── README.md
├── index.html
├── css/
│   ├── variables.css
│   ├── layout.css
│   └── components.css
├── js/
│   ├── config.js
│   ├── data/
│   │   └── hospitals.js
│   ├── services/
│   │   ├── storageService.js
│   │   ├── securityService.js
│   │   └── mapService.js
│   ├── views/
│   │   ├── authView.js
│   │   ├── patientView.js
│   │   ├── rescueView.js
│   │   └── adminView.js
│   └── app.js
└── assets/
    └── icons.js
```

## Run locally

Serve the directory over HTTP (ES modules do not run from `file://`):

```bash
python -m http.server 4173
```

Open `http://localhost:4173`. VS Code Live Server, `npx serve .`, or XAMPP static hosting from `htdocs` also work. Leaflet's library and stylesheet are loaded from unpkg when online; the app's clinical UI styles and icons remain local.

The file paths in the directory tree are all included in this repository; load `index.html` from the served project root.

Use the **Autofill Credentials for evaluation** control on the sign-in form. The demonstration passcode is `demo123`. The sample credentials are not real authentication. Choose a role, enter an account/badge, select the assigned facility/unit where shown, and acknowledge the privacy notice before signing in. The **Sign Out / Switch Account** control ends the local role session.

Hospital capacity, triage submissions, transport status, and access audit entries persist in browser `localStorage` and are synchronized between views and same-origin tabs. **Reset Demo Data** restores the six seed facility records and clears submitted triage, transport, audit, and map-mode state. It is intended for demonstration resets, not for managing production records.

## Navigation and maps

The map uses Leaflet.js with CARTO Positron tiles and OpenStreetMap tile backup, centered on Valenzuela City. Facility markers reflect the latest locally stored ER capacity status. Routing requests use the public OSRM driving endpoint for street-following GeoJSON geometry, alternatives when available, and turn-by-turn steps. These public demonstration services require no API key or billing account; they have usage policies and no availability guarantee, and do not provide live traffic data. Online tile requests expose the requester's IP and map area to the tile providers; OSRM receives only the origin and destination coordinates. No patient name, identifier, or clinical data is included in map requests. Avoid using patient-identifying locations with these public services.

Choose **Auto**, **Free Map API**, or **Offline Fallback** in the header. Auto and Free Map API use Leaflet and OSRM while online. If the browser is offline or Leaflet, tiles, or OSRM are unavailable, CareRoute switches to its self-contained Valenzuela road-grid canvas. The grid preserves the PLV Maysan Campus, Karuhatan, Malinta, Marulas, and Malanday starting points, facility pins, simulated traffic corridors, alternate-route preview, and moving route marker for a dependable demonstration. Offline distance, ETA, traffic status, and route geometry are local estimates, not road-verified directions.

The ambulance workflow also supports browser GPS (permission and Valenzuela coverage permitting), capacity-based diversion recommendations, traffic scenario overlays, turn-by-turn guidance, pause/resume, step-forward, reset, and simulated transport stages. Traffic colors represent the selected local demonstration scenario; OSRM's public route service does not provide live traffic conditions.

Map tiles are attributed to OpenStreetMap and CARTO. The optional Google Maps and Waze buttons in the rescue workflow open external navigation pages; neither service is embedded or required for CareRoute's map or routing.

## Security, privacy, and regulatory alignment

The prototype demonstrates role-separated Patient/Public, Rescue, and Hospital Administrator workspaces; a consent acknowledgment; minimum-necessary triage fields; generated transaction IDs; sanitized dynamic text; hashed demo session tokens; session timeout checks; and an audit log for sign-in, capacity, triage, routing, and navigation actions.

These are educational safeguards inspired by **RA 10173 (Data Privacy Act of 2012)**, **RA 11223 (Universal Health Care Act)**, **DOH National Patient Navigation and Referral System (NPNRS)** principles, and HIPAA administrative, technical, and physical safeguard concepts. They are not a compliance certification. This prototype is not a hospital system, emergency dispatch service, or medical advice, and must not be used for real patient care. Production deployment requires server-side identity and authorization, HTTPS/TLS, encrypted storage and transfer, operational retention/incident controls, clinical validation, signed data-sharing and business associate agreements as applicable, and formal NPC/DOH and legal review.
