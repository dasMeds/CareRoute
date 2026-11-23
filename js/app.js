import { CONFIG } from "./config.js";
import { storageService } from "./services/storageService.js";
import { securityService } from "./services/securityService.js";
import { mapService } from "./services/mapService.js";
import { renderAuth, initAuth } from "./views/authView.js";
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
    const savedMode = storageService.get(storageService.keys.mapMode, "auto");
    mapService.setMode(savedMode);
    this.restoreSession();
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
    document.querySelector("#signOutButton").addEventListener("click", () => this.signOut());
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
    document.querySelector("#signOutButton").classList.add("hidden");
    document.querySelector("#sessionLabel").classList.add("hidden");
    document.querySelector("#auditButton").classList.add("hidden");
    this.main.innerHTML = renderAuth(this);
    initAuth((credentials) => this.login(credentials));
  }

  async login(credentials) {
    const tokenHash = await securityService.token();
    const session = securityService.createSession({ ...credentials, tokenHash });
    storageService.set(storageService.keys.session, session);
    securityService.audit("DEMO_LOGIN", session.role, `${session.account} signed in${session.facility ? ` at ${session.facility}` : ""}`);
    this.navigate(session.role);
  }

  restoreSession() {
    const session = storageService.get(storageService.keys.session, null);
    if (!session || !session.account || !session.tokenHash || securityService.isSessionLocked(session, CONFIG.sessionTimeoutMs)) {
      if (session) this.signOut(true);
      else this.renderAuth();
      return;
    }
    this.navigate(session.role);
  }

  signOut(expired = false) {
    const old = storageService.get(storageService.keys.session, null);
    if (old) securityService.audit(expired ? "SESSION_EXPIRED" : "SIGN_OUT", old.role, old.account || "");
    localStorage.removeItem(storageService.keys.session);
    this.renderAuth();
    if (expired) this.toast("Your demo session expired. Please sign in again.");
  }

  navigate(role) {
    const session = storageService.get(storageService.keys.session, null);
    if (!session || session.role !== role || securityService.isSessionLocked(session, CONFIG.sessionTimeoutMs)) {
      if (session) this.signOut(true);
      else this.renderAuth();
      return;
    }
    storageService.set(storageService.keys.session, securityService.touchSession(session));
    this.currentRole = role;
    const mode = storageService.get(storageService.keys.mapMode, "auto");
    document.querySelector("#mapModeSelect").value = mode;
    mapService.setMode(mode);
    document.querySelector("#signOutButton").classList.remove("hidden");
    document.querySelector("#auditButton").classList.toggle("hidden", !securityService.can(role, "audit.view"));
    const roleNames = { patient: "Patient / Public", rescue: "Ambulance / Rescue", admin: "Hospital Administrator" };
    document.querySelector("#sessionLabel").textContent = `${roleNames[role]} · ${session.facility || session.account}`;
    document.querySelector("#sessionLabel").classList.remove("hidden");
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
    if (!securityService.require(this.currentRole, "audit.view")) {
      this.toast("Audit log access is limited to authorized hospital administrators.");
      return;
    }
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
