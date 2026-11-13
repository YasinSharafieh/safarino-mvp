"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CarFront,
  Check,
  Fuel,
  Gauge,
  Info,
  MapPin,
  ParkingSquare,
  RotateCcw,
  Route,
  SlidersHorizontal,
  Users,
  Wrench,
} from "lucide-react";
import CarCombobox from "@/components/CarCombobox";
import { CARS, DEFAULT_CAR_ID, FUEL_OPTIONS, findCar, type CarModel, type FuelOptionId } from "@/lib/car-catalog";
import {
  DEFAULT_CITY_KM_PER_DAY,
  DEFAULT_PARKING_PER_DAY,
  DEFAULT_TOLL_PER_KM,
  computeCarTrip,
  tripSplit,
} from "@/lib/car-cost";

type Props = {
  roadDistanceKm: number | null;
  distanceLoading: boolean;
  distanceError: string;
  origin: string;
  destination: string;
  passengers: number;
  days: number;
  roundTrip: boolean;
  initialCarId?: string;
  selected: boolean;
  onSelect: (payload: { total: number; perPassenger: number; details: Record<string, unknown> }) => void;
};

const fa = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 });
const faInt = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 });
const toman = (value: number) => `${faInt.format(Math.round(value))} تومان`;

const LINE_ICONS = { fuel: Fuel, depreciation: Gauge, service: Wrench, tolls: Route, parking: ParkingSquare };

/**
 * «با ماشین خودم می‌روم» — the whole car bill, line by line.
 *
 * The car is picked from a searchable catalogue (its real consumption and value
 * come from there), the distance is the measured road distance, and every other
 * assumption is visible and editable. Nothing on this panel is a provider quote,
 * so every row is labelled as a calculation on the traveller's own numbers.
 */
