// Trilingual (he / en / ar) gazetteer for geotagging headlines.
// level: city = precise enough for a map pin; region = area pin; country = used for clustering + region stats only.
// Order matters: specific places first, first match wins.
export type Level = 'city' | 'region' | 'country';
export type Place = { id: string; names: string[]; lon: number; lat: number; level: Level; zone: Zone };
export type Zone = 'gaza' | 'wb' | 'il' | 'leb' | 'syr' | 'iran' | 'yem' | 'irq' | 'gulf' | 'egy' | 'jor' | 'other';

export const ZONE_LABEL: Record<Zone, string> = {
  gaza: 'עזה', wb: 'יו״ש', il: 'ישראל', leb: 'לבנון', syr: 'סוריה', iran: 'איראן',
  yem: 'תימן / ים סוף', irq: 'עיראק', gulf: 'המפרץ', egy: 'מצרים / סיני', jor: 'ירדן', other: 'אחר',
};
export const ZONE_CENTER: Record<Zone, [number, number, number]> = {
  gaza: [34.4, 31.42, 9.5], wb: [35.25, 32.0, 8.5], il: [35.0, 31.6, 6.8], leb: [35.7, 33.7, 7.8], syr: [38.5, 35.0, 5.8],
  iran: [53.5, 32.5, 4.6], yem: [44.0, 16.0, 5.2], irq: [43.7, 33.2, 5.4], gulf: [52.0, 26.5, 5.4], egy: [31.5, 29.0, 5.2],
  jor: [36.3, 31.2, 6.6], other: [35, 31, 3],
};

const P = (id: string, names: string[], lon: number, lat: number, level: Level, zone: Zone): Place => ({ id, names, lon, lat, level, zone });

