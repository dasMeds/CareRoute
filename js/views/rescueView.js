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
        <div class="field"><label for="rescueStart">Starting location</label><select id="rescueStart"><option value="gps">My Current GPS Location</option>${mapService.startingPoints.map((point, index) => `<option value="${index}">${point.name}</option>`).join("")}</select></div>
        <button type="button" id="useGps" class="secondary-button">${icon("map", 16)} Use GPS</button>
        <button type="button" id="trafficToggle" class="secondary-button">Traffic Overlay: On</button>
        <span id="trafficStatus" class="status-badge moderate">Offline Estimate</span>
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
  let activeTriageId = null;
  let lastTransportWriteAt = 0;
  let routeRequest = 0;
  const map = document.querySelector("#rescueMap");
  const panel = document.querySelector("#rescueRoutePanel");
  const summary = document.querySelector("#navigationSummary");
  document.querySelector("#rescueStart").value = "0";
  const storedTransport = storageService.getTransport();
  if (storedTransport?.hospitalId === destination.id) {
    navigationState = storedTransport.status === "Handed Over" ? "complete" : "paused";
  }

  function closestOpenHospital(excludedId) {
    const available = storageService.getHospitals().filter((hospital) => hospital.available > 0 && hospital.status !== "Full / Diverting" && hospital.id !== excludedId);
    available.sort((a, b) => mapService.route(start, a).primary.eta - mapService.route(start, b).primary.eta);
    return available[0] || null;
  }

  function setTransportStatus(status, force = false) {
    if (!force && status === "En Route" && Date.now() - lastTransportWriteAt < 10000) return;
    const previous = storageService.getTransport();
    const progress = mapService.currentNavigation?.progress || 0;
    const saved = storageService.set(storageService.keys.transport, {
      ...(previous || {}),
      hospitalId: destination.id,
      hospitalName: destination.name,
      triageId: activeTriageId || (previous?.hospitalId === destination.id ? previous.triageId : null),
      status,
      etaRemaining: routeResult ? Math.max(0, Math.ceil(routeResult.primary.eta * (1 - progress))) : null,
      updatedAt: new Date().toISOString()
    });
    if (saved) lastTransportWriteAt = Date.now();
  }

  function routeActions() {
    return `
      <div class="navigation-controls">
        <button type="button" class="primary-button" id="navigationToggle">${navigationState === "running" ? "Pause Navigation" : "Start Navigation"}</button>
        <button type="button" class="secondary-button" id="stepForward">Step Forward</button>
        <button type="button" class="secondary-button" id="resetRoute">Reset Route</button>
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
            <div class="metric"><span>Distance</span><strong>${routeResult.primary.distanceKm.toFixed(1)} km</strong></div>
            <div class="metric"><span>ETA</span><strong>${routeResult.primary.eta} min</strong></div>
          </div>
          <small>${routeResult.source === "OSRM" ? "OSRM street-following route duration estimate" : "Offline Valenzuela road-grid estimate"} · ${routeResult.scenario.label}</small>
        </div>
        ${routeResult.alternative ? `<div class="route-option alternative-route">
          <div class="session-row"><strong>Alternative route</strong><span>${routeResult.alternative.distanceKm.toFixed(1)} km</span></div>
          <p>${routeResult.alternative.eta} min · ETA ${routeResult.alternative.eta - routeResult.primary.eta >= 0 ? "+" : ""}${routeResult.alternative.eta - routeResult.primary.eta} min vs primary · ${securityService.sanitize(routeResult.alternative.label || "Alternative corridor")}</p>
        </div>` : ""}
        <div class="traffic-note">${routeResult.source === "OSRM" ? "Traffic category uses returned OSRM route duration; the public OSRM service does not provide verified incidents. Only coordinates are sent." : "Offline traffic is estimated from time of day and local corridor telemetry."}</div>
        <div class="current-instruction" id="currentInstruction"></div>
        <ol class="step-list directions-list" id="directionsList">${routeResult.primary.steps.map((step, index) => `
          <li class="${index === stepIndex ? "current-step" : ""}" data-direction-step="${index}">
            <span class="maneuver-icon" aria-hidden="true">${step.maneuver.includes("left") ? "↰" : step.maneuver.includes("right") ? "↱" : "↑"}</span>
            <span>${securityService.sanitize(step.instruction)}<small>${securityService.sanitize(step.road)} · ${step.distanceKm.toFixed(1)} km</small></span>
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
    const request = ++routeRequest;
    const wasRunning = navigationState === "running";
    pauseNavigation();
    let result = await mapService.calculateRoute(start, destination);
    if (request !== routeRequest) return;
    if (wasRunning && (destination.available <= 0 || destination.status === "Full / Diverting")) {
      const alternate = closestOpenHospital(destination.id);
      if (alternate) {
        destination = alternate;
        app.toast(`Diversion alert: automatically rerouted to ${alternate.name}.`);
        securityService.audit("AUTOMATIC_REROUTE", "rescue", `Rerouted to ${alternate.name} after destination became unavailable`);
        result = await mapService.calculateRoute(start, destination);
        if (request !== routeRequest) return;
      }
    }
    if (request !== routeRequest || app.currentRole !== "rescue" || !map.isConnected) return;
    routeResult = result;
    if (!routeResult.primary.steps.length) {
      routeResult.primary.steps = [{ maneuver: "depart", instruction: "Proceed to the destination", road: "Local roads", distanceKm: routeResult.primary.distanceKm }];
    }
    stepIndex = Math.min(stepIndex, routeResult.primary.steps.length - 1);
    await mapService.render(map, { start, destination });
    if (request !== routeRequest) return;
    const trafficStatus = document.querySelector("#trafficStatus");
    if (trafficStatus) {
      trafficStatus.textContent = routeResult.trafficMode === "live" ? "Live Traffic Active" : "Offline Estimate";
      trafficStatus.className = `status-badge ${routeResult.trafficMode === "live" ? "available" : "moderate"}`;
    }
    renderPanel();
  }

  function syncProgress() {
    const progress = mapService.currentNavigation?.progress || 0;
    const stepsCount = Math.max(1, routeResult.primary.steps.length);
    stepIndex = Math.min(stepsCount - 1, Math.floor(progress * stepsCount));
    document.querySelectorAll("[data-direction-step]").forEach((item, index) => item.classList.toggle("current-step", index === stepIndex));
    const direction = routeResult.primary.steps[stepIndex];
    const instruction = document.querySelector("#currentInstruction");
    if (instruction) instruction.innerHTML = `<span class="maneuver-icon">${direction.maneuver.includes("left") ? "↰" : direction.maneuver.includes("right") ? "↱" : "↑"}</span><div><small>TURN-BY-TURN</small><strong>${securityService.sanitize(direction.instruction)}</strong><small>${securityService.sanitize(direction.road)} · ${direction.distanceKm.toFixed(1)} km</small></div>`;
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

  function acquireGps() {
    if (!navigator.geolocation) return app.toast("GPS is unavailable in this browser. Choose a Valenzuela landmark.");
    navigator.geolocation.getCurrentPosition((position) => {
      start = { name: "My Current GPS Location", lat: safeNumber(position.coords.latitude, NaN), lng: safeNumber(position.coords.longitude, NaN) };
      if (!Number.isFinite(start.lat) || !Number.isFinite(start.lng)) return app.toast("GPS returned invalid coordinates.");
      document.querySelector("#rescueStart").value = "gps";
      resetNavigation();
      app.toast("GPS location acquired.");
      renderRoute();
    }, () => {
      const landmarkIndex = mapService.startingPoints.indexOf(start);
      document.querySelector("#rescueStart").value = String(landmarkIndex >= 0 ? landmarkIndex : 0);
      app.toast("GPS permission denied or unavailable. Using the selected Valenzuela landmark.");
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
  }
  document.querySelector("#rescueStart").addEventListener("change", (event) => {
    if (event.target.value === "gps") return acquireGps();
    start = mapService.startingPoints[safeNumber(event.target.value)];
    resetNavigation();
    renderRoute();
  });
  document.querySelector("#useGps").addEventListener("click", acquireGps);
  document.querySelector("#trafficToggle").addEventListener("click", (event) => {
    mapService.setTrafficEnabled(!mapService.trafficEnabled);
    event.currentTarget.textContent = `Traffic Overlay: ${mapService.trafficEnabled ? "On" : "Off"}`;
    renderRoute();
  });
  document.querySelector("[data-open-advanced]").addEventListener("click", () =>
    openAdvanced(app, destination, routeResult?.primary.eta, (entry) => {
      activeTriageId = entry.id;
      setTransportStatus("En Route", true);
    }));
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
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((position) => {
      start = { name: "My Current GPS Location", lat: position.coords.latitude, lng: position.coords.longitude };
      document.querySelector("#rescueStart").value = "gps";
      renderRoute();
    }, () => {
      document.querySelector("#rescueStart").value = "0";
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
  }
}

function openAdvanced(app, hospital, routeEta, onSubmitted) {
  app.openModal(`
    <div class="modal-backdrop">
      <section class="panel triage-modal">
        <div class="panel-header"><h2>Advanced Pre-Arrival Digital Triage</h2><button type="button" class="secondary-button" data-close-modal>Close</button></div>
        <form id="advancedTriageForm" class="panel-body">
          <div class="field-grid">
            <div class="field"><label>Age (years)</label><input name="age" type="number" min="0" max="120" required></div>
            <div class="field"><label>Sex</label><select name="sex"><option>Prefer not to state</option><option>Female</option><option>Male</option><option>Other</option></select></div>
            <div class="field"><label>Weight (kg)</label><input name="weight" type="number" min="0.5" max="400" step="0.1"></div>
            <div class="field"><label>Height (cm)</label><input name="height" type="number" min="30" max="250" step="0.1"></div>
            <div class="field full"><label>Chief complaint</label><select name="complaint"><option>Chest pain</option><option>Breathing difficulty</option><option>Trauma / injury</option><option>Fever / infection</option><option>Neurologic concern</option><option>Pregnancy / maternity</option><option>Other</option></select></div>
            <div class="field"><label>Pain scale (1–10)</label><input name="pain" type="number" min="1" max="10" value="1"></div>
            <div class="field"><label>Consciousness (AVPU)</label><select name="avpu"><option>Alert</option><option>Voice</option><option>Pain</option><option>Unresponsive</option></select></div>
            <div class="field"><label>Blood pressure (mmHg)</label><input name="bp" pattern="[0-9]{2,3}/[0-9]{2,3}" placeholder="120/80" required></div>
            <div class="field"><label>Heart rate (bpm)</label><input name="hr" type="number" min="20" max="240" required></div>
            <div class="field"><label>Respiratory rate (/min)</label><input name="rr" type="number" min="1" max="80" required></div>
            <div class="field"><label>SpO₂ (%)</label><input name="spo2" type="number" min="50" max="100" required></div>
            <div class="field"><label>Temperature (°C)</label><input name="temperature" type="number" min="25" max="45" step="0.1" required></div>
            <div class="field"><label>Glasgow Coma Scale (3–15)</label><input name="gcs" type="number" min="3" max="15" required></div>
            <div class="field"><label>ESI / acuity level</label><select name="esi"><option value="1">Level 1 · Resuscitation</option><option value="2">Level 2 · Emergent</option><option value="3" selected>Level 3 · Urgent</option><option value="4">Level 4 · Less urgent</option><option value="5">Level 5 · Non-urgent</option></select></div>
            <div class="field full"><label>Pre-hospital interventions</label><textarea name="interventions" maxlength="500" rows="2" placeholder="Interventions performed"></textarea></div>
            <div class="field full"><label>Clinical handoff notes (no name, ID, or address)</label><textarea name="notes" maxlength="1000" rows="3" placeholder="Relevant clinical handoff details"></textarea></div>
            <div class="field full"><label>Target facility</label><input value="${securityService.sanitize(hospital.name)}" readonly></div>
          </div>
          <p class="notice" style="margin:12px 0">This prototype stores handoff data in this browser's local storage. Do not include patient identifiers. ESI and vitals are recorded as supplied; no clinical scoring or advice is provided.</p>
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
      age: safeNumber(data.age),
      sex: data.sex,
      weightKg: data.weight ? safeNumber(data.weight) : null,
      heightCm: data.height ? safeNumber(data.height) : null,
      complaint: data.complaint,
      pain: safeNumber(data.pain),
      avpu: data.avpu,
      bp: data.bp,
      hr: safeNumber(data.hr),
      rr: safeNumber(data.rr),
      spo2: safeNumber(data.spo2),
      temperatureC: safeNumber(data.temperature),
      gcs: safeNumber(data.gcs),
      esi: safeNumber(data.esi),
      preHospitalInterventions: data.interventions.trim(),
      notes: data.notes.trim(),
      eta: safeNumber(routeEta),
      severity: `ESI ${data.esi}`,
      status: "En Route",
      createdAt: new Date().toISOString()
    };
    if (!storageService.addTriage(entry)) {
      app.toast("Unable to save the triage packet in local storage.");
      return;
    }
    onSubmitted?.(entry);
    securityService.audit("ADVANCED_TRIAGE_SUBMITTED", "rescue", `${entry.id} sent to ${hospital.name}`);
    app.closeModal();
    app.toast(`${entry.id} submitted to ${hospital.name}.`);
  });
}
