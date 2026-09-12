export const REGIONS = ['O’Higgins', 'Maule', 'Ñuble', 'Biobío', 'La Araucanía', 'Los Ríos', 'Los Lagos'];
export const STATUS_LABELS = { open: 'Abierto', closed: 'Cerrado', partial: 'Apertura parcial', unknown: 'Por confirmar' };
export const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, '');
export function distanceKm(a, b) {
  const rad = Math.PI / 180, dlat = (b[0]-a[0])*rad, dlng = (b[1]-a[1])*rad;
  const h = Math.sin(dlat/2)**2 + Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(dlng/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}
export function effectiveStatus(place, state, now = Date.now()) {
  const allowed=place.statusSourceIds ?? place.sources.map(s=>s.id);
  const observations = place.sources.filter(s=>allowed.includes(s.id)).map(s => state.observations[s.id]).filter(Boolean);
  // A failed refresh never makes a historical status current. An expired closure
  // becomes unknown, never open; retain its notice in the detail view.
  const reliable = observations.filter(o => o.ok && !isStale(o.checkedAt,now) && o.status !== 'unknown' && o.evidenceAt &&
    Date.parse(o.evidenceAt) <= now && (!o.validUntil || Date.parse(o.validUntil) >= now));
  if (!reliable.length) return 'unknown';
  const statuses = new Set(reliable.map(o => o.status));
  if (statuses.size > 1) return 'unknown';
  return reliable[0].status;
}
export function filterPlaces(places, filters, state, favorites, now = Date.now()) {
  const q = normalize(filters.query || '');
  return places.filter(p => (!q || normalize([p.name,p.locality,p.region,...p.highlights].join(' ')).includes(q)) &&
    (!filters.region || p.region === filters.region) && (!filters.kind || p.kind === filters.kind) &&
    (!filters.status || effectiveStatus(p,state,now) === filters.status) &&
    (!filters.service || p.services[filters.service] === true) &&
    (!filters.car || p.carAccess === 'yes') && (!filters.saved || favorites.has(p.id)));
}
export function safeExternalUrl(value) {
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; } catch { return null; }
}
export const isStale = (date, now = Date.now()) => !date || now - Date.parse(date) > 48 * 3600 * 1000;
