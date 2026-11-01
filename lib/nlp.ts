// Lightweight trilingual text analysis: concepts, actors, category, severity, claim markers.
// Deliberately rule-based and transparent — every label it produces can be traced to a keyword.
import { wordMatcher } from './gazetteer';

type Dict = Record<string, string[]>;

export const ACTORS: Dict = {
  hamas: ['Hamas', 'חמאס', 'حماس', 'القسام', 'Qassam'],
  hezbollah: ['Hezbollah', 'Hizbollah', 'חיזבאללה', 'حزب الله'],
  houthis: ['Houthi', 'Houthis', "חות'ים", 'חותים', "החות'ים", 'الحوثي', 'الحوثيين', 'أنصار الله'],
  idf: ['IDF', 'Israeli army', 'Israeli military', 'צה"ל', 'צה״ל', 'צהל', 'الجيش الإسرائيلي', 'جيش الاحتلال'],
  irgc: ['IRGC', 'Revolutionary Guard', 'משמרות המהפכה', 'الحرس الثوري'],
  pij: ['Islamic Jihad', "הג'יהאד האסלאמי", 'الجهاد الإسلامي', 'سرايا القدس'],
  unifil: ['UNIFIL', 'יוניפי"ל', 'اليونيفيل'],
  netanyahu: ['Netanyahu', 'נתניהו', 'نتنياهو'],
  trump: ['Trump', 'טראמפ', 'ترامب'],
  khamenei: ['Khamenei', 'חמינאי', 'خامنئي'],
};

export const CONCEPTS: Dict = {
  strike: ['airstrike', 'air strike', 'strike', 'strikes', 'struck', 'bombed', 'bombing', 'shelling', 'תקיפה', 'תקיפות', 'תקף', 'הותקף', 'הפציץ', 'הפצצה', 'הפגזה', 'غارة', 'غارات', 'قصف', 'استهداف'],
  rocket: ['rocket', 'rockets', 'missile', 'missiles', 'ballistic', 'interceptor', 'intercepted', 'טיל', 'טילים', 'רקטה', 'רקטות', 'שיגור', 'שיגורים', 'יירוט', 'יורט', 'صاروخ', 'صواريخ', 'اعتراض'],
  drone: ['drone', 'drones', 'UAV', 'כטב"ם', 'כטב״ם', 'כטבם', 'מל"ט', 'רחפן', 'مسيرة', 'مسيّرة', 'طائرة مسيرة'],
  killed: ['killed', 'dead', 'deaths', 'death toll', 'fatalities', 'נהרג', 'נהרגו', 'הרוגים', 'הרוג', 'נרצח', 'מתו', 'חלל', 'חללים', 'قتلى', 'قتيل', 'شهداء', 'شهيد', 'استشهاد', 'مقتل'],
  wounded: ['wounded', 'injured', 'injuries', 'נפצע', 'נפצעו', 'פצועים', 'פצוע', 'جرحى', 'إصابة', 'إصابات'],
  sirens: ['siren', 'sirens', 'red alert', 'אזעקה', 'אזעקות', 'צבע אדום', 'התרעה', 'صفارات الإنذار', 'صافرات'],
  attack: ['attack', 'attacks', 'terror', 'terrorist', 'shooting', 'stabbing', 'ramming', 'פיגוע', 'מחבל', 'מחבלים', 'ירי', 'דקירה', 'דריסה', 'هجوم', 'عملية', 'إطلاق نار', 'طعن'],
  explosion: ['explosion', 'blast', 'explosions', 'פיצוץ', 'פיצוצים', 'انفجار', 'انفجارات'],
  ground: ['ground operation', 'incursion', 'troops', 'raid', 'תמרון', 'פשיטה', 'כוחות', 'מבצע', 'اقتحام', 'توغل', 'عملية برية'],
  evacuation: ['evacuation', 'evacuate', 'displaced', 'פינוי', 'התפנו', 'מפונים', 'إخلاء', 'نزوح', 'نازحين'],
  ceasefire: ['ceasefire', 'truce', 'הפסקת אש', 'הפוגה', 'רגיעה', 'وقف إطلاق النار', 'هدنة', 'التهدئة'],
  talks: ['talks', 'negotiations', 'negotiators', 'mediators', 'deal', 'agreement', 'diplomacy', 'משא ומתן', 'מגעים', 'שיחות', 'הסכם', 'עסקה', 'מתווכים', 'مفاوضات', 'محادثات', 'اتفاق', 'وساطة'],
  hostages: ['hostage', 'hostages', 'captives', 'חטוף', 'חטופים', 'חטופות', 'رهائن', 'الأسرى', 'المحتجزين'],
  election: ['election', 'elections', 'coalition', 'Knesset', 'בחירות', 'קואליציה', 'כנסת', 'הרכבת ממשלה', 'הקלפי', 'انتخابات', 'الكنيست'],
  sanctions: ['sanctions', 'sanction', 'סנקציות', 'עיצומים', 'عقوبات'],
  nuclear: ['nuclear', 'uranium', 'enrichment', 'IAEA', 'גרעין', 'גרעיני', 'העשרה', 'אורניום', 'نووي', 'النووي', 'تخصيب'],
  shipping: ['shipping', 'tanker', 'vessel', 'ship', 'LNG carrier', 'מכלית', 'ספינה', 'אוניה', 'ناقلة', 'سفينة'],
  oil: ['oil', 'Brent', 'crude', 'gas prices', 'נפט', 'דלק', 'النفط', 'خام'],
  economy: ['shekel', 'inflation', 'interest rate', 'stocks', 'market', 'שקל', 'אינפלציה', 'ריבית', 'בורסה', 'מניות', 'التضخم', 'البورصة'],
  arrest: ['arrested', 'arrest', 'detained', 'נעצר', 'נעצרו', 'מעצר', 'עצרו', 'اعتقال', 'اعتقل'],
  accident: ['accident', 'crash', 'collision', 'תאונה', 'תאונת', 'התנגשות', 'حادث', 'حادث سير'],
  fire: ['wildfire', 'blaze', 'שריפה', 'שריפת', 'דליקה', 'حريق'],
  cyber: ['cyber', 'hack', 'hackers', 'hacked', 'סייבר', 'האקרים', 'פריצה', 'سيبراني', 'قراصنة'],
};

