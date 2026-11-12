"use client";

import { loadMatchContext } from "./hooks";
import { resolveIngredient } from "./nutrition";
import { parseRecipeText } from "./parser";
import type { Recipe } from "./types";
import { uid, urlToDataUrl } from "./util";

export type Draft = {
  id: string;
  recipe: Recipe;
  /** set when editing an existing recipe */
  editId?: string;
  uncertain: { title: boolean; servings: boolean; macros: boolean };
  source?: string;
  /** original text the recipe was parsed from (e.g. the TikTok caption) */
  rawText?: string;
};

const drafts = new Map<string, Draft>();

export function getDraft(id: string) {
  return drafts.get(id);
}
export function setDraft(d: Draft) {
  drafts.set(d.id, d);
}
export function dropDraft(id: string) {
  drafts.delete(id);
}

export function emptyRecipe(): Recipe {
  const now = Date.now();
  return {
    id: uid(),
    title: "",
    photos: [],
    tags: [],
    notes: "",
    servings: 1,
    ingredients: [],
    steps: [],
    creatorMacros: null,
    favorite: false,
    createdAt: now,
    updatedAt: now,
    origin: "manual",
  };
}

export async function draftFromText(text: string, opts: { origin?: string; photo?: string | null; titleHint?: string; source?: string } = {}): Promise<Draft> {
  const parsed = parseRecipeText(text, { titleHint: opts.titleHint });
  const ctx = await loadMatchContext();
  const r = emptyRecipe();
  r.title = parsed.title;
  r.servings = parsed.servings ?? 1;
  r.ingredients = parsed.ingredients.map((p) => resolveIngredient(p, ctx));
  r.steps = parsed.steps;
  r.creatorMacros = parsed.creatorMacros;
  r.origin = opts.origin ?? "text";
  if (opts.photo) r.photos = [opts.photo];
  const tags = guessTags(text);
  r.tags = tags;
  const d: Draft = { id: uid(), recipe: r, uncertain: parsed.uncertain, source: opts.source, rawText: text };
  setDraft(d);
  return d;
}

export function draftManual(): Draft {
  const d: Draft = { id: uid(), recipe: emptyRecipe(), uncertain: { title: false, servings: false, macros: false } };
  setDraft(d);
  return d;
}

export function draftFromRecipe(r: Recipe): Draft {
  const d: Draft = { id: uid(), recipe: structuredClone(r), editId: r.id, uncertain: { title: false, servings: false, macros: false } };
  setDraft(d);
  return d;
}

function guessTags(text: string): string[] {
  const t = text.toLowerCase();
  const tags: string[] = [];
  if (/frühstück|breakfast|overnight|porridge|pancake|oats|müsli/.test(t)) tags.push("Frühstück");
  if (/meal ?prep/.test(t)) tags.push("Meal Prep");
  if (/high ?protein|proteinreich|eiweißreich/.test(t)) tags.push("High Protein");
  if (/vegan|vegetarisch|vegetarian|veggie/.test(t)) tags.push("Vegetarisch");
  if (/\b(10|15|20) ?min|schnell|quick|easy|einfach/.test(t)) tags.push("Schnell");
  return tags;
}

export type UrlKind = "tiktok" | "instagram" | "other" | "none";

export function detectUrl(text: string): { url: string | null; kind: UrlKind } {
  const m = text.match(/https?:\/\/[^\s]+/i);
  if (!m) return { url: null, kind: "none" };
  const url = m[0].replace(/[),.]+$/, "");
  if (/tiktok\.com/i.test(url)) return { url, kind: "tiktok" };
  if (/instagram\.com|instagr\.am/i.test(url)) return { url, kind: "instagram" };
  return { url, kind: "other" };
}

