// src/services/mapService.js

import { storageService } from "./storageService.js";

const STARTING_POINTS = [
  { name: "PLV Maysan Campus", lat: 14.7113, lng: 120.9734 },
  { name: "Karuhatan", lat: 14.6889, lng: 120.9810 },
  { name: "Malinta", lat: 14.6962, lng: 120.9808 },
  { name: "Marulas", lat: 14.6756, lng: 120.9822 },
  { name: "Malanday", lat: 14.7165, lng: 120.9617 }
];

const NODES = {
  PLV: { lat: 14.7113, lng: 120.9734 },
  MAYSAN: { lat: 14.7052, lng: 120.9705 },
  KARUHATAN: { lat: 14.6910, lng: 120.9740 },
  MALANDAY: { lat: 14.7160, lng: 120.9620 },
  NLEX: { lat: 14.7190, lng: 120.9555 },
  POLO: { lat: 14.7280, lng: 120.9555 },
  PASO: { lat: 14.7070, lng: 120.9580 },
  MALINTA: { lat: 14.6960, lng: 120.9800 },
  MARULAS: { lat: 14.6810, lng: 120.9810 },
  SOUTH: { lat: 14.6700, lng: 120.9820 },
  GOV: { lat: 14.6910, lng: 120.9890 }
};

const EDGES = [
  ["PLV", "MAYSAN", "Maysan Rd", 32],
  ["MAYSAN", "MALANDAY", "Paso de Blas", 30],
  ["MAYSAN", "KARUHATAN", "Maysan Rd", 30],
  ["KARUHATAN", "MALANDAY", "MacArthur Highway", 35],
  ["MALANDAY", "NLEX", "NLEX", 55],
  ["NLEX", "POLO", "NLEX", 48],
  ["MALANDAY", "PASO", "Paso de Blas", 34],
  ["PASO", "POLO", "Paso de Blas", 30],
  ["KARUHATAN", "MALINTA", "MacArthur Highway", 36],
  ["MALINTA", "MARULAS", "MacArthur Highway", 34],
  ["MARULAS", "SOUTH", "MacArthur Highway", 38],
  ["KARUHATAN", "GOV", "Gov. I. Santiago St.", 32],
  ["GOV", "MALINTA", "Gov. I. Santiago St.", 30],
  ["GOV", "MARULAS", "R. Valenzuela St.", 28],
  ["PASO", "MALINTA", "Paso de Blas", 34]
];

function localTrafficScenario() {
  const hour = new Date().getHours();
  const weekday = new Date().getDay() > 0 && new Date().getDay() < 6;
  const rushHour = weekday && ((hour >= 7 && hour < 10) || (hour >= 16 && hour < 20));
  const shoulder = weekday && ((hour >= 6 && hour < 7) || (hour >= 10 && hour < 12) || (hour >= 15 && hour < 16));
  const base = rushHour ? 1.35 : shoulder ? 1.12 : 1;
  return {
    label: "Time-of-day corridor estimate",
    roads: {
      "MacArthur Highway": base * 1.08,
      NLEX: base,
      "Paso de Blas": base * 1.03,
      "Gov. I. Santiago St.": base * 0.96,
      "Maysan Rd": base * 0.98,
      "R. Valenzuela St.": base * 0.94
    },
    hotspots: []
  };
}

function congestionLabel(factor) {
  return factor > 1.5 ? "Heavy" : factor > 1.2 ? "Moderate" : "Smooth";
}

const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const clamp = (value, min, max) => Math.min(max, Math.max(min, finite(value, min)));
const statusColor = (status) => (status === "Available" ? "#10B981" : status === "Moderate" ? "#F59E0B" : "#EF4444");

function distanceKm(a, b) {
  const lat = (finite(a?.lat, 14.7011) + finite(b?.lat, 14.7011)) / 2;
  const dy = (finite(a?.lat, 14.7011) - finite(b?.lat, 14.7011)) * 111.32;
  const dx = (finite(a?.lng, 120.983) - finite(b?.lng, 120.983)) * 111.32 * Math.cos((lat * Math.PI) / 180);
  const result = Math.hypot(dx, dy);
  return Number.isFinite(result) ? result : 0.1;
}

function closestNode(point) {
  return Object.keys(NODES).reduce(
    (closest, id) => (distanceKm(point, NODES[id]) < distanceKm(point, NODES[closest]) ? id : closest),
    Object.keys(NODES)[0]
  );
}

