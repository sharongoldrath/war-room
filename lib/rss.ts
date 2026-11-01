import { XMLParser } from 'fast-xml-parser';
import { campForOutlet, type Camp, type Lang, type Source } from './sources';

export type RawItem = {
  sourceId: string;
  outlet: string; // original publisher (for Google News: the real outlet)
  camp: Camp;
  lang: Lang;
  title: string;
  desc: string;
  link: string;
  t: number;
};

export type Health = { id: string; name: string; camp: Camp; ok: boolean; items: number; newest: number | null; ms: number; error?: string };

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', textNodeName: '#text' });
const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export const clean = (s: unknown) =>
  String((s as any)?.['#text'] ?? s ?? '')
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (_, e: string) =>
      e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e] ?? `&${e};`,
    )
    .replace(/\s+/g, ' ')
    .trim();

const MAX_AGE = 48 * 3600 * 1000; // drop stale items (some feeds serve year-old entries)
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';

async function fetchText(url: string, timeoutMs: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml, text/html;q=0.8, */*;q=0.5', 'Accept-Language': 'he,en;q=0.8,ar;q=0.6' }, next: { revalidate: 120 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (e: any) {
    throw new Error(e?.name === 'AbortError' ? 'timeout' : e?.cause?.code || e?.message || String(e));
  } finally {
    clearTimeout(t);
  }
}

function parseRss(xml: string, src: Source): RawItem[] {
  const doc = parser.parse(xml);
  const raw = doc?.rss?.channel?.item ?? doc?.feed?.entry ?? doc?.['rdf:RDF']?.item ?? [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.slice(0, 60).map((it: any) => {
    let title = clean(it.title);
    let outlet = src.name;
    let camp = src.camp;
    if (src.kind === 'gnews') {
      // Google News: "<headline> - <Outlet>", plus <source>Outlet</source>
      const so = clean(it.source);
      const cut = title.lastIndexOf(' - ');
      if (cut > 20) {
        outlet = so || title.slice(cut + 3);
        title = title.slice(0, cut);
      } else if (so) outlet = so;
    }
    const link = typeof it.link === 'string' ? it.link : it.link?.href ?? (Array.isArray(it.link) ? it.link[0]?.href : '') ?? '';
    const date = Date.parse(it.pubDate ?? it.published ?? it.updated ?? it['dc:date'] ?? '');
    // detect language from the headline script (a Hebrew Google News query can still return English titles)
    const lang: Lang = /[\u0590-\u05FF]/.test(title) ? 'he' : /[\u0600-\u06FF]/.test(title) ? 'ar' : /[a-z]/i.test(title) ? 'en' : src.lang;
    // unknown Google News outlets: infer camp from headline language
    if (src.kind === 'gnews') camp = campForOutlet(outlet, ({ he: 'il', ar: 'arab', en: 'west' } as const)[lang]);
    return {
      sourceId: src.id, outlet, camp, lang, title,
      desc: src.kind === 'gnews' ? '' : clean(it.description ?? it.summary ?? it['content:encoded'] ?? '').slice(0, 300),
      link: String(link || clean(it.guid)), t: isNaN(date) ? 0 : date,
    };
  });
}

function parseTelegram(html: string, src: Source): RawItem[] {
  const out: RawItem[] = [];
  const blocks = html.split('tgme_widget_message_wrap').slice(1);
  for (const b of blocks.slice(-40)) {
    const post = /data-post="([^"]+)"/.exec(b)?.[1];
    const text = /tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/.exec(b)?.[1];
    const dt = /<time[^>]+datetime="([^"]+)"/.exec(b)?.[1];
    if (!post || !text) continue;
    const body = clean(text.replace(/<br\s*\/?>/g, ' '));
    const lang: Lang = /[؀-ۿ]/.test(body) && !/[֐-׿]/.test(body) ? 'ar' : /[֐-׿]/.test(body) ? 'he' : 'en';
    out.push({ sourceId: src.id, outlet: src.name, camp: 'tg', lang, title: body.slice(0, 220), desc: body.length > 220 ? body.slice(220, 500) : '', link: `https://t.me/${post}`, t: dt ? Date.parse(dt) : 0 });
  }
  return out;
}

export async function fetchSource(src: Source, timeoutMs = 8000): Promise<{ items: RawItem[]; health: Health }> {
  const t0 = Date.now();
  try {
    const body = await fetchText(src.url, timeoutMs);
    const parsed = src.kind === 'telegram' ? parseTelegram(body, src) : parseRss(body, src);
    const now = Date.now();
    const items = parsed.filter((i) => i.title && i.link && i.t > 0 && now - i.t < MAX_AGE && i.t < now + 3600000);
    const newest = parsed.reduce((m, i) => Math.max(m, i.t), 0) || null;
    const stale = parsed.length > 0 && items.length === 0;
    return { items, health: { id: src.id, name: src.name, camp: src.camp, ok: !stale, items: items.length, newest, ms: Date.now() - t0, error: stale ? 'stale' : undefined } };
  } catch (e: any) {
    return { items: [], health: { id: src.id, name: src.name, camp: src.camp, ok: false, items: 0, newest: null, ms: Date.now() - t0, error: String(e?.message || e).slice(0, 80) } };
  }
}
