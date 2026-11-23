# CareRoute

**Design and Development of CareRoute: A Web and Mobile-Based Hospital Capacity Tracker and Patient Navigation System for Valenzuela City**

CareRoute is an academic, browser-based prototype for viewing ER capacity, submitting privacy-minimized pre-arrival triage, coordinating ambulance navigation, and allowing authorized hospital staff to update capacity in real time.

## Directory architecture

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
│   ├── data/hospitals.js
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
└── assets/icons.js
```

## Run locally

Serve the repository with any static HTTP server:

```bash
python -m http.server 4173
```

Or use VS Code Live Server, `npx serve .`, or place it in an XAMPP `htdocs` directory. Open `http://localhost:4173` or the corresponding local address. Do not open `index.html` through `file://`; ES modules require HTTP.

The prototype stores demo state in `localStorage`. Hospital updates, triage submissions, transport status, and audit entries synchronize between views in the same browser. Use **Reset Demo Data** in the top bar to restore the seed hospitals and clear locally submitted records.

## Hybrid mapping

Set the public Google Maps JavaScript API key in `js/config.js` using `googleMapsApiKey: "..."`, or provide `window.CAREROUTE_CONFIG = { googleMapsApiKey: "..." }` before the module loads. Do not commit a real secret or restricted credential. The key is public client configuration and must be restricted to approved origins and enabled APIs.

When online and an enabled Maps JavaScript API key is available, CareRoute renders Google Maps, the native Traffic Layer, custom hospital markers, Directions/Routes results, and route instructions. Waze does not provide a general public embedded routing SDK/API. CareRoute therefore models Waze-style congestion scoring, rerouting, segment indicators, and navigation cues locally. An external Google Maps or Waze launch link remains available for manual handoff.

When the key is absent, the network is unavailable, Maps loading fails, or **Offline Fallback** is selected, the app uses a Valenzuela vector/canvas map. It displays major corridors, status-coded hospital markers, simulated congestion segments, and moving transport markers without map tiles.

## Security and compliance

CareRoute is an academic prototype aligned conceptually with RA 10173 (Data Privacy Act of 2012), RA 11223 (Universal Health Care Act), DOH National Patient Navigation and Referral System principles, and HIPAA administrative, technical, and physical safeguard concepts. It minimizes identifiers, uses generated transaction numbers, and maintains role-aware demonstration controls and an audit trail.

This prototype is not a certified clinical system or a HIPAA-compliant implementation. Production use requires HTTPS/TLS, server-side authentication and authorization, encrypted databases, retention and incident controls, validated clinical workflows, signed data-sharing and business associate arrangements where applicable, and review against NPC and DOH requirements.
