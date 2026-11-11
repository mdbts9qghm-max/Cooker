export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().slice(0, 12);
  return Math.random().toString(36).slice(2, 14);
}

export function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function fmt(n: number, digits = 0): string {
  return n.toLocaleString("de-DE", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

// ---------- dates (local time) ----------

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = fromISODate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function today(): string {
  return toISODate(new Date());
}

/** Monday of the week containing the date */
export function mondayOf(s: string): string {
  const d = fromISODate(s);
  const wd = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - wd);
  return toISODate(d);
}

export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function weekdayIndex(s: string): number {
  return (fromISODate(s).getDay() + 6) % 7;
}

export const WD_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
export const WD_LONG = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

export function isoWeekNumber(s: string): number {
  const d = fromISODate(s);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function fmtDate(s: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }): string {
  return fromISODate(s).toLocaleDateString("de-DE", opts);
}

export function fmtWeekRange(monday: string): string {
  const sun = addDays(monday, 6);
  return `${fmtDate(monday)} – ${fmtDate(sun)}`;
}

export function haptic(ms = 8) {
  try {
    navigator.vibrate?.(ms);
  } catch {}
}

export function similarity(a: string, b: string): number {
  // Dice coefficient on bigrams
  const bg = (s: string) => {
    const t = s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    const out = new Map<string, number>();
    for (let i = 0; i < t.length - 1; i++) {
      const k = t.slice(i, i + 2);
      out.set(k, (out.get(k) ?? 0) + 1);
    }
    return out;
  };
  const A = bg(a);
  const B = bg(b);
  let inter = 0;
  let total = 0;
  for (const v of A.values()) total += v;
  for (const v of B.values()) total += v;
  for (const [k, v] of A) inter += Math.min(v, B.get(k) ?? 0);
  return total ? (2 * inter) / total : 0;
}

export async function compressImage(file: Blob, maxSize = 1080, quality = 0.78): Promise<string> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  let w: number, h: number, src: CanvasImageSource;
  if (bitmap) {
    w = bitmap.width;
    h = bitmap.height;
    src = bitmap;
  } else {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = URL.createObjectURL(file);
    });
    w = img.naturalWidth;
    h = img.naturalHeight;
    src = img;
  }
  const scale = Math.min(1, maxSize / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext("2d")!.drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

export async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/image?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await compressImage(blob, 900, 0.75);
  } catch {
    return null;
  }
}

export async function shareOrCopyText(text: string, title?: string): Promise<"shared" | "copied" | "failed"> {
  try {
    if (navigator.share) {
      await navigator.share({ text, title });
      return "shared";
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") return "failed";
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
