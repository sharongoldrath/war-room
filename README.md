# WAR ROOM — חדר המלחמה

Live situational map for Israel and the Middle East, built on public open data. Next.js 14 (App Router) + MapLibre GL, deployable on Vercel with zero required keys.

## What it does (v2)

**Cross-referenced intelligence feed.** ~30 sources in Hebrew, English and Arabic (Israeli outlets, Western, Arab, Iranian state + opposition, and Google News searches that surface hundreds of outlets) are fetched independently, then:

1. **Validate** — items older than 48h are dropped (some feeds serve year-old entries); failed or stale sources are listed in the *מקורות* tab, never silently replaced.
2. **Normalize & dedupe** — same link or same outlet+title is kept once.
3. **Geolocate** — trilingual gazetteer (~90 places, demonyms included). Country-level mentions are used for clustering but never pinned.
4. **Cluster into stories** — reports about the same event are grouped across languages using shared places, actors (Hamas/חמאס/حماس…) and event types (strike/תקיפה/غارة…) inside a 6h window.
5. **Score** — *independent sources* counts distinct outlets after collapsing near-identical (syndicated) copies. Verification: `multi` (2+ independent), `single`, `unverified` (single report phrased as a claim, or Telegram-only). Severity is a keyword-based estimate, labelled as such.
6. **Perspective view** — each story shows what Israeli, Western, Arab and Iranian outlets reported, side by side.

**Zone pulse** — security stories per arena (Gaza, Lebanon, Iran, Yemen…) over 24h with hourly sparklines. **What changed** — stories that appeared since your last visit are marked *חדש*.

| Layer | Source | Key | Refresh |
|---|---|---|---|
| Cross-referenced stories | RSS + Google News RSS | none | 2m |
| Home Front Command alerts | oref.org.il (geo-restricted to Israel) → fallback tzevaadom from the browser | none | 20s |
| GPS interference | gpsjam.org daily H3 data | none | daily |
| Internet outages | IODA (Georgia Tech) | none | 10m |
| Civil aviation (+ emergency squawks) | adsb.lol | none | 15s |
| Earthquakes / natural events / fires | USGS / NASA EONET / NASA FIRMS | FIRMS_MAP_KEY | 5m |
| Rain radar | RainViewer | none | 10m |
| ISS + GPS constellation | CelesTrak | none | 2s |
| Commercial shipping | aisstream.io | AISSTREAM_KEY | 60s |

Military aircraft, military satellites and military vessels are deliberately excluded.

**Optional Telegram:** set `TELEGRAM_CHANNELS=channel_a,channel_b` (public channels). Telegram-only stories are always marked unverified.

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
   - `TELEGRAM_CHANNELS` — comma-separated public channel usernames
3. Redeploy after adding keys.

## Structure

```
app/api/feed      sources → validate → dedupe → geolocate → cluster → score
app/api/alerts    Home Front Command alerts (oref / tzevaadom)
app/api/gpsjam    GPS interference cells (H3)
app/api/outages   IODA per-country outage summary
app/api/flights · hazards · tle · ships
lib/sources.ts    source registry + outlet → camp mapping
lib/gazetteer.ts  trilingual places + word-boundary matcher
lib/nlp.ts        actors, event concepts, category, severity
lib/cluster.ts    story clustering, syndication collapse, zone pulse
lib/mapLayers.ts  map layer definitions
components/       WarRoom (map), StoryFeed, PulseStrip
```

## Roadmap (from the full WAR ROOM spec)

- **Phase 2 — Database:** Supabase + PostGIS, standardized event schema, scheduled ingestion (Vercel Cron), deduplication of articles into event entities, history.
- **Phase 3 — Intelligence features:** event detail panel, severity + verification fields, country profiles (World Bank / IMF), timeline with replay, CMD+K search, "What changed since your last visit".
- **Phase 4 — Sources needing credentials:** ACLED (conflict events), Cloudflare Radar (internet outages).
- **Phase 5 — AI analyst:** retrieval-grounded daily brief with citations, event explanation, source comparison.
