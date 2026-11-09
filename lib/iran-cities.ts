export type IranianCity = {
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  groundCode?: string;
};

export const IRANIAN_CITIES: IranianCity[] = [
  { code: "THR", name: "تهران", latitude: 35.6892, longitude: 51.389 },
  { code: "KIH", name: "کیش", latitude: 26.526, longitude: 53.980 },
  { code: "MHD", name: "مشهد", latitude: 36.2605, longitude: 59.6168 },
  { code: "SYZ", name: "شیراز", latitude: 29.5918, longitude: 52.5837 },
  { code: "IFN", name: "اصفهان", latitude: 32.6539, longitude: 51.666 },
  { code: "RAS", name: "رشت", latitude: 37.2808, longitude: 49.5832, groundCode: "RASHT" },
  { code: "AZD", name: "یزد", latitude: 31.8974, longitude: 54.3569 },
  { code: "TBZ", name: "تبریز", latitude: 38.0805, longitude: 46.2919 },
  { code: "AWZ", name: "اهواز", latitude: 31.3183, longitude: 48.6692 },
  { code: "BND", name: "بندرعباس", latitude: 27.1832, longitude: 56.2666 },
  { code: "GSM", name: "قشم", latitude: 26.8119, longitude: 55.8914 },
  { code: "KER", name: "کرمان", latitude: 30.2839, longitude: 57.0834 },
  { code: "ZAH", name: "زاهدان", latitude: 29.4963, longitude: 60.8629 },
  { code: "URM", name: "ارومیه", latitude: 37.5527, longitude: 45.0761, groundCode: "OMH" },
  { code: "SRY", name: "ساری", latitude: 36.5633, longitude: 53.0601 },
  { code: "GBT", name: "گرگان", latitude: 36.8456, longitude: 54.4393 },
  { code: "HDM", name: "همدان", latitude: 34.7992, longitude: 48.5146, groundCode: "HMD" },
  { code: "KSH", name: "کرمانشاه", latitude: 34.3142, longitude: 47.065, groundCode: "KERSHAH" },
  { code: "QIK", name: "قم", latitude: 34.6401, longitude: 50.8764, groundCode: "QUM" },
  { code: "AJK", name: "اراک", latitude: 34.0917, longitude: 49.6892 },
  { code: "XBJ", name: "بیرجند", latitude: 32.8649, longitude: 59.2211 },
  { code: "BUZ", name: "بوشهر", latitude: 28.9234, longitude: 50.8203 },
  { code: "ZBR", name: "چابهار", latitude: 25.2919, longitude: 60.643 },
];

function normalize(value: string): string {
  return value.trim().replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/\u200c/g, " ").toLowerCase();
}

export function resolveIranianCity(value: string): IranianCity | undefined {
  const normalized = normalize(value);
  return IRANIAN_CITIES.find(
    (city) => city.code.toLowerCase() === normalized || normalize(city.name) === normalized,
  );
}
