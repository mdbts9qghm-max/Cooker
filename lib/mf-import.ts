/**
 * Import aus dem MacroFactor-Datenexport (Excel, Blatt "Recipes").
 *
 * - Makros: MacroFactor liefert Summen fürs ganze Rezept -> geteilt durch die Portionen,
 *   als "Creator-Makros" übernommen (exakt die Werte aus MacroFactor).
 * - Zutaten: Die Beschreibung ist oft die Original-Caption mit echten Mengen und wird bevorzugt.
 *   Sonst die MacroFactor-Zutatenliste; deren Klammer-Angaben sind meist nur Einheiten
 *   ("3 oz", "1 packet"), verlässlich sind nur Gramm/Milliliter.
 * - Schritte: Spalten "Step 1" … "Step N", sonst aus der Beschreibung.
 */
import { resolveIngredient, type MatchContext } from "./nutrition";
import { parseRecipeText, type ParsedIngredient } from "./parser";
import type { Ingredient, Macros, Recipe } from "./types";
import { uid } from "./util";
import { readXlsx } from "./xlsx";

export type MFRecipe = {
  name: string;
  servings: number;
  ingredients: string[];
  description: string;
  steps: string[];
  /** totals for the whole recipe */
  totals: Macros;
};

const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(+v) ? +v : 0);

export function readMacroFactorExport(data: Uint8Array): MFRecipe[] {
  const sheets = readXlsx(data);
  const sheet = sheets.find((s) => /recipe|rezept/i.test(s.name)) ?? sheets.find((s) => s.rows[0]?.includes("Recipe Name"));
  if (!sheet) throw new Error("In der Datei wurde kein Blatt „Recipes“ gefunden. Ist das ein MacroFactor-Export?");
  const [head, ...rows] = sheet.rows;
  const col = (name: string) => head.findIndex((h) => typeof h === "string" && h.trim().toLowerCase() === name.toLowerCase());
  const iName = col("Recipe Name");
  if (iName < 0) throw new Error("Spalte „Recipe Name“ fehlt – ist das ein MacroFactor-Export?");
  const iServ = col("Serving Qty");
  const iIng = col("Ingredients");
  const iDesc = col("Description");
  const iKcal = col("Calories (kcal)");
  const iP = col("Protein (g)");
  const iF = col("Fat (g)");
  const iC = col("Carbs (g)");
  const iFib = col("Fiber (g)");
  const stepCols = head.map((h, i) => (typeof h === "string" && /^step \d+$/i.test(h.trim()) ? i : -1)).filter((i) => i >= 0);

  return rows
    .filter((r) => typeof r[iName] === "string" && (r[iName] as string).trim())
    .map((r) => ({
      name: (r[iName] as string).trim(),
      servings: Math.max(num(r[iServ]) || 1, 0.1),
      ingredients: String(r[iIng] ?? "")
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
      description: String(r[iDesc] ?? "").trim(),
      steps: stepCols.map((i) => String(r[i] ?? "").trim()).filter(Boolean),
      totals: { kcal: num(r[iKcal]), protein: num(r[iP]), fat: num(r[iF]), carbs: num(r[iC]), fiber: num(r[iFib]) },
    }));
}

