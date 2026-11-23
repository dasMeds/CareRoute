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

const TRAFFIC_SCENARIOS = {
  clear: { label: "Clear Corridors", factor: 1, roads: {} },
  malinta: { label: "MacArthur Hwy - Malinta Slowdown", factor: 1, roads: { "MacArthur Highway": 1.65 } },
  karuhatan: { label: "Karuhatan / NLEX Approach Bottleneck", factor: 1, roads: { "NLEX": 1.7, "MacArthur Highway": 1.3 } }
};

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.min(max, Math.max(min, finite(value, min)));
const statusColor = (status) => status === "Available" ? "#10B981" : status === "Moderate" ? "#F59E0B" : "#EF4444";

function distanceKm(a, b) {
  const lat = (finite(a?.lat, 14.7011) + finite(b?.lat, 14.7011)) / 2;
  const dy = (finite(a?.lat, 14.7011) - finite(b?.lat, 14.7011)) * 111.32;
  const dx = (finite(a?.lng, 120.983) - finite(b?.lng, 120.983)) * 111.32 * Math.cos(lat * Math.PI / 180);
  const result = Math.hypot(dx, dy);
  return Number.isFinite(result) ? result : 0.1;
}

function closestNode(point) {
  return Object.keys(NODES).reduce((closest, id) =>
    distanceKm(point, NODES[id]) < distanceKm(point, NODES[closest]) ? id : closest, Object.keys(NODES)[0]);
}

