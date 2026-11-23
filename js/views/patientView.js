import { icon } from "../../assets/icons.js";
import { mapService } from "../services/mapService.js";
import { storageService } from "../services/storageService.js";
import { securityService } from "../services/securityService.js";

export function renderPatient() {
  return `
    <section class="page" data-role-page="patient">
      <div class="page-header">
        <div><h1>Public Capacity Search</h1><p>Find an accepting facility and prepare a minimized pre-arrival record.</p></div>
        <button type="button" class="secondary-button" data-open-triage>${icon("shield", 16)} Basic self-triage</button>
      </div>
      <div class="filter-bar">
        <input id="patientSearch" type="search" placeholder="Search hospital or specialty">
        <select id="patientStatus"><option value="all">All statuses</option><option value="accepting">Accepting only</option></select>
        <select id="patientSpecialty"><option value="">All specialties</option><option>Trauma</option><option>Cardiology</option><option>Pediatrics</option><option>Neurology</option><option>OB-GYN</option><option>General Surgery</option></select>
      </div>
      <div class="map-layout">
        <div id="patientMap" class="map-container"></div>
        <aside class="panel route-panel">
          <div class="panel-header"><h2>Facilities</h2><span id="patientCount" class="status-badge available">0 results</span></div>
          <div id="patientHospitalList" class="panel-body hospital-list"></div>
        </aside>
      </div>
    </section>
  `;
}

export function initPatient(app) {
  let selected = storageService.getHospitals()[0];
  const list = document.querySelector("#patientHospitalList");
  const map = document.querySelector("#patientMap");

  function hospitalCard(hospital) {
    const fill = hospital.total ? Math.round((hospital.available / hospital.total) * 100) : 0;
    const statusClass = hospital.status === "Available" ? "available" : hospital.status === "Moderate" ? "moderate" : "full";
    return `
      <article class="hospital-card ${selected?.id === hospital.id ? "selected" : ""}" data-hospital-id="${hospital.id}">
        <div class="hospital-title"><div><h3>${securityService.sanitize(hospital.name)}</h3><div class="hospital-address">${securityService.sanitize(hospital.address)}</div></div><span class="status-badge ${statusClass}">${hospital.status}</span></div>
        <div class="capacity-row"><strong>${hospital.available}/${hospital.total}</strong><span>${fill}% available</span></div>
        <div class="occupancy"><div class="occupancy-fill ${statusClass}" style="width:${fill}%"></div></div>
        <small>${hospital.specialties.join(" · ")}</small>
      </article>`;
  }

  function renderList() {
    const search = document.querySelector("#patientSearch").value.trim().toLowerCase();
    const status = document.querySelector("#patientStatus").value;
    const specialty = document.querySelector("#patientSpecialty").value;
    const hospitals = storageService.getHospitals().filter((hospital) =>
      (!search || `${hospital.name} ${hospital.address} ${hospital.specialties.join(" ")}`.toLowerCase().includes(search.toLowerCase())) &&
      (status !== "accepting" || hospital.status === "Available") &&
      (!specialty || hospital.specialties.includes(specialty))
    );
    list.innerHTML = hospitals.map(hospitalCard).join("") || '<p>No facilities match the selected filters.</p>';
    document.querySelector("#patientCount").textContent = `${hospitals.length} results`;
  }

  mapService.render(map, { destination: selected });
  renderList();
  ["patientSearch", "patientStatus", "patientSpecialty"].forEach((id) => document.querySelector(`#${id}`).addEventListener("input", renderList));
  list.addEventListener("click", (event) => {
    const card = event.target.closest("[data-hospital-id]");
    if (!card) return;
    selected = storageService.getHospitals().find((h) => h.id === card.dataset.hospitalId);
    renderList();
    mapService.render(map, { destination: selected });
  });
  map.addEventListener("hospital:select", (event) => {
    selected = event.detail;
    renderList();
  });
  document.querySelector("[data-open-triage]").addEventListener("click", () => openBasicTriage(app, selected));
}

function openBasicTriage(app, hospital) {
  app.openModal(`
    <div class="modal-backdrop">
      <section class="panel" style="width:min(580px,94vw)">
        <div class="panel-header"><h2>Basic Pre-Arrival Self-Triage</h2><button type="button" class="secondary-button" data-close-modal>Close</button></div>
        <form id="basicTriageForm" class="panel-body">
          <div class="field-grid">
            <div class="field"><label>Age bracket</label><select name="age"><option>Under 18</option><option>18-39</option><option>40-59</option><option>60+</option></select></div>
            <div class="field"><label>Sex</label><select name="sex"><option>Prefer not to state</option><option>Female</option><option>Male</option><option>Other</option></select></div>
            <div class="field full"><label>Chief complaint category</label><select name="complaint"><option>Chest pain</option><option>Breathing difficulty</option><option>Trauma / injury</option><option>Fever / infection</option><option>Neurologic concern</option><option>Other urgent concern</option></select></div>
            <div class="field"><label>Severity</label><select name="severity"><option>Low</option><option>Moderate</option><option>High</option></select></div>
            <div class="field"><label>Target facility</label><input value="${hospital.name}" readonly></div>
          </div>
          <p class="notice" style="margin:12px 0">Do not enter names, IDs, addresses, or free-text clinical narratives.</p>
          <button class="primary-button" type="submit">Generate transaction number</button>
        </form>
      </section>
    </div>
  `);
  document.querySelector("#basicTriageForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const entry = {
      id: securityService.transactionNumber(),
      source: "Patient",
      hospitalId: hospital.id,
      hospitalName: hospital.name,
      age: data.age,
      sex: data.sex,
      complaint: data.complaint,
      severity: data.severity,
      status: "Awaiting Bed",
      createdAt: new Date().toISOString()
    };
    storageService.addTriage(entry);
    securityService.audit("TRIAGE_SUBMITTED", "patient", `${entry.id} submitted for ${hospital.name}`);
    app.closeModal();
    app.toast(`${entry.id} created. The target facility has been alerted in this prototype.`);
  });
}