/** Zusammengeklebte Beschreibungen ("450g Magerquark300g Dinkelmehl", "•"-Listen) in Zeilen aufteilen. */
export function splitFlatDescription(s: string): string {
  const flat = (s.match(/\n/g)?.length ?? 0) < 3;
  let t = s.replace(/\r/g, "");
  if (flat) {
    // glued words: "TomatensauceSalami" -> new line; "Emmentaler120 Käse" -> new line
    t = t.replace(/(\p{Ll})(?=\p{Lu}\p{Ll})/gu, "$1\n").replace(/(\p{L})(?=\d+(?:[.,]\d+)?\s?\p{L})/gu, "$1\n");
  }
  return t
    .replace(/\s*[•▪︎◦●]\s*/g, "\n- ")
    .replace(/⬇️|👇/g, "\n")
    .replace(/(\p{L}|\))(?=\d+(?:[.,]\d+)?\s?(?:g|ml|kg|l|TL|EL|Stk)\b)/gu, "$1\n")
    .replace(/([\p{Ll})!])(?=(?:Zutaten|Zubereitung|Nährwerte|Pro Portion|Topping|Sauce|Soße|Burgersoße|Keksboden|Dip|Füllung|Teig)(?:\p{Lu}|[\s:(]|$))/gu, "$1\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** "Sticky Rice, Raw (200 g)" -> name + Menge; Einheiten-Labels wie "(1 packet)" ergeben keine Menge. */
export function parseMFIngredient(line: string): ParsedIngredient {
  const m = line.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  const name = (m ? m[1] : line).replace(/,\s*(raw|dry|fresh|cooked|ground)\b.*$/i, (x) => x).trim();
  const label = m?.[2] ?? "";
  const g = label.match(/^(\d+(?:[.,]\d+)?)\s*(g|ml)$/i);
  const state = /\b(raw|dry|uncooked)\b/i.test(line) ? "raw" : /\bcooked\b/i.test(line) ? "cooked" : null;
  if (g) {
    const amount = parseFloat(g[1].replace(",", "."));
    return { raw: line, name, amount, unit: g[2].toLowerCase(), gramsHint: null, state, uncertain: false };
  }
  // natürliche Stück-Einheiten sind echte Anzahlen: "(4 egg)", "(3 banana)", "(1 clove)", "(1 scoop)"
  const count = label.match(/^(\d+(?:[.,]\d+)?)\s*(?:large |medium |small |jumbo )?(eggs?|egg whites?|bananas?|buns?|sheets?|cloves?|scoops?|wraps?|tortillas?)\b/i);
  if (count) {
    const n = parseFloat(count[1].replace(",", "."));
    const unit = /scoop/i.test(count[2]) ? "Messlöffel" : /clove/i.test(count[2]) ? "Zehe" : "Stück";
    return { raw: line, name, amount: n, unit, gramsHint: null, state, uncertain: true };
  }
  return { raw: line, name, amount: null, unit: null, gramsHint: null, state, uncertain: true };
}

function tagsFromName(name: string): { title: string; tags: string[] } {
  const m = name.match(/^([^/]{3,20})\/\s*(.+)$/);
  if (!m) return { title: name, tags: [] };
  const raw = m[1].trim();
  const tag = /fr[üu]h?st[üu]ck|breakfast/i.test(raw) ? "Frühstück" : /mittag|lunch/i.test(raw) ? "Mittag" : /abend|dinner/i.test(raw) ? "Abend" : raw[0].toUpperCase() + raw.slice(1).toLowerCase();
  return { title: m[2].trim(), tags: [tag] };
}

export type MFPreview = {
  mf: MFRecipe;
  recipe: Recipe;
  /** where the ingredient amounts came from */
  ingredientSource: "description" | "macrofactor";
  missingAmounts: number;
};

export function mfToRecipe(mf: MFRecipe, ctx: MatchContext): MFPreview {
  const { title, tags } = tagsFromName(mf.name);
  const desc = splitFlatDescription(mf.description);
  const parsed = desc ? parseRecipeText(desc) : null;
  const descIngs = (parsed?.ingredients ?? []).filter((i) => i.amount != null || i.gramsHint != null);
  const useDesc = descIngs.length >= 3 && descIngs.length >= mf.ingredients.length * 0.5;

  const ingredients: Ingredient[] = useDesc
    ? parsed!.ingredients.map((p) => resolveIngredient(p, ctx))
    : mf.ingredients.map((l) => resolveIngredient(parseMFIngredient(l), ctx));

  const s = mf.servings;
  const r1 = (x: number) => Math.round(x * 10) / 10;
  const now = Date.now();
  const lower = `${title} ${mf.description}`.toLowerCase();
  const autoTags = [...tags];
  if (/high ?protein|protein/.test(lower) && !autoTags.includes("High Protein")) autoTags.push("High Protein");
  if (/meal ?prep/.test(lower)) autoTags.push("Meal Prep");

  const recipe: Recipe = {
    id: uid(),
    title,
    photos: [],
    tags: autoTags,
    notes: mf.description,
    servings: s,
    ingredients,
    steps: mf.steps.length ? mf.steps : parsed?.steps ?? [],
    creatorMacros: mf.totals.kcal > 0
      ? { kcal: Math.round(mf.totals.kcal / s), protein: r1(mf.totals.protein / s), carbs: r1(mf.totals.carbs / s), fat: r1(mf.totals.fat / s), fiber: r1(mf.totals.fiber / s) }
      : null,
    favorite: false,
    createdAt: now,
    updatedAt: now,
    origin: "macrofactor",
  };
  return {
    mf,
    recipe,
    ingredientSource: useDesc ? "description" : "macrofactor",
    missingAmounts: ingredients.filter((i) => !i.grams).length,
  };
}
