"use client";

/**
 * «دستیار گروه» — who pays how much, in exact toman.
 *
 * The group starts from what the site already knows: how many travellers and how
 * many children are going. Each member has a share in half-units (an adult is a
 * full share, a child is half), the names are editable, and the three real numbers
 * — the trip budget, the planned cost, and what the ledger says was actually spent
 * — are divided by the same shares. Every part is integer toman and the parts add
 * up to the whole; the card also says, plainly, that settling debts needs to know
 * who paid each receipt, which is a thing we refuse to guess.
 */

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Plus, RefreshCw, Trash2, Users, Wallet } from "lucide-react";
import { useTravel } from "@/app/context/TravelContext";
import { tripSignature } from "@/lib/checklist";
import { LEDGER_EVENT, ledgerTotals, readLedger } from "@/lib/trip-ledger";
import {
  MAX_MEMBERS,
  defaultMembers,
  groupSummary,
  readGroup,
  weightLabel,
  writeGroup,
  type GroupMember,
} from "@/lib/group-trip";

const fa = (value: number) => new Intl.NumberFormat("fa-IR").format(Math.round(value));
const money = (value: number) => `${fa(value)} تومان`;

export default function GroupSplit({
  budgetToman,
  plannedToman,
  className = "",
}: {
  budgetToman: number;
  plannedToman: number;
  className?: string;
}) {
  const { travelData, isHydrated } = useTravel();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState("");

  const [spentToman, setSpentToman] = useState(0);

  const signature = useMemo(
    () =>
      tripSignature({
        origin: travelData.origin,
        destination: travelData.destination,
        departureDate: travelData.departureDate || null,
        days: travelData.days,
      }),
    [travelData.origin, travelData.destination, travelData.departureDate, travelData.days],
  );

  // The real money spent, straight from the ledger this device wrote.
  useEffect(() => {
    const read = () => setSpentToman(ledgerTotals(readLedger(signature), budgetToman).totalToman);
    read();
    window.addEventListener(LEDGER_EVENT, read);
    return () => window.removeEventListener(LEDGER_EVENT, read);
  }, [signature, budgetToman]);

  // Read the group this device kept; otherwise start from the real travellers.
  useEffect(() => {
    if (!isHydrated) return;
    const stored = readGroup(signature);
    const fallback = defaultMembers(Number(travelData.travelers) || 1, Number(travelData.children) || 0);
    setMembers(stored.length ? stored : fallback);
    setReady(true);
  }, [isHydrated, signature, travelData.travelers, travelData.children]);

  const summary = useMemo(
    () => groupSummary({ budget: budgetToman, planned: plannedToman, spent: spentToman }, members),
    [budgetToman, plannedToman, spentToman, members],
  );

  const persist = (next: GroupMember[]) => {
    setMembers(next);
    writeGroup(next, signature);
    setSaved("ذخیره شد؛ این گروه فقط روی همین دستگاه است.");
    window.setTimeout(() => setSaved(""), 2000);
  };

  const rename = (id: string, name: string) => {
    setMembers((current) => current.map((member) => (member.id === id ? { ...member, name } : member)));
  };

  const reweight = (id: string, weight: number) => {
    persist(members.map((member) => (member.id === id ? { ...member, weight } : member)));
  };

  const add = () => {
    if (members.length >= MAX_MEMBERS) return;
    const next = [
      ...members,
      {
        id: `m${Date.now().toString(36)}`,
        name: `همسفر ${new Intl.NumberFormat("fa-IR").format(members.length + 1)}`,
        weight: 2,
      },
    ];
    persist(next);
  };

  const remove = (id: string) => {
    if (members.length <= 1) return;
    persist(members.filter((member) => member.id !== id));
  };

  const reset = () => {
    persist(defaultMembers(Number(travelData.travelers) || 1, Number(travelData.children) || 0));
  };

  if (!ready) {
    return (
      <div className={`flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-[10px] text-slate-400 ${className}`}>
        <LoaderCircle className="h-3 w-3 animate-spin" />
        گروه در حال خواندن…
      </div>
    );
  }

  return (
    <section className={`rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4 ${className}`} aria-label="دستیار گروه">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-black text-white">
          <Users className="h-3.5 w-3.5 text-teal-200" />
          دستیار گروه — سهم هر نفر
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={add}
            disabled={members.length >= MAX_MEMBERS}
            className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-black text-slate-200 transition hover:bg-white/10 disabled:opacity-40"
          >
            <Plus className="h-2.5 w-2.5" />
            نفر تازه
          </button>
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-black text-slate-200 transition hover:bg-white/10"
            title="برگرداندن به تعداد مسافران همین سفر"
          >
            <RefreshCw className="h-2.5 w-2.5" />
            از سفر
          </button>
        </div>
      </div>

      <div className="mt-2 space-y-1.5">
        {members.map((member) => {
          const row = summary.rows.find((entry) => entry.id === member.id);
          return (
            <div key={member.id} className="rounded-xl border border-white/10 bg-black/20 px-2 py-1.5">
              <div className="flex items-center gap-1.5">
                <input
                  value={member.name}
                  onChange={(event) => rename(member.id, event.target.value.slice(0, 40))}
                  onBlur={() => persist(members)}
                  aria-label={`نام عضو ${member.name}`}
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-white outline-none focus:border-cyan-300/40"
                />
                <select
                  value={member.weight}
                  onChange={(event) => reweight(member.id, Number(event.target.value))}
                  aria-label={`سهم ${member.name}`}
                  className="rounded-lg border border-white/10 bg-[#150f2c] px-1.5 py-1 text-[9px] text-slate-100 outline-none"
                >
                  {[1, 2, 3, 4].map((weight) => (
                    <option key={weight} value={weight}>
                      {weightLabel(weight)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => remove(member.id)}
                  disabled={members.length <= 1}
                  aria-label={`حذف ${member.name}`}
                  className="rounded-lg border border-rose-300/20 bg-rose-400/10 p-1 text-rose-200 transition hover:bg-rose-400/20 disabled:opacity-30"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-slate-300">
                <span className="font-black text-teal-200">{row ? `${fa(row.sharePct)}٪` : "—"}</span>
                <span>از بودجه {row ? money(row.budgetShare) : "—"}</span>
                <span>از هزینهٔ برنامه {row ? money(row.plannedShare) : "—"}</span>
                <span>خرج‌شده {row ? money(row.spentShare) : "—"}</span>
                <span className={row && row.overShare ? "font-black text-rose-300" : "text-emerald-200"}>
                  مانده {row ? money(row.remainingShare) : "—"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 rounded-xl border border-teal-300/20 bg-teal-400/[0.07] px-2.5 py-1.5 text-[9px] text-teal-50">
        <span className="flex items-center gap-1 font-black">
          <Wallet className="h-2.5 w-2.5" />
          جمع دقیق: {money(summary.totals.budget)}
        </span>
        <span>
          {fa(summary.members)} نفر · {fa(summary.weightSum)} واحد وزن · {money(summary.totals.spent)} خرج واقعی
        </span>
      </div>

      <ul className="mt-1.5 space-y-0.5">
        {summary.notes.map((note, index) => (
          <li key={index} className="flex items-start gap-1 text-[9px] leading-5 text-slate-400">
            <span className="mt-2 h-0.5 w-0.5 shrink-0 rounded-full bg-slate-400" />
            <span className="min-w-0">{note}</span>
          </li>
        ))}
      </ul>
      {saved ? <p className="mt-1 text-[9px] text-emerald-200">{saved}</p> : null}
    </section>
  );
}
