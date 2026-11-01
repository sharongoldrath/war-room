// TEMPORARY: checks which candidate sources are reachable from Vercel. Remove after evaluation.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  const now = Math.floor(Date.now() / 1000);
  const y = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  const urls: Record<string, string> = {
    gnews_en: 'https://news.google.com/rss/search?q=Israel+when:1d&hl=en-US&gl=US&ceid=US:en',
    gnews_he: 'https://news.google.com/rss/search?q=%D7%99%D7%A9%D7%A8%D7%90%D7%9C+when:1d&hl=iw&gl=IL&ceid=IL:iw',
    gnews_ar: 'https://news.google.com/rss/search?q=%D8%A5%D8%B3%D8%B1%D8%A7%D8%A6%D9%8A%D9%84+when:1d&hl=ar&gl=LB&ceid=LB:ar',
    ynetnews: 'https://www.ynetnews.com/Integration/StoryRss3089.xml',
    inn: 'https://www.israelnationalnews.com/Rss.aspx',
    guardian: 'https://www.theguardian.com/world/middleeast/rss',
    nyt: 'https://rss.nytimes.com/services/xml/rss/nyt/MiddleEast.xml',
    france24: 'https://www.france24.com/en/middle-east/rss',
    mee: 'https://www.middleeasteye.net/rss',
    alarabiya: 'https://english.alarabiya.net/feed/rss2/en.xml',
    iranintl: 'https://www.iranintl.com/en/feed',
    tasnim: 'https://www.tasnimnews.com/en/rss/feed/0/7/0/all-stories',
    toi: 'https://www.timesofisrael.com/feed/',
    toi_live: 'https://www.timesofisrael.com/liveblog/feed/',
    walla: 'https://rss.walla.co.il/feed/22',
    haaretz: 'https://www.haaretz.co.il/srv/rss---feedly',
    ihayom: 'https://www.israelhayom.co.il/rss.xml',
    n12: 'https://rcs.mako.co.il/rss/news-israel.xml',
    globes: 'https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=2',
    jpost_front: 'https://www.jpost.com/rss/rssfeedsfrontpage.aspx',
    gdelt_doc: 'https://api.gdeltproject.org/api/v2/doc/doc?query=israel&mode=artlist&format=json&maxrecords=5&timespan=6h',
    gdelt_geo: 'https://api.gdeltproject.org/api/v2/geo/geo?query=israel&mode=PointData&format=GeoJSON&timespan=24h',
    ioda_summary: `https://api.ioda.inetintel.cc.gatech.edu/v2/outages/summary?from=${now - 86400}&until=${now}&entityType=country`,
    ioda_alerts: `https://api.ioda.inetintel.cc.gatech.edu/v2/outages/alerts?from=${now - 86400}&until=${now}`,
    gpsjam: `https://gpsjam.org/data/${y}-h3_4.csv`,
    tzevaadom_hist: 'https://api.tzevaadom.co.il/alerts-history',
    tzevaadom_notif: 'https://api.tzevaadom.co.il/notifications',
    oref: 'https://www.oref.org.il/warningMessages/alert/History/AlertsHistory.json',
    tg_test: 'https://t.me/s/telegram',
  };
  const out: Record<string, any> = {};
  await Promise.all(
    Object.entries(urls).map(async ([k, u]) => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 20000);
      const t0 = Date.now();
      try {
        const r = await fetch(u, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', Accept: '*/*' }, cache: 'no-store' });
        const txt = await r.text();
        out[k] = { s: r.status, ms: Date.now() - t0, ct: r.headers.get('content-type'), len: txt.length, head: txt.slice(0, 220).replace(/\s+/g, ' ') };
      } catch (e: any) {
        out[k] = { err: String(e?.cause?.code || e?.message || e), ms: Date.now() - t0 };
      } finally {
        clearTimeout(t);
      }
    }),
  );
  return new Response(JSON.stringify(out, null, 1), { headers: { 'content-type': 'application/json; charset=utf-8' } });
}
