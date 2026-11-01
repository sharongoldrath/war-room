'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { ago, esc, groundTrack, nightPolygon, satFeatures, toRecs, type SatRec, type Tle } from '@/lib/geo';

/* ------------------------------------------------------------------ config */
type LayerId =
  | 'flights-civ'
  | 'headlines' | 'newsgeo'
  | 'quakes' | 'events' | 'fires' | 'radar'
  | 'sat-stations' | 'sat-gps' | 'ships'
  | 'night';

const GROUPS: { title: string; items: { id: LayerId; label: string; color: string; on: boolean }[] }[] = [
  { title: 'אוויר', items: [
    { id: 'flights-civ', label: 'תעופה אזרחית', color: '#7f9db2', on: true },
  ]},
  { title: 'מודיעין חדשותי', items: [
    { id: 'headlines', label: 'כותרות על המפה', color: '#ff2bd6', on: true },
    { id: 'newsgeo', label: 'מוקדי סיקור (GDELT)', color: '#ff9f1c', on: true },
  ]},
  { title: 'טבע ואסונות', items: [
    { id: 'quakes', label: 'רעידות אדמה', color: '#ffe066', on: true },
    { id: 'events', label: 'סופות, הרי געש, שריפות', color: '#ff7a45', on: false },
    { id: 'fires', label: 'מוקדי חום (FIRMS)', color: '#ff5a1f', on: false },
    { id: 'radar', label: 'מכ״ם גשם', color: '#3fa8ff', on: false },
  ]},
  { title: 'חלל וים', items: [
    { id: 'sat-stations', label: 'תחנות חלל + ISS', color: '#b48cff', on: true },
    { id: 'sat-gps', label: 'לווייני GPS', color: '#7ee0c3', on: false },
    { id: 'ships', label: 'ספינות (AIS)', color: '#3fd0ff', on: false },
  ]},
  { title: 'רקע', items: [{ id: 'night', label: 'יום / לילה', color: '#4a5866', on: true }] },
];
const COLOR = Object.fromEntries(GROUPS.flatMap((g) => g.items.map((i) => [i.id, i.color]))) as Record<LayerId, string>;
const DEFAULT_ON = Object.fromEntries(GROUPS.flatMap((g) => g.items.map((i) => [i.id, i.on]))) as Record<LayerId, boolean>;

// map layers that belong to each toggle
const MAP_LAYERS: Record<LayerId, string[]> = {
  'flights-civ': ['flights-civ'],
  headlines: ['headlines-halo', 'headlines'], newsgeo: ['newsgeo'],
  quakes: ['quakes'], events: ['events'], fires: ['fires'], radar: ['radar'],
  'sat-stations': ['sat-stations', 'iss-track'], 'sat-gps': ['sat-gps'],
  ships: ['ships'], night: ['night'],
};

const VIEWS = {
  il: { label: 'ישראל', center: [35.0, 31.6] as [number, number], zoom: 6.6 },
  me: { label: 'המזה״ת', center: [44, 28.5] as [number, number], zoom: 4 },
  world: { label: 'עולם', center: [25, 25] as [number, number], zoom: 1.6 },
};
type ViewKey = keyof typeof VIEWS;

const STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const EMPTY = { type: 'FeatureCollection', features: [] } as any;

type FeedItem = { src: string; srcName: string; lang: 'he' | 'en'; title: string; desc: string; link: string; t: number; geo: [number, number] | null };

/* ------------------------------------------------------------------ icons */
function makeIcon(kind: 'plane' | 'ship', size = 48) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.translate(size / 2, size / 2);
  const s = size / 48;
  g.scale(s, s);
  g.beginPath();
  if (kind === 'plane') {
    // nose up
    g.moveTo(0, -20); g.lineTo(3, -12); g.lineTo(3, -4); g.lineTo(18, 5); g.lineTo(18, 9); g.lineTo(3, 4);
    g.lineTo(3, 13); g.lineTo(8, 17); g.lineTo(8, 20); g.lineTo(0, 17.5); g.lineTo(-8, 20); g.lineTo(-8, 17);
    g.lineTo(-3, 13); g.lineTo(-3, 4); g.lineTo(-18, 9); g.lineTo(-18, 5); g.lineTo(-3, -4); g.lineTo(-3, -12);
  } else {
    g.moveTo(0, -16); g.lineTo(7, -4); g.lineTo(7, 14); g.lineTo(-7, 14); g.lineTo(-7, -4);
  }
  g.closePath();
  g.fill();
  return g.getImageData(0, 0, size, size);
}

