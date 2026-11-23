import { icon } from "../../assets/icons.js";
import { mapService } from "../services/mapService.js";
import { storageService } from "../services/storageService.js";
import { securityService } from "../services/securityService.js";

const COMPLAINTS = ["Chest pain", "Breathing difficulty", "Trauma / injury", "Fever / infection", "Neurologic concern", "Pregnancy / maternity", "Other"];

function complaintSpecialty(complaint, age) {
  if (complaint === "Chest pain") return "Cardiology";
  if (complaint === "Breathing difficulty") return "Emergency";
  if (complaint === "Trauma / injury") return "Trauma";
  if (complaint === "Fever / infection") return Number(age) < 18 ? "Pediatrics" : "General Medicine";
  if (complaint === "Neurologic concern") return "Neurology";
  if (complaint === "Pregnancy / maternity") return "OB-GYN";
  return "";
}

export function renderPatient() {
  const hospitals = storageService.getHospitals();
  const specialties = [...new Set(hospitals.flatMap((hospital) => hospital.specialties || []))].sort();
  return `
    <section class="page" data-role-page="patient">
      <div class="page-header">
        <div><h1>Public Capacity Search</h1><p>Compare listed Valenzuela facilities and prepare a privacy-minimized pre-arrival record.</p></div>
        <button type="button" class="secondary-button" data-open-triage>${icon("shield", 16)} Basic patient triage</button>
      </div>
      <div class="filter-bar" aria-label="Facility filters">
        <input id="patientSearch" type="search" placeholder="Search facility, address, or specialty" aria-label="Search facilities">
        <select id="patientCategory" aria-label="Filter by category"><option value="">All categories</option><option>Hospital</option><option>Clinic / Lying-in</option><option>Health Center</option></select>
        <select id="patientSpecialty" aria-label="Filter by specialty"><option value="">All specialties</option>${specialties.map((specialty) => `<option>${securityService.sanitize(specialty)}</option>`).join("")}</select>
        <select id="patientStatus" aria-label="Filter by availability"><option value="">All availability</option><option>Available</option><option>Moderate</option><option>Full / Diverting</option></select>
        <select id="patientSort" aria-label="Sort facilities"><option value="recommended">Recommended</option><option value="closest">Closest · fastest ETA</option><option value="least-occupied">Least occupied</option></select>
      </div>
      <div class="toolbar map-workflow-bar">
        <label class="inline-field">Starting point
          <select id="patientStart"><option value="gps">My Current GPS Location</option>${mapService.startingPoints.map((point, index) => `<option value="${index}">${securityService.sanitize(point.name)}</option>`).join("")}</select>
        </label>
        <span class="traffic-note">Route services receive coordinates only. Do not enter identifying patient details in notes.</span>
      </div>
      <div class="map-layout">
        <div>
          <div id="patientMap" class="map-container"></div>
          <div class="navigation-summary panel" id="patientRoutePreview"></div>
        </div>
        <aside class="panel route-panel">
          <div class="panel-header"><h2>Facilities</h2><span id="patientCount" class="status-badge available">0 results</span></div>
          <div id="patientHospitalList" class="panel-body hospital-list"></div>
        </aside>
      </div>
    </section>
  `;
}

