import { BASE_FOODS, BASE_BY_ID, CUP_G, hasVariants, variantOf, type BaseFood } from "./foods-base";
import type { ParsedIngredient } from "./parser";
import type { CustomFood, FoodRef, Ingredient, Macros, Recipe } from "./types";
import { ZERO } from "./types";
import { toGrams } from "./units";
import { uid } from "./util";

export function normKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[()[\]{}.,;:!?"'„“”%]/g, " ")
    .replace(/\b(gekocht(?:e[rsn]?)?|gegart(?:e[rsn]?)?|cooked|roh(?:e[rsn]?)?|ungekocht(?:e[rsn]?)?|uncooked|raw|dry|trocken(?:e[rsn]?)?|frisch(?:e[rsn]?)?|fresh|große?n?|kleine?n?|mittelgroße?n?|large|small|medium|bio|organic|tk|frozen|gehackt(?:e[rsn]?)?|gewürfelt(?:e[rsn]?)?|chopped|diced|minced|sliced|grated|gerieben(?:e[rsn]?)?|fein(?:e[rsn]?)?|reife?n?)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type MatchContext = {
  mappings: Map<string, FoodRef>;
  customFoods: CustomFood[];
  unitOverrides?: Record<string, number>;
};

export function baseToRef(f: BaseFood): FoodRef {
  return { source: "base", id: f.id, name: f.name, per100: f.per100, pieceG: f.pieceG, state: f.state };
}

export function customToRef(f: CustomFood): FoodRef {
  return { source: "custom", id: f.id, name: f.name, per100: f.per100, pieceG: f.pieceG };
}

function singular(w: string): string[] {
  const out = [w];
  if (w.endsWith("en")) out.push(w.slice(0, -2), w.slice(0, -1));
  else if (w.endsWith("n") || w.endsWith("s") || w.endsWith("e")) out.push(w.slice(0, -1));
  return out;
}

/** Score how well a base food matches a normalised name (0 = no match). */
function scoreBase(f: BaseFood, key: string, words: string[], fullKey?: string): number {
  let best = 0;
  for (const s of f.syn) {
    if (fullKey && s === fullKey) return 110;
    if (s === key) return 100;
    if (fullKey && fullKey !== key && new RegExp(`(^|\\s)${escapeRe(s)}(?:s|n|en|e|es)?($|\\s)`).test(fullKey)) best = Math.max(best, 52 + s.length);
    if (key.length >= 3 && new RegExp(`(^|\\s)${escapeRe(s)}(?:s|n|en|e|es)?($|\\s)`).test(key)) best = Math.max(best, 50 + s.length);
    else if (s.length >= 4 && key.includes(s)) best = Math.max(best, 30 + s.length); // compound: "hähnchenbrustfilets" includes "hähnchenbrust"
    else if (words.some((w) => singular(w).includes(s))) best = Math.max(best, 45 + s.length);
  }
  return best;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function searchBase(query: string, limit = 20): BaseFood[] {
  const key = normKey(query);
  if (!key) return BASE_FOODS.slice(0, limit);
  const words = key.split(" ");
  return BASE_FOODS.map((f) => {
    let s = scoreBase(f, key, words);
    if (!s && f.syn.some((x) => x.startsWith(key))) s = 20;
    if (!s && f.name.toLowerCase().includes(key)) s = 15;
    if (!s && f.syn.some((x) => x.includes(key))) s = 10;
    return { f, s };
  })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.f);
}

export function matchFood(
  name: string,
  state: "raw" | "cooked" | null,
  ctx: MatchContext,
): { food: FoodRef | null; confident: boolean; askState: boolean } {
  const key = normKey(name);
  // 1. learned mapping
  const mapped = ctx.mappings.get(key);
  if (mapped) {
    let food = mapped;
    if (food.source === "base" && state && food.state && food.state !== state) {
      const v = variantOf(food.id, state);
      if (v) food = baseToRef(v);
    }
    return { food, confident: true, askState: false };
  }
  // 2. custom foods by name
  const custom = ctx.customFoods.find((c) => normKey(c.name) === key);
  if (custom) return { food: customToRef(custom), confident: true, askState: false };

  // 3. base list
  const words = key.split(" ").filter(Boolean);
  const fullKey = name.toLowerCase().replace(/[()[\]{}.,;:!?"'„“”%]/g, " ").replace(/\s+/g, " ").trim();
  let best: BaseFood | null = null;
  let bestScore = 0;
  for (const f of BASE_FOODS) {
    // prefer raw variant when no state given; cooked only if asked
    const s = scoreBase(f, key, words, fullKey) - (f.state === "cooked" ? 1 : 0);
    if (s > bestScore) {
      best = f;
      bestScore = s;
    }
  }
  if (!best) return { food: null, confident: false, askState: false };
  let askState = false;
  if (best.state) {
    if (state && best.state !== state) {
      const v = variantOf(best.id, state);
      if (v) best = v;
    } else if (!state && hasVariants(best.id)) {
      askState = true;
      // default to the raw variant
      if (best.state === "cooked") best = variantOf(best.id, "raw") ?? best;
    }
  }
  return { food: baseToRef(best), confident: bestScore >= 50, askState };
}

export function gramsFor(
  amount: number | null,
  unit: string | null,
  food: FoodRef | null,
  overrides: Record<string, number> = {},
  gramsHint: number | null = null,
): { grams: number; guess: boolean } {
  if (gramsHint != null) return { grams: gramsHint, guess: false };
  if (amount == null) {
    // no quantity ("Salz und Pfeffer"): tiny default for spices, else 0
    return { grams: 0, guess: true };
  }
  const base = food?.source === "base" ? BASE_BY_ID.get(food.id) : undefined;
  const ov = food && unit ? overrides[`${food.id}|${unit}`] : undefined;
  return toGrams(amount, unit, {
    pieceG: food?.pieceG ?? base?.pieceG,
    elG: base?.elG,
    cupG: base ? CUP_G[base.id] ?? CUP_G[base.group] : undefined,
    override: ov,
    foodId: food?.id,
  });
}

export function resolveIngredient(p: ParsedIngredient, ctx: MatchContext): Ingredient {
  const { food, confident, askState } = matchFood(p.name, p.state, ctx);
  const { grams, guess } = gramsFor(p.amount, p.unit, food, ctx.unitOverrides, p.gramsHint);
  return {
    id: uid(),
    raw: p.raw,
    name: p.name,
    amount: p.amount,
    unit: p.unit,
    grams: Math.round(grams * 10) / 10,
    pieces: p.unit === "Stück" && p.amount != null ? p.amount : undefined,
    food,
    uncertain: p.uncertain || !confident || guess || !food || askState,
    askState,
  };
}

export function macrosOfIngredient(ing: Ingredient): Macros {
  if (!ing.food) return { ...ZERO };
  const f = ing.grams / 100;
  const m = ing.food.per100;
  return {
    kcal: m.kcal * f,
    protein: m.protein * f,
    carbs: m.carbs * f,
    fat: m.fat * f,
    fiber: m.fiber * f,
  };
}

export function addMacros(a: Macros, b: Macros, factor = 1): Macros {
  return {
    kcal: a.kcal + b.kcal * factor,
    protein: a.protein + b.protein * factor,
    carbs: a.carbs + b.carbs * factor,
    fat: a.fat + b.fat * factor,
    fiber: a.fiber + b.fiber * factor,
  };
}

export function scaleMacros(m: Macros, f: number): Macros {
  return { kcal: m.kcal * f, protein: m.protein * f, carbs: m.carbs * f, fat: m.fat * f, fiber: m.fiber * f };
}

export function computedTotal(ings: Ingredient[]): Macros {
  return ings.reduce((acc, i) => addMacros(acc, macrosOfIngredient(i)), { ...ZERO });
}

export function totalGrams(ings: Ingredient[]): number {
  return ings.reduce((s, i) => s + (i.grams || 0), 0);
}

/** Effective per-serving macros: creator values win if present. */
export function perServing(r: Pick<Recipe, "creatorMacros" | "ingredients" | "servings">): Macros {
  if (r.creatorMacros) return r.creatorMacros;
  return scaleMacros(computedTotal(r.ingredients), 1 / Math.max(r.servings || 1, 0.1));
}

export function recipeMacros(r: Recipe) {
  const ps = perServing(r);
  const total = scaleMacros(ps, r.servings || 1);
  const g = totalGrams(r.ingredients);
  const per100 = g > 0 ? scaleMacros(total, 100 / g) : null;
  return { perServing: ps, total, per100, source: r.creatorMacros ? "creator" : "computed" as "creator" | "computed" };
}

export function proteinPer100kcal(m: Macros): number {
  return m.kcal > 0 ? (m.protein / m.kcal) * 100 : 0;
}

export function round(m: Macros): Macros {
  return {
    kcal: Math.round(m.kcal),
    protein: Math.round(m.protein),
    carbs: Math.round(m.carbs),
    fat: Math.round(m.fat),
    fiber: Math.round(m.fiber),
  };
}
