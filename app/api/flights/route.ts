import { getJSON, json } from '@/lib/fetcher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// adsb.lol open API (no key). Max radius per query = 250nm, so we tile the region.
const POINTS: [number, number][] = [
  [32.0, 35.0], // Israel
  [34.5, 37.5], // Lebanon / Syria
  [33.5, 31.0], // East Med / Cyprus
  [33.0, 43.5], // Iraq
  [32.0, 51.5], // Iran
  [26.0, 51.0], // Gulf
  [21.0, 39.0], // Red Sea / Saudi
  [15.5, 44.0], // Yemen
  [29.5, 31.0], // Egypt
  [38.5, 35.0], // Turkey
];


type Ac = {
  hex: string; flight?: string; r?: string; t?: string; lat?: number; lon?: number;
  alt_baro?: number | 'ground'; gs?: number; track?: number; dbFlags?: number; squawk?: string; category?: string;
};

export async function GET() {
  // Civilian aviation only (per project spec): aircraft flagged military by the network are excluded.
  const urls = POINTS.map(([la, lo]) => `https://api.adsb.lol/v2/lat/${la}/lon/${lo}/dist/250`);
  const results = await Promise.allSettled(urls.map((u) => getJSON<{ ac?: Ac[] }>(u, 10)));

  const seen = new Map<string, any>();
  let ok = 0;
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    ok++;
    for (const a of r.value.ac || []) {
      if (a.lat == null || a.lon == null || seen.has(a.hex)) continue;
      if (((a.dbFlags ?? 0) & 1) === 1) continue;
      const emerg = a.squawk === '7500' || a.squawk === '7600' || a.squawk === '7700';
      seen.set(a.hex, {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [a.lon, a.lat] },
        properties: {
          hex: a.hex,
          cs: (a.flight || '').trim() || a.r || a.hex,
          reg: a.r || '',
          ac: a.t || '',
          alt: a.alt_baro === 'ground' ? 0 : a.alt_baro ?? null,
          gs: a.gs != null ? Math.round(a.gs) : null,
          trk: a.track ?? 0,
          sq: a.squawk || '',
          kind: emerg ? 'emerg' : 'civ',
        },
      });
    }
  }
  return json(
    { type: 'FeatureCollection', features: [...seen.values()], meta: { sources: ok, of: urls.length, t: Date.now() } },
    10,
  );
}
