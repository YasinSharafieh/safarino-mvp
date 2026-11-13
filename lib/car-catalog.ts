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
  return CARS.filter((car) => NORMALISE(`${car.name} ${car.detail} ${car.segment}`).includes(needle));
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
