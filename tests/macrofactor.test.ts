import { describe, expect, it } from "vitest";
import { decodePayload, encodePayload, jsonLd, toPayload } from "@/lib/macrofactor";
import { buildSampleRecipes } from "@/lib/samples";

describe("MacroFactor-Export", () => {
  const recipes = buildSampleRecipes();

  it("Link bleibt für typische Rezepte unter 2000 Zeichen", () => {
    for (const r of recipes) {
      const enc = encodePayload(toPayload(r));
      expect(enc.length + "https://rezeptbuch.vercel.app/r/".length).toBeLessThan(2000);
    }
  });

  it("Hin- und Rückweg ergibt dasselbe Rezept", () => {
    const p = toPayload(recipes[1]);
    const back = decodePayload(encodePayload(p));
    expect(back).toEqual(p);
    expect(decodePayload(encodeURIComponent(encodePayload(p)))).toEqual(p);
  });

  it("JSON-LD enthält Zutaten in Gramm und Nährwerte pro Portion", () => {
    const ld = jsonLd(toPayload(recipes[1]));
    expect(ld["@type"]).toBe("Recipe");
    expect(ld.recipeIngredient[0]).toMatch(/^\d+ g /);
    expect(ld.nutrition.proteinContent).toMatch(/ g$/);
    expect(ld.recipeYield).toBe("3 Portionen");
  });

  it("sehr lange Rezepte werden gekürzt statt zu lang zu werden", () => {
    const r = { ...recipes[1], steps: Array.from({ length: 30 }, (_, i) => `Schritt ${i} `.repeat(30)) };
    expect(encodePayload(toPayload(r)).length).toBeLessThan(1950);
  });
});
