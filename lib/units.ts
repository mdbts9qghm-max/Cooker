/** Quantity & unit parsing (Deutsch + Englisch). */

const FRACTIONS: Record<string, number> = {
  "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75, "⅕": 0.2,
  "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875, "⅙": 1 / 6,
};
const FRAC_CHARS = Object.keys(FRACTIONS).join("");

/** Regex source for a single number: 1 | 1,5 | 1.5 | 1/2 | 1 1/2 | ½ | 1½ | 1 ½ */
const NUM = `(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:[.,]\\d+)?(?:\\s*[${FRAC_CHARS}])?|[${FRAC_CHARS}])`;
/** number or range "1-2", "1 – 2", "1 bis 2", "1 to 2" */
export const QTY_RE_SRC = `${NUM}(?:\\s*(?:-|–|bis|to|or|oder)\\s*${NUM})?`;

export function parseNumber(s: string): number | null {
  s = s.trim();
  if (!s) return null;
  let m = s.match(new RegExp(`^(\\d+)\\s*([${FRAC_CHARS}])$`));
  if (m) return +m[1] + FRACTIONS[m[2]];
  m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (m) return +m[1] + +m[2] / +m[3];
  m = s.match(/^(\d+)\/(\d+)$/);
  if (m) return +m[2] ? +m[1] / +m[2] : null;
  if (FRACTIONS[s] !== undefined) return FRACTIONS[s];
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Returns value (average for ranges) and whether it was a range. */
export function parseQuantity(s: string): { value: number; range: boolean } | null {
  const parts = s.split(/\s*(?:-|–|bis|to|or|oder)\s*/).filter(Boolean);
  if (parts.length === 2) {
    const a = parseNumber(parts[0]);
    const b = parseNumber(parts[1]);
    if (a != null && b != null) return { value: (a + b) / 2, range: true };
  }
  const v = parseNumber(s);
  return v == null ? null : { value: v, range: false };
}

/** canonical unit -> aliases */
const UNIT_ALIASES: Record<string, string[]> = {
  g: ["g", "gr", "gramm", "gram", "grams", "grammes"],
  kg: ["kg", "kilo", "kilogramm"],
  mg: ["mg"],
  ml: ["ml", "milliliter", "millilitre"],
  cl: ["cl"],
  dl: ["dl"],
  l: ["l", "liter", "litre", "liters"],
  EL: ["el", "esslöffel", "essl", "essl.", "tbsp", "tbsp.", "tbs", "tablespoon", "tablespoons", "tb"],
  TL: ["tl", "teelöffel", "teel", "teel.", "tsp", "tsp.", "teaspoon", "teaspoons"],
  Tasse: ["tasse", "tassen", "cup", "cups", "becher", "becherchen"],
  Stück: ["stück", "stk", "stk.", "st.", "piece", "pieces", "pc", "pcs", "stücke", "whole"],
  Prise: ["prise", "prisen", "pinch", "pinches", "messerspitze", "msp", "msp."],
  Scheibe: ["scheibe", "scheiben", "slice", "slices"],
  Dose: ["dose", "dosen", "can", "cans", "tin", "tins", "glas"],
  oz: ["oz", "ounce", "ounces"],
  lb: ["lb", "lbs", "pound", "pounds"],
  Bund: ["bund", "bunch", "bündel"],
  Handvoll: ["handvoll", "handful", "handfuls", "hand voll"],
  Packung: ["packung", "packungen", "pck", "pck.", "pkg", "päckchen", "pack", "package", "packet", "beutel"],
  Zehe: ["zehe", "zehen", "clove", "cloves"],
  Spritzer: ["spritzer", "schuss", "dash", "splash"],
  Messlöffel: ["scoop", "scoops", "messlöffel"],
};

const ALIAS_TO_UNIT = new Map<string, string>();
for (const [unit, aliases] of Object.entries(UNIT_ALIASES)) {
  for (const a of aliases) ALIAS_TO_UNIT.set(a, unit);
}

/** sorted longest first so "esslöffel" wins over "el" */
const ALIAS_LIST = [...ALIAS_TO_UNIT.keys()].sort((a, b) => b.length - a.length);
export const UNIT_RE_SRC = `(?:${ALIAS_LIST.map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`;

export function normalizeUnit(s: string | null | undefined): string | null {
  if (!s) return null;
  return ALIAS_TO_UNIT.get(s.trim().toLowerCase()) ?? null;
}

export const UNITS_FOR_UI = ["g", "ml", "Stück", "EL", "TL", "Tasse", "Prise", "Scheibe", "Dose", "Packung", "Bund", "Handvoll", "Zehe", "kg", "l", "oz", "lb"];

/**
 * Convert an amount to grams.
 * pieceG / elG come from the food (if known); override from the user wins.
 * Returns grams and whether it was a guess.
 */
export function toGrams(
  amount: number,
  unit: string | null,
  opts: { pieceG?: number; elG?: number; override?: number; foodId?: string } = {},
): { grams: number; guess: boolean } {
  if (opts.override && unit && !["g", "kg", "mg", "ml", "l", "cl", "dl", "oz", "lb"].includes(unit)) {
    return { grams: amount * opts.override, guess: false };
  }
  const el = opts.elG ?? 15;
  switch (unit) {
    case "g": return { grams: amount, guess: false };
    case "kg": return { grams: amount * 1000, guess: false };
    case "mg": return { grams: amount / 1000, guess: false };
    case "ml": return { grams: amount, guess: false };
    case "cl": return { grams: amount * 10, guess: false };
    case "dl": return { grams: amount * 100, guess: false };
    case "l": return { grams: amount * 1000, guess: false };
    case "oz": return { grams: amount * 28.35, guess: false };
    case "lb": return { grams: amount * 453.6, guess: false };
    case "EL": return { grams: amount * el, guess: !opts.elG };
    case "TL": return { grams: (amount * el) / 3, guess: !opts.elG };
    case "Tasse": return { grams: amount * el * 16, guess: true };
    case "Prise": return { grams: amount * 0.5, guess: false };
    case "Spritzer": return { grams: amount * 5, guess: true };
    case "Zehe": return { grams: amount * (opts.pieceG && opts.pieceG < 10 ? opts.pieceG : 4), guess: false };
    case "Scheibe": return { grams: amount * (opts.pieceG && opts.pieceG <= 60 ? opts.pieceG : 25), guess: !opts.pieceG };
    case "Dose": {
      const id = opts.foodId ?? "";
      const g = id.includes("thunfisch") ? 130 : /bohnen|kichererbsen|mais|linsen/.test(id) ? 240 : 400;
      return { grams: amount * g, guess: true };
    }
    case "Bund": return { grams: amount * 30, guess: true };
    case "Handvoll": return { grams: amount * 30, guess: true };
    case "Packung": return { grams: amount * 200, guess: true };
    case "Messlöffel": return { grams: amount * 30, guess: true };
    case "Stück":
    case null:
    default:
      if (opts.pieceG) return { grams: amount * opts.pieceG, guess: false };
      return { grams: amount * 100, guess: true };
  }
}

export function fmtAmount(n: number | null | undefined): string {
  if (n == null) return "";
  if (Math.abs(n - Math.round(n)) < 0.01) return String(Math.round(n));
  const frac: [number, string][] = [[0.25, "¼"], [0.5, "½"], [0.75, "¾"], [1 / 3, "⅓"], [2 / 3, "⅔"]];
  const whole = Math.floor(n);
  const rest = n - whole;
  for (const [v, ch] of frac) {
    if (Math.abs(rest - v) < 0.02) return whole ? `${whole}${ch}` : ch;
  }
  return n.toLocaleString("de-DE", { maximumFractionDigits: 1 });
}
