import { getJSON, json } from '@/lib/fetcher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// IODA (Georgia Tech Internet Outage Detection & Analysis): per-country outage summary for the last 24h.
// Public API, no key. The response is parsed defensively; any shape mismatch is reported as an error, never filled in.
const CENTROIDS: Record<string, [number, number, string]> = {
  IL: [34.9, 31.4, 'ישראל'], PS: [35.0, 31.9, 'פלסטין'], LB: [35.8, 33.9, 'לבנון'], SY: [38.5, 35.0, 'סוריה'],
  JO: [36.3, 31.2, 'ירדן'], EG: [30.8, 26.8, 'מצרים'], IQ: [43.7, 33.2, 'עיראק'], IR: [53.7, 32.4, 'איראן'],
  YE: [47.5, 15.6, 'תימן'], SA: [45.0, 24.0, 'סעודיה'], AE: [54.3, 24.0, 'איחוד האמירויות'], QA: [51.2, 25.3, 'קטאר'],
  KW: [47.6, 29.3, 'כווית'], BH: [50.6, 26.0, 'בחריין'], OM: [57.0, 21.0, 'עומאן'], TR: [35.2, 39.0, 'טורקיה'],
  CY: [33.2, 35.0, 'קפריסין'], LY: [17.2, 26.3, 'לוב'], SD: [30.2, 15.6, 'סודן'], AF: [66.0, 33.9, 'אפגניסטן'],
  PK: [69.3, 30.4, 'פקיסטן'], UA: [31.2, 49.0, 'אוקראינה'], RU: [38.0, 55.0, 'רוסיה'], AM: [45.0, 40.1, 'ארמניה'],
  AZ: [47.6, 40.1, 'אזרבייג׳ן'], GE: [43.4, 42.3, 'גאורגיה'], ET: [40.5, 9.1, 'אתיופיה'], SO: [46.2, 5.2, 'סומליה'],
};

export async function GET() {
  const until = Math.floor(Date.now() / 1000);
  const from = until - 86400;
  try {
    const body = await getJSON<any>(`https://api.ioda.inetintel.cc.gatech.edu/v2/outages/summary?from=${from}&until=${until}&entityType=country&limit=200`, 600, 15000);
    const rows: any[] = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
    if (!rows.length && !Array.isArray(body?.data)) throw new Error('unexpected response shape');
    const features = rows
      .map((r) => {
        const code = String(r?.entity?.code ?? '').toUpperCase();
        const c = CENTROIDS[code];
        const score = Number(r?.scores?.overall ?? 0);
        if (!c || !(score > 0)) return null;
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [c[0], c[1]] },
          properties: { code, name: c[2], score: Math.round(score), events: Number(r?.event_cnt ?? 0), log: Math.log10(score + 1) },
        };
      })
      .filter(Boolean);
    return json({ type: 'FeatureCollection', features, window: [from, until] }, 600);
  } catch (e: any) {
    return json({ type: 'FeatureCollection', features: [], error: String(e?.message || e) }, 300);
  }
}