/* ------------------------------------------------------------------ component */
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
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [feedStatus, setFeedStatus] = useState<Record<string, boolean>>({});
  const [lang, setLang] = useState<'all' | 'he' | 'en'>('all');
  const [geoOnly, setGeoOnly] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [panel, setPanel] = useState<'none' | 'layers' | 'feed'>('none');
  const sats = useRef<SatRec[]>([]);
  const satLoaded = useRef<Set<string>>(new Set());

  const setCount = (k: LayerId | 'emerg', n: number) => setCounts((c) => (c[k] === n ? c : { ...c, [k]: n }));
  const setData = (src: string, data: any) => (map.current?.getSource(src) as maplibregl.GeoJSONSource | undefined)?.setData(data);

  /* ---------------- map init ---------------- */
  useEffect(() => {
    if (!mapEl.current || map.current) return;
    const small = window.innerWidth < 900;
    const m = new maplibregl.Map({
      container: mapEl.current,
      style: STYLE,
      center: VIEWS.il.center,
      zoom: VIEWS.il.zoom - (small ? 0.8 : 0),
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-left');
    m.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    m.on('load', () => {
      m.addImage('plane', makeIcon('plane'), { sdf: true, pixelRatio: 2 });
      m.addImage('ship', makeIcon('ship'), { sdf: true, pixelRatio: 2 });
      const firstSymbol = m.getStyle().layers?.find((l) => l.type === 'symbol')?.id;
      const vis = (id: LayerId) => (onRef.current[id] ? 'visible' : 'none') as 'visible' | 'none';

      ['night', 'flights', 'headlines', 'newsgeo', 'quakes', 'events', 'fires', 'sats', 'iss-track', 'ships'].forEach((s) =>
        m.addSource(s, { type: 'geojson', data: EMPTY }),
      );

      // background-ish layers sit under the basemap labels
      m.addLayer({ id: 'night', type: 'fill', source: 'night', layout: { visibility: vis('night') }, paint: { 'fill-color': '#000', 'fill-opacity': 0.32 } }, firstSymbol);

      m.addLayer({ id: 'fires', type: 'circle', source: 'fires', layout: { visibility: vis('fires') }, paint: {
        'circle-color': COLOR.fires, 'circle-opacity': 0.75, 'circle-blur': 0.4,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 1.5, 8, 4],
      }});
      m.addLayer({ id: 'events', type: 'circle', source: 'events', layout: { visibility: vis('events') }, paint: {
        'circle-color': ['match', ['get', 'kind'], 'wildfires', '#ff5a1f', 'severeStorms', '#3fa8ff', 'volcanoes', '#ff2e2e', 'floods', '#2f7bff', 'seaLakeIce', '#a8e6ff', COLOR.events],
        'circle-radius': 6, 'circle-stroke-color': '#000', 'circle-stroke-width': 1, 'circle-opacity': 0.85,
      }});
      m.addLayer({ id: 'quakes', type: 'circle', source: 'quakes', layout: { visibility: vis('quakes') }, paint: {
        'circle-color': COLOR.quakes, 'circle-opacity': 0.25, 'circle-stroke-color': COLOR.quakes, 'circle-stroke-width': 1.2,
        'circle-radius': ['interpolate', ['linear'], ['get', 'mag'], 2.5, 4, 5, 10, 7, 22],
      }});
      m.addLayer({ id: 'newsgeo', type: 'circle', source: 'newsgeo', layout: { visibility: vis('newsgeo') }, paint: {
        'circle-color': COLOR.newsgeo, 'circle-opacity': 0.22, 'circle-stroke-color': COLOR.newsgeo, 'circle-stroke-width': 1, 'circle-stroke-opacity': 0.7,
        'circle-radius': ['interpolate', ['linear'], ['sqrt', ['get', 'count']], 1, 4, 10, 16, 30, 30],
      }});
      m.addLayer({ id: 'iss-track', type: 'line', source: 'iss-track', layout: { visibility: vis('sat-stations') }, paint: {
        'line-color': COLOR['sat-stations'], 'line-width': 1, 'line-dasharray': [2, 3], 'line-opacity': 0.6,
      }});
      (['sat-stations', 'sat-gps'] as LayerId[]).forEach((id) =>
        m.addLayer({ id, type: 'circle', source: 'sats', filter: ['==', ['get', 'group'], id], layout: { visibility: vis(id) }, paint: {
          'circle-color': COLOR[id], 'circle-radius': ['case', ['==', ['get', 'iss'], 1], 6, 2.6],
          'circle-stroke-color': '#000', 'circle-stroke-width': ['case', ['==', ['get', 'iss'], 1], 2, 0.5],
        }}),
      );
      m.addLayer({ id: 'ships', type: 'symbol', source: 'ships', layout: {
        visibility: vis('ships'), 'icon-image': 'ship', 'icon-size': ['interpolate', ['linear'], ['zoom'], 3, 0.35, 9, 0.7],
        'icon-rotate': ['get', 'cog'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true,
      }, paint: { 'icon-color': ['match', ['get', 'cls'], 'tanker', '#ffb347', COLOR.ships], 'icon-opacity': 0.9 }});

      const planeLayout = (id: LayerId, scale: number): any => ({
        visibility: vis(id), 'icon-image': 'plane', 'icon-rotate': ['get', 'trk'], 'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true, 'icon-ignore-placement': true,
        'icon-size': ['interpolate', ['linear'], ['zoom'], 2, 0.4 * scale, 6, 0.65 * scale, 10, 1 * scale],
      });
      m.addLayer({ id: 'flights-civ', type: 'symbol', source: 'flights', layout: planeLayout('flights-civ', 0.85), paint: {
        'icon-color': ['case', ['==', ['get', 'kind'], 'emerg'], '#ff2bd6', COLOR['flights-civ']],
        'icon-opacity': ['case', ['==', ['get', 'kind'], 'emerg'], 1, 0.8],
      }});

      m.addLayer({ id: 'headlines-halo', type: 'circle', source: 'headlines', layout: { visibility: vis('headlines') }, paint: {
        'circle-color': COLOR.headlines, 'circle-radius': 14, 'circle-blur': 1, 'circle-opacity': ['get', 'fade'],
      }});
      m.addLayer({ id: 'headlines', type: 'circle', source: 'headlines', layout: { visibility: vis('headlines') }, paint: {
        'circle-color': COLOR.headlines, 'circle-radius': 5, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.2,
        'circle-opacity': ['max', 0.45, ['get', 'fade']],
      }});

      setData('night', nightPolygon());
      setReady(true);
    });
    return () => { m.remove(); map.current = null; };
  }, []);

  /* ---------------- toggles → visibility ---------------- */
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    (Object.keys(MAP_LAYERS) as LayerId[]).forEach((id) =>
      MAP_LAYERS[id].forEach((l) => m.getLayer(l) && m.setLayoutProperty(l, 'visibility', on[id] ? 'visible' : 'none')),
    );
  }, [on, ready]);

  /* ---------------- data loops ---------------- */
  const loop = useCallback((fn: () => Promise<void> | void, ms: number, deps: LayerId[]) => {
    let stop = false;
    let timer: any;
    const tick = async () => {
      if (stop) return;
      if (deps.length === 0 || deps.some((d) => onRef.current[d])) {
        try { await fn(); } catch (e) { console.warn(e); }
      }
      timer = setTimeout(tick, ms);
    };
    tick();
    return () => { stop = true; clearTimeout(timer); };
  }, []);

  // flights — 15s
  useEffect(() => {
    if (!ready) return;
    return loop(async () => {
      const r = await fetch('/api/flights');
      const d = await r.json();
      setData('flights', d);
      const emerg = d.features.filter((f: any) => f.properties.kind === 'emerg').length;
      setCount('flights-civ', d.features.length); setCount('emerg', emerg);
      setLive((d.meta?.sources ?? 0) > 0);
    }, 15000, ['flights-civ']);
  }, [ready, loop]);

  // headline feed — 90s (always: powers the side panel + ticker)
  useEffect(() => {
    if (!ready) return;
    return loop(async () => {
      const d = await (await fetch('/api/feed')).json();
      setFeed(d.items || []);
      setFeedStatus(d.status || {});
    }, 90000, []);
  }, [ready, loop]);

  // GDELT — 10 min
  useEffect(() => {
    if (!ready) return;
    return loop(async () => {
      const d = await (await fetch('/api/news-geo?span=24h')).json();
      setData('newsgeo', d);
      setCount('newsgeo', d.features.length);
      setNotes((n) => ({ ...n, newsgeo: d.error ? 'לא זמין כרגע' : '' }));
    }, 600000, ['newsgeo']);
  }, [ready, loop]);

  // hazards — 5 min
  useEffect(() => {
    if (!ready) return;
    return loop(async () => {
      const d = await (await fetch('/api/hazards')).json();
      setData('quakes', d.quakes); setData('events', d.events); setData('fires', d.fires);
      setCount('quakes', d.quakes.features.length); setCount('events', d.events.features.length); setCount('fires', d.fires.features.length);
      setNotes((n) => ({ ...n, fires: d.firmsEnabled ? '' : 'דרוש מפתח' }));
    }, 300000, ['quakes', 'events', 'fires']);
  }, [ready, loop]);

  // ships — 60s
  useEffect(() => {
    if (!ready) return;
    return loop(async () => {
      const d = await (await fetch('/api/ships')).json();
      setData('ships', d);
      setCount('ships', d.features.length);
      setNotes((n) => ({ ...n, ships: d.disabled ? 'דרוש מפתח' : '' }));
    }, 60000, ['ships']);
  }, [ready, loop]);

  // satellites: lazy TLE load per group, propagate every 2s
  useEffect(() => {
    if (!ready) return;
    const groups: [LayerId, string][] = [['sat-stations', 'stations'], ['sat-gps', 'gps']];
    groups.forEach(async ([id, g]) => {
      if (!on[id] || satLoaded.current.has(id)) return;
      satLoaded.current.add(id);
      const d = await (await fetch(`/api/tle?g=${g}`)).json();
      sats.current = sats.current.concat(toRecs((d.sats || []).map((s: Tle) => ({ ...s, group: id }))));
      setCount(id, (d.sats || []).length);
      const iss = sats.current.find((s) => /ISS \(ZARYA\)/.test(s.name));
      if (iss) setData('iss-track', groundTrack(iss.rec));
    });
  }, [ready, on]);
  useEffect(() => {
    if (!ready) return;
    const id = setInterval(() => {
      if (sats.current.length) setData('sats', satFeatures(sats.current));
    }, 2000);
    const slow = setInterval(() => {
      setData('night', nightPolygon());
      const iss = sats.current.find((s) => /ISS \(ZARYA\)/.test(s.name));
      if (iss) setData('iss-track', groundTrack(iss.rec));
    }, 60000);
    return () => { clearInterval(id); clearInterval(slow); };
  }, [ready]);

  // radar (RainViewer) — 10 min
  useEffect(() => {
    if (!ready) return;
    return loop(async () => {
      const m = map.current!;
      const d = await (await fetch('https://api.rainviewer.com/public/weather-maps.json')).json();
      const frame = d.radar?.past?.[d.radar.past.length - 1];
      if (!frame) return;
      const tiles = [`${d.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`];
      if (m.getLayer('radar')) m.removeLayer('radar');
      if (m.getSource('radar')) m.removeSource('radar');
      m.addSource('radar', { type: 'raster', tiles, tileSize: 256, maxzoom: 7, attribution: 'RainViewer' });
      const firstSymbol = m.getStyle().layers?.find((l) => l.type === 'symbol')?.id;
      m.addLayer({ id: 'radar', type: 'raster', source: 'radar', layout: { visibility: onRef.current.radar ? 'visible' : 'none' }, paint: { 'raster-opacity': 0.6 } }, firstSymbol);
    }, 600000, ['radar']);
  }, [ready, loop]);

  // geotagged headlines → map
  useEffect(() => {
    if (!ready) return;
    const byLoc = new Map<string, number>();
    const features = feed
      .filter((f) => f.geo)
      .map((f) => {
        const key = f.geo!.join(',');
        const i = byLoc.get(key) ?? 0;
        byLoc.set(key, i + 1);
        // golden-angle spiral so stacked headlines don't overlap
        const a = i * 2.39996, r = i === 0 ? 0 : 0.06 * Math.sqrt(i);
        const hours = (Date.now() - f.t) / 3600000;
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [f.geo![0] + r * Math.cos(a), f.geo![1] + r * Math.sin(a)] },
          properties: { id: f.link, title: f.title, src: f.srcName, link: f.link, t: f.t, fade: Math.max(0.15, 1 - hours / 12) },
        };
      });
    setData('headlines', { type: 'FeatureCollection', features });
    setCount('headlines', features.length);
  }, [feed, ready]);

  /* ---------------- popups ---------------- */
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const show = (lngLat: maplibregl.LngLatLike, html: string) => {
      popup.current?.remove();
      popup.current = new maplibregl.Popup({ closeButton: true, maxWidth: '300px', offset: 10 }).setLngLat(lngLat).setHTML(html).addTo(m);
    };
    const link = (url: string, label: string) => (url ? `<a class="pp-a" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>` : '');
    const grid = (rows: [string, unknown][]) =>
      `<div class="pp-g" dir="ltr">${rows.filter(([, v]) => v !== '' && v != null).map(([k, v]) => `<span>${esc(k)}</span><span>${esc(v)}</span>`).join('')}</div>`;

    const handlers: [string, (f: any, ll: maplibregl.LngLat) => string][] = [
      ...(['flights-civ'].map((id) => [id, (f: any) => {
        const p = f.properties;
        const kind = p.kind === 'emerg' ? '⚠ קוד חירום' : 'תעופה אזרחית';
        return `<div class="pp-k">${kind}</div><div class="pp-h" dir="ltr">${esc(p.cs)}</div>` +
          grid([['TYPE', p.ac], ['REG', p.reg], ['ALT', p.alt != null ? `${Number(p.alt).toLocaleString()} ft` : ''], ['SPD', p.gs != null ? `${p.gs} kt` : ''], ['HDG', `${Math.round(p.trk)}°`], ['SQK', p.sq], ['HEX', p.hex]]) +
          link(`https://globe.adsb.lol/?icao=${p.hex}`, 'מעקב מלא');
      }]) as [string, any][]),
      ['headlines', (f) => {
        const p = f.properties;
        const here = m.queryRenderedFeatures(m.project(f.geometry.coordinates), { layers: ['headlines'] });
        const list = (here.length ? here : [f]).slice(0, 5);
        return `<div class="pp-k">כותרות</div>` + list.map((h: any) => `<a class="pp-a" href="${esc(h.properties.link)}" target="_blank" rel="noopener noreferrer" dir="auto">${esc(h.properties.title)}</a><div class="pp-k">${esc(h.properties.src)} · ${ago(h.properties.t)}</div>`).join('') + (p ? '' : '');
      }],
      ['newsgeo', (f) => {
        const p = f.properties;
        const links: { url: string; title: string }[] = JSON.parse(p.links || '[]');
        return `<div class="pp-k">מוקד סיקור · ${p.count} כתבות / 24ש׳</div><div class="pp-h" dir="auto">${esc(p.name)}</div>` + links.map((l) => link(l.url, l.title)).join('');
      }],
      ['quakes', (f) => { const p = f.properties; return `<div class="pp-k">רעידת אדמה · ${ago(p.t)}</div><div class="pp-h" dir="ltr">M${Number(p.mag).toFixed(1)}</div><div dir="ltr">${esc(p.title)}</div>${link(p.url, 'USGS')}`; }],
      ['events', (f) => { const p = f.properties; return `<div class="pp-k">${esc(p.kind)} · ${ago(p.t)}</div><div class="pp-h" dir="ltr">${esc(p.title)}</div>${link(p.url, 'מקור')}`; }],
      ['fires', (f) => { const p = f.properties; return `<div class="pp-k">מוקד חום · ${ago(p.t)}</div><div dir="ltr">${esc(p.title)}</div>`; }],
      ...(['sat-stations', 'sat-gps'].map((id) => [id, (f: any) => {
        const p = f.properties; return `<div class="pp-k">לוויין</div><div class="pp-h" dir="ltr">${esc(p.name)}</div>${grid([['ALT', `${p.alt} km`]])}`;
      }]) as [string, any][]),
      ['ships', (f) => {
        const p = f.properties;
        return `<div class="pp-k">ספינה · ${esc(p.cls)}</div><div class="pp-h" dir="ltr">${esc(p.name)}</div>` +
          grid([['MMSI', p.mmsi], ['SOG', p.sog != null ? `${p.sog} kn` : ''], ['COG', `${Math.round(p.cog)}°`], ['DEST', p.dest]]) +
          link(`https://www.marinetraffic.com/en/ais/details/ships/mmsi:${p.mmsi}`, 'MarineTraffic');
      }],
    ];
    const offs: (() => void)[] = [];
    for (const [layer, html] of handlers) {
      const click = (e: any) => { const f = e.features?.[0]; if (f) show(e.lngLat, html(f, e.lngLat)); };
      const enter = () => (m.getCanvas().style.cursor = 'pointer');
      const leave = () => (m.getCanvas().style.cursor = '');
      m.on('click', layer, click); m.on('mouseenter', layer, enter); m.on('mouseleave', layer, leave);
      offs.push(() => { m.off('click', layer, click); m.off('mouseenter', layer, enter); m.off('mouseleave', layer, leave); });
    }
    return () => offs.forEach((o) => o());
  }, [ready]);

  /* ---------------- clock ---------------- */
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  /* ---------------- actions ---------------- */
  const goView = (k: ViewKey) => {
    setView(k);
    const small = window.innerWidth < 900;
    map.current?.flyTo({ center: VIEWS[k].center, zoom: VIEWS[k].zoom - (small ? 0.8 : 0), duration: 1200 });
  };
  const pickItem = (f: FeedItem) => {
    setSel(f.link);
    if (!f.geo || !map.current) return;
    if (!on.headlines) setOn((o) => ({ ...o, headlines: true }));
    map.current.flyTo({ center: f.geo, zoom: Math.max(map.current.getZoom(), 7.5), duration: 1000 });
    popup.current?.remove();
    popup.current = new maplibregl.Popup({ maxWidth: '300px', offset: 10 })
      .setLngLat(f.geo)
      .setHTML(`<div class="pp-k">${esc(f.srcName)} · ${ago(f.t)}</div><a class="pp-a" href="${esc(f.link)}" target="_blank" rel="noopener noreferrer" dir="auto">${esc(f.title)}</a>`)
      .addTo(map.current);
    if (window.innerWidth < 900) setPanel('none');
  };

  const shown = useMemo(
    () => feed.filter((f) => (lang === 'all' || f.lang === lang) && (!geoOnly || f.geo)),
    [feed, lang, geoOnly],
  );
  const ticker = feed.slice(0, 25);
  const fmt = (tz: string) => new Date(now).toLocaleTimeString('en-GB', { timeZone: tz, hour12: false });
  const feedsUp = Object.values(feedStatus).filter(Boolean).length;
  const totalFlights = counts['flights-civ'] ?? 0;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className={`dot ${live ? '' : 'stale'}`} />
          חדר המלחמה
          <small>WAR ROOM · LIVE</small>
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
        <button className="iconbtn" onClick={() => setPanel((p) => (p === 'feed' ? 'none' : 'feed'))}>חדשות</button>
        <div className="stats">
          {!!counts.emerg && <span className="stat alert">חירום באוויר<b>{counts.emerg}</b></span>}
          <span className="stat">טיסות<b>{totalFlights || '—'}</b></span>
          <span className="stat">כותרות ממוקמות<b>{counts.headlines ?? '—'}</b></span>
        </div>
      </header>

      <div className="stage">
        <div id="map" ref={mapEl} />

        <aside className={`panel layers ${panel === 'layers' ? 'open' : ''}`}>
          <h3>שכבות <span>{Object.values(on).filter(Boolean).length} פעילות</span></h3>
          {GROUPS.map((g) => (
            <div className="group" key={g.title}>
              <div className="group-title">{g.title}</div>
              {g.items.map((i) => (
                <button key={i.id} className={`row ${on[i.id] ? 'on' : ''}`} style={{ color: i.color }} onClick={() => setOn((o) => ({ ...o, [i.id]: !o[i.id] }))}>
                  <span className="sw" />
                  <span className="lbl">{i.label}</span>
                  {notes[i.id] ? <span className="note">{notes[i.id]}</span> : <span className="n">{on[i.id] && counts[i.id] != null ? counts[i.id] : ''}</span>}
                </button>
              ))}
            </div>
          ))}
          <div className="foot">
            נתונים פתוחים: adsb.lol · GDELT · USGS · NASA EONET/FIRMS · CelesTrak · RainViewer · aisstream · RSS. כותרות ממוקמות לפי שם מקום בטקסט — לא אימות שטח.
          </div>
        </aside>

        <aside className={`panel feed ${panel === 'feed' ? 'open' : ''}`}>
          <h3>פיד חדשות <span>{feedsUp}/{Object.keys(feedStatus).length || '—'} מקורות</span></h3>
          <div className="tabs">
            <button className={lang === 'all' ? 'on' : ''} onClick={() => setLang('all')}>הכל</button>
            <button className={lang === 'he' ? 'on' : ''} onClick={() => setLang('he')}>עברית</button>
            <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>English</button>
            <button className={geoOnly ? 'on' : ''} onClick={() => setGeoOnly((g) => !g)} style={{ marginInlineStart: 'auto' }}>📍 על המפה</button>
          </div>
          <div className="items">
            {shown.length === 0 && <div className="empty">טוען כותרות…</div>}
            {shown.map((f) => (
              <div key={f.link + f.t} className={`item ${sel === f.link ? 'sel' : ''}`} dir={f.lang === 'he' ? 'rtl' : 'ltr'} onClick={() => pickItem(f)}>
                <div className="meta">
                  <span className="src">{f.srcName}</span>
                  <span className={Date.now() - f.t < 15 * 60000 ? 'fresh' : ''}>{ago(f.t)}</span>
                  {f.geo && <span className="pin">●</span>}
                  <a href={f.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ marginInlineStart: 'auto', textDecoration: 'none' }}>↗</a>
                </div>
                <div className="title">{f.title}</div>
                {f.desc && f.desc !== f.title && <div className="desc">{f.desc}</div>}
              </div>
            ))}
          </div>
        </aside>
      </div>

      <footer className="ticker">
        <span className="tag">מבזקים</span>
        <div className="vp">
          <div className="track" style={{ ['--dur' as any]: `${Math.max(60, ticker.length * 9)}s` }}>
            {ticker.map((f) => (
              <span key={f.link + f.t} dir="auto"><em>{f.srcName}</em>{f.title}</span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
