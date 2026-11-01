import { json } from '@/lib/fetcher';
import { normalizeAlerts, TZEVAADOM_URL } from '@/lib/alerts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function tryFetch(url: string, headers: Record<string, string>) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers, cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const txt = (await r.text()).replace(/^﻿/, '').trim();
    return txt ? JSON.parse(txt) : [];
  } finally {
    clearTimeout(t);
  }
}

export async function GET() {
  const errors: string[] = [];
  const attempts: [string, string, Record<string, string>][] = [
    ['oref', 'https://www.oref.org.il/warningMessages/alert/History/AlertsHistory.json', { Referer: 'https://www.oref.org.il/', 'X-Requested-With': 'XMLHttpRequest', 'User-Agent': 'Mozilla/5.0' }],
    ['tzevaadom', TZEVAADOM_URL, { 'User-Agent': 'Mozilla/5.0' }],
  ];
  for (const [name, url, headers] of attempts) {
    try {
      const alerts = normalizeAlerts(await tryFetch(url, headers));
      if (alerts) return json({ available: true, source: name, alerts }, 15);
      errors.push(`${name}: unexpected format`);
    } catch (e: any) {
      errors.push(`${name}: ${e?.cause?.code || e?.message || e}`);
    }
  }
  return json({ available: false, alerts: [], errors }, 30);
}
