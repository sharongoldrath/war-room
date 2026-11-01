// Cross-referencing: groups reports about the same event into "stories" and scores how well-sourced each story is.
import { findPlaces, type Zone, type Level } from './gazetteer';
import { analyze, severityFromScore, tokens, type Category, type Severity } from './nlp';
import type { RawItem } from './rss';
import type { Camp } from './sources';

export type Item = RawItem & {
  id: string;
  places: string[]; // specific (city/region) place ids
  ents: string[]; // all places (except Israel itself) + actors, for cross-language matching
  zone: Zone | null;
  geo: [number, number] | null;
  level: Level | null;
  actors: string[];
  concepts: string[];
  category: Category;
  score: number;
  claim: boolean;
  noise: boolean;
  tok: Set<string>;
};

export type Verification = 'multi' | 'single' | 'unverified';

export type Story = {
  id: string;
  title: string;
  lang: string;
  category: Category;
  severity: Severity;
  verification: Verification;
  independent: number; // outlets after collapsing syndicated copies
  outlets: string[];
  camps: Partial<Record<Camp, number>>;
  zone: Zone | null;
  geo: [number, number] | null;
  level: Level | null;
  first: number;
  last: number;
  noise: boolean;
  claim: boolean;
  casualtyHint: boolean;
  reports: { outlet: string; camp: Camp; lang: string; title: string; link: string; t: number; syndicated: boolean }[];
};

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
};
const jac = (a: Set<string>, b: Set<string>) => {
  if (!a.size || !b.size) return 0;
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n / (a.size + b.size - n);
};
const inter = (a: string[], b: string[]) => a.filter((x) => b.includes(x));

export function enrich(raw: RawItem[]): Item[] {
  const seen = new Set<string>();
  const out: Item[] = [];
  for (const r of raw) {
    const norm = r.title.replace(/\s+/g, ' ').trim().toLowerCase();
    const k1 = r.link, k2 = `${r.outlet}|${norm}`;
    if (seen.has(k1) || seen.has(k2)) continue;
    seen.add(k1); seen.add(k2);
    const text = `${r.title} ${r.desc}`;
    const places = findPlaces(text);
    const specific = places.filter((p) => p.level !== 'country');
    const best = specific[0] ?? null;
    const a = analyze(text);
    out.push({
      ...r, id: hash(r.link), places: specific.map((p) => p.id),
      ents: [...places.filter((p) => p.id !== 'israel').map((p) => p.id), ...a.actors],
      zone: (best ?? places.find((p) => p.id !== 'israel') ?? places[0])?.zone ?? null,
      geo: best ? [best.lon, best.lat] : null, level: best?.level ?? null,
      actors: a.actors, concepts: a.concepts, category: a.category, score: a.score, claim: a.claim, noise: a.noise,
      tok: new Set(tokens(r.title)),
    });
  }
  return out;
}

const WINDOW = 6 * 3600 * 1000;

function related(a: Item, b: Item): boolean {
  if (a.noise || b.noise) return false;
  if (Math.abs(a.t - b.t) > WINDOW) return false;
  const sameLang = a.lang === b.lang;
  const tj = sameLang ? jac(a.tok, b.tok) : 0;
  if (tj >= 0.45) return true;
  if (a.category === 'other' || b.category === 'other' || a.category !== b.category) return tj >= 0.3 && a.category === b.category;
  const sharedPlace = inter(a.places, b.places).length > 0;
  const sharedConcept = inter(a.concepts, b.concepts);
  const sharedActor = inter(a.actors, b.actors);
  if (sharedPlace && (sharedConcept.length > 0 || sharedActor.length > 0)) return true;
  if (a.zone && a.zone === b.zone && sharedActor.length > 0 && sharedConcept.length > 0) return true;
  if (a.zone && a.zone === b.zone && sharedConcept.length >= 2) return true;
  if (sharedConcept.length >= 1 && inter(a.ents, b.ents).length >= 1) return true;
  return sameLang && tj >= 0.3 && a.zone === b.zone;
}

const LANG_PREF: Record<string, number> = { he: 0, en: 1, ar: 2 };
const mode = <T,>(xs: T[]): T | null => {
  const c = new Map<T, number>();
  xs.forEach((x) => c.set(x, (c.get(x) ?? 0) + 1));
  let best: T | null = null, n = 0;
  c.forEach((v, k) => { if (v > n) { n = v; best = k; } });
  return best;
};

