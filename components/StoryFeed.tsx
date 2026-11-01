'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CAMP_LABEL, type Camp } from '@/lib/sources';
import { CATEGORY_LABEL, SEVERITY_LABEL, type Category } from '@/lib/nlp';
import { ZONE_LABEL, type Zone } from '@/lib/gazetteer';
import { ago, CAMP_COLOR, safeUrl, SEV_COLOR, type Alert, type Health, type Story } from '@/lib/ui';

type Tab = 'stories' | 'alerts' | 'sources';
const CATS: (Category | 'all')[] = ['security', 'all', 'diplomacy', 'politics', 'economy', 'civil'];
const SEV_RANK = { critical: 3, high: 2, medium: 1, low: 0 };
const CAMP_ORDER: Camp[] = ['il', 'west', 'arab', 'iran', 'tg'];

export function VerBadge({ s }: { s: Story }) {
  if (s.verification === 'multi') return <span className="ver multi" title="מספר כלי תקשורת בלתי תלויים דיווחו (העתקים של אותו נוסח לא נספרים)">✓ {s.independent} מקורות</span>;
  if (s.verification === 'unverified') return <span className="ver unv" title="דיווח בודד המנוסח כטענה, או פוסט טלגרם שלא אומת">⚠ לא מאומת</span>;
  return <span className="ver single">מקור יחיד</span>;
}

