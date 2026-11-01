import type maplibregl from 'maplibre-gl';
import { SEV_COLOR } from './ui';

export type LayerId =
  | 'stories' | 'alerts' | 'gpsjam' | 'outages'
  | 'flights-civ'
  | 'quakes' | 'events' | 'fires' | 'radar'
  | 'sat-stations' | 'sat-gps' | 'ships'
  | 'night';

export type LayerDef = { id: LayerId; label: string; color: string; on: boolean; source: string };
export const GROUPS: { title: string; items: LayerDef[] }[] = [
  { title: 'מודיעין', items: [
    { id: 'stories', label: 'סיפורים מוצלבים', color: '#ff2d55', on: true, source: '~30 כלי תקשורת + Google News' },
    { id: 'alerts', label: 'אזעקות פיקוד העורף', color: '#ff3b3b', on: true, source: 'פיקוד העורף / צבע אדום' },
    { id: 'gpsjam', label: 'שיבושי GPS (יומי)', color: '#ff9f1c', on: true, source: 'gpsjam.org' },
    { id: 'outages', label: 'ניתוקי אינטרנט', color: '#c77dff', on: true, source: 'IODA · Georgia Tech' },
  ]},
  { title: 'אוויר', items: [
    { id: 'flights-civ', label: 'תעופה אזרחית', color: '#8fb8d4', on: true, source: 'adsb.lol' },
  ]},
  { title: 'טבע ואסונות', items: [
    { id: 'quakes', label: 'רעידות אדמה', color: '#ffe066', on: true, source: 'USGS' },
    { id: 'events', label: 'סופות, הרי געש, שריפות', color: '#ff7a45', on: false, source: 'NASA EONET' },
    { id: 'fires', label: 'מוקדי חום', color: '#ff5a1f', on: false, source: 'NASA FIRMS' },
    { id: 'radar', label: 'מכ״ם גשם', color: '#3fa8ff', on: false, source: 'RainViewer' },
  ]},
  { title: 'חלל וים', items: [
    { id: 'sat-stations', label: 'תחנות חלל + ISS', color: '#b48cff', on: true, source: 'CelesTrak' },
    { id: 'sat-gps', label: 'לווייני GPS', color: '#7ee0c3', on: false, source: 'CelesTrak' },
    { id: 'ships', label: 'ספינות מסחר (AIS)', color: '#3fd0ff', on: false, source: 'aisstream.io' },
  ]},
  { title: 'רקע', items: [{ id: 'night', label: 'יום / לילה', color: '#4a5866', on: true, source: 'חישוב' }] },
];
export const COLOR = Object.fromEntries(GROUPS.flatMap((g) => g.items.map((i) => [i.id, i.color]))) as Record<LayerId, string>;
export const DEFAULT_ON = Object.fromEntries(GROUPS.flatMap((g) => g.items.map((i) => [i.id, i.on]))) as Record<LayerId, boolean>;

export const MAP_LAYERS: Record<LayerId, string[]> = {
  stories: ['stories-pulse', 'stories'], alerts: ['alerts-halo', 'alerts'], gpsjam: ['gpsjam'], outages: ['outages'],
  'flights-civ': ['flights-civ'],
  quakes: ['quakes'], events: ['events'], fires: ['fires'], radar: ['radar'],
  'sat-stations': ['sat-stations', 'iss-track'], 'sat-gps': ['sat-gps'],
  ships: ['ships'], night: ['night'],
};

export const SOURCES = ['night', 'gpsjam', 'outages', 'flights', 'stories', 'alerts', 'quakes', 'events', 'fires', 'sats', 'iss-track', 'ships'];
export const EMPTY = { type: 'FeatureCollection', features: [] } as any;

