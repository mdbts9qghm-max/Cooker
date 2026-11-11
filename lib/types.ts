export type Macros = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

export const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

export type FoodSource = "base" | "custom" | "off" | "none";

/** Snapshot of the food an ingredient is linked to (kept so it works offline). */
export type FoodRef = {
  source: FoodSource;
  id: string;
  name: string;
  per100: Macros;
  /** grams per piece (Stück), if known */
  pieceG?: number;
  /** "raw" | "cooked" if this food has both variants in the base list */
  state?: "raw" | "cooked";
};

export type Ingredient = {
  id: string;
  /** Original line as parsed (for reference) */
  raw: string;
  name: string;
  /** amount in the original unit */
  amount: number | null;
  unit: string | null;
  /** amount converted to grams (or ml ≈ g) */
  grams: number;
  /** piece count when the unit is "Stück" (for the shopping list) */
  pieces?: number;
  food: FoodRef | null;
  uncertain?: boolean;
  /** true when the food exists raw + cooked and the caption didn't say which */
  askState?: boolean;
};

export type Recipe = {
  id: string;
  title: string;
  photos: string[]; // data URLs (compressed JPEG)
  tags: string[];
  notes: string;
  servings: number;
  ingredients: Ingredient[];
  steps: string[];
  /** Macros stated by the creator, per serving. Take precedence. */
  creatorMacros: Macros | null;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  sample?: boolean;
  /** "tiktok" | "instagram" | "text" | "manual" | "ocr" */
  origin?: string;
};

export type Slot = "breakfast" | "lunch" | "dinner";
export const SLOTS: Slot[] = ["breakfast", "lunch", "dinner"];
export const SLOT_LABEL: Record<Slot, string> = {
  breakfast: "Frühstück",
  lunch: "Mittag",
  dinner: "Abend",
};

export type PlanSnapshot = {
  title: string;
  servings: number;
  perServing: Macros;
  ingredients: Ingredient[];
  photo?: string;
};

export type PlanEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  slot: Slot;
  recipeId: string;
  servings: number;
  /** filled when the week lies in the past: frozen values */
  snapshot?: PlanSnapshot;
};

export type Template = {
  id: string;
  name: string;
  /** entries relative to Monday (dayIndex 0..6) */
  entries: { day: number; slot: Slot; recipeId: string; servings: number }[];
  createdAt: number;
};

export type CustomFood = {
  id: string;
  name: string;
  per100: Macros;
  pieceG?: number;
  /** if the user entered values per piece */
  perPiece?: boolean;
  brand?: string;
  barcode?: string;
  createdAt: number;
};

/** Learned mapping: ingredient name (normalised) -> food */
export type FoodMapping = {
  key: string;
  food: FoodRef;
};

export type ShoppingState = {
  week: string; // monday date
  checked: string[];
  have: string[];
  manual: { id: string; text: string; checked: boolean }[];
};

export type Goals = Macros;

export type Settings = {
  id: "main";
  goals: Goals;
  goalsUpdatedAt: number;
  /** optional per-weekday override, index 0 = Monday */
  dayGoals: (Goals | null)[];
  pantry: string[];
  aisles: Record<string, string>;
  unitOverrides: Record<string, number>; // "food|unit" -> grams
  lastBackupAt: number | null;
  backupSnoozeUntil: number | null;
  persisted?: boolean;
  onboarded?: boolean;
};

export const DEFAULT_GOALS: Goals = {
  kcal: 2275,
  protein: 149,
  fat: 75,
  carbs: 248,
  fiber: 30,
};

export const AISLES = [
  "Obst & Gemüse",
  "Fleisch & Fisch",
  "Kühlregal",
  "Trockenware",
  "Gewürze",
  "Sonstiges",
] as const;
