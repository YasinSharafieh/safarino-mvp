"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  BedDouble,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  Images,
  LoaderCircle,
  MapPin,
  MapPinned,
  Sparkles,
  Star,
  WalletCards,
  X,
} from "lucide-react";
import { useTravel } from "../../context/TravelContext";
import ProviderBadge from "@/components/ProviderBadge";
import AccommodationImage from "@/components/AccommodationImage";
import { categorizeStay, PROVIDER_LABELS } from "@/lib/accommodation-types";
import type { AccommodationGroup, AccommodationOffer, AccommodationProvider, ProviderSearchStatus } from "@/lib/accommodation-types";
import {
  ACCOMMODATION_RESULTS_KEY,
  ACCOMMODATION_SELECTION_KEY,
  buildAccommodationSelection,
  saveAccommodationSelection,
} from "@/lib/accommodation-selection";

const numberFormatter = new Intl.NumberFormat("fa-IR");
const decimalFormatter = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 });
const formatNumber = (value: number) => numberFormatter.format(Math.round(value));
const formatToman = (value: number) => `${formatNumber(value)} تومان`;
const formatScore = (value: number | null) => (value === null ? "—" : decimalFormatter.format(value));

type Snapshot = {
  kind: "hotel" | "stay";
  city: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  infants: number;
  childAges: number[];
  infantAges: number[];
  nights: number;
  fetchedAt: string;
  providerStatuses: ProviderSearchStatus[];
  groups: AccommodationGroup[];
};

