import { getJSON, getText, json, REGION } from '@/lib/fetcher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Earthquakes (USGS), natural events (NASA EONET), and optional active fires (NASA FIRMS, needs free FIRMS_MAP_KEY).
export async function GET() {
  const [quakes, eonet, firms] = await Promise.allSettled([
    getJSON<any>('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson', 300),
    getJSON<any>('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=10', 900),
    process.env.FIRMS_MAP_KEY
      ? getText(
          `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${process.env.FIRMS_MAP_KEY}/VIIRS_SNPP_NRT/${REGION.bbox.join(',')}/1`,
          900,
        )
      : Promise.reject(new Error('no FIRMS_MAP_KEY')),
  ]);

  const quakeFeats =
    quakes.status === 'fulfilled'
      ? quakes.value.features.map((f: any) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: f.geometry.coordinates.slice(0, 2) },
          properties: { kind: 'quake', mag: f.properties.mag, title: f.properties.title, t: f.properties.time, url: f.properties.url },
        }))
      : [];

  const eventFeats: any[] = [];
  if (eonet.status === 'fulfilled') {
    for (const ev of eonet.value.events || []) {
      const g = ev.geometry?.[ev.geometry.length - 1];
      if (!g || g.type !== 'Point') continue;
      const cat = ev.categories?.[0]?.id || 'other';
      eventFeats.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: g.coordinates },
        properties: { kind: cat, title: ev.title, t: new Date(g.date).getTime(), url: ev.sources?.[0]?.url || '' },
      });
    }
  }

  const fireFeats: any[] = [];
  if (firms.status === 'fulfilled') {
    const lines = firms.value.trim().split('\n');
    const head = lines.shift()?.split(',') || [];
    const iLat = head.indexOf('latitude'), iLon = head.indexOf('longitude'), iFrp = head.indexOf('frp'), iD = head.indexOf('acq_date'), iT = head.indexOf('acq_time');
    for (const l of lines.slice(0, 4000)) {
      const c = l.split(',');
      fireFeats.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [+c[iLon], +c[iLat]] },
        properties: { kind: 'fire', frp: +c[iFrp] || 0, title: `Thermal anomaly · FRP ${c[iFrp]} MW`, t: Date.parse(`${c[iD]}T${String(c[iT]).padStart(4, '0').replace(/(\d\d)(\d\d)/, '$1:$2')}:00Z`) },
      });
    }
  }

  return json(
    {
      quakes: { type: 'FeatureCollection', features: quakeFeats },
      events: { type: 'FeatureCollection', features: eventFeats },
      fires: { type: 'FeatureCollection', features: fireFeats },
      firmsEnabled: !!process.env.FIRMS_MAP_KEY,
    },
    300,
  );
}
