import { HOSPITALS } from "../data/hospitals.js";

const KEYS = Object.freeze({
  hospitals: "careroute.hospitals",
  triage: "careroute.triage",
  transport: "careroute.transport",
  audit: "careroute.audit",
  session: "careroute.session",
  mapMode: "careroute.mapMode"
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export const storageService = {
  keys: KEYS,
  get(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? clone(fallback) : JSON.parse(value);
    } catch {
      return clone(fallback);
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      window.dispatchEvent(new CustomEvent("careroute:data", { detail: { key } }));
      return true;
    } catch {
      return false;
    }
  },
  resetDemo() {
    localStorage.removeItem(KEYS.triage);
    localStorage.removeItem(KEYS.transport);
    localStorage.removeItem(KEYS.audit);
    localStorage.removeItem(KEYS.mapMode);
    this.set(KEYS.hospitals, clone(HOSPITALS));
  },
  getHospitals() {
    return this.get(KEYS.hospitals, HOSPITALS);
  },
  setHospitals(hospitals) {
    return this.set(KEYS.hospitals, hospitals);
  },
  getTriage() {
    return this.get(KEYS.triage, []);
  },
  addTriage(entry) {
    const list = this.getTriage();
    list.unshift(entry);
    this.set(KEYS.triage, list);
  },
  getTransport() {
    return this.get(KEYS.transport, null);
  },
  setTransport(value) {
    this.set(KEYS.transport, value);
  },
  getAudit() {
    return this.get(KEYS.audit, []);
  }
};
