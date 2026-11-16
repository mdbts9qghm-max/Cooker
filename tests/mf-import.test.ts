import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { readMacroFactorExport, mfToRecipe, splitFlatDescription, parseMFIngredient } from "@/lib/mf-import";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const col = (i: number) => String.fromCharCode(65 + i);

/** baut eine minimale XLSX-Datei wie der MacroFactor-Export (Inline-Strings) */
function makeXlsx(rows: (string | number | null)[][]): Uint8Array {
  const sheet = `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows
    .map(
      (r, ri) =>
        `<row r="${ri + 1}">${r
          .map((v, ci) =>
            v == null ? "" : typeof v === "number" ? `<c r="${col(ci)}${ri + 1}"><v>${v}</v></c>` : `<c r="${col(ci)}${ri + 1}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`,
          )
          .join("")}</row>`,
    )
    .join("")}</sheetData></worksheet>`;
  return zipSync({
    "xl/workbook.xml": strToU8(`<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Recipes" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`),
    "xl/worksheets/sheet1.xml": strToU8(sheet),
  });
}

const HEAD = ["Recipe Name", "Total Weight (g)", "Serving Qty", "Ingredients", "Description", "Calories (kcal)", "Protein (g)", "Fat (g)", "Carbs (g)", "Fiber (g)", "Step 1", "Step 2"];
const ctx = { mappings: new Map(), customFoods: [] };

describe("MacroFactor-Import", () => {
  const data = makeXlsx([
    HEAD,
    [
      "High Protein Smashburger", null, 4,
      "Burger Bun (4 bun)\nBeef Ground 90% Lean 10% Fat Raw (1 oz)\nLight Emmentaler Cheese (100 g)",
      "High Protein Smashburger 🍔Nährwerte pro Burger• 545 kcal• 56 g Eiweiß• 20 g Fett• 41 g KohlenhydrateZutaten für 4 Burger• 4 Burger Buns à 62,5 g• 700 g mageres Rinderhackfleisch (5 % Fett)• 100 g Light-Emmentaler• 1 große Zwiebel• 2 bis 3 Sprüher Ölspray",
      2478, 190.43, 117.72, 154.16, 1.14, "Die Zwiebel in feine Streifen schneiden.", "Patties dünn in die Pfanne drücken.",
    ],
    [
      "FRÜSTÜCK/Saftige Protein-Brownies", null, 8,
      "Banana (3 banana)\nEgg, Whole, Raw (3 egg)\nSkyr, Plain (30 g)\nWhey Protein Powder (30 g)\nCocoa Powder, Unsweetened (1 tbsp)",
      "Saftige Protein-Brownies – ohne Mehl & ohne Zuckerzusatz!",
      925, 57.48, 21.79, 131.9, null, "Alles zu einem glatten Teig mixen.", null,
    ],
  ]);

  it("liest Rezepte, Portionen, Summen und Schritte", () => {
    const list = readMacroFactorExport(data);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ name: "High Protein Smashburger", servings: 4 });
    expect(list[0].totals).toMatchObject({ kcal: 2478, protein: 190.43 });
    expect(list[0].steps).toHaveLength(2);
    expect(list[1].ingredients).toHaveLength(5);
  });

  it("Makros pro Portion = MacroFactor-Summe / Portionen", () => {
    const r = mfToRecipe(readMacroFactorExport(data)[0], ctx).recipe;
    expect(r.creatorMacros).toEqual({ kcal: 620, protein: 47.6, carbs: 38.5, fat: 29.4, fiber: 0.3 });
  });

  it("nutzt die Original-Caption für echte Mengen, ohne Nährwert-Zeilen", () => {
    const p = mfToRecipe(readMacroFactorExport(data)[0], ctx);
    expect(p.ingredientSource).toBe("description");
    const names = p.recipe.ingredients.map((i) => i.name);
    expect(names).not.toContain("Fett");
    const buns = p.recipe.ingredients.find((i) => /Buns/.test(i.name))!;
    expect(buns.grams).toBe(250); // 4 × 62,5 g
    const hack = p.recipe.ingredients.find((i) => /Rinderhack/.test(i.name))!;
    expect(hack).toMatchObject({ grams: 700 });
    expect(hack.food?.id).toBe("hackfleisch-mager-r");
    expect(p.recipe.ingredients.find((i) => /Ölspray/.test(i.name))!.grams).toBeLessThan(2);
  });

  it("Ordner-Präfix wird zum Tag, MacroFactor-Liste als Rückfall", () => {
    const p = mfToRecipe(readMacroFactorExport(data)[1], ctx);
    expect(p.recipe.title).toBe("Saftige Protein-Brownies");
    expect(p.recipe.tags).toContain("Frühstück");
    expect(p.ingredientSource).toBe("macrofactor");
    const g = p.recipe.ingredients.map((i) => Math.round(i.grams));
    expect(g).toEqual([360, 165, 30, 30, 0]); // 3 Bananen, 3 Eier, Gramm-Angaben, "1 tbsp" unbekannt
    expect(p.missingAmounts).toBe(1);
  });

  it("Hilfsfunktionen", () => {
    expect(splitFlatDescription("Rezept ⬇️450g Magerquark300g Dinkelmehl")).toBe("Rezept\n450g Magerquark\n300g Dinkelmehl");
    expect(parseMFIngredient("Sticky Rice, Raw (200 g)")).toMatchObject({ amount: 200, unit: "g", state: "raw" });
    expect(parseMFIngredient("Chicken Breast Boneless Skinless Raw (3 oz)")).toMatchObject({ amount: null });
    expect(() => readMacroFactorExport(makeXlsx([["Foo"], ["bar"]]))).toThrow(/Recipe Name|Recipes/);
  });
});
