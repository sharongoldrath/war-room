import { XMLParser } from 'fast-xml-parser';
import { getText, json } from '@/lib/fetcher';
import { geotag } from '@/lib/gazetteer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FEEDS: { id: string; name: string; url: string; lang: 'he' | 'en' }[] = [
  { id: 'ynet', name: 'ynet מבזקים', url: 'https://www.ynet.co.il/Integration/StoryRss1854.xml', lang: 'he' },
  { id: 'maariv', name: 'מעריב', url: 'https://www.maariv.co.il/Rss/RssFeedsMivzakiChadashot', lang: 'he' },
  { id: 'toi', name: 'Times of Israel', url: 'https://www.timesofisrael.com/feed/', lang: 'en' },
  { id: 'jpost', name: 'Jerusalem Post', url: 'https://www.jpost.com/rss/rssfeedsheadlines.aspx', lang: 'en' },
  { id: 'bbc', name: 'BBC Middle East', url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml', lang: 'en' },
  { id: 'aje', name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', lang: 'en' },
];

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
const strip = (s: any) =>
  String(s ?? '')
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

export async function GET() {
  const results = await Promise.allSettled(
    FEEDS.map(async (f) => {
      const xml = await getText(f.url, 90);
      const doc = parser.parse(xml);
      const raw = doc?.rss?.channel?.item ?? doc?.feed?.entry ?? [];
      const items = (Array.isArray(raw) ? raw : [raw]).slice(0, 30);
      return items.map((it: any) => {
        const title = strip(it.title?.['#text'] ?? it.title);
        const desc = strip(it.description ?? it.summary ?? '').slice(0, 280);
        const link = typeof it.link === 'string' ? it.link : it.link?.href ?? it.guid?.['#text'] ?? it.guid ?? '';
        const date = new Date(it.pubDate ?? it.published ?? it.updated ?? Date.now()).getTime();
        return { src: f.id, srcName: f.name, lang: f.lang, title, desc, link: String(link), t: isNaN(date) ? Date.now() : date, geo: geotag(`${title} ${desc}`) };
      });
    }),
  );
  const status: Record<string, boolean> = {};
  const items: any[] = [];
  results.forEach((r, i) => {
    status[FEEDS[i].id] = r.status === 'fulfilled';
    if (r.status === 'fulfilled') items.push(...r.value);
  });
  items.sort((a, b) => b.t - a.t);
  return json({ items: items.slice(0, 150), status }, 90);
}
