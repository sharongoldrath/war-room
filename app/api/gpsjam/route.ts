import { cellToBoundary, cellToLatLng } from 'h3-js';
import { getText, json } from '@/lib/fetcher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GPSJam (gpsjam.org): daily share of aircraft reporting degraded GPS accuracy per H3 cell, derived from ADS-B.
// Published once a day for the previous UTC day, so this layer is daily, not live.
const BBOX = { w: 20, s: 10, e: 65, n: 45 };

export async function GET() {
  for (let back = 1; back <= 3; back++) {
    const day = new Date(Date.now() - back * 86400000).toISOString().slice(0, 10);
    try {
      const csv = await getText(`https://gpsjam.org/data/${day}-h3_4.csv`, 21600, 15000);
      const lines = csv.trim().split('\n');
      const head = lines.shift()!.split(',').map((h) => h.trim());
      const iHex = head.indexOf('hex'), iGood = head.findIndex((h) => /good/.test(h)), iBad = head.findIndex((h) => /bad/.test(h));
      if (iHex < 0 || iGood < 0 || iBad < 0) throw new Error('unexpected columns: ' + head.join(','));
      const features: any[] = [];
      for (const l of lines) {
        const c = l.split(',');
        const good = +c[iGood], bad = +c[iBad], total = good + bad;
        if (total < 5) continue;
        const pct = bad / total;
        if (pct < 0.02) continue;
        const [lat, lon] = cellToLatLng(c[iHex]);
        if (lon < BBOX.w || lon > BBOX.e || lat < BBOX.s || lat > BBOX.n) continue;
        const ring = cellToBoundary(c[iHex], true);
        ring.push(ring[0]);
        features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: { pct: Math.round(pct * 1000) / 10, n: total } });
      }
      return json({ type: 'FeatureCollection', features, day }, 21600);
    } catch (e: any) {
      if (back === 3) return json({ type: 'FeatureCollection', features: [], error: String(e?.message || e) }, 600);
    }
  }
  return json({ type: 'FeatureCollection', features: [] }, 600);
}