// Lifestyle / sport / entertainment — kept but hidden by default.
const NOISE = /שמלה|לוק|סלבס|רכילות|כוכבת|זמרת|זמר |שחקנית|דוגמנית|מתחתנ|חתונה|גירושין|בהריון|ריאליטי|אח הגדול|הישרדות|מאסטר שף|ליגת|כדורגל|כדורסל|שערים|אליפות|מונדיאל|Premier League|NBA|NFL|MotoGP|Formula|football|basketball|tennis|Champions League|celebrity|fashion|recipe|horoscope|كرة القدم|الدوري|فنانة|مسلسل/i;

const CLAIM = /(^|\s)(דיווח|דיווחים|לפי דיווח|נטען|טוען|טוענים|לטענת|report:|reports:|reportedly|claims?|claimed|according to|unconfirmed|alleged|عن مصادر|أفادت|تقارير|يزعم|زعم|بحسب)/i;

const compiled = (d: Dict) => Object.entries(d).map(([k, terms]) => [k, terms.map(wordMatcher)] as const);
const ACTOR_RE = compiled(ACTORS);
const CONCEPT_RE = compiled(CONCEPTS);

export type Category = 'security' | 'diplomacy' | 'politics' | 'economy' | 'civil' | 'other';
export const CATEGORY_LABEL: Record<Category, string> = {
  security: 'ביטחוני', diplomacy: 'מדיני', politics: 'פוליטי', economy: 'כלכלי', civil: 'אזרחי', other: 'כללי',
};
export type Severity = 'critical' | 'high' | 'medium' | 'low';
export const SEVERITY_LABEL: Record<Severity, string> = { critical: 'קריטי', high: 'גבוה', medium: 'בינוני', low: 'נמוך' };

export function analyze(text: string) {
  const actors = ACTOR_RE.filter(([, rs]) => rs.some((r) => r.test(text))).map(([k]) => k);
  const concepts = CONCEPT_RE.filter(([, rs]) => rs.some((r) => r.test(text))).map(([k]) => k);
  const has = (...c: string[]) => c.some((x) => concepts.includes(x));
  const noise = NOISE.test(text);

  let category: Category = 'other';
  if (has('strike', 'rocket', 'drone', 'sirens', 'attack', 'explosion', 'ground', 'hostages') || actors.some((a) => ['hamas', 'hezbollah', 'houthis', 'irgc', 'pij'].includes(a)) || (actors.includes('idf') && !noise)) category = 'security';
  else if (has('ceasefire', 'talks', 'sanctions', 'nuclear')) category = 'diplomacy';
  else if (has('election')) category = 'politics';
  else if (has('oil', 'economy', 'shipping')) category = 'economy';
  else if (has('accident', 'fire', 'arrest', 'wounded', 'killed')) category = 'civil';
  if (noise) category = 'other';

  // casualty number near a casualty word (e.g. "killed at least 9", "9 הרוגים", "5 شهداء")
  let casualties = 0;
  const num = /(\d{1,4})\s*(?:people\s+)?(?:killed|dead|הרוגים|הרוג|נהרגו|شهداء|شهيد|قتلى|قتيلا)|(?:killed|kill)\D{0,15}(\d{1,4})|(?:at least|לפחות|ما لا يقل عن)\s*(\d{1,4})/gi;
  let m: RegExpExecArray | null;
  while ((m = num.exec(text))) casualties = Math.max(casualties, +(m[1] || m[2] || m[3] || 0));

  let score = 0;
  if (category === 'security') score += 2;
  if (has('killed')) score += 2;
  if (casualties >= 10) score += 2;
  else if (casualties >= 3) score += 1;
  if (has('rocket', 'sirens') && category === 'security') score += 1;
  if (has('nuclear') && has('strike')) score += 2;
  if (category === 'diplomacy') score += 1;
  if (noise) score = 0;

  return { actors, concepts, category, casualties, score, claim: CLAIM.test(text), noise };
}

export function severityFromScore(score: number): Severity {
  return score >= 7 ? 'critical' : score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low';
}

const STOP = new Set(
  'the a an of in on at to for and or is are was were be by with from as after before over into amid says said new its it his her their this that will has have had not but than more about up out who what when how why של על את עם זה זו הוא היא הם לא כי גם אך או אם אחרי לפני בין כל עוד יותר אשר מה מי כך כבר רק היום אמש من في على إلى عن مع أن إن التي الذي هذا هذه بعد قبل كان'.split(' '),
);
/** Same-language tokens for similarity (prefix-stripped for Hebrew). */
export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((w) => (/^[בלמהוש][א-ת]{3,}$/.test(w) ? w.slice(1) : w))
    .filter((w) => w.length >= 3 && !STOP.has(w));
}
