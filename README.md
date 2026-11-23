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

Facility capacity and specialty availability, triage submissions, transport status, and access audit entries persist in browser `localStorage` and are synchronized between views and same-origin tabs through the `careroute:data` event. **Reset Demo Data** restores the Valenzuela facility directory and clears submitted triage, transport, audit, and map-mode state. It is intended for demonstration resets, not for managing production records.

## Navigation and maps

The map uses Leaflet.js with CARTO Positron tiles and OpenStreetMap data attribution, centered on Valenzuela City. Facility markers reflect locally stored ER status. Routing requests use the public OSRM driving endpoint for street-following geometry, alternatives when available, and turn-by-turn steps. The `Live Traffic Active` badge means CareRoute received a current OSRM route duration and estimates corridor conditions from its segment speeds; OSRM's public routing endpoint does **not** supply verified traffic incidents or guaranteed real-time congestion. Offline mode uses a local time-of-day corridor estimate. These public demo services require no API key and have no availability guarantee. Online tile requests expose the requester's IP and map area to providers; OSRM receives the origin and destination coordinates only. Patient names, identifiers, and clinical fields are not sent in map requests. Avoid using patient-identifying locations with public map services.

Choose **Auto**, **Free Map API**, or **Offline Fallback** in the header. Auto and Free Map API use Leaflet and OSRM while online. If the browser is offline or Leaflet, tiles, or OSRM are unavailable, CareRoute switches to its self-contained Valenzuela road-grid canvas. Starting-point controls offer browser GPS and Valenzuela landmarks; location access is optional and falls back to a landmark. The map includes a Re-center control and keeps routing inside CareRoute. Offline distance, ETA, traffic status, and route geometry are local estimates, not road-verified directions.

The directory covers Valenzuela hospitals, clinics / lying-in facilities, and health centers. Facility locations, bed counts, availability, specialties, and update times in this prototype are sample data and must be verified with the facilities before operational use. Public capacity search supports category, specialty, and status filters plus nearest, least-occupied, and recommended ordering. Triage packets accept basic patient context and responder handoff vitals; they remain browser-local in this prototype.

The hospital dashboard includes quick bed and status controls, specialty switches, an inbound triage queue, and lightweight capacity and acuity visualizations. These controls demonstrate local event synchronization and are not connected to a hospital information system.

## Security, privacy, and regulatory alignment

The prototype demonstrates role-separated Patient/Public, Rescue, and Hospital Administrator workspaces; a consent acknowledgment; minimum-necessary triage fields; generated transaction IDs; sanitized dynamic text; hashed demo session tokens; session timeout checks; and an audit log for sign-in, capacity, triage, routing, and navigation actions.

These are educational safeguards inspired by **RA 10173 (Data Privacy Act of 2012)**, **RA 11223 (Universal Health Care Act)**, **DOH National Patient Navigation and Referral System (NPNRS)** principles, and HIPAA administrative, technical, and physical safeguard concepts. They are not a compliance certification. This prototype is not a hospital system, emergency dispatch service, or medical advice, and must not be used for real patient care. Production deployment requires server-side identity and authorization, HTTPS/TLS, encrypted storage and transfer, operational retention/incident controls, clinical validation, signed data-sharing and business associate agreements as applicable, and formal NPC/DOH and legal review.
