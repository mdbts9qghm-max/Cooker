import Dexie, { type Table } from "dexie";
import type { CustomFood, FoodMapping, PlanEntry, Recipe, Settings, ShoppingState, Template } from "./types";
import { DEFAULT_GOALS } from "./types";

export class RezeptDB extends Dexie {
  recipes!: Table<Recipe, string>;
  plan!: Table<PlanEntry, string>;
  templates!: Table<Template, string>;
  foods!: Table<CustomFood, string>;
  mappings!: Table<FoodMapping, string>;
  shopping!: Table<ShoppingState, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super("rezeptbuch");
    this.version(1).stores({
      recipes: "id, title, createdAt, updatedAt, favorite, sample",
      plan: "id, date, recipeId, [date+slot]",
      templates: "id, createdAt",
      foods: "id, name, barcode",
      mappings: "key",
      shopping: "week",
      settings: "id",
    });
  }
}

export const db = new RezeptDB();

export const DEFAULT_SETTINGS: Settings = {
  id: "main",
  goals: DEFAULT_GOALS,
  goalsUpdatedAt: Date.now(),
  dayGoals: [null, null, null, null, null, null, null],
  pantry: ["Salz", "Pfeffer", "Olivenöl", "Wasser"],
  aisles: {},
  unitOverrides: {},
  lastBackupAt: null,
  backupSnoozeUntil: null,
};

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get("main");
  if (s) return { ...DEFAULT_SETTINGS, ...s };
  const fresh = { ...DEFAULT_SETTINGS, goalsUpdatedAt: Date.now() };
  await db.settings.put(fresh);
  return fresh;
}

export async function updateSettings(patch: Partial<Settings>) {
  const s = await getSettings();
  await db.settings.put({ ...s, ...patch, id: "main" });
}
