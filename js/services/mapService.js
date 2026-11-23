import { CONFIG } from "../config.js";
import { HOSPITALS } from "../data/hospitals.js";
import { storageService } from "./storageService.js";
import { icon } from "../../assets/icons.js";

const STARTING_POINTS = [
  { name: "Pamantasan ng Lungsod ng Valenzuela - Maysan Campus", lat: 14.7113, lng: 120.9734 },
  { name: "Karuhatan", lat: 14.6889, lng: 120.9810 },
  { name: "Malinta", lat: 14.6962, lng: 120.9808 },
  { name: "Marulas", lat: 14.6756, lng: 120.9822 },
  { name: "Malanday", lat: 14.7165, lng: 120.9617 }
];

const TRAFFIC_SCENARIOS = {
  clear: { label: "Clear Corridors", factor: 1, segments: [] },
  malinta: { label: "MacArthur Hwy - Malinta Slowdown", factor: 1.18, segments: ["mac"] },
  karuhatan: { label: "Karuhatan / NLEX Approach Congestion", factor: 1.28, segments: ["nlex", "karuhatan"] }
};

function statusColor(status) {
  if (status === "Available") return "#10B981";
  if (status === "Moderate") return "#F59E0B";
  return "#EF4444";
}

export const mapService = {
  hospitals: HOSPITALS,
  startingPoints: STARTING_POINTS,
  scenarios: TRAFFIC_SCENARIOS,
  googleReady: false,
  map: null,
  markers: [],
  renderer: null,
  trafficLayer: null,
  mode: "auto",
  trafficEnabled: true,
  trafficScenario: "clear",
  getHospitalData() {
    return storageService.getHospitals();
  },
  effectiveMode() {
    if (this.mode === "offline") return "offline";
    if (this.mode === "google") return CONFIG.googleMapsApiKey ? "google" : "offline";
    return CONFIG.googleMapsApiKey && navigator.onLine ? "google" : "offline";
  },
  loadGoogle() {
    return new Promise((resolve) => {
      if (!CONFIG.googleMapsApiKey || !navigator.onLine) return resolve(false);
      if (window.google?.maps) {
        this.googleReady = true;
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(CONFIG.googleMapsApiKey)}&libraries=routes,places`;
      script.async = true;
      script.onload = () => {
        this.googleReady = Boolean(window.google?.maps);
        resolve(this.googleReady);
      };
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  },
  async render(container, options = {}) {
    this.currentOptions = options;
    const mode = this.effectiveMode();
    container.innerHTML = "";
    if (mode === "google") {
      const loaded = await this.loadGoogle();
      if (loaded) return this.renderGoogle(container, options);
    }
    this.renderOffline(container, options);
  },
  renderGoogle(container, options) {
    container.innerHTML = "";
    this.map = new google.maps.Map(container, {
      center: CONFIG.valenzuelaCenter,
      zoom: 13,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true
    });
    this.markers.forEach((marker) => marker.setMap(null));
    this.markers = [];
    this.getHospitalData().forEach((hospital) => {
      const marker = new google.maps.Marker({
        position: { lat: hospital.lat, lng: hospital.lng },
        map: this.map,
        title: `${hospital.name}: ${hospital.status}`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: statusColor(hospital.status),
          fillOpacity: 1,
          strokeColor: "#FFFFFF",
          strokeWeight: 3,
          scale: 9
        }
      });
      marker.addListener("click", () => {
        container.dispatchEvent(new CustomEvent("hospital:select", { detail: hospital }));
      });
      this.markers.push(marker);
    });
    this.trafficLayer = new google.maps.TrafficLayer();
    if (this.trafficEnabled) this.trafficLayer.setMap(this.map);
    this.renderer = new google.maps.DirectionsRenderer({
      suppressMarkers: false,
      polylineOptions: { strokeColor: "#0284C7", strokeWeight: 6, strokeOpacity: 0.9 }
    });
    this.renderer.setMap(this.map);
    if (options.destination) this.calculateRoute(options.start, options.destination);
  },
  async calculateRoute(start, destination) {
    const hospitals = this.getHospitalData();
    const destinationHospital = hospitals.find((h) => h.id === destination.id) || destination;
    if (!destinationHospital || destinationHospital.available === 0) return this.routeResult(start, destinationHospital);
    if (this.effectiveMode() === "google" && window.google?.maps) {
      const service = new google.maps.DirectionsService();
      return new Promise((resolve) => {
        service.route({
          origin: { lat: start.lat, lng: start.lng },
          destination: { lat: destinationHospital.lat, lng: destinationHospital.lng },
          travelMode: google.maps.TravelMode.DRIVING,
          drivingOptions: { departureTime: new Date(), trafficModel: "bestguess" }
        }, (result, status) => {
          if (status !== "OK") return resolve(this.routeResult(start, destinationHospital));
          this.renderer.setDirections(result);
          const leg = result.routes[0].legs[0];
          const scenario = TRAFFIC_SCENARIOS[this.trafficScenario];
          const eta = Math.round((leg.duration_in_traffic?.value || leg.duration.value) / 60 * scenario.factor);
          const route = {
            distance: leg.distance.text,
            distanceMeters: leg.distance.value,
            eta,
            steps: leg.steps.map((step) => step.instructions.replace(/<[^>]*>/g, "")),
            scenario,
            mode: "google"
          };
          resolve(route);
        });
      });
    }
    return this.routeResult(start, destinationHospital);
  },
  routeResult(start, destination) {
    const latKm = 111;
    const lngKm = 111 * Math.cos(start.lat * Math.PI / 180);
    const distanceKm = Math.sqrt(
      (destination.lat - start.lat) * latKm ** 2 +
      (destination.lng - start.lng) * lngKm ** 2
    );
    const congestion = TRAFFIC_SCENARIOS[this.trafficScenario];
    const capacityPenalty = destination?.available > 0 ? 0 : 12;
    const eta = Math.round((distanceKm * 3.2 * congestion.factor) + capacityPenalty);
    return {
      distance: `${distanceKm.toFixed(1)} km`,
      distanceMeters: distanceKm * 1000,
      eta,
      steps: [
        "Head toward MacArthur Highway.",
        "Follow MacArthur Hwy toward the selected corridor.",
        "Continue via Maysan Rd or NLEX as indicated.",
        "Turn toward Paso de Blas / the destination facility.",
        "Arrive at the hospital ER entrance."
      ],
      scenario: congestion,
      mode: "offline"
    };
  },
  renderOffline(container, options = {}) {
    const width = 900;
    const height = 540;
    container.innerHTML = `<canvas class="offline-canvas" width="${width}" height="${height}" aria-label="Offline Valenzuela vector map"></canvas>
      <div class="map-overlay offline-badge">OFFLINE VECTOR MAP</div>
      ${this.trafficEnabled ? '<div class="traffic-key"><span><i class="traffic-dot smooth"></i>Smooth</span><span><i class="traffic-dot moderate"></i>Moderate</span><span><i class="traffic-dot heavy"></i>Heavy</span></div>' : ""}`;
    const canvas = container.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const project = (lat, lng) => ({
      x: (lng - 120.945) / (120.995 - 120.945) * width,
      y: (120.736 - lat) / (120.736 - 120.948) * height
    });

    ctx.fillStyle = "#EAF1F5";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#C8D4DC";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(40, 80); ctx.lineTo(840, 80); ctx.moveTo(40, 440); ctx.lineTo(840, 440); ctx.stroke();
    ctx.setLineDash([]);

    const roads = [
      [[120.955, 14.728], [120.980, 14.675]],
      [[120.958, 14.715], [120.985, 14.675]],
      [[120.967, 14.700], [120.988, 14.700]],
      [[120.952, 14.690], [120.977, 14.690]]
    ];
    roads.forEach((road, index) => {
      ctx.beginPath();
      road.forEach((point, i) => {
        const p = project(point[1], point[0]);
        i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
      });
      ctx.lineWidth = 8;
      ctx.strokeStyle = index === 0 ? "#10B981" : "#FFFFFF";
      ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#94A3B8";
      ctx.stroke();
    });

    ctx.fillStyle = "#475569";
    ctx.font = "12px system-ui";
    ctx.fillText("MacArthur Highway", 425, 400);
    ctx.fillText("NLEX", 470, 105);
    ctx.fillText("Paso de Blas", 280, 300);
    ctx.fillText("Gov. I. Santiago St.", 520, 250);

    if (this.trafficEnabled) {
      const segments = TRAFFIC_SCENARIOS[this.trafficScenario].segments;
      if (segments.length) {
        ctx.strokeStyle = segments.includes("nlex") ? "#EF4444" : "#F59E0B";
        ctx.lineWidth = 10;
        ctx.beginPath(); ctx.moveTo(450, 130); ctx.lineTo(610, 195); ctx.stroke();
      }
    }

    this.getHospitalData().forEach((hospital) => {
      const p = project(hospital.lat, hospital.lng);
      ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = statusColor(hospital.status); ctx.fill();
      ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = "#0F172A"; ctx.font = "bold 11px system-ui";
      ctx.fillText(hospital.name, p.x + 14, p.y - 8);
    });

    if (options.destination) {
      const p = project(options.destination.lat, options.destination.lng);
      ctx.beginPath(); ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
      ctx.strokeStyle = "#0284C7"; ctx.lineWidth = 3; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);
    }
  },
  setTrafficEnabled(enabled) {
    this.trafficEnabled = enabled;
    if (this.trafficLayer) {
      this.trafficLayer.setMap(enabled ? this.map : null);
    }
  },
  setScenario(scenario) {
    if (TRAFFIC_SCENARIOS[scenario]) this.trafficScenario = scenario;
  },
  setMode(mode) {
    this.mode = mode;
  },
  externalLink(hospital, origin) {
    const destination = `${hospital.lat},${hospital.lng}`;
    const google = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination}&travelmode=driving`;
    const waze = `https://www.waze.com/ul?ll=${destination}&navigate=yes`;
    return { google, waze };
  }
};
