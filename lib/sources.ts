// Source registry. Every source is fetched independently; failures are reported in /api/feed `health`.
export type Lang = 'he' | 'en' | 'ar';
export type Camp = 'il' | 'west' | 'arab' | 'iran' | 'tg';

export const CAMP_LABEL: Record<Camp, string> = {
  il: 'ישראלי',
  west: 'מערבי',
  arab: 'ערבי',
  iran: 'איראני',
  tg: 'טלגרם',
};

export type Source = {
  id: string;
  name: string;
  url: string;
  lang: Lang;
  camp: Camp;
  kind: 'rss' | 'gnews' | 'telegram';
};

const gn = (q: string, lang: Lang) => {
  const loc = { he: 'hl=iw&gl=IL&ceid=IL:iw', en: 'hl=en-US&gl=US&ceid=US:en', ar: 'hl=ar&gl=LB&ceid=LB:ar' }[lang];
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q + ' when:1d')}&${loc}`;
};

export const SOURCES: Source[] = [
  // ---- Israeli, Hebrew
  { id: 'ynet', name: 'ynet', url: 'https://www.ynet.co.il/Integration/StoryRss1854.xml', lang: 'he', camp: 'il', kind: 'rss' },
  { id: 'maariv', name: 'מעריב', url: 'https://www.maariv.co.il/Rss/RssFeedsMivzakiChadashot', lang: 'he', camp: 'il', kind: 'rss' },
  { id: 'walla', name: 'וואלה', url: 'https://rss.walla.co.il/feed/22', lang: 'he', camp: 'il', kind: 'rss' },
  { id: 'n12', name: 'N12', url: 'https://rcs.mako.co.il/rss/news-israel.xml', lang: 'he', camp: 'il', kind: 'rss' },
  { id: 'haaretz', name: 'הארץ', url: 'https://www.haaretz.co.il/srv/rss---feedly', lang: 'he', camp: 'il', kind: 'rss' },
  { id: 'ihayom', name: 'ישראל היום', url: 'https://www.israelhayom.co.il/rss.xml', lang: 'he', camp: 'il', kind: 'rss' },
  { id: 'globes', name: 'גלובס', url: 'https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=2', lang: 'he', camp: 'il', kind: 'rss' },
  // ---- Israeli, English
  { id: 'toi', name: 'Times of Israel', url: 'https://www.timesofisrael.com/liveblog/feed/', lang: 'en', camp: 'il', kind: 'rss' },
  { id: 'jpost', name: 'Jerusalem Post', url: 'https://www.jpost.com/rss/rssfeedsfrontpage.aspx', lang: 'en', camp: 'il', kind: 'rss' },
  { id: 'ynetnews', name: 'Ynetnews', url: 'https://www.ynetnews.com/Integration/StoryRss3089.xml', lang: 'en', camp: 'il', kind: 'rss' },
  { id: 'inn', name: 'Arutz Sheva', url: 'https://www.israelnationalnews.com/Rss.aspx', lang: 'en', camp: 'il', kind: 'rss' },
  // ---- Western
  { id: 'bbc', name: 'BBC', url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml', lang: 'en', camp: 'west', kind: 'rss' },
  { id: 'guardian', name: 'The Guardian', url: 'https://www.theguardian.com/world/middleeast/rss', lang: 'en', camp: 'west', kind: 'rss' },
  { id: 'nyt', name: 'New York Times', url: 'https://rss.nytimes.com/services/xml/rss/nyt/MiddleEast.xml', lang: 'en', camp: 'west', kind: 'rss' },
  { id: 'france24', name: 'France 24', url: 'https://www.france24.com/en/middle-east/rss', lang: 'en', camp: 'west', kind: 'rss' },
  // ---- Arab
  { id: 'aje', name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', lang: 'en', camp: 'arab', kind: 'rss' },
  { id: 'alarabiya', name: 'Al Arabiya', url: 'https://english.alarabiya.net/feed/rss2/en.xml', lang: 'en', camp: 'arab', kind: 'rss' },
  { id: 'mee', name: 'Middle East Eye', url: 'https://www.middleeasteye.net/rss', lang: 'en', camp: 'arab', kind: 'rss' },
  // ---- Iranian (state-affiliated and opposition, labelled separately in the UI)
  { id: 'tasnim', name: 'Tasnim (ממלכתי)', url: 'https://www.tasnimnews.com/en/rss/feed/0/7/0/all-stories', lang: 'en', camp: 'iran', kind: 'rss' },
  { id: 'iranintl', name: 'Iran International (אופוזיציה)', url: 'https://www.iranintl.com/en/feed', lang: 'en', camp: 'iran', kind: 'rss' },
  // ---- Google News searches (hundreds of outlets; each item keeps its original outlet name)
  { id: 'gn-he-idf', name: 'Google News · צה"ל', url: gn('צה"ל', 'he'), lang: 'he', camp: 'il', kind: 'gnews' },
  { id: 'gn-he-north', name: 'Google News · לבנון', url: gn('לבנון OR חיזבאללה', 'he'), lang: 'he', camp: 'il', kind: 'gnews' },
  { id: 'gn-he-iran', name: 'Google News · איראן', url: gn('איראן', 'he'), lang: 'he', camp: 'il', kind: 'gnews' },
  { id: 'gn-he-gaza', name: 'Google News · עזה', url: gn('עזה', 'he'), lang: 'he', camp: 'il', kind: 'gnews' },
  { id: 'gn-en-israel', name: 'Google News · Israel', url: gn('Israel OR Gaza OR Hezbollah', 'en'), lang: 'en', camp: 'west', kind: 'gnews' },
  { id: 'gn-en-iran', name: 'Google News · Iran', url: gn('Iran OR Hormuz', 'en'), lang: 'en', camp: 'west', kind: 'gnews' },
  { id: 'gn-en-yemen', name: 'Google News · Yemen', url: gn('Houthi OR Yemen OR "Red Sea"', 'en'), lang: 'en', camp: 'west', kind: 'gnews' },
  { id: 'gn-en-syria', name: 'Google News · Syria', url: gn('Syria OR Lebanon OR Iraq', 'en'), lang: 'en', camp: 'west', kind: 'gnews' },
  { id: 'gn-ar-isr', name: 'Google News · إسرائيل', url: gn('إسرائيل', 'ar'), lang: 'ar', camp: 'arab', kind: 'gnews' },
  { id: 'gn-ar-gaza', name: 'Google News · غزة', url: gn('غزة', 'ar'), lang: 'ar', camp: 'arab', kind: 'gnews' },
  { id: 'gn-ar-leb', name: 'Google News · لبنان', url: gn('لبنان OR حزب الله', 'ar'), lang: 'ar', camp: 'arab', kind: 'gnews' },
  { id: 'gn-ar-iran', name: 'Google News · إيران', url: gn('إيران', 'ar'), lang: 'ar', camp: 'arab', kind: 'gnews' },
];

// Optional: public Telegram channels, comma-separated usernames in TELEGRAM_CHANNELS (e.g. "channel_a,channel_b").
// Telegram posts are always treated as unverified until another outlet reports the same story.
export function telegramSources(): Source[] {
  return (process.env.TELEGRAM_CHANNELS || '')
    .split(',')
    .map((s) => s.trim().replace(/^@/, ''))
    .filter((s) => /^[A-Za-z0-9_]{4,64}$/.test(s))
    .map((ch) => ({ id: `tg-${ch}`, name: `@${ch}`, url: `https://t.me/s/${ch}`, lang: 'he' as Lang, camp: 'tg' as Camp, kind: 'telegram' as const }));
}

