"use client";

import { useCallback, useRef, useState } from "react";
import { Download, ImageDown, LoaderCircle, Share2 } from "lucide-react";
import { STORY_SIZE, storyScenes, type StoryInput } from "@/lib/story-plan";

/**
 * «استوری اینستاگرام» — three vertical 9:16 cards, drawn on the traveller's own
 * device. Nothing is uploaded anywhere, and every word on the cards comes from
 * `lib/story-plan.ts`, which only ever repeats what the plan page already says.
 */
export default function StoryExport({ input }: { input: StoryInput }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number>(0);
  const [error, setError] = useState("");
  const blobs = useRef<Blob[]>([]);

  const draw = useCallback(
    async (scene: ReturnType<typeof storyScenes>[number]) => {
      const canvas = document.createElement("canvas");
      canvas.width = STORY_SIZE.width;
      canvas.height = STORY_SIZE.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas");

      // Background: the site's own dusk, with the destination's aura on top.
      const gradient = context.createLinearGradient(0, 0, STORY_SIZE.width, STORY_SIZE.height);
      gradient.addColorStop(0, "#2c1256");
      gradient.addColorStop(0.55, "#180f33");
      gradient.addColorStop(1, "#0a0716");
      context.fillStyle = gradient;
      context.fillRect(0, 0, STORY_SIZE.width, STORY_SIZE.height);

      const aura = context.createRadialGradient(180, 220, 40, 180, 220, 900);
      aura.addColorStop(0, "rgba(169,125,255,0.55)");
      aura.addColorStop(1, "rgba(169,125,255,0)");
      context.fillStyle = aura;
      context.fillRect(0, 0, STORY_SIZE.width, STORY_SIZE.height);
      const aura2 = context.createRadialGradient(STORY_SIZE.width - 140, STORY_SIZE.height - 260, 40, STORY_SIZE.width - 140, STORY_SIZE.height - 260, 820);
      aura2.addColorStop(0, "rgba(52,235,196,0.35)");
      aura2.addColorStop(1, "rgba(52,235,196,0)");
      context.fillStyle = aura2;
      context.fillRect(0, 0, STORY_SIZE.width, STORY_SIZE.height);

      // Glass card
      context.save();
      context.fillStyle = "rgba(255,255,255,0.07)";
      context.strokeStyle = "rgba(255,255,255,0.16)";
      context.lineWidth = 3;
      const card = { x: 72, y: 190, w: STORY_SIZE.width - 144, h: STORY_SIZE.height - 440 };
      const radius = 56;
      context.beginPath();
      context.moveTo(card.x + radius, card.y);
      context.arcTo(card.x + card.w, card.y, card.x + card.w, card.y + card.h, radius);
      context.arcTo(card.x + card.w, card.y + card.h, card.x, card.y + card.h, radius);
      context.arcTo(card.x, card.y + card.h, card.x, card.y, radius);
      context.arcTo(card.x, card.y, card.x + card.w, card.y, radius);
      context.closePath();
      context.fill();
      context.stroke();
      context.restore();

      context.direction = "rtl";
      context.textAlign = "right";
      const right = STORY_SIZE.width - 130;
      let y = card.y + 150;

      context.fillStyle = "#a5f3fc";
      context.font = "600 40px Vazirmatn, sans-serif";
      context.fillText(scene.kicker, right, y);
      y += 110;

      context.fillStyle = "#ffffff";
      context.font = "900 96px Vazirmatn, sans-serif";
      context.fillText(scene.title.slice(0, 22), right, y);
      y += 96;

      context.fillStyle = "#c4b5fd";
      context.font = "600 44px Vazirmatn, sans-serif";
      context.fillText(scene.subtitle.slice(0, 46), right, y);
      y += 110;

      context.strokeStyle = "rgba(255,255,255,0.14)";
      context.beginPath();
      context.moveTo(right, y);
      context.lineTo(card.x + 60, y);
      context.stroke();
      y += 90;

      for (const line of scene.lines.slice(0, 8)) {
        context.fillStyle = "rgba(255,255,255,0.9)";
        context.font = "600 42px Vazirmatn, sans-serif";
        const text = line.length > 52 ? `${line.slice(0, 50)}…` : line;
        context.fillText(text, right, y);
        y += 74;
        if (y > card.y + card.h - 120) break;
      }

      context.fillStyle = "rgba(255,255,255,0.55)";
      context.font = "600 34px Vazirmatn, sans-serif";
      context.fillText(scene.footer.slice(0, 48), right, card.y + card.h - 60);

      context.fillStyle = "#22d3ee";
      context.font = "900 48px Vazirmatn, sans-serif";
      context.textAlign = "center";
      context.fillText("سفرینو", STORY_SIZE.width / 2, STORY_SIZE.height - 150);
      context.fillStyle = "rgba(255,255,255,0.45)";
      context.font = "500 30px Vazirmatn, sans-serif";
      context.fillText("برنامهٔ سفر، بودجه و جاذبه‌ها — یک‌جا", STORY_SIZE.width / 2, STORY_SIZE.height - 96);

      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("blob"))), "image/png", 0.95);
      });
    },
    [],
  );

  const build = async () => {
    setBusy(true);
    setError("");
    setDone(0);
    try {
      // The Persian font must be ready before the canvas draws, otherwise the
      // letters fall back to a Latin face.
      if (document.fonts?.ready) await document.fonts.ready;
      const scenes = storyScenes(input);
      const made: Blob[] = [];
      for (const scene of scenes) {
        made.push(await draw(scene));
        setDone(made.length);
      }
      blobs.current = made;
    } catch {
      setError("ساخت تصویر در این مرورگر ممکن نشد؛ از دکمهٔ PDF استفاده کن.");
    } finally {
      setBusy(false);
    }
  };

  const download = (blob: Blob, index: number) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `safarino-story-${index + 1}.png`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const share = async () => {
    if (!blobs.current.length) return;
    const files = blobs.current.map((blob, index) => new File([blob], `safarino-story-${index + 1}.png`, { type: "image/png" }));
    try {
      const scope = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
      if (scope.canShare?.({ files }) && navigator.share) {
        await navigator.share({ files, title: `سفر ${input.destination}` });
        return;
      }
    } catch {
      // Falling through to plain downloads is a fine outcome.
    }
    blobs.current.forEach((blob, index) => download(blob, index));
  };

  return (
    <div className="glass p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <b className="flex items-center gap-1.5 text-[12px] font-black text-white">
            <ImageDown className="h-4 w-4 text-fuchsia-300" />
            استوری اینستاگرام
          </b>
          <p className="mt-1 text-[9.5px] leading-6 text-slate-400">
            سه تصویر عمودی ۹:۱۶ از همین سفر — جلد، روزها و بودجه. روی همین دستگاه ساخته می‌شود و جایی فرستاده نمی‌شود.
          </p>
        </div>
        <button type="button" onClick={() => void build()} disabled={busy} className="btn-primary !px-3.5 !py-2 text-[10.5px] disabled:opacity-60">
          {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          {busy ? `در حال ساخت ${done}/۳` : blobs.current.length ? "ساخت دوباره" : "ساخت ۳ تصویر استوری"}
        </button>
      </div>

      {error ? <p className="mt-2 text-[10px] text-rose-200">{error}</p> : null}

      {blobs.current.length ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {blobs.current.map((blob, index) => (
            <button
              key={index}
              type="button"
              onClick={() => download(blob, index)}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[9.5px] text-slate-200 transition hover:bg-white/[0.09] hover:text-white"
            >
              تصویر {new Intl.NumberFormat("fa-IR").format(index + 1)}
            </button>
          ))}
          <button type="button" onClick={() => void share()} className="inline-flex items-center gap-1 rounded-lg border border-fuchsia-400/30 bg-fuchsia-400/10 px-2.5 py-1 text-[9.5px] font-bold text-fuchsia-100 transition hover:bg-fuchsia-400/20">
            <Share2 className="h-3 w-3" />
            اشتراک‌گذاری
          </button>
        </div>
      ) : null}
    </div>
  );
}