export async function fetchTikTok(url: string): Promise<{ caption: string; thumbnail: string | null; author: string }> {
  const res = await fetch(`/api/tiktok?url=${encodeURIComponent(url)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "TikTok-Import fehlgeschlagen");
  return data;
}

export async function draftFromTikTok(url: string, extraText = ""): Promise<Draft> {
  const data = await fetchTikTok(url);
  const photo = data.thumbnail ? await urlToDataUrl(data.thumbnail) : null;
  const text = [data.caption, extraText].filter(Boolean).join("\n");
  return draftFromText(text, { origin: "tiktok", photo, titleHint: data.author ? `Rezept von ${data.author}` : undefined, source: "TikTok" });
}

/**
 * Bild für die Texterkennung vorbereiten: Graustufen, dunkle Screenshots (Dark Mode) invertieren,
 * kleine Bilder hochskalieren.
 */
async function prepareForOcr(file: Blob): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = bmp.width < 1100 ? 2 : 1;
    const c = document.createElement("canvas");
    c.width = bmp.width * scale;
    c.height = bmp.height * scale;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = g;
      sum += g;
    }
    const dark = sum / (d.length / 4) < 115;
    if (dark) for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = 255 - d[i];
    ctx.putImageData(img, 0, 0);
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b ?? file), "image/png"));
  } catch {
    return file;
  }
}

const OCR_NOISE = new RegExp(
  [
    "^gef[äa]llt\\b", "\\bgef[äa]llt .* mal\\b", "^\\d[\\d.,]*\\s*(likes?|mal|kommentare|comments|antworten|replies|views|aufrufe)\\b",
    "^(antworten|reply|übersetzung anzeigen|see translation|translate|mehr|more|… ?mehr|\\.\\.\\. ?more|folgen|follow|following|abonniert|teilen|share|senden|send)$",
    "^(vor )?\\d+\\s*(std|min|tag|tagen|wo|h|d|w|m)\\.?( ago)?$", "^original(ton|audio)", "^(original audio|originalton)", "^\\d{1,2}:\\d{2}$",
    "^(alle \\d+ kommentare|view all \\d+ comments|kommentar hinzufügen|add a comment)",
    "\\b(folgen|follow|following|abonnieren|gefolgt)$", "[üu]bersetzung anzeigen", "see translation",
    "^vor \\d+ (sek|min|minuten|std|stunden|tag|tagen|woche|wochen)\\b", "^\\d+ (seconds?|minutes?|hours?|days?|weeks?) ago\\b",
  ].join("|"),
  "i",
);

const LIST_START = /^(\s*[-–•·*]|\s*\d+\s*[.)]|\s*\d)/;

/**
 * Zeilen wieder zusammenfügen, die nur wegen der Bildschirmbreite umgebrochen wurden
 * ("… | 11 g" + "Fett", "… dazugeben, dann" + "Spinat.").
 */
function unwrapLines(lines: string[]): string[] {
  const out: string[] = [];
  for (const l of lines) {
    const prev = out[out.length - 1];
    if (
      prev &&
      l &&
      (prev.length >= 32 || /\([^)]*$/.test(prev)) &&
      !/[.!?:;]$/.test(prev) &&
      (/,$/.test(prev) || !LIST_START.test(l)) &&
      !/:$/.test(l) &&
      !/^#/.test(l)
    ) {
      out[out.length - 1] = `${prev} ${l}`;
    } else out.push(l);
  }
  return out;
}

/** typische OCR-Fehler und Bedienelemente aus Screenshots entfernen */
export function cleanOcrText(text: string): string {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) =>
      l
        .replace(/^[«»•·©®°*]+\s*/, "- ")
        // Benutzername vor der Caption ("fitfood.anna Cremige Pasta …")
        .replace(/^(?:(?=[a-z0-9._]*[a-z])[a-z0-9]+[._][a-z0-9][a-z0-9._]*|@[\w.]+)\s+(?=\p{Lu})/u, "")
        // Emoji-Reste wie "&@", "„", "°" zwischen Wörtern
        .replace(/(^|\s)[^\p{L}\p{N}\s()[\]½¼¾/|.,:-]{1,3}(?=\s|$)/gu, "$1")
        .replace(/(\d)\s*[gG]r\b/g, "$1 g")
        .replace(/(\d)[oO](?=\s?g\b)/g, "$10")
        .replace(/\b[Il](?=\s?(?:EL|TL|Tasse|cup|tbsp|tsp|Stück|Prise|Dose|Zehe)\b)/g, "1")
        .replace(/\s{2,}/g, " ")
        .trim(),
    )
    .filter((l) => !l || (!OCR_NOISE.test(l) && !/^[^\p{L}\d]+$/u.test(l) && !/^[A-Z0-9]?\s*(?=[a-z0-9._]*[a-z])[a-z0-9]+[._][a-z0-9][a-z0-9._]*\s*$/.test(l)));
  // Leerzeilen trennen Absätze beim Zusammenfügen, danach werden sie entfernt
  return unwrapLines(lines)
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * OCR im Browser (Tesseract.js, Deutsch + Englisch) für ein oder mehrere Bilder.
 * Lädt beim ersten Mal die Sprachdaten (ca. 10 MB), danach aus dem Cache.
 */
export async function ocrImages(files: Blob[], onProgress?: (index: number, total: number, p: number) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  let current = 0;
  const worker = await createWorker(["deu", "eng"], 1, {
    // Dateien liegen in der App selbst (scripts/copy-tesseract.mjs), kein fremdes CDN nötig
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract/",
    langPath: "/tesseract/lang",
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress?.(current, files.length, m.progress);
    },
  });
  try {
    const parts: string[] = [];
    for (let i = 0; i < files.length; i++) {
      current = i;
      onProgress?.(i, files.length, 0);
      const { data } = await worker.recognize(await prepareForOcr(files[i]));
      parts.push(data.text);
    }
    return cleanOcrText(parts.join("\n"));
  } finally {
    await worker.terminate();
  }
}