// Outlet name → camp, for Google News items (which come from many different outlets).
const OUTLET_CAMPS: [RegExp, Camp][] = [
  [/ynet|maariv|מעריב|walla|וואלה|haaretz|הארץ|israel hayom|ישראל היום|mako|n12|חדשות 12|channel 12|kan|כאן|i24|times of israel|jerusalem post|jpost|arutz|israel national|globes|גלובס|calcalist|כלכליסט|srugim|סרוגים|bhol|בחדרי|kikar|כיכר|davar|דבר|13tv|רשת 13|ice\b|the marker|דה מרקר|zman|זמן ישראל|0404|news1|מידה|now 14|ערוץ 14|c14/i, 'il'],
  [/tasnim|irna|press ?tv|tehran times|mehr|fars|iran international|iranwire|kayhan/i, 'iran'],
  [/al ?jazeera|الجزيرة|al ?arabiya|العربية|asharq|الشرق|mayadeen|الميادين|middle east eye|the national|arab news|al-monitor|almanar|المنار|anadolu|الأناضول|sky news arabia|سكاي نيوز|rudaw|the new arab|العربي الجديد|al-quds|القدس|wafa|وفا|annahar|النهار|al akhbar|الأخبار|aawsat|enab baladi|sana|سانا|youm7|اليوم السابع|ahram|الأهرام|cnn arabic|bbc عربي|france 24 arabic|فرانس 24|rt arabic|روسيا اليوم|almasry|المصري/i, 'arab'],
  [/reuters|associated press|\bap\b|bbc|cnn|new york times|nytimes|guardian|washington post|wall street|wsj|bloomberg|financial times|ft\.com|france 24|dw|deutsche welle|afp|sky news|npr|axios|politico|fox|cbs|nbc|abc news|economist|the times|telegraph|independent|euronews|le monde|spiegel|the hill|newsweek|usa today|time\b|atlantic/i, 'west'],
];

export function campForOutlet(name: string, fallback: Camp): Camp {
  for (const [re, c] of OUTLET_CAMPS) if (re.test(name)) return c;
  return fallback;
}
