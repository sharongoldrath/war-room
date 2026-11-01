// Home Front Command (Pikud HaOref) alerts. Normalizes the two public formats we try:
//  - oref.org.il AlertsHistory.json  → [{ alertDate, title, data: "<city>", category }]
//  - tzevaadom alerts-history        → [{ id, alerts: [{ time, cities: [...], threat, isDrill }] }]
// oref.org.il is geo-restricted to Israel, so the server attempt often fails outside Israel;
// the browser (in Israel) then tries tzevaadom directly. Nothing is shown unless a source answers.
export type Alert = { t: number; cities: string[]; title: string };

const THREAT: Record<number, string> = { 0: 'ירי רקטות וטילים', 1: 'אירוע חומרים מסוכנים', 2: 'חדירת מחבלים', 3: 'רעידת אדמה', 4: 'צונאמי', 5: 'חדירת כלי טיס עוין', 6: 'אירוע רדיולוגי', 7: 'אירוע לא קונבנציונלי', 8: 'התרעה' };

export function normalizeAlerts(body: unknown): Alert[] | null {
  if (!Array.isArray(body)) return null;
  const out: Alert[] = [];
  for (const row of body as any[]) {
    if (row && typeof row.alertDate === 'string') {
      const t = Date.parse(row.alertDate.replace(' ', 'T') + '+02:00'); // oref timestamps are Israel local time
      const last = out[out.length - 1];
      // oref lists one row per city; merge rows with the same timestamp and title
      if (last && last.t === t && last.title === row.title) last.cities.push(String(row.data));
      else out.push({ t, cities: [String(row.data)], title: String(row.title || 'התרעה') });
    } else if (row && Array.isArray(row.alerts)) {
      for (const a of row.alerts) {
        if (a?.isDrill) continue;
        out.push({ t: Number(a.time) * 1000, cities: (a.cities || []).map(String), title: THREAT[Number(a.threat)] ?? 'התרעה' });
      }
    }
  }
  const dayAgo = Date.now() - 86400000;
  return out.filter((a) => a.t > dayAgo && a.cities.length).sort((a, b) => b.t - a.t).slice(0, 200);
}

export const TZEVAADOM_URL = 'https://api.tzevaadom.co.il/alerts-history';
