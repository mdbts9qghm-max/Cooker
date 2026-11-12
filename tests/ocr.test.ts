import { describe, expect, it } from "vitest";
import { cleanOcrText } from "@/lib/importer";
import { parseRecipeText } from "@/lib/parser";
import { resolveIngredient } from "@/lib/nutrition";

// Echte Tesseract-Ausgaben von Instagram-Screenshots (Dark Mode DE, Light Mode EN)
const DE = `O fitfood.anna ° Folgen
fitfood.anna Cremige Protein Pasta &@ (2
Portionen)
Zutaten:
- 160 g Vollkornnudeln
- 300 g Hahnchenbrust
- 200 g Magerquark
- 100 g Frischkäse light
- 1 Zwiebel
- 2 Knoblauchzehen
- 150 g Spinat
- 1TL Olivenöl
Zubereitung:
1. Nudeln nach Packungsanweisung kochen.
2. Hähnchen würfeln und in Olivenöl anbraten.
3. Zwiebel und Knoblauch dazugeben, dann
Spinat.
4. Quark und Frischkäse unterrühren und mit den
Nudeln mischen.
Pro Portion: 610 kcal | 68 g Protein | 55 g KH | 11g
Fett
#highprotein #mealprep
vor 2 Tagen - Ubersetzung anzeigen`;

const EN = `O fitfood.anna ° Folgen
fitfood.anna Banana Protein Muffins „ makes 6
Ingredients
- 2 ripe bananas
-1cup rolled oats
- 2 eggs
- 1 scoop vanilla protein powder
- 1/2 cup Greek yogurt
- 1tsp baking powder
Instructions
1. Blend everything until smooth.
2. Pour into a muffin tin and bake at 350°F for 18
minutes.
Each muffin: 150 calories, 11g protein, 19g carbs,
3g fat
vor 2 Tagen - Übersetzung anzeigen`;

const ctx = { mappings: new Map(), customFoods: [] };

describe("Screenshot-Text (OCR)", () => {
  it("deutsche Caption: Kopfzeile, Benutzername und Umbrüche bereinigt", () => {
    const clean = cleanOcrText(DE);
    expect(clean).not.toMatch(/Folgen|bersetzung|vor 2 Tagen/);
    const r = parseRecipeText(clean);
    expect(r.title).toBe("Cremige Protein Pasta");
    expect(r.servings).toBe(2);
    expect(r.ingredients).toHaveLength(8);
    expect(r.steps).toHaveLength(4);
    expect(r.steps[2]).toBe("Zwiebel und Knoblauch dazugeben, dann Spinat.");
    expect(r.creatorMacros).toMatchObject({ kcal: 610, protein: 68, carbs: 55, fat: 11 });
    const food = resolveIngredient(r.ingredients[1], ctx).food;
    expect(food?.id).toBe("haehnchenbrust-r"); // trotz fehlendem Umlaut
  });

  it("englische Caption: makes 6, each muffin, zusammengeklebte Einheiten", () => {
    const r = parseRecipeText(cleanOcrText(EN));
    expect(r.title).toBe("Banana Protein Muffins");
    expect(r.servings).toBe(6);
    expect(r.ingredients).toHaveLength(6);
    expect(r.ingredients[1]).toMatchObject({ amount: 1, unit: "Tasse", name: "rolled oats" });
    expect(r.ingredients[5]).toMatchObject({ amount: 1, unit: "TL" });
    expect(r.steps).toHaveLength(2);
    expect(r.steps[1]).toContain("18 minutes");
    expect(r.creatorMacros).toMatchObject({ kcal: 150, protein: 11, carbs: 19, fat: 3 });
  });
});
