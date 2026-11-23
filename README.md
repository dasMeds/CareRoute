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

Open `http://localhost:4173`. VS Code Live Server, `npx serve .`, or XAMPP static hosting from `htdocs` also work. There are no external CSS or icon CDNs.

The file paths in the directory tree are all included in this repository; load `index.html` from the served project root.

Use the **Autofill Credentials for evaluation** control on the sign-in form. The demonstration passcode is `demo123`. The sample credentials are not real authentication. Choose a role, enter an account/badge, select the assigned facility/unit where shown, and acknowledge the privacy notice before signing in. The **Sign Out / Switch Account** control ends the local role session.

Hospital capacity, triage submissions, transport status, and access audit entries persist in browser `localStorage` and are synchronized between views and same-origin tabs. **Reset Demo Data** restores the six seed facility records and clears submitted triage, transport, audit, and map-mode state. It is intended for demonstration resets, not for managing production records.

## Navigation and maps

The navigation panel embeds route previews in the patient capacity view and ambulance dispatch workflow. It supports the PLV Maysan Campus, Karuhatan, Malinta, Marulas, and Malanday starting points, browser GPS (permission and Valenzuela coverage permitting), facility pins, traffic scenarios, a recommended and alternate corridor, turn-by-turn instructions, a moving route marker, pause/resume, step-forward, reset, and simulated transport stages.

CareRoute calculates deterministic routes across a Valenzuela road-corridor graph and guards numeric inputs/results so distance, ETA, speed, progress, and map coordinates use finite values. The simulation's distances and travel estimates are approximations, not road-verified or emergency dispatch directions.

For Google Maps, set `googleMapsApiKey` in `js/config.js`, or define `window.CAREROUTE_CONFIG = { googleMapsApiKey: "YOUR_RESTRICTED_KEY" }` before `js/app.js` loads. The key is public browser configuration; restrict it by origin and enabled APIs, and do not commit an unrestricted credential. When online with a working key, the prototype loads Maps JavaScript, the native Traffic Layer, facility markers, and Google Directions results. It falls back to its vector map when the key is absent, network is offline, API loading fails, or Offline Fallback is selected. Auto mode chooses Google Maps only when a configured key and API are available.

**Waze does not offer a general public embedded routing API/SDK.** CareRoute therefore implements Waze-style congestion scoring, traffic-colored corridors, turn-by-turn cues, alternate route comparison, and dynamic diversion/rerouting in its own routing engine. External Google Maps and Waze links are provided as optional handoff links; they are not embedded Waze services.

The offline high-DPI canvas draws Valenzuela corridor geometry, labeled major roads, local traffic overlays, status-coded hospital pins, the recommended and dashed alternate route, origin, and a live simulated vehicle marker. This self-contained map uses no remote tiles. Its corridor geometry is a prototype model rather than a survey-grade GIS map.

## Security, privacy, and regulatory alignment

The prototype demonstrates role-separated Patient/Public, Rescue, and Hospital Administrator workspaces; a consent acknowledgment; minimum-necessary triage fields; generated transaction IDs; sanitized dynamic text; hashed demo session tokens; session timeout checks; and an audit log for sign-in, capacity, triage, routing, and navigation actions.

These are educational safeguards inspired by **RA 10173 (Data Privacy Act of 2012)**, **RA 11223 (Universal Health Care Act)**, **DOH National Patient Navigation and Referral System (NPNRS)** principles, and HIPAA administrative, technical, and physical safeguard concepts. They are not a compliance certification. This prototype is not a hospital system, emergency dispatch service, or medical advice, and must not be used for real patient care. Production deployment requires server-side identity and authorization, HTTPS/TLS, encrypted storage and transfer, operational retention/incident controls, clinical validation, signed data-sharing and business associate agreements as applicable, and formal NPC/DOH and legal review.
