import { icon } from "../../assets/icons.js";
import { storageService } from "../services/storageService.js";
import { securityService } from "../services/securityService.js";

export function renderAdmin() {
  return `
    <section class="page" data-role-page="admin">
      <div class="page-header">
        <div><h1>Hospital Command Center</h1><p>ER capacity controls, inbound triage, standardized API preview, and compliance evidence.</p></div>
      </div>
      <div class="tab-row">
        <button type="button" class="active" data-admin-tab="capacity">Capacity & status</button>
        <button type="button" data-admin-tab="triage">Inbound triage</button>
        <button type="button" data-admin-tab="api">JSON API</button>
        <button type="button" data-admin-tab="audit">Access & compliance</button>
      </div>
      <div id="adminTabContent"></div>
    </section>
  `;
}

function capacityView(app) {
  const allHospitals = storageService.getHospitals();
  const assignedFacility = storageService.get(storageService.keys.session, null)?.facility;
  const hospitals = assignedFacility ? allHospitals.filter((hospital) => hospital.id === assignedFacility) : allHospitals;
  const erHospitals = allHospitals.filter((hospital) => hospital.category === "Hospital");
  const cityAvailable = erHospitals.reduce((sum, hospital) => sum + hospital.available, 0);
  const cityTotal = erHospitals.reduce((sum, hospital) => sum + hospital.total, 0);
  const current = hospitals[0] || erHospitals[0];
  const occupancyPercent = (available, total) => total ? Math.round((1 - available / total) * 100) : 0;
  const donut = (available, total, label) => {
    const occupied = occupancyPercent(available, total);
    return `<div class="donut-card"><div class="donut-chart" style="--donut-value:${occupied}%"><span><strong>${occupied}%</strong><small>occupied</small></span></div><div><strong>${securityService.sanitize(label)}</strong><small>${available} of ${total} beds available</small></div></div>`;
  };
  return `
    <div class="grid-2">
      <div class="panel">
        <div class="panel-header"><h2>One-tap facility controls</h2></div>
        <div class="panel-body">
          <div class="field"><label for="adminHospital">Select facility</label><select id="adminHospital">${hospitals.map((hospital) => `<option value="${hospital.id}">${securityService.sanitize(hospital.name)}</option>`).join("")}</select></div>
          <div id="capacityFormHost" style="margin-top:10px"></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header"><h2>ER capacity snapshot</h2><small>${erHospitals.length} hospitals</small></div>
        <div class="panel-body">
          <div class="donut-grid">${donut(cityAvailable, cityTotal, "Valenzuela City")}${donut(current?.available || 0, current?.total || 0, current?.name || "Selected facility")}</div>
          <h3 class="chart-heading">Hospital bed availability</h3>
          <div class="capacity-bars">${erHospitals.map((hospital) => {
            const percent = hospital.total ? Math.round((hospital.available / hospital.total) * 100) : 0;
            const className = hospital.status === "Available" ? "available" : hospital.status === "Moderate" ? "moderate" : "full";
            return `<div class="capacity-bar-row"><span>${securityService.sanitize(hospital.code)}</span><div class="capacity-bar-track"><div class="capacity-bar-fill ${className}" style="width:${percent}%"></div></div><strong>${hospital.available}/${hospital.total}</strong></div>`;
          }).join("")}</div>
        </div>
      </div>
    </div>`;
}

