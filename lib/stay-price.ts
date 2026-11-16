/**
 * What a room really costs, and for whom.
 *
 * Providers publish a nightly rate for a *room*, not for a person. A card that
 * says «۲٬۳۷۹٬۰۰۰» for «اتاق دو تخته» costs the same whether one or two people
 * sleep in it — so dividing it by the party size (what the site used to do)
 * made a three-person trip look cheaper than a two-person one.
 *
 * Safarino now prices by room, the way a reception desk does:
 *
 *   ۱) چند نفرید؟ ۲ نفر → اتاق دو نفره، ۳ نفر → اتاق سه نفره، ۴ نفر → چهار نفره
 *      (بیشتر از چهار نفر: چند اتاق، با کمترین تعداد اتاق)
 *   ۲) نرخ هر شب همان اتاق × تعداد شب = قیمت کل
 *
 * The only assumption is the extra-bed surcharge (a triple costs more than a
 * double), and it is written on screen as an assumption, never hidden.
 */

export type RoomKind = "single" | "double" | "triple" | "quad";

export const ROOM_KIND_LABEL: Record<RoomKind, string> = {
  single: "اتاق یک‌نفره",
  double: "اتاق دو نفره",
  triple: "اتاق سه‌نفره",
  quad: "اتاق چهارنفره",
};

/**
 * Multiplier applied to a provider's double-room rate. Reception desks charge an
 * extra bed for the third and fourth guest; 1.35 and 1.60 are the usual range
 * and are stated on screen as an assumption («تخمین با فرض تخت اضافه»).
 */
export const ROOM_KIND_MULTIPLIER: Record<RoomKind, number> = {
  // One guest still pays the room, not half a room — reception desks do not
  // give a discount for travelling alone.
  single: 1,
  double: 1,
  triple: 1.35,
  quad: 1.6,
};

export type RoomMix = {
  guests: number;
  /** One entry per room type used. */
  parts: { kind: RoomKind; count: number }[];
  rooms: number;
  /** How many guests the mix sleeps. */
  capacity: number;
  /** «۱ اتاق سه‌نفره» or «۱ اتاق چهارنفره + ۱ اتاق یک‌نفره» */
  label: string;
  note: string;
};

const fa = new Intl.NumberFormat("fa-IR");

/** The rooms a party of this size actually books. */
export function roomMix(guests: number): RoomMix {
  const people = Math.max(1, Math.round(guests || 1));
  const parts: { kind: RoomKind; count: number }[] = [];
  if (people <= 4) {
    const kind: RoomKind = people === 1 ? "single" : people === 2 ? "double" : people === 3 ? "triple" : "quad";
    parts.push({ kind, count: 1 });
  } else {
    const quads = Math.floor(people / 4);
    const rest = people % 4;
    if (quads > 0) parts.push({ kind: "quad", count: quads });
    if (rest > 0)parts.push({ kind: rest === 1 ? "single" : rest === 2 ? "double" : "triple", count: 1 });
  }
  const rooms = parts.reduce((sum, part) => sum + part.count, 0);
  const capacity = parts.reduce((sum, part) => sum + part.count * roomCapacity(part.kind), 0);
  const label = parts.map((part) => `${fa.format(part.count)} ${ROOM_KIND_LABEL[part.kind]}`).join(" + ");
  return {
    guests: people,
    parts,
    rooms,
    capacity,
    label,
    note:
      rooms === 1
        ? `برای ${fa.format(people)} نفر یک ${ROOM_KIND_LABEL[parts[0].kind]} رزرو می‌شود.`
        : `برای ${fa.format(people)} نفر ${label} رزرو می‌شود (${fa.format(rooms)} اتاق).`,
  };
}

function roomCapacity(kind: RoomKind): number {
  return kind === "single" ? 1 : kind === "double" ? 2 : kind === "triple" ? 3 : 4;
}

/** A blunt multiplier for the whole mix, weighted by how many rooms of each kind. */
export function roomMixMultiplier(mix: RoomMix): number {
  if (!mix.parts.length) return 1;
  const totalRooms = mix.parts.reduce((sum, part) => sum + part.count, 0);
  const weighted = mix.parts.reduce((sum, part) => sum + part.count * ROOM_KIND_MULTIPLIER[part.kind], 0);
  return weighted / totalRooms;
}

export type StayPrice = {
  /** Toman for one night of the rooms this party books. */
  perNight: number;
  /** Toman for one guest for one night (kept for the old per-person line). */
  perPersonPerNight: number;
  people: number;
  nights: number;
  /** The number that will actually be charged. */
  total: number;
  /** True when the total is exactly room rate × nights. */
  consistent: boolean;
  /** A plain sentence with the whole multiplication in it. */
  formula: string;
  /** Villas and homes are priced per unit, so «هر نفر» would be a lie. */
  perUnit: boolean;
  /** The rooms this party books. */
  rooms: number;
  roomLabel: string;
  roomMixNote: string;
  /** The provider's own nightly rate for one double room, before any addition. */
  baseRate: number;
  /** True when the party is larger than a double room, so a surcharge applies. */
  adjusted: boolean;
  /** One line the UI prints under the price so nothing is hidden. */
  assumptionNote: string;
};

