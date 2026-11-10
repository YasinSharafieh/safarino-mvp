"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Check, ExternalLink, Images, MapPin, Star } from "lucide-react";
import type { AccommodationGroup, AccommodationOffer } from "@/lib/accommodation-types";
import { categorizeStay, PROVIDER_LABELS } from "@/lib/accommodation-types";
import AccommodationImage from "./AccommodationImage";
import ProviderBadge, { ProviderMark } from "./ProviderBadge";

const numberFormatter = new Intl.NumberFormat("fa-IR");
const compactFormatter = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 });
const formatNumber = (value: number) => numberFormatter.format(Math.round(value));
const formatToman = (value: number) => `${formatNumber(value)} تومان`;

export default function AccommodationCard({
  group,
  index,
  nights,
  selectedId,
  onSelect,
  onClear,
  detailQuery = "",
}: {
  group: AccommodationGroup;
  index: number;
  nights: number;
  selectedId: string;
  onSelect: (offer: AccommodationOffer) => void;
  onClear: () => void;
  detailQuery?: string;
}) {
  const [activeId, setActiveId] = useState(group.offers[0].id);
  useEffect(() => {
    const selected = group.offers.find((offer) => offer.id === selectedId);
    setActiveId(selected?.id || group.offers[0].id);
  }, [group, selectedId]);
  const offer = group.offers.find((item) => item.id === activeId) || group.offers[0];
  const isSelected = selectedId === offer.id;

  return (
    <motion.article layout initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.04 }} className={`glass group flex flex-col overflow-hidden transition duration-300 hover:-translate-y-1 ${isSelected ? "border-cyan-300/50 shadow-glow" : "hover:border-white/25"}`}>
      <div className="relative h-52 overflow-hidden">
        <AccommodationImage src={offer.imageUrl} alt={offer.name} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night-950/95 via-transparent to-night-950/20" />
        <span className="absolute right-3 top-3 rounded-full border border-white/15 bg-night-950/70 px-3 py-1 text-[10px] font-bold text-white backdrop-blur-md">{offer.kind === "stay" ? categorizeStay(offer.typeLabel, offer.name).label || offer.typeLabel : offer.typeLabel}</span>
        {offer.rating ? <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-night-950/70 px-2.5 py-1 text-[11px] font-black text-cyan-300 backdrop-blur-md"><Star className="h-3.5 w-3.5 fill-cyan-300" />{compactFormatter.format(offer.rating)}</span> : null}
        <div className="absolute bottom-3 right-3 left-3">
          <ProviderBadge provider={offer.provider} inverse className="mb-2" />
          <h3 className="text-base font-black leading-7 text-white">{offer.name}</h3>
          <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-300"><MapPin className="h-3 w-3 shrink-0" />{offer.location}</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        {group.offers.length > 1 && (
          <div className="mb-4 rounded-xl border border-cyan-300/10 bg-cyan-300/[0.035] p-2">
            <p className="mb-2 px-1 text-[9px] leading-4 text-slate-400">یک اقامتگاه، {formatNumber(group.offers.length)} پیشنهاد واقعی؛ منبع را مقایسه کن:</p>
            <div className="flex flex-wrap gap-1.5">
              {group.offers.map((alternative) => (
                <button key={alternative.id} type="button" onClick={() => setActiveId(alternative.id)} aria-pressed={alternative.id === offer.id} className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[9px] font-bold transition ${alternative.id === offer.id ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-white/[0.035] text-slate-400 hover:text-white"}`}>
                  <ProviderMark provider={alternative.provider} className="h-4 w-4" />
                  {PROVIDER_LABELS[alternative.provider]}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-start justify-between gap-3">
          <div>
            {offer.priceBeforeDiscountToman && <span className="block text-[10px] text-slate-500 line-through">{formatToman(offer.priceBeforeDiscountToman)}</span>}
            <b className="text-lg font-black text-cyan-200">{formatToman(offer.priceTotalToman)}</b>
            <span className="mt-1 block text-[10px] text-slate-500">قیمت کل {formatNumber(nights)} شب{offer.priceIncludesVat === true ? " · با مالیات" : offer.priceIncludesVat === false ? " · پیش از مالیات نهایی" : ""}</span>
            <span className="mt-1 block text-[10px] text-cyan-300/70">میانگین هر شب {formatToman(offer.pricePerNightToman)}</span>
          </div>
          <span className="shrink-0 text-[10px] text-slate-500">{offer.reviewCount ? `${formatNumber(offer.reviewCount)} نظر` : "بدون نظر ثبت‌شده"}</span>
        </div>
        <p className="mt-3 rounded-lg bg-white/[0.025] p-2 text-[9px] leading-5 text-slate-500">{offer.priceNote}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">{[...offer.details, ...offer.amenities].slice(0, 5).map((detail, detailIndex) => <span key={`${detail}-${detailIndex}`} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] leading-4 text-slate-300">{detail}</span>)}</div>
        <div className="mt-auto space-y-2 pt-5">
          <button type="button" onClick={() => isSelected ? onClear() : onSelect(offer)} aria-pressed={isSelected} className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${isSelected ? "bg-emerald-400 text-slate-950" : "btn-primary w-full !py-2.5"}`}>
            {isSelected && <Check className="h-4 w-4" />}{isSelected ? "انتخاب شد؛ برای لغو کلیک کنید" : "انتخاب برای سفرینو"}
          </button>
          <Link href={`/accommodation/${encodeURIComponent(offer.id)}${detailQuery}`} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-cyan-400/15 px-3 py-2.5 text-[10px] font-extrabold text-cyan-100 transition hover:bg-cyan-400/25">
            <Images className="h-3.5 w-3.5" />
            جزئیات، گالری و نقشه
          </Link>
          <a href={offer.bookingUrl} target="_blank" rel="noreferrer noopener" className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 py-2.5 text-[10px] font-bold text-slate-300 transition hover:bg-white/5 hover:text-white">مشاهده و رزرو در {PROVIDER_LABELS[offer.provider]}<ExternalLink className="h-3 w-3" /></a>
          <p className="text-center text-[9px] leading-5 text-slate-500">{offer.bookingNote}</p>
        </div>
      </div>
    </motion.article>
  );
}
