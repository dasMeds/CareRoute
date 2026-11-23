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
  const hospitals = storageService.getHospitals();
  return `
    <div class="grid-2">
      <div class="panel">
        <div class="panel-header"><h2>Facility ER status controls</h2></div>
        <div class="panel-body">
          <div class="field"><label>Select facility</label><select id="adminHospital">${hospitals.map((h) => `<option value="${h.id}">${h.name}</option>`).join("")}</select></div>
          <div id="capacityFormHost" style="margin-top:10px"></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header"><h2>Live capacity overview</h2></div>
        <div class="panel-body">${hospitals.map((h) => {
          const className = h.status === "Available" ? "available" : h.status === "Moderate" ? "moderate" : "full";
          return `<div class="session-row" style="padding:8px 0;border-bottom:1px solid var(--border-light)"><div><strong>${h.name}</strong><br><small>${h.address}</small></div><div><span class="status-badge ${className}">${h.status}</span><br><strong>${h.available}/${h.total}</strong></div></div>`;
        }).join("")}</div>
      </div>
    </div>`;
}

function triageView(app) {
  const records = storageService.getTriage();
  return `
    <div class="grid-2">
      <div class="panel">
        <div class="panel-header"><h2>Inbound Patient Anticipation & Triage Feed</h2><span class="status-badge moderate">${records.length} records</span></div>
        <div class="panel-body triage-feed">${records.length ? records.map((record) => `
          <div class="feed-row">
            <div><strong>${record.id}</strong><small>${record.source} · ${record.hospitalName}</small><small>${record.complaint || record.complaintCategory || "Basic self-triage"} · ${record.severity}</small></div>
            <div>
              <span class="status-badge moderate">${record.status}</span>
              <button type="button" class="secondary-button" style="display:block;margin-top:6px" data-triage-action="prepare" data-triage-id="${record.id}">Prepare Bed</button>
            </div>
          </div>`).join("") : "<p>No inbound records yet.</p>"}</div>
      </div>
      <div class="panel">
        <div class="panel-header"><h2>Triage actions</h2></div>
        <div class="panel-body"><p>Select an inbound record, prepare the receiving area, mark arrival, or divert / flag capacity.</p><button type="button" class="danger-button" data-admin-divert>Divert / Flag Selected Facility</button></div>
      </div>
    </div>`;
}

function apiView(app) {
  const payload = {
    system: "CareRoute",
    scope: "Valenzuela City",
    lastUpdated: new Date().toISOString(),
    facilities: storageService.getHospitals().map((h) => ({
      id: h.id,
      name: h.name,
      status: h.status,
      erBeds: { available: h.available, total: h.total },
      specialties: h.specialties
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
  function switchTab(tab) {
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
  switchTab("capacity");
}

function bindCapacity(app) {
  const select = document.querySelector("#adminHospital");
  const host = document.querySelector("#capacityFormHost");

  function renderForm() {
    const hospital = storageService.getHospitals().find((item) => item.id === select.value);
    host.innerHTML = `
      <form id="capacityForm" class="field-grid">
        <div class="field"><label>ER status</label><select name="status"><option ${hospital.status === "Available" ? "selected" : ""}>Available</option><option ${hospital.status === "Moderate" ? "selected" : ""}>Moderate</option><option ${hospital.status === "Full / Diverting" ? "selected" : ""}>Full / Diverting</option></select></div>
        <div class="field"><label>Available ER beds</label><input name="available" type="number" min="0" max="${hospital.total}" value="${hospital.available}" required></div>
        <div class="field full"><label>Total ER beds</label><input name="total" type="number" min="1" max="500" value="${hospital.total}" required></div>
        <button type="submit" class="primary-button full">Publish live capacity</button>
      </form>`;

    document.querySelector("#capacityForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const available = Number(form.get("available"));
      const total = Number(form.get("total"));
      if (available > total) {
        app.toast("Available beds cannot exceed total ER beds.");
        return;
      }
      const hospitals = storageService.getHospitals();
      const index = hospitals.findIndex((item) => item.id === hospital.id);
      hospitals[index] = {
        ...hospitals[index],
        status: form.get("status"),
        available,
        total
      };
      storageService.setHospitals(hospitals);
      securityService.audit("BED_CAPACITY_UPDATED", "admin", `${hospital.name}: ${available}/${total}, ${form.get("status")}`);
      app.toast(`${hospital.name} capacity published.`);
      switchAdminTabAfterUpdate(app);
    });
  }
  select.addEventListener("change", renderForm);
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
      record.status = "Bed Prepared";
      storageService.set(storageService.keys.triage, records);
      securityService.audit("TRIAGE_ACTION", "admin", `Prepare Bed: ${record.id}`);
      app.toast(`Bed preparation recorded for ${record.id}.`);
      document.querySelector('[data-admin-tab="triage"]')?.click();
    });
  });
  document.querySelector("[data-admin-divert]")?.addEventListener("click", () => {
    const hospitals = storageService.getHospitals();
    const first = hospitals[0];
    const index = hospitals.findIndex((item) => item.id === first.id);
    hospitals[index] = { ...first, status: "Full / Diverting", available: 0 };
    storageService.setHospitals(hospitals);
    securityService.audit("DIVERSION_FLAG", "admin", `${first.name} marked Full / Diverting`);
    app.toast(`${first.name} diversion flag published.`);
  });
}
