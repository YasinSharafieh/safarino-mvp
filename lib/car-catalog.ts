/**
 * The cars an Iranian traveller can actually own.
 *
 * Every entry carries the numbers the cost model needs:
 *   consumption      — combined litres per 100 km (manufacturer/real-world mixed)
 *   valueToman       — an approximate current market value, used *only* to spread
 *                      depreciation over the car's useful life
 *   lifeKm           — the kilometres the car is expected to last
 *   servicePerKm     — tyres, oil, filters and routine service per kilometre
 *
 * None of these are presented as live prices. The value and the per-kilometre
 * figures are editable in the calculator, and every derived row is labelled
 * «تخمین با فرض شما» so nothing looks like a provider quote.
 */

export type CarSegment = "اقتصادی" | "متوسط" | "شاسی‌بلند" | "لوکس" | "وانت و ون";

export type CarModel = {
  id: string;
  name: string;
  /** Manufacturer + model year range, so two generations do not collide. */
  detail: string;
  segment: CarSegment;
  /** Combined litres per 100 km. */
  consumption: number;
  /** Approximate market value in toman (editable in the UI). */
  valueToman: number;
  /** Useful life in kilometres. */
  lifeKm: number;
  /** Tyres, oil, filters, routine service — toman per kilometre. */
  servicePerKm: number;
  /** Latin spellings people type: «برلیانس» or «brilliance», «x55» or «ایکس ۵۵». */
  aliases?: string[];
};

