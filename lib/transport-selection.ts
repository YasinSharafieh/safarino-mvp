/**
 * «چه وسیله‌ای واقعاً انتخاب شده؟» — one honest answer for every page.
 *
 * The transport choice travels through the browser (localStorage + the shared
 * TravelContext), so a leftover pick from an earlier visit can survive long
 * after the traveller has moved on. Showing «سفر با پراید» to somebody who
 * asked for a train is exactly the kind of lie this file exists to stop: a
 * stored transport is only trusted when it is a complete, known selection.
 */

export const TRANSPORT_MODES = ["plane", "train", "bus", "car"] as const;
export type TransportModeId = (typeof TRANSPORT_MODES)[number];

export const TRANSPORT_MODE_TITLES: Record<TransportModeId, string> = {
  plane: "هواپیما",
  train: "قطار",
  bus: "اتوبوس",
  car: "ماشین شخصی",
};

export type ChosenTransport = {
  mode: TransportModeId;
  modeLabel: string;
  cost: number;
  /** What to show next to the price: the operator, the car name, the service. */
  title: string;
  provider: string;
  providerLabel: string;
  bookingUrl: string;
  departure: string;
  arrival: string;
  fetchedAt: string;
  raw: Record<string, unknown>;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Reads a stored transport and returns it only when it is a real, complete
 * selection. Anything else — another vehicle's leftovers, a zero price, a mode
 * nobody knows — comes back as `null`, and the interface says «انتخاب نشده»
 * instead of inventing a trip.
 */
export function chosenTransport(raw: unknown): ChosenTransport | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const mode = text(data.vehicleId) as TransportModeId;
  if (!TRANSPORT_MODES.includes(mode)) return null;
  const cost = Number(data.cost);
  if (!Number.isFinite(cost) || cost <= 0) return null;

  const offerTitle = text(data.offerTitle);
  const carName = text(data.carName);
  const providerLabel = text(data.providerLabel);
  const title =
    mode === "car"
      ? carName || offerTitle || "محاسبهٔ کامل خودرو"
      : offerTitle || providerLabel || TRANSPORT_MODE_TITLES[mode];
  const details = data.details && typeof data.details === "object" ? (data.details as Record<string, unknown>) : {};

  return {
    mode,
    modeLabel: TRANSPORT_MODE_TITLES[mode],
    cost: Math.round(cost),
    title,
    provider: text(data.provider),
    providerLabel,
    bookingUrl: text(data.bookingUrl),
    departure: text(details.departure) || text(data.departure),
    arrival: text(details.arrival) || text(data.arrival),
    fetchedAt: text(data.fetchedAt),
    raw: data,
  };
}

/** A one-line label such as «قطار · ایران‌تور · ۱٫۷۵۶٫۵۰۰ تومان». */
export function transportHeadline(choice: ChosenTransport): string {
  const money = `${new Intl.NumberFormat("fa-IR").format(choice.cost)} تومان`;
  const what = choice.mode === "car" ? `ماشین شخصی · ${choice.title}` : `${choice.modeLabel}${choice.title && choice.title !== choice.modeLabel ? ` · ${choice.title}` : ""}`;
  return `${what} · ${money}`;
}
