import { icon } from "../../assets/icons.js";
import { mapService } from "../services/mapService.js";
import { storageService } from "../services/storageService.js";
import { securityService } from "../services/securityService.js";

const transportStatuses = ["Dispatched", "En Route", "Arriving Soon", "Handed Over"];
const safeNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function renderRescue() {
  return `
    <section class="page" data-role-page="rescue">
      <div class="page-header">
        <div><h1>Ambulance & LGU Rescue</h1><p>Dispatch planning, diversion intelligence, and pre-arrival clinical readiness.</p></div>
        <button type="button" class="secondary-button" data-open-advanced>${icon("shield", 16)} Advanced triage</button>
      </div>
      <div class="panel dispatch-toolbar">
        <div class="field"><label for="rescueStart">Starting location</label><select id="rescueStart">${mapService.startingPoints.map((point, index) => `<option value="${index}">${point.name}</option>`).join("")}</select></div>
        <button type="button" id="useGps" class="secondary-button">${icon("map", 16)} Use GPS</button>
        <button type="button" id="trafficToggle" class="secondary-button">Traffic Layer: On</button>
        <div class="field"><label for="trafficScenario">Simulated traffic</label><select id="trafficScenario">${Object.entries(mapService.scenarios).map(([key, value]) => `<option value="${key}">${value.label}</option>`).join("")}</select></div>
      </div>
      <div class="map-layout" style="margin-top:12px">
        <section>
          <div id="rescueMap" class="map-container"></div>
          <div class="navigation-summary panel" id="navigationSummary"></div>
        </section>
        <aside class="panel route-panel"><div class="panel-header"><h2>Route & diversion</h2></div><div class="panel-body" id="rescueRoutePanel"></div></aside>
      </div>
    </section>
  `;
}

