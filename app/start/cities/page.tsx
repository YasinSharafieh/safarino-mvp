"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, Compass, LoaderCircle, MapPin, Users } from "lucide-react";
import CityCombobox from "@/components/CityCombobox";
import JalaliRangeCalendar from "@/components/JalaliRangeCalendar";
import PassengerSelector from "@/components/PassengerSelector";
import { useTravel } from "../../context/TravelContext";
import { orderedTravelCities } from "@/lib/start-flow";
import { formatJalaliDate } from "@/lib/jalali";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * The «I already know where I am going» door.
 *
 * Origin and destination are chosen from the Iranian city directory the booking
 * providers themselves use (the same list every later step needs), so a trip
 * that starts here can actually be searched, priced and planned.
 */
export default function StartCitiesPage() {
  const router = useRouter();
  const { travelData, setTravelData, isHydrated } = useTravel();
  const cities = useMemo(() => orderedTravelCities(), []);

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [travelers, setTravelers] = useState(2);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [query, setQuery] = useState("");
  const [distance, setDistance] = useState<{ km: number; minutes: number } | null>(null);
  const [distanceNote, setDistanceNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isHydrated) return;
    setOrigin(travelData.origin || "");
    setDestination(travelData.destination || "");
    setTravelers(Math.max(1, Number(travelData.travelers) || 2));
    setChildren(Math.max(0, Number(travelData.children) || 0));
    setInfants(Math.max(0, Number(travelData.infants) || 0));
    if (travelData.departureDate) {
      setDepartureDate(travelData.departureDate);
      setReturnDate(travelData.returnDate || "");
    }
    // Only once, when the saved trip is read from the device.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated]);

  useEffect(() => {
    if (departureDate) return;
    const next = addDays(todayIso(), 7);
    setDepartureDate(next);
    setReturnDate(addDays(next, 2));
  }, [departureDate]);

  // The real road distance, so the traveller sees the trip before choosing a
  // vehicle. It is read from the same routing service the transport step uses.
  useEffect(() => {
    if (!origin || !destination || origin === destination) {
      setDistance(null);
      setDistanceNote("");
      return;
    }
    let cancelled = false;
    setDistanceNote("در حال اندازه‌گیری مسیر جاده‌ای…");
    fetch("/api/route/distance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin, destination }),
    })
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return;
        if (payload?.success && Number.isFinite(Number(payload.distanceKm))) {
          setDistance({ km: Number(payload.distanceKm), minutes: Number(payload.durationMinutes) || 0 });
          setDistanceNote("");
        } else {
          setDistance(null);
          setDistanceNote("مسیر جاده‌ای برای این دو شهر پیدا نشد؛ در مرحلهٔ بعد دوباره تلاش می‌شود.");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setDistance(null);
        setDistanceNote("اندازه‌گیری مسیر ممکن نشد؛ در مرحلهٔ بعد دوباره تلاش می‌شود.");
      });
    return () => {
      cancelled = true;
    };
  }, [origin, destination]);

  const nights = departureDate && returnDate && returnDate > departureDate
    ? Math.round((Date.parse(`${returnDate}T00:00:00Z`) - Date.parse(`${departureDate}T00:00:00Z`)) / 86_400_000)
    : 0;

  const quickPicks = useMemo(() => {
    const term = query.replace(/[يى]/g, "ی").replace(/ك/g, "ک").trim();
    const pool = cities.filter((city) => city.name !== origin && city.name !== destination);
    if (!term) return pool.slice(0, 8);
    return pool.filter((city) => city.name.replace(/[يى]/g, "ی").includes(term)).slice(0, 8);
  }, [cities, destination, origin, query]);

  const continueToTransport = () => {
    if (!origin || !destination) {
      setError("مبدأ و مقصد را از فهرست شهرهای ایران انتخاب کنید.");
      return;
    }
    if (origin === destination) {
      setError("مبدأ و مقصد نمی‌توانند یکی باشند.");
      return;
    }
    if (!departureDate || !returnDate || nights < 1) {
      setError("تاریخ رفت و برگشت را انتخاب کنید؛ حداقل یک شب.");
      return;
    }
    setError("");
    setTravelData((current) => ({
      ...current,
      origin,
      destination,
      departureDate,
      returnDate,
      days: Math.max(1, nights),
      travelers,
      children,
      infants,
    }));
    router.push("/transport");
  };

  if (!isHydrated) {
    return (
      <main dir="rtl" className="grid min-h-screen place-items-center bg-[#071521] text-cyan-100">
        <span className="flex items-center gap-2 text-sm">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          در حال آماده‌سازی…
        </span>
      </main>
    );
  }

  return (
    <main dir="rtl" className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#12364a_0%,#071521_60%)]" />
        <div className="absolute inset-0 grid-lines opacity-60" />
        <div className="aurora">
          <span className="-top-24 right-[5%] h-96 w-96 animate-float bg-teal-500/25" />
          <span className="left-[2%] top-[32rem] h-80 w-80 animate-float bg-sky-500/20 [animation-delay:1.5s]" />
        </div>
      </div>

      <header className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <Link href="/start" className="flex items-center gap-2.5">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-teal-600 text-slate-950 shadow-glow">
            <Compass className="h-5 w-5" />
          </span>
          <span>
            <b className="block text-sm font-black text-white">سفرینو</b>
            <span className="block text-[10px] tracking-[0.3em] text-cyan-200/70">SAFARINO</span>
          </span>
        </Link>
        <Link href="/start" className="btn-ghost !px-3 !py-2 text-[11px]">
          <ArrowRight className="h-3.5 w-3.5" />
          شروع
        </Link>
      </header>

      <section className="mx-auto mt-6 max-w-3xl">
        <div className="glass p-4 sm:p-6">
          <h1 className="text-xl font-black text-white sm:text-2xl">مبدأ و مقصد سفر</h1>
          <p className="mt-2 text-[11px] leading-6 text-slate-400">
            هر شهر ایران در این فهرست هست. بر اساس همین شهرها، بلیت، مسیر و اقامتگاه جست‌وجو می‌شود.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <CityCombobox
              label="مبدأ"
              value={origin}
              cities={cities}
              placeholder="شهر مبدأ را انتخاب کنید"
              onChange={(city) => setOrigin(city.name)}
            />
            <CityCombobox
              label="مقصد"
              value={destination}
              cities={cities.filter((city) => city.name !== origin)}
              placeholder="شهر مقصد را انتخاب کنید"
              onChange={(city) => setDestination(city.name)}
            />
          </div>

          <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/30 p-3">
            <p className="flex items-center gap-1.5 text-[10.5px] font-bold text-slate-300">
              <MapPin className="h-3.5 w-3.5 text-cyan-300" />
              یا از شهرهای پرطرفدار انتخاب کن
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="جست‌وجوی سریع شهر مقصد"
                placeholder="جست‌وجوی شهر…"
                className="min-w-[130px] flex-1 rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1.5 text-[10px] text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/50"
              />
              {quickPicks.map((city) => (
                <button
                  key={city.code + city.name}
                  type="button"
                  onClick={() => setDestination(city.name)}
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-bold transition ${
                    destination === city.name
                      ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-100"
                      : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                  }`}
                >
                  {city.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr]">
            <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
              <p className="flex items-center gap-1.5 text-[10.5px] font-bold text-slate-300">
                <CalendarDays className="h-3.5 w-3.5 text-cyan-300" />
                تاریخ رفت و برگشت
              </p>
              <JalaliRangeCalendar
                departureDate={departureDate}
                returnDate={returnDate}
                roundTrip
                onRoundTripChange={() => {}}
                onChange={(field, isoDate) => {
                  if (field === "departureDate") {
                    setDepartureDate(isoDate);
                    if (!returnDate || returnDate <= isoDate) setReturnDate(addDays(isoDate, 2));
                  } else {
                    setReturnDate(isoDate);
                  }
                }}
              />
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
              <PassengerSelector
                adults={travelers}
                children={children}
                infants={infants}
                onChange={(field, value) => {
                  if (field === "travelers") setTravelers(Math.min(9, Math.max(1, value)));
                  if (field === "children") setChildren(Math.max(0, value));
                  if (field === "infants") setInfants(Math.max(0, Math.min(travelers, value)));
                }}
              />
              <p className="mt-2 flex items-center gap-1.5 text-[9.5px] leading-5 text-slate-500">
                <Users className="h-3 w-3 text-cyan-300" />
                {travelers + children + infants} نفر · {nights > 0 ? `${new Intl.NumberFormat("fa-IR").format(nights)} شب` : "تاریخ را انتخاب کنید"}
              </p>
            </div>
          </div>

          {origin && destination && nights > 0 ? (
            <div className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] p-2.5 text-[10px] leading-6 text-cyan-100">
              سفر شما: <b>{origin}</b> → <b>{destination}</b> · {formatJalaliDate(departureDate)} تا {formatJalaliDate(returnDate)} ·{" "}
              {new Intl.NumberFormat("fa-IR").format(nights)} شب · {new Intl.NumberFormat("fa-IR").format(travelers + children + infants)} نفر
              {distance ? (
                <span className="mt-1 block text-cyan-200/90">
                  مسیر جاده‌ای: {new Intl.NumberFormat("fa-IR").format(distance.km)} کیلومتر
                  {distance.minutes ? ` · حدود ${new Intl.NumberFormat("fa-IR").format(Math.round(distance.minutes / 60))} ساعت رانندگی` : ""}
                </span>
              ) : distanceNote ? (
                <span className="mt-1 block text-slate-400">{distanceNote}</span>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p className="mt-3 rounded-xl border border-rose-400/25 bg-rose-400/10 p-2.5 text-[10px] leading-6 text-rose-100">{error}</p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[9px] leading-5 text-slate-500">
              مرحلهٔ بعد: انتخاب وسیلهٔ سفر (ماشین شخصی با هزینهٔ کامل، یا بلیت قطار/هواپیما/اتوبوس با قیمت واقعی).
            </p>
            <button
              type="button"
              onClick={continueToTransport}
              className="btn-primary !px-4 !py-2.5 text-[11px]"
            >
              ادامه به وسیلهٔ سفر
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