export const CARS: CarModel[] = [
  { id: "pride", name: "پراید ۱۳۱ / ۱۱۱", detail: "سایپا · ۱۳۸۰ تا ۱۳۹۹", segment: "اقتصادی", consumption: 7.0, valueToman: 550_000_000, lifeKm: 260_000, servicePerKm: 650 },
  { id: "tiba", name: "تیبا", detail: "سایپا · ۱۳۸۷ تا ۱۴۰۰", segment: "اقتصادی", consumption: 7.0, valueToman: 620_000_000, lifeKm: 270_000, servicePerKm: 680 },
  { id: "saina", name: "ساینا", detail: "سایپا · ۱۳۹۵ به بعد", segment: "اقتصادی", consumption: 6.8, valueToman: 700_000_000, lifeKm: 280_000, servicePerKm: 700 },
  { id: "quick", name: "کوییک", detail: "سایپا · ۱۳۹۷ به بعد", segment: "اقتصادی", consumption: 6.9, valueToman: 760_000_000, lifeKm: 280_000, servicePerKm: 700 },
  { id: "shahin", name: "شاهین", detail: "سایپا · ۱۳۹۹ به بعد", segment: "متوسط", consumption: 8.0, valueToman: 1_350_000_000, lifeKm: 300_000, servicePerKm: 850 },
  { id: "zeta", name: "زاگرس (پیکاپ)", detail: "سایپا · ۱۳۹۹ به بعد", segment: "وانت و ون", consumption: 12.0, valueToman: 1_550_000_000, lifeKm: 300_000, servicePerKm: 1_050 },
  { id: "peugeot-206", name: "پژو ۲۰۶ تیپ ۲", detail: "ایران‌خودرو · ۱۳۸۰ تا ۱۴۰۲", segment: "اقتصادی", consumption: 7.5, valueToman: 900_000_000, lifeKm: 280_000, servicePerKm: 780 },
  { id: "peugeot-207", name: "پژو ۲۰۷", detail: "ایران‌خودرو · ۱۳۹۰ به بعد", segment: "متوسط", consumption: 7.6, valueToman: 1_200_000_000, lifeKm: 290_000, servicePerKm: 820 },
  { id: "peugeot-405", name: "پژو ۴۰۵", detail: "ایران‌خودرو · ۱۳۷۸ تا ۱۴۰۰", segment: "اقتصادی", consumption: 9.0, valueToman: 700_000_000, lifeKm: 300_000, servicePerKm: 800 },
  { id: "peugeot-pars", name: "پژو پارس", detail: "ایران‌خودرو · ۱۳۸۱ به بعد", segment: "متوسط", consumption: 8.6, valueToman: 1_000_000_000, lifeKm: 300_000, servicePerKm: 830 },
  { id: "samand", name: "سمند", detail: "ایران‌خودرو · ۱۳۸۱ به بعد", segment: "متوسط", consumption: 8.5, valueToman: 850_000_000, lifeKm: 300_000, servicePerKm: 820 },
  { id: "soren", name: "سورن / سمند سورن", detail: "ایران‌خودرو · ۱۳۸۶ به بعد", segment: "متوسط", consumption: 8.6, valueToman: 950_000_000, lifeKm: 300_000, servicePerKm: 840 },
  { id: "rana", name: "رانا", detail: "ایران‌خودرو · ۱۳۹۰ به بعد", segment: "اقتصادی", consumption: 7.6, valueToman: 850_000_000, lifeKm: 290_000, servicePerKm: 790 },
  { id: "dena", name: "دنا", detail: "ایران‌خودرو · ۱۳۹۴ به بعد", segment: "متوسط", consumption: 8.0, valueToman: 1_100_000_000, lifeKm: 300_000, servicePerKm: 850 },
  { id: "dena-plus", name: "دنا پلاس", detail: "ایران‌خودرو · ۱۳۹۸ به بعد", segment: "متوسط", consumption: 8.2, valueToman: 1_300_000_000, lifeKm: 300_000, servicePerKm: 880 },
  { id: "dena-turbo", name: "دنا پلاس توربو", detail: "ایران‌خودرو · ۱۴۰۰ به بعد", segment: "متوسط", consumption: 8.6, valueToman: 1_500_000_000, lifeKm: 290_000, servicePerKm: 950 },
  { id: "tara", name: "تارا", detail: "ایران‌خودرو · ۱۴۰۰ به بعد", segment: "متوسط", consumption: 8.2, valueToman: 1_500_000_000, lifeKm: 300_000, servicePerKm: 900 },
  { id: "reera", name: "ری‌را", detail: "ایران‌خودرو · ۱۴۰۲ به بعد", segment: "متوسط", consumption: 8.3, valueToman: 1_450_000_000, lifeKm: 300_000, servicePerKm: 900 },
  { id: "aria", name: "آریا", detail: "ایران‌خودرو · ۱۴۰۳ به بعد", segment: "متوسط", consumption: 8.4, valueToman: 1_600_000_000, lifeKm: 300_000, servicePerKm: 920 },
  { id: "delijan", name: "دلیجان (ون)", detail: "ایران‌خودرو · ۱۳۸۸ به بعد", segment: "وانت و ون", consumption: 10.5, valueToman: 800_000_000, lifeKm: 300_000, servicePerKm: 900 },
  { id: "haima-s5", name: "هایما S5", detail: "ایران‌خودرو · ۱۳۹۵ به بعد", segment: "شاسی‌بلند", consumption: 9.5, valueToman: 2_300_000_000, lifeKm: 280_000, servicePerKm: 1_250 },
  { id: "haima-s7", name: "هایما S7", detail: "ایران‌خودرو · ۱۳۹۶ به بعد", segment: "شاسی‌بلند", consumption: 10.0, valueToman: 2_500_000_000, lifeKm: 280_000, servicePerKm: 1_300 },
  { id: "haima-8s", name: "هایما ۸S", detail: "ایران‌خودرو · ۱۴۰۲ به بعد", segment: "شاسی‌بلند", consumption: 9.2, valueToman: 3_200_000_000, lifeKm: 280_000, servicePerKm: 1_350 },
  { id: "arizo-5", name: "چری آریزو ۵", detail: "مدیران خودرو · ۱۳۹۵ به بعد", segment: "متوسط", consumption: 8.4, valueToman: 1_800_000_000, lifeKm: 280_000, servicePerKm: 1_100 },
  { id: "arizo-6", name: "چری آریزو ۶", detail: "مدیران خودرو · ۱۳۹۸ به بعد", segment: "متوسط", consumption: 8.8, valueToman: 2_200_000_000, lifeKm: 280_000, servicePerKm: 1_150 },
  { id: "tiggo-7", name: "چری تیگو ۷", detail: "مدیران خودرو · ۱۳۹۶ به بعد", segment: "شاسی‌بلند", consumption: 9.5, valueToman: 2_600_000_000, lifeKm: 280_000, servicePerKm: 1_300 },
  { id: "tiggo-8", name: "چری تیگو ۸", detail: "مدیران خودرو · ۱۳۹۹ به بعد", segment: "شاسی‌بلند", consumption: 10.0, valueToman: 3_400_000_000, lifeKm: 280_000, servicePerKm: 1_400 },
  { id: "fidelity", name: "فیدلیتی", detail: "بهمن موتور · ۱۳۹۹ به بعد", segment: "شاسی‌بلند", consumption: 9.5, valueToman: 2_700_000_000, lifeKm: 280_000, servicePerKm: 1_300 },
  { id: "jack-s5", name: "جک S5", detail: "کرمان موتور · ۱۳۹۳ به بعد", segment: "شاسی‌بلند", consumption: 9.6, valueToman: 2_100_000_000, lifeKm: 270_000, servicePerKm: 1_250 },
  { id: "jack-j5", name: "جک J5", detail: "کرمان موتور · ۱۳۹۲ به بعد", segment: "متوسط", consumption: 8.8, valueToman: 1_400_000_000, lifeKm: 270_000, servicePerKm: 1_050 },
  { id: "lifan-x60", name: "لیفان X60", detail: "کرمان موتور · ۱۳۹۲ به بعد", segment: "شاسی‌بلند", consumption: 9.2, valueToman: 1_700_000_000, lifeKm: 260_000, servicePerKm: 1_150 },
  { id: "mvm-x22", name: "MVM X22", detail: "موتور پارسیان · ۱۳۹۵ به بعد", segment: "شاسی‌بلند", consumption: 7.8, valueToman: 1_550_000_000, lifeKm: 260_000, servicePerKm: 1_050 },
  { id: "dignity", name: "دیگنیتی", detail: "بهمن موتور · ۱۳۹۸ به بعد", segment: "شاسی‌بلند", consumption: 9.0, valueToman: 2_400_000_000, lifeKm: 280_000, servicePerKm: 1_250 },
  { id: "peugeot-2008", name: "پژو ۲۰۰۸", detail: "ایران‌خودرو · ۱۳۹۶ به بعد", segment: "شاسی‌بلند", consumption: 7.5, valueToman: 4_000_000_000, lifeKm: 300_000, servicePerKm: 1_500 },
  { id: "renault-captur", name: "رنو کپچر", detail: "پارس‌خودرو · ۱۳۹۷ به بعد", segment: "شاسی‌بلند", consumption: 7.2, valueToman: 3_500_000_000, lifeKm: 300_000, servicePerKm: 1_450 },
  { id: "cerato", name: "کیا سراتو", detail: "سایپا · ۱۳۹۰ به بعد", segment: "متوسط", consumption: 8.0, valueToman: 3_500_000_000, lifeKm: 350_000, servicePerKm: 1_400 },
  { id: "optima", name: "کیا اپتیما", detail: "وارداتی", segment: "لوکس", consumption: 9.0, valueToman: 4_500_000_000, lifeKm: 350_000, servicePerKm: 1_700 },
  { id: "sportage", name: "کیا اسپورتیج", detail: "وارداتی", segment: "شاسی‌بلند", consumption: 9.0, valueToman: 5_000_000_000, lifeKm: 350_000, servicePerKm: 1_800 },
  { id: "tucson", name: "هیوندای توسان", detail: "وارداتی", segment: "شاسی‌بلند", consumption: 9.0, valueToman: 4_800_000_000, lifeKm: 350_000, servicePerKm: 1_800 },
  { id: "sonata", name: "هیوندای سوناتا", detail: "وارداتی", segment: "لوکس", consumption: 8.5, valueToman: 5_000_000_000, lifeKm: 350_000, servicePerKm: 1_800 },
  { id: "corolla", name: "تویوتا کرولا", detail: "وارداتی", segment: "متوسط", consumption: 7.5, valueToman: 4_500_000_000, lifeKm: 400_000, servicePerKm: 1_600 },
  { id: "camry", name: "تویوتا کمری", detail: "وارداتی", segment: "لوکس", consumption: 8.5, valueToman: 5_500_000_000, lifeKm: 400_000, servicePerKm: 1_800 },
  { id: "benz-e", name: "مرسدس بنز E-Class", detail: "وارداتی", segment: "لوکس", consumption: 8.5, valueToman: 9_000_000_000, lifeKm: 400_000, servicePerKm: 2_600 },
  { id: "bmw-5", name: "بی‌ام‌و سری ۵", detail: "وارداتی", segment: "لوکس", consumption: 8.5, valueToman: 8_000_000_000, lifeKm: 400_000, servicePerKm: 2_500 },

  // ------------------------------------------------ سایپا و ایران‌خودرو (تکمیلی)
  { id: "shahin-plus", name: "شاهین پلاس", detail: "سایپا · ۱۴۰۲ به بعد", segment: "متوسط", consumption: 8.1, valueToman: 1_600_000_000, lifeKm: 300_000, servicePerKm: 880, aliases: ["shahin plus"] },
  { id: "sahand", name: "سایپا سهند", detail: "سایپا · ۱۴۰۲ به بعد", segment: "اقتصادی", consumption: 7.4, valueToman: 1_100_000_000, lifeKm: 300_000, servicePerKm: 780, aliases: ["sahand"] },
  { id: "atlas", name: "سایپا اطلس", detail: "سایپا · ۱۴۰۳ به بعد", segment: "اقتصادی", consumption: 7.6, valueToman: 1_300_000_000, lifeKm: 300_000, servicePerKm: 800, aliases: ["atlas"] },
  { id: "quake-r", name: "کوییک R / اس", detail: "سایپا · ۱۴۰۰ به بعد", segment: "اقتصادی", consumption: 7.0, valueToman: 850_000_000, lifeKm: 280_000, servicePerKm: 720, aliases: ["quick r", "quick s"] },
  { id: "tiba-2", name: "تیبا ۲", detail: "سایپا · ۱۳۹۵ تا ۱۴۰۰", segment: "اقتصادی", consumption: 7.1, valueToman: 660_000_000, lifeKm: 270_000, servicePerKm: 690, aliases: ["tiba 2"] },
  { id: "saina-plus", name: "ساینا اس / پلاس", detail: "سایپا · ۱۴۰۰ به بعد", segment: "اقتصادی", consumption: 6.9, valueToman: 780_000_000, lifeKm: 280_000, servicePerKm: 720, aliases: ["saina s"] },
  { id: "peugeot-206-sd", name: "پژو ۲۰۶ صندوق‌دار", detail: "ایران‌خودرو · ۱۳۸۷ به بعد", segment: "اقتصادی", consumption: 7.7, valueToman: 950_000_000, lifeKm: 280_000, servicePerKm: 800, aliases: ["206 sd"] },
  { id: "peugeot-301", name: "پژو ۳۰۱", detail: "ایران‌خودرو · ۱۳۹۵ به بعد", segment: "متوسط", consumption: 7.2, valueToman: 2_600_000_000, lifeKm: 300_000, servicePerKm: 1_250, aliases: ["301"] },
  { id: "peugeot-208", name: "پژو ۲۰۸", detail: "ایران‌خودرو · ۱۳۹۷ به بعد", segment: "متوسط", consumption: 6.8, valueToman: 3_600_000_000, lifeKm: 300_000, servicePerKm: 1_400, aliases: ["208"] },
  { id: "roniz", name: "رونیز", detail: "ایران‌خودرو · ۱۴۰۳ به بعد", segment: "شاسی‌بلند", consumption: 8.0, valueToman: 2_400_000_000, lifeKm: 300_000, servicePerKm: 1_150, aliases: ["roniz"] },
  { id: "tara-plus", name: "تارا اتوماتیک", detail: "ایران‌خودرو · ۱۴۰۲ به بعد", segment: "متوسط", consumption: 8.0, valueToman: 1_800_000_000, lifeKm: 300_000, servicePerKm: 950, aliases: ["tara automatic"] },

  // ------------------------------------------------ برلیانس و لیفان و MVM
  { id: "brilliance-h220", name: "برلیانس H220", detail: "سایپا · ۱۳۹۳ تا ۱۳۹۷", segment: "اقتصادی", consumption: 7.2, valueToman: 780_000_000, lifeKm: 260_000, servicePerKm: 900, aliases: ["brilliance h220", "h220"] },
  { id: "brilliance-h230", name: "برلیانس H230", detail: "سایپا · ۱۳۹۲ تا ۱۳۹۸", segment: "اقتصادی", consumption: 7.3, valueToman: 800_000_000, lifeKm: 260_000, servicePerKm: 900, aliases: ["brilliance h230", "h230"] },
  { id: "brilliance-h320", name: "برلیانس H320", detail: "سایپا · ۱۳۹۳ تا ۱۳۹۷", segment: "متوسط", consumption: 7.6, valueToman: 900_000_000, lifeKm: 260_000, servicePerKm: 950, aliases: ["brilliance h320", "h320"] },
  { id: "brilliance-h330", name: "برلیانس H330", detail: "سایپا · ۱۳۹۴ تا ۱۳۹۸", segment: "متوسط", consumption: 7.8, valueToman: 980_000_000, lifeKm: 260_000, servicePerKm: 980, aliases: ["brilliance h330", "h330"] },
  { id: "brilliance-cross230", name: "برلیانس کراس ۲۳۰", detail: "سایپا · ۱۳۹۵ تا ۱۳۹۸", segment: "شاسی‌بلند", consumption: 8.4, valueToman: 1_150_000_000, lifeKm: 260_000, servicePerKm: 1_050, aliases: ["brilliance cross 230", "cross 230"] },
  { id: "brilliance-v5", name: "برلیانس V5", detail: "سایپا · ۱۳۹۵ تا ۱۳۹۸", segment: "شاسی‌بلند", consumption: 9.0, valueToman: 1_500_000_000, lifeKm: 260_000, servicePerKm: 1_150, aliases: ["brilliance v5", "v5"] },
  { id: "brilliance-frv", name: "برلیانس FRV کراس", detail: "سایپا · ۱۳۹۲ تا ۱۳۹۶", segment: "اقتصادی", consumption: 7.9, valueToman: 720_000_000, lifeKm: 260_000, servicePerKm: 950, aliases: ["brilliance frv"] },
  { id: "lifan-620", name: "لیفان ۶۲۰", detail: "کرمان موتور · ۱۳۹۱ تا ۱۳۹۷", segment: "اقتصادی", consumption: 7.8, valueToman: 750_000_000, lifeKm: 250_000, servicePerKm: 950, aliases: ["lifan 620"] },
  { id: "lifan-820", name: "لیفان ۸۲۰", detail: "کرمان موتور · ۱۳۹۵ تا ۱۳۹۸", segment: "متوسط", consumption: 8.6, valueToman: 1_050_000_000, lifeKm: 250_000, servicePerKm: 1_050, aliases: ["lifan 820"] },
  { id: "lifan-x50", name: "لیفان X50", detail: "کرمان موتور · ۱۳۹۴ به بعد", segment: "شاسی‌بلند", consumption: 8.2, valueToman: 1_200_000_000, lifeKm: 250_000, servicePerKm: 1_050, aliases: ["lifan x50", "x50"] },
  { id: "lifan-x70", name: "لیفان X70", detail: "کرمان موتور · ۱۳۹۶ به بعد", segment: "شاسی‌بلند", consumption: 9.0, valueToman: 1_500_000_000, lifeKm: 250_000, servicePerKm: 1_100, aliases: ["lifan x70", "x70"] },
  { id: "mvm-110", name: "MVM 110", detail: "موتور پارسیان · ۱۳۸۷ تا ۱۳۹۶", segment: "اقتصادی", consumption: 6.2, valueToman: 520_000_000, lifeKm: 240_000, servicePerKm: 800, aliases: ["mvm 110"] },
  { id: "mvm-315", name: "MVM 315", detail: "موتور پارسیان · ۱۳۹۰ تا ۱۳۹۸", segment: "اقتصادی", consumption: 6.8, valueToman: 620_000_000, lifeKm: 240_000, servicePerKm: 850, aliases: ["mvm 315"] },
  { id: "mvm-530", name: "MVM 530", detail: "موتور پارسیان · ۱۳۹۳ تا ۱۳۹۸", segment: "اقتصادی", consumption: 7.4, valueToman: 780_000_000, lifeKm: 240_000, servicePerKm: 900, aliases: ["mvm 530"] },
  { id: "mvm-x33", name: "MVM X33", detail: "موتور پارسیان · ۱۳۹۱ به بعد", segment: "شاسی‌بلند", consumption: 8.4, valueToman: 1_050_000_000, lifeKm: 250_000, servicePerKm: 1_000, aliases: ["mvm x33", "x33"] },
  { id: "mvm-x55", name: "MVM X55", detail: "موتور پارسیان · ۱۳۹۴ به بعد", segment: "شاسی‌بلند", consumption: 8.8, valueToman: 1_300_000_000, lifeKm: 250_000, servicePerKm: 1_050, aliases: ["mvm x55", "x55"] },

  // ------------------------------------------------ چری / فونیکس / جک
  { id: "chery-envy", name: "چری انوی", detail: "مدیران خودرو · ۱۳۸۹ تا ۱۳۹۵", segment: "اقتصادی", consumption: 7.0, valueToman: 800_000_000, lifeKm: 250_000, servicePerKm: 950, aliases: ["chery envy"] },
  { id: "tiggo-3", name: "چری تیگو ۳", detail: "مدیران خودرو · ۱۳۹۳ تا ۱۳۹۷", segment: "شاسی‌بلند", consumption: 8.6, valueToman: 1_300_000_000, lifeKm: 260_000, servicePerKm: 1_100, aliases: ["tiggo 3"] },
  { id: "tiggo-5", name: "چری تیگو ۵", detail: "مدیران خودرو · ۱۳۹۴ تا ۱۳۹۹", segment: "شاسی‌بلند", consumption: 9.0, valueToman: 1_800_000_000, lifeKm: 270_000, servicePerKm: 1_150, aliases: ["tiggo 5"] },
  { id: "tiggo-8-pro", name: "چری تیگو ۸ پرو", detail: "مدیران خودرو · ۱۴۰۱ به بعد", segment: "شاسی‌بلند", consumption: 9.6, valueToman: 3_900_000_000, lifeKm: 280_000, servicePerKm: 1_450, aliases: ["tiggo 8 pro"] },
  { id: "fx", name: "فونیکس FX", detail: "مدیران خودرو · ۱۴۰۱ به بعد", segment: "شاسی‌بلند", consumption: 9.4, valueToman: 3_600_000_000, lifeKm: 280_000, servicePerKm: 1_450, aliases: ["fonix fx", "fx"] },
  { id: "arizo-8", name: "چری آریزو ۸", detail: "مدیران خودرو · ۱۴۰۲ به بعد", segment: "متوسط", consumption: 9.0, valueToman: 2_900_000_000, lifeKm: 280_000, servicePerKm: 1_300, aliases: ["arizo 8"] },
  { id: "jack-s3", name: "جک S3", detail: "کرمان موتور · ۱۳۹۶ به بعد", segment: "شاسی‌بلند", consumption: 8.2, valueToman: 1_600_000_000, lifeKm: 270_000, servicePerKm: 1_100, aliases: ["jack s3", "s3"] },
  { id: "jack-j4", name: "جک J4", detail: "کرمان موتور · ۱۳۹۷ به بعد", segment: "اقتصادی", consumption: 7.6, valueToman: 1_200_000_000, lifeKm: 260_000, servicePerKm: 1_000, aliases: ["jack j4", "j4"] },
  { id: "jack-t8", name: "جک T8 (پیکاپ)", detail: "کرمان موتور · ۱۳۹۹ به بعد", segment: "وانت و ون", consumption: 11.0, valueToman: 2_400_000_000, lifeKm: 280_000, servicePerKm: 1_350, aliases: ["jack t8"] },
  { id: "dongfeng-h30", name: "دانگ‌فنگ H30 کراس", detail: "ایران‌خودرو · ۱۳۹۶ به بعد", segment: "اقتصادی", consumption: 7.9, valueToman: 1_250_000_000, lifeKm: 260_000, servicePerKm: 1_000, aliases: ["dongfeng h30"] },

  // ------------------------------------------------ فرانسوی و اروپایی
  { id: "renault-l90", name: "رنو ال ۹۰", detail: "پارس‌خودرو · ۱۳۸۶ تا ۱۳۹۷", segment: "اقتصادی", consumption: 6.5, valueToman: 650_000_000, lifeKm: 260_000, servicePerKm: 850, aliases: ["renault l90", "l90"] },
  { id: "renault-sandero", name: "رنو ساندرو", detail: "پارس‌خودرو · ۱۳۹۵ به بعد", segment: "اقتصادی", consumption: 6.9, valueToman: 1_600_000_000, lifeKm: 280_000, servicePerKm: 1_000, aliases: ["renault sandero", "sandero"] },
  { id: "renault-duster", name: "رنو داستر", detail: "پارس‌خودرو · ۱۳۹۷ به بعد", segment: "شاسی‌بلند", consumption: 8.2, valueToman: 3_200_000_000, lifeKm: 300_000, servicePerKm: 1_400, aliases: ["renault duster", "duster"] },
  { id: "renault-talisman", name: "رنو تلیسمان", detail: "وارداتی", segment: "لوکس", consumption: 8.0, valueToman: 5_500_000_000, lifeKm: 350_000, servicePerKm: 1_900, aliases: ["renault talisman"] },
  { id: "citroen-c3", name: "سیتروئن C3", detail: "سایپا · ۱۳۹۶ به بعد", segment: "اقتصادی", consumption: 6.6, valueToman: 2_600_000_000, lifeKm: 300_000, servicePerKm: 1_350, aliases: ["citroen c3", "c3"] },
  { id: "citroen-c5", name: "سیتروئن C5", detail: "سایپا · ۱۳۹۷ به بعد", segment: "لوکس", consumption: 8.4, valueToman: 5_800_000_000, lifeKm: 330_000, servicePerKm: 2_000, aliases: ["citroen c5", "c5"] },
  { id: "peugeot-508", name: "پژو ۵۰۸", detail: "ایران‌خودرو · ۱۳۹۶ به بعد", segment: "لوکس", consumption: 8.0, valueToman: 6_500_000_000, lifeKm: 330_000, servicePerKm: 2_100, aliases: ["508"] },
  { id: "vw-tiguan", name: "فولکس‌واگن تیگوان", detail: "وارداتی", segment: "شاسی‌بلند", consumption: 8.6, valueToman: 7_500_000_000, lifeKm: 350_000, servicePerKm: 2_300, aliases: ["tiguan", "vw tiguan"] },
  { id: "vw-golf", name: "فولکس‌واگن گلف", detail: "وارداتی", segment: "متوسط", consumption: 7.0, valueToman: 6_000_000_000, lifeKm: 350_000, servicePerKm: 2_100, aliases: ["golf", "vw golf"] },
  { id: "vw-passat", name: "فولکس‌واگن پاسات", detail: "وارداتی", segment: "لوکس", consumption: 8.2, valueToman: 7_000_000_000, lifeKm: 350_000, servicePerKm: 2_300, aliases: ["passat"] },

  // ------------------------------------------------ ژاپنی و کره‌ای
  { id: "hyundai-accent", name: "هیوندای اکسنت", detail: "وارداتی", segment: "متوسط", consumption: 7.2, valueToman: 5_000_000_000, lifeKm: 380_000, servicePerKm: 1_700, aliases: ["hyundai accent", "accent"] },
  { id: "hyundai-elantra", name: "هیوندای النترا", detail: "وارداتی", segment: "متوسط", consumption: 7.5, valueToman: 5_500_000_000, lifeKm: 380_000, servicePerKm: 1_800, aliases: ["elantra"] },
  { id: "hyundai-i20", name: "هیوندای i20", detail: "وارداتی", segment: "اقتصادی", consumption: 6.4, valueToman: 3_500_000_000, lifeKm: 350_000, servicePerKm: 1_500, aliases: ["i20"] },
  { id: "kia-rio", name: "کیا ریو", detail: "سایپا / وارداتی", segment: "اقتصادی", consumption: 6.6, valueToman: 3_800_000_000, lifeKm: 350_000, servicePerKm: 1_500, aliases: ["kia rio", "rio"] },
  { id: "kia-cerato-saipa", name: "کیا سراتو سایپا", detail: "سایپا · ۱۳۹۴ به بعد", segment: "متوسط", consumption: 7.8, valueToman: 3_800_000_000, lifeKm: 350_000, servicePerKm: 1_400, aliases: ["cerato saipa"] },
  { id: "toyota-yaris", name: "تویوتا یاریس", detail: "وارداتی", segment: "اقتصادی", consumption: 6.2, valueToman: 5_200_000_000, lifeKm: 400_000, servicePerKm: 1_600, aliases: ["yaris"] },
  { id: "toyota-rav4", name: "تویوتا راو ۴", detail: "وارداتی", segment: "شاسی‌بلند", consumption: 8.0, valueToman: 9_000_000_000, lifeKm: 400_000, servicePerKm: 2_200, aliases: ["rav4", "rav 4"] },
  { id: "toyota-land-cruiser", name: "تویوتا لندکروزر", detail: "وارداتی", segment: "شاسی‌بلند", consumption: 13.5, valueToman: 14_000_000_000, lifeKm: 500_000, servicePerKm: 2_800, aliases: ["land cruiser", "landcruiser"] },
  { id: "nissan-juke", name: "نیسان جوک", detail: "وارداتی", segment: "شاسی‌بلند", consumption: 7.0, valueToman: 6_000_000_000, lifeKm: 350_000, servicePerKm: 1_900, aliases: ["juke"] },
  { id: "nissan-qashqai", name: "نیسان قشقایی", detail: "وارداتی", segment: "شاسی‌بلند", consumption: 7.6, valueToman: 7_000_000_000, lifeKm: 350_000, servicePerKm: 2_000, aliases: ["qashqai"] },
  { id: "nissan-patrol", name: "نیسان پاترول", detail: "وارداتی", segment: "شاسی‌بلند", consumption: 15.0, valueToman: 12_000_000_000, lifeKm: 500_000, servicePerKm: 2_800, aliases: ["patrol"] },
  { id: "mitsubishi-asx", name: "میتسوبیشی ASX", detail: "وارداتی", segment: "شاسی‌بلند", consumption: 7.8, valueToman: 6_500_000_000, lifeKm: 350_000, servicePerKm: 2_000, aliases: ["asx"] },
  { id: "honda-crv", name: "هوندا CR-V", detail: "وارداتی", segment: "شاسی‌بلند", consumption: 8.2, valueToman: 9_500_000_000, lifeKm: 400_000, servicePerKm: 2_300, aliases: ["crv", "cr-v"] },

  // ------------------------------------------------ ون و مسافربری
  { id: "hyundai-h1", name: "هیوندای H1 (ون)", detail: "وارداتی", segment: "وانت و ون", consumption: 10.5, valueToman: 8_000_000_000, lifeKm: 450_000, servicePerKm: 2_200, aliases: ["h1", "starex"] },
  { id: "toyota-hiace", name: "تویوتا هایس (ون)", detail: "وارداتی", segment: "وانت و ون", consumption: 11.5, valueToman: 9_000_000_000, lifeKm: 500_000, servicePerKm: 2_400, aliases: ["hiace"] },
  { id: "maxus-v80", name: "مکسوس V80 (ون)", detail: "وارداتی", segment: "وانت و ون", consumption: 10.0, valueToman: 6_000_000_000, lifeKm: 400_000, servicePerKm: 2_000, aliases: ["maxus v80"] },
];

