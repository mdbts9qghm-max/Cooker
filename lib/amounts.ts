/**
 * Mengen aus einer Zutatenliste (Screenshot, z. B. MacroFactor) lesen und
 * den Zutaten eines Rezepts zuordnen.
 *
 * MacroFactor zeigt pro Zutat: Name (1–4 Zeilen), darunter "300 g • 300g" oder
 * "0.5 onion • 55g" – die Zahl nach dem Punkt ist immer das Gewicht in Gramm.
 */
import { foldUmlauts } from "./nutrition";
import type { Ingredient } from "./types";
import { similarity } from "./util";

export type FoundAmount = { name: string; grams: number };

const RESET = /^(ingredients|zutaten|steps|schritte|instructions for|anleitung|no preparation|keine zubereitung)|\bservings?\b|\bportionen\b|^\d{1,2}:\d{2}$/i;
/** Zeile endet mit Gramm und enthält davor eine weitere Mengenangabe: "300 g- 300g", "0.5 onion + 55g", "1serving « 5g" */
const AMOUNT_END = /(\d+(?:[.,]\d+)?)\s*(g|ml)\s*$/i;

function cleanName(line: string): string {
  return line
    .replace(/^(?:[^\p{L}\s]{1,3}|\p{L}{1,2}[^\p{L}\s]?)\s+(?=[\p{Lu}\d(])/u, "") // Symbol-Reste: "@ ", "©) ", "= ", "ga "
    .replace(/^[^\p{L}\d]+/u, "")
    .trim();
}

export function parseAmountList(text: string): FoundAmount[] {
  const out: FoundAmount[] = [];
  let nameParts: string[] = [];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) continue;
    const end = line.match(AMOUNT_END);
    const before = end ? line.slice(0, end.index).trim() : "";
    const isAmount = !!end && (/\d/.test(before) || /serving|portion|stück|piece|onion|egg|slice|cup|tbsp|tsp|el|tl/i.test(before) || before === "");
    if (isAmount && nameParts.length) {
      const grams = parseFloat(end![1].replace(",", "."));
      const name = nameParts.join(" ").replace(/\s+-\s+/g, "-").replace(/-\s+(?=\p{Ll})/u, "-").trim();
      if (grams > 0 && grams < 5000) out.push({ name, grams });
      nameParts = [];
      continue;
    }
    if (isAmount) continue;
    if (RESET.test(line)) {
      nameParts = [];
      continue;
    }
    const n = cleanName(line);
    if (/\p{L}{2,}/u.test(n)) nameParts.push(n);
    if (nameParts.length > 4) nameParts.shift();
  }
  return out;
}

const norm = (s: string) =>
  foldUmlauts(s.toLowerCase())
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export type AmountMatch = { ingredientId: string; ingredientName: string; found: FoundAmount; score: number };

/** jede gefundene Menge der ähnlichsten Zutat zuordnen (jede Zutat höchstens einmal) */
export function matchAmounts(ings: Ingredient[], found: FoundAmount[]): { matches: AmountMatch[]; unmatched: FoundAmount[] } {
  const pairs: AmountMatch[] = [];
  for (const f of found) {
    const fn = norm(f.name);
    for (const i of ings) {
      const a = norm(i.name);
      let score = similarity(a, fn);
      if (a && fn && (a.includes(fn) || fn.includes(a))) score = Math.max(score, 0.85);
      if (score >= 0.55) pairs.push({ ingredientId: i.id, ingredientName: i.name, found: f, score });
    }
  }
  pairs.sort((x, y) => y.score - x.score);
  const usedIng = new Set<string>();
  const usedFound = new Set<FoundAmount>();
  const matches: AmountMatch[] = [];
  for (const p of pairs) {
    if (usedIng.has(p.ingredientId) || usedFound.has(p.found)) continue;
    usedIng.add(p.ingredientId);
    usedFound.add(p.found);
    matches.push(p);
  }
  const order = new Map(ings.map((i, k) => [i.id, k]));
  matches.sort((a, b) => order.get(a.ingredientId)! - order.get(b.ingredientId)!);
  return { matches, unmatched: found.filter((f) => !usedFound.has(f)) };
}

/** Titel aus der OCR-Titelleiste: Uhrzeit, Pfeil, Symbolreste entfernen */
export function cleanShotTitle(raw: string): string {
  return raw
    .split("\n")
    .map((l) => l.replace(/\b\d{1,2}:\d{2}\b/g, "").replace(/\b(5G|4G|LTE|wifi)\b/gi, "").replace(/^[^\p{L}\d]+/u, "").replace(/[^\p{L}\d!?)…]+$/u, "").trim())
    .filter((l) => /\p{L}{3,}/u.test(l))
    .sort((a, b) => b.length - a.length)[0] ?? "";
}

export type ShotInput = { index: number; title: string; text: string };
export type RecipeLike = { id: string; title: string; ingredients: Ingredient[] };
export type ShotAssignment = {
  recipe: RecipeLike;
  shots: number[];
  title: string;
  matches: AmountMatch[];
  unmatched: FoundAmount[];
};

/**
 * Screenshots den Rezepten zuordnen: Titel-Ähnlichkeit plus Anteil der Zutaten, die passen.
 * Screenshots ohne erkennbaren Titel (weitergescrollt) zählen nur über die Zutaten.
 */
export function assignShots(shots: ShotInput[], recipes: RecipeLike[]): { assigned: ShotAssignment[]; unassigned: ShotInput[] } {
  const byRecipe = new Map<string, { recipe: RecipeLike; shots: number[]; title: string; found: FoundAmount[] }>();
  const unassigned: ShotInput[] = [];
  for (const shot of shots) {
    const title = cleanShotTitle(shot.title);
    const found = parseAmountList(shot.text);
    if (!found.length) {
      unassigned.push(shot);
      continue;
    }
    let best: { r: RecipeLike; score: number } | null = null;
    for (const r of recipes) {
      const t = norm(title);
      const rt = norm(r.title);
      let ts = t && rt ? similarity(t, rt) : 0;
      if (t.length >= 6 && rt.length >= 6 && (rt.startsWith(t) || t.startsWith(rt) || rt.includes(t))) ts = Math.max(ts, 0.9);
      const { matches } = matchAmounts(r.ingredients, found);
      const ingShare = matches.length / Math.max(found.length, 1);
      const score = ts * 2 + ingShare * 1.5;
      if (!best || score > best.score) best = { r, score };
    }
    // mindestens: guter Titel ODER die meisten Zutaten passen
    if (!best || best.score < 1.3) {
      unassigned.push(shot);
      continue;
    }
    const cur = byRecipe.get(best.r.id) ?? { recipe: best.r, shots: [], title, found: [] };
    cur.shots.push(shot.index);
    if (!cur.title && title) cur.title = title;
    cur.found.push(...found);
    byRecipe.set(best.r.id, cur);
  }
  const assigned = [...byRecipe.values()].map((x) => {
    // überlappende Screenshots: gleiche Zeile nur einmal
    const seen = new Set<string>();
    const found = x.found.filter((f) => {
      const k = `${norm(f.name)}|${f.grams}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const { matches, unmatched } = matchAmounts(x.recipe.ingredients, found);
    return { recipe: x.recipe, shots: x.shots, title: x.title, matches, unmatched };
  });
  return { assigned, unassigned };
}
