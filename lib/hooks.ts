"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { db, DEFAULT_SETTINGS } from "./db";
import type { MatchContext } from "./nutrition";
import type { FoodRef, Recipe, Settings } from "./types";

export function useRecipes(): Recipe[] | undefined {
  return useLiveQuery(() => db.recipes.toArray(), []);
}

export function useRecipeMap(): Map<string, Recipe> {
  const recipes = useRecipes();
  return useMemo(() => new Map((recipes ?? []).map((r) => [r.id, r])), [recipes]);
}

export function useRecipe(id: string): Recipe | undefined | null {
  return useLiveQuery(async () => (await db.recipes.get(id)) ?? null, [id]);
}

export function useSettings(): Settings {
  const s = useLiveQuery(() => db.settings.get("main"), []);
  return useMemo(() => ({ ...DEFAULT_SETTINGS, ...(s ?? {}) }), [s]);
}

export function usePlanRange(from: string, to: string) {
  return useLiveQuery(() => db.plan.where("date").between(from, to, true, true).toArray(), [from, to]);
}

export async function loadMatchContext(): Promise<MatchContext> {
  const [mappings, customFoods, settings] = await Promise.all([db.mappings.toArray(), db.foods.toArray(), db.settings.get("main")]);
  return {
    mappings: new Map(mappings.map((m) => [m.key, m.food as FoodRef])),
    customFoods,
    unitOverrides: settings?.unitOverrides ?? {},
  };
}
