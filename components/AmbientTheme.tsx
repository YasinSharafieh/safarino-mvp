"use client";

import { useEffect, useMemo, useState } from "react";
import { Globe2, Volume2, VolumeX } from "lucide-react";
import { useTravel } from "@/app/context/TravelContext";
import { ambientCss, ambientFor } from "@/lib/ambient";
import { findCity } from "@/lib/discover";

const SOUND_KEY = "safarino-ambient-sound";

/**
 * «رابط کاربری تطبیق‌پذیر» — the site takes the colour of the destination.
 *
 * Only the three decorative aura colours move; text, cards and buttons keep the
 * same contrast, so dark and light mode both stay readable. Sound is off until
 * the traveller turns it on (a browser never plays audio by itself), and it is a
 * two-second gentle swell, never a loop.
 *
 * It used to float in the bottom-right corner — a dark pill with no explanation
 * that looked like a stray switch. It now sits *inside* the header, in the flow
 * of the page, so it can never cover content and always looks like what it is.
 */
export default function AmbientTheme() {
  const { travelData, isHydrated } = useTravel();
  const [soundOn, setSoundOn] = useState(false);
  const ambient = useMemo(
    () => ambientFor(travelData.destination, findCity(travelData.destination)?.moods || travelData.tasteMoods || []),
    [travelData.destination, travelData.tasteMoods],
  );

  useEffect(() => {
    try {
      setSoundOn(window.localStorage.getItem(SOUND_KEY) === "1");
    } catch {
      setSoundOn(false);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    const root = document.documentElement;
    const css = ambientCss(ambient);
    for (const [key, value] of Object.entries(css)) root.style.setProperty(key, value);
    root.dataset.ambient = ambient.id;
  }, [ambient, isHydrated]);

  /** A two-second swell, built in the browser: no file, no network, no autoplay. */
  const playAmbience = () => {
    if (!ambient.sound) return;
    try {
      const scope = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const Constructor = scope.AudioContext || scope.webkitAudioContext;
      if (!Constructor) return;
      const context = new Constructor();
      const now = context.currentTime;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.045, now + 0.8);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2);
      gain.connect(context.destination);
      // Each destination gets its own two-note colour — a hint, not a soundtrack.
      const notes =
        ambient.sound === "waves" ? [196, 261.63] : ambient.sound === "forest" ? [174.61, 220] : ambient.sound === "wind" ? [146.83, 196] : [220, 293.66];
      notes.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        oscillator.connect(gain);
        oscillator.start(now + index * 0.25);
        oscillator.stop(now + 2);
      });
      window.setTimeout(() => void context.close(), 2400);
    } catch {
      // Sound is a flourish; a blocked audio context changes nothing else.
    }
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    try {
      window.localStorage.setItem(SOUND_KEY, next ? "1" : "0");
    } catch {
      // The preference just will not survive a reload.
    }
    if (next) playAmbience();
  };

  if (!isHydrated || !travelData.destination) return null;

  return (
    <div className="print:hidden" dir="rtl">
      <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.05] px-2 py-1.5 text-[9px] text-slate-300">
        <span className="flex items-center gap-1 px-1" title={ambient.why}>
          <Globe2 className="h-3 w-3 text-cyan-300" />
          <span className="hidden sm:inline">حال‌وهوای {travelData.destination}</span>
        </span>
        <span className="rounded-full px-1.5 py-0.5 font-bold text-white" style={{ background: ambient.colors[0] }} aria-hidden>
          {ambient.label}
        </span>
        {ambient.sound ? (
          <button
            type="button"
            onClick={toggleSound}
            aria-pressed={soundOn}
            aria-label={soundOn ? "خاموش کردن صدای محیط" : "روشن کردن صدای محیط"}
            className="grid h-5 w-5 place-items-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            {soundOn ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
          </button>
        ) : null}
      </div>
    </div>
  );
}