function shortestPath(from, to, scenario, excludedEdge = "") {
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
      const congestion = finite(scenario.roads[road], 1);
      const weight = km / Math.max(12, finite(speed, 30) / congestion);
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

function makeRoute(start, destination, scenario, excludedEdge = "") {
  const originNode = closestNode(start);
  const destinationNode = closestNode(destination);
  const path = shortestPath(originNode, destinationNode, scenario, excludedEdge);
  if (!path.connected) {
    const directDistance = Math.max(.2, distanceKm(start, destination) * 1.45);
    const eta = Math.max(1, Math.round(directDistance / 25 * 60));
    return {
      points: [
        { lat: finite(start?.lat, 14.7011), lng: finite(start?.lng, 120.983) },
        { lat: finite(destination?.lat, 14.7011), lng: finite(destination?.lng, 120.983) }
      ],
      segments: [{ road: "Local connector", distanceKm: directDistance, speedKmh: 25, from: start, to: destination, congestion: "Smooth" }],
      distanceKm: Number(directDistance.toFixed(2)),
      eta,
      speedKmh: Number((directDistance / (eta / 60)).toFixed(1)),
      steps: [{ maneuver: "depart", instruction: "Follow local roads toward the destination", road: "Local connector", distanceKm: Number(directDistance.toFixed(2)) }]
    };
  }
  const points = [start, ...path.nodes.map((id) => NODES[id]), destination];
  const segments = [];
  let totalKm = 0;
  let weightedMinutes = 0;
  path.edges.forEach(([a, b, road, speed]) => {
    const km = distanceKm(NODES[a], NODES[b]);
    const congestion = finite(scenario.roads[road], 1);
    const actualSpeed = Math.max(12, finite(speed, 30) / congestion);
    totalKm += km;
    weightedMinutes += km / actualSpeed * 60;
    segments.push({ road, distanceKm: km, speedKmh: actualSpeed, from: NODES[a], to: NODES[b], congestion: congestion > 1.45 ? "Heavy" : congestion > 1.1 ? "Moderate" : "Smooth" });
  });
  const connectors = distanceKm(start, NODES[originNode]) + distanceKm(destination, NODES[destinationNode]);
  totalKm += connectors;
  weightedMinutes += connectors / 25 * 60;
  if (!Number.isFinite(totalKm) || totalKm < 0.1) totalKm = Math.max(0.3, distanceKm(start, destination) * 1.35);
  const eta = Math.max(1, Math.round(finite(weightedMinutes, totalKm * 2.5)));
  if (!segments.length) {
    segments.push({ road: "Local connector", distanceKm: totalKm, speedKmh: totalKm / (eta / 60), from: start, to: destination, congestion: "Smooth" });
  }
  return {
    points: points.map((point) => ({ lat: finite(point.lat, 14.7011), lng: finite(point.lng, 120.983) })),
    segments,
    distanceKm: Number(totalKm.toFixed(2)),
    eta,
    speedKmh: Number((totalKm / Math.max(eta / 60, 1 / 60)).toFixed(1)),
    steps: segments.map((segment, index) => ({
      maneuver: index === 0 ? "depart" : "straight",
      instruction: `${index === 0 ? "Head along" : "Continue on"} ${segment.road}`,
      road: segment.road,
      distanceKm: Number(segment.distanceKm.toFixed(2))
    }))
  };
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function maneuverInstruction(type, modifier, road) {
  const direction = modifier ? ` ${modifier.replace(/-/g, " ")}` : "";
  const location = road ? ` onto ${road}` : "";
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
  return road ? `Continue on ${road}` : "Continue on the road";
}

function normalizeOsrmRoute(route) {
  const points = (route.geometry?.coordinates || [])
    .filter((coordinate) => Array.isArray(coordinate) && Number.isFinite(Number(coordinate[0])) && Number.isFinite(Number(coordinate[1])))
    .map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) }));
  const steps = (route.legs || []).flatMap((leg) => (leg.steps || []).map((step) => {
    const type = String(step.maneuver?.type || "continue");
    const modifier = String(step.maneuver?.modifier || "");
    const road = String(step.name || "Unnamed road");
    const meters = Math.max(0, finite(step.distance, 0));
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
      points: geometry
    };
  }));
  const distanceKm = Math.max(0.1, finite(route.distance, 0) / 1000);
  const eta = Math.max(1, Math.round(Math.max(0, finite(route.duration, 0)) / 60));
  const speedKmh = Number((distanceKm / (eta / 60)).toFixed(1));
  return {
    points: points.length ? points : [],
    segments: steps.map((step) => ({
      road: step.road,
      distanceKm: step.distanceKm,
      points: step.points
    })),
    distanceKm: Number(distanceKm.toFixed(2)),
    eta,
    speedKmh: Number.isFinite(speedKmh) ? speedKmh : 0,
    steps: steps.length ? steps : [{
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
  scenarios: TRAFFIC_SCENARIOS,
  mode: "auto",
  trafficEnabled: true,
  trafficScenario: "clear",
  animation: null,
  currentNavigation: null,
  markerListener: null,
  leafletLoader: null,
  forceOffline: false,
  effectiveMode() {
    return this.mode === "offline" || !navigator.onLine || this.forceOffline ? "offline" : "free";
  },
  async loadLeaflet() {
    if (window.L?.map) return true;
    if (!navigator.onLine) return false;
    if (this.leafletLoader) return this.leafletLoader;
    this.leafletLoader = new Promise((resolve) => {
      const finish = (loaded) => {
        clearTimeout(timeout);
        resolve(loaded);
      };
      const timeout = setTimeout(() => finish(false), 8000);
      const stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      stylesheet.onerror = () => {
        stylesheet.remove();
        finish(false);
      };
      document.head.appendChild(stylesheet);
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
      const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true&alternatives=true`, {
        signal: controller.signal,
        headers: { Accept: "application/json" }
      });
      if (!response.ok) throw new Error(`OSRM returned HTTP ${response.status}`);
      const payload = await response.json();
      if (payload.code !== "Ok" || !Array.isArray(payload.routes) || !payload.routes.length) {
        throw new Error(`OSRM route unavailable: ${payload.code || "no routes"}`);
      }
      const routes = payload.routes.map(normalizeOsrmRoute);
      if (routes[0].points.length < 2) throw new Error("OSRM returned no route geometry");
      return routes;
    } finally {
      clearTimeout(timeout);
    }
  },
  switchToOffline() {
    if (this.forceOffline) return;
    this.forceOffline = true;
    if (this.currentNavigation) this.currentNavigation.fallbackReason = "Map tile services unavailable";
    if (this.container?.isConnected) this.renderOffline(this.container, this.options || {});
  },
  async render(container, options = {}) {
    this.container = container;
    this.options = options;
    if (this.animation) cancelAnimationFrame(this.animation);
    this.animation = null;
    this.canvas = null;
    if (this.leafletMap) {
      this.leafletMap.remove();
      this.leafletMap = null;
    }
    if (this.effectiveMode() === "free" && await this.loadLeaflet()) {
      this.renderLeaflet(container, options);
      return;
    }
    if (this.mode !== "offline" && navigator.onLine && this.effectiveMode() === "free") this.forceOffline = true;
    if (this.forceOffline && this.currentNavigation && !this.currentNavigation.fallbackReason) {
      this.currentNavigation.fallbackReason = "Leaflet could not be loaded";
    }
    this.renderOffline(container, options);
  },
  route(start, destination, scenarioKey = this.trafficScenario) {
    const safeStart = { lat: finite(start?.lat, STARTING_POINTS[0].lat), lng: finite(start?.lng, STARTING_POINTS[0].lng) };
    const hospital = destination || { lat: 14.7011, lng: 120.983, available: 1 };
    const scenario = TRAFFIC_SCENARIOS[scenarioKey] || TRAFFIC_SCENARIOS.clear;
    const primary = makeRoute(safeStart, hospital, scenario);
    const alternative = makeRoute(safeStart, hospital, { label: scenario.label, roads: { ...scenario.roads, "Maysan Rd": 1.35 } });
    const recommended = hospital.available > 0 && hospital.status !== "Full / Diverting";
    return { primary, alternative, recommended, scenario };
  },
  async calculateRoute(start, destination) {
    if (this.progressAnimation) cancelAnimationFrame(this.progressAnimation);
    this.progressAnimation = null;
    let result = this.route(start, destination);
    const safeStart = { lat: finite(start?.lat, STARTING_POINTS[0].lat), lng: finite(start?.lng, STARTING_POINTS[0].lng) };
    if (this.effectiveMode() === "free" && destination) {
      try {
        if (!await this.loadLeaflet()) throw new Error("Leaflet could not be loaded");
        const routes = await this.requestOsrmRoute(safeStart, destination);
        result = {
          ...result,
          primary: routes[0],
          alternative: routes[1] || null,
          source: "OSRM"
        };
      } catch (error) {
        this.forceOffline = true;
        result.source = "offline";
        result.fallbackReason = error.name === "AbortError" ? "OSRM request timed out" : error.message;
      }
    } else {
      result.source = "offline";
    }
    this.visualProgress = 0;
    this.currentNavigation = { ...result, start: safeStart, destination, progress: 0, step: 0 };
    return result;
  },
  renderLeaflet(container, options = {}) {
    const L = window.L;
    this.canvas = null;
    container.innerHTML = `<div class="leaflet-map" role="application" aria-label="Valenzuela City street map"></div>
      <div class="map-overlay offline-badge">OPENSTREETMAP · CARTO POSITRON · OSRM</div>
      ${this.trafficEnabled ? '<div class="traffic-key"><span><i class="traffic-dot smooth"></i>Smooth</span><span><i class="traffic-dot moderate"></i>Moderate</span><span><i class="traffic-dot heavy"></i>Heavy</span></div>' : ""}`;
    const mapElement = container.querySelector(".leaflet-map");
    this.leafletMap = L.map(mapElement, { scrollWheelZoom: true }).setView([14.7011, 120.9830], 13);
    const activeMap = this.leafletMap;
    this.vehicleMarker = null;
    this.visualProgress = this.visualProgress ?? this.currentNavigation?.progress ?? 0;
    this.leafletTileFailures = 0;
    const carto = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 20,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    });
    const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });
    let usingOsmBackup = false;
    carto.on("tileerror", () => {
      if (usingOsmBackup || this.leafletMap !== activeMap) return;
      usingOsmBackup = true;
      carto.remove();
      this.leafletTileFailures = 0;
      osm.on("tileerror", () => {
        if (this.leafletMap !== activeMap) return;
        this.leafletTileFailures += 1;
        if (this.leafletTileFailures >= 3) this.switchToOffline();
      });
      osm.addTo(activeMap);
    });
    carto.addTo(this.leafletMap);
    const hospitals = storageService.getHospitals();
    hospitals.forEach((hospital) => {
      const color = statusColor(hospital.status);
      const marker = L.marker([finite(hospital.lat, 14.7011), finite(hospital.lng, 120.983)], {
        icon: L.divIcon({
          className: "hospital-marker",
          html: `<span class="hospital-marker-pin" style="--marker-color:${color}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z"/></svg></span>`,
          iconSize: [32, 38],
          iconAnchor: [16, 36],
          popupAnchor: [0, -34]
        }),
        title: hospital.name,
        alt: `${hospital.name}, ${hospital.status}`
      }).bindPopup(`<strong>${escapeHTML(hospital.name)}</strong><br>${escapeHTML(hospital.status)} · ${finite(hospital.available, 0)}/${finite(hospital.total, 0)} beds`);
      marker.on("click", () => container.dispatchEvent(new CustomEvent("hospital:select", { detail: hospital })));
      marker.addTo(this.leafletMap);
    });
    this.leafletRouteLayers = [];
    this.drawLeafletRoute();
    setTimeout(() => {
      if (this.leafletMap === activeMap && this.leafletTileFailures >= 3) this.switchToOffline();
    }, 12000);
  },
  drawLeafletRoute() {
    const L = window.L;
    const map = this.leafletMap;
    if (!L || !map) return;
    this.leafletRouteLayers.forEach((layer) => layer.remove());
    this.leafletRouteLayers = [];
    const result = this.currentNavigation;
    const addLine = (points, options) => {
      if (points?.length < 2) return null;
      const line = L.polyline(points.map((point) => [point.lat, point.lng]), options).addTo(map);
      this.leafletRouteLayers.push(line);
      return line;
    };
    if (result?.alternative?.points?.length > 1) {
      addLine(result.alternative.points, { color: "#F59E0B", weight: 5, opacity: 0.75, dashArray: "9 8" });
    }
    const route = result?.primary;
    if (route?.points?.length > 1) {
      addLine(route.points, { color: "#0284C7", weight: 8, opacity: 0.72 });
      if (this.trafficEnabled && result.source === "OSRM") {
        route.steps.forEach((step) => {
          if (step.points?.length < 2) return;
          const factor = finite((TRAFFIC_SCENARIOS[this.trafficScenario] || TRAFFIC_SCENARIOS.clear).roads[step.road], 1);
          const color = factor > 1.45 ? "#EF4444" : factor > 1.1 ? "#F59E0B" : "#10B981";
          addLine(step.points, { color, weight: 4, opacity: 0.95 });
        });
      }
      const bounds = L.latLngBounds(route.points.map((point) => [point.lat, point.lng]));
      if (bounds.isValid()) map.fitBounds(bounds.pad(0.14), { maxZoom: 15 });
    }
    const start = route?.points?.[0] || result?.start || this.options?.start;
    if (start) {
      const origin = L.circleMarker([start.lat, start.lng], {
        radius: 7, color: "#FFFFFF", weight: 2, fillColor: "#0F172A", fillOpacity: 1
      }).bindTooltip("Starting point", { direction: "top" }).addTo(map);
      this.leafletRouteLayers.push(origin);
    }
    this.updateLeafletVehicle();
  },
  renderOffline(container, options = {}) {
    if (this.leafletMap) {
      this.leafletMap.remove();
      this.leafletMap = null;
    }
    const reason = this.currentNavigation?.fallbackReason;
    container.innerHTML = `<canvas class="offline-canvas" aria-label="Valenzuela City navigation map"></canvas>
      <div class="map-overlay offline-badge">OFFLINE FALLBACK · VALENZUELA ROAD GRID${reason ? `<small>${escapeHTML(reason)}</small>` : ""}</div>
      ${this.trafficEnabled ? '<div class="traffic-key"><span><i class="traffic-dot smooth"></i>Smooth</span><span><i class="traffic-dot moderate"></i>Moderate</span><span><i class="traffic-dot heavy"></i>Heavy</span></div>' : ""}`;
    const canvas = container.querySelector("canvas");
    this.canvas = canvas;
    this.visualProgress = this.visualProgress ?? this.currentNavigation?.progress ?? 0;
    this.drawCanvas(options);
    if (this.markerListener) canvas.removeEventListener("click", this.markerListener);
    this.markerListener = (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const hospital = storageService.getHospitals().find((item) => {
        const point = this.project(item);
        return Math.hypot(point.x - x, point.y - y) < 22 * (canvas.getBoundingClientRect().width || 900) / 900;
      });
      if (hospital) container.dispatchEvent(new CustomEvent("hospital:select", { detail: hospital }));
    };
    canvas.addEventListener("click", this.markerListener);
  },
  project(point) {
    const canvas = this.canvas;
    const bounds = canvas?.getBoundingClientRect();
    const width = bounds?.width || 900;
    const height = bounds?.height || 540;
    const lng = finite(point?.lng, 120.983);
    const lat = finite(point?.lat, 14.7011);
    return {
      x: (lng - 120.945) / 0.05 * width,
      y: (14.736 - lat) / 0.07 * height
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
    ctx.scale(dpr, dpr);
    const width = cssWidth;
    const height = cssHeight;
    const project = (point) => ({
      x: (finite(point.lng, 120.983) - 120.945) / 0.05 * width,
      y: (14.736 - finite(point.lat, 14.7011)) / 0.07 * height
    });
    ctx.fillStyle = "#E8F0F3";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(255,255,255,.82)";
    ctx.lineWidth = 3;
    for (let x = 28; x < width; x += 74) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 8, height); ctx.stroke();
    }
    for (let y = 24; y < height; y += 62) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y + 5); ctx.stroke();
    }
    ctx.fillStyle = "#D5E6E9";
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 9; col++) {
        const x = 20 + col * (width / 9);
        const y = 16 + row * (height / 7);
        ctx.fillStyle = (row + col) % 3 === 0 ? "#DDE9E7" : "#E0E9EC";
        ctx.fillRect(x, y, width / 13, height / 15);
      }
    }
    ctx.beginPath();
    ctx.moveTo(width * 0.05, height * 0.84);
    ctx.bezierCurveTo(width * 0.3, height * 0.78, width * 0.44, height * 0.94, width * 0.68, height * 0.83);
    ctx.bezierCurveTo(width * 0.83, height * 0.77, width * 0.9, height * 0.84, width, height * 0.78);
    ctx.strokeStyle = "#A5D2DC"; ctx.lineWidth = 8; ctx.stroke();
    ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 6;
    EDGES.forEach(([a, b, road, speed]) => {
      const p1 = project(NODES[a]); const p2 = project(NODES[b]);
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
      ctx.lineWidth = road === "MacArthur Highway" || road === "NLEX" ? 7 : 4;
      ctx.strokeStyle = "#FFFFFF"; ctx.stroke();
      if (this.trafficEnabled) {
        const factor = finite((TRAFFIC_SCENARIOS[this.trafficScenario] || TRAFFIC_SCENARIOS.clear).roads[road], 1);
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
        ctx.lineWidth = road === "MacArthur Highway" || road === "NLEX" ? 3 : 2;
        ctx.strokeStyle = factor > 1.45 ? "#EF4444" : factor > 1.1 ? "#F59E0B" : "#10B981";
        ctx.stroke();
      }
    });
    ctx.fillStyle = "#475569";
    ctx.font = "bold 10px system-ui";
    [
      ["NLEX", .17, .2],
      ["Paso de Blas", .31, .4],
      ["Maysan Road", .57, .25],
      ["MacArthur Highway", .76, .58],
      ["Gov. I. Santiago St.", .36, .72]
    ].forEach(([name, x, y]) => ctx.fillText(name, width * x, height * y));
    const route = this.currentNavigation;
    if (route?.alternative?.points?.length > 1) {
      ctx.beginPath();
      route.alternative.points.forEach((point, index) => {
        const p = project(point);
        index ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
      });
      ctx.setLineDash([8, 6]); ctx.strokeStyle = "#F59E0B"; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]);
    }
    if (route?.primary?.points?.length > 1) {
      ctx.beginPath();
      route.primary.points.forEach((point, index) => {
        const p = project(point);
        index ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
      });
      ctx.strokeStyle = "#0284C7"; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
      const points = route.primary.points;
      if (points.length > 1) {
        const p1 = project(points[0]); const p2 = project(points[1]);
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const midX = (p1.x + p2.x) / 2; const midY = (p1.y + p2.y) / 2;
        ctx.save(); ctx.translate(midX, midY); ctx.rotate(angle);
        ctx.fillStyle = "#0F172A"; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.fill(); ctx.restore();
      }
    }
    storageService.getHospitals().forEach((hospital) => {
      const p = project(hospital);
      ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = statusColor(hospital.status); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#FFFFFF"; ctx.stroke();
    });
    const start = route?.primary?.points?.[0] || this.options?.start || STARTING_POINTS[0];
    const origin = project(start);
    ctx.beginPath(); ctx.arc(origin.x, origin.y, 7, 0, Math.PI * 2); ctx.fillStyle = "#0F172A"; ctx.fill();
    ctx.fillStyle = "#FFFFFF"; ctx.font = "bold 9px system-ui"; ctx.fillText("A", origin.x - 3, origin.y + 3);
    if (route?.primary?.points?.length) {
      const marker = this.positionAt(route.primary.points, this.visualProgress ?? route.progress ?? 0);
      const p = project(marker);
      ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.fillStyle = "#0284C7"; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = "#FFFFFF"; ctx.stroke();
    }
    ctx.fillStyle = "#334155"; ctx.font = "bold 10px system-ui";
    ctx.fillText("Valenzuela City · Not for emergency reliance", 12, height - 12);
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
        const a = points[index]; const b = points[index + 1];
        return { lat: a.lat + (b.lat - a.lat) * fraction, lng: a.lng + (b.lng - a.lng) * fraction };
      }
      remaining -= lengths[index];
    }
    return points[points.length - 1];
  },
  updateProgress(progress) {
    if (!this.currentNavigation) return;
    const target = clamp(progress, 0, 1);
    const from = this.visualProgress ?? this.currentNavigation.progress ?? 0;
    this.currentNavigation.progress = target;
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
        radius: 8, color: "#FFFFFF", weight: 2, fillColor: "#0284C7", fillOpacity: 1
      }).bindTooltip("Live CareRoute vehicle");
      this.vehicleMarker.addTo(this.leafletMap);
    } else this.vehicleMarker.setLatLng([point.lat, point.lng]);
  },
  setTrafficEnabled(enabled) {
    this.trafficEnabled = Boolean(enabled);
    this.container?.querySelector(".traffic-key")?.classList.toggle("hidden", !this.trafficEnabled);
    if (this.leafletMap) this.drawLeafletRoute();
    if (this.canvas) this.drawCanvas();
  },
  setScenario(scenario) {
    if (TRAFFIC_SCENARIOS[scenario]) {
      this.trafficScenario = scenario;
      if (this.canvas) this.drawCanvas();
      if (this.leafletMap) this.drawLeafletRoute();
    }
  },
  setMode(mode) {
    this.mode = mode === "google" ? "free" : ["auto", "free", "offline"].includes(mode) ? mode : "auto";
    this.forceOffline = false;
  },
  externalLink(hospital, origin) {
    const lat = finite(hospital?.lat, 14.7011); const lng = finite(hospital?.lng, 120.983);
    const originLat = finite(origin?.lat, STARTING_POINTS[0].lat); const originLng = finite(origin?.lng, STARTING_POINTS[0].lng);
    return {
      google: `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${lat},${lng}&travelmode=driving`,
      waze: `https://www.waze.com/ul?ll=${lat},${lng}&navigate=yes`
    };
  }
};

window.addEventListener("resize", () => {
  if (mapService.canvas) mapService.drawCanvas();
  if (mapService.leafletMap) mapService.leafletMap.invalidateSize();
});
