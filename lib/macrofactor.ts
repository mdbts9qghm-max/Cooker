import * as LZ from "lz-string";

// lz-string ist CommonJS – je nach Bundler liegt die API direkt oder unter .default
const LZString = ((LZ as unknown as { default?: typeof LZ }).default ?? LZ) as typeof LZ;
import { recipeMacros } from "./nutrition";
import type { Recipe } from "./types";

/** Compact payload packed into the export link (no photos). */
export type MFPayload = {
  /** title */ t: string;
  /** servings */ s: number;
  /** ingredients: [grams, name] */ i: [number, string][];
  /** steps */ p: string[];
  /** per serving: kcal, protein, fat, carbs, fiber */ n: [number, number, number, number, number];
  /** image url (optional, only short public URLs) */ img?: string;
};

export function toPayload(r: Recipe, maxLen = 2000): MFPayload {
  const m = recipeMacros(r).perServing;
  const round1 = (x: number) => Math.round(x * 10) / 10;
  const payload: MFPayload = {
    t: r.title,
    s: r.servings,
    i: r.ingredients.filter((x) => x.grams > 0).map((x) => [Math.round(x.grams), x.food?.name?.replace(/,\s*(roh|ungekocht)$/i, "") ?? x.name]),
    p: r.steps,
    n: [Math.round(m.kcal), round1(m.protein), round1(m.fat), round1(m.carbs), round1(m.fiber)],
  };
  // Shorten steps if needed to keep the link short (MacroFactor only needs ingredients + macros).
  let enc = encodePayload(payload);
  if (enc.length > maxLen - 60) {
    payload.p = payload.p.map((s) => (s.length > 120 ? s.slice(0, 117) + "…" : s));
    enc = encodePayload(payload);
  }
  if (enc.length > maxLen - 60) payload.p = [];
  return payload;
}

export function encodePayload(p: MFPayload): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(p));
}

export function decodePayload(s: string): MFPayload | null {
  try {
    let raw = s;
    try {
      raw = decodeURIComponent(s);
    } catch {}
    const json = LZString.decompressFromEncodedURIComponent(raw.replace(/ /g, "+"));
    if (!json) return null;
    const p = JSON.parse(json) as MFPayload;
    if (!p || typeof p.t !== "string" || !Array.isArray(p.i)) return null;
    return p;
  } catch {
    return null;
  }
}

export function exportUrl(r: Recipe, origin: string): string {
  return `${origin}/r/${encodePayload(toPayload(r))}`;
}

export function jsonLd(p: MFPayload) {
  const [kcal, protein, fat, carbs, fiber] = p.n;
  return {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: p.t,
    recipeYield: `${p.s} ${p.s === 1 ? "Portion" : "Portionen"}`,
    recipeIngredient: p.i.map(([g, name]) => `${g} g ${name}`),
    recipeInstructions: p.p.map((text) => ({ "@type": "HowToStep", text })),
    ...(p.img ? { image: p.img } : {}),
    nutrition: {
      "@type": "NutritionInformation",
      servingSize: "1 Portion",
      calories: `${kcal} kcal`,
      proteinContent: `${protein} g`,
      fatContent: `${fat} g`,
      carbohydrateContent: `${carbs} g`,
      fiberContent: `${fiber} g`,
    },
  };
}

export function recipeAsText(r: Recipe): string {
  const m = recipeMacros(r).perServing;
  const lines = [
    r.title,
    `${r.servings} ${r.servings === 1 ? "Portion" : "Portionen"}`,
    "",
    "Zutaten:",
    ...r.ingredients.map((i) => `${Math.round(i.grams)} g ${i.food?.name?.replace(/,\s*(roh|ungekocht)$/i, "") ?? i.name}`),
    "",
    "Pro Portion:",
    `${Math.round(m.kcal)} kcal · ${Math.round(m.protein)} g Protein · ${Math.round(m.carbs)} g KH · ${Math.round(m.fat)} g Fett · ${Math.round(m.fiber)} g Ballaststoffe`,
  ];
  if (r.steps.length) lines.push("", "Zubereitung:", ...r.steps.map((s, i) => `${i + 1}. ${s}`));
  return lines.join("\n");
}
