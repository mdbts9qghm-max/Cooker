import { describe, expect, it } from "vitest";
import { parseRecipeText } from "@/lib/parser";
import { computedTotal, matchFood, resolveIngredient, perServing, type MatchContext } from "@/lib/nutrition";

const ctx: MatchContext = { mappings: new Map(), customFoods: [] };

function totalsFor(text: string) {
  const p = parseRecipeText(text);
  const ings = p.ingredients.map((i) => resolveIngredient(i, ctx));
  return { ings, total: computedTotal(ings), servings: p.servings ?? 1 };
}

/*
 * Von Hand gerechnet mit den Werten der Basisliste (pro 100 g):
 * Hähnchenbrust roh 120 kcal / 22,5 P / 0 KH / 2,6 F / 0 Bst
 * Reis ungekocht 360 / 6,6 / 79 / 0,6 / 1
 * Olivenöl 884 / 0 / 0 / 100 / 0, 1 EL = 13 g, 1 TL = 4,33 g
 */
describe("Makroberechnung gegen Handrechnung", () => {
  it("Rezept 1: Hähnchen-Reis (2 Portionen)", () => {
    const { total, ings } = totalsFor(`Hähnchen Reis
Zutaten für 2 Portionen
300 g Hähnchenbrust
150 g Basmatireis, ungekocht
1 TL Olivenöl`);
    expect(ings.map((i) => i.food?.id)).toEqual(["haehnchenbrust-r", "reis-r", "olivenoel"]);
    // 300g: 360 kcal, 67.5 P, 7.8 F | 150g Reis: 540 kcal, 9.9 P, 118.5 KH, 0.9 F, 1.5 Bst | 4.33g Öl: 38.3 kcal, 4.33 F
    expect(total.kcal).toBeCloseTo(938.3, 0);
    expect(total.protein).toBeCloseTo(77.4, 1);
    expect(total.carbs).toBeCloseTo(118.5, 1);
    expect(total.fat).toBeCloseTo(13.03, 1);
    expect(total.fiber).toBeCloseTo(1.5, 1);
    const ps = perServing({ creatorMacros: null, ingredients: ings, servings: 2 });
    expect(ps.kcal).toBeCloseTo(469.2, 0);
    expect(ps.protein).toBeCloseTo(38.7, 1);
  });

  it("Rezept 2: Overnight Oats", () => {
    const { total } = totalsFor(`Overnight Oats
40 g Haferflocken
150 g Skyr
100 ml Mandelmilch
80 g Heidelbeeren
1 TL Honig`);
    // 151.6 + 94.5 + 15 + 45.6 + 21.28 (7 g Honig) = 327.98
    expect(total.kcal).toBeCloseTo(327.98, 0);
    expect(total.protein).toBeCloseTo(22.96, 1);
    expect(total.carbs).toBeCloseTo(47.64, 1);
    expect(total.fat).toBeCloseTo(4.24, 1);
    expect(total.fiber).toBeCloseTo(6.17, 1);
  });

  it("Rezept 3: Bananen-Pancakes mit Stück-Angaben", () => {
    const { total, ings } = totalsFor(`Pancakes
2 Eier
1 Banane
50 g Haferflocken`);
    expect(ings.map((i) => i.grams)).toEqual([110, 120, 50]);
    // Eier 110 g: 157.3 kcal | Banane 120 g: 106.8 | Hafer 50 g: 189.5
    expect(total.kcal).toBeCloseTo(453.6, 0);
    expect(total.protein).toBeCloseTo(21.78, 1);
    expect(total.carbs).toBeCloseTo(58.13, 1);
    expect(total.fat).toBeCloseTo(14.06, 1);
    expect(total.fiber).toBeCloseTo(8.17, 1);
  });
});

describe("Lebensmittel-Zuordnung", () => {
  it.each([
    ["chicken breast", null, "haehnchenbrust-r"],
    ["Hähnchenbrustfilets", null, "haehnchenbrust-r"],
    ["Basmatireis", "cooked", "reis-c"],
    ["Kartoffeln", "cooked", "kartoffeln-c"],
    ["rote Linsen", null, "linsen-r"],
    ["Knoblauch", null, "knoblauch"],
    ["gehackte Tomaten", null, "tomaten-dose"],
    ["Kokosmilch light", null, "kokosmilch-light"],
    ["griechischer Joghurt 0%", null, "griechischer-joghurt-0"],
    ["spring onions", null, "fruehlingszwiebel"],
  ])("%s → %s", (name, state, id) => {
    expect(matchFood(name, state as "raw" | "cooked" | null, ctx).food?.id).toBe(id);
  });

  it("fragt bei Reis ohne Angabe nach roh/gekocht", () => {
    expect(matchFood("Reis", null, ctx).askState).toBe(true);
    expect(matchFood("Reis", "raw", ctx).askState).toBe(false);
  });

  it("eigene Zuordnungen haben Vorrang", () => {
    const own: MatchContext = {
      mappings: new Map([["quark", { source: "custom", id: "x", name: "Mein Quark", per100: { kcal: 70, protein: 13, carbs: 4, fat: 0.2, fiber: 0 } }]]),
      customFoods: [],
    };
    expect(matchFood("Quark", null, own).food?.name).toBe("Mein Quark");
  });
});
