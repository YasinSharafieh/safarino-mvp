/**
 * What a room really costs, and for whom.
 *
 * Providers quote a total for the rooms searched, which is easy to misread: a
 * card that says «۱٬۵۰۰٬۰۰۰» looks per person or per night depending on the
 * reader. Safarino always shows the whole arithmetic instead:
 *
 *   per person per night × people × nights  =  total
 *
 * The total is the provider's own figure; the per-person line is derived from
 * it. When a provider deviates from that arithmetic the provider's total is
 * kept and the difference is said out loud rather than silently smoothed over.
 */

export type StayPrice = {
  /** Toman for one guest for one night. */
  perPersonPerNight: number;
  /** Toman for the whole unit for one night. */
  perNight: number;
  people: number;
  nights: number;
  /** The provider's total — the number that will actually be charged. */
  total: number;
  /** True when provider total matches people × nights × per-person. */
  consistent: boolean;
  /** A plain sentence with the whole multiplication in it. */
  formula: string;
  /** Villas and homes are priced per unit, so «هر نفر» would be a lie. */
  perUnit: boolean;
};

const fa = new Intl.NumberFormat("fa-IR");

export function stayPrice(input: {
  priceTotalToman: number;
  pricePerNightToman: number;
  people: number;
  nights: number;
  kind?: "hotel" | "stay";
}): StayPrice {
  const people = Math.max(1, Math.round(input.people || 1));
  const nights = Math.max(1, Math.round(input.nights || 1));
  const total = Math.max(0, Math.round(input.priceTotalToman || 0));
  const perNight = input.pricePerNightToman > 0 ? Math.round(input.pricePerNightToman) : Math.round(total / nights);
  const perUnit = input.kind === "stay";
  // A villa's nightly price is for the whole home; a hotel's is for the rooms
  // searched, i.e. for every guest.
  const perPersonPerNight = perUnit ? perNight : Math.round(perNight / people);
  const expected = perUnit ? perNight * nights : perPersonPerNight * people * nights;
  const consistent = Math.abs(expected - total) <= Math.max(2_000, total * 0.02);
  const formula = perUnit
    ? `${fa.format(perNight)} تومان هر شب × ${fa.format(nights)} شب = ${fa.format(Math.round(perNight * nights))} تومان`
    : `${fa.format(perPersonPerNight)} تومان هر نفر هر شب × ${fa.format(people)} نفر × ${fa.format(nights)} شب = ${fa.format(perPersonPerNight * people * nights)} تومان`;
  return { perPersonPerNight, perNight, people, nights, total, consistent, formula, perUnit };
}
