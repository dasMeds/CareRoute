import { CONFIG } from "../config.js";
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

export const mapService = {
  startingPoints: STARTING_POINTS,
  scenarios: TRAFFIC_SCENARIOS,
  mode: "auto",
  trafficEnabled: true,
  trafficScenario: "clear",
  animation: null,
  currentNavigation: null,
  markerListener: null,
  googleLoader: null,
  effectiveMode() {
    if (this.mode === "offline") return "offline";
    if (this.mode === "google" && CONFIG.googleMapsApiKey && navigator.onLine) return "google";
    return CONFIG.googleMapsApiKey && navigator.onLine && this.googleReady ? "google" : "offline";
  },
  async loadGoogle() {
    if (!CONFIG.googleMapsApiKey || !navigator.onLine) return false;
    if (window.google?.maps) return true;
    if (this.googleLoader) return this.googleLoader;
    this.googleLoader = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(CONFIG.googleMapsApiKey)}&libraries=geometry`;
      script.async = true;
      script.onload = () => resolve(Boolean(window.google?.maps));
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
    const loaded = await this.googleLoader;
    this.googleReady = loaded;
    return loaded;
  },
  async render(container, options = {}) {
    this.container = container;
    this.options = options;
    if (this.animation) cancelAnimationFrame(this.animation);
    this.animation = null;
    if (this.mode !== "offline" && CONFIG.googleMapsApiKey && navigator.onLine) await this.loadGoogle();
    if (this.effectiveMode() === "google") this.renderGoogle(container, options);
    else this.renderOffline(container, options);
  },
  route(start, destination, scenarioKey = this.trafficScenario) {
    const safeStart = { lat: finite(start?.lat, STARTING_POINTS[0].lat), lng: finite(start?.lng, STARTING_POINTS[0].lng) };
    const hospital = destination || { lat: 14.7011, lng: 120.983, available: 1 };
    const scenario = TRAFFIC_SCENARIOS[scenarioKey] || TRAFFIC_SCENARIOS.clear;
    const primary = makeRoute(safeStart, hospital, scenario);
    let alternative = null;
    if (primary.segments.length > 1) {
      const worst = primary.segments.reduce((best, segment) => segment.speedKmh < best.speedKmh ? segment : best);
      const edge = EDGES.find(([a, b, road]) => road === worst.road &&
        primary.points.some((point) => distanceKm(point, NODES[a]) < 0.02) &&
        primary.points.some((point) => distanceKm(point, NODES[b]) < 0.02));
      if (edge) {
        const detour = makeRoute(safeStart, hospital, TRAFFIC_SCENARIOS.clear, edge.slice(0, 2).sort().join(":"));
        if (detour.distanceKm > 0 && detour.points.length > 2) alternative = detour;
      }
    }
    if (!alternative) alternative = makeRoute(safeStart, hospital, { label: scenario.label, roads: { ...scenario.roads, "Maysan Rd": 1.35 } });
    const recommended = hospital.available > 0 && hospital.status !== "Full / Diverting";
    return { primary, alternative, recommended, scenario };
  },
  async calculateRoute(start, destination) {
    const result = this.route(start, destination);
    if (this.effectiveMode() === "google" && window.google?.maps && destination) {
      const service = new google.maps.DirectionsService();
      await new Promise((resolve) => {
        service.route({
          origin: { lat: finite(start?.lat, STARTING_POINTS[0].lat), lng: finite(start?.lng, STARTING_POINTS[0].lng) },
          destination: { lat: finite(destination.lat, 14.7011), lng: finite(destination.lng, 120.983) },
          travelMode: google.maps.TravelMode.DRIVING,
          drivingOptions: { departureTime: new Date(), trafficModel: "bestguess" }
        }, (response, status) => {
          if (status === "OK" && response?.routes?.[0]?.legs?.[0]) {
            const leg = response.routes[0].legs[0];
            const meters = finite(leg.distance?.value, result.primary.distanceKm * 1000);
            const seconds = finite(leg.duration_in_traffic?.value, finite(leg.duration?.value, result.primary.eta * 60));
            result.primary.distanceKm = Number((meters / 1000).toFixed(2));
            result.primary.eta = Math.max(1, Math.round(seconds / 60));
            result.primary.speedKmh = Number((result.primary.distanceKm / (result.primary.eta / 60)).toFixed(1));
            const routePoints = [];
            leg.steps.forEach((step) => {
              const startPoint = step.start_location;
              const endPoint = step.end_location;
              if (startPoint) routePoints.push({ lat: finite(startPoint.lat(), 14.7011), lng: finite(startPoint.lng(), 120.983) });
              if (endPoint) routePoints.push({ lat: finite(endPoint.lat(), 14.7011), lng: finite(endPoint.lng(), 120.983) });
            });
            if (routePoints.length) result.primary.points = routePoints;
            result.primary.steps = leg.steps.map((step) => ({
              maneuver: step.maneuver || "straight",
              instruction: String(step.instructions || "Continue to destination").replace(/<[^>]*>/g, ""),
              road: step.distance?.text || "Road",
              distanceKm: Number((finite(step.distance?.value, 0) / 1000).toFixed(2))
            }));
          }
          resolve();
        });
      });
    }
    this.currentNavigation = { ...result, start, destination, progress: 0, step: 0 };
    return result;
  },
  renderGoogle(container, options) {
    container.innerHTML = "";
    this.googleMap = new google.maps.Map(container, {
      center: CONFIG.valenzuelaCenter, zoom: 13, mapTypeControl: false, streetViewControl: false
    });
    this.googleTraffic = new google.maps.TrafficLayer();
    this.googleTraffic.setMap(this.trafficEnabled ? this.googleMap : null);
    this.googleSegmentLines = EDGES.map(([a, b, road]) => {
      const factor = finite((TRAFFIC_SCENARIOS[this.trafficScenario] || TRAFFIC_SCENARIOS.clear).roads[road], 1);
      return new google.maps.Polyline({
        map: this.googleMap,
        path: [NODES[a], NODES[b]],
        strokeColor: factor > 1.45 ? "#EF4444" : factor > 1.1 ? "#F59E0B" : "#10B981",
        strokeOpacity: this.trafficEnabled ? 0.8 : 0,
        strokeWeight: 3
      });
    });
    this.googleMarkers = [];
    storageService.getHospitals().forEach((hospital) => {
      const marker = new google.maps.Marker({
        map: this.googleMap,
        position: { lat: hospital.lat, lng: hospital.lng },
        title: `${hospital.name} - ${hospital.status}`,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: statusColor(hospital.status), fillOpacity: 1, strokeColor: "#FFFFFF", strokeWeight: 2 }
      });
      marker.addListener("click", () => container.dispatchEvent(new CustomEvent("hospital:select", { detail: hospital })));
      this.googleMarkers.push(marker);
    });
    const badge = document.createElement("div");
    badge.className = "map-overlay offline-badge";
    badge.textContent = "GOOGLE MAPS · Waze-style scoring by CareRoute";
    container.appendChild(badge);
    this.drawGoogleRoute(options);
  },
  drawGoogleRoute(options) {
    if (!window.google?.maps || !this.googleMap) return;
    if (this.googlePolylines) this.googlePolylines.forEach((line) => line.setMap(null));
    const result = this.currentNavigation;
    this.googlePolylines = [];
    if (result?.primary) {
      const line = new google.maps.Polyline({
        path: result.primary.points.map((p) => ({ lat: p.lat, lng: p.lng })),
        map: this.googleMap, strokeColor: "#0284C7", strokeOpacity: 0.95, strokeWeight: 6
      });
      this.googlePolylines.push(line);
    }
    if (result?.alternative) {
      const line = new google.maps.Polyline({
        path: result.alternative.points.map((p) => ({ lat: p.lat, lng: p.lng })),
        map: this.googleMap, strokeColor: "#F59E0B", strokeOpacity: 0.8, strokeWeight: 4, icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 }, offset: "0", repeat: "12px" }]
      });
      this.googlePolylines.push(line);
    }
    if (result?.primary?.points?.length) {
      const origin = result.primary.points[0];
      this.originMarker?.setMap(null);
      this.originMarker = new google.maps.Marker({ map: this.googleMap, position: origin, label: "A", title: "Starting point" });
    }
  },
  renderOffline(container, options = {}) {
    container.innerHTML = `<canvas class="offline-canvas" aria-label="Valenzuela City navigation map"></canvas>
      <div class="map-overlay offline-badge">OFFLINE VECTOR · Waze-style traffic & rerouting by CareRoute</div>
      ${this.trafficEnabled ? '<div class="traffic-key"><span><i class="traffic-dot smooth"></i>Smooth</span><span><i class="traffic-dot moderate"></i>Moderate</span><span><i class="traffic-dot heavy"></i>Heavy</span></div>' : ""}`;
    const canvas = container.querySelector("canvas");
    this.canvas = canvas;
    this.drawCanvas(options);
    if (this.markerListener) canvas.removeEventListener("click", this.markerListener);
    this.markerListener = (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width * canvas.width;
      const y = (event.clientY - rect.top) / rect.height * canvas.height;
      const hospital = storageService.getHospitals().find((item) => {
        const point = this.project(item);
        return Math.hypot(point.x - x, point.y - y) < 22 * canvas.width / 900;
      });
      if (hospital) container.dispatchEvent(new CustomEvent("hospital:select", { detail: hospital }));
    };
    canvas.addEventListener("click", this.markerListener);
  },
  project(point) {
    const canvas = this.canvas;
    const width = canvas?.width || 900;
    const height = canvas?.height || 540;
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
      const midX = (p1.x + p2.x) / 2; const midY = (p1.y + p2.y) / 2;
      ctx.fillStyle = "#475569"; ctx.font = "10px system-ui"; ctx.fillText(road, midX + 4, midY - 3);
    });
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
      ctx.fillStyle = "#0F172A"; ctx.font = "10px system-ui"; ctx.fillText(hospital.name, p.x + 10, p.y - 7);
    });
    const start = route?.primary?.points?.[0] || this.options?.start || STARTING_POINTS[0];
    const origin = project(start);
    ctx.beginPath(); ctx.arc(origin.x, origin.y, 7, 0, Math.PI * 2); ctx.fillStyle = "#0F172A"; ctx.fill();
    ctx.fillStyle = "#FFFFFF"; ctx.font = "bold 9px system-ui"; ctx.fillText("A", origin.x - 3, origin.y + 3);
    if (route?.primary?.points?.length) {
      const marker = this.positionAt(route.primary.points, route.progress || 0);
      const p = project(marker);
      ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.fillStyle = "#0284C7"; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = "#FFFFFF"; ctx.stroke();
    }
    ctx.fillStyle = "#334155"; ctx.font = "bold 10px system-ui";
    ctx.fillText("Valenzuela City · Not for emergency reliance", 12, height - 12);
  },
  positionAt(points, progress) {
    if (!Array.isArray(points) || points.length < 2) return points?.[0] || STARTING_POINTS[0];
    const amount = clamp(progress, 0, 1) * (points.length - 1);
    const index = Math.min(points.length - 2, Math.floor(amount));
    const fraction = amount - index;
    const a = points[index]; const b = points[index + 1];
    return { lat: a.lat + (b.lat - a.lat) * fraction, lng: a.lng + (b.lng - a.lng) * fraction };
  },
  updateProgress(progress) {
    if (!this.currentNavigation) return;
    this.currentNavigation.progress = clamp(progress, 0, 1);
    if (this.effectiveMode() === "offline") this.drawCanvas();
    else this.updateGoogleVehicle();
  },
  updateGoogleVehicle() {
    const points = this.currentNavigation?.primary?.points;
    if (!points?.length) return;
    const point = this.positionAt(points, this.currentNavigation.progress);
    if (!this.vehicleMarker) {
      this.vehicleMarker = new google.maps.Marker({
        map: this.googleMap,
        position: point,
        title: "Live CareRoute vehicle",
        icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 5, fillColor: "#0284C7", fillOpacity: 1, strokeColor: "#FFFFFF", strokeWeight: 2 }
      });
    } else this.vehicleMarker.setPosition(point);
  },
  setTrafficEnabled(enabled) {
    this.trafficEnabled = Boolean(enabled);
    if (this.googleTraffic && this.googleMap) this.googleTraffic.setMap(this.trafficEnabled ? this.googleMap : null);
    this.googleSegmentLines?.forEach((line) => line.setOptions({ strokeOpacity: this.trafficEnabled ? 0.8 : 0 }));
    if (this.canvas) this.drawCanvas();
  },
  setScenario(scenario) {
    if (TRAFFIC_SCENARIOS[scenario]) {
      this.trafficScenario = scenario;
      if (this.canvas) this.drawCanvas();
      if (this.googleSegmentLines && this.googleMap) {
        this.googleSegmentLines.forEach((line, index) => {
          const road = EDGES[index][2];
          const factor = finite(TRAFFIC_SCENARIOS[scenario].roads[road], 1);
          line.setOptions({
            strokeColor: factor > 1.45 ? "#EF4444" : factor > 1.1 ? "#F59E0B" : "#10B981",
            strokeOpacity: this.trafficEnabled ? 0.8 : 0
          });
        });
      }
    }
  },
  setMode(mode) {
    this.mode = ["auto", "google", "offline"].includes(mode) ? mode : "auto";
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
});
