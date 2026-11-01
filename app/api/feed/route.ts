import { json } from '@/lib/fetcher';
import { SOURCES, telegramSources } from '@/lib/sources';
import { fetchSource } from '@/lib/rss';
import { buildStories, enrich, pulse } from '@/lib/cluster';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Fetch → validate (age filter) → normalize → dedupe → geolocate → cluster into stories → score.
export async function GET() {
  const all = [...SOURCES, ...telegramSources()];
  const res = await Promise.all(all.map((s) => fetchSource(s)));
  const raw = res.flatMap((r) => r.items);
  const items = enrich(raw);
  const stories = buildStories(items);
  return json(
    {
      t: Date.now(),
      stories: stories.slice(0, 250),
      pulse: pulse(stories),
      health: res.map((r) => r.health),
      totals: { reports: items.length, outlets: new Set(items.map((i) => i.outlet)).size, stories: stories.length },
    },
    120,
  );
}
