import { json, REGION } from '@/lib/fetcher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 20;

// aisstream.io is websocket-only and blocks browsers, so we open a short server-side
// session, collect positions for a few seconds, and return a cached snapshot.
// Requires free AISSTREAM_KEY (https://aisstream.io). Without it the layer is disabled.
let cache: { t: number; data: any } | null = null;

export async function GET() {
  const key = process.env.AISSTREAM_KEY;
  if (!key) return json({ type: 'FeatureCollection', features: [], disabled: true }, 300);
  if (cache && Date.now() - cache.t < 60_000) return json(cache.data, 60);

  const WS: any = (globalThis as any).WebSocket;
  if (!WS) return json({ type: 'FeatureCollection', features: [], error: 'no WebSocket in runtime' }, 60);

  const ships = new Map<number, any>();
  await new Promise<void>((resolve) => {
    const ws = new WS('wss://stream.aisstream.io/v0/stream');
    const done = () => { try { ws.close(); } catch {} resolve(); };
    const timer = setTimeout(done, 9000);
    ws.onopen = () => {
      const [w, s, e, n] = REGION.bbox;
      ws.send(JSON.stringify({ APIKey: key, BoundingBoxes: [[[s, w], [n, e]]], FilterMessageTypes: ['PositionReport', 'ShipStaticData'] }));
    };
    ws.onmessage = async (ev: any) => {
      try {
        const txt = typeof ev.data === 'string' ? ev.data : await new Response(ev.data).text();
        const m = JSON.parse(txt);
        const meta = m.MetaData || {};
        const id = meta.MMSI;
        if (!id) return;
        const prev = ships.get(id) || {};
        if (m.MessageType === 'PositionReport') {
          const p = m.Message.PositionReport;
          ships.set(id, { ...prev, mmsi: id, name: (meta.ShipName || prev.name || '').trim(), lat: p.Latitude, lon: p.Longitude, sog: p.Sog, cog: p.Cog });
        } else if (m.MessageType === 'ShipStaticData') {
          const s = m.Message.ShipStaticData;
          ships.set(id, { ...prev, mmsi: id, name: (s.Name || prev.name || '').trim(), stype: s.Type, dest: (s.Destination || '').trim() });
        }
      } catch {}
      if (ships.size > 3000) { clearTimeout(timer); done(); }
    };
    ws.onerror = () => { clearTimeout(timer); done(); };
  });

  const features = [...ships.values()]
    .filter((s) => s.lat != null && s.lon != null && s.stype !== 35) // commercial traffic only
    .map((s) => {
      const t = s.stype ?? 0;
      const cls = t >= 80 && t <= 89 ? 'tanker' : t >= 70 && t <= 79 ? 'cargo' : t >= 60 && t <= 69 ? 'passenger' : 'other';
      return { type: 'Feature', geometry: { type: 'Point', coordinates: [s.lon, s.lat] }, properties: { mmsi: s.mmsi, name: s.name || String(s.mmsi), sog: s.sog ?? null, cog: s.cog ?? 0, dest: s.dest || '', cls } };
    });
  const data = { type: 'FeatureCollection', features };
  cache = { t: Date.now(), data };
  return json(data, 60);
}
