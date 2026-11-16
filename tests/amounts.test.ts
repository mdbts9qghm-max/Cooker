import { describe, expect, it } from "vitest";
import { matchAmounts, parseAmountList } from "@/lib/amounts";
import { parseMFIngredient } from "@/lib/mf-import";
import { resolveIngredient } from "@/lib/nutrition";

// Echte Tesseract-Ausgabe eines MacroFactor-Screenshots (linke, dann rechte Spalte)
const OCR = `17:32
< Cheesebur;
Instructions for
Ingredients
@ Potato Gnocchi
300 g- 300g
Onion, White,
©) Yellow Or Red, Raw
0.5 onion + 55g
Mustard
8 20g° 20g
= Garlic, Powder
A 1serving « 5g
Dairy And Egg
Cheese Mozzarella
( Low Moisture Part-
Skim Shredded
50g-+ 50g
Steps
No preparation steps are av

uw 5G €
ser Gnocchi
2 servings
Beef Ground 90%
= Lean 10% Fat Raw
400 g °* 400g
ga Ketchup
8 67.5 g° 67.5g
= Salt
1serving « 5g
<= Onion Powder
A 1serving « 5g
ailable for this recipe`;

const MF = [
  "Potato Gnocchi (1 piece)",
  "Beef Ground 90% Lean 10% Fat Raw (1 oz)",
  "Onion, White, Yellow or Red, Raw (1 large)",
  "Ketchup (1 packet)",
  "Mustard (1 packet)",
  "Salt (1 dash)",
  "Garlic, Powder (1 tbsp)",
  "Onion Powder (1 tbsp)",
  "Dairy and Egg Cheese Mozzarella Low Moisture Part-Skim Shredded (1 cup)",
];

describe("Mengen aus MacroFactor-Screenshot", () => {
  it("liest alle 9 Zutaten mit Gramm", () => {
    const found = parseAmountList(OCR);
    expect(found.map((f) => f.grams)).toEqual([300, 55, 20, 5, 50, 400, 67.5, 5, 5]);
    expect(found[0].name).toBe("Potato Gnocchi");
    expect(found[1].name).toBe("Onion, White, Yellow Or Red, Raw");
    expect(found[5].name).toBe("Beef Ground 90% Lean 10% Fat Raw");
  });

  it("ordnet jede Menge der richtigen Zutat zu", () => {
    const ctx = { mappings: new Map(), customFoods: [] };
    const ings = MF.map((l) => resolveIngredient(parseMFIngredient(l), ctx));
    const { matches, unmatched } = matchAmounts(ings, parseAmountList(OCR));
    expect(unmatched).toEqual([]);
    const byName = Object.fromEntries(matches.map((m) => [m.ingredientName, m.found.grams]));
    expect(byName).toEqual({
      "Potato Gnocchi": 300,
      "Beef Ground 90% Lean 10% Fat Raw": 400,
      "Onion, White, Yellow or Red, Raw": 55,
      Ketchup: 67.5,
      Mustard: 20,
      Salt: 5,
      "Garlic, Powder": 5,
      "Onion Powder": 5,
      "Dairy and Egg Cheese Mozzarella Low Moisture Part-Skim Shredded": 50,
    });
  });
});
