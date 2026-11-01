import * as sat from 'satellite.js';

const rad = Math.PI / 180;

/** Night-side polygon (day/night terminator). */
export function nightPolygon(date = new Date()) {
  const d = date.getTime() / 86400000 + 2440587.5 - 2451545.0;
  const g = (357.529 + 0.98560028 * d) * rad;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
  const e = (23.439 - 0.00000036 * d) * rad;
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)) / rad;
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  let sunLon = ra - gmst * 15;
  sunLon = ((sunLon + 540) % 360) - 180;

  const ring: [number, number][] = [];
  for (let lon = -180; lon <= 180; lon += 2) {
    const ha = (lon - sunLon) * rad;
    const lat = Math.atan(-Math.cos(ha) / Math.tan(dec)) / rad;
    ring.push([lon, Math.max(-85, Math.min(85, lat))]);
  }
  const pole = dec > 0 ? -85 : 85;
  ring.push([180, pole], [-180, pole], ring[0]);
  return { type: 'Feature' as const, geometry: { type: 'Polygon' as const, coordinates: [ring] }, properties: {} };
}

export type Tle = { name: string; l1: string; l2: string; group: string };
export type SatRec = { name: string; group: string; rec: sat.SatRec };

export function toRecs(list: Tle[]): SatRec[] {
  const out: SatRec[] = [];
  for (const t of list) {
    try {
      out.push({ name: t.name, group: t.group, rec: sat.twoline2satrec(t.l1, t.l2) });
    } catch {}
  }
  return out;
}

function pos(rec: sat.SatRec, date: Date): [number, number, number] | null {
  const pv = sat.propagate(rec, date);
  const p = pv.position;
  if (!p || typeof p === 'boolean') return null;
  const gd = sat.eciToGeodetic(p as sat.EciVec3<number>, sat.gstime(date));
  return [sat.degreesLong(gd.longitude), sat.degreesLat(gd.latitude), gd.height];
}

export function satFeatures(recs: SatRec[], date = new Date()) {
  const features: any[] = [];
  for (const s of recs) {
    const p = pos(s.rec, date);
    if (!p || !isFinite(p[0]) || !isFinite(p[1])) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p[0], p[1]] },
      properties: { name: s.name, group: s.group, alt: Math.round(p[2]), iss: /ISS \(ZARYA\)/.test(s.name) ? 1 : 0 },
    });
  }
  return { type: 'FeatureCollection', features };
}

/** Ground track for the next `minutes`, split at the antimeridian. */
export function groundTrack(rec: sat.SatRec, minutes = 95, from = new Date()) {
  const lines: [number, number][][] = [[]];
  let prev: number | null = null;
  for (let m = 0; m <= minutes; m += 1) {
    const p = pos(rec, new Date(from.getTime() + m * 60000));
    if (!p) continue;
    if (prev != null && Math.abs(p[0] - prev) > 180) lines.push([]);
    lines[lines.length - 1].push([p[0], p[1]]);
    prev = p[0];
  }
  return { type: 'Feature' as const, geometry: { type: 'MultiLineString' as const, coordinates: lines }, properties: {} };
}
