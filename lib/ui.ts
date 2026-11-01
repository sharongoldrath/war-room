// Shared client-side types and visual constants.
import type { Camp } from './sources';
import type { Category, Severity } from './nlp';
import type { Zone } from './gazetteer';

export type Report = { outlet: string; camp: Camp; lang: string; title: string; link: string; t: number; syndicated: boolean };
export type Story = {
  id: string; title: string; lang: string; category: Category; severity: Severity;
  verification: 'multi' | 'single' | 'unverified'; independent: number; outlets: string[];
  camps: Partial<Record<Camp, number>>; zone: Zone | null; geo: [number, number] | null; level: string | null;
  first: number; last: number; noise: boolean; claim: boolean; casualtyHint: boolean; reports: Report[];
};
export type Health = { id: string; name: string; camp: Camp; ok: boolean; items: number; newest: number | null; ms: number; error?: string };
export type Pulse = Partial<Record<Zone, { total: number; critical: number; hours: number[] }>>;
export type FeedResponse = { t: number; stories: Story[]; pulse: Pulse; health: Health[]; totals: { reports: number; outlets: number; stories: number } };
export type Alert = { t: number; cities: string[]; title: string };

export const SEV_COLOR: Record<Severity, string> = { critical: '#ff2d55', high: '#ff7a1a', medium: '#ffc233', low: '#6f8799' };
export const CAMP_COLOR: Record<Camp, string> = { il: '#4da3ff', west: '#c9d4dd', arab: '#3ddc97', iran: '#ff6b6b', tg: '#b48cff' };

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function ago(t: number, now = Date.now()) {
  const s = Math.max(0, (now - t) / 1000);
  if (s < 60) return 'עכשיו';
  if (s < 3600) return `לפני ${Math.floor(s / 60)} דק׳`;
  if (s < 86400) return `לפני ${Math.floor(s / 3600)} שע׳`;
  return `לפני ${Math.floor(s / 86400)} ימים`;
}

/** Only allow http(s) links from external feeds. */
export const safeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : '#');
