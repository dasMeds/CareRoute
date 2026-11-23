import { storageService } from "./storageService.js";

const permissions = {
  patient: new Set(["capacity.view", "triage.basic", "route.view"]),
  rescue: new Set(["capacity.view", "triage.advanced", "route.view", "dispatch.manage"]),
  admin: new Set(["capacity.view", "capacity.manage", "triage.view", "triage.manage", "audit.view", "api.preview"])
};

export const securityService = {
  sanitize(input) {
    const element = document.createElement("div");
    element.textContent = String(input ?? "");
    return element.innerHTML.replace(/[<>"']/g, (char) => ({
      "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[char]);
  },
  can(role, permission) {
    return Boolean(permissions[role]?.has(permission));
  },
  require(role, permission) {
    if (!this.can(role, permission)) {
      this.audit("ACCESS_DENIED", role, permission);
      return false;
    }
    return true;
  },
  transactionNumber() {
    const random = Math.floor(1000 + Math.random() * 9000);
    return `CR-VAL-2026-${random}`;
  },
  async token() {
    const source = `${Date.now()}-${crypto?.randomUUID?.() || Math.random()}`;
    try {
      const bytes = new TextEncoder().encode(source);
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      let hash = 0;
      for (const char of source) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
      return `${Math.abs(hash).toString(16).padStart(8, "0")}-fallback`;
    }
  },
  audit(action, actor, detail = "") {
    const list = storageService.getAudit();
    list.unshift({
      id: `AUD-${Date.now().toString(36).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      actor,
      action,
      detail: this.sanitize(detail)
    });
    storageService.set(storageService.keys.audit, list.slice(0, 200));
  },
  sessionPayload(role) {
    return { role, startedAt: Date.now(), lastActivity: Date.now() };
  },
  isSessionLocked(session, timeoutMs) {
    return !session || Date.now() - (session.lastActivity || 0) > timeoutMs;
  }
};
