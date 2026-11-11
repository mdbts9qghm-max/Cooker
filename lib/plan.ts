import { db, getSettings } from "./db";
import { addMacros, perServing, scaleMacros } from "./nutrition";
import type { Goals, Macros, PlanEntry, Recipe, Settings, Slot } from "./types";
import { ZERO } from "./types";
import { addDays, mondayOf, today, uid, weekDays, weekdayIndex } from "./util";

export function snapshotOf(r: Recipe) {
  return {
    title: r.title,
    servings: r.servings,
    perServing: perServing(r),
    ingredients: r.ingredients,
    photo: r.photos[0],
  };
}

/** Resolve an entry to title/macros, preferring a frozen snapshot. */
export function entryInfo(e: PlanEntry, recipes: Map<string, Recipe>) {
  const r = recipes.get(e.recipeId);
  if (e.snapshot) {
    return {
      title: e.snapshot.title,
      photo: e.snapshot.photo,
      macros: scaleMacros(e.snapshot.perServing, e.servings),
      ingredients: e.snapshot.ingredients,
      baseServings: e.snapshot.servings,
      recipe: r,
      frozen: true,
    };
  }
  if (!r) return null;
  return {
    title: r.title,
    photo: r.photos[0],
    macros: scaleMacros(perServing(r), e.servings),
    ingredients: r.ingredients,
    baseServings: r.servings,
    recipe: r,
    frozen: false,
  };
}

export function dayTotals(entries: PlanEntry[], recipes: Map<string, Recipe>): Macros {
  return entries.reduce((acc, e) => {
    const info = entryInfo(e, recipes);
    return info ? addMacros(acc, info.macros) : acc;
  }, { ...ZERO });
}

export function goalsFor(date: string, s: Settings): Goals {
  return s.dayGoals?.[weekdayIndex(date)] ?? s.goals;
}

/**
 * Freeze past weeks: entries whose week ended before the current week get a snapshot,
 * so later recipe edits don't rewrite history.
 */
export async function freezePastWeeks() {
  const currentMonday = mondayOf(today());
  const past = await db.plan.where("date").below(currentMonday).toArray();
  const toFreeze = past.filter((e) => !e.snapshot);
  if (!toFreeze.length) return;
  const recipes = await db.recipes.bulkGet([...new Set(toFreeze.map((e) => e.recipeId))]);
  const map = new Map(recipes.filter(Boolean).map((r) => [r!.id, r!]));
  await db.transaction("rw", db.plan, async () => {
    for (const e of toFreeze) {
      const r = map.get(e.recipeId);
      if (r) await db.plan.update(e.id, { snapshot: snapshotOf(r) });
    }
  });
}

export async function addToPlan(date: string, slot: Slot, recipeId: string, servings = 1) {
  const entry: PlanEntry = { id: uid(), date, slot, recipeId, servings };
  if (date < mondayOf(today())) {
    const r = await db.recipes.get(recipeId);
    if (r) entry.snapshot = snapshotOf(r);
  }
  await db.plan.add(entry);
  return entry;
}

export async function copyWeek(fromMonday: string, toMonday: string) {
  const days = weekDays(fromMonday);
  const entries = await db.plan.where("date").between(days[0], days[6], true, true).toArray();
  const offset = Math.round((new Date(toMonday).getTime() - new Date(fromMonday).getTime()) / 86400000);
  await db.plan.bulkAdd(
    entries.map((e) => ({ id: uid(), date: addDays(e.date, offset), slot: e.slot, recipeId: e.recipeId, servings: e.servings })),
  );
  return entries.length;
}

export async function saveTemplate(monday: string, name: string) {
  const days = weekDays(monday);
  const entries = await db.plan.where("date").between(days[0], days[6], true, true).toArray();
  await db.templates.add({
    id: uid(),
    name,
    createdAt: Date.now(),
    entries: entries.map((e) => ({ day: days.indexOf(e.date), slot: e.slot, recipeId: e.recipeId, servings: e.servings })),
  });
}

export async function applyTemplate(templateId: string, monday: string) {
  const t = await db.templates.get(templateId);
  if (!t) return 0;
  const existing = new Set((await db.recipes.toCollection().primaryKeys()) as string[]);
  const valid = t.entries.filter((e) => existing.has(e.recipeId));
  await db.plan.bulkAdd(
    valid.map((e) => ({ id: uid(), date: addDays(monday, e.day), slot: e.slot, recipeId: e.recipeId, servings: e.servings })),
  );
  return valid.length;
}

/** Meal prep: spread N portions over several days in one slot */
export async function mealPrep(recipeId: string, startDate: string, days: number, slot: Slot, servingsPerDay = 1) {
  const entries: PlanEntry[] = Array.from({ length: days }, (_, i) => ({
    id: uid(),
    date: addDays(startDate, i),
    slot,
    recipeId,
    servings: servingsPerDay,
  }));
  await db.plan.bulkAdd(entries);
}

export async function planCounts(): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  await db.plan.each((e) => m.set(e.recipeId, (m.get(e.recipeId) ?? 0) + 1));
  return m;
}

export { getSettings };
