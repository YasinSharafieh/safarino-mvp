/**
 * The car cost model.
 *
 * It is deliberately built out of separate, named lines so the traveller can see
 * exactly where every toman comes from — and can change any assumption:
 *
 *   fuel         = kilometres / 100 × litres-per-100km × price per litre
 *   depreciation = kilometres × (car value / useful life in km)
 *   service      = kilometres × service cost per km (tyres, oil, filters)
 *   tolls        = intercity kilometres × toll per km
 *   city         = days × kilometres driven inside the city (fuel + depreciation
 *                  + service, because that driving wears the car too)
 *   parking      = days × parking per day (optional)
 *
 * Nothing is fetched here: the distance is the real road distance measured by
 * the routing service, everything else is arithmetic on the traveller's own
 * assumptions. Every line is therefore honest to label.
 */

import type { CarModel } from "./car-catalog";

export type CarTripInput = {
  car: CarModel;
  /** Real one-way road distance in kilometres (0 when it is not known yet). */
  roadDistanceKm: number;
  roundTrip: boolean;
  /** Days the traveller stays (used for in-city driving and parking). */
  days: number;
  /** Kilometres driven around the city each day. */
  cityKmPerDay: number;
  passengers: number;
  fuelPricePerLiter: number;
  /** Overrides, so a traveller can correct any assumption. */
  valueToman?: number;
  lifeKm?: number;
  servicePerKm?: number;
  tollPerKm?: number;
  parkingPerDay?: number;
};

export type CarCostLine = {
  id: "fuel" | "depreciation" | "service" | "tolls" | "parking";
  label: string;
  amount: number;
  /** Plain-language formula, shown next to the number. */
  formula: string;
  /** estimate = our arithmetic on the traveller's assumptions. */
  source: "estimate" | "measured";
};

export type CarTripCost = {
  intercityKm: number;
  cityKm: number;
  totalKm: number;
  litres: number;
  lines: CarCostLine[];
  total: number;
  perPassenger: number;
  perKm: number;
  /** True when there is no measured distance yet, so the total is incomplete. */
  missingDistance: boolean;
};

export const DEFAULT_CITY_KM_PER_DAY = 35;
export const DEFAULT_TOLL_PER_KM = 180;
export const DEFAULT_PARKING_PER_DAY = 100_000;

const round = (value: number) => Math.round(value);
const fa = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 });
const faInt = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 });

export function computeCarTrip(input: CarTripInput): CarTripCost {
  const lifeKm = Math.max(50_000, input.lifeKm ?? input.car.lifeKm);
  const valueToman = Math.max(0, input.valueToman ?? input.car.valueToman);
  const servicePerKm = Math.max(0, input.servicePerKm ?? input.car.servicePerKm);
  const tollPerKm = Math.max(0, input.tollPerKm ?? DEFAULT_TOLL_PER_KM);
  const parkingPerDay = Math.max(0, input.parkingPerDay ?? DEFAULT_PARKING_PER_DAY);
  const passengers = Math.max(1, Math.round(input.passengers) || 1);
  const days = Math.max(1, Math.round(input.days) || 1);

  const missingDistance = !(input.roadDistanceKm > 0);
  const intercityKm = missingDistance ? 0 : input.roadDistanceKm * (input.roundTrip ? 2 : 1);
  const cityKm = Math.max(0, input.cityKmPerDay) * days;
  const totalKm = intercityKm + cityKm;
  const litres = (totalKm / 100) * input.car.consumption;

  const fuel = litres * input.fuelPricePerLiter;
  const depreciation = totalKm * (valueToman / lifeKm);
  const service = totalKm * servicePerKm;
  const tolls = intercityKm * tollPerKm;
  const parking = parkingPerDay * days;

  const lines: CarCostLine[] = [
    {
      id: "fuel",
      label: "بنزین",
      amount: round(fuel),
      source: "estimate",
      formula: `${fa.format(totalKm)} کیلومتر ÷ ۱۰۰ × ${fa.format(input.car.consumption)} لیتر × ${faInt.format(input.fuelPricePerLiter)} تومان = ${fa.format(litres)} لیتر`,
    },
    {
      id: "depreciation",
      label: "استهلاک خودرو",
      amount: round(depreciation),
      source: "estimate",
      formula: `ارزش ${faInt.format(valueToman)} تومان ÷ عمر ${faInt.format(lifeKm)} کیلومتر × ${fa.format(totalKm)} کیلومتر`,
    },
    {
      id: "service",
      label: "سرویس و نگهداری",
      amount: round(service),
      source: "estimate",
      formula: `لاستیک، روغن و سرویس: ${faInt.format(servicePerKm)} تومان هر کیلومتر × ${fa.format(totalKm)} کیلومتر`,
    },
    {
      id: "tolls",
      label: "عوارض آزادراهی",
      amount: round(tolls),
      source: "estimate",
      formula: `${fa.format(intercityKm)} کیلومتر بین‌شهری × ${faInt.format(tollPerKm)} تومان`,
    },
    {
      id: "parking",
      label: "پارکینگ",
      amount: round(parking),
      source: "estimate",
      formula: `${faInt.format(days)} روز × ${faInt.format(parkingPerDay)} تومان`,
    },
  ];

  const total = lines.reduce((sum, line) => sum + line.amount, 0);

  return {
    intercityKm: round(intercityKm * 10) / 10,
    cityKm,
    totalKm: round(totalKm * 10) / 10,
    litres: round(litres * 10) / 10,
    lines,
    total,
    perPassenger: round(total / passengers),
    perKm: totalKm > 0 ? round(total / totalKm) : 0,
    missingDistance,
  };
}

/** How the trip splits between the open road and the city, for the UI bar. */
export function tripSplit(cost: CarTripCost): { intercity: number; city: number } {
  const total = cost.intercityKm + cost.cityKm;
  if (total <= 0) return { intercity: 0, city: 0 };
  return {
    intercity: Math.round((cost.intercityKm / total) * 100),
    city: Math.round((cost.cityKm / total) * 100),
  };
}
