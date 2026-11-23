export const DEFAULT_CONFIG = Object.freeze({
  valenzuelaCenter: { lat: 14.7011, lng: 120.9830 },
  defaultStartingPoint: "Pamantasan ng Lungsod ng Valenzuela - Maysan Campus",
  refreshIntervalMs: 15000,
  sessionTimeoutMs: 30 * 60 * 1000
});

export const CONFIG = Object.freeze({
  ...DEFAULT_CONFIG,
  ...(window.CAREROUTE_CONFIG || {})
});