export function stayPrice(input: {
  priceTotalToman: number;
  pricePerNightToman: number;
  people: number;
  nights: number;
  kind?: "hotel" | "stay";
  /**
   * The party size as entered on the search screen. When given, the price is
   * rebuilt from the provider's nightly room rate for this many guests.
   */
  guests?: number;
  /**
   * How the nightly figure should be read:
   *  room  — the provider's rate for one double room (needs the room mix)
   *  unit  — a whole villa/apartment
   *  final — already priced for this party (offers that came back from
   *          `lib/accommodation-search` with the room mix applied)
   */
  basis?: "room" | "unit" | "final";
}): StayPrice {
  const people = Math.max(1, Math.round(input.guests ?? input.people ?? 1));
  const nights = Math.max(1, Math.round(input.nights || 1));
  const perUnit = input.kind === "stay" || input.basis === "unit";
  const providerTotal = Math.max(0, Math.round(input.priceTotalToman || 0));
  const providerPerNight =
    input.pricePerNightToman > 0 ? Math.round(input.pricePerNightToman) : Math.round(providerTotal / Math.max(1, nights));

  if (perUnit) {
    // A villa's nightly price is for the whole home; the party size is free.
    const perNight = providerPerNight;
    const total = perNight * nights;
    return {
      perNight,
      perPersonPerNight: Math.round(perNight / people),
      people,
      nights,
      total,
      consistent: true,
      perUnit: true,
      formula: `${fa.format(perNight)} تومان هر شب برای کل اقامتگاه × ${fa.format(nights)} شب = ${fa.format(total)} تومان`,
      rooms: 1,
      roomLabel: "کل اقامتگاه",
      roomMixNote: `قیمت این اقامتگاه برای کل خانه است و به تعداد نفرات بستگی ندارد (${fa.format(people)} نفر).`,
      baseRate: perNight,
      adjusted: false,
      assumptionNote: "قیمت کل اقامتگاه، همان نرخی است که سرویس‌دهنده اعلام کرده.",
    };
  }

  const mix = roomMix(people);

  if (input.basis === "final") {
    // The offer already carries the rooms this party books; only print it.
    const perNight = providerPerNight > 0 ? providerPerNight : Math.round(providerTotal / nights);
    const total = perNight * nights;
    return {
      perNight,
      perPersonPerNight: Math.round(perNight / people),
      people,
      nights,
      total,
      consistent: Math.abs(total - providerTotal) <= Math.max(2_000, providerTotal * 0.02),
      perUnit: false,
      formula: `${fa.format(perNight)} تومان هر شب (${mix.label}) × ${fa.format(nights)} شب = ${fa.format(total)} تومان`,
      rooms: mix.rooms,
      roomLabel: mix.label,
      roomMixNote: mix.note,
      baseRate: perNight,
      adjusted: false,
      assumptionNote: `قیمت برای ${mix.label} و ${fa.format(nights)} شب حساب شده است.`,
    };
  }

  const baseRate = providerPerNight; // the provider's rate for one double room
  const multiplier = roomMixMultiplier(mix);
  const perNight = Math.round(baseRate * multiplier * mix.rooms);
  const total = perNight * nights;
  const perPersonPerNight = Math.round(perNight / people);
  const adjusted = Math.abs(multiplier * mix.rooms - 1) > 0.001;
  const roomGrade = mix.parts.map((part) => ROOM_KIND_LABEL[part.kind]).join(" + ");
  const formula = adjusted
    ? `${fa.format(perNight)} تومان هر شب (${roomGrade}) × ${fa.format(nights)} شب = ${fa.format(total)} تومان`
    : `${fa.format(perNight)} تومان هر شب (${roomGrade}) × ${fa.format(nights)} شب = ${fa.format(total)} تومان`;
  const assumptionNote = adjusted
    ? `نرخ اعلامی سرویس‌دهنده برای اتاق دو نفره ${fa.format(baseRate)} تومان است؛ چون ${fa.format(
        people,
      )} نفرید ${mix.label} حساب شد و قیمت با فرض تخت اضافه (${fa.format(Math.round((multiplier - 1) * 100))}٪) به دست آمده — این یک تخمین است، نه نرخ قطعی.`
    : `${fa.format(baseRate)} تومان نرخ اعلامی سرویس‌دهنده برای همان اتاق است؛ × ${fa.format(nights)} شب.`;

  return {
    perNight,
    perPersonPerNight,
    people,
    nights,
    total,
    consistent: true,
    perUnit: false,
    formula,
    rooms: mix.rooms,
    roomLabel: mix.label,
    roomMixNote: mix.note,
    baseRate,
    adjusted,
    assumptionNote,
  };
}

/**
 * «۲۰۰٬۰۰۰ تومان ارزان‌تر شد» — a quick comparison helper for the room list,
 * so the traveller sees what choosing another room actually saves.
 */
export function priceGapToman(a: number, b: number): string {
  const gap = Math.abs(Math.round(a) - Math.round(b));
  return `${fa.format(gap)} تومان`;
}