function triageView(app) {
  const assignedFacility = storageService.get(storageService.keys.session, null)?.facility;
  const records = storageService.getTriage().filter((record) => !assignedFacility || record.hospitalId === assignedFacility);
  const liveTransport = storageService.getTransport();
  const liveEta = (record) => liveTransport?.triageId === record.id && liveTransport.status === "En Route"
    ? Math.max(0, liveTransport.etaRemaining - Math.floor((Date.now() - new Date(liveTransport.updatedAt).getTime()) / 60000))
    : record.eta;
  const acuityCount = (level) => records.filter((record) => Number(record.esi) === level || record.severity === `ESI ${level}`).length;
  const maxHourCount = Math.max(1, ...Array.from({ length: 8 }, (_, index) => {
    const hour = (new Date().getHours() - index + 24) % 24;
    return records.filter((record) => new Date(record.createdAt).getHours() === hour).length;
  }));
  return `
    <div class="grid-2">
      <div class="panel">
        <div class="panel-header"><h2>Inbound Patient Anticipation & Triage Feed</h2><span class="status-badge moderate">${records.length} records</span></div>
        <div class="panel-body triage-feed">${records.length ? records.map((record) => `
          <div class="feed-row">
            <div class="feed-content"><strong>${securityService.sanitize(record.id)}</strong><small>${securityService.sanitize(record.source)} · ${securityService.sanitize(record.hospitalName)}</small><small>${securityService.sanitize(record.complaint || "Triage")} · ${securityService.sanitize(record.severity || "Not specified")}${liveEta(record) != null ? ` · ETA ${liveEta(record)} min` : ""}</small>
              <small>${record.age !== undefined ? `${record.age}y · ${securityService.sanitize(record.sex || "Sex not provided")} · ` : ""}${record.pain ? `Pain ${record.pain}/10 · ` : ""}${record.avpu ? `AVPU ${securityService.sanitize(record.avpu)}` : ""}</small>
              <small>${record.bp ? `BP ${securityService.sanitize(record.bp)} · ` : ""}${record.hr ? `HR ${record.hr} · ` : ""}${record.rr ? `RR ${record.rr} · ` : ""}${record.spo2 ? `SpO₂ ${record.spo2}% · ` : ""}${record.temperatureC ? `Temp ${record.temperatureC}°C · ` : ""}${record.gcs ? `GCS ${record.gcs}` : ""}</small>
              ${record.preHospitalInterventions ? `<small>Interventions: ${securityService.sanitize(record.preHospitalInterventions)}</small>` : ""}
              ${record.notes ? `<p class="handoff-notes">${securityService.sanitize(record.notes)}</p>` : ""}
            </div>
            <div>
              <span class="status-badge ${record.esi <= 2 ? "full" : record.esi === 3 ? "moderate" : "available"}">${record.esi ? `ESI ${record.esi}` : securityService.sanitize(record.severity || record.status)}</span>
              <small class="queue-status">${securityService.sanitize(record.status)}</small>
              <button type="button" class="secondary-button" style="display:block;margin-top:6px" data-triage-action="prepare" data-triage-id="${record.id}">Prepare Bed</button>
              <button type="button" class="secondary-button" style="display:block;margin-top:4px" data-triage-action="arrive" data-triage-id="${record.id}">Mark Arrived</button>
            </div>
          </div>`).join("") : "<p>No inbound records yet.</p>"}</div>
      </div>
      <div class="panel">
        <div class="panel-header"><h2>Incoming acuity & shift load</h2></div>
        <div class="panel-body">
          <div class="acuity-bars">${[1, 2, 3, 4, 5].map((level) => `<div><span>ESI ${level}</span><strong>${acuityCount(level)}</strong></div>`).join("")}</div>
          <h3 class="chart-heading">Incoming packets · last 8 hours</h3>
          <div class="shift-chart" aria-label="Incoming triage packet trend for the last eight hours">${Array.from({ length: 8 }, (_, index) => {
            const hour = (new Date().getHours() - (7 - index) + 24) % 24;
            const count = records.filter((record) => new Date(record.createdAt).getHours() === hour).length;
            return `<div class="shift-column"><span>${count || ""}</span><div style="height:${Math.max(3, Math.round((count / maxHourCount) * 100))}%"></div><small>${String(hour).padStart(2, "0")}:00</small></div>`;
          }).join("")}</div>
          <p>Select an inbound record to prepare a bed or mark arrival.</p><button type="button" class="danger-button" data-admin-divert>Divert / Flag Selected Facility</button>
        </div>
      </div>
    </div>`;
}