export function initRescue(app) {
  let destination = storageService.getHospitals()[0];
  let start = mapService.startingPoints[0];
  let routeResult = null;
  let timer = null;
  let navigationState = "idle";
  let stepIndex = 0;
  const map = document.querySelector("#rescueMap");
  const panel = document.querySelector("#rescueRoutePanel");
  const summary = document.querySelector("#navigationSummary");
  const storedTransport = storageService.getTransport();
  if (storedTransport?.hospitalId === destination.id) {
    navigationState = storedTransport.status === "Handed Over" ? "complete" : "paused";
  }

  function closestOpenHospital(excludedId) {
    const available = storageService.getHospitals().filter((hospital) => hospital.available > 0 && hospital.status !== "Full / Diverting" && hospital.id !== excludedId);
    available.sort((a, b) => mapService.route(start, a).primary.eta - mapService.route(start, b).primary.eta);
    return available[0] || null;
  }

  function setTransportStatus(status) {
    const previous = storageService.getTransport();
    storageService.setTransport({
      ...(previous || {}),
      hospitalId: destination.id,
      hospitalName: destination.name,
      status,
      updatedAt: new Date().toISOString()
    });
  }

  function routeActions() {
    const links = mapService.externalLink(destination, start);
    return `
      <div class="navigation-controls">
        <button type="button" class="primary-button" id="navigationToggle">${navigationState === "running" ? "Pause Navigation" : "Start Navigation"}</button>
        <button type="button" class="secondary-button" id="stepForward">Step Forward</button>
        <button type="button" class="secondary-button" id="resetRoute">Reset Route</button>
        <button type="button" class="secondary-button" id="googleLink">Google Maps</button>
        <button type="button" class="secondary-button" id="wazeLink">Waze</button>
      </div>`;
  }

  function renderPanel() {
    const facilities = storageService.getHospitals();
    const acceptingRoutes = facilities
      .filter((hospital) => hospital.available > 0 && hospital.status !== "Full / Diverting")
      .map((hospital) => ({ hospital, route: mapService.route(start, hospital).primary }))
      .sort((a, b) => a.route.eta - b.route.eta);
    const recommended = acceptingRoutes[0];
    const isFull = destination.available <= 0 || destination.status === "Full / Diverting";

    panel.innerHTML = `
      <div class="field"><label for="rescueDestination">Destination hospital</label>
        <select id="rescueDestination">${facilities.map((hospital) => `<option value="${hospital.id}" ${hospital.id === destination.id ? "selected" : ""}>${hospital.name} — ${hospital.available}/${hospital.total} beds · ${hospital.status}</option>`).join("")}</select>
      </div>
      ${isFull ? `<div class="diversion-warning"><strong>DIVERSION ALERT</strong><br>${destination.name} is Full / Diverting. ${recommended && recommended.hospital.id !== destination.id ? `Nearest accepting recommendation: <button type="button" class="link-button" id="chooseRecommendation">${recommended.hospital.name} (${recommended.route.eta} min)</button>` : "No accepting alternatives are currently available."}</div>` : ""}
      ${routeResult ? `
        <div class="route-option recommended-route">
          <div class="session-row"><strong>${routeResult.recommended ? "Primary recommended route" : "Route to selected facility (diverting)"}</strong><span class="status-badge ${routeResult.recommended ? "available" : "full"}">${routeResult.recommended ? "Accepting" : "Divert"}</span></div>
          <div class="grid-3">
            <div class="metric"><span>Road distance</span><strong>${routeResult.primary.distanceKm.toFixed(1)} km</strong></div>
            <div class="metric"><span>Estimated travel</span><strong>${routeResult.primary.eta} min</strong></div>
            <div class="metric"><span>Avg speed</span><strong>${routeResult.primary.speedKmh} km/h</strong></div>
          </div>
          <small>${routeResult.scenario.label} · roads scored by CareRoute</small>
        </div>
        <div class="route-option alternative-route">
          <div class="session-row"><strong>Alternative route</strong><span>${routeResult.alternative.distanceKm.toFixed(1)} km</span></div>
          <p>${routeResult.alternative.eta} min · ETA ${routeResult.alternative.eta - routeResult.primary.eta >= 0 ? "+" : ""}${routeResult.alternative.eta - routeResult.primary.eta} min vs primary · ${routeResult.scenario.label === "Clear Corridors" ? "Maysan Rd alternate corridor" : "Lower congestion via alternate corridor"}</p>
        </div>
        <div class="traffic-note">Waze does not offer a general public embedded routing API/SDK. Traffic scoring, rerouting and navigation cues are modeled by CareRoute.</div>
        <div class="current-instruction" id="currentInstruction"></div>
        <ol class="step-list directions-list" id="directionsList">${routeResult.primary.steps.map((step, index) => `
          <li class="${index === stepIndex ? "current-step" : ""}" data-direction-step="${index}">
            <span class="maneuver-icon" aria-hidden="true">${step.maneuver === "turn-left" ? "↰" : step.maneuver === "turn-right" ? "↱" : "↑"}</span>
            <span>${step.instruction}<small>${step.road} · ${step.distanceKm.toFixed(1)} km</small></span>
          </li>`).join("")}</ol>
        ${routeActions()}
      ` : '<p class="notice">Calculating route across Valenzuela corridors…</p>'}
    `;
    document.querySelector("#rescueDestination").addEventListener("change", (event) => {
      const selected = facilities.find((hospital) => hospital.id === event.target.value);
      if (!selected) return;
      destination = selected;
      stepIndex = 0;
      routeResult = null;
      renderRoute();
    });
    document.querySelector("#chooseRecommendation")?.addEventListener("click", () => {
      const pick = recommended?.hospital || closestOpenHospital(destination.id);
      if (pick) {
        destination = pick;
        routeResult = null;
        securityService.audit("DIVERSION_ACCEPTED", "rescue", `Selected ${pick.name}`);
        renderRoute();
      }
    });
    document.querySelector("#navigationToggle")?.addEventListener("click", toggleNavigation);
    document.querySelector("#stepForward")?.addEventListener("click", stepForward);
    document.querySelector("#resetRoute")?.addEventListener("click", resetNavigation);
    const links = mapService.externalLink(destination, start);
    document.querySelector("#googleLink")?.addEventListener("click", () => window.open(links.google, "_blank", "noopener"));
    document.querySelector("#wazeLink")?.addEventListener("click", () => window.open(links.waze, "_blank", "noopener"));
    renderNavigationSummary();
  }

  function renderNavigationSummary() {
    if (!routeResult) {
      summary.innerHTML = `<div class="panel-body">Choose a destination to preview a route and begin navigation.</div>`;
      return;
    }
    const progress = mapService.currentNavigation?.progress || 0;
    const currentStatus = navigationState === "complete" ? transportStatuses[3] :
      navigationState === "idle" ? transportStatuses[0] : progress >= .85 ? transportStatuses[2] : transportStatuses[1];
    const remainKm = Math.max(0, routeResult.primary.distanceKm * (1 - progress));
    const remainEta = Math.max(0, Math.ceil(routeResult.primary.eta * (1 - progress)));
    const currentStep = routeResult.primary.steps[Math.min(stepIndex, routeResult.primary.steps.length - 1)];
    summary.innerHTML = `
      <div class="panel-body">
        <div class="session-row"><div><strong>Navigation ${navigationState === "running" ? "in progress" : navigationState === "paused" ? "paused" : navigationState === "complete" ? "complete" : "ready"}</strong><small>${destination.name}</small></div><span class="status-badge ${currentStatus === "Handed Over" ? "available" : "moderate"}">${currentStatus}</span></div>
        <div class="grid-3" style="margin-top:10px">
          <div class="metric"><span>Remaining</span><strong>${remainKm.toFixed(1)} km</strong></div>
          <div class="metric"><span>ETA remaining</span><strong>${remainEta} min</strong></div>
          <div class="metric"><span>Progress</span><strong>${Math.round(progress * 100)}%</strong></div>
        </div>
        <div class="occupancy"><div class="occupancy-fill" style="width:${Math.round(progress * 100)}%"></div></div>
        <div class="current-instruction"><span class="maneuver-icon">↑</span><div><small>UP NEXT</small><strong>${currentStep?.instruction || "Arrived at facility"}</strong></div></div>
        <div class="transport-steps">${transportStatuses.map((status, index) => {
          const currentIndex = transportStatuses.indexOf(currentStatus);
          return `<div class="transport-step ${index <= currentIndex ? "active" : ""}">${status}</div>`;
        }).join("")}</div>
      </div>`;
  }

  async function renderRoute() {
    const wasRunning = navigationState === "running";
    pauseNavigation();
    let result = await mapService.calculateRoute(start, destination);
    if (wasRunning && (destination.available <= 0 || destination.status === "Full / Diverting")) {
      const alternate = closestOpenHospital(destination.id);
      if (alternate) {
        destination = alternate;
        app.toast(`Diversion alert: automatically rerouted to ${alternate.name}.`);
        securityService.audit("AUTOMATIC_REROUTE", "rescue", `Rerouted to ${alternate.name} after destination became unavailable`);
        result = await mapService.calculateRoute(start, destination);
      }
    }
    if (app.currentRole !== "rescue" || !map.isConnected) return;
    routeResult = result;
    if (!routeResult.primary.steps.length) {
      routeResult.primary.steps = [{ maneuver: "depart", instruction: "Proceed to the destination", road: "Local roads", distanceKm: routeResult.primary.distanceKm }];
    }
    stepIndex = Math.min(stepIndex, routeResult.primary.steps.length - 1);
    await mapService.render(map, { start, destination });
    renderPanel();
  }

  function syncProgress() {
    const progress = mapService.currentNavigation?.progress || 0;
    const stepsCount = Math.max(1, routeResult.primary.steps.length);
    stepIndex = Math.min(stepsCount - 1, Math.floor(progress * stepsCount));
    document.querySelectorAll("[data-direction-step]").forEach((item, index) => item.classList.toggle("current-step", index === stepIndex));
    const direction = routeResult.primary.steps[stepIndex];
    const instruction = document.querySelector("#currentInstruction");
    if (instruction) instruction.innerHTML = `<span class="maneuver-icon">↑</span><div><small>TURN-BY-TURN</small><strong>${direction.instruction}</strong><small>${direction.road} · ${direction.distanceKm.toFixed(1)} km</small></div>`;
    renderNavigationSummary();
    const status = progress >= 1 ? transportStatuses[3] : progress >= .85 ? transportStatuses[2] : progress > 0 ? transportStatuses[1] : transportStatuses[0];
    setTransportStatus(status);
    if (progress >= 1) {
      navigationState = "complete";
      pauseNavigation(false);
      securityService.audit("TRANSPORT_HANDOVER", "rescue", `${destination.name} reached`);
      renderPanel();
    }
  }

  function toggleNavigation() {
    if (!routeResult) return;
    if (navigationState === "running") {
      pauseNavigation();
      navigationState = "paused";
      setTransportStatus(transportStatuses[Math.min(3, Math.floor((mapService.currentNavigation.progress || 0) * 4))]);
      renderPanel();
      return;
    }
    navigationState = "running";
    if ((mapService.currentNavigation?.progress || 0) >= 1) mapService.updateProgress(0);
    setTransportStatus(transportStatuses[1]);
    securityService.audit("NAVIGATION_STARTED", "rescue", `${destination.name}, ${routeResult.primary.distanceKm} km`);
    const prior = mapService.currentNavigation?.progress || 0;
    const increment = 1 / 28;
    if (prior === 0) mapService.updateProgress(0.005);
    renderPanel();
    timer = setInterval(() => {
      const progress = Math.min(1, (mapService.currentNavigation?.progress || 0) + increment);
      mapService.updateProgress(progress);
      syncProgress();
    }, 1000);
  }

  function pauseNavigation(update = true) {
    if (timer) clearInterval(timer);
    timer = null;
    if (navigationState === "running" && update) navigationState = "paused";
  }

  function stepForward() {
    if (!routeResult) return;
    pauseNavigation();
    navigationState = "paused";
    const current = mapService.currentNavigation?.progress || 0;
    const next = Math.min(1, Math.max(current + .04, (stepIndex + 1) / Math.max(1, routeResult.primary.steps.length)));
    mapService.updateProgress(next);
    syncProgress();
    renderPanel();
  }

  function resetNavigation() {
    pauseNavigation(false);
    navigationState = "idle";
    stepIndex = 0;
    mapService.updateProgress(0);
    setTransportStatus(transportStatuses[0]);
    securityService.audit("NAVIGATION_RESET", "rescue", `Route reset for ${destination.name}`);
    renderPanel();
  }

  document.querySelector("#rescueStart").addEventListener("change", (event) => {
    start = mapService.startingPoints[safeNumber(event.target.value)];
    resetNavigation();
    renderRoute();
  });
  document.querySelector("#useGps").addEventListener("click", () => {
    if (!navigator.geolocation) return app.toast("GPS is unavailable in this browser.");
    navigator.geolocation.getCurrentPosition((position) => {
      const lat = safeNumber(position.coords.latitude, null);
      const lng = safeNumber(position.coords.longitude, null);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 14.63 || lat > 14.78 || lng < 120.92 || lng > 121.02) {
        app.toast("GPS unavailable in Valenzuela demo coverage. Using the selected starting point.");
        return;
      }
      start = { name: "Current GPS position", lat, lng };
      resetNavigation();
      app.toast("GPS location acquired.");
      renderRoute();
    }, () => app.toast("GPS permission denied or unavailable. Using the selected starting point."), { enableHighAccuracy: true, timeout: 10000 });
  });
  document.querySelector("#trafficToggle").addEventListener("click", (event) => {
    mapService.setTrafficEnabled(!mapService.trafficEnabled);
    event.currentTarget.textContent = `Traffic Layer: ${mapService.trafficEnabled ? "On" : "Off"}`;
    renderRoute();
  });
  document.querySelector("#trafficScenario").addEventListener("change", (event) => {
    mapService.setScenario(event.target.value);
    renderRoute();
  });
  document.querySelector("[data-open-advanced]").addEventListener("click", () => openAdvanced(app, destination));
  map.addEventListener("hospital:select", (event) => {
    const hospital = storageService.getHospitals().find((item) => item.id === event.detail.id);
    if (!hospital) return;
    destination = hospital;
    stepIndex = 0;
    renderRoute();
  });
  window.addEventListener("careroute:data", (event) => {
    if (app.currentRole !== "rescue" || !map.isConnected) return;
    if (event.detail.key !== storageService.keys.hospitals) return;
    const latest = storageService.getHospitals().find((hospital) => hospital.id === destination.id);
    if (!latest) return;
    destination = latest;
    renderRoute();
  });
  renderRoute();
}