function shortestPath(from, to, scenario, excludedEdge = "", penalizedRoads = {}) {
  const distances = Object.fromEntries(Object.keys(NODES).map((id) => [id, Infinity]));
  const previous = {};
  const visited = new Set();
  distances[from] = 0;

  while (visited.size < Object.keys(NODES).length) {
    let current = null;
    for (const id of Object.keys(NODES)) {
      if (!visited.has(id) && (current === null || distances[id] < distances[current])) current = id;
    }
    if (current === null || !Number.isFinite(distances[current]) || current === to) break;
    visited.add(current);

    EDGES.forEach(([a, b, road, speed]) => {
      if (a !== current && b !== current) return;
      const next = a === current ? b : a;
      const key = [a, b].sort().join(":");
      if (key === excludedEdge || visited.has(next)) return;
      const km = distanceKm(NODES[a], NODES[b]);
      const congestion = finite(scenario.roads?.[road], 1) * finite(penalizedRoads[road], 1);
      const weight = km / Math.max(10, finite(speed, 30) / congestion);
      const candidate = distances[current] + weight;
      if (candidate < distances[next]) {
        distances[next] = candidate;
        previous[next] = { node: current, edge: [a, b, road, speed] };
      }
    });
  }

  if (from !== to && !previous[to]) return { nodes: [from, to], edges: [], connected: false };

  const nodes = [to];
  const edges = [];
  let cursor = to;
  while (cursor !== from) {
    const step = previous[cursor];
    if (!step) break;
    edges.unshift(step.edge);
    cursor = step.node;
    nodes.unshift(cursor);
  }
  return { nodes, edges, connected: true };
}

function makeRoute(start, destination, scenario, excludedEdge = "", penalizedRoads = {}, label = "Primary route") {
  const originNode = closestNode(start);
  const destinationNode = closestNode(destination);
  const path = shortestPath(originNode, destinationNode, scenario, excludedEdge, penalizedRoads);

  if (!path.connected) {
    const directDistance = Math.max(0.2, distanceKm(start, destination) * 1.45);
    const eta = Math.max(1, Math.round((directDistance / 25) * 60));
    return {
      label,
      points: [
        { lat: finite(start?.lat, 14.7011), lng: finite(start?.lng, 120.983) },
        { lat: finite(destination?.lat, 14.7011), lng: finite(destination?.lng, 120.983) }
      ],
      segments: [{ road: "Local connector", distanceKm: directDistance, speedKmh: 25, from: start, to: destination, congestion: "Smooth" }],
      distanceKm: Number(directDistance.toFixed(2)),
      eta,
      speedKmh: Number((directDistance / (eta / 60)).toFixed(1)),
      hasCongestion: false,
      steps: [{ maneuver: "depart", instruction: "Follow local roads toward the destination", road: "Local connector", distanceKm: Number(directDistance.toFixed(2)), congestion: "Smooth" }]
    };
  }

  const points = [start, ...path.nodes.map((id) => NODES[id]), destination];
  const segments = [];
  let totalKm = 0;
  let weightedMinutes = 0;
  let hasCongestion = false;

  path.edges.forEach(([a, b, road, speed]) => {
    const km = distanceKm(NODES[a], NODES[b]);
    const congestion = finite(scenario.roads?.[road], 1);
    if (congestion > 1.25) hasCongestion = true;
    const actualSpeed = Math.max(10, finite(speed, 30) / congestion);
    totalKm += km;
    weightedMinutes += (km / actualSpeed) * 60;
    segments.push({
      road,
      distanceKm: km,
      speedKmh: actualSpeed,
      from: NODES[a],
      to: NODES[b],
      congestion: congestion > 1.45 ? "Heavy" : congestion > 1.1 ? "Moderate" : "Smooth"
    });
  });

  const connectors = distanceKm(start, NODES[originNode]) + distanceKm(destination, NODES[destinationNode]);
  totalKm += connectors;
  weightedMinutes += (connectors / 25) * 60;

  if (!Number.isFinite(totalKm) || totalKm < 0.1) totalKm = Math.max(0.3, distanceKm(start, destination) * 1.35);
  const eta = Math.max(1, Math.round(finite(weightedMinutes, totalKm * 2.5)));

  if (!segments.length) {
    segments.push({ road: "Local connector", distanceKm: totalKm, speedKmh: totalKm / (eta / 60), from: start, to: destination, congestion: "Smooth" });
  }

  return {
    label,
    points: points.map((point) => ({ lat: finite(point.lat, 14.7011), lng: finite(point.lng, 120.983) })),
    segments,
    distanceKm: Number(totalKm.toFixed(2)),
    eta,
    speedKmh: Number((totalKm / Math.max(eta / 60, 1 / 60)).toFixed(1)),
    hasCongestion,
    steps: segments.map((segment, index) => ({
      maneuver: index === 0 ? "depart" : "straight",
      instruction: `${index === 0 ? "Head along" : "Continue on"} ${segment.road}`,
      road: segment.road,
      distanceKm: Number(segment.distanceKm.toFixed(2)),
      congestion: segment.congestion
    }))
  };
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));
}

