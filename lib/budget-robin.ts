/**
 * «بودجهٔ رابین‌هود» — money the traveller saved on one step is offered back to
 * them on the next one.
 *
 * It only ever suggests an option that really exists in the list the page is
 * already showing, and it only ever quotes numbers that list contains.
 */

export type RobinOffer = {
  id: string;
  name: string;
  typeLabel: string;
  priceToman: number;
  rating?: number | null;
};

export type RobinInput = {
  budgetToman: number;
  transportToman: number;
  foodToman: number;
  /** The stay already chosen (0 when nothing is chosen yet). */
  currentStayToman: number;
  offers: RobinOffer[];
};

export type RobinSuggestion = {
  offerId: string;
  name: string;
  typeLabel: string;
  priceToman: number;
  extraToman: number;
  rating: number | null;
  /** What the traveller can spend on a room right now. */
  roomBudgetToman: number;
  text: string;
  tone: "upgrade" | "fits" | "tight";
};

function fa(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(Math.round(value));
}

function money(value: number): string {
  return `${fa(value)} تومان`;
}

/**
 * The suggestion, or a plain sentence about the money when there is nothing to
 * upgrade to. Nothing is suggested that the remaining money cannot pay for.
 */
export function robinPlan(input: RobinInput): RobinSuggestion | null {
  const roomBudget = Math.round(input.budgetToman - input.transportToman - input.foodToman);
  const candidates = input.offers
    .filter((offer) => offer.priceToman > 0)
    .filter((offer) => offer.priceToman > input.currentStayToman)
    .filter((offer) => offer.priceToman <= roomBudget)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0) || a.priceToman - b.priceToman);

  const best = candidates[0];
  if (!best) {
    if (roomBudget <= 0) {
      return null;
    }
    return null;
  }

  const extra = best.priceToman - input.currentStayToman;
  const text =
    input.currentStayToman > 0
      ? `با ${money(roomBudget)} تومانی که برای اقامت مانده، می‌توانی ${best.name} را انتخاب کنی؛ ${money(extra)} بیشتر از انتخاب فعلی است${
          best.rating ? ` و امتیاز ${fa(best.rating)} دارد` : ""
        }. خودت تصمیم بگیر — من فقط حساب کردم.`
      : `برای اقامت ${money(roomBudget)} جا داری. ${best.name} (${best.typeLabel}) ${money(best.priceToman)} است${
          best.rating ? ` با امتیاز ${fa(best.rating)}` : ""
        } و داخل همین عدد جا می‌شود.`;

  return {
    offerId: best.id,
    name: best.name,
    typeLabel: best.typeLabel,
    priceToman: best.priceToman,
    extraToman: extra,
    rating: best.rating ?? null,
    roomBudgetToman: roomBudget,
    text,
    tone: extra > 0 ? "upgrade" : "fits",
  };
}