export default function StoryFeed(props: {
  stories: Story[]; health: Health[]; alerts: Alert[] | null; alertsSource: string | null;
  selected: string | null; onSelect: (s: Story) => void; zone: Zone | null; onClearZone: () => void;
  lastVisit: number | null; now: number;
}) {
  const { stories, health, alerts, selected, onSelect, zone, now, lastVisit } = props;
  const [tab, setTab] = useState<Tab>('stories');
  const [cat, setCat] = useState<Category | 'all'>('security');
  const [multiOnly, setMultiOnly] = useState(false);
  const [sort, setSort] = useState<'new' | 'sev'>('new');
  const listRef = useRef<HTMLDivElement>(null);

  const shown = useMemo(() => {
    const xs = stories.filter((s) => !s.noise && (cat === 'all' || s.category === cat) && (!multiOnly || s.verification === 'multi') && (!zone || s.zone === zone));
    return sort === 'sev' ? [...xs].sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity] || b.independent - a.independent || b.last - a.last) : xs;
  }, [stories, cat, multiOnly, sort, zone]);

  useEffect(() => {
    if (!selected) return;
    setTab('stories');
    requestAnimationFrame(() => listRef.current?.querySelector(`[data-id="${selected}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }, [selected]);

  const okCount = health.filter((h) => h.ok).length;
  const alerts24 = alerts?.length ?? 0;

  return (
    <>
      <div className="ftabs">
        <button className={tab === 'stories' ? 'on' : ''} onClick={() => setTab('stories')}>סיפורים <b>{shown.length}</b></button>
        <button className={tab === 'alerts' ? 'on' : ''} onClick={() => setTab('alerts')}>אזעקות <b>{alerts ? alerts24 : '—'}</b></button>
        <button className={tab === 'sources' ? 'on' : ''} onClick={() => setTab('sources')}>מקורות <b>{okCount}/{health.length || '—'}</b></button>
      </div>

      {tab === 'stories' && (
        <>
          <div className="filters">
            <div className="chips">
              {CATS.map((c) => (
                <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c === 'all' ? 'הכל' : CATEGORY_LABEL[c]}</button>
              ))}
            </div>
            <div className="chips">
              <button className={multiOnly ? 'on' : ''} onClick={() => setMultiOnly((v) => !v)}>✓ רק רב-מקורי</button>
              <button className={sort === 'sev' ? 'on' : ''} onClick={() => setSort((s) => (s === 'new' ? 'sev' : 'new'))}>{sort === 'new' ? 'מיון: חדש' : 'מיון: חומרה'}</button>
              {zone && <button className="on zone" onClick={props.onClearZone}>{ZONE_LABEL[zone]} ✕</button>}
            </div>
          </div>
          <div className="items" ref={listRef}>
            {stories.length === 0 && <div className="empty">אוסף דיווחים מכ-30 מקורות…</div>}
            {stories.length > 0 && shown.length === 0 && <div className="empty">אין סיפורים שעונים על הסינון.</div>}
            {shown.map((s) => {
              const open = selected === s.id;
              const isNew = lastVisit != null && s.first > lastVisit;
              return (
                <div key={s.id} data-id={s.id} className={`story ${open ? 'sel' : ''}`} style={{ ['--sev' as any]: SEV_COLOR[s.severity] }} onClick={() => onSelect(s)}>
                  <div className="meta">
                    <span className="sev">{SEVERITY_LABEL[s.severity]}</span>
                    <span>{CATEGORY_LABEL[s.category]}</span>
                    {s.zone && <span>· {ZONE_LABEL[s.zone]}</span>}
                    {isNew && <span className="new">חדש</span>}
                    <span className={now - s.last < 15 * 60000 ? 'fresh' : ''} style={{ marginInlineStart: 'auto' }}>{ago(s.last, now)}</span>
                  </div>
                  <div className="title" dir="auto">{s.title}</div>
                  <div className="foot-row">
                    <VerBadge s={s} />
                    <span className="camps">
                      {CAMP_ORDER.filter((c) => s.camps[c]).map((c) => (
                        <span key={c} className="camp" style={{ ['--c' as any]: CAMP_COLOR[c] }}>{CAMP_LABEL[c]} {s.camps[c]}</span>
                      ))}
                    </span>
                  </div>
                  {open && (
                    <div className="xref" onClick={(e) => e.stopPropagation()}>
                      <div className="xref-h">הצלבה לפי צד · {s.reports.length} דיווחים · נצפה לראשונה {ago(s.first, now)}</div>
                      {CAMP_ORDER.filter((c) => s.reports.some((r) => r.camp === c)).map((c) => (
                        <div key={c} className="side" style={{ ['--c' as any]: CAMP_COLOR[c] }}>
                          <div className="side-h">{CAMP_LABEL[c]}</div>
                          {s.reports.filter((r) => r.camp === c).map((r, i) => (
                            <a key={i} className="rep" href={safeUrl(r.link)} target="_blank" rel="noopener noreferrer">
                              <span className="rep-m">{r.outlet} · {ago(r.t, now)}{r.syndicated ? ' · העתק' : ''}</span>
                              <span dir="auto">{r.title}</span>
                            </a>
                          ))}
                        </div>
                      ))}
                      <div className="method">חומרה וסיווג: הערכה אוטומטית לפי מילות מפתח ומספר מקורות — לא אימות שטח. ״מקורות״ סופר כלי תקשורת שונים, וידיעות זהות כמעט מילה במילה נספרות פעם אחת.</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === 'alerts' && (
        <div className="items">
          {alerts === null && (
            <div className="empty">
              מקור ההתרעות של פיקוד העורף חסום מחוץ לישראל, ולא הצלחנו להתחבר לחלופה. השכבה תעבוד כשאחד המקורות יענה — לא מוצג כלום במקום.
            </div>
          )}
          {alerts && alerts.length === 0 && <div className="empty">אין התרעות ב-24 השעות האחרונות ({props.alertsSource}).</div>}
          {alerts?.map((a, i) => (
            <div key={i} className="story" style={{ ['--sev' as any]: now - a.t < 10 * 60000 ? SEV_COLOR.critical : SEV_COLOR.high }}>
              <div className="meta"><span className="sev">{a.title}</span><span style={{ marginInlineStart: 'auto' }}>{new Date(a.t).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} · {ago(a.t, now)}</span></div>
              <div className="title">{a.cities.slice(0, 12).join(' · ')}{a.cities.length > 12 ? ` ועוד ${a.cities.length - 12}` : ''}</div>
            </div>
          ))}
          {alerts && <div className="method">מקור: {props.alertsSource === 'oref' ? 'פיקוד העורף' : 'צבע אדום (tzevaadom)'}. תרגילים מסוננים.</div>}
        </div>
      )}

      {tab === 'sources' && (
        <div className="items">
          <div className="method" style={{ borderTop: 0 }}>כל מקור נמשך בנפרד. מקור שנפל או שמחזיר תוכן ישן מסומן — ולא מוחלף בנתונים אחרים.</div>
          {[...health].sort((a, b) => Number(b.ok) - Number(a.ok) || b.items - a.items).map((h) => (
            <div key={h.id} className="src-row">
              <span className={`dot ${h.ok ? '' : 'bad'}`} />
              <span className="src-name" dir="auto">{h.name}</span>
              <span className="camp" style={{ ['--c' as any]: CAMP_COLOR[h.camp] }}>{CAMP_LABEL[h.camp]}</span>
              <span className="src-n">{h.ok ? `${h.items} · ${h.newest ? ago(h.newest, now) : ''}` : h.error === 'stale' ? 'תוכן ישן' : h.error || 'נכשל'}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
