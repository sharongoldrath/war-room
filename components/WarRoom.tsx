'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { groundTrack, nightPolygon, satFeatures, toRecs, type SatRec, type Tle } from '@/lib/geo';
import { animatePulse, DEFAULT_ON, GROUPS, MAP_LAYERS, setupLayers, type LayerId } from '@/lib/mapLayers';
import { findPlaces, ZONE_CENTER, type Zone } from '@/lib/gazetteer';
import { normalizeAlerts, TZEVAADOM_URL } from '@/lib/alerts';
import { CATEGORY_LABEL, SEVERITY_LABEL } from '@/lib/nlp';
import { ago, esc, safeUrl, SEV_COLOR, type Alert, type FeedResponse, type Story } from '@/lib/ui';
import StoryFeed from './StoryFeed';
import PulseStrip from './PulseStrip';

const VIEWS = {
  il: { label: 'ישראל', center: [35.0, 31.6] as [number, number], zoom: 6.6 },
  me: { label: 'המזה״ת', center: [44, 28.5] as [number, number], zoom: 4 },
  world: { label: 'עולם', center: [25, 25] as [number, number], zoom: 1.6 },
};
type ViewKey = keyof typeof VIEWS;
const STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const LS_VISIT = 'wr:lastVisit';

export default function WarRoom() {
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const popup = useRef<maplibregl.Popup | null>(null);
  const [ready, setReady] = useState(false);
  const [on, setOn] = useState<Record<LayerId, boolean>>(DEFAULT_ON);
  const onRef = useRef(on);
  onRef.current = on;
  const [view, setView] = useState<ViewKey>('il');
  const [counts, setCounts] = useState<Partial<Record<LayerId | 'emerg', number>>>({});
  const [notes, setNotes] = useState<Partial<Record<LayerId, string>>>({});
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [feedErr, setFeedErr] = useState(false);
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [alertsSrc, setAlertsSrc] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [zone, setZone] = useState<Zone | null>(null);
  const [now, setNow] = useState(Date.now());
  const [panel, setPanel] = useState<'none' | 'layers' | 'feed'>('none');
  const [lastVisit, setLastVisit] = useState<number | null>(null);
  const sats = useRef<SatRec[]>([]);
  const satLoaded = useRef<Set<string>>(new Set());
  const storiesRef = useRef<Story[]>([]);

  const setCount = (k: LayerId | 'emerg', n: number) => setCounts((c) => (c[k] === n ? c : { ...c, [k]: n }));
  const setNote = (k: LayerId, s: string) => setNotes((n) => (n[k] === s ? n : { ...n, [k]: s }));
  const setData = (src: string, data: any) => (map.current?.getSource(src) as maplibregl.GeoJSONSource | undefined)?.setData(data);

  /* ---------------- "what changed since your last visit" ---------------- */
  useEffect(() => {
    try {
      const prev = Number(localStorage.getItem(LS_VISIT)) || null;
      setLastVisit(prev);
      const save = () => { try { localStorage.setItem(LS_VISIT, String(Date.now())); } catch {} };
      const id = setInterval(save, 60000);
      window.addEventListener('pagehide', save);
      return () => { clearInterval(id); window.removeEventListener('pagehide', save); };
    } catch {}
  }, []);

  /* ---------------- map init ---------------- */
  useEffect(() => {
    if (!mapEl.current || map.current) return;
    const small = window.innerWidth < 900;
    const m = new maplibregl.Map({
      container: mapEl.current, style: STYLE, center: VIEWS.il.center, zoom: VIEWS.il.zoom - (small ? 0.8 : 0),
      attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false,
    });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-left');
    m.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    let stopPulse = () => {};
    m.on('load', () => {
      setupLayers(m, (id) => onRef.current[id]);
      stopPulse = animatePulse(m);
      setData('night', nightPolygon());
      setReady(true);
    });
    return () => { stopPulse(); m.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    (Object.keys(MAP_LAYERS) as LayerId[]).forEach((id) =>
      MAP_LAYERS[id].forEach((l) => m.getLayer(l) && m.setLayoutProperty(l, 'visibility', on[id] ? 'visible' : 'none')),
    );
  }, [on, ready]);

  /* ---------------- polling helper ---------------- */
  const loop = useCallback((fn: () => Promise<void> | void, ms: number, deps: LayerId[]) => {
    let stop = false, timer: any;
    const tick = async () => {
      if (stop) return;
      if (!deps.length || deps.some((d) => onRef.current[d])) {
        try { await fn(); } catch (e) { console.warn('[war-room]', e); }
      }
      timer = setTimeout(tick, ms);
    };
    tick();
    return () => { stop = true; clearTimeout(timer); };
  }, []);
  const getJ = async (u: string) => { const r = await fetch(u); if (!r.ok) throw new Error(`${u} ${r.status}`); return r.json(); };

  /* ---------------- data ---------------- */
  // cross-referenced stories — 2 min
  useEffect(() => {
    if (!ready) return;
    return loop(async () => {
      try {
        const d: FeedResponse = await getJ('/api/feed');
        setFeed(d); setFeedErr(false);
      } catch (e) { setFeedErr(true); throw e; }
    }, 120000, []);
  }, [ready, loop]);

  // stories → map
  useEffect(() => {
    if (!ready || !feed) return;
    storiesRef.current = feed.stories;
    const byLoc = new Map<string, number>();
    const features = feed.stories
      .filter((s) => s.geo && !s.noise && s.category !== 'other')
      .map((s) => {
        const key = s.geo!.join(',');
        const i = byLoc.get(key) ?? 0;
        byLoc.set(key, i + 1);
        const a = i * 2.39996, r = i === 0 ? 0 : 0.045 * Math.sqrt(i);
        const ageH = (Date.now() - s.last) / 3600000;
        return {
          type: 'Feature', geometry: { type: 'Point', coordinates: [s.geo![0] + r * Math.cos(a), s.geo![1] + r * Math.sin(a)] },
          properties: { id: s.id, color: SEV_COLOR[s.severity], n: Math.max(1, s.independent), ver: s.verification, ageH, fresh: ageH < 0.75 ? 1 : 0 },
        };
      });
    setData('stories', { type: 'FeatureCollection', features });
    setCount('stories', features.length);
  }, [feed, ready]);

  // alerts — 20s. Server first (oref is geo-restricted), then the browser tries tzevaadom directly.
  useEffect(() => {
    if (!ready) return;
    return loop(async () => {
      let list: Alert[] | null = null, src: string | null = null;
      try {
        const d = await getJ('/api/alerts');
        if (d.available) { list = d.alerts; src = d.source; }
      } catch {}
      if (!list) {
        try {
          const r = await fetch(TZEVAADOM_URL);
          if (r.ok) { list = normalizeAlerts(await r.json()); src = 'tzevaadom'; }
        } catch {}
      }
      setAlerts(list); setAlertsSrc(src);
      setNote('alerts', list ? '' : 'לא זמין');
      if (!list) { setData('alerts', { type: 'FeatureCollection', features: [] }); return; }
      const features: any[] = [];
      for (const a of list) {
        const fade = Math.max(0.12, 1 - (Date.now() - a.t) / (3 * 3600000));
        for (const c of a.cities) {
          const p = findPlaces(c)[0];
          if (p && p.level === 'city') features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] }, properties: { city: c, title: a.title, t: a.t, fade } });
        }
      }
      setData('alerts', { type: 'FeatureCollection', features });
      setCount('alerts', list.length);
    }, 20000, ['alerts']);
  }, [ready, loop]);

  useEffect(() => {
    if (!ready) return;
    return loop(async () => {
      const d = await getJ('/api/flights');
      setData('flights', d);
      setCount('flights-civ', d.features.length);
      setCount('emerg', d.features.filter((f: any) => f.properties.kind === 'emerg').length);
    }, 15000, ['flights-civ']);
  }, [ready, loop]);

  useEffect(() => {
    if (!ready) return;
    return loop(async () => {
      const d = await getJ('/api/gpsjam');
      setData('gpsjam', d);
      setCount('gpsjam', d.features.length);
      setNote('gpsjam', d.error ? 'לא זמין' : d.day ? d.day.slice(5).split('-').reverse().join('.') : '');
    }, 3600000, ['gpsjam']);
  }, [ready, loop]);

  useEffect(() => {
    if (!ready) return;
    return loop(async () => {
      const d = await getJ('/api/outages');
      setData('outages', d);
      setCount('outages', d.features.length);
      setNote('outages', d.error ? 'לא זמין' : '');
    }, 600000, ['outages']);
  }, [ready, loop]);

  useEffect(() => {
    if (!ready) return;
    return loop(async () => {
      const d = await getJ('/api/hazards');
      setData('quakes', d.quakes); setData('events', d.events); setData('fires', d.fires);
      setCount('quakes', d.quakes.features.length); setCount('events', d.events.features.length); setCount('fires', d.fires.features.length);
      setNote('fires', d.firmsEnabled ? '' : 'דרוש מפתח');
    }, 300000, ['quakes', 'events', 'fires']);
  }, [ready, loop]);

  useEffect(() => {
    if (!ready) return;
    return loop(async () => {
      const d = await getJ('/api/ships');
      setData('ships', d);
      setCount('ships', d.features.length);
      setNote('ships', d.disabled ? 'דרוש מפתח' : '');
    }, 60000, ['ships']);
  }, [ready, loop]);

  // satellites: lazy TLE per group, propagated every 2s in the browser
  useEffect(() => {
    if (!ready) return;
    ([['sat-stations', 'stations'], ['sat-gps', 'gps']] as [LayerId, string][]).forEach(async ([id, g]) => {
      if (!on[id] || satLoaded.current.has(id)) return;
      satLoaded.current.add(id);
      const d = await getJ(`/api/tle?g=${g}`);
      sats.current = sats.current.concat(toRecs((d.sats || []).map((s: Tle) => ({ ...s, group: id }))));
      setCount(id, (d.sats || []).length);
      const iss = sats.current.find((s) => /ISS \(ZARYA\)/.test(s.name));
      if (iss) setData('iss-track', groundTrack(iss.rec));
    });
  }, [ready, on]);
  useEffect(() => {
    if (!ready) return;
    const fast = setInterval(() => sats.current.length && setData('sats', satFeatures(sats.current)), 2000);
    const slow = setInterval(() => {
      setData('night', nightPolygon());
      const iss = sats.current.find((s) => /ISS \(ZARYA\)/.test(s.name));
      if (iss) setData('iss-track', groundTrack(iss.rec));
    }, 60000);
    return () => { clearInterval(fast); clearInterval(slow); };
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    return loop(async () => {
      const m = map.current!;
      const d = await getJ('https://api.rainviewer.com/public/weather-maps.json');
      const frame = d.radar?.past?.[d.radar.past.length - 1];
      if (!frame) return;
      if (m.getLayer('radar')) m.removeLayer('radar');
      if (m.getSource('radar')) m.removeSource('radar');
      m.addSource('radar', { type: 'raster', tiles: [`${d.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`], tileSize: 256, maxzoom: 7, attribution: 'RainViewer' });
      const firstSymbol = m.getStyle().layers?.find((l) => l.type === 'symbol')?.id;
      m.addLayer({ id: 'radar', type: 'raster', source: 'radar', layout: { visibility: onRef.current.radar ? 'visible' : 'none' }, paint: { 'raster-opacity': 0.6 } }, firstSymbol);
    }, 600000, ['radar']);
  }, [ready, loop]);

  /* ---------------- popups ---------------- */
  const showPopup = (lngLat: maplibregl.LngLatLike, html: string) => {
    if (!map.current) return;
    popup.current?.remove();
    popup.current = new maplibregl.Popup({ maxWidth: '320px', offset: 10 }).setLngLat(lngLat).setHTML(html).addTo(map.current);
  };
  const storyPopup = (s: Story) =>
    `<div class="pp-k" style="color:${SEV_COLOR[s.severity]}">${esc(SEVERITY_LABEL[s.severity])} · ${esc(CATEGORY_LABEL[s.category])} · ${ago(s.last)}</div>` +
    `<div class="pp-h" dir="auto">${esc(s.title)}</div>` +
    `<div class="pp-k">${s.verification === 'multi' ? `✓ ${s.independent} מקורות בלתי תלויים` : s.verification === 'unverified' ? '⚠ לא מאומת' : 'מקור יחיד'} · ${esc(s.outlets.slice(0, 4).join(', '))}</div>`;

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const link = (url: string, label: string) => (url ? `<a class="pp-a" href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>` : '');
    const grid = (rows: [string, unknown][]) =>
      `<div class="pp-g" dir="ltr">${rows.filter(([, v]) => v !== '' && v != null).map(([k, v]) => `<span>${esc(k)}</span><span>${esc(v)}</span>`).join('')}</div>`;
    const handlers: [string, (f: any) => string | null][] = [
      ['stories', (f) => {
        const s = storiesRef.current.find((x) => x.id === f.properties.id);
        if (!s) return null;
        setSelected(s.id);
        if (window.innerWidth < 900) setPanel('feed');
        return storyPopup(s);
      }],
      ['alerts', (f) => { const p = f.properties; return `<div class="pp-k" style="color:#ff3b3b">${esc(p.title)} · ${ago(p.t)}</div><div class="pp-h">${esc(p.city)}</div>`; }],
      ['gpsjam', (f) => { const p = f.properties; return `<div class="pp-k">שיבוש GPS · נתון יומי</div><div class="pp-h">${p.pct}% מהמטוסים</div><div class="pp-k">דיווחו על דיוק ניווט ירוד (מתוך ${p.n})</div>${link('https://gpsjam.org', 'gpsjam.org')}`; }],
      ['outages', (f) => { const p = f.properties; return `<div class="pp-k">שיבוש אינטרנט · 24ש׳</div><div class="pp-h">${esc(p.name)}</div>${grid([['IODA score', p.score], ['events', p.events]])}${link(`https://ioda.inetintel.cc.gatech.edu/country/${p.code}`, 'IODA')}`; }],
      ['flights-civ', (f) => {
        const p = f.properties;
        return `<div class="pp-k">${p.kind === 'emerg' ? '⚠ קוד חירום' : 'תעופה אזרחית'}</div><div class="pp-h" dir="ltr">${esc(p.cs)}</div>` +
          grid([['TYPE', p.ac], ['REG', p.reg], ['ALT', p.alt != null ? `${Number(p.alt).toLocaleString()} ft` : ''], ['SPD', p.gs != null ? `${p.gs} kt` : ''], ['SQK', p.sq]]) +
          link(`https://globe.adsb.lol/?icao=${p.hex}`, 'מעקב מלא');
      }],
      ['quakes', (f) => { const p = f.properties; return `<div class="pp-k">רעידת אדמה · ${ago(p.t)}</div><div class="pp-h" dir="ltr">M${Number(p.mag).toFixed(1)}</div><div dir="ltr">${esc(p.title)}</div>${link(p.url, 'USGS')}`; }],
      ['events', (f) => { const p = f.properties; return `<div class="pp-k">${esc(p.kind)} · ${ago(p.t)}</div><div class="pp-h" dir="ltr">${esc(p.title)}</div>${link(p.url, 'מקור')}`; }],
      ['fires', (f) => `<div class="pp-k">מוקד חום · ${ago(f.properties.t)}</div><div dir="ltr">${esc(f.properties.title)}</div>`],
      ['sat-stations', (f) => `<div class="pp-k">לוויין</div><div class="pp-h" dir="ltr">${esc(f.properties.name)}</div>${grid([['ALT', `${f.properties.alt} km`]])}`],
      ['sat-gps', (f) => `<div class="pp-k">לוויין GPS</div><div class="pp-h" dir="ltr">${esc(f.properties.name)}</div>${grid([['ALT', `${f.properties.alt} km`]])}`],
      ['ships', (f) => { const p = f.properties; return `<div class="pp-k">ספינה · ${esc(p.cls)}</div><div class="pp-h" dir="ltr">${esc(p.name)}</div>${grid([['MMSI', p.mmsi], ['SOG', p.sog != null ? `${p.sog} kn` : ''], ['DEST', p.dest]])}`; }],
    ];
    const offs: (() => void)[] = [];
    for (const [layer, html] of handlers) {
      const click = (e: any) => { const f = e.features?.[0]; if (!f) return; const h = html(f); if (h) showPopup(e.lngLat, h); };
      const enter = () => (m.getCanvas().style.cursor = 'pointer');
      const leave = () => (m.getCanvas().style.cursor = '');
      m.on('click', layer, click); m.on('mouseenter', layer, enter); m.on('mouseleave', layer, leave);
      offs.push(() => { m.off('click', layer, click); m.off('mouseenter', layer, enter); m.off('mouseleave', layer, leave); });
    }
    return () => offs.forEach((o) => o());
  }, [ready]);

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  /* ---------------- actions ---------------- */
  const small = () => window.innerWidth < 900;
  const goView = (k: ViewKey) => {
    setView(k);
    map.current?.flyTo({ center: VIEWS[k].center, zoom: VIEWS[k].zoom - (small() ? 0.8 : 0), duration: 1200 });
  };
  const pickStory = (s: Story) => {
    setSelected((cur) => (cur === s.id ? null : s.id));
    if (!s.geo || !map.current) return;
    if (!on.stories) setOn((o) => ({ ...o, stories: true }));
    map.current.flyTo({ center: s.geo, zoom: Math.max(map.current.getZoom(), s.level === 'city' ? 8 : 7), duration: 900 });
    showPopup(s.geo, storyPopup(s));
  };
  const pickZone = (z: Zone | null) => {
    setZone(z);
    if (z && map.current) {
      const [lon, lat, zoom] = ZONE_CENTER[z];
      map.current.flyTo({ center: [lon, lat], zoom: zoom - (small() ? 0.8 : 0), duration: 1100 });
    }
  };

  /* ---------------- derived ---------------- */
  const stories = feed?.stories ?? [];
  const multi = stories.filter((s) => s.verification === 'multi' && !s.noise).length;
  const newCount = lastVisit ? stories.filter((s) => s.first > lastVisit && !s.noise && s.category !== 'other').length : 0;
  const recentAlert = alerts?.find((a) => now - a.t < 10 * 60000) ?? null;
  const ticker = useMemo(
    () => stories.filter((s) => !s.noise && s.category !== 'other' && (s.verification === 'multi' || s.severity !== 'low')).slice(0, 25),
    [stories],
  );
  const fmt = (tz: string) => new Date(now).toLocaleTimeString('en-GB', { timeZone: tz, hour12: false });
  const stale = feedErr || (feed && now - feed.t > 10 * 60000);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className={`dot ${stale ? 'stale' : ''}`} title={stale ? 'הנתונים לא עודכנו לאחרונה' : 'מחובר'} />
          חדר המלחמה
          <small>{stale ? 'STALE' : 'LIVE'}</small>
        </div>
        <div className="clocks">
          <span>ישראל <b>{fmt('Asia/Jerusalem')}</b></span>
          <span className="utc">UTC <b>{fmt('UTC')}</b></span>
        </div>
        <div className="views">
          {(Object.keys(VIEWS) as ViewKey[]).map((k) => (
            <button key={k} className={view === k ? 'on' : ''} onClick={() => goView(k)}>{VIEWS[k].label}</button>
          ))}
        </div>
        <button className="iconbtn" onClick={() => setPanel((p) => (p === 'layers' ? 'none' : 'layers'))}>שכבות</button>
        <button className="iconbtn" onClick={() => setPanel((p) => (p === 'feed' ? 'none' : 'feed'))}>מודיעין</button>
        <div className="stats">
          {!!counts.emerg && <span className="stat alert">חירום באוויר<b>{counts.emerg}</b></span>}
          {newCount > 0 && <span className="stat new" title="סיפורים שהופיעו מאז הביקור הקודם">חדש מאז הביקור<b>{newCount}</b></span>}
          <span className="stat" title="סיפורים שדווחו על ידי 2+ כלי תקשורת בלתי תלויים">רב-מקורי<b>{feed ? multi : '—'}</b></span>
          <span className="stat" title="דיווחים / כלי תקשורת שנאספו ב-48 השעות האחרונות">דיווחים<b>{feed ? `${feed.totals.reports} / ${feed.totals.outlets}` : '—'}</b></span>
          <span className="stat">טיסות<b>{counts['flights-civ'] ?? '—'}</b></span>
        </div>
      </header>

      <PulseStrip pulse={feed?.pulse ?? {}} zone={zone} onZone={pickZone} />

      <div className="stage">
        <div id="map" ref={mapEl} />

        {recentAlert && on.alerts && (
          <div className="alert-banner" role="alert">
            <b>🚨 {recentAlert.title}</b>
            <span>{recentAlert.cities.slice(0, 8).join(' · ')}{recentAlert.cities.length > 8 ? ` +${recentAlert.cities.length - 8}` : ''}</span>
            <em>{ago(recentAlert.t, now)}</em>
          </div>
        )}

        <aside className={`panel layers ${panel === 'layers' ? 'open' : ''}`}>
          <h3>שכבות <span>{Object.values(on).filter(Boolean).length} פעילות</span></h3>
          {GROUPS.map((g) => (
            <div className="group" key={g.title}>
              <div className="group-title">{g.title}</div>
              {g.items.map((i) => (
                <button key={i.id} className={`row ${on[i.id] ? 'on' : ''}`} style={{ color: i.color }} title={`מקור: ${i.source}`} onClick={() => setOn((o) => ({ ...o, [i.id]: !o[i.id] }))}>
                  <span className="sw" />
                  <span className="lbl">{i.label}</span>
                  {notes[i.id] ? <span className="note">{notes[i.id]}</span> : <span className="n">{on[i.id] && counts[i.id] != null ? counts[i.id] : ''}</span>}
                </button>
              ))}
            </div>
          ))}
          <div className="legend">
            <div className="lg-h">סיפורים על המפה</div>
            <div className="lg-row">{(['critical', 'high', 'medium', 'low'] as const).map((s) => <span key={s}><i style={{ background: SEV_COLOR[s] }} />{SEVERITY_LABEL[s]}</span>)}</div>
            <div className="lg-row"><span><i className="ring" />מסגרת לבנה = רב-מקורי</span><span>גודל = מס׳ מקורות</span></div>
          </div>
          <div className="foot">מיקום סיפור נקבע לפי שם מקום בטקסט — לא אימות שטח. חומרה = הערכה אוטומטית.</div>
        </aside>

        <aside className={`panel feed ${panel === 'feed' ? 'open' : ''}`}>
          <StoryFeed
            stories={stories} health={feed?.health ?? []} alerts={alerts} alertsSource={alertsSrc}
            selected={selected} onSelect={pickStory} zone={zone} onClearZone={() => setZone(null)}
            lastVisit={lastVisit} now={now}
          />
        </aside>
      </div>

      <footer className="ticker">
        <span className="tag">מבזקים</span>
        <div className="vp">
          <div className="track" style={{ ['--dur' as any]: `${Math.max(60, ticker.length * 10)}s` }}>
            {ticker.map((s) => (
              <span key={s.id} dir="auto" onClick={() => pickStory(s)}>
                <em style={{ color: SEV_COLOR[s.severity] }}>●</em>
                {s.title}
                {s.verification === 'multi' && <em> ✓{s.independent}</em>}
              </span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
