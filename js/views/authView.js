import { icon } from "../../assets/icons.js";

export function renderAuth(onLogin) {
  return `
    <section class="auth-page">
      <div class="auth-intro">
        <h1>Valenzuela Hospital Capacity Portal</h1>
        <p>Capacity visibility, pre-arrival readiness, and coordinated patient navigation for clinical and public users.</p>
      </div>
      <div class="role-grid">
        ${roleCard("patient", "Patient / Public User", "Search accepting hospitals, submit basic self-triage, and view one route to a facility.", "user")}
        ${roleCard("rescue", "Ambulance / LGU Rescue", "Coordinate dispatch, digital triage, diversion checks, and live transport status.", "ambulance")}
        ${roleCard("admin", "Hospital Administrator", "Update ER capacity, manage inbound anticipation, and inspect the compliance audit trail.", "hospital")}
      </div>
      <div class="privacy-notice">
        <div class="notice"><strong>Philippine privacy notice:</strong> This prototype follows RA 10173 data minimization concepts and uses generated transaction numbers. Do not enter government IDs, full addresses, or sensitive clinical narratives.</div>
        <div class="notice"><strong>Clinical notice:</strong> RA 11223, DOH NPNRS principles, and HIPAA safeguard concepts inform this academic demonstration. It is not emergency dispatch advice or a certified clinical system.</div>
      </div>
    </section>
  `;
}

function roleCard(role, title, copy, iconName) {
  return `
    <article class="role-card">
      <div>
        <div class="role-icon">${icon(iconName, 24)}</div>
        <h2>${title}</h2>
        <p>${copy}</p>
      </div>
      <div class="field" style="margin-top:16px">
        <label for="pass-${role}">Demo passcode</label>
        <input id="pass-${role}" type="password" autocomplete="off" placeholder="Enter passcode" data-role-pass="${role}">
      </div>
      <button type="button" class="primary-button" data-demo-login="${role}" style="margin-top:10px">Open demo workspace</button>
    </article>
  `;
}
