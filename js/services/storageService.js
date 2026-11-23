// src/services/storageService.js

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
    const saved = this.get(KEYS.hospitals, HOSPITALS);
    if (!Array.isArray(saved)) return clone(HOSPITALS);
    const byId = new Map(saved.map((hospital) => [hospital.id, hospital]));
    const merged = HOSPITALS.map((defaults) => {
      const current = byId.get(defaults.id);
      if (!current) return clone(defaults);
      byId.delete(defaults.id);
      return {
        ...defaults,
        ...current,
        specialties: Array.isArray(current.specialties) ? current.specialties : defaults.specialties,
        specialtyAvailability: {
          ...defaults.specialtyAvailability,
          ...(current.specialtyAvailability || {})
        },
        lastUpdated: current.lastUpdated || defaults.lastUpdated
      };
    });
    const additional = [...byId.values()].map((hospital) => ({
      ...hospital,
      specialties: Array.isArray(hospital.specialties) ? hospital.specialties : [],
      specialtyAvailability: hospital.specialtyAvailability || {},
      lastUpdated: hospital.lastUpdated || new Date().toISOString()
    }));
    return merged.concat(additional);
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
    return this.set(KEYS.triage, list);
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