function readSnapshot(): Snapshot | null {
  try {
    const raw = window.sessionStorage.getItem(ACCOMMODATION_RESULTS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Snapshot;
    return Array.isArray(parsed?.groups) && parsed.groups.length ? parsed : null;
  } catch {
    return null;
  }
}

function allPhotos(offer: AccommodationOffer): string[] {
  const list = [offer.imageUrl, ...(offer.images || [])].filter((value): value is string => Boolean(value));
  return Array.from(new Set(list));
}

const AMENITY_RULES: { label: string; pattern: RegExp }[] = [
  { label: "اینترنت بی‌سیم (WiFi)", pattern: /wifi|اینترنت|بی‌سیم|بيسيم/i },
  { label: "صبحانه", pattern: /صبحانه|breakfast/i },
  { label: "پارکینگ", pattern: /پارکینگ|parking/i },
  { label: "استخر", pattern: /استخر|pool/i },
  { label: "رستوران", pattern: /رستوران|رستورانت|restaurant/i },
  { label: "آسانسور", pattern: /آسانسور|اسانسور|elevator/i },
  { label: "سرویس اتاق", pattern: /سرویس اتاق|room service/i },
  { label: "تهویه مطبوع", pattern: /تهویه|کولر|اسپلیت|air ?condition/i },
  { label: "حیوان خانگی مجاز", pattern: /حیوان|pet/i },
  { label: "آشپزخانه", pattern: /آشپزخانه|آشپزخونه|kitchen/i },
];

export default function AccommodationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const query = useSearchParams();
  const { travelData, setTravelData, isHydrated } = useTravel();

  const rawId = decodeURIComponent(String(params?.id || ""));
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeOfferId, setActiveOfferId] = useState(rawId);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [saved, setSaved] = useState(false);
  const [statuses, setStatuses] = useState<ProviderSearchStatus[]>([]);
  const fetchedOnce = useRef(false);

  const loadFromSnapshot = useCallback(() => {
    const cached = readSnapshot();
    setSnapshot(cached);
    setStatuses(cached?.providerStatuses || []);
    return cached;
  }, []);

  /** Refetches the live search when the page is opened directly (no snapshot in this tab). */
  const refetch = useCallback(async () => {
    const kind = query.get("kind") === "stay" ? "stay" : "hotel";
    const city = query.get("city") || "";
    const checkIn = query.get("checkIn") || "";
    const checkOut = query.get("checkOut") || "";
    if (!city || !checkIn || !checkOut) {
      setError("برای بازکردن این اقامتگاه، یک‌بار جستجوی اقامت را اجرا کنید تا نتایج زنده در دسترس باشند.");
      return;
    }
    try {
      const response = await fetch("/api/providers/accommodation/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          city,
          checkIn,
          checkOut,
          adults: Math.max(1, Number(query.get("adults")) || 2),
          childAges: [],
          infantAges: [],
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "جستجو انجام نشد");
      const next: Snapshot = {
        kind,
        city: data.city || city,
        checkIn,
        checkOut,
        adults: Math.max(1, Number(query.get("adults")) || 2),
        children: 0,
        infants: 0,
        childAges: [],
        infantAges: [],
        nights: Math.max(1, Math.round((Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86_400_000)),
        fetchedAt: data.fetchedAt || new Date().toISOString(),
        providerStatuses: data.providerStatuses || [],
        groups: data.groups || [],
      };
      try { window.sessionStorage.setItem(ACCOMMODATION_RESULTS_KEY, JSON.stringify(next)); } catch { /* optional cache */ }
      setSnapshot(next);
      setStatuses(next.providerStatuses);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "دریافت اطلاعات این اقامتگاه ممکن نشد.");
    }
  }, [query]);

  useEffect(() => {
    if (fetchedOnce.current) return;
    fetchedOnce.current = true;
    const cached = loadFromSnapshot();
    const hasProperty = cached?.groups.some((group) => group.offers.some((offer) => offer.id === rawId));
    if (!hasProperty) {
      refetch().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [loadFromSnapshot, rawId, refetch]);

  const group = useMemo(() => {
    if (!snapshot) return null;
    return snapshot.groups.find((item) => item.offers.some((offer) => offer.id === rawId)) || null;
  }, [snapshot, rawId]);

  const offer = useMemo(() => {
    if (!group) return null;
    return group.offers.find((item) => item.id === activeOfferId) || group.offers[0];
  }, [activeOfferId, group]);

  const photos = useMemo(() => (offer ? allPhotos(offer) : []), [offer]);
  useEffect(() => { setPhotoIndex(0); }, [offer?.id]);
  useEffect(() => { setSaved(false); }, [offer?.id]);

  const contexts = useMemo(() => {
    if (!snapshot) return null;
    return {
      city: snapshot.city,
      checkIn: snapshot.checkIn,
      checkOut: snapshot.checkOut,
      nights: snapshot.nights,
      adults: snapshot.adults,
      children: snapshot.children,
      infants: snapshot.infants,
      childAges: snapshot.childAges || [],
      infantAges: snapshot.infantAges || [],
      fetchedAt: snapshot.fetchedAt,
    };
  }, [snapshot]);

  const selectedId = (() => {
    const selected = travelData.accommodation;
    return selected && selected.status === "selected" && typeof selected.id === "string" ? selected.id : "";
  })();

  function choose() {
    if (!offer || !contexts) return;
    const selection = buildAccommodationSelection(offer, contexts);
    saveAccommodationSelection(selection);
    setTravelData((current) => ({ ...current, accommodation: selection, days: contexts.nights }));
    setSaved(true);
    router.push("/plan");
  }

  function backToResults() {
    router.push("/accommodation");
  }

  function movePhoto(step: number) {
    if (!photos.length) return;
    setPhotoIndex((current) => (current + step + photos.length) % photos.length);
  }

  const providerStatusFor = (provider: AccommodationProvider) => statuses.find((status) => status.provider === provider);
  const checklist = offer
    ? AMENITY_RULES.filter((rule) => rule.pattern.test([...offer.amenities, ...offer.details].join(" "))).map((rule) => rule.label)
    : [];
  const rawFacts = offer ? [...offer.details, ...offer.amenities].filter((item) => item && !checklist.some((label) => item.includes(label))) : [];
  const mapBox = offer && offer.latitude !== null && offer.longitude !== null && offer.latitude !== 0 && offer.longitude !== 0
    ? {
        lat: offer.latitude,
        lng: offer.longitude,
        src: `https://www.openstreetmap.org/export/embed.html?bbox=${(offer.longitude - 0.008).toFixed(5)}%2C${(offer.latitude - 0.005).toFixed(5)}%2C${(offer.longitude + 0.008).toFixed(5)}%2C${(offer.latitude + 0.005).toFixed(5)}&layer=mapnik&marker=${offer.latitude.toFixed(5)}%2C${offer.longitude.toFixed(5)}`,
        link: `https://www.openstreetmap.org/?mlat=${offer.latitude.toFixed(5)}&mlon=${offer.longitude.toFixed(5)}#map=17/${offer.latitude.toFixed(5)}/${offer.longitude.toFixed(5)}`,
      }
    : null;

  return (
    <MotionConfig reducedMotion="user">
      <main dir="rtl" className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#12364a_0%,#071521_60%)]" />
          <div className="absolute inset-0 grid-lines opacity-60" />
          <div className="aurora">
            <span className="-top-24 right-[5%] h-96 w-96 animate-float bg-teal-500/25" />
            <span className="left-[2%] top-[32rem] h-80 w-80 animate-float bg-sky-500/20 [animation-delay:1.5s]" />
          </div>
        </div>

        <header className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link href="/" className="group flex items-center gap-2.5" aria-label="صفحهٔ اصلی سفرینو">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-teal-600 text-slate-950 shadow-glow transition group-hover:scale-105">
              <Sparkles className="h-5 w-5" />
            </span>
            <span className="flex flex-col leading-none">
              <b className="text-lg font-black text-white">سفرینو</b>
              <small className="text-[10px] tracking-widest text-slate-400">SAFARINO</small>
            </span>
          </Link>
          <button type="button" onClick={backToResults} className="btn-ghost !px-4 !py-2.5 text-xs">
            <ArrowRight className="h-4 w-4" />
            بازگشت به نتایج اقامت
          </button>
        </header>

        <div className="mx-auto max-w-6xl pb-16 pt-8">
          {loading ? (
            <div className="glass flex items-center justify-center gap-3 p-16 text-sm text-slate-300">
              <LoaderCircle className="h-5 w-5 animate-spin text-cyan-300" />
              در حال آماده‌کردن جزئیات این اقامتگاه…
            </div>
          ) : !offer || !group ? (
            <div className="glass p-12 text-center">
              <CircleAlert className="mx-auto h-9 w-9 text-rose-300" />
              <h1 className="mt-4 text-lg font-black text-white">این اقامتگاه در نتایج این تب پیدا نشد</h1>
              <p className="mx-auto mt-2 max-w-lg text-xs leading-7 text-slate-400">
                {error || "نتایج زندهٔ جستجو در همین مرورگر نگه داشته می‌شوند؛ یک‌بار جستجوی اقامت را اجرا کنید و دوباره از روی کارت وارد شوید."}
              </p>
              <button type="button" onClick={backToResults} className="btn-primary mt-6 !py-2.5 text-xs">بازگشت به جستجوی اقامت</button>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
              <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
                {/* Gallery */}
                <section aria-label="گالری تصاویر" className="glass overflow-hidden p-3">
                  <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-night-900">
                    {photos.length ? (
                      <button type="button" onClick={() => setLightbox(true)} aria-label="بزرگ‌کردن تصویر" className="block h-full w-full cursor-zoom-in">
                        <AccommodationImage src={photos[photoIndex]} alt={`${offer.name} — تصویر ${formatNumber(photoIndex + 1)}`} />
                      </button>
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-500">
                        <BedDouble className="h-10 w-10" />
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night-950/80 via-transparent to-transparent" />
                    {photos.length > 1 && (
                      <>
                        <button type="button" onClick={() => movePhoto(-1)} aria-label="تصویر قبلی" className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-night-950/70 text-white backdrop-blur transition hover:bg-night-950">
                          <ChevronRight className="h-5 w-5" />
                        </button>
                        <button type="button" onClick={() => movePhoto(1)} aria-label="تصویر بعدی" className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-night-950/70 text-white backdrop-blur transition hover:bg-night-950">
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                      </>
                    )}
                    <button type="button" onClick={() => photos.length && setLightbox(true)} className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-night-950/75 px-3 py-1.5 text-[10px] font-bold text-white backdrop-blur">
                      <Images className="h-3.5 w-3.5" />
                      {photos.length ? `${formatNumber(photos.length)} عکس واقعی` : "عکسی منتشر نشده"}
                    </button>
                    <span className="absolute bottom-3 right-3 rounded-full bg-night-950/75 px-3 py-1.5 text-[10px] font-bold text-cyan-200 backdrop-blur">
                      {photos.length ? `تصویر ${formatNumber(photoIndex + 1)} از ${formatNumber(photos.length)}` : "بدون تصویر"}
                    </span>
                  </div>

                  {photos.length > 1 && (
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                      {photos.map((photo, index) => (
                        <button
                          key={`${photo}-${index}`}
                          type="button"
                          onClick={() => setPhotoIndex(index)}
                          aria-label={`تصویر ${formatNumber(index + 1)}`}
                          aria-pressed={index === photoIndex}
                          className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-xl border transition ${index === photoIndex ? "border-cyan-300 shadow-glow" : "border-white/10 hover:border-white/30"}`}
                        >
                          <AccommodationImage src={photo} alt={`${offer.name} کوچک ${formatNumber(index + 1)}`} />
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-[10px] leading-5 text-slate-500">
                    همهٔ تصاویر از پاسخ عمومی {PROVIDER_LABELS[offer.provider]} برای همین اقامتگاه گرفته شده‌اند؛ هیچ عکسی ساخته یا جایگزین نشده است.
                  </p>
                </section>

                {/* Summary + booking */}
                <section aria-label="خلاصه و رزرو" className="glass flex flex-col p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <ProviderBadge provider={offer.provider} />
                    <span className="chip">{offer.kind === "stay" ? categorizeStay(offer.typeLabel, offer.name).label || offer.typeLabel : offer.typeLabel}</span>
                    {offer.stars ? <span className="chip !text-amber-200">{formatNumber(offer.stars)} ستاره</span> : null}
                  </div>
                  <h1 className="mt-3 text-2xl font-black leading-9 text-white">{offer.name}</h1>
                  <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-6 text-slate-400">
                    <MapPin className="mt-1 h-3.5 w-3.5 shrink-0 text-cyan-300" />
                    {offer.location}
                  </p>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                      <span className="block text-[9px] text-slate-500">امتیاز مسافران</span>
                      <b className="mt-1 flex items-center justify-center gap-1 text-base font-black text-cyan-200">
                        <Star className="h-3.5 w-3.5 fill-cyan-200" />
                        {formatScore(offer.rating)}
                      </b>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                      <span className="block text-[9px] text-slate-500">تعداد نظر</span>
                      <b className="mt-1 block text-base font-black text-white">{offer.reviewCount ? formatNumber(offer.reviewCount) : "—"}</b>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                      <span className="block text-[9px] text-slate-500">شب‌ها</span>
                      <b className="mt-1 block text-base font-black text-white">{formatNumber(snapshot?.nights || 1)}</b>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06] p-4">
                    <span className="block text-[10px] text-slate-400">قیمت کل {formatNumber(snapshot?.nights || 1)} شب · {PROVIDER_LABELS[offer.provider]}</span>
                    <b className="mt-1 block text-2xl font-black text-cyan-100">{formatToman(offer.priceTotalToman)}</b>
                    <span className="mt-1 block text-[10px] text-slate-400">میانگین هر شب {formatToman(offer.pricePerNightToman)}</span>
                    <p className="mt-2 text-[10px] leading-5 text-slate-500">{offer.priceNote}</p>
                  </div>

                  <div className="mt-4 space-y-2">
                    <button
                      type="button"
                      onClick={choose}
                      disabled={!isHydrated}
                      className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-extrabold transition disabled:opacity-50 ${saved || selectedId === offer.id ? "bg-emerald-400 text-slate-950" : "btn-primary !py-3"}`}
                    >
                      <Check className="h-4 w-4" />
                      {saved || selectedId === offer.id ? "این اقامتگاه در برنامهٔ سفر ذخیره شد" : "انتخاب برای سفرینو"}
                    </button>
                    <a href={offer.bookingUrl} target="_blank" rel="noreferrer noopener" className="btn-ghost w-full !py-3 text-xs">
                      رزرو دقیق در {PROVIDER_LABELS[offer.provider]}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <p className="text-[10px] leading-5 text-slate-500">{offer.bookingNote}</p>
                    {(saved || selectedId === offer.id) && (
                      <Link href="/plan" className="flex items-center justify-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-2.5 text-[11px] font-bold text-emerald-200">
                        مشاهدهٔ برنامهٔ نهایی سفر
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                </section>
              </div>

              {/* Providers of the same property */}
              {group.offers.length > 1 && (
                <section aria-label="مقایسهٔ منابع" className="glass mt-6 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="flex items-center gap-2 text-base font-black text-white">
                      <WalletCards className="h-5 w-5 text-cyan-300" />
                      همین اقامتگاه در {formatNumber(group.offers.length)} منبع
                    </h2>
                    <span className="chip">{group.matchReason === "shared_inventory" ? "موجودی مشترک دو منبع" : "نام و موقعیت یکسان"}</span>
                  </div>
                  <div className="mt-4 space-y-2">
                    {group.offers.map((alternative) => {
                      const isActive = alternative.id === offer.id;
                      const isSelected = selectedId === alternative.id;
                      const status = providerStatusFor(alternative.provider);
                      return (
                        <div key={alternative.id} className={`flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center sm:justify-between ${isActive ? "border-cyan-300/40 bg-cyan-300/[0.07]" : "border-white/10 bg-white/[0.025]"}`}>
                          <div className="flex items-center gap-3">
                            <ProviderBadge provider={alternative.provider} />
                            <div>
                              <b className="block text-xs text-white">{PROVIDER_LABELS[alternative.provider]}</b>
                              <span className="mt-0.5 block text-[10px] text-slate-500">
                                {status ? (status.status === "ok" ? `${formatNumber(status.count)} پیشنهاد از این منبع` : status.message || "در دسترس نیست") : "منبع فعال این جستجو"}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <b className="text-sm font-black text-cyan-200">{formatToman(alternative.priceTotalToman)}</b>
                            <a href={alternative.bookingUrl} target="_blank" rel="noreferrer noopener" className="btn-ghost !px-3 !py-2 text-[10px]">
                              خرید از {PROVIDER_LABELS[alternative.provider]}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveOfferId(alternative.id);
                                if (contexts) {
                                  const selection = buildAccommodationSelection(alternative, contexts);
                                  saveAccommodationSelection(selection);
                                  setTravelData((current) => ({ ...current, accommodation: selection, days: contexts.nights }));
                                  setSaved(true);
                                }
                              }}
                              aria-pressed={isSelected}
                              className={`rounded-xl px-3 py-2 text-[10px] font-bold transition ${isSelected ? "bg-emerald-400 text-slate-950" : "border border-white/15 bg-white/5 text-white hover:bg-white/10"}`}
                            >
                              {isSelected ? "انتخاب‌شده" : "انتخاب همین منبع"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-[10px] leading-5 text-slate-500">
                    هر ردیف لینک رزرو همان منبع را دارد؛ قیمت‌ها از پاسخ زندهٔ همان لحظه آمده‌اند و مبنای مالیات هر منبع جداگانه نوشته شده است.
                  </p>
                </section>
              )}

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                {/* Amenities */}
                <section aria-label="امکانات" className="glass p-5">
                  <h2 className="flex items-center gap-2 text-base font-black text-white">
                    <BadgeCheck className="h-5 w-5 text-cyan-300" />
                    امکانات و ویژگی‌ها
                  </h2>
                  {checklist.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {checklist.map((item) => (
                        <span key={item} className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-bold text-emerald-200">
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-[11px] leading-6 text-slate-500">
                      این منبع برای این اقامتگاه فهرست امکانات منتشر نکرده است؛ برای دیدن جزئیات کامل، صفحهٔ رزرو را باز کنید.
                    </p>
                  )}
                  {rawFacts.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {rawFacts.slice(0, 12).map((fact, index) => (
                        <span key={`${fact}-${index}`} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] leading-4 text-slate-300">{fact}</span>
                      ))}
                    </div>
                  )}
                  <p className="mt-4 rounded-xl bg-white/[0.025] p-2.5 text-[9px] leading-5 text-slate-500">
                    خدمات هتل فقط از فیلدهای منتشرشدهٔ همین منبع خوانده می‌شود؛ اگر امکانی در فهرست نیست، یعنی منبع آن را اعلام نکرده، نه اینکه وجود ندارد.
                  </p>
                </section>

                {/* Location */}
                <section aria-label="موقعیت و نقشه" className="glass p-5">
                  <h2 className="flex items-center gap-2 text-base font-black text-white">
                    <MapPinned className="h-5 w-5 text-cyan-300" />
                    موقعیت روی نقشه
                  </h2>
                  <p className="mt-2 text-[11px] leading-6 text-slate-400">{offer.location}</p>
                  {mapBox ? (
                    <>
                      <div className="mt-3 overflow-hidden rounded-2xl border border-white/10">
                        <iframe
                          title={`نقشهٔ ${offer.name}`}
                          src={mapBox.src}
                          className="h-56 w-full"
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-500">مختصات واقعی: {offer.latitude?.toFixed(5)} , {offer.longitude?.toFixed(5)}</span>
                        <a href={mapBox.link} target="_blank" rel="noreferrer noopener" className="btn-ghost !px-3 !py-2 text-[10px]">
                          باز کردن در نقشهٔ باز
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </>
                  ) : (
                    <p className="mt-3 text-[11px] leading-6 text-slate-500">
                      این منبع برای این اقامتگاه مختصات منتشر نکرده است؛ نشانی بالا از همان پاسخ آمده و نقشه‌ای ساخته نشده تا مکان اشتباه نشان داده نشود.
                    </p>
                  )}
                </section>
              </div>

              {/* Honest review note */}
              <section aria-label="نظرات مسافران" className="glass mt-6 p-5">
                <h2 className="flex items-center gap-2 text-base font-black text-white">
                  <Star className="h-5 w-5 text-amber-300" />
                  امتیاز و نظرات مسافران
                </h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
                  <div className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] px-6 py-4 text-center">
                    <b className="block text-3xl font-black text-amber-200">{formatScore(offer.rating)}</b>
                    <span className="mt-1 block text-[10px] text-slate-400">{offer.reviewCount ? `از ${formatNumber(offer.reviewCount)} نظر` : "بدون نظر ثبت‌شده"}</span>
                  </div>
                  <p className="text-[11px] leading-7 text-slate-400">
                    این امتیاز همان عددی است که {PROVIDER_LABELS[offer.provider]} برای این اقامتگاه منتشر کرده است.
                    متن نظرها در پاسخ عمومی این منبع در دسترس نیست، بنابراین سفرینو هیچ نظر یا نقلی از خودش نمی‌سازد؛
                    برای خواندن نظرها روی «رزرو دقیق در {PROVIDER_LABELS[offer.provider]}» بزنید.
                  </p>
                </div>
              </section>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <button type="button" onClick={backToResults} className="btn-ghost !py-2.5 text-xs">
                  <ArrowRight className="h-4 w-4" />
                  بازگشت به فهرست اقامتگاه‌ها
                </button>
                <Link href="/plan" className="btn-primary !py-2.5 text-xs">
                  برنامهٔ نهایی سفر
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>
          )}
        </div>

        <AnimatePresence>
          {lightbox && photos.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[80] flex items-center justify-center bg-night-950/95 p-4"
              onClick={() => setLightbox(false)}
            >
              <button type="button" onClick={() => setLightbox(false)} aria-label="بستن گالری" className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white">
                <X className="h-5 w-5" />
              </button>
              <div className="relative aspect-[16/10] max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-night-900" onClick={(event) => event.stopPropagation()}>
                <AccommodationImage src={photos[photoIndex]} alt={`${offer?.name || ""} بزرگ`} />
                {photos.length > 1 && (
                  <>
                    <button type="button" onClick={() => movePhoto(-1)} aria-label="تصویر قبلی" className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-night-950/70 text-white"><ChevronRight className="h-5 w-5" /></button>
                    <button type="button" onClick={() => movePhoto(1)} aria-label="تصویر بعدی" className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-night-950/70 text-white"><ChevronLeft className="h-5 w-5" /></button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </MotionConfig>
  );
}
