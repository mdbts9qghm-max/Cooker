import { BASE_BY_ID } from "./foods-base";
import { normKey } from "./nutrition";
import type { Ingredient, PlanEntry, Recipe } from "./types";
import { entryInfo } from "./plan";

export type ShopItem = {
  key: string;
  name: string;
  grams: number;
  pieces: number;
  aisle: string;
  recipes: string[];
};

export function itemKey(ing: Ingredient): string {
  if (ing.food && ing.food.source !== "none") return `${ing.food.source}:${ing.food.id.replace(/-(r|c)$/, "")}`;
  return `name:${normKey(ing.name)}`;
}

export function displayName(ing: Ingredient): string {
  if (ing.food?.source === "base") {
    return ing.food.name.replace(/,\s*(roh|ungekocht|gekocht|gegart|gebraten)$/i, "");
  }
  return ing.food?.name ?? ing.name;
}

export function aisleFor(item: { key: string; name: string }, ing: Ingredient | undefined, learned: Record<string, string>): string {
  if (learned[item.key]) return learned[item.key];
  if (ing?.food?.source === "base") return BASE_BY_ID.get(ing.food.id)?.aisle ?? "Sonstiges";
  return "Sonstiges";
}

export function buildShoppingList(
  entries: PlanEntry[],
  recipes: Map<string, Recipe>,
  learnedAisles: Record<string, string>,
): ShopItem[] {
  const map = new Map<string, ShopItem>();
  for (const e of entries) {
    const info = entryInfo(e, recipes);
    if (!info) continue;
    const factor = e.servings / Math.max(info.baseServings || 1, 0.1);
    for (const ing of info.ingredients) {
      const key = itemKey(ing);
      let it = map.get(key);
      if (!it) {
        const name = displayName(ing);
        it = { key, name, grams: 0, pieces: 0, aisle: aisleFor({ key, name }, ing, learnedAisles), recipes: [] };
        map.set(key, it);
      }
      if (ing.unit === "Stück" && ing.pieces) it.pieces += ing.pieces * factor;
      else it.grams += (ing.grams || 0) * factor;
      if (!it.recipes.includes(info.title)) it.recipes.push(info.title);
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "de"));
}

export function fmtShopAmount(it: Pick<ShopItem, "grams" | "pieces">): string {
  const parts: string[] = [];
  if (it.pieces > 0) {
    const p = Math.ceil(it.pieces * 2) / 2;
    parts.push(`${p.toLocaleString("de-DE")} Stück`);
  }
  if (it.grams > 0) {
    parts.push(it.grams >= 1000 ? `${(Math.round(it.grams / 100) / 10).toLocaleString("de-DE")} kg` : `${Math.round(it.grams)} g`);
  }
  return parts.join(" + ");
}

export function isPantry(name: string, pantry: string[]): boolean {
  const n = normKey(name);
  return pantry.some((p) => {
    const k = normKey(p);
    return k && (n === k || n.startsWith(k + " ") || n.split(" ").includes(k));
  });
}