function maneuverInstruction(type, modifier, road) {
  const direction = modifier ? ` ${modifier.replace(/-/g, " ")}` : "";
  const cleanRoad = road && road !== "Unnamed road" ? road : "local road";
  const location = ` onto ${cleanRoad}`;
  if (type === "depart") return `Head${direction}${location}`;
  if (type === "arrive") return "Arrive at your destination";
  if (type === "turn") return `Turn${direction}${location}`;
  if (type === "merge") return `Merge${direction}${location}`;
  if (type === "on ramp") return `Take the ramp${direction}${location}`;
  if (type === "off ramp") return `Take the exit${direction}${location}`;
  if (type === "roundabout" || type === "rotary") return `Enter the roundabout${direction}${location}`;
  if (type === "fork") return `Keep${direction}${location}`;
  if (type === "end of road") return `At the end of the road, turn${direction}${location}`;
  if (type === "new name") return `Continue${location}`;
  return `Continue on ${cleanRoad}`;
}

function normalizeOsrmRoute(route) {
  const points = (route.geometry?.coordinates || [])
    .filter((coordinate) => Array.isArray(coordinate) && Number.isFinite(Number(coordinate[0])) && Number.isFinite(Number(coordinate[1])))
    .map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) }));

  const steps = (route.legs || []).flatMap((leg) =>
    (leg.steps || []).map((step) => {
      const type = String(step.maneuver?.type || "continue");
      const modifier = String(step.maneuver?.modifier || "");
      const road = String(step.name || "Local road");
      const meters = Math.max(0, finite(step.distance, 0));
      const durationSeconds = Math.max(0, finite(step.duration, 0));
      const speedKmh = durationSeconds > 0 ? (meters / 1000) / (durationSeconds / 3600) : 30;
      const congestionFactor = 30 / Math.max(5, speedKmh);
      const geometry = (step.geometry?.coordinates || [])
        .filter((coordinate) => Array.isArray(coordinate) && Number.isFinite(Number(coordinate[0])) && Number.isFinite(Number(coordinate[1])))
        .map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) }));

      return {
        maneuver: type === "turn" && modifier ? `turn-${modifier}` : type,
        maneuverType: type,
        maneuverModifier: modifier,
        instruction: maneuverInstruction(type, modifier, road),
        road,
        distanceKm: Number((meters / 1000).toFixed(2)),
        durationSeconds,
        congestion: congestionLabel(congestionFactor),
        points: geometry
      };
    })
  );

  const distanceKm = Math.max(0.1, finite(route.distance, 0) / 1000);
  const eta = Math.max(1, Math.round(Math.max(0, finite(route.duration, 0)) / 60));
  const speedKmh = Number((distanceKm / (eta / 60)).toFixed(1));
  return {
    points,
    segments: steps.map((step) => ({
      road: step.road,
      distanceKm: step.distanceKm,
      points: step.points,
      congestion: step.congestion
    })),
    distanceKm: Number(distanceKm.toFixed(2)),
    eta,
    speedKmh: Number.isFinite(speedKmh) ? speedKmh : 0,
    hasCongestion: steps.some((step) => step.congestion !== "Smooth"),
    steps: steps.length
      ? steps
      : [{
          maneuver: "arrive",
          maneuverType: "arrive",
          maneuverModifier: "",
          instruction: "Arrive at your destination",
          road: "Destination",
          distanceKm: 0,
          points: []
        }]
  };
}