function openAdvanced(app, hospital) {
  app.openModal(`
    <div class="modal-backdrop">
      <section class="panel" style="width:min(680px,94vw)">
        <div class="panel-header"><h2>Advanced Pre-Arrival Digital Triage</h2><button type="button" class="secondary-button" data-close-modal>Close</button></div>
        <form id="advancedTriageForm" class="panel-body">
          <div class="field-grid">
            <div class="field"><label>Chief complaint category</label><select name="complaint"><option>Chest pain</option><option>Breathing difficulty</option><option>Trauma / injury</option><option>Neurologic concern</option><option>Other urgent concern</option></select></div>
            <div class="field"><label>BP (systolic/diastolic)</label><input name="bp" pattern="[0-9]{2,3}/[0-9]{2,3}" placeholder="120/80" required></div>
            <div class="field"><label>Heart rate</label><input name="hr" type="number" min="20" max="240" required></div>
            <div class="field"><label>SpO2 (%)</label><input name="spo2" type="number" min="50" max="100" required></div>
            <div class="field"><label>GCS / consciousness</label><select name="gcs"><option>Alert</option><option>Voice</option><option>Pain</option><option>Unresponsive</option></select></div>
            <div class="field"><label>Trauma / condition</label><select name="condition"><option>Medical</option><option>Trauma</option><option>Cardiac</option><option>Obstetric</option><option>Pediatric</option></select></div>
            <div class="field full"><label>Target ETA (minutes)</label><input name="eta" type="number" min="1" max="180" value="15" required></div>
          </div>
          <p class="notice" style="margin:12px 0">Core triage data only. Do not enter names, government IDs, addresses, or raw narrative notes.</p>
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
      complaint: data.complaint,
      bp: data.bp,
      hr: safeNumber(data.hr),
      spo2: safeNumber(data.spo2),
      gcs: data.gcs,
      condition: data.condition,
      eta: safeNumber(data.eta),
      severity: safeNumber(data.spo2) < 90 || data.gcs !== "Alert" ? "High" : "Moderate",
      status: "En Route",
      createdAt: new Date().toISOString()
    };
    storageService.addTriage(entry);
    securityService.audit("ADVANCED_TRIAGE_SUBMITTED", "rescue", `${entry.id} sent to ${hospital.name}`);
    app.closeModal();
    app.toast(`${entry.id} submitted to ${hospital.name}.`);
  });
}