function makeIcon(kind: 'plane' | 'ship', size = 48) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.translate(size / 2, size / 2);
  g.scale(size / 48, size / 48);
  g.beginPath();
  if (kind === 'plane') {
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

export function setupLayers(m: maplibregl.Map, isOn: (id: LayerId) => boolean) {
  const vis = (id: LayerId) => (isOn(id) ? 'visible' : 'none') as 'visible' | 'none';
  m.addImage('plane', makeIcon('plane'), { sdf: true, pixelRatio: 2 });
  m.addImage('ship', makeIcon('ship'), { sdf: true, pixelRatio: 2 });
  const firstSymbol = m.getStyle().layers?.find((l) => l.type === 'symbol')?.id;
  SOURCES.forEach((s) => m.addSource(s, { type: 'geojson', data: EMPTY }));

  // under labels
  m.addLayer({ id: 'night', type: 'fill', source: 'night', layout: { visibility: vis('night') }, paint: { 'fill-color': '#000', 'fill-opacity': 0.3 } }, firstSymbol);
  m.addLayer({ id: 'gpsjam', type: 'fill', source: 'gpsjam', layout: { visibility: vis('gpsjam') }, paint: {
    'fill-color': ['step', ['get', 'pct'], '#ffd23f', 10, '#ff3b3b'],
    'fill-opacity': ['interpolate', ['linear'], ['get', 'pct'], 2, 0.18, 10, 0.32, 40, 0.5],
    'fill-outline-color': 'rgba(0,0,0,0)',
  }}, firstSymbol);

  m.addLayer({ id: 'outages', type: 'circle', source: 'outages', layout: { visibility: vis('outages') }, paint: {
    'circle-color': COLOR.outages, 'circle-opacity': 0.18, 'circle-stroke-color': COLOR.outages, 'circle-stroke-width': 1.5,
    'circle-radius': ['interpolate', ['linear'], ['get', 'log'], 0, 8, 3, 18, 6, 34],
  }});
  m.addLayer({ id: 'fires', type: 'circle', source: 'fires', layout: { visibility: vis('fires') }, paint: {
    'circle-color': COLOR.fires, 'circle-opacity': 0.75, 'circle-blur': 0.4, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 1.5, 8, 4],
  }});
  m.addLayer({ id: 'events', type: 'circle', source: 'events', layout: { visibility: vis('events') }, paint: {
    'circle-color': ['match', ['get', 'kind'], 'wildfires', '#ff5a1f', 'severeStorms', '#3fa8ff', 'volcanoes', '#ff2e2e', 'floods', '#2f7bff', COLOR.events],
    'circle-radius': 6, 'circle-stroke-color': '#000', 'circle-stroke-width': 1, 'circle-opacity': 0.85,
  }});
  m.addLayer({ id: 'quakes', type: 'circle', source: 'quakes', layout: { visibility: vis('quakes') }, paint: {
    'circle-color': COLOR.quakes, 'circle-opacity': 0.22, 'circle-stroke-color': COLOR.quakes, 'circle-stroke-width': 1.2,
    'circle-radius': ['interpolate', ['linear'], ['get', 'mag'], 2.5, 4, 5, 10, 7, 22],
  }});
  m.addLayer({ id: 'iss-track', type: 'line', source: 'iss-track', layout: { visibility: vis('sat-stations') }, paint: { 'line-color': COLOR['sat-stations'], 'line-width': 1, 'line-dasharray': [2, 3], 'line-opacity': 0.55 } });
  (['sat-stations', 'sat-gps'] as LayerId[]).forEach((id) =>
    m.addLayer({ id, type: 'circle', source: 'sats', filter: ['==', ['get', 'group'], id], layout: { visibility: vis(id) }, paint: {
      'circle-color': COLOR[id], 'circle-radius': ['case', ['==', ['get', 'iss'], 1], 6, 2.6],
      'circle-stroke-color': '#000', 'circle-stroke-width': ['case', ['==', ['get', 'iss'], 1], 2, 0.5],
    }}),
  );
  m.addLayer({ id: 'ships', type: 'symbol', source: 'ships', layout: {
    visibility: vis('ships'), 'icon-image': 'ship', 'icon-size': ['interpolate', ['linear'], ['zoom'], 3, 0.4, 9, 0.75],
    'icon-rotate': ['get', 'cog'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true,
  }, paint: { 'icon-color': ['match', ['get', 'cls'], 'tanker', '#ffb347', COLOR.ships], 'icon-opacity': 0.9 } });
  m.addLayer({ id: 'flights-civ', type: 'symbol', source: 'flights', layout: {
    visibility: vis('flights-civ'), 'icon-image': 'plane', 'icon-rotate': ['get', 'trk'], 'icon-rotation-alignment': 'map',
    'icon-allow-overlap': true, 'icon-ignore-placement': true,
    'icon-size': ['interpolate', ['linear'], ['zoom'], 2, 0.45, 6, 0.8, 10, 1.25],
  }, paint: {
    'icon-color': ['case', ['==', ['get', 'kind'], 'emerg'], '#ff2bd6', ['<', ['coalesce', ['get', 'alt'], 0], 10000], '#5f7f95', COLOR['flights-civ']],
    'icon-halo-color': '#06080b', 'icon-halo-width': 1.2,
  }});

  // alerts
  m.addLayer({ id: 'alerts-halo', type: 'circle', source: 'alerts', layout: { visibility: vis('alerts') }, paint: {
    'circle-color': COLOR.alerts, 'circle-blur': 1, 'circle-radius': 24, 'circle-opacity': ['get', 'fade'],
  }});
  m.addLayer({ id: 'alerts', type: 'circle', source: 'alerts', layout: { visibility: vis('alerts') }, paint: {
    'circle-color': COLOR.alerts, 'circle-radius': 6, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5, 'circle-opacity': ['max', 0.5, ['get', 'fade']],
  }});

  // stories — on top
  m.addLayer({ id: 'stories-pulse', type: 'circle', source: 'stories', filter: ['==', ['get', 'fresh'], 1], layout: { visibility: vis('stories') }, paint: {
    'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 2, 'circle-radius': 10, 'circle-stroke-opacity': 0.8,
  }});
  m.addLayer({ id: 'stories', type: 'circle', source: 'stories', layout: { visibility: vis('stories') }, paint: {
    'circle-color': ['get', 'color'],
    'circle-radius': ['+', 4, ['*', 2.6, ['sqrt', ['get', 'n']]]],
    'circle-opacity': ['interpolate', ['linear'], ['get', 'ageH'], 0, 0.95, 12, 0.55, 24, 0.35],
    'circle-stroke-color': ['case', ['==', ['get', 'ver'], 'multi'], '#ffffff', '#0b0f14'],
    'circle-stroke-width': ['case', ['==', ['get', 'ver'], 'multi'], 1.6, 1],
  }});
}

/** Expanding ring on fresh stories. Returns a stop function. */
export function animatePulse(m: maplibregl.Map) {
  let raf = 0;
  const loop = (t: number) => {
    const p = (t % 1800) / 1800;
    if (m.getLayer('stories-pulse')) {
      m.setPaintProperty('stories-pulse', 'circle-radius', 8 + p * 22);
      m.setPaintProperty('stories-pulse', 'circle-stroke-opacity', 0.9 * (1 - p));
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
}

export const sevColorExpr = SEV_COLOR;
