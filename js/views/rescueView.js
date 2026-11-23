import { icon } from "../../assets/icons.js";
import { mapService } from "../services/mapService.js";
import { storageService } from "../services/storageService.js";
import { securityService } from "../services/securityService.js";

const transportStatuses = ["Dispatched", "En Route", "Arriving Soon", "Handed Over"];

export function renderRescue() {
  return `
    <section class="page" data-role-page="rescue">
      <div class="page-header">
        <div><h1>Ambulance & LGU Rescue</h1><p>Dispatch planning, diversion intelligence, and pre-arrival clinical readiness.</p></div>
        <button type="button" class="secondary-button" data-open-advanced>${icon("shield", 16)} Advanced triage</button>
      </div>
      <div class="toolbar" style="margin-bottom:12px">
        <div class="field"><label>Starting location</label><select id="rescueStart">${mapService.startingPoints.map((p, i) => `<option value="${i}">${p.name}</option>`).join("")}</select></div>
        <button type="button" id="useGps" class="secondary-button">${icon("map", 16)} Use GPS</button>
        <button type="button" id="trafficToggle" class="secondary-button">Traffic Layer: On</button>
        <div class="field"><label>Simulated traffic</label><select id="trafficScenario">${Object.entries(mapService.scenarios).map(([key, value]) => `<option value="${key}">${value.label}</option>`).join("")}</select></div>
      </div>
      <div class="map-layout">
        <div id="rescueMap" class="map-container"></div>
        <aside id="rescueSide" class="panel route-panel"><div class="panel-header"><h2>Route & diversion</h2></div><div class="panel-body" id="rescueRoutePanel"></div></aside>
      </div>
    </section>
  `;
}

export function initRescue(app) {
  let destination = storageService.getHospitals()[0];
  let start = mapService.startingPoints[0];
  let gpsStart = null;
  const map = document.querySelector("#rescueMap");
  const panel = document.querySelector("#rescueRoutePanel");

  async function updateRoute() {
    await mapService.render(map, { start, destination });
    const route = await mapService.calculateRoute(start, destination);
    const alternatives = storageService.getHospitals().filter((h) => h.available > 0 && h.id !== destination.id).slice(0, 3);
    const diversion = destination.available === 0;
    panel.innerHTML = `
      <div class="field"><label>Destination hospital</label><select id="rescueDestination">${storageService.getHospitals().map((h) => `<option value="${h.id}" ${h.id === destination.id ? "selected" : ""}>${h.name} — ${h.status}</option>`).join("")}</select></div>
      ${diversion ? `<div class="diversion-warning"><strong>DIVERSION WARNING</strong><br>${destination.name} is Full / Diverting. Consider: ${alternatives.map((h) => h.name).join(", ")}.</div>` : ""}
      <div class="grid-3" style="margin-top:10px">
        <div class="metric"><span>Distance</span><strong>${route.distance}</strong></div>
        <div class="metric"><span>ETA</span><strong>${route.eta} min</strong></div>
        <div class="metric"><span>Road status</span><strong>${route.scenario.label}</strong></div>
      </div>
      <ol class="step-list">${route.steps.map((step) => `<li>${step}</li>`).join("")}</ol>
      <div class="transport-steps" id="transportSteps">${transportStatuses.map((status, i) => `<div class="transport-step ${i === 0 ? "active" : ""}" data-step="${i}">${status}</div>`).join("")}</div>
      <div class="toolbar" style="margin-top:10px">
        <button type="button" id="startNavigation" class="primary-button">Start / Simulate Navigation</button>
        <button type="button" id="googleLink" class="secondary-button">Google Maps</button>
        <button type="button" id="wazeLink" class="secondary-button">Waze</button>
      </div>`;

    document.querySelector("#rescueDestination").addEventListener("change", (event) => {
      destination = storageService.getHospitals().find((h) => h.id === event.target.value);
      securityService.audit("ROUTE_PREVIEW", "rescue", `Selected ${destination.name}`);
      updateRoute();
    });
    document.querySelector("#startNavigation").addEventListener("click", () => startNavigation(app, destination));
    const links = mapService.externalLink(destination, start);
    document.querySelector("#googleLink").addEventListener("click", () => window.open(links.google, "_blank", "noopener"));
    document.querySelector("#wazeLink").addEventListener("click", () => window.open(links.waze, "_blank", "noopener"));
  }

  document.querySelector("#rescueStart").addEventListener("change", (event) => {
    start = mapService.startingPoints[Number(event.target.value)];
    updateRoute();
  });
  document.querySelector("#useGps").addEventListener("click", () => {
    if (!navigator.geolocation) return app.toast("GPS is unavailable in this browser.");
    navigator.geolocation.getCurrentPosition((position) => {
      gpsStart = { name: "Current GPS position", lat: position.coords.latitude, lng: position.coords.longitude };
      if (gpsStart.lat < 14.63 || gpsStart.lat > 14.78 || gpsStart.lng < 120.92 || gpsStart.lng > 121.02) {
        app.toast("GPS location is outside Valenzuela demo coverage. A selectable Valenzuela point is recommended.");
      } else {
        start = gpsStart;
        app.toast("GPS position acquired.");
        updateRoute();
      }
    }, () => app.toast("GPS permission denied or unavailable. Using the selected starting point."), { enableHighAccuracy: true });
  });
  document.querySelector("#trafficToggle").addEventListener("click", (event) => {
    mapService.setTrafficEnabled(!mapService.trafficEnabled);
    event.currentTarget.textContent = `Traffic Layer: ${mapService.trafficEnabled ? "On" : "Off"}`;
    updateRoute();
  });
  document.querySelector("#trafficScenario").addEventListener("change", (event) => {
    mapService.setScenario(event.target.value);
    updateRoute();
  });
  document.querySelector("[data-open-advanced]").addEventListener("click", () => openAdvanced(app, destination));
  updateRoute();
}

