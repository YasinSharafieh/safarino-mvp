"use client";

import { useEffect, useMemo, useState } from "react";
import { AlarmClock, Check, CheckCircle2, CirclePlus, ListChecks, RotateCcw, Trash2 } from "lucide-react";
import {
  CHECKLIST_EVENT,
  CHECKLIST_GROUPS,
  addCustomItem,
  allItems,
  checklistProgress,
  countdownLabel,
  daysUntil,
  readChecklist,
  removeCustomItem,
  resetChecklist,
  saveChecklist,
  toggleDone,
  type ChecklistGroup,
  type ChecklistState,
} from "@/lib/checklist";

/**
 * The list of things not to forget, with the day each one matters.
 * Everything stays on this device; the countdown is read from the trip dates
 * the traveller already chose.
 */
export default function TripChecklist({ departureDate, compact = false }: { departureDate: string; compact?: boolean }) {
  const [state, setState] = useState<ChecklistState>({ done: [], custom: [] });
  const [ready, setReady] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newGroup, setNewGroup] = useState<ChecklistGroup>("packing");
  const [newDays, setNewDays] = useState(1);

  useEffect(() => {
    setState(readChecklist());
    setReady(true);
    const sync = () => setState(readChecklist());
    window.addEventListener(CHECKLIST_EVENT, sync);
    return () => window.removeEventListener(CHECKLIST_EVENT, sync);
  }, []);

  const update = (next: ChecklistState) => {
    setState(next);
    saveChecklist(next);
    try {
      window.dispatchEvent(new Event(CHECKLIST_EVENT));
    } catch {
      /* the list still works in memory */
    }
  };

  const left = daysUntil(departureDate);
  const progress = useMemo(() => checklistProgress(state, left), [left, state]);
  const items = allItems(state);
  const doneSet = new Set(state.done);
  const dueIds = new Set(progress.dueNow.map((item) => item.id));

  const add = () => {
    const title = newTitle.trim();
    if (!title) return;
    const next = addCustomItem(state, { title, group: newGroup, daysBefore: newDays });
    if (next === state) return;
    update(next);
    setNewTitle("");
  };

  return (
    <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.04] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-black text-emerald-100">
          <ListChecks className="h-4 w-4" />
          چک‌لیست سفر
        </p>
        <span className="flex items-center gap-1.5 text-[9.5px] text-slate-400">
          <AlarmClock className="h-3.5 w-3.5 text-emerald-300" />
          {countdownLabel(left)}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
          <span className="block h-full rounded-full bg-emerald-400" style={{ width: `${progress.percent}%` }} />
        </span>
        <span className="shrink-0 text-[9.5px] font-bold text-emerald-200">
          {new Intl.NumberFormat("fa-IR").format(progress.done)} از {new Intl.NumberFormat("fa-IR").format(progress.total)}
        </span>
      </div>

      {progress.dueNow.length ? (
        <div className="mt-2 rounded-xl border border-amber-400/25 bg-amber-400/10 p-2">
          <p className="text-[10px] font-black text-amber-100">
            حالا وقت این‌هاست ({new Intl.NumberFormat("fa-IR").format(progress.dueNow.length)} مورد)
          </p>
          <p className="mt-0.5 text-[9.5px] leading-5 text-amber-100/80">
            {progress.dueNow.slice(0, 4).map((item) => item.title).join(" · ")}
            {progress.dueNow.length > 4 ? " و چند مورد دیگر" : ""}
          </p>
        </div>
      ) : progress.total && progress.done === progress.total ? (
        <p className="mt-2 flex items-center gap-1.5 rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-2 text-[10px] font-bold text-emerald-100">
          <CheckCircle2 className="h-3.5 w-3.5" />
          همه‌چیز آماده است؛ سفر خوبی داشته باشید.
        </p>
      ) : null}

      <div className={compact ? "mt-2 space-y-2" : "mt-2 grid gap-2 lg:grid-cols-2"}>
        {CHECKLIST_GROUPS.map((group) => {
          const groupItems = items.filter((item) => item.group === group.id);
          if (!groupItems.length) return null;
          const groupProgress = progress.byGroup.find((entry) => entry.group === group.id);
          return (
            <div key={group.id} className="rounded-xl border border-white/10 bg-slate-950/25 p-2">
              <div className="flex items-baseline justify-between gap-2">
                <b className="text-[10.5px] font-extrabold text-white">{group.label}</b>
                <span className="text-[9px] text-slate-500">
                  {new Intl.NumberFormat("fa-IR").format(groupProgress?.done || 0)}/{new Intl.NumberFormat("fa-IR").format(groupItems.length)}
                </span>
              </div>
              <p className="mt-0.5 text-[9px] text-slate-500">{group.hint}</p>
              <ul className="mt-1.5 space-y-1">
                {groupItems.map((item) => {
                  const done = doneSet.has(item.id);
                  return (
                    <li key={item.id} className="flex items-start gap-1.5">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={done}
                        aria-label={`${done ? "برگرداندن" : "انجام شد"}: ${item.title}`}
                        onClick={() => update(toggleDone(state, item.id))}
                        className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border transition ${
                          done ? "border-emerald-400/60 bg-emerald-400/25 text-emerald-100" : "border-white/25 bg-transparent text-transparent hover:border-emerald-400/40"
                        }`}
                      >
                        <Check className="h-2.5 w-2.5" />
                      </button>
                      <span className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => update(toggleDone(state, item.id))}
                          className={`block w-full text-right text-[10px] leading-5 transition ${done ? "text-slate-500 line-through" : "text-slate-200 hover:text-white"}`}
                        >
                          {item.title}
                          {dueIds.has(item.id) ? (
                            <span className="ms-1 rounded bg-amber-400/15 px-1 py-0.5 text-[8.5px] font-bold text-amber-200">حالا</span>
                          ) : null}
                        </button>
                        {item.note ? <span className="block text-[8.5px] leading-4 text-slate-500">{item.note}</span> : null}
                      </span>
                      {item.custom ? (
                        <button
                          type="button"
                          onClick={() => update(removeCustomItem(state, item.id))}
                          aria-label={`حذف ${item.title}`}
                          className="rounded p-0.5 text-slate-500 transition hover:text-rose-300"
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-slate-950/25 p-2">
        <input
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") add();
          }}
          maxLength={90}
          placeholder="چیز دیگری که نباید فراموش شود…"
          aria-label="افزودن مورد تازه به چک‌لیست"
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1.5 text-[10px] text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/50"
        />
        <select
          value={newGroup}
          onChange={(event) => setNewGroup(event.target.value as ChecklistGroup)}
          aria-label="دستهٔ مورد تازه"
          className="rounded-lg border border-white/10 bg-slate-950/60 px-1.5 py-1.5 text-[9.5px] font-bold text-slate-200 outline-none [&>option]:bg-slate-900"
        >
          {CHECKLIST_GROUPS.map((group) => (
            <option key={group.id} value={group.id}>{group.label}</option>
          ))}
        </select>
        <select
          value={newDays}
          onChange={(event) => setNewDays(Number(event.target.value))}
          aria-label="چه روزی قبل از حرکت"
          className="rounded-lg border border-white/10 bg-slate-950/60 px-1.5 py-1.5 text-[9.5px] font-bold text-slate-200 outline-none [&>option]:bg-slate-900"
        >
          {[0, 1, 2, 3, 5, 7, 10, 14].map((value) => (
            <option key={value} value={value}>
              {value === 0 ? "روز حرکت" : `${new Intl.NumberFormat("fa-IR").format(value)} روز قبل`}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={add}
          disabled={!newTitle.trim()}
          className="flex items-center gap-1 rounded-lg border border-emerald-400/30 bg-emerald-400/15 px-2 py-1.5 text-[9.5px] font-extrabold text-emerald-100 transition hover:bg-emerald-400/25 disabled:opacity-40"
        >
          <CirclePlus className="h-3 w-3" />
          افزودن
        </button>
        {progress.done || state.custom.length ? (
          <button
            type="button"
            onClick={() => update(resetChecklist())}
            className="ms-auto flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[9px] font-bold text-slate-400 transition hover:text-rose-200"
          >
            <RotateCcw className="h-2.5 w-2.5" />
            صفر کردن
          </button>
        ) : null}
      </div>

      {!ready ? <p className="mt-1 text-[9px] text-slate-500">در حال خواندن چک‌لیست…</p> : null}
      <p className="mt-2 text-[9px] leading-5 text-slate-500">
        چک‌لیست فقط روی همین دستگاه ذخیره می‌شود و جایی فرستاده نمی‌شود. سفرینو اعلان (نوتیفیکیشن) نمی‌فرستد؛ «حالا وقت این‌هاست» بر اساس تاریخ حرکت و روزهای باقی‌مانده روی همین صفحه حساب می‌شود.
      </p>
    </div>
  );
}