function apiView(app) {
  const assignedFacility = storageService.get(storageService.keys.session, null)?.facility;
  const payload = {
    system: "CareRoute",
    scope: "Valenzuela City",
    lastUpdated: new Date().toISOString(),
    facilities: storageService.getHospitals().filter((hospital) => !assignedFacility || hospital.id === assignedFacility).map((h) => ({
      id: h.id,
      code: h.code,
      name: h.name,
      category: h.category,
      type: h.type,
      address: h.address,
      lat: h.lat,
      lng: h.lng,
      status: h.status,
      erBeds: { available: h.available, total: h.total },
      specialties: h.specialties,
      specialtyAvailability: h.specialtyAvailability,
      lastUpdated: h.lastUpdated
    }))
  };
  securityService.audit("API_PREVIEW", "admin", "Standardized JSON facility capacity preview inspected");
  return `
    <div class="panel">
      <div class="panel-header"><h2>Standardized JSON API Interoperability</h2><button type="button" id="copyApi" class="secondary-button">Copy JSON</button></div>
      <div class="panel-body"><pre class="code-block" id="apiJson">${securityService.sanitize(JSON.stringify(payload, null, 2))}</pre></div>
    </div>`;
}

function auditView() {
  const audit = storageService.getAudit();
  return `
    <div class="panel">
      <div class="panel-header"><h2>Access & Compliance Audit Log</h2><span class="status-badge available">${audit.length} entries</span></div>
      <div class="panel-body">
        <table class="table"><thead><tr><th>Timestamp</th><th>Actor</th><th>Action</th><th>Detail</th></tr></thead>
        <tbody>${audit.map((entry) => `<tr><td>${new Date(entry.timestamp).toLocaleString()}</td><td>${entry.actor}</td><td>${entry.action}</td><td>${entry.detail}</td></tr>`).join("")}</tbody></table>
        ${!audit.length ? "<p>No audit entries yet.</p>" : ""}
      </div>
    </div>`;
}

export function initAdmin(app) {
  let activeTab = "capacity";

  function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll("[data-admin-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.adminTab === tab);
    });
    const content = document.querySelector("#adminTabContent");
    if (tab === "capacity") {
      content.innerHTML = capacityView(app);
      bindCapacity(app);
    } else if (tab === "triage") {
      content.innerHTML = triageView(app);
      bindTriage(app);
    } else if (tab === "api") {
      content.innerHTML = apiView(app);
      document.querySelector("#copyApi")?.addEventListener("click", async () => {
        await navigator.clipboard?.writeText(document.querySelector("#apiJson").textContent);
        app.toast("Facility JSON copied.");
      });
    } else {
      content.innerHTML = auditView();
    }
  }

  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.adminTab));
  });
  window.addEventListener("careroute:data", (event) => {
    if (app.currentRole !== "admin" || !document.querySelector('[data-role-page="admin"]')) return;
    if ([storageService.keys.hospitals, storageService.keys.triage, storageService.keys.transport].includes(event.detail.key)) switchTab(activeTab);
  });
  switchTab("capacity");
}

