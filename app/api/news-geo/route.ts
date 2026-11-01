import { getJSON, json } from '@/lib/fetcher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GDELT GEO 2.0 — locations mentioned in global news near the query terms (media mentions, not verified events).
const QUERY =
  '(israel OR gaza OR lebanon OR hezbollah OR iran OR syria OR yemen OR houthi OR iraq OR "west bank") (strike OR attack OR missile OR drone OR rocket OR explosion OR killed OR clashes OR airstrike)';

function parseLinks(html: string) {
  const out: { url: string; title: string }[] = [];
  const re = /<a href="([^"]+)"[^>]*title="([^"]*)"[^>]*>|<a href="([^"]+)"[^>]*>([^<]*)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 6) {
    const url = m[1] || m[3];
    const title = (m[2] || m[4] || '').trim();
    if (url) out.push({ url, title: title || new URL(url).hostname });
  }
  return out;
}

export async function GET(req: Request) {
  const span = new URL(req.url).searchParams.get('span') || '24h';
  const timespan = ['6h', '24h', '72h'].includes(span) ? span : '24h';
  const url =
    'https://api.gdeltproject.org/api/v2/geo/geo?' +
    new URLSearchParams({ query: QUERY, mode: 'PointData', format: 'GeoJSON', timespan, maxpoints: '400' });
  try {
    const data = await getJSON<any>(url, 600, 20000);
    const features = (data.features || [])
      .filter((f: any) => f.geometry?.coordinates)
      .map((f: any) => ({
        type: 'Feature',
        geometry: f.geometry,
        properties: {
          name: f.properties?.name || '',
          count: f.properties?.count || 1,
          links: JSON.stringify(parseLinks(f.properties?.html || '')),
        },
      }));
    return json({ type: 'FeatureCollection', features }, 600);
  } catch (e: any) {
    return json({ type: 'FeatureCollection', features: [], error: String(e?.message || e) }, 60);
  }
}
