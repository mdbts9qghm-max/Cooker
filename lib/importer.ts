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

/** OCR im Browser (Tesseract.js, Deutsch + Englisch). Lädt Sprachdaten beim ersten Mal (ca. 10 MB). */
export async function ocrImage(file: Blob, onProgress?: (p: number) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(["deu", "eng"], 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress?.(m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(file);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