export function initPatient(app) {
  let hospitals = storageService.getHospitals();
  let selected = hospitals[0];
  let start = mapService.startingPoints[0];
  let activeTriage = null;
  let routeRequest = 0;
  const list = document.querySelector("#patientHospitalList");
  const map = document.querySelector("#patientMap");
  const routePreview = document.querySelector("#patientRoutePreview");
  document.querySelector("#patientStart").value = "0";

  function getRoute(hospital) {
    return mapService.route(start, hospital).primary;
  }

  function availabilityStatus(hospital) {
    if (hospital.available <= 0) return "Full / Diverting";
    return hospital.status;
  }

  function hospitalCard(hospital) {
    const fill = hospital.total ? Math.round((hospital.available / hospital.total) * 100) : 0;
    const status = availabilityStatus(hospital);
    const statusClass = status === "Available" ? "available" : status === "Moderate" ? "moderate" : "full";
    const route = getRoute(hospital);
    const matched = activeTriage && activeTriage.specialty &&
      hospital.specialties.includes(activeTriage.specialty) &&
      hospital.specialtyAvailability?.[activeTriage.specialty] !== false &&
      hospital.available > 0;
    return `
      <article class="hospital-card ${selected?.id === hospital.id ? "selected" : ""} ${matched ? "triage-match" : ""}" data-hospital-id="${securityService.sanitize(hospital.id)}">
        <div class="hospital-title"><div><h3>${securityService.sanitize(hospital.name)}</h3><div class="hospital-address">${securityService.sanitize(hospital.address)}</div></div><span class="status-badge ${statusClass}">${status}</span></div>
        ${matched ? '<span class="match-label">Matches triage specialty · accepting beds listed</span>' : ""}
        <div class="capacity-row"><strong>${hospital.available}/${hospital.total}</strong><span>${fill}% available · ${route.distanceKm.toFixed(1)} km · ${route.eta} min</span></div>
        <div class="occupancy"><div class="occupancy-fill ${statusClass}" style="width:${fill}%"></div></div>
        <small>${(hospital.specialties || []).map((item) => `${securityService.sanitize(item)}${hospital.specialtyAvailability?.[item] === false ? " · unavailable" : ""}`).join(" · ")}</small>
      </article>`;
  }

  function renderList() {
    hospitals = storageService.getHospitals();
    const search = document.querySelector("#patientSearch").value.trim().toLowerCase();
    const category = document.querySelector("#patientCategory").value;
    const status = document.querySelector("#patientStatus").value;
    const specialty = document.querySelector("#patientSpecialty").value;
    const sort = document.querySelector("#patientSort").value;
    const results = hospitals.filter((hospital) =>
      (!search || `${hospital.name} ${hospital.address} ${(hospital.specialties || []).join(" ")}`.toLowerCase().includes(search)) &&
      (!category || hospital.category === category) &&
      (!status || availabilityStatus(hospital) === status) &&
      (!specialty || ((hospital.specialties || []).includes(specialty) && hospital.specialtyAvailability?.[specialty] !== false))
    );
    const eta = (hospital) => getRoute(hospital).eta;
    if (sort === "closest") {
      results.sort((a, b) => eta(a) - eta(b) || getRoute(a).distanceKm - getRoute(b).distanceKm);
    } else if (sort === "least-occupied") {
      results.sort((a, b) => (b.available / Math.max(1, b.total)) - (a.available / Math.max(1, a.total)) || b.available - a.available);
    } else {
      const score = (hospital) => {
        const availability = hospital.available / Math.max(1, hospital.total);
        const freeBedScore = Math.min(1, hospital.available / 10);
        const etaScore = 1 / (1 + eta(hospital));
        const erWeight = hospital.category === "Hospital" ? 1 : 0.25;
        const triageMatch = activeTriage?.specialty && hospital.specialties.includes(activeTriage.specialty) ? 0.3 : 0;
        const open = hospital.available > 0 && availabilityStatus(hospital) !== "Full / Diverting";
        const bedAndRouteScore = availability * 0.4 + freeBedScore * 0.35 + etaScore * 0.25;
        return (open ? bedAndRouteScore * erWeight + etaScore * 0.15 * (1 - erWeight) : -1) + triageMatch;
      };
      results.sort((a, b) => score(b) - score(a));
    }
    list.innerHTML = results.map(hospitalCard).join("") || '<p>No facilities match the selected filters.</p>';
    document.querySelector("#patientCount").textContent = `${results.length} results`;
  }

  async function updateRoute() {
    const request = ++routeRequest;
    const route = await mapService.calculateRoute(start, selected);
    if (request !== routeRequest || !map.isConnected) return;
    await mapService.render(map, { start, destination: selected });
    if (request !== routeRequest) return;
    const diversion = selected.available <= 0 || selected.status === "Full / Diverting";
    const closest = storageService.getHospitals().filter((hospital) => hospital.available > 0 && hospital.id !== selected.id)
      .sort((a, b) => getRoute(a).eta - getRoute(b).eta)[0];
    routePreview.innerHTML = `
      <div class="panel-body">
        ${diversion ? `<div class="diversion-warning"><strong>Facility is Full / Diverting.</strong> ${closest ? `Nearest accepting alternative: ${securityService.sanitize(closest.name)} (${getRoute(closest).eta} min).` : "No accepting alternatives are listed."}</div>` : ""}
        <div class="session-row"><div><strong>Route to ${securityService.sanitize(selected.name)}</strong><small>${route.source === "OSRM" ? "OSRM street route" : "Offline Valenzuela road-grid estimate"}</small></div><span class="status-badge ${route.trafficMode === "live" ? "available" : "moderate"}">${route.trafficMode === "live" ? "Live Traffic Active" : "Offline Estimate"}</span></div>
        <div class="grid-2 route-metrics" style="margin-top:8px"><div class="metric"><span>Distance</span><strong>${route.primary.distanceKm.toFixed(1)} km</strong></div><div class="metric"><span>ETA</span><strong>${route.primary.eta} min</strong></div></div>
        <small class="traffic-note">${route.trafficMode === "live" ? "Traffic category estimated from current OSRM route duration; OSRM does not provide verified incidents." : "Traffic and route are estimates; offline mode uses time-of-day corridor telemetry."}</small>
        <ol class="step-list">${route.primary.steps.slice(0, 3).map((step) => `<li>${securityService.sanitize(step.instruction)} · ${step.distanceKm.toFixed(1)} km</li>`).join("")}</ol>
      </div>`;
  }

  function selectStart(index) {
    start = mapService.startingPoints[index];
    renderList();
    updateRoute();
  }

  function useGps() {
    if (!navigator.geolocation) {
      app.toast("Location services are unavailable. Choose a Valenzuela landmark instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition((position) => {
      start = { name: "My Current GPS Location", lat: position.coords.latitude, lng: position.coords.longitude };
      document.querySelector("#patientStart").value = "gps";
      renderList();
      updateRoute();
      app.toast("Current location acquired.");
    }, () => {
      const landmarkIndex = mapService.startingPoints.indexOf(start);
      document.querySelector("#patientStart").value = String(landmarkIndex >= 0 ? landmarkIndex : 0);
      app.toast("Location permission denied or unavailable. Choose a Valenzuela landmark instead.");
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
  }

  updateRoute();
  renderList();
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((position) => {
      start = { name: "My Current GPS Location", lat: position.coords.latitude, lng: position.coords.longitude };
      document.querySelector("#patientStart").value = "gps";
      renderList();
      updateRoute();
    }, undefined, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
  }

  ["patientSearch", "patientCategory", "patientStatus", "patientSpecialty", "patientSort"].forEach((id) =>
    document.querySelector(`#${id}`).addEventListener("input", renderList));
  document.querySelector("#patientStart").addEventListener("change", (event) => {
    if (event.target.value === "gps") useGps();
    else selectStart(Number(event.target.value));
  });
  list.addEventListener("click", (event) => {
    const card = event.target.closest("[data-hospital-id]");
    if (!card) return;
    selected = storageService.getHospitals().find((hospital) => hospital.id === card.dataset.hospitalId);
    renderList();
    updateRoute();
  });
  map.addEventListener("hospital:select", (event) => {
    selected = storageService.getHospitals().find((hospital) => hospital.id === event.detail.id) || event.detail;
    renderList();
    updateRoute();
  });
  window.addEventListener("careroute:data", (event) => {
    if (app.currentRole !== "patient" || !map.isConnected || event.detail.key !== storageService.keys.hospitals) return;
    hospitals = storageService.getHospitals();
    selected = hospitals.find((hospital) => hospital.id === selected.id) || hospitals[0];
    renderList();
    updateRoute();
  });
  document.querySelector("[data-open-triage]").addEventListener("click", () => openBasicTriage(app, selected, (triage) => {
    activeTriage = triage;
    renderList();
  }));
}

function openBasicTriage(app, hospital, onTriage) {
  app.openModal(`
    <div class="modal-backdrop">
      <section class="panel triage-modal">
        <div class="panel-header"><h2>Basic Patient Triage</h2><button type="button" class="secondary-button" data-close-modal>Close</button></div>
        <form id="basicTriageForm" class="panel-body">
          <div class="field-grid">
            <div class="field"><label>Age (years)</label><input name="age" type="number" min="0" max="120" required></div>
            <div class="field"><label>Sex</label><select name="sex"><option>Prefer not to state</option><option>Female</option><option>Male</option><option>Other</option></select></div>
            <div class="field"><label>Weight (kg)</label><input name="weight" type="number" min="0.5" max="400" step="0.1"></div>
            <div class="field"><label>Height (cm)</label><input name="height" type="number" min="30" max="250" step="0.1"><small id="bmiValue">BMI not calculated</small></div>
            <div class="field full"><label>Chief complaint</label><select name="complaint">${COMPLAINTS.map((item) => `<option>${item}</option>`).join("")}</select></div>
            <div class="field"><label>Pain scale (1–10)</label><input name="pain" type="number" min="1" max="10" value="1"></div>
            <div class="field"><label>Consciousness (AVPU)</label><select name="avpu"><option>Alert</option><option>Voice</option><option>Pain</option><option>Unresponsive</option></select></div>
            <div class="field full"><label>Chief complaint notes (do not include name, ID, or address)</label><textarea name="notes" rows="3" maxlength="500" placeholder="Brief symptoms or relevant details"></textarea></div>
            <div class="field full"><label>Target facility</label><input value="${securityService.sanitize(hospital.name)}" readonly></div>
          </div>
          <p class="notice" style="margin:12px 0">This prototype does not provide medical advice or clinical triage decisions. For emergencies, contact local emergency services.</p>
          <button class="primary-button" type="submit">Send pre-arrival packet</button>
        </form>
      </section>
    </div>
  `);
  const form = document.querySelector("#basicTriageForm");
  const updateBmi = () => {
    const data = new FormData(form);
    const weight = Number(data.get("weight"));
    const height = Number(data.get("height")) / 100;
    document.querySelector("#bmiValue").textContent = weight > 0 && height > 0 ? `BMI ${ (weight / (height * height)).toFixed(1) }` : "BMI not calculated";
  };
  form.elements.weight.addEventListener("input", updateBmi);
  form.elements.height.addEventListener("input", updateBmi);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const specialty = complaintSpecialty(data.complaint, data.age);
    const entry = {
      id: securityService.transactionNumber(),
      source: "Patient",
      hospitalId: hospital.id,
      hospitalName: hospital.name,
      age: Number(data.age),
      sex: data.sex,
      weightKg: data.weight ? Number(data.weight) : null,
      heightCm: data.height ? Number(data.height) : null,
      bmi: data.weight && data.height ? Number((Number(data.weight) / ((Number(data.height) / 100) ** 2)).toFixed(1)) : null,
      complaint: data.complaint,
      specialty,
      notes: data.notes.trim(),
      pain: Number(data.pain),
      avpu: data.avpu,
      severity: data.avpu === "Unresponsive" ? "High" : data.pain >= 8 ? "High" : data.pain >= 5 ? "Moderate" : "Low",
      eta: null,
      status: "Awaiting Bed",
      createdAt: new Date().toISOString()
    };
    if (!storageService.addTriage(entry)) {
      app.toast("Unable to save this packet in local storage. Please check browser storage availability.");
      return;
    }
    onTriage({ specialty });
    securityService.audit("TRIAGE_SUBMITTED", "patient", `${entry.id} submitted for ${hospital.name}`);
    app.closeModal();
    app.toast(`${entry.id} sent to ${hospital.name}.`);
  });
}