export function buildStories(items: Item[]): Story[] {
  const sorted = [...items].sort((a, b) => a.t - b.t);
  const parent = sorted.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < sorted.length; i++)
    for (let j = i + 1; j < sorted.length && sorted[j].t - sorted[i].t <= WINDOW; j++)
      if (related(sorted[i], sorted[j])) parent[find(j)] = find(i);

  const groups = new Map<number, Item[]>();
  sorted.forEach((it, i) => {
    const r = find(i);
    groups.set(r, [...(groups.get(r) ?? []), it]);
  });

  const stories: Story[] = [];
  for (const g of groups.values()) {
    // syndication: a report that near-duplicates an earlier one from another outlet is not independent
    const reports = g.map((it, idx) => {
      const syndicated = g.slice(0, idx).some((p) => p.outlet !== it.outlet && p.lang === it.lang && jac(p.tok, it.tok) >= 0.75);
      return { it, syndicated };
    });
    const outlets = [...new Set(g.map((i) => i.outlet))];
    const independentOutlets = new Set(reports.filter((r) => !r.syndicated).map((r) => r.it.outlet));
    const independent = independentOutlets.size;
    const camps: Partial<Record<Camp, number>> = {};
    for (const o of outlets) {
      const c = g.find((i) => i.outlet === o)!.camp;
      camps[c] = (camps[c] ?? 0) + 1;
    }
    const nonTg = g.filter((i) => i.camp !== 'tg');
    const claimShare = g.filter((i) => i.claim).length / g.length;
    let verification: Verification = independent >= 2 ? 'multi' : 'single';
    if (nonTg.length === 0 || (independent === 1 && claimShare > 0) || claimShare === 1) verification = 'unverified';

    const cats = g.map((i) => i.category).filter((c) => c !== 'other');
    const category = (mode(cats) ?? 'other') as Category;
    let score = Math.max(...g.map((i) => i.score));
    if (independent >= 3 && category === 'security') score += 1;

    const lead = [...g]
      .filter((i) => !i.noise)
      .sort((a, b) => (LANG_PREF[a.lang] - LANG_PREF[b.lang]) || (b.score - a.score) || (b.t - a.t))[0] ?? g[g.length - 1];
    const geoItem = g.find((i) => i.places[0] === mode(g.flatMap((x) => x.places.slice(0, 1)))) ?? g.find((i) => i.geo);

    stories.push({
      id: hash(g[0].link),
      title: lead.title,
      lang: lead.lang,
      category,
      severity: severityFromScore(score),
      verification,
      independent,
      outlets,
      camps,
      zone: (mode(g.map((i) => i.zone).filter(Boolean)) as Zone) ?? null,
      geo: geoItem?.geo ?? null,
      level: geoItem?.level ?? null,
      first: g[0].t,
      last: g[g.length - 1].t,
      noise: g.every((i) => i.noise),
      claim: claimShare >= 0.5,
      casualtyHint: g.some((i) => i.concepts.includes('killed')),
      reports: reports
        .map(({ it, syndicated }) => ({ outlet: it.outlet, camp: it.camp, lang: it.lang, title: it.title, link: it.link, t: it.t, syndicated }))
        .reverse()
        .slice(0, 30),
    });
  }
  const sev = { critical: 3, high: 2, medium: 1, low: 0 };
  return stories.sort((a, b) => b.last - a.last || sev[b.severity] - sev[a.severity]);
}

/** Per-zone activity: security stories in the last 24h, bucketed hourly. Derived only from fetched reports. */
export function pulse(stories: Story[], now = Date.now()) {
  const zones: Record<string, { total: number; critical: number; hours: number[] }> = {};
  for (const s of stories) {
    if (!s.zone || s.category !== 'security' || s.noise) continue;
    const age = now - s.last;
    if (age > 24 * 3600 * 1000 || age < 0) continue;
    const z = (zones[s.zone] ??= { total: 0, critical: 0, hours: Array(24).fill(0) });
    z.total++;
    if (s.severity === 'critical' || s.severity === 'high') z.critical++;
    z.hours[23 - Math.min(23, Math.floor(age / 3600000))]++;
  }
  return zones;
}
