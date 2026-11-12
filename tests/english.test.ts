import { describe, expect, it } from "vitest";
import { parseRecipeText, parseIngredientLine } from "@/lib/parser";
import { resolveIngredient } from "@/lib/nutrition";

const ctx = { mappings: new Map(), customFoods: [] };
const resolve = (t: string) => parseRecipeText(t).ingredients.map((i) => resolveIngredient(i, ctx));

const BURGER = `HIGH PROTEIN CHEESEBURGER BOWL 🍔 only 450 calories!
Ingredients:
- 1 lb 93/7 lean ground beef
- 2 cups cooked white rice
- 1 cup shredded lettuce
- 1/4 cup fat free shredded cheddar cheese
- 1 small onion, diced
- 2 cloves garlic, minced
- salt and pepper to taste
Sauce:
- 1/2 cup nonfat Greek yogurt
- 2 tbsp sugar free ketchup
- 1 tsp garlic powder
Directions:
1. Brown the beef with onion and garlic.
2. Mix the sauce ingredients.
3. Assemble bowls and top with sauce.
Makes 4 servings | Per serving: 450 cal, 42g protein, 38g carbs, 12g fat`;

describe("Englische Captions", () => {
  it("Unterüberschrift 'Sauce:' und 'to taste' bleiben in der Zutatenliste", () => {
    const r = parseRecipeText(BURGER);
    expect(r.title).toBe("HIGH PROTEIN CHEESEBURGER BOWL");
    expect(r.servings).toBe(4);
    expect(r.ingredients).toHaveLength(10);
    expect(r.ingredients.map((i) => i.name)).toContain("nonfat Greek yogurt");
    expect(r.steps).toHaveLength(3);
    expect(r.creatorMacros).toMatchObject({ kcal: 450, protein: 42, carbs: 38, fat: 12 });
  });

  it("englische Zutaten werden den richtigen Lebensmitteln zugeordnet", () => {
    const ids = resolve(BURGER).map((i) => i.food?.id);
    expect(ids).toEqual([
      "hackfleisch-mager-r", "reis-c", "salat", "gouda", "zwiebel", "knoblauch", "pfeffer",
      "griechischer-joghurt-0", "ketchup", "knoblauchpulver",
    ]);
  });

  it("Cups werden je nach Lebensmittel realistisch in Gramm umgerechnet", () => {
    const g = resolve(`Bowl
2 cups baby spinach
1/2 cup rolled oats
1 cup cooked rice
1/2 cup frozen blueberries
1 cup egg whites`).map((i) => Math.round(i.grams));
    expect(g).toEqual([60, 40, 160, 74, 243]);
  });

  it("Dezimalzahlen, Zahlwörter, Saft und oz in Klammern", () => {
    expect(parseIngredientLine("1.5 lbs boneless skinless chicken thighs")).toMatchObject({ amount: 1.5, unit: "lb" });
    expect(parseIngredientLine("one large onion")).toMatchObject({ amount: 1, name: "large onion" });
    expect(parseIngredientLine("a pinch of salt")).toMatchObject({ amount: 1, unit: "Prise", name: "salt" });
    expect(parseIngredientLine("two eggs")).toMatchObject({ amount: 2, name: "eggs" });
    expect(parseIngredientLine("juice of 1 lime")).toMatchObject({ amount: 1, unit: "Stück", name: "Limettensaft" });
    expect(parseIngredientLine("Saft einer Zitrone")).toMatchObject({ amount: 1, name: "Zitronensaft" });
    expect(parseIngredientLine("1 can (15 oz) chickpeas, drained")).toMatchObject({ unit: "Dose", gramsHint: 425, name: "chickpeas" });
  });

  it("weitere englische Namen", () => {
    const ids = resolve(`Mix
1 tbsp avocado oil
1 cup light cream
1 cup low fat cottage cheese
1 cup cauliflower rice
1 scoop vanilla protein powder
2 tsp cajun seasoning`).map((i) => i.food?.id);
    expect(ids).toEqual(["rapsoel", "kochsahne", "huettenkaese", "blumenkohl", "proteinpulver", "gyros-gewuerz"]);
  });
});
