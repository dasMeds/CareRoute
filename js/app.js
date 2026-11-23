import { CONFIG } from "./config.js";
import { storageService } from "./services/storageService.js";
import { securityService } from "./services/securityService.js";
import { mapService } from "./services/mapService.js";
import { renderAuth } from "./views/authView.js";
import { renderPatient, initPatient } from "./views/patientView.js";
import { renderRescue, initRescue } from "./views/rescueView.js";
import { renderAdmin, initAdmin } from "./views/adminView.js";

class CareRouteApp {
  constructor() {
    this.main = document.querySelector("#mainContent");
    this.modalRegion = document.querySelector("#modalRegion");
    this.currentRole = null;
    this.bindGlobalEvents();
    this.initializeData();
    this.renderAuth();
  }

  initializeData() {
    if (!storageService.getHospitals()?.length) {
      storageService.resetDemo();
    }
  }

  bindGlobalEvents() {
    document.querySelector("#brandButton").addEventListener("click", () => this.renderAuth());
    document.querySelector("#resetButton").addEventListener("click", () => {
      storageService.resetDemo();
      securityService.audit("DEMO_RESET", this.currentRole || "public", "Demo hospitals and records restored");
      this.toast("Demo data reset across all local views.");
      if (this.currentRole) this.navigate(this.currentRole);
    });
    document.querySelector("#auditButton").addEventListener("click", () => this.openAuditDrawer());
    document.querySelector("#mobileView").addEventListener("click", () => this.setViewport("mobile"));
    document.querySelector("#desktopView").addEventListener("click", () => this.setViewport("desktop"));
    document.querySelector("#roleSelect").addEventListener("change", (event) => {
      if (!event.target.value) return this.renderAuth();
      if (this.currentRole !== event.target.value) this.requestRoleLogin(event.target.value);
    });
    document.querySelector("#mapModeSelect").addEventListener("change", (event) => {
      mapService.setMode(event.target.value);
      storageService.set(storageService.keys.mapMode, event.target.value);
      securityService.audit("MAP_MODE_CHANGED", this.currentRole || "public", event.target.value);
      this.toast(`Map mode set to ${event.target.options[event.target.selectedIndex].text}.`);
      if (this.currentRole) this.navigate(this.currentRole);
    });
    window.addEventListener("storage", (event) => {
      if (event.key?.startsWith("careroute.") && this.currentRole) this.navigate(this.currentRole);
    });
    window.addEventListener("careroute:data", (event) => {
      if (event.detail.key === storageService.keys.hospitals && this.currentRole) this.navigate(this.currentRole);
    });
  }

  setViewport(view) {
    document.querySelector("#mobileView").classList.toggle("active", view === "mobile");
    document.querySelector("#desktopView").classList.toggle("active", view === "desktop");
    document.querySelector("#mainContent .page")?.classList.toggle("mobile-layout", view === "mobile");
  }

  renderAuth() {
    this.currentRole = null;
    document.querySelector("#roleSelect").value = "";
    this.main.innerHTML = renderAuth(this);
    document.querySelectorAll("[data-demo-login]").forEach((button) => {
      button.addEventListener("click", () => {
        const role = button.dataset.demoLogin;
        const passcode = document.querySelector(`[data-role-pass="${role}"]`).value;
        if (passcode !== "demo123") {
          this.toast("Use the demo passcode: demo123");
          return;
        }
        this.login(role);
      });
    });
  }

  requestRoleLogin(role) {
    document.querySelector("#roleSelect").value = this.currentRole || "";
    this.renderAuth();
    document.querySelector(`[data-role-pass="${role}"]`)?.focus();
    this.toast(`Enter the ${role} demo passcode: demo123`);
  }

  async login(role) {
    const session = {
      ...securityService.sessionPayload(role),
      tokenHash: await securityService.token()
    };
    storageService.set(storageService.keys.session, session);
    securityService.audit("DEMO_LOGIN", role, "Prototype role session created");
    this.currentRole = role;
    document.querySelector("#roleSelect").value = role;
    this.navigate(role);
  }

  navigate(role) {
    this.currentRole = role;
    const mode = storageService.get(storageService.keys.mapMode, "auto");
    document.querySelector("#mapModeSelect").value = mode;
    mapService.setMode(mode);
    if (role === "patient") {
      this.main.innerHTML = renderPatient();
      initPatient(this);
    } else if (role === "rescue") {
      if (!securityService.require(role, "dispatch.manage")) return this.renderAuth();
      this.main.innerHTML = renderRescue();
      initRescue(this);
    } else if (role === "admin") {
      if (!securityService.require(role, "capacity.manage")) return this.renderAuth();
      this.main.innerHTML = renderAdmin();
      initAdmin(this);
    }
  }

  openModal(html) {
    this.modalRegion.innerHTML = html;
    this.modalRegion.querySelector("[data-close-modal]")?.addEventListener("click", () => this.closeModal());
  }

  closeModal() {
    this.modalRegion.innerHTML = "";
  }

  openAuditDrawer() {
    const entries = storageService.getAudit();
    this.modalRegion.innerHTML = `
      <div class="modal-backdrop drawer-backdrop">
        <aside class="drawer">
          <div class="session-row"><h2>Compliance Audit</h2><button type="button" class="secondary-button" data-close-modal>Close</button></div>
          <p class="notice"><strong>Prototype disclaimer:</strong> LocalStorage and this audit trail are not production medical records. Production requires server-side RBAC, HTTPS/TLS, encryption, signed agreements, retention controls, and NPC/DOH review.</p>
          <table class="table"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Detail</th></tr></thead>
          <tbody>${entries.map((entry) => `<tr><td>${new Date(entry.timestamp).toLocaleString()}</td><td>${entry.actor}</td><td>${entry.action}</td><td>${entry.detail}</td></tr>`).join("")}</tbody></table>
          ${!entries.length ? "<p>No audit entries yet.</p>" : ""}
        </aside>
      </div>`;
    this.modalRegion.querySelector("[data-close-modal]").addEventListener("click", () => this.closeModal());
  }

  toast(message) {
    const region = document.querySelector("#toastRegion");
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    region.appendChild(toast);
    setTimeout(() => toast.remove(), 4200);
  }
}

window.addEventListener("online", () => {
  if (window.careRouteApp?.currentRole) window.careRouteApp.navigate(window.careRouteApp.currentRole);
});
window.addEventListener("offline", () => {
  if (window.careRouteApp?.currentRole) {
    window.careRouteApp.toast("Network offline. Using the Valenzuela offline vector fallback.");
  }
});

window.careRouteApp = new CareRouteApp();