export default function CarPlanner({
  roadDistanceKm,
  distanceLoading,
  distanceError,
  origin,
  destination,
  passengers,
  days,
  roundTrip,
  initialCarId,
  selected,
  onSelect,
}: Props) {
  const [carId, setCarId] = useState(initialCarId && findCar(initialCarId) ? initialCarId : DEFAULT_CAR_ID);
  const [fuelOption, setFuelOption] = useState<FuelOptionId>("free");
  const [fuelPrice, setFuelPrice] = useState<number>(3_000);
  const [cityKmPerDay, setCityKmPerDay] = useState(DEFAULT_CITY_KM_PER_DAY);
  const [tollPerKm, setTollPerKm] = useState(DEFAULT_TOLL_PER_KM);
  const [parkingPerDay, setParkingPerDay] = useState(DEFAULT_PARKING_PER_DAY);
  const [showAssumptions, setShowAssumptions] = useState(false);

  // Overrides that start from the car's own figures and can be corrected.
  const [valueToman, setValueToman] = useState<number | null>(null);
  const [lifeKm, setLifeKm] = useState<number | null>(null);
  const [servicePerKm, setServicePerKm] = useState<number | null>(null);
  const [consumption, setConsumption] = useState<number | null>(null);

  const car: CarModel = findCar(carId) || CARS[0];

  useEffect(() => {
    setValueToman(null);
    setLifeKm(null);
    setServicePerKm(null);
    setConsumption(null);
  }, [carId]);

  const cost = useMemo(
    () =>
      computeCarTrip({
        car: consumption === null ? car : { ...car, consumption },
        roadDistanceKm: roadDistanceKm || 0,
        roundTrip,
        days,
        cityKmPerDay,
        passengers,
        fuelPricePerLiter: fuelPrice,
        valueToman: valueToman ?? car.valueToman,
        lifeKm: lifeKm ?? car.lifeKm,
        servicePerKm: servicePerKm ?? car.servicePerKm,
        tollPerKm,
        parkingPerDay,
      }),
    [car, cityKmPerDay, consumption, days, fuelPrice, lifeKm, parkingPerDay, passengers, roadDistanceKm, roundTrip, servicePerKm, tollPerKm, valueToman],
  );

  const split = tripSplit(cost);

  const reset = () => {
    setFuelOption("free");
    setFuelPrice(3_000);
    setCityKmPerDay(DEFAULT_CITY_KM_PER_DAY);
    setTollPerKm(DEFAULT_TOLL_PER_KM);
    setParkingPerDay(DEFAULT_PARKING_PER_DAY);
    setValueToman(null);
    setLifeKm(null);
    setServicePerKm(null);
    setConsumption(null);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="glass overflow-hidden p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="chip border-cyan-400/25 bg-cyan-400/10 !text-cyan-200">
            <CarFront className="h-3.5 w-3.5" />
            سفر با خودروی شخصی
          </span>
          <h2 className="mt-3 text-xl font-black text-white sm:text-2xl">هزینهٔ کامل ماشینت را ببین</h2>
          <p className="mt-2 max-w-xl text-[11px] leading-6 text-slate-400">
            مدل ماشینت را از فهرست انتخاب کن؛ بنزین، استهلاک، سرویس، عوارض و پارکینگ با مسافت واقعی {origin && destination ? `${origin} تا ${destination}` : "مسیر"} حساب می‌شود. هر عدد قابل ویرایش است.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <MapPin className="h-4 w-4 text-cyan-300" />
          <span className="text-[11px] text-slate-300">
            {distanceLoading
              ? "در حال اندازه‌گیری مسیر…"
              : roadDistanceKm
                ? `${fa.format(roadDistanceKm)} کیلومتر جاده‌ای`
                : "مسیر اندازه‌گیری نشد"}
          </span>
        </div>
      </div>

      {distanceError ? (
        <p className="mt-3 rounded-xl border border-rose-400/25 bg-rose-400/10 p-2.5 text-[10.5px] leading-6 text-rose-100">{distanceError}</p>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="relative z-30">
            <CarCombobox value={carId} onChange={(next) => setCarId(next.id)} />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[10.5px] font-bold text-slate-300">
                <Fuel className="h-3.5 w-3.5 text-cyan-300" />
                بنزین با چه قیمتی؟
              </span>
              <span className="text-[9px] text-slate-500">قابل ویرایش</span>
            </div>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
              {FUEL_OPTIONS.map((option) => {
                const active = fuelOption === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setFuelOption(option.id);
                      if (option.id !== "custom") setFuelPrice(option.pricePerLiter);
                    }}
                    aria-pressed={active}
                    className={`rounded-xl border px-2.5 py-2 text-right transition ${
                      active ? "border-cyan-300/50 bg-cyan-300/12 text-cyan-100" : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
                    }`}
                  >
                    <b className="block text-[10.5px] font-bold">{option.label}</b>
                    <span className="mt-0.5 block text-[9px] text-slate-400">{faInt.format(option.pricePerLiter)} تومان · {option.hint}</span>
                  </button>
                );
              })}
            </div>
            <label className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/40 px-2.5 py-1.5">
              <span className="text-[9.5px] text-slate-400">هر لیتر</span>
              <input
                type="number"
                min={0}
                step={100}
                value={fuelPrice}
                onChange={(event) => {
                  setFuelPrice(Math.max(0, Number(event.target.value) || 0));
                  setFuelOption("custom");
                }}
                className="w-24 bg-transparent text-left text-[11px] font-bold text-white outline-none"
                dir="ltr"
                aria-label="قیمت هر لیتر بنزین"
              />
              <span className="text-[9.5px] text-slate-500">تومان</span>
            </label>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-center">
              <span className="block text-[9px] text-slate-500">کیلومتر شهر، هر روز</span>
              <input
                type="number"
                min={0}
                step={5}
                value={cityKmPerDay}
                onChange={(event) => setCityKmPerDay(Math.max(0, Number(event.target.value) || 0))}
                className="mt-1 w-full bg-transparent text-center text-[11px] font-bold text-white outline-none"
                dir="ltr"
                aria-label="کیلومتر رانندگی داخل شهر هر روز"
              />
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-center">
              <span className="block text-[9px] text-slate-500">مدت اقامت</span>
              <b className="mt-1 block text-[11px] font-bold text-white">{faInt.format(days)} روز</b>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-center">
              <span className="block text-[9px] text-slate-500">سرنشین</span>
              <b className="mt-1 block text-[11px] font-bold text-white">{faInt.format(passengers)} نفر</b>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAssumptions((value) => !value)}
            aria-expanded={showAssumptions}
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[10.5px] font-bold text-slate-300 transition hover:bg-white/[0.06]"
          >
            <span className="flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5 text-cyan-300" />
              فرض‌های من (مصرف، ارزش خودرو، عمر، سرویس، عوارض، پارکینگ)
            </span>
            <span className={`transition ${showAssumptions ? "rotate-180" : ""}`}>▾</span>
          </button>

          {showAssumptions ? (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="grid gap-2 overflow-hidden sm:grid-cols-2">
              {[
                { label: "مصرف (لیتر در ۱۰۰ کیلومتر)", value: consumption ?? car.consumption, set: setConsumption, step: 0.1, min: 1, def: car.consumption },
                { label: "ارزش خودرو (تومان)", value: valueToman ?? car.valueToman, set: setValueToman, step: 10_000_000, min: 0, def: car.valueToman },
                { label: "عمر مفید (کیلومتر)", value: lifeKm ?? car.lifeKm, set: setLifeKm, step: 10_000, min: 50_000, def: car.lifeKm },
                { label: "سرویس هر کیلومتر (تومان)", value: servicePerKm ?? car.servicePerKm, set: setServicePerKm, step: 50, min: 0, def: car.servicePerKm },
                { label: "عوارض هر کیلومتر (تومان)", value: tollPerKm, set: setTollPerKm, step: 10, min: 0, def: DEFAULT_TOLL_PER_KM },
                { label: "پارکینگ هر روز (تومان)", value: parkingPerDay, set: setParkingPerDay, step: 10_000, min: 0, def: DEFAULT_PARKING_PER_DAY },
              ].map((field) => (
                <label key={field.label} className="rounded-xl border border-white/10 bg-slate-950/40 px-2.5 py-2">
                  <span className="mb-1 flex items-center justify-between gap-1 text-[9px] text-slate-500">
                    {field.label}
                    {Number(field.value) !== field.def ? <span className="text-amber-300">تغییرکرده</span> : null}
                  </span>
                  <input
                    type="number"
                    min={field.min}
                    step={field.step}
                    value={field.value}
                    onChange={(event) => field.set(Math.max(field.min, Number(event.target.value) || 0))}
                    className="w-full bg-transparent text-left text-[11px] font-bold text-white outline-none"
                    dir="ltr"
                  />
                </label>
              ))}
              <button type="button" onClick={reset} className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold text-slate-300 hover:bg-white/10 sm:col-span-2">
                <RotateCcw className="h-3 w-3" />
                برگشت به مقادیر پیش‌فرض
              </button>
            </motion.div>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] text-slate-300">جمع هزینهٔ سفر</span>
              <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[8.5px] font-bold text-amber-200">تخمین با فرض شما</span>
            </div>
            <b className="mt-1 block text-2xl font-black text-cyan-200">{toman(cost.total)}</b>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-slate-300">
              <span>سهم هر سرنشین: <b className="text-white">{toman(cost.perPassenger)}</b></span>
              <span>هر کیلومتر: <b className="text-white">{toman(cost.perKm)}</b></span>
            </div>
            {cost.missingDistance ? (
              <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-400/20 bg-amber-400/10 p-2 text-[9.5px] leading-5 text-amber-100">
                <Info className="mt-px h-3 w-3 shrink-0" />
                مسیر جاده‌ای هنوز اندازه‌گیری نشده؛ این جمع فقط هزینهٔ رانندگی داخل شهر و پارکینگ است.
              </p>
            ) : (
              <div className="mt-3">
                <div className="flex h-1.5 overflow-hidden rounded-full bg-white/10">
                  <span className="h-full bg-cyan-400" style={{ width: `${split.intercity}%` }} />
                  <span className="h-full bg-teal-500" style={{ width: `${split.city}%` }} />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[9px] text-slate-400">
                  <span>جاده: {fa.format(cost.intercityKm)} کیلومتر ({faInt.format(split.intercity)}٪)</span>
                  <span>شهر: {fa.format(cost.cityKm)} کیلومتر ({faInt.format(split.city)}٪)</span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            {cost.lines.map((line) => {
              const Icon = LINE_ICONS[line.id];
              return (
                <div key={line.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-200">
                      <Icon className="h-3.5 w-3.5 text-cyan-300" />
                      {line.label}
                    </span>
                    <b className="text-[11.5px] text-white">{toman(line.amount)}</b>
                  </div>
                  <span className="mt-0.5 block text-[9px] leading-5 text-slate-500">{line.formula}</span>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[9px] text-slate-500">
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5">
              <Users className="h-2.5 w-2.5" /> {faInt.format(passengers)} نفر
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5">
              <Route className="h-2.5 w-2.5" /> {fa.format(cost.totalKm)} کیلومتر کل
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5">
              <Fuel className="h-2.5 w-2.5" /> {fa.format(cost.litres)} لیتر بنزین
            </span>
          </div>

          <button
            type="button"
            onClick={() =>
              onSelect({
                total: cost.total,
                perPassenger: cost.perPassenger,
                details: {
                  carId: car.id,
                  carName: car.name,
                  consumption: consumption ?? car.consumption,
                  litres: cost.litres,
                  totalKm: cost.totalKm,
                  intercityKm: cost.intercityKm,
                  cityKm: cost.cityKm,
                  fuelPricePerLiter: fuelPrice,
                  fuelOption,
                  roundTrip,
                  breakdown: cost.lines.map((line) => ({ id: line.id, label: line.label, amount: line.amount, source: line.source })),
                  assumptions: {
                    valueToman: valueToman ?? car.valueToman,
                    lifeKm: lifeKm ?? car.lifeKm,
                    servicePerKm: servicePerKm ?? car.servicePerKm,
                    tollPerKm,
                    parkingPerDay,
                    cityKmPerDay,
                  },
                  source: "estimate",
                },
              })
            }
            aria-pressed={selected}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-[12px] font-extrabold transition ${
              selected ? "bg-cyan-300 text-slate-950" : "border border-white/10 bg-white/5 text-white hover:border-cyan-300/40 hover:bg-white/10"
            }`}
          >
            {selected ? <Check className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
            {selected ? "همین محاسبه انتخاب شد" : "این هزینه را برای سفر انتخاب کن"}
          </button>
          <p className="text-center text-[9px] leading-5 text-slate-500">
            مسافت از سرویس مسیریابی می‌آید؛ بقیهٔ اعداد با فرض‌های شما حساب شده‌اند و با قیمت روز خودتان قابل ویرایش‌اند.
          </p>
        </div>
      </div>
    </motion.section>
  );
}