function startNavigation(app, hospital) {
  let index = 0;
  const timer = setInterval(() => {
    index++;
    if (index >= transportStatuses.length) {
      clearInterval(timer);
    }
    document.querySelectorAll("[data-step]").forEach((step, i) => step.classList.toggle("active", i === index));
    storageService.setTransport({ hospitalId: hospital.id, status: transportStatuses[Math.min(index, 3)], updatedAt: new Date().toISOString() });
    app.toast(`Transport status: ${transportStatuses[Math.min(index, 3)]}`);
  }, 1800);
  storageService.setTransport({ hospitalId: hospital.id, status: transportStatuses[0], updatedAt: new Date().toISOString() });
  securityService.audit("DISPATCH_UPDATED", "rescue", `${transportStatuses[0]} for ${hospital.name}`);
}

function openAdvanced(app, hospital) {
  app.openModal(`
    <div class="modal-backdrop">
      <section class="panel" style="width:min(680px,94vw)">
        <div class="panel-header"><h2>Advanced Pre-Arrival Digital Triage</h2><button type="button" class="secondary-button" data-close-modal>Close</button></div>
        <form id="advancedTriageForm" class="panel-body">
          <div class="field-grid">
            <div class="field"><label>Chief complaint</label><input name="complaint" required maxlength="40"></div>
            <div class="field"><label>BP (systolic/diastolic)</label><input name="bp" pattern="[0-9]{2,3}/[0-9]{2,3}" placeholder="120/80" required></div>
            <div class="field"><label>Heart rate</label><input name="hr" type="number" min="20" max="240" required></div>
            <div class="field"><label>SpO2 (%)</label><input name="spo2" type="number" min="50" max="100" required></div>
            <div class="field"><label>GCS / consciousness</label><select name="gcs"><option>Alert</option><option>Voice</option><option>Pain</option><option>Unresponsive</option></select></div>
            <div class="field"><label>Trauma / condition</label><select name="condition"><option>Medical</option><option>Trauma</option><option>Cardiac</option><option>Obstetric</option><option>Pediatric</option></select></div>
            <div class="field full"><label>Target ETA</label><input name="eta" type="number" min="1" max="180" value="15" required></div>
          </div>
          <p class="notice" style="margin:12px 0">Core vitals only. No names, government IDs, addresses, or raw narrative notes.</p>
          <button class="primary-button" type="submit">Submit pre-arrival triage</button>
        </form>
      </section>
    </div>
  `);
  document.querySelector("#advancedTriageForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const entry = {
      id: securityService.transactionNumber(),
      source: "Ambulance",
      hospitalId: hospital.id,
      hospitalName: hospital.name,
      complaint: securityService.sanitize(data.complaint),
      bp: data.bp,
      hr: data.hr,
      spo2: data.spo2,
      gcs: data.gcs,
      condition: data.condition,
      eta: data.eta,
      severity: Number(data.spo2) < 90 || data.gcs !== "Alert" ? "High" : "Moderate",
      status: "En Route",
      createdAt: new Date().toISOString()
    };
    storageService.addTriage(entry);
    securityService.audit("ADVANCED_TRIAGE_SUBMITTED", "rescue", `${entry.id} sent to ${hospital.name}`);
    app.closeModal();
    app.toast(`${entry.id} submitted to ${hospital.name}.`);
  });
}
