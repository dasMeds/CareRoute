const icons = {
  hospital: '<path d="M12 2v20M2 12h20"/><rect x="3" y="4" width="18" height="16" rx="2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 6.5-6 8-6s6.5 2 8 6"/>',
  ambulance: '<path d="M3 17V6h11v11M14 9h4l3 4v4h-7"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 9v6M5 12h6"/>',
  shield: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z"/><path d="M9 12l2 2 4-4"/>',
  map: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6zM9 3v15M15 6v15"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  audit: '<path d="M8 3h8l4 4v14H4V3h4z"/><path d="M16 3v5h5M8 12h8M8 16h8"/>',
  route: '<circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/><path d="M7 19h4a4 4 0 0 0 4-4v-6a4 4 0 0 1 4-4"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'
};

export function icon(name, size = 20) {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[name] || icons.hospital}</svg>`;
}
