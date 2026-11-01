# WAR ROOM — חדר המלחמה

Live situational map for Israel and the Middle East, built on public open data. Next.js 14 (App Router) + MapLibre GL, deployable on Vercel with zero required keys.

## What works now (v1)

| Layer | Source | Key needed | Refresh |
|---|---|---|---|
| Civil aviation (+ emergency squawks 7500/7600/7700) | [adsb.lol](https://api.adsb.lol/docs) open API, 10 tiles × 250nm across the region | none | 15s |
| Headlines on the map | RSS: ynet, Maariv, Times of Israel, JPost, BBC ME, Al Jazeera — geotagged by place name in title | none | 90s |
| News-coverage hotspots | [GDELT GEO 2.0](https://blog.gdeltproject.org/gdelt-geo-2-0-api-debuts/) (media mentions, not verified events) | none | 10m |
| Earthquakes | USGS M2.5+ / 24h | none | 5m |
| Storms, volcanoes, wildfires | NASA EONET v3 | none | 5m |
| Thermal anomalies (fires) | NASA FIRMS VIIRS | `FIRMS_MAP_KEY` (free) | 5m |
| Rain radar | RainViewer | none | 10m |
| Space stations + ISS ground track, GPS constellation | CelesTrak TLE, propagated in-browser (satellite.js) | none | 2s |
| Commercial shipping | aisstream.io (short server-side snapshot) | `AISSTREAM_KEY` (free) | 60s |
| Day/night terminator | computed | none | 1m |

Each layer loads independently; a failing source never breaks the map. Military aircraft and military satellites are deliberately excluded (see project spec, §5).

**Honesty notes:** headline pins are placed by matching a place name in the text — they show *where a story is about*, not a verified incident location. GDELT circles measure media attention, not events.

## Run locally

```bash
npm install
npm run dev   # http://localhost:3000
```

## Deploy (Vercel)

1. vercel.com → Add New → Project → import `sharongoldrath/war-room` → Deploy (no settings needed).
2. Optional, Settings → Environment Variables:
   - `FIRMS_MAP_KEY` — free at https://firms.modaps.eosdis.nasa.gov/api/map_key/
   - `AISSTREAM_KEY` — free at https://aisstream.io (sign in with GitHub → API Keys)
3. Redeploy after adding keys.

## Structure

```
app/api/flights    adsb.lol tiles → deduped GeoJSON
app/api/feed       RSS aggregation + gazetteer geotagging
app/api/news-geo   GDELT GEO proxy
app/api/hazards    USGS + EONET + FIRMS
app/api/tle        CelesTrak TLE groups
app/api/ships      aisstream snapshot
components/WarRoom.tsx   map, layer panel, feed, ticker
lib/geo.ts         terminator, satellite propagation, helpers
lib/gazetteer.ts   Hebrew/English place names → coordinates
```

## Roadmap (from the full WAR ROOM spec)

- **Phase 2 — Database:** Supabase + PostGIS, standardized event schema, scheduled ingestion (Vercel Cron), deduplication of articles into event entities, history.
- **Phase 3 — Intelligence features:** event detail panel, severity + verification fields, country profiles (World Bank / IMF), timeline with replay, CMD+K search, "What changed since your last visit".
- **Phase 4 — Sources needing credentials:** ACLED (conflict events), Cloudflare Radar (internet outages).
- **Phase 5 — AI analyst:** retrieval-grounded daily brief with citations, event explanation, source comparison.
