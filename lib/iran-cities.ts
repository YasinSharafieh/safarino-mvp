export type IranianCity = {
  code: string;
  name: string;
  englishName?: string;
  flightCode?: string;
  latitude?: number;
  longitude?: number;
  groundCode?: string;
  supportsFlight: boolean;
  supportsGround: boolean;
  /**
   * A real city Safarino knows about (for search, discovery and the quiz) that
   * the online ticket sellers do not list. It appears wherever a *place* is
   * needed, but never in the ticket form — there is nothing to sell there.
   */
  searchOnly?: boolean;
};

// Provider city directories: 53 flight cities and 127 train/bus cities.
export const IRANIAN_CITIES: IranianCity[] = [
  { code: "THR", name: "تهران", englishName: "Tehran", latitude: 35.6892, longitude: 51.389, supportsFlight: true, supportsGround: true },
  { code: "KIH", name: "کیش", englishName: "Kish", latitude: 26.526, longitude: 53.98, supportsFlight: true, supportsGround: false },
  { code: "MHD", name: "مشهد", englishName: "Mashhad", latitude: 36.2605, longitude: 59.6168, supportsFlight: true, supportsGround: true },
  { code: "SYZ", name: "شیراز", englishName: "Shiraz", latitude: 29.5918, longitude: 52.5837, supportsFlight: true, supportsGround: true },
  { code: "IFN", name: "اصفهان", englishName: "Isfahan", latitude: 32.6539, longitude: 51.666, supportsFlight: true, supportsGround: true },
  { code: "RAS", name: "رشت", englishName: "Rasht", groundCode: "RASHT", latitude: 37.2808, longitude: 49.5832, supportsFlight: true, supportsGround: true },
  { code: "AZD", name: "یزد", englishName: "AZD", latitude: 31.8974, longitude: 54.3569, supportsFlight: false, supportsGround: true },
  { code: "TBZ", name: "تبریز", englishName: "Tabriz", latitude: 38.0805, longitude: 46.2919, supportsFlight: true, supportsGround: true },
  { code: "AWZ", name: "اهواز", englishName: "Ahwaz", latitude: 31.3183, longitude: 48.6692, supportsFlight: true, supportsGround: true },
  { code: "BND", name: "بندرعباس", englishName: "Bandar Abbas", latitude: 27.1832, longitude: 56.2666, supportsFlight: true, supportsGround: true },
  { code: "GSM", name: "قشم", englishName: "Qeshm", latitude: 26.8119, longitude: 55.8914, supportsFlight: true, supportsGround: false },
  { code: "KER", name: "کرمان", englishName: "KER", latitude: 30.2839, longitude: 57.0834, supportsFlight: false, supportsGround: true },
  { code: "ZAH", name: "زاهدان", englishName: "Zahedan", latitude: 29.4963, longitude: 60.8629, supportsFlight: true, supportsGround: true },
  { code: "URM", name: "ارومیه", englishName: "Orumiyeh", flightCode: "OMH", groundCode: "OMH", latitude: 37.5527, longitude: 45.0761, supportsFlight: true, supportsGround: true },
  { code: "SRY", name: "ساری", englishName: "Sari", latitude: 36.5633, longitude: 53.0601, supportsFlight: true, supportsGround: true },
  { code: "GBT", name: "گرگان", englishName: "Gorgan", latitude: 36.8456, longitude: 54.4393, supportsFlight: true, supportsGround: true },
  { code: "HDM", name: "همدان", englishName: "Hamedan", groundCode: "HMD", latitude: 34.7992, longitude: 48.5146, supportsFlight: true, supportsGround: true },
  { code: "KSH", name: "کرمانشاه", englishName: "KERSHAH", groundCode: "KERSHAH", latitude: 34.3142, longitude: 47.065, supportsFlight: false, supportsGround: true },
  { code: "QIK", name: "قم", englishName: "QUM", groundCode: "QUM", latitude: 34.6401, longitude: 50.8764, supportsFlight: false, supportsGround: true },
  { code: "AJK", name: "اراک", englishName: "AJK", latitude: 34.0917, longitude: 49.6892, supportsFlight: false, supportsGround: true },
  { code: "XBJ", name: "بیرجند", latitude: 32.8649, longitude: 59.2211, supportsFlight: false, supportsGround: false },
  { code: "BUZ", name: "بوشهر", latitude: 28.9234, longitude: 50.8203, supportsFlight: false, supportsGround: false },
  { code: "ZBR", name: "چابهار", englishName: "Chabahar", latitude: 25.2919, longitude: 60.643, supportsFlight: true, supportsGround: false },
  { code: "AEU", name: "ابوموسی", englishName: "Abumusa", supportsFlight: true, supportsGround: false },
  { code: "ABD", name: "آبادان", englishName: "Abadan", supportsFlight: true, supportsGround: false },
  { code: "ADU", name: "اردبیل", englishName: "Ardabil", supportsFlight: true, supportsGround: true },
  { code: "OMI", name: "امیدیه", englishName: "Omidieh", supportsFlight: true, supportsGround: false },
  { code: "AKW", name: "آقاجاری", englishName: "Aghajari", supportsFlight: true, supportsGround: false },
  { code: "MDN", name: "گناباد", englishName: "Gonabad", supportsFlight: true, supportsGround: false },
  { code: "SAR", name: "سراوان", englishName: "Saravan", supportsFlight: true, supportsGround: false },
  { code: "TQZ", name: "سقز", englishName: "Saqqez", supportsFlight: true, supportsGround: false },
  { code: "IHR", name: "ایرانشهر", englishName: "Iranshahr", supportsFlight: true, supportsGround: false },
  { code: "IIL", name: "ایلام", englishName: "Ilam", supportsFlight: true, supportsGround: false },
  { code: "BJB", name: "بجنورد", englishName: "Bojnourd", supportsFlight: true, supportsGround: false },
  { code: "BXR", name: "بم", englishName: "Bam", supportsFlight: true, supportsGround: true },
  { code: "BDH", name: "بندر لنگه", englishName: "Bandar Lengeh", supportsFlight: true, supportsGround: false },
  { code: "JYR", name: "جیرفت", englishName: "Jiroft", supportsFlight: true, supportsGround: false },
  { code: "KHK", name: "خارک", englishName: "Khark", supportsFlight: true, supportsGround: false },
  { code: "KHY", name: "خوی", englishName: "Khoy", supportsFlight: true, supportsGround: false },
  { code: "DEF", name: "دزفول", englishName: "Dezful", supportsFlight: true, supportsGround: false },
  { code: "RZR", name: "رامسر", englishName: "Ramsar", supportsFlight: true, supportsGround: false },
  { code: "RJN", name: "رفسنجان", englishName: "Rafsanjan", supportsFlight: true, supportsGround: false },
  { code: "ACZ", name: "زابل", englishName: "Zabol", supportsFlight: true, supportsGround: false },
  { code: "JWN", name: "زنجان", englishName: "Zanjan", supportsFlight: true, supportsGround: true },
  { code: "AFZ", name: "سبزوار", englishName: "Sabzevar", supportsFlight: true, supportsGround: true },
  { code: "SNX", name: "سمنان", englishName: "Semnan", groundCode: "SEMNAN", supportsFlight: true, supportsGround: true },
  { code: "SDG", name: "سنندج", englishName: "Sanandaj", groundCode: "SNNDJ", supportsFlight: true, supportsGround: true },
  { code: "ACP", name: "مراغه", englishName: "Maragheh", supportsFlight: true, supportsGround: true },
  { code: "SYJ", name: "سیرجان", englishName: "Syrjan", supportsFlight: true, supportsGround: true },
  { code: "RUD", name: "شاهرود", englishName: "Shahroud", supportsFlight: true, supportsGround: true },
  { code: "CQD", name: "شهرکرد", englishName: "Shahrekord", groundCode: "SHKORD", supportsFlight: true, supportsGround: true },
  { code: "TCX", name: "طبس", englishName: "Tabas", supportsFlight: true, supportsGround: true },
  { code: "PGU", name: "عسلویه", englishName: "Asalouyeh", supportsFlight: true, supportsGround: false },
  { code: "GCH", name: "گچساران", englishName: "Gachsaran", supportsFlight: true, supportsGround: false },
  { code: "LRR", name: "لار", englishName: "Lar", supportsFlight: true, supportsGround: false },
  { code: "LFM", name: "لامرد", englishName: "Lamard", supportsFlight: true, supportsGround: false },
  { code: "MAC", name: "ماکو", englishName: "Makou", supportsFlight: true, supportsGround: false },
  { code: "MRX", name: "ماهشهر", englishName: "Mahshahr", groundCode: "MAHSHAHR", supportsFlight: true, supportsGround: true },
  { code: "NSH", name: "نوشهر", englishName: "Noshahr", supportsFlight: true, supportsGround: false },
  { code: "YES", name: "یاسوج", englishName: "Yasouj", supportsFlight: true, supportsGround: false },
  { code: "ABNIL", name: "آب نیل", englishName: "ABNIL", groundCode: "ABNIL", supportsFlight: false, supportsGround: true },
  { code: "SANKHAST", name: "سنخواست", englishName: "SANKHAST", groundCode: "SANKHAST", supportsFlight: false, supportsGround: true },
  { code: "ABADEH", name: "آباده", englishName: "ABADEH", groundCode: "ABADEH", supportsFlight: false, supportsGround: true },
  { code: "ABGARM", name: "آبگرم", englishName: "ABGARM", groundCode: "ABGARM", supportsFlight: false, supportsGround: true },
  { code: "ABYEK", name: "آبیک", englishName: "ABYEK", groundCode: "ABYEK", supportsFlight: false, supportsGround: true },
  { code: "ATASHBAG", name: "آتش بغ", englishName: "ATASHBAG", groundCode: "ATASHBAG", supportsFlight: false, supportsGround: true },
  { code: "AZADVAR", name: "آزادور", englishName: "AZADVAR", groundCode: "AZADVAR", supportsFlight: false, supportsGround: true },
  { code: "AHMADABAD", name: "احمدآباد", englishName: "AHMADABAD", groundCode: "AHMADABAD", supportsFlight: false, supportsGround: true },
  { code: "ARDKAN", name: "اردکان", englishName: "ARDKAN", groundCode: "ARDKAN", supportsFlight: false, supportsGround: true },
  { code: "ARSANJAN", name: "ارسنجان", englishName: "ARSANJAN", groundCode: "ARSANJAN", supportsFlight: false, supportsGround: true },
  { code: "AZNA", name: "ازنا", englishName: "AZNA", groundCode: "AZNA", supportsFlight: false, supportsGround: true },
  { code: "ESFRYN", name: "اسفراین", englishName: "ESFRYN", groundCode: "ESFRYN", supportsFlight: false, supportsGround: true },
  { code: "ESLMSHAR", name: "اسلامشهر", englishName: "ESLMSHAR", groundCode: "ESLMSHAR", supportsFlight: false, supportsGround: true },
  { code: "EGHLID", name: "اقلید", englishName: "EGHLID", groundCode: "EGHLID", supportsFlight: false, supportsGround: true },
  { code: "ALVAND", name: "الوند", englishName: "ALVAND", groundCode: "ALVAND", supportsFlight: false, supportsGround: true },
  { code: "AMREVAN", name: "امروان", englishName: "AMREVAN", groundCode: "AMREVAN", supportsFlight: false, supportsGround: true },
  { code: "ANDMESHK", name: "اندیمشک", englishName: "ANDMESHK", groundCode: "ANDMESHK", supportsFlight: false, supportsGround: true },
  { code: "BADROOD", name: "بادرود", englishName: "BADROOD", groundCode: "BADROOD", supportsFlight: false, supportsGround: true },
  { code: "BAFGH", name: "بافق", englishName: "BAFGH", groundCode: "BAFGH", supportsFlight: false, supportsGround: true },
  { code: "BJSTAN", name: "بجستان", englishName: "BJSTAN", groundCode: "BJSTAN", supportsFlight: false, supportsGround: true },
  { code: "BOSTANABAD", name: "بستان آباد", englishName: "BOSTANABAD", groundCode: "BOSTANABAD", supportsFlight: false, supportsGround: true },
  { code: "BNDTRKMN", name: "بندرترکمن", englishName: "BNDTRKMN", groundCode: "BNDTRKMN", supportsFlight: false, supportsGround: true },
  { code: "BAHABAD", name: "بهاباد", englishName: "BAHABAD", groundCode: "BAHABAD", supportsFlight: false, supportsGround: true },
  { code: "BIABANAK", name: "بیابانک", englishName: "BIABANAK", groundCode: "BIABANAK", supportsFlight: false, supportsGround: true },
  { code: "BISHE", name: "بیشه", englishName: "BISHE", groundCode: "BISHE", supportsFlight: false, supportsGround: true },
  { code: "PARAND", name: "پرند", englishName: "PARAND", groundCode: "PARAND", supportsFlight: false, supportsGround: true },
  { code: "POLSEFID", name: "پل سفید", englishName: "POLSEFID", groundCode: "POLSEFID", supportsFlight: false, supportsGround: true },
  { code: "PISHVA", name: "پیشوا", englishName: "PISHVA", groundCode: "PISHVA", supportsFlight: false, supportsGround: true },
  { code: "TAKESTAN", name: "تاکستان", englishName: "TAKESTAN", groundCode: "TAKESTAN", supportsFlight: false, supportsGround: true },
  { code: "TAPESFID", name: "تپه سفید", englishName: "TAPESFID", groundCode: "TAPESFID", supportsFlight: false, supportsGround: true },
  { code: "TRBTHDR", name: "تربت حیدریه", englishName: "TRBTHDR", groundCode: "TRBTHDR", supportsFlight: false, supportsGround: true },
  { code: "TARBIATMOALEM", name: "تربیت معلم", englishName: "TARBIATMOALEM", groundCode: "TARBIATMOALEM", supportsFlight: false, supportsGround: true },
  { code: "TANGHAFT", name: "تنگ هفت", englishName: "TANGHAFT", groundCode: "TANGHAFT", supportsFlight: false, supportsGround: true },
  { code: "JAJARM", name: "جاجرم", englishName: "JAJARM", groundCode: "JAJARM", supportsFlight: false, supportsGround: true },
  { code: "JOLFA", name: "جلفا", englishName: "JOLFA", groundCode: "JOLFA", supportsFlight: false, supportsGround: true },
  { code: "JMKRN", name: "جمکران", englishName: "JMKRN", groundCode: "JMKRN", supportsFlight: false, supportsGround: true },
  { code: "JOVIN", name: "جوین", englishName: "JOVIN", groundCode: "JOVIN", supportsFlight: false, supportsGround: true },
  { code: "CHAMSNGR", name: "چمسنگر", englishName: "CHAMSNGR", groundCode: "CHAMSNGR", supportsFlight: false, supportsGround: true },
  { code: "KHS", name: "خاش", englishName: "Khash", groundCode: "KHS", supportsFlight: false, supportsGround: true },
  { code: "KHT", name: "خاوران(تبريز)", englishName: "Khavaran (Tabriz)", groundCode: "KHT", supportsFlight: false, supportsGround: true },
  { code: "KHORASAN", name: "خراسانک", englishName: "KHORASAN", groundCode: "KHORASAN", supportsFlight: false, supportsGround: true },
  { code: "KHORMPEY", name: "خرم پی", englishName: "KHORMPEY", groundCode: "KHORMPEY", supportsFlight: false, supportsGround: true },
  { code: "KHORAMDR", name: "خرم دره", englishName: "KHORAMDR", groundCode: "KHORAMDR", supportsFlight: false, supportsGround: true },
  { code: "KHORMSHR", name: "خرمشهر", englishName: "KHORMSHR", groundCode: "KHORMSHR", supportsFlight: false, supportsGround: true },
  { code: "KHAF", name: "خواف", englishName: "KHAF", groundCode: "KHAF", supportsFlight: false, supportsGround: true },
  { code: "DAMGHAN", name: "دامغان", englishName: "DAMGHAN", groundCode: "DAMGHAN", supportsFlight: false, supportsGround: true },
  { code: "DORUD", name: "دورود", englishName: "DORUD", groundCode: "DORUD", supportsFlight: false, supportsGround: true },
  { code: "RAZI", name: "رازی", englishName: "RAZI", groundCode: "RAZI", supportsFlight: false, supportsGround: true },
  { code: "ZARAND", name: "زرند", englishName: "ZARAND", groundCode: "ZARAND", supportsFlight: false, supportsGround: true },
  { code: "ZARINDSH", name: "زرین دشت", englishName: "ZARINDSH", groundCode: "ZARINDSH", supportsFlight: false, supportsGround: true },
  { code: "ZAVRE", name: "زواره", englishName: "ZAVRE", groundCode: "ZAVRE", supportsFlight: false, supportsGround: true },
  { code: "SAVEH", name: "ساوه", englishName: "SAVEH", groundCode: "SAVEH", supportsFlight: false, supportsGround: true },
  { code: "SEPIDASH", name: "سپیددشت", englishName: "SEPIDASH", groundCode: "SEPIDASH", supportsFlight: false, supportsGround: true },
  { code: "CKT", name: "سرخس", englishName: "CKT", groundCode: "CKT", supportsFlight: false, supportsGround: true },
  { code: "SADATSHAHR", name: "سعادت شهر", englishName: "SADATSHAHR", groundCode: "SADATSHAHR", supportsFlight: false, supportsGround: true },
  { code: "SOLMAS", name: "سلماس", englishName: "SOLMAS", groundCode: "SOLMAS", supportsFlight: false, supportsGround: true },
  { code: "SAVADKOUH", name: "سوادکوه", englishName: "SAVADKOOH", groundCode: "SAVADKOUH", supportsFlight: false, supportsGround: true },
  { code: "SIMINDSH", name: "سیمین دشت", englishName: "SIMINDSH", groundCode: "SIMINDSH", supportsFlight: false, supportsGround: true },
  { code: "SHAZAND", name: "شازند", englishName: "SHAZAND", groundCode: "SHAZAND", supportsFlight: false, supportsGround: true },
  { code: "SHARAFKHANE", name: "شرفخانه", englishName: "SHARAFKHANE", groundCode: "SHARAFKHANE", supportsFlight: false, supportsGround: true },
  { code: "SHAHRREZA", name: "شهرضا", englishName: "SHAHRREZA", groundCode: "SHAHRREZA", supportsFlight: false, supportsGround: true },
  { code: "SHOUSH", name: "شوش", englishName: "SHOUSH", groundCode: "SHOUSH", supportsFlight: false, supportsGround: true },
  { code: "SHOSHTAR", name: "شوشتر", englishName: "SHOSHTAR", groundCode: "SHOSHTAR", supportsFlight: false, supportsGround: true },
  { code: "SHIRGAH", name: "شیرگاه", englishName: "SHIRGAH", groundCode: "SHIRGAH", supportsFlight: false, supportsGround: true },
  { code: "SAFASHAHR", name: "صفاشهر", englishName: "SAFASHAHR", groundCode: "SAFASHAHR", supportsFlight: false, supportsGround: true },
  { code: "AJABSHIR", name: "عجب شیر", englishName: "AJABSHIR", groundCode: "AJABSHIR", supportsFlight: false, supportsGround: true },
  { code: "AMRAVAN", name: "عمروان", englishName: "AMRAVAN", groundCode: "AMRAVAN", supportsFlight: false, supportsGround: true },
  { code: "FAHRAJ", name: "فهرج", englishName: "FAHRAJ", groundCode: "FAHRAJ", supportsFlight: false, supportsGround: true },
  { code: "FIROUZAN", name: "فیروزان", englishName: "FIROUZAN", groundCode: "FIROUZAN", supportsFlight: false, supportsGround: true },
  { code: "FIRUZKUH", name: "فیروزکوه", englishName: "FIRUZKUH", groundCode: "FIRUZKUH", supportsFlight: false, supportsGround: true },
  { code: "GHAEMSHR", name: "قائمشهر", englishName: "GHAEMSHR", groundCode: "GHAEMSHR", supportsFlight: false, supportsGround: true },
  { code: "GZW", name: "قزوین", englishName: "GZW", groundCode: "GZW", supportsFlight: false, supportsGround: true },
  { code: "KARUN", name: "کارون", englishName: "KARUN", groundCode: "KARUN", supportsFlight: false, supportsGround: true },
  { code: "KASHAN", name: "کاشان", englishName: "KASHAN", groundCode: "KASHAN", supportsFlight: false, supportsGround: true },
  { code: "QKC", name: "کرج", englishName: "QKC", groundCode: "QKC", supportsFlight: false, supportsGround: true },
  { code: "GARMSAR", name: "گرمسار", englishName: "GARMSAR", groundCode: "GARMSAR", supportsFlight: false, supportsGround: true },
  { code: "MOBARAKEBAFGH", name: "مبارکه بافق", englishName: "MOBARAKEBAFGH", groundCode: "MOBARAKEBAFGH", supportsFlight: false, supportsGround: true },
  { code: "MHMADIE", name: "محمدیه", englishName: "MHMADIE", groundCode: "MHMADIE", supportsFlight: false, supportsGround: true },
  { code: "MARVDASHT", name: "مرودشت", englishName: "MARVDASHT", groundCode: "MARVDASHT", supportsFlight: false, supportsGround: true },
  { code: "MALAYER", name: "ملایر", englishName: "MALAYER", groundCode: "MALAYER", supportsFlight: false, supportsGround: true },
  { code: "MAHABAD", name: "مهاباد", englishName: "MAHABAD", groundCode: "MAHABAD", supportsFlight: false, supportsGround: true },
  { code: "MIANDOAB", name: "میاندوآب", englishName: "MIANDOAB", groundCode: "MIANDOAB", supportsFlight: false, supportsGround: true },
  { code: "MIANEH", name: "میانه", englishName: "MIANEH", groundCode: "MIANEH", supportsFlight: false, supportsGround: true },
  { code: "MEYBOD", name: "میبد", englishName: "MEYBOD", groundCode: "MEYBOD", supportsFlight: false, supportsGround: true },
  { code: "NAKHJAVAN", name: "نخجوان", englishName: "NAKHJAVAN", groundCode: "NAKHJAVAN", supportsFlight: false, supportsGround: true },
  { code: "NEGAB", name: "نقاب", englishName: "NEGAB", groundCode: "NEGAB", supportsFlight: false, supportsGround: true },
  { code: "NEYSHABR", name: "نیشابور", englishName: "NEYSHABR", groundCode: "NEYSHABR", supportsFlight: false, supportsGround: true },
  { code: "HASHTGER", name: "هشتگرد", englishName: "HASHTGER", groundCode: "HASHTGER", supportsFlight: false, supportsGround: true },
  { code: "HAFTTAPE", name: "هفت تپه", englishName: "HAFTTAPE", groundCode: "HAFTTAPE", supportsFlight: false, supportsGround: true },
  { code: "VARAMIN", name: "ورامین", englishName: "VARAMIN", groundCode: "VARAMIN", supportsFlight: false, supportsGround: true },
  { code: "VERESK", name: "ورسک", englishName: "VERESK", groundCode: "VERESK", supportsFlight: false, supportsGround: true },
  { code: "BAKRAN", name: "بکران", englishName: "BAKRAN", groundCode: "BAKRAN", supportsFlight: false, supportsGround: true },
  { code: "KARBALA", name: "کربلا", englishName: "KARBALA", groundCode: "KARBALA", supportsFlight: false, supportsGround: true },
  { code: "VAN", name: "وان", englishName: "VAN", groundCode: "VAN", supportsFlight: false, supportsGround: true },
  { code: "NAEEN", name: "نائین", englishName: "NAEEN", groundCode: "NAEEN", supportsFlight: false, supportsGround: true },
  { code: "MEHRIZ", name: "مهریز", englishName: "MEHRIZ", groundCode: "MEHRIZ", supportsFlight: false, supportsGround: true },
  // ---------------------------------------------- real cities without online tickets
  { code: "ALM", name: "الموت", englishName: "Alamut", latitude: 36.4447, longitude: 50.5864, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "ANZ", name: "انزلی", englishName: "Anzali", latitude: 37.4725, longitude: 49.4622, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "MSL", name: "ماسوله", englishName: "Masuleh", latitude: 37.1553, longitude: 48.9875, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "LAJ", name: "لاهیجان", englishName: "Lahijan", latitude: 37.2072, longitude: 50.0049, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "ASTN", name: "آستانه اشرفیه", englishName: "Astaneh Ashrafiyeh", latitude: 37.263, longitude: 49.944, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "FUM", name: "فومن", englishName: "Fouman", latitude: 37.223, longitude: 49.313, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "RDS", name: "رودسر", englishName: "Rudsar", latitude: 37.137, longitude: 50.288, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "LNG", name: "لنگرود", englishName: "Langarud", latitude: 37.195, longitude: 50.15, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "AML", name: "آمل", englishName: "Amol", latitude: 36.4696, longitude: 52.3507, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "BAB", name: "بابل", englishName: "Babol", latitude: 36.5513, longitude: 52.6789, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "BEHS", name: "بهشهر", englishName: "Behshahr", latitude: 36.692, longitude: 53.552, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "NUR", name: "نور", englishName: "Nur", latitude: 36.573, longitude: 52.015, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "CHL", name: "چالوس", englishName: "Chalus", latitude: 36.655, longitude: 51.42, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "TNB", name: "تنکابن", englishName: "Tonekabon", latitude: 36.816, longitude: 50.874, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "BBLS", name: "بابلسر", englishName: "Babolsar", latitude: 36.703, longitude: 52.65, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "ASTR", name: "آستارا", englishName: "Astara", latitude: 38.43, longitude: 48.87, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "KHLK", name: "خلخال", englishName: "Khalkhal", latitude: 37.618, longitude: 48.525, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "PRSA", name: "پارس آباد", englishName: "Parsabad", latitude: 39.648, longitude: 47.917, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "SRE", name: "سرعین", englishName: "Sarein", latitude: 38.15, longitude: 48.07, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "MSGS", name: "مشگین شهر", englishName: "Meshgin Shahr", latitude: 38.398, longitude: 47.68, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "AHR", name: "اهر", englishName: "Ahar", latitude: 38.476, longitude: 47.07, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "MRV", name: "مریوان", englishName: "Marivan", latitude: 35.526, longitude: 46.176, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "BKN", name: "بوکان", englishName: "Bukan", latitude: 36.52, longitude: 46.21, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "PRN", name: "پیرانشهر", englishName: "Piranshahr", latitude: 36.7, longitude: 45.14, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "SRDS", name: "سردشت", englishName: "Sardasht", latitude: 36.155, longitude: 45.48, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "TVS", name: "تویسرکان", englishName: "Tuyserkan", latitude: 34.55, longitude: 48.45, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "NHD", name: "نهاوند", englishName: "Nahavand", latitude: 34.188, longitude: 48.375, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "KHD", name: "خرم آباد", englishName: "Khorramabad", latitude: 33.487, longitude: 48.355, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "BRJ", name: "بروجرد", englishName: "Borujerd", latitude: 33.897, longitude: 48.751, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "KHDT", name: "کوهدشت", englishName: "Kuhdasht", latitude: 33.53, longitude: 47.6, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "PLD", name: "پلدختر", englishName: "Pol Dokhtar", latitude: 33.15, longitude: 47.71, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "SSG", name: "سوسنگرد", englishName: "Susangerd", latitude: 31.558, longitude: 48.18, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "BHB", name: "بهبهان", englishName: "Behbahan", latitude: 30.596, longitude: 50.241, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "SHBK", name: "شهربابک", englishName: "Shahr-e Babak", latitude: 30.113, longitude: 55.121, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "BFT", name: "بافت", englishName: "Baft", latitude: 29.233, longitude: 56.6, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "NIN", name: "نایین", englishName: "Nain", latitude: 32.86, longitude: 53.087, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "NTN", name: "نطنز", englishName: "Natanz", latitude: 33.51, longitude: 51.916, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "GLP", name: "گلپایگان", englishName: "Golpayegan", latitude: 33.453, longitude: 50.288, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "MBRK", name: "مبارکه", englishName: "Mobarakeh", latitude: 32.347, longitude: 51.508, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "KHSR", name: "خوانسار", englishName: "Khansar", latitude: 33.22, longitude: 50.315, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "KHM", name: "خمین", englishName: "Khomeyn", latitude: 33.64, longitude: 50.08, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "MHL", name: "محلات", englishName: "Mahallat", latitude: 33.91, longitude: 50.455, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "TFR", name: "تفرش", englishName: "Tafresh", latitude: 34.69, longitude: 50.01, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "ABH", name: "ابهر", englishName: "Abhar", latitude: 36.146, longitude: 49.218, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "KHDB", name: "خدابنده", englishName: "Khodabandeh", latitude: 36.15, longitude: 48.7, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "QAE", name: "قائن", englishName: "Qaen", latitude: 33.726, longitude: 59.184, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "GNBD", name: "گنبد کاووس", englishName: "Gonbad-e Kavus", latitude: 37.25, longitude: 55.167, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "TLQ", name: "طالقان", englishName: "Taleqan", latitude: 36.17, longitude: 50.76, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "ABRK", name: "ابرکوه", englishName: "Abarkuh", latitude: 31.128, longitude: 53.279, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "HRMZ", name: "هرمز", englishName: "Hormuz", latitude: 27.065, longitude: 56.46, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "KRMJ", name: "خورموج", englishName: "Khormouj", latitude: 28.65, longitude: 51.38, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "FRZ", name: "فیروزآباد", englishName: "Firuzabad", latitude: 28.843, longitude: 52.57, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "BSTK", name: "بستک", englishName: "Bastak", latitude: 27.198, longitude: 54.366, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "MNB", name: "میناب", englishName: "Minab", latitude: 27.147, longitude: 57.077, supportsFlight: false, supportsGround: false, searchOnly: true },
  { code: "NKS", name: "نیک شهر", englishName: "Nikshahr", latitude: 26.226, longitude: 60.214, supportsFlight: false, supportsGround: false, searchOnly: true },
];