const NORMALISE = (value: string) =>
  value
    .toLowerCase()
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\u200c/g, " ")
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/\s+/g, " ")
    .trim();

/** Persian-aware search over name, detail and segment. */
export function searchCars(term: string): CarModel[] {
  const needle = NORMALISE(term);
  if (!needle) return CARS;
  // Every word must match somewhere, so «برلیانس 230» finds H230 and «brilliance» finds all of them.
  const words = needle.split(" ").filter(Boolean);
  const scored = CARS.map((car) => {
    const haystack = NORMALISE(`${car.name} ${car.detail} ${car.segment} ${(car.aliases || []).join(" ")}`);
    const latin = haystack.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
    const matches = words.every((word) => haystack.includes(word) || latin.includes(word));
    if (!matches) return null;
    const startsWith = words.length === 1 && NORMALISE(car.name).startsWith(words[0]) ? 0 : 1;
    return { car, rank: startsWith };
  }).filter((entry): entry is { car: CarModel; rank: number } => entry !== null);
  return scored.sort((a, b) => a.rank - b.rank || a.car.name.localeCompare(b.car.name, "fa")).map((entry) => entry.car);
}

export function findCar(id: string): CarModel | undefined {
  return CARS.find((car) => car.id === id);
}

/** The car most people start from: cheap, common, easy to compare. */
export const DEFAULT_CAR_ID = "pride";

/** Fuel prices that are actually on the pump today, per litre. */
export const FUEL_OPTIONS = [
  { id: "quota", label: "بنزین سهمیه‌ای", pricePerLiter: 1_500, hint: "با کارت سوخت و سهمیهٔ ماهانه" },
  { id: "free", label: "بنزین آزاد", pricePerLiter: 3_000, hint: "بدون سهمیه، قیمت آزاد" },
  { id: "custom", label: "قیمت دلخواه", pricePerLiter: 3_000, hint: "اگر قیمت دیگری پرداخت می‌کنید" },
] as const;

export type FuelOptionId = (typeof FUEL_OPTIONS)[number]["id"];
