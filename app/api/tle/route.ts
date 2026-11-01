import { getText, json } from '@/lib/fetcher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// CelesTrak TLE groups. Orbits are propagated client-side with satellite.js.
const GROUPS: Record<string, { group: string; limit: number }> = {
  stations: { group: 'stations', limit: 40 },
  gps: { group: 'gps-ops', limit: 40 },
  weather: { group: 'weather', limit: 80 },
  starlink: { group: 'starlink', limit: 600 },
};

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('g') || 'stations';
  const g = GROUPS[key];
  if (!g) return json({ error: 'unknown group' }, 60);
  try {
    const txt = await getText(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${g.group}&FORMAT=tle`, 21600, 20000);
    const lines = txt.split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean);
    const sats: { name: string; l1: string; l2: string }[] = [];
    for (let i = 0; i + 2 < lines.length + 1 && sats.length < g.limit; i += 3) {
      if (lines[i + 1]?.startsWith('1 ') && lines[i + 2]?.startsWith('2 ')) sats.push({ name: lines[i].trim(), l1: lines[i + 1], l2: lines[i + 2] });
    }
    return json({ group: key, sats }, 21600);
  } catch (e: any) {
    return json({ group: key, sats: [], error: String(e?.message || e) }, 300);
  }
}
