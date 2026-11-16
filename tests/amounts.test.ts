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

import { assignShots, cleanShotTitle } from "@/lib/amounts";

describe("Mengen aus mehreren Screenshots für alle Rezepte", () => {
  const ctx = { mappings: new Map(), customFoods: [] };
  const gnocchi = { id: "g", title: "Cheeseburger Gnocchi", ingredients: MF.map((l) => resolveIngredient(parseMFIngredient(l), ctx)) };
  const brownies = {
    id: "b",
    title: "Saftige Protein-Brownies",
    ingredients: ["Banana (3 banana)", "Egg, Whole, Raw (3 egg)", "Skyr, Plain (30 g)", "Cocoa Powder, Unsweetened (1 tbsp)"].map((l) => resolveIngredient(parseMFIngredient(l), ctx)),
  };
  const pasta = { id: "p", title: "Cheeseburger Pasta", ingredients: gnocchi.ingredients.slice(1, 4) };

  it("Titel aus der Titelleiste", () => {
    expect(cleanShotTitle("Cheeseburger Gnocchi\n")).toBe("Cheeseburger Gnocchi");
    expect(cleanShotTitle("< Saftige Protein-Brownies |\n")).toBe("Saftige Protein-Brownies");
  });

  it("ordnet Screenshots per Titel und Zutaten zu, auch ohne Titel", () => {
    const { assigned, unassigned } = assignShots(
      [
        { index: 0, title: "Cheeseburger Gnocchi\n", text: OCR },
        { index: 1, title: "", text: "Banana\n3 banana • 360g\nEgg, Whole, Raw\n3 egg • 150g\nCocoa Powder, Unsweetened\n1 tbsp • 5g" },
        { index: 2, title: "Lotus Dessert", text: "Biscoff Spread\n1 tbsp • 15g" },
      ],
      [pasta, gnocchi, brownies],
    );
    expect(assigned.map((a) => a.recipe.id).sort()).toEqual(["b", "g"]);
    const g = assigned.find((a) => a.recipe.id === "g")!;
    expect(g.matches).toHaveLength(9);
    const b = assigned.find((a) => a.recipe.id === "b")!;
    expect(b.matches.map((m) => m.found.grams)).toEqual([360, 150, 5]);
    expect(unassigned.map((u) => u.index)).toEqual([2]);
  });
});