function normalize(value: string): string {
  return value.trim().replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/\u200c/g, " ").toLowerCase();
}

export function resolveIranianCity(value: string): IranianCity | undefined {
  const normalized = normalize(value);
  // An empty value must never match the first city that has no English name.
  if (!normalized) return undefined;
  return IRANIAN_CITIES.find((city) =>
    city.code.toLowerCase() === normalized
    || city.flightCode?.toLowerCase() === normalized
    || city.groundCode?.toLowerCase() === normalized
    || normalize(city.name) === normalized
    || (city.englishName ? normalize(city.englishName) === normalized : false),
  );
}

export function citiesForTransport(mode: "plane" | "train" | "bus"): IranianCity[] {
  return IRANIAN_CITIES.filter((city) => mode === "plane" ? city.supportsFlight : city.supportsGround);
}

export function transportCityCode(city: IranianCity, mode: "plane" | "train" | "bus"): string {
  return mode === "plane" ? city.flightCode || city.code : city.groundCode || city.code;
}

/**
 * Coordinates for cities that the provider directories list without a location.
 *
 * Weather, the map and «چقدر از اقامتگاه دور است» all need a real point, so the
 * gaps in the provider list are filled from the public city coordinates — the
 * same ones OpenStreetMap and Wikidata carry — and never guessed per request.
 */