export const PLACES: Place[] = [
  // Israel — north
  P('kiryat-shmona', ['קריית שמונה', 'קרית שמונה', 'Kiryat Shmona', 'كريات شمونة'], 35.571, 33.207, 'city', 'il'),
  P('metula', ['מטולה', 'Metula', 'المطلة'], 35.573, 33.279, 'city', 'il'),
  P('nahariya', ['נהריה', 'Nahariya', 'نهاريا'], 35.095, 33.006, 'city', 'il'),
  P('safed', ['צפת', 'Safed', 'Tzfat', 'صفد'], 35.496, 32.966, 'city', 'il'),
  P('haifa', ['חיפה', 'Haifa', 'حيفا'], 34.989, 32.794, 'city', 'il'),
  P('tiberias', ['טבריה', 'Tiberias', 'طبريا'], 35.531, 32.795, 'city', 'il'),
  P('golan', ['רמת הגולן', 'הגולן', 'Golan', 'الجولان'], 35.75, 33.0, 'region', 'il'),
  P('galilee', ['הגליל', 'Galilee', 'الجليل'], 35.4, 32.9, 'region', 'il'),
  P('afula', ['עפולה', 'Afula', 'العفولة'], 35.289, 32.607, 'city', 'il'),
  // Israel — center & south
  P('tel-aviv', ['תל אביב', 'Tel Aviv', 'تل أبيب'], 34.781, 32.085, 'city', 'il'),
  P('jerusalem', ['ירושלים', 'Jerusalem', 'القدس'], 35.217, 31.778, 'city', 'il'),
  P('ben-gurion', ['נתב"ג', 'נתב״ג', 'Ben Gurion Airport', 'مطار بن غوريون'], 34.887, 32.005, 'city', 'il'),
  P('ashdod', ['אשדוד', 'Ashdod', 'أسدود'], 34.65, 31.804, 'city', 'il'),
  P('ashkelon', ['אשקלון', 'Ashkelon', 'عسقلان'], 34.574, 31.668, 'city', 'il'),
  P('sderot', ['שדרות', 'Sderot', 'سديروت'], 34.596, 31.525, 'city', 'il'),
  P('gaza-envelope', ['עוטף עזה', 'Gaza envelope', 'غلاف غزة'], 34.5, 31.4, 'region', 'il'),
  P('beersheba', ['באר שבע', 'Beersheba', "Be'er Sheva", 'بئر السبع'], 34.791, 31.252, 'city', 'il'),
  P('negev', ['הנגב', 'בנגב', 'Negev', 'النقب'], 34.8, 30.9, 'region', 'il'),
  P('dimona', ['דימונה', 'Dimona', 'ديمونا'], 35.033, 31.069, 'city', 'il'),
  P('eilat', ['אילת', 'Eilat', 'إيلات'], 34.951, 29.557, 'city', 'il'),
  // West Bank
  P('jenin', ["ג'נין", 'גנין', 'Jenin', 'جنين'], 35.301, 32.461, 'city', 'wb'),
  P('nablus', ['שכם', 'Nablus', 'نابلس'], 35.262, 32.222, 'city', 'wb'),
  P('tulkarm', ['טול כרם', 'טולכרם', 'Tulkarm', 'طولكرم'], 35.03, 32.31, 'city', 'wb'),
  P('ramallah', ['רמאללה', 'Ramallah', 'رام الله'], 35.204, 31.902, 'city', 'wb'),
  P('hebron', ['חברון', 'Hebron', 'الخليل'], 35.099, 31.532, 'city', 'wb'),
  P('bethlehem', ['בית לחם', 'Bethlehem', 'بيت لحم'], 35.2, 31.705, 'city', 'wb'),
  P('ariel', ['אריאל', 'Ariel'], 35.17, 32.105, 'city', 'wb'),
  P('west-bank', ['הגדה המערבית', 'יהודה ושומרון', 'ביו"ש', 'West Bank', 'الضفة الغربية', 'الضفة'], 35.25, 32.0, 'region', 'wb'),
  // Gaza
  P('beit-hanoun', ['בית חאנון', 'Beit Hanoun', 'بيت حانون'], 34.535, 31.539, 'city', 'gaza'),
  P('jabalia', ["ג'באליה", 'גבאליה', 'Jabalia', 'جباليا'], 34.483, 31.53, 'city', 'gaza'),
  P('gaza-city', ['העיר עזה', 'Gaza City', 'مدينة غزة'], 34.454, 31.502, 'city', 'gaza'),
  P('deir-al-balah', ['דיר אל-בלח', 'דיר אל בלח', 'Deir al-Balah', 'دير البلح'], 34.351, 31.418, 'city', 'gaza'),
  P('nuseirat', ['נוסייראת', 'Nuseirat', 'النصيرات'], 34.39, 31.45, 'city', 'gaza'),
  P('khan-younis', ["ח'אן יונס", 'חאן יונס', 'Khan Younis', 'Khan Yunis', 'خان يونس'], 34.306, 31.346, 'city', 'gaza'),
  P('rafah', ['רפיח', 'Rafah', 'رفح'], 34.246, 31.297, 'city', 'gaza'),
  P('gaza', ['רצועת עזה', 'ברצועה', 'עזה', 'Gaza', 'غزة', 'القطاع'], 34.4, 31.42, 'region', 'gaza'),
  // Lebanon
  P('dahiyeh', ['דאחייה', 'Dahiyeh', 'Dahieh', 'الضاحية'], 35.51, 33.85, 'city', 'leb'),
  P('beirut', ['ביירות', 'Beirut', 'بيروت'], 35.503, 33.888, 'city', 'leb'),
  P('tyre', ['צור', 'Tyre', 'صور'], 35.203, 33.271, 'city', 'leb'),
  P('sidon', ['צידון', 'Sidon', 'صيدا'], 35.371, 33.563, 'city', 'leb'),
  P('nabatieh', ['נבטיה', 'Nabatieh', 'النبطية'], 35.484, 33.378, 'city', 'leb'),
  P('baalbek', ['בעלבכ', 'בעלבק', 'Baalbek', 'بعلبك'], 36.207, 34.006, 'city', 'leb'),
  P('bekaa', ['בקעת הלבנון', 'Bekaa', 'البقاع'], 35.9, 33.85, 'region', 'leb'),
  P('south-lebanon', ['דרום לבנון', 'South Lebanon', 'southern Lebanon', 'جنوب لبنان'], 35.4, 33.25, 'region', 'leb'),
  P('lebanon', ['לבנון', 'לבנוני', 'לבנונית', 'Lebanon', 'Lebanese', 'لبنان', 'اللبناني', 'اللبنانية'], 35.7, 33.7, 'country', 'leb'),
  // Syria
  P('damascus', ['דמשק', 'Damascus', 'دمشق'], 36.292, 33.513, 'city', 'syr'),
  P('aleppo', ['חאלב', 'Aleppo', 'حلب'], 37.161, 36.202, 'city', 'syr'),
  P('homs', ['חומס', 'Homs', 'حمص'], 36.72, 34.733, 'city', 'syr'),
  P('latakia', ['לטקיה', 'Latakia', 'اللاذقية'], 35.79, 35.52, 'city', 'syr'),
  P('daraa', ['דרעא', 'Daraa', 'درعا'], 36.1, 32.62, 'city', 'syr'),
  P('sweida', ['סווידא', 'א-סווידא', 'Sweida', 'Suwayda', 'السويداء'], 36.57, 32.71, 'city', 'syr'),
  P('syria', ['סוריה', 'סורי', 'סורית', 'Syria', 'Syrian', 'سوريا', 'سورية', 'السوري'], 38.5, 35.0, 'country', 'syr'),
  // Iran
  P('tehran', ['טהרן', 'Tehran', 'طهران'], 51.389, 35.689, 'city', 'iran'),
  P('isfahan', ['איספהאן', 'אספהאן', 'Isfahan', 'أصفهان'], 51.668, 32.654, 'city', 'iran'),
  P('natanz', ['נתנז', 'Natanz', 'نطنز'], 51.727, 33.724, 'city', 'iran'),
  P('fordow', ['פורדו', 'Fordow', 'فوردو'], 50.995, 34.885, 'city', 'iran'),
  P('bandar-abbas', ['בנדר עבאס', 'Bandar Abbas', 'بندر عباس'], 56.266, 27.183, 'city', 'iran'),
  P('hormuz', ['הורמוז', 'Hormuz', 'هرمز'], 56.25, 26.57, 'region', 'gulf'),
  P('iran', ['איראן', 'איראני', 'איראנית', 'איראנים', 'Iran', 'Iranian', 'إيران', 'ايران', 'الإيراني', 'الإيرانية'], 53.5, 32.5, 'country', 'iran'),
  // Yemen / Red Sea
  P('sanaa', ['צנעא', 'Sanaa', "Sana'a", 'صنعاء'], 44.206, 15.369, 'city', 'yem'),
  P('hodeidah', ['חודיידה', 'Hodeidah', 'الحديدة'], 42.954, 14.798, 'city', 'yem'),
  P('red-sea', ['ים סוף', 'Red Sea', 'البحر الأحمر'], 39.5, 19.0, 'region', 'yem'),
  P('bab-el-mandeb', ['באב אל-מנדב', 'Bab el-Mandeb', 'باب المندب'], 43.3, 12.6, 'region', 'yem'),
  P('yemen', ['תימן', 'תימני', 'Yemen', 'Yemeni', 'اليمن', 'اليمني'], 47.5, 15.6, 'country', 'yem'),
  // Iraq / Gulf / neighbours
  P('baghdad', ['בגדד', 'Baghdad', 'بغداد'], 44.366, 33.315, 'city', 'irq'),
  P('erbil', ['ארביל', 'Erbil', 'أربيل'], 44.009, 36.191, 'city', 'irq'),
  P('iraq', ['עיראק', 'עיראקי', 'Iraq', 'Iraqi', 'العراق', 'العراقي'], 43.7, 33.2, 'country', 'irq'),
  P('riyadh', ['ריאד', 'Riyadh', 'الرياض'], 46.675, 24.713, 'city', 'gulf'),
  P('doha', ['דוחא', 'Doha', 'الدوحة'], 51.531, 25.286, 'city', 'gulf'),
  P('dubai', ['דובאי', 'Dubai', 'دبي'], 55.271, 25.205, 'city', 'gulf'),
  P('abu-dhabi', ['אבו דאבי', 'Abu Dhabi', 'أبوظبي', 'أبو ظبي'], 54.377, 24.453, 'city', 'gulf'),
  P('qatar', ['קטאר', 'קטארי', 'Qatar', 'Qatari', 'قطر', 'القطري'], 51.2, 25.3, 'country', 'gulf'),
  P('saudi', ['סעודיה', 'סעודי', 'סעודית', 'Saudi', 'السعودية', 'السعودي'], 45.0, 24.0, 'country', 'gulf'),
  P('uae', ['האמירויות', 'UAE', 'Emirates', 'الإمارات'], 54.3, 24.0, 'country', 'gulf'),
  P('cairo', ['קהיר', 'Cairo', 'القاهرة'], 31.236, 30.044, 'city', 'egy'),
  P('sinai', ['סיני', 'Sinai', 'سيناء'], 33.8, 29.5, 'region', 'egy'),
  P('egypt', ['מצרים', 'מצרי', 'מצרית', 'Egypt', 'Egyptian', 'مصر', 'المصري'], 30.8, 26.8, 'country', 'egy'),
  P('amman', ['עמאן', 'Amman', 'عمان'], 35.93, 31.95, 'city', 'jor'),
  P('jordan', ['ירדן', 'ירדני', 'ירדנית', 'Jordan', 'Jordanian', 'الأردن', 'الأردني'], 36.3, 31.2, 'country', 'jor'),
  // Israel (country-level: clustering only, never pinned)
  P('israel', ['ישראל', 'Israel', 'إسرائيل', 'اسرائيل'], 35.0, 31.6, 'country', 'il'),
];

/**
 * Word-boundary matcher that works for Latin, Hebrew and Arabic.
 * Hebrew allows up to two one-letter prefixes (ב/ל/מ/ה/ו/ש/כ), Arabic one (و/ب/ل/ف), so "בצור" matches "צור" but "צורך" does not.
 */
export function wordMatcher(term: string): RegExp {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (/[a-z]/i.test(term)) return new RegExp(`\\b${esc}\\b`, 'i');
  const L = '\\u0590-\\u05FF\\u0600-\\u06FF';
  const prefix = /[֐-׿]/.test(term) ? '[בלמהושכ]{0,2}' : '[وبلف]?';
  return new RegExp(`(?<![${L}])${prefix}${esc}(?![${L}])`);
}
const MATCHERS = PLACES.map((p) => ({ p, res: p.names.map(wordMatcher) }));

/** All places mentioned, most specific first. */
export function findPlaces(text: string): Place[] {
  const out: Place[] = [];
  for (const { p, res } of MATCHERS) if (res.some((r) => r.test(text))) out.push(p);
  const rank = { city: 0, region: 1, country: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}
