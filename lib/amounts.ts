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