export const CITY_COORDINATES: Record<string, [number, number]> = {
  "انزلی": [37.4725, 49.4622],
  "ماسوله": [37.1553, 48.9875],
  "رامسر": [36.9208, 50.6583],
  "نوشهر": [36.648, 51.496],
  "بندرترکمن": [36.9017, 54.0717],
  "اردبیل": [38.2498, 48.2933],
  "سنندج": [35.3113, 46.996],
  "سقز": [36.2464, 46.2736],
  "مهاباد": [36.7631, 45.7222],
  "خوی": [38.5503, 44.9521],
  "ماکو": [39.29, 44.51],
  "میاندوآب": [36.9694, 46.1028],
  "زنجان": [36.6769, 48.4963],
  "قزوین": [36.2797, 50.0049],
  "الموت": [36.4447, 50.5864],
  "ساوه": [35.0213, 50.3567],
  "دورود": [33.49, 49.07],
  "ایلام": [33.6374, 46.4227],
  "شوشتر": [32.045, 48.848],
  "شوش": [32.194, 48.243],
  "دزفول": [32.38, 48.405],
  "خرمشهر": [30.4404, 48.1765],
  "آبادان": [30.3392, 48.3043],
  "اندیمشک": [32.47, 48.35],
  "بندر لنگه": [26.558, 54.8806],
  "بم": [29.1061, 58.357],
  "رفسنجان": [30.4067, 55.9939],
  "سیرجان": [29.451, 55.671],
  "جیرفت": [28.678, 57.74],
  "طبس": [33.595, 56.924],
  "زابل": [31.0286, 61.4949],
  "خاش": [28.221, 61.2155],
  "ایرانشهر": [27.2025, 60.6848],
  "اردکان": [32.31, 54.017],
  "میبد": [32.25, 54.0167],
  "مهریز": [31.594, 54.443],
  "بافق": [31.605, 55.41],
  "کاشان": [33.9831, 51.4364],
  "شهرضا": [32.008, 51.866],
  "یاسوج": [30.6682, 51.588],
  "گچساران": [30.347, 50.798],
  "شهرکرد": [32.3256, 50.8644],
  "نیشابور": [36.2133, 58.7958],
  "سبزوار": [36.2126, 57.6819],
  "تربت حیدریه": [35.274, 59.2196],
  "گناباد": [34.3529, 58.6836],
  "خواف": [34.576, 60.14],
  "کرج": [35.84, 50.9391],
  "فیروزکوه": [35.756, 52.77],
  "لار": [27.68, 54.34],
  "لامرد": [27.334, 53.18],
  "مرودشت": [29.879, 52.802],
  "آباده": [31.161, 52.65],
  "اقلید": [30.896, 52.69],
  "بجنورد": [37.4747, 57.329],
  "اسفراین": [37.0764, 57.51],
  "سمنان": [35.5729, 53.3971],
  "شاهرود": [36.418, 54.9763],
  "دامغان": [36.168, 54.348],
  "میانه": [37.421, 47.715],
  "ملایر": [34.296, 48.823],
};

/** The point of a city, from the provider row or the coordinate table. */
export function cityPoint(name: string): { latitude: number; longitude: number } | null {
  const target = (name || "").trim();
  if (!target) return null;
  const row = IRANIAN_CITIES.find((city) => city.name === target);
  if (row && typeof row.latitude === "number" && typeof row.longitude === "number" && row.latitude !== 0) {
    return { latitude: row.latitude, longitude: row.longitude };
  }
  const point = CITY_COORDINATES[target];
  return point && point[0] !== 0 ? { latitude: point[0], longitude: point[1] } : null;
}