function bindCapacity(app) {
  const select = document.querySelector("#adminHospital");
  const host = document.querySelector("#capacityFormHost");

  function renderForm() {
    const hospital = storageService.getHospitals().find((item) => item.id === select.value);
    host.innerHTML = `
      <div class="capacity-control">
        <div class="field"><label for="quickStatus">Facility status</label><select id="quickStatus"><option ${hospital.status === "Available" ? "selected" : ""}>Available</option><option ${hospital.status === "Moderate" ? "selected" : ""}>Moderate</option><option ${hospital.status === "Full / Diverting" ? "selected" : ""}>Full / Diverting</option></select></div>
        <div class="bed-counter"><div><strong>Available ER beds</strong><small>of ${hospital.total} listed beds</small></div><div class="bed-counter-actions"><button type="button" class="secondary-button" data-bed-change="-1" aria-label="Decrease available beds">−</button><strong>${hospital.available}</strong><button type="button" class="secondary-button" data-bed-change="1" aria-label="Increase available beds">+</button></div></div>
        <h3 class="chart-heading">Specialty availability</h3>
        <div class="specialty-switches">${hospital.specialties.map((specialty) => `<label><input type="checkbox" data-specialty="${securityService.sanitize(specialty)}" ${hospital.specialtyAvailability?.[specialty] !== false ? "checked" : ""}><span>${securityService.sanitize(specialty)}</span></label>`).join("")}</div>
        <small>Last updated ${new Date(hospital.lastUpdated).toLocaleString()}</small>
      </div>`;
  }

  function updateFacility(update, action, detail) {
    const hospitals = storageService.getHospitals();
    const index = hospitals.findIndex((item) => item.id === select.value);
    if (index < 0) return app.toast("Selected facility is no longer available.");
    hospitals[index] = { ...hospitals[index], ...update, lastUpdated: new Date().toISOString() };
    if (!storageService.setHospitals(hospitals)) {
      app.toast("Unable to publish capacity. Check browser storage availability.");
      return;
    }
    securityService.audit(action, "admin", `${hospitals[index].name}: ${detail}`);
    app.toast(`${hospitals[index].name} updated.`);
    switchAdminTabAfterUpdate(app);
  }

  select.addEventListener("change", renderForm);
  host.addEventListener("change", (event) => {
    if (event.target.id === "quickStatus") {
      updateFacility({ status: event.target.value }, "FACILITY_STATUS_UPDATED", event.target.value);
    } else if (event.target.matches("[data-specialty]")) {
      const hospital = storageService.getHospitals().find((item) => item.id === select.value);
      const specialtyAvailability = { ...(hospital.specialtyAvailability || {}), [event.target.dataset.specialty]: event.target.checked };
      updateFacility({ specialtyAvailability }, "SPECIALTY_AVAILABILITY_UPDATED", `${event.target.dataset.specialty}: ${event.target.checked ? "available" : "unavailable"}`);
    }
  });
  host.addEventListener("click", (event) => {
    const button = event.target.closest("[data-bed-change]");
    if (!button) return;
    const hospital = storageService.getHospitals().find((item) => item.id === select.value);
    const available = Math.max(0, Math.min(hospital.total, hospital.available + Number(button.dataset.bedChange)));
    const status = available === 0 ? "Full / Diverting" : hospital.status === "Full / Diverting" ? "Moderate" : hospital.status;
    updateFacility({ available, status }, "BED_CAPACITY_UPDATED", `${available}/${hospital.total}, ${status}`);
  });
  renderForm();
}

function switchAdminTabAfterUpdate(app) {
  const button = document.querySelector('[data-admin-tab="capacity"]');
  button?.click();
}

function bindTriage(app) {
  document.querySelectorAll("[data-triage-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const records = storageService.getTriage();
      const record = records.find((item) => item.id === button.dataset.triageId);
      if (!record) return;
      const action = button.dataset.triageAction;
      record.status = action === "arrive" ? "Arrived" : "Bed Prepared";
      storageService.set(storageService.keys.triage, records);
      securityService.audit("TRIAGE_ACTION", "admin", `${record.status}: ${record.id}`);
      app.toast(`${record.status} recorded for ${record.id}.`);
      document.querySelector('[data-admin-tab="triage"]')?.click();
    });
  });
  document.querySelector("[data-admin-divert]")?.addEventListener("click", () => {
    const hospitals = storageService.getHospitals();
    const assignedFacility = storageService.get(storageService.keys.session, null)?.facility;
    const first = hospitals.find((hospital) => hospital.id === assignedFacility) || hospitals[0];
    if (!first) return app.toast("No facility is available to update.");
    const index = hospitals.findIndex((item) => item.id === first.id);
    hospitals[index] = { ...first, status: "Full / Diverting", available: 0 };
    storageService.setHospitals(hospitals);
    securityService.audit("DIVERSION_FLAG", "admin", `${first.name} marked Full / Diverting`);
    app.toast(`${first.name} diversion flag published.`);
  });
}
