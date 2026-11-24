import { icon } from "../../assets/icons.js";
import { storageService } from "../services/storageService.js";

export function renderAuth() {
  return `
    <section class="auth-page">
      <div class="auth-intro">
        <div class="auth-wordmark" aria-label="CareRoute">Care<span>Route</span></div>
        <h1>Sign in to CareRoute</h1>
        <p>Valenzuela City hospital capacity and patient navigation</p>
      </div>
      <div class="auth-form-wrap">
        <form id="signInForm" class="panel auth-form">
          <div class="panel-header"><div><h2>Sign in to your workspace</h2><small>Use the role assigned for this demonstration.</small></div>${icon("lock", 20)}</div>
          <div class="panel-body">
            <div class="field"><label for="authRole">Role</label>
              <select id="authRole" name="role" required>
                <option value="patient">Patient / Public User</option>
                <option value="rescue">Ambulance / LGU Rescue Team</option>
                <option value="admin">Hospital Administrator / Triage Staff</option>
              </select>
            </div>
            <div class="field"><label for="authAccount">Account / Badge / Email</label><input id="authAccount" name="account" autocomplete="username" required maxlength="80" placeholder="Enter your account"></div>
            <div class="field"><label for="authPasscode">Passcode</label>
              <div class="password-row"><input id="authPasscode" name="passcode" type="password" autocomplete="current-password" required maxlength="80" placeholder="Enter passcode"><button id="togglePassword" type="button" class="secondary-button" aria-label="Show passcode">Show</button></div>
            </div>
            <div class="field hidden" id="facilityField"><label for="authFacility">Assigned facility / rescue unit</label>
              <select id="authFacility" name="facility"></select>
            </div>
            <label class="acknowledgment"><input id="privacyAck" name="privacyAck" type="checkbox" required>
              <span>I acknowledge the RA 10173 privacy notice and HIPAA-inspired minimum-necessary safeguards. I will not enter patient identifiers or unnecessary details.</span>
            </label>
            <button type="submit" class="primary-button sign-in-button">Sign In</button>
            <button id="autofillCredentials" type="button" class="text-button">Autofill Credentials for evaluation</button>
            <p class="demo-hint">Evaluation passcode: <strong>demo123</strong>. Demo accounts are local-only and are not real authentication credentials.</p>
            <p class="privacy-notice-inline">This academic prototype is not an emergency service or a certified clinical system.</p>
          </div>
        </form>
      </div>
    </section>
  `;
}

export function initAuth(onSignIn) {
  const form = document.querySelector("#signInForm");
  const role = document.querySelector("#authRole");
  const facilityField = document.querySelector("#facilityField");
  const facility = document.querySelector("#authFacility");
  const facilities = {
    rescue: [
      ["lgu-rescue-01", "Valenzuela LGU Rescue Unit 01"],
      ["lgu-rescue-02", "Valenzuela LGU Rescue Unit 02"],
      ["valenzuela-ambulance", "Valenzuela Medical Center Ambulance"]
    ],
    admin: storageService.getHospitals().map((hospital) => [hospital.id, hospital.name])
  };
  const refreshFacility = () => {
    const options = facilities[role.value];
    facilityField.classList.toggle("hidden", !options);
    facility.required = Boolean(options);
    facility.innerHTML = (options || []).map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
  };
  role.addEventListener("change", refreshFacility);
  refreshFacility();
  document.querySelector("#togglePassword").addEventListener("click", (event) => {
    const input = document.querySelector("#authPasscode");
    const showing = input.type === "password";
    input.type = showing ? "text" : "password";
    event.currentTarget.textContent = showing ? "Hide" : "Show";
    event.currentTarget.setAttribute("aria-label", showing ? "Hide passcode" : "Show passcode");
  });
  document.querySelector("#autofillCredentials").addEventListener("click", () => {
    const roleDefaults = {
      patient: ["public.demo@careroute.local", "demo123"],
      rescue: ["VAL-RESCUE-01", "demo123"],
      admin: ["triage.demo@careroute.local", "demo123"]
    };
    const [account, passcode] = roleDefaults[role.value];
    document.querySelector("#authAccount").value = account;
    document.querySelector("#authPasscode").value = passcode;
    document.querySelector("#privacyAck").checked = true;
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form));
    if (data.passcode !== "demo123") {
      document.querySelector("#authPasscode").setCustomValidity("Use the demo passcode shown below.");
      document.querySelector("#authPasscode").reportValidity();
      document.querySelector("#authPasscode").setCustomValidity("");
      return;
    }
    onSignIn({
      role: data.role,
      account: data.account.trim(),
      facility: data.facility || ""
    });
  });
}