export const mapService = {
  startingPoints: STARTING_POINTS,
  mode: "auto",
  mapStyle: "navigation", // "navigation" | "streets" | "satellite"
  autoReroute: true,
  trafficEnabled: true,
  animation: null,
  progressAnimation: null,
  currentNavigation: null,
  markerListener: null,
  leafletLoader: null,
  leafletMap: null,
  leafletRouteLayers: [],
  vehicleMarker: null,
  visualProgress: 0,
  forceOffline: false,
  renderToken: 0,
  routeCalculationToken: 0,

  effectiveMode() {
    return this.mode === "offline" || !navigator.onLine || this.forceOffline ? "offline" : "free";
  },

  getTransportStatus(progress = this.currentNavigation?.progress ?? 0) {
    const p = clamp(progress, 0, 1);
    if (p <= 0) return { label: "Dispatched", banner: "Ready for dispatch", badgeClass: "status-dispatched" };
    if (p < 0.8) return { label: "En Route", banner: "Navigation in progress", badgeClass: "status-enroute" };
    if (p < 1) return { label: "Arriving Soon", banner: "Approaching emergency bay", badgeClass: "status-arriving" };
    return { label: "Handed Over", banner: "Navigation complete", badgeClass: "status-complete" };
  },

  findNearestAcceptingHospital(origin, excludeId = null) {
    const hospitals = storageService.getHospitals().filter((h) => h.id !== excludeId);
    const accepting = hospitals.filter((h) => finite(h.available, 0) > 0 && h.status !== "Full / Diverting");
    const pool = accepting.length ? accepting : hospitals;
    if (!pool.length) return null;

    return pool
      .map((h) => {
        const r = makeRoute(origin, h, localTrafficScenario());
        return { hospital: h, distanceKm: r.distanceKm, eta: r.eta };
      })
      .sort((a, b) => a.eta - b.eta || a.distanceKm - b.distanceKm)[0]?.hospital || null;
  },

  async loadLeaflet() {
    if (window.L?.map) return true;
    if (!navigator.onLine) return false;
    if (this.leafletLoader) return this.leafletLoader;

    this.leafletLoader = new Promise((resolve) => {
      let settled = false;
      const finish = (loaded) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(loaded);
      };
      const timeout = setTimeout(() => finish(false), 8000);

      if (!document.querySelector('link[href*="leaflet@1.9.4/dist/leaflet.css"]')) {
        const stylesheet = document.createElement("link");
        stylesheet.rel = "stylesheet";
        stylesheet.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        stylesheet.onerror = () => {
          stylesheet.remove();
          finish(false);
        };
        document.head.appendChild(stylesheet);
      }

      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.onload = () => finish(Boolean(window.L?.map));
      script.onerror = () => finish(false);
      document.head.appendChild(script);
    });

    const loaded = await this.leafletLoader;
    if (!loaded) this.leafletLoader = null;
    return loaded;
  },

  async requestOsrmRoute(start, destination) {
    const coordinates = `${finite(start.lng, STARTING_POINTS[0].lng)},${finite(start.lat, STARTING_POINTS[0].lat)};${finite(destination.lng, 120.983)},${finite(destination.lat, 14.7011)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true&alternatives=true`,
        { signal: controller.signal, headers: { Accept: "application/json" } }
      );
      if (!response.ok) throw new Error(`OSRM returned HTTP ${response.status}`);
      const payload = await response.json();
      if (payload.code !== "Ok" || !Array.isArray(payload.routes) || !payload.routes.length) {
        throw new Error(`OSRM route unavailable: ${payload.code || "no routes"}`);
      }
      const routes = payload.routes.map((r) => normalizeOsrmRoute(r));
      if (routes[0].points.length < 2) throw new Error("OSRM returned no route geometry");
      return routes;
    } finally {
      clearTimeout(timeout);
    }
  },

  switchToOffline(reason = "Map tile services unavailable") {
    this.forceOffline = true;
    if (this.currentNavigation) this.currentNavigation.fallbackReason = reason;
    if (this.container?.isConnected) this.renderOffline(this.container, this.options || {});
  },

  cleanupActiveMap() {
    if (this.animation) cancelAnimationFrame(this.animation);
    this.animation = null;
    this.canvas = null;
    this.vehicleMarker = null;
    this.leafletRouteLayers = [];
    if (this.leafletMap) {
      this.leafletMap.off();
      this.leafletMap.remove();
      this.leafletMap = null;
    }
  },

  async render(container, options = {}) {
    if (!container) return;
    const token = ++this.renderToken;
    this.container = container;
    this.options = options;
    this.cleanupActiveMap();

    if (this.effectiveMode() === "free") {
      const loaded = await this.loadLeaflet();
      if (token !== this.renderToken || !container.isConnected) return;
      if (loaded) {
        try {
          this.renderLeaflet(container, options);
          return;
        } catch (err) {
          this.switchToOffline(err?.message || "Leaflet map failed to initialize");
          return;
        }
      }
      if (this.mode !== "offline" && navigator.onLine) {
        this.forceOffline = true;
      }
    }

    if (this.forceOffline && this.currentNavigation && !this.currentNavigation.fallbackReason) {
      this.currentNavigation.fallbackReason = "Leaflet could not be loaded";
    }
    this.renderOffline(container, options);
  },

  route(start, destination) {
    const safeStart = { lat: finite(start?.lat, STARTING_POINTS[0].lat), lng: finite(start?.lng, STARTING_POINTS[0].lng) };
    const hospital = destination || { lat: 14.7011, lng: 120.983, available: 1 };
    const scenario = localTrafficScenario();

    const directRoute = makeRoute(safeStart, hospital, scenario, "", {}, "Primary local route");
    const originNode = closestNode(safeStart);
    const destinationNode = closestNode(hospital);
    const primaryPath = shortestPath(originNode, destinationNode, scenario);
    const congestedEdge = primaryPath.edges.reduce((slowest, edge) => {
      const currentSpeed = Math.max(10, finite(edge[3], 30) / finite(scenario.roads?.[edge[2]], 1));
      const slowestSpeed = slowest ? Math.max(10, finite(slowest[3], 30) / finite(scenario.roads?.[slowest[2]], 1)) : Infinity;
      return currentSpeed < slowestSpeed ? edge : slowest;
    }, null);
    let alternative = null;
    if (congestedEdge) {
      const excludedEdge = congestedEdge.slice(0, 2).sort().join(":");
      const alternatePath = shortestPath(originNode, destinationNode, scenario, excludedEdge);
      if (alternatePath.connected && alternatePath.edges.length) {
        alternative = makeRoute(safeStart, hospital, scenario, excludedEdge, {}, "Alternate local route");
      }
    }

    let primary = directRoute;
    let rerouted = false;
    let rerouteReason = "";

    if (this.autoReroute && directRoute.hasCongestion && alternative && alternative.eta < directRoute.eta) {
      primary = { ...alternative, label: "Rerouted around congestion" };
      alternative = { ...directRoute, label: "Congested corridor" };
      rerouted = true;
      rerouteReason = `Avoided congestion — saving ${Math.max(1, directRoute.eta - primary.eta)} min`;
    }

    const recommended = finite(hospital.available, 0) > 0 && hospital.status !== "Full / Diverting";
    return { primary, alternative, recommended, scenario, rerouted, rerouteReason, trafficMode: "offline" };
  },

  async calculateRoute(start, destination) {
    const request = ++this.routeCalculationToken;
    if (this.progressAnimation) cancelAnimationFrame(this.progressAnimation);
    this.progressAnimation = null;

    let result = this.route(start, destination);
    const safeStart = { lat: finite(start?.lat, STARTING_POINTS[0].lat), lng: finite(start?.lng, STARTING_POINTS[0].lng) };

    if (this.effectiveMode() === "free" && destination) {
      try {
        if (!(await this.loadLeaflet())) throw new Error("Leaflet could not be loaded");
        if (request !== this.routeCalculationToken) return result;
        const routes = await this.requestOsrmRoute(safeStart, destination);
        if (request !== this.routeCalculationToken) return result;
        const primary = { ...routes[0], label: "Fastest street route" };
        const alternative = routes[1] ? { ...routes[1], label: "Alternate street route" } : null;
        const rerouted = Boolean(this.autoReroute && primary.hasCongestion && alternative && alternative.eta < primary.eta);

        result = {
          ...result,
          primary: rerouted ? { ...alternative, label: "Rerouted (Less Congestion)" } : primary,
          alternative: rerouted ? { ...primary, label: "Congested route" } : alternative,
          rerouted,
          rerouteReason: rerouted
            ? `Rerouted around ${result.scenario.label} (${Math.max(1, primary.eta - alternative.eta)} min faster)`
            : "",
          source: "OSRM",
          trafficMode: "live"
        };
      } catch (error) {
        if (request !== this.routeCalculationToken) return result;
        this.forceOffline = true;
        result.source = "offline";
        result.fallbackReason = error?.name === "AbortError" ? "OSRM request timed out" : (error?.message || "Routing fallback");
      }
    } else {
      result.source = "offline";
    }

    if (request !== this.routeCalculationToken) return result;
    this.visualProgress = 0;
    this.currentNavigation = {
      ...result,
      start: safeStart,
      destination,
      progress: 0,
      step: 0,
      transportStatus: this.getTransportStatus(0)
    };

    if (this.leafletMap) {
      this.drawLeafletRoute();
    } else if (this.canvas) {
      this.drawCanvas();
    }

    return result;
  },

  renderLeaflet(container, options = {}) {
    const L = window.L;
    this.canvas = null;
    const scenario = localTrafficScenario();
    const trafficBadge = this.currentNavigation?.trafficMode === "live" ? "Live Traffic Active" : "Offline Estimate";
    const rerouteBanner = this.currentNavigation?.rerouted
      ? `<div class="reroute-pill">Rerouted · ${escapeHTML(this.currentNavigation.rerouteReason)}</div>`
      : "";

    container.innerHTML = `<div class="leaflet-map" role="application" aria-label="Valenzuela City street map"></div>
      <div class="map-top-bar">
        <span class="map-chip">CareRoute Nav · Valenzuela</span>
        <span class="map-chip traffic-status">${trafficBadge}</span>
        ${rerouteBanner}
      </div>
      <button type="button" class="map-recenter" aria-label="Re-center map">Re-center</button>
      ${this.trafficEnabled ? '<div class="traffic-key"><span><i class="traffic-dot smooth"></i>Smooth</span><span><i class="traffic-dot moderate"></i>Moderate</span><span><i class="traffic-dot heavy"></i>Heavy</span></div>' : ""}`;

    const mapElement = container.querySelector(".leaflet-map");
    const initial = options.start || this.currentNavigation?.start || { lat: 14.7011, lng: 120.983 };
    this.leafletMap = L.map(mapElement, { scrollWheelZoom: true, zoomControl: false }).setView([initial.lat, initial.lng], 13);
    L.control.zoom({ position: "bottomleft" }).addTo(this.leafletMap);
    container.querySelector(".map-recenter").addEventListener("click", () => this.recenter());

    const activeMap = this.leafletMap;
    this.vehicleMarker = null;
    this.visualProgress = finite(this.visualProgress ?? this.currentNavigation?.progress, 0);

    let tileErrors = 0;
    const tiles = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      subdomains: "abcd",
      attribution: "&copy; OpenStreetMap &copy; CARTO"
    });

    tiles.on("tileerror", () => {
      if (this.leafletMap !== activeMap) return;
      tileErrors += 1;
      if (tileErrors >= 4) {
        this.switchToOffline("Minimal basemap unavailable");
      }
    });

    tiles.addTo(activeMap);

    const hospitals = storageService.getHospitals();
    hospitals.forEach((hospital) => {
      const color = statusColor(hospital.status);
      const isSelected = this.currentNavigation?.destination?.id === hospital.id;
      const marker = L.marker([finite(hospital.lat, 14.7011), finite(hospital.lng, 120.983)], {
        icon: L.divIcon({
          className: `hospital-marker ${isSelected ? "is-selected" : ""}`,
          html: `<span class="hospital-marker-pin" style="--marker-color:${color}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z"/></svg></span><span class="hospital-marker-tag">${escapeHTML(hospital.code || hospital.name.split(" ")[0])}</span>`,
          iconSize: [72, 42],
          iconAnchor: [36, 36],
          popupAnchor: [0, -34]
        }),
        title: hospital.name,
        alt: `${hospital.name}, ${hospital.status}`
      }).bindPopup(
        `<strong>${escapeHTML(hospital.name)}</strong><br>${escapeHTML(hospital.status)} · ${finite(hospital.available, 0)}/${finite(hospital.total, 0)} ER beds`
      );

      marker.on("click", () => container.dispatchEvent(new CustomEvent("hospital:select", { detail: hospital })));
      marker.addTo(activeMap);
    });

    if (this.trafficEnabled && Array.isArray(scenario.hotspots)) {
      scenario.hotspots.forEach((spot) => {
        L.circleMarker([finite(spot.lat, 14.7011), finite(spot.lng, 120.983)], {
          radius: 10,
          color: "#FFFFFF",
          weight: 2,
          fillColor: "#EF4444",
          fillOpacity: 0.92
        })
          .bindTooltip(escapeHTML(spot.label), { permanent: false, direction: "top" })
          .addTo(activeMap);
      });
    }

    this.leafletRouteLayers = [];
    this.drawLeafletRoute();
  },

  drawLeafletRoute() {
    const L = window.L;
    const map = this.leafletMap;
    if (!L || !map) return;

    this.leafletRouteLayers.forEach((layer) => layer.remove());
    this.leafletRouteLayers = [];

    const result = this.currentNavigation;
    const scenario = localTrafficScenario();

    const addLine = (points, lineOptions) => {
      if (!Array.isArray(points) || points.length < 2) return null;
      const line = L.polyline(points.map((point) => [point.lat, point.lng]), lineOptions).addTo(map);
      this.leafletRouteLayers.push(line);
      return line;
    };

    if (result?.alternative?.points?.length > 1) {
      addLine(result.alternative.points, { color: "#64748B", weight: 5, opacity: 0.65, dashArray: "8 8" });
    }

    const route = result?.primary;
    if (route?.points?.length > 1) {
      addLine(route.points, { color: "#0284C7", weight: 7, opacity: 0.85 });

      if (this.trafficEnabled) {
        route.steps.forEach((step) => {
          if (!Array.isArray(step.points) || step.points.length < 2) return;
          const color = step.congestion === "Heavy" ? "#EF4444" : step.congestion === "Moderate" ? "#F59E0B" : "#10B981";
          addLine(step.points, { color, weight: 4, opacity: 0.95 });
        });
      }

      const bounds = L.latLngBounds(route.points.map((point) => [point.lat, point.lng]));
      if (bounds.isValid()) map.fitBounds(bounds.pad(0.14), { maxZoom: 15 });
    }

    const start = route?.points?.[0] || result?.start || this.options?.start;
    if (start) {
      const origin = L.circleMarker([finite(start.lat, 14.7011), finite(start.lng, 120.983)], {
        radius: 7,
        color: "#FFFFFF",
        weight: 2,
        fillColor: "#0F172A",
        fillOpacity: 1
      })
        .bindTooltip("Origin", { direction: "top" })
        .addTo(map);
      this.leafletRouteLayers.push(origin);
    }

    this.updateLeafletVehicle();
  },

  renderOffline(container) {
    this.cleanupActiveMap();
    const reason = this.currentNavigation?.fallbackReason;
    const rerouteBanner = this.currentNavigation?.rerouted
      ? `<div class="reroute-pill">Rerouted · ${escapeHTML(this.currentNavigation.rerouteReason)}</div>`
      : "";

    const trafficBadge = this.currentNavigation?.trafficMode === "live" ? "Live Traffic Active" : "Offline Estimate";
    container.innerHTML = `<canvas class="offline-canvas" aria-label="Valenzuela City navigation map"></canvas>
      <div class="map-top-bar">
        <span class="map-chip">Offline Valenzuela Grid${reason ? ` · ${escapeHTML(reason)}` : ""}</span>
        <span class="map-chip traffic-status">${trafficBadge}</span>
        ${rerouteBanner}
      </div>
      <button type="button" class="map-recenter" aria-label="Re-center map">Re-center</button>
      ${this.trafficEnabled ? '<div class="traffic-key"><span><i class="traffic-dot smooth"></i>Smooth</span><span><i class="traffic-dot moderate"></i>Moderate</span><span><i class="traffic-dot heavy"></i>Heavy</span></div>' : ""}`;

    const canvas = container.querySelector("canvas");
    this.canvas = canvas;
    container.querySelector(".map-recenter").addEventListener("click", () => this.recenter());
    this.visualProgress = finite(this.visualProgress ?? this.currentNavigation?.progress, 0);
    this.drawCanvas();

    if (this.markerListener) canvas.removeEventListener("click", this.markerListener);
    this.markerListener = (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const hospital = storageService.getHospitals().find((item) => {
        const point = this.project(item);
        return Math.hypot(point.x - x, point.y - y) < 24;
      });
      if (hospital) container.dispatchEvent(new CustomEvent("hospital:select", { detail: hospital }));
    };
    canvas.addEventListener("click", this.markerListener);
  },

  project(point) {
    const bounds = this.canvas?.getBoundingClientRect();
    const width = Math.max(320, bounds?.width || 900);
    const height = Math.max(300, bounds?.height || 510);
    const lng = finite(point?.lng, 120.983);
    const lat = finite(point?.lat, 14.7011);
    return {
      x: ((lng - 120.945) / 0.055) * width,
      y: ((14.738 - lat) / 0.076) * height
    };
  },

  drawCanvas() {
    if (!this.canvas) return;
    const canvas = this.canvas;
    const bounds = canvas.getBoundingClientRect();
    const dpr = Math.max(1, finite(window.devicePixelRatio, 1));
    const cssWidth = Math.max(320, bounds.width || 900);
    const cssHeight = Math.max(300, bounds.height || 510);

    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const width = cssWidth;
    const height = cssHeight;
    const scenario = localTrafficScenario();

    ctx.fillStyle = "#F1F5F9";
    ctx.fillRect(0, 0, width, height);

    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 9; col++) {
        const x = 22 + col * (width / 9);
        const y = 24 + row * (height / 7);
        ctx.fillStyle = (row + col) % 3 === 0 ? "#E2E8F0" : "#E8EEF5";
        ctx.fillRect(x, y, width / 14, height / 16);
      }
    }

    EDGES.forEach(([a, b, road]) => {
      const p1 = this.project(NODES[a]);
      const p2 = this.project(NODES[b]);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineWidth = road === "MacArthur Highway" || road === "NLEX" ? 7 : 4;
      ctx.strokeStyle = "#FFFFFF";
      ctx.stroke();

      if (this.trafficEnabled) {
        const factor = finite(scenario.roads?.[road], 1);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineWidth = factor > 1.45 ? 4 : 2.5;
        ctx.strokeStyle = factor > 1.45 ? "#EF4444" : factor > 1.1 ? "#F59E0B" : "#10B981";
        ctx.stroke();
      }
    });

    ctx.fillStyle = "#475569";
    ctx.font = "600 10px system-ui";
    [
      ["NLEX", 0.16, 0.16],
      ["Paso de Blas", 0.30, 0.36],
      ["Maysan Rd", 0.56, 0.22],
      ["MacArthur Hwy", 0.72, 0.56],
      ["Gov. I. Santiago St.", 0.34, 0.72]
    ].forEach(([name, x, y]) => ctx.fillText(name, width * x, height * y));

    const route = this.currentNavigation;
    if (route?.alternative?.points?.length > 1) {
      ctx.beginPath();
      route.alternative.points.forEach((point, index) => {
        const p = this.project(point);
        index ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
      });
      ctx.setLineDash([7, 7]);
      ctx.strokeStyle = "#64748B";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (route?.primary?.points?.length > 1) {
      ctx.beginPath();
      route.primary.points.forEach((point, index) => {
        const p = this.project(point);
        index ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
      });
      ctx.strokeStyle = "#0284C7";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }

    if (this.trafficEnabled && Array.isArray(scenario.hotspots)) {
      scenario.hotspots.forEach((spot) => {
        const p = this.project(spot);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(239, 68, 68, 0.22)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#EF4444";
        ctx.fill();
      });
    }

    storageService.getHospitals().forEach((hospital) => {
      const p = this.project(hospital);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = statusColor(hospital.status);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#FFFFFF";
      ctx.stroke();

      ctx.fillStyle = "#0F172A";
      ctx.font = "600 9.5px system-ui";
      ctx.fillText(hospital.code || hospital.name.split(" ")[0], p.x + 11, p.y + 3);
    });

    const start = route?.primary?.points?.[0] || this.options?.start || STARTING_POINTS[0];
    const origin = this.project(start);
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#0F172A";
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "700 9px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("A", origin.x, origin.y + 0.5);
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";

    if (route?.primary?.points?.length) {
      const marker = this.positionAt(route.primary.points, this.visualProgress ?? route.progress ?? 0);
      const p = this.project(marker);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
      ctx.fillStyle = "#0284C7";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#FFFFFF";
      ctx.stroke();
    }
  },

  positionAt(points, progress) {
    if (!Array.isArray(points) || points.length < 2) return points?.[0] || STARTING_POINTS[0];
    const lengths = points.slice(1).map((point, index) => distanceKm(points[index], point));
    const total = lengths.reduce((sum, length) => sum + length, 0);
    if (!total) return points[0];

    let remaining = clamp(progress, 0, 1) * total;
    for (let index = 0; index < lengths.length; index += 1) {
      if (remaining <= lengths[index] || index === lengths.length - 1) {
        const fraction = lengths[index] ? remaining / lengths[index] : 0;
        const a = points[index];
        const b = points[index + 1];
        return { lat: a.lat + (b.lat - a.lat) * fraction, lng: a.lng + (b.lng - a.lng) * fraction };
      }
      remaining -= lengths[index];
    }
    return points[points.length - 1];
  },

  updateProgress(progress) {
    if (!this.currentNavigation) return;
    const target = clamp(progress, 0, 1);
    const from = finite(this.visualProgress ?? this.currentNavigation.progress, 0);
    this.currentNavigation.progress = target;
    this.currentNavigation.transportStatus = this.getTransportStatus(target);

    if (this.progressAnimation) cancelAnimationFrame(this.progressAnimation);

    const started = performance.now();
    const duration = 850;
    const animate = (now) => {
      const fraction = Math.min(1, (now - started) / duration);
      this.visualProgress = from + (target - from) * fraction;
      if (this.effectiveMode() === "offline") this.drawCanvas();
      else this.updateLeafletVehicle();
      if (fraction < 1) this.progressAnimation = requestAnimationFrame(animate);
      else this.progressAnimation = null;
    };
    this.progressAnimation = requestAnimationFrame(animate);
  },

  updateLeafletVehicle() {
    const points = this.currentNavigation?.primary?.points;
    if (!points?.length || !this.leafletMap) return;
    const point = this.positionAt(points, this.visualProgress ?? this.currentNavigation.progress);
    if (!this.vehicleMarker) {
      this.vehicleMarker = window.L.circleMarker([point.lat, point.lng], {
        radius: 8,
        color: "#FFFFFF",
        weight: 2,
        fillColor: "#0284C7",
        fillOpacity: 1
      }).bindTooltip("Live CareRoute vehicle");
      this.vehicleMarker.addTo(this.leafletMap);
    } else {
      this.vehicleMarker.setLatLng([point.lat, point.lng]);
    }
  },

  recenter() {
    const routePoints = this.currentNavigation?.primary?.points;
    if (this.leafletMap && window.L) {
      if (routePoints?.length > 1) {
        const bounds = window.L.latLngBounds(routePoints.map((point) => [point.lat, point.lng]));
        if (bounds.isValid()) this.leafletMap.flyToBounds(bounds.pad(0.14), { maxZoom: 15, duration: 0.8 });
      } else {
        const point = this.currentNavigation?.start || this.options?.start || { lat: 14.7011, lng: 120.983 };
        this.leafletMap.flyTo([point.lat, point.lng], 14, { duration: 0.8 });
      }
    } else if (this.canvas) {
      this.drawCanvas();
    }
  },

  setTrafficEnabled(enabled) {
    this.trafficEnabled = Boolean(enabled);
    if (this.container?.isConnected) this.render(this.container, this.options || {});
  },

  setMode(mode) {
    this.mode = mode === "google" ? "free" : ["auto", "free", "offline"].includes(mode) ? mode : "auto";
    this.forceOffline = false;
  },

};

window.addEventListener("resize", () => {
  if (mapService.canvas) mapService.drawCanvas();
  if (mapService.leafletMap) mapService.leafletMap.invalidateSize();
});