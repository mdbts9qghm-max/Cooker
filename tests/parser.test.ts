import { describe, expect, it } from "vitest";
import { parseRecipeText, parseIngredientLine, parseMacros } from "@/lib/parser";

const C = {
  de1: `🍗 High Protein Hähnchen Reis Bowl 🍚
Perfekt für Meal Prep! 💪

Zutaten (für 2 Portionen):
- 300g Hähnchenbrust
- 150g Basmatireis (ungekocht)
- 1 Paprika
- 2 EL Sojasauce
- 1 TL Olivenöl
- Salz & Pfeffer

Zubereitung:
1. Reis nach Packungsanweisung kochen.
2. Hähnchen würfeln und in Olivenöl scharf anbraten.
3. Paprika dazugeben, mit Sojasauce ablöschen und servieren.

Pro Portion: 520 kcal | 45g Protein | 62g KH | 8g Fett

#mealprep #highprotein #fitfood #rezept`,

  de2: `Protein Pancakes in 10 Minuten 🥞🔥
Du brauchst:
▪️ 50 g Haferflocken
▪️ 1 Banane
▪️ 2 Eier
▪️ 100g Magerquark
▪️ 1 Prise Zimt
Alles mixen und in einer Pfanne goldbraun backen.
Makros gesamt: 610 kcal, P 42 / C 70 / F 15
Folge mir für mehr Rezepte! Link in Bio 🔗`,

  de3: `Overnight Oats mit Beeren
Zutaten: 40g Haferflocken, 150g Skyr, 100ml Mandelmilch, 80g Heidelbeeren, 1 TL Honig
Am Abend alles verrühren und über Nacht in den Kühlschrank stellen.`,

  de4: `CREMIGE TOMATEN-PASTA 🍝 (4 Portionen)

400 g Spaghetti
1 Dose gehackte Tomaten (400 g)
200 ml Kochsahne
2 Knoblauchzehen
1 Zwiebel
50 g Parmesan
1-2 TL Oregano

So geht's:
Nudeln kochen. Zwiebel und Knoblauch anschwitzen, Tomaten und Sahne zugeben, 10 Minuten köcheln lassen. Mit Pasta und Parmesan vermengen.

Nährwerte pro Portion:
Kalorien: 590
Eiweiß: 22 g
Kohlenhydrate: 85 g
Fett: 17 g
Ballaststoffe: 6 g`,

  de5: `Low Carb Zucchini Lasagne 😍 Speichern nicht vergessen!
Für 3 Portionen
• 2 Zucchini
• 500g Rinderhack
• 250 g Magerquark
• 1 Packung passierte Tomaten
• 100g Mozzarella light
• ½ TL Salz
Zucchini in Scheiben schneiden, Hack anbraten, schichten und bei 180 Grad 35 Minuten backen.
➡️ 410 kcal • 48g Protein • 12g Carbs • 18g Fett pro Portion
Werbung | Rabattcode FIT10`,

  de6: `Schnelles Frühstück:
Skyr 250g
Granola 40g
Himbeeren 100g
Honig 1 TL`,

  de7: `Linsen-Curry vegan 🌱
Zutaten
200 g rote Linsen
400 ml Kokosmilch light
1 Zwiebel, gewürfelt
2 Zehen Knoblauch
1 EL Currypaste
1 Handvoll Spinat
Anleitung
Zwiebel anbraten. Currypaste und Linsen dazu. Kokosmilch und 300 ml Wasser angießen. 15 Min köcheln, Spinat unterheben.
ergibt 4 Portionen`,

  en1: `Chicken Burrito Bowl 🌯 (macros below!)
Ingredients:
- 1 lb chicken breast
- 1 cup (185g) jasmine rice, uncooked
- 1 can black beans, drained
- 1/2 cup corn
- 1 avocado
- 2 tbsp taco seasoning
Instructions:
1) Season chicken and grill for 6-7 minutes per side.
2) Cook rice and assemble bowls with beans, corn and avocado.
Makes 4 servings.
Macros per serving: 540 calories, 45g protein, 58g carbs, 14g fat, 9g fiber
Follow @fitchef for more! #mealprep`,

  en2: `PROTEIN BROWNIES 🍫 recipe ⬇️
3 scoops chocolate protein powder
1 ½ cups almond flour
½ cup cocoa powder
3 eggs
1/3 cup maple syrup
Bake at 350°F for 20 minutes.
Each brownie: 180 cals | P 15 | C 10 | F 9
serves 9`,

  en3: `Greek yogurt bowl
200g greek yogurt 0%
30g granola
1 tbsp peanut butter
handful of blueberries
Total: 420 kcal 30g protein`,

  en4: `Easy salmon & sweet potato traybake 🐟
What you need:
2 salmon fillets (250g)
400g sweet potatoes
200 g broccoli
1 tbsp olive oil
1 tsp smoked paprika
Method:
Roast sweet potatoes for 15 min at 200C. Add salmon and broccoli, roast 12 more minutes.
Serves 2 | 560 kcal per serving | 38g protein`,

  de8: `Meal Prep Wraps 🌯 – 4 Stück
4 Wraps
400g Putenbrust
4 Scheiben Gouda
1 Gurke
100 g Frischkäse light
Pute anbraten, alles auf die Wraps verteilen und einrollen.
Pro Wrap: 430 kcal, 40g Eiweiß, 35g Kohlenhydrate, 14g Fett`,

  de9: `Rezept: Kartoffel-Spinat-Pfanne
Zutaten
800 g Kartoffeln (gekocht)
300 g Spinat
2 Eier
50 g Feta
Kartoffeln in Scheiben schneiden und anbraten, Spinat dazu, Eier unterrühren, Feta drüber.`,

  en5: `Peanut noodles 🥜 ready in 15!! save this for later 📌
For the sauce: 2 tbsp peanut butter, 2 tbsp soy sauce, 1 tbsp lime juice, 1 tsp sriracha
For the noodles: 200g rice noodles, 1 carrot, 2 spring onions
Cook noodles, toss everything together.
2 servings`,

  de10: `Kaiserschmarrn High Protein 🤤🤤
60g Mehl
2 Eier
150 ml Milch 1,5%
30 g Proteinpulver Vanille
1 EL Erythrit
1 TL Butter
Teig rühren, in Butter backen, zerrupfen. Mit Apfelmus servieren!
Ganzes Rezept: 650 kcal / 55 g Protein / 60 g KH / 18 g Fett`,
};

const names = (r: ReturnType<typeof parseRecipeText>) => r.ingredients.map((i) => i.name.toLowerCase());

describe("caption parser", () => {
  it("de1: bowl with sections, macros per serving, hashtags removed", () => {
    const r = parseRecipeText(C.de1);
    expect(r.title).toBe("High Protein Hähnchen Reis Bowl");
    expect(r.servings).toBe(2);
    expect(r.ingredients).toHaveLength(6);
    expect(r.ingredients[0]).toMatchObject({ amount: 300, unit: "g", name: "Hähnchenbrust" });
    expect(r.ingredients[1]).toMatchObject({ amount: 150, unit: "g", state: "raw" });
    expect(r.ingredients[3]).toMatchObject({ amount: 2, unit: "EL", name: "Sojasauce" });
    expect(r.ingredients[5].amount).toBeNull();
    expect(r.steps).toHaveLength(3);
    expect(r.creatorMacros).toMatchObject({ kcal: 520, protein: 45, carbs: 62, fat: 8 });
    expect(r.steps.join(" ")).not.toContain("#");
  });

  it("de2: short P/C/F notation, total macros, junk lines dropped", () => {
    const r = parseRecipeText(C.de2);
    expect(r.title).toBe("Protein Pancakes in 10 Minuten");
    expect(names(r)).toEqual(["haferflocken", "banane", "eier", "magerquark", "zimt"]);
    expect(r.ingredients[4]).toMatchObject({ amount: 1, unit: "Prise" });
    expect(r.creatorMacros).toMatchObject({ kcal: 610, protein: 42, carbs: 70, fat: 15 });
    expect(r.steps).toHaveLength(1);
    expect(r.steps.join(" ")).not.toMatch(/folge/i);
  });

  it("de3: inline comma-separated ingredient list", () => {
    const r = parseRecipeText(C.de3);
    expect(r.title).toBe("Overnight Oats mit Beeren");
    expect(r.ingredients).toHaveLength(5);
    expect(r.ingredients[2]).toMatchObject({ amount: 100, unit: "ml", name: "Mandelmilch" });
    expect(r.steps).toHaveLength(1);
    expect(r.creatorMacros).toBeNull();
  });

  it("de4: servings in title, grams in parentheses, range, multi-line macros", () => {
    const r = parseRecipeText(C.de4);
    expect(r.title.toLowerCase()).toContain("cremige tomaten-pasta");
    expect(r.servings).toBe(4);
    expect(r.ingredients).toHaveLength(7);
    const dose = r.ingredients[1];
    expect(dose).toMatchObject({ amount: 1, unit: "Dose", gramsHint: 400 });
    expect(r.ingredients[3]).toMatchObject({ amount: 2, unit: "Zehe" });
    const oregano = r.ingredients[6];
    expect(oregano.amount).toBe(1.5);
    expect(oregano.uncertain).toBe(true);
    expect(r.creatorMacros).toMatchObject({ kcal: 590, protein: 22, carbs: 85, fat: 17, fiber: 6 });
  });

  it("de5: bullets, ½, macros with arrow emoji, ad line ignored", () => {
    const r = parseRecipeText(C.de5);
    expect(r.title).toBe("Low Carb Zucchini Lasagne");
    expect(r.servings).toBe(3);
    expect(r.ingredients).toHaveLength(6);
    expect(r.ingredients[5]).toMatchObject({ amount: 0.5, unit: "TL", name: "Salz" });
    expect(r.creatorMacros).toMatchObject({ kcal: 410, protein: 48, carbs: 12, fat: 18 });
    expect(r.steps).toHaveLength(1);
  });

  it("de6: trailing quantities", () => {
    const r = parseRecipeText(C.de6);
    expect(r.title).toBe("Schnelles Frühstück");
    expect(r.ingredients.map((i) => [i.name, i.amount, i.unit])).toEqual([
      ["Skyr", 250, "g"],
      ["Granola", 40, "g"],
      ["Himbeeren", 100, "g"],
      ["Honig", 1, "TL"],
    ]);
  });

  it("de7: headers without colon, 'ergibt 4 Portionen', comma notes removed", () => {
    const r = parseRecipeText(C.de7);
    expect(r.title).toBe("Linsen-Curry vegan");
    expect(r.servings).toBe(4);
    expect(r.ingredients).toHaveLength(6);
    expect(r.ingredients[2].name).toBe("Zwiebel");
    expect(r.ingredients[3]).toMatchObject({ amount: 2, unit: "Zehe", name: "Knoblauch" });
    expect(r.ingredients[5]).toMatchObject({ amount: 1, unit: "Handvoll", name: "Spinat" });
    expect(r.steps.length).toBeGreaterThanOrEqual(1);
  });

  it("en1: english units, cup with grams, makes 4 servings, fiber", () => {
    const r = parseRecipeText(C.en1);
    expect(r.title).toBe("Chicken Burrito Bowl");
    expect(r.servings).toBe(4);
    expect(r.ingredients).toHaveLength(6);
    expect(r.ingredients[0]).toMatchObject({ amount: 1, unit: "lb", name: "chicken breast" });
    expect(r.ingredients[1]).toMatchObject({ unit: "Tasse", gramsHint: 185, state: "raw" });
    expect(r.ingredients[2]).toMatchObject({ unit: "Dose", name: "black beans" });
    expect(r.ingredients[3]).toMatchObject({ amount: 0.5, unit: "Tasse", name: "corn" });
    expect(r.steps).toHaveLength(2);
    expect(r.creatorMacros).toMatchObject({ kcal: 540, protein: 45, carbs: 58, fat: 14, fiber: 9 });
  });

  it("en2: scoops, mixed fractions, 'each' = per serving", () => {
    const r = parseRecipeText(C.en2);
    expect(r.title).toBe("PROTEIN BROWNIES");
    expect(r.servings).toBe(9);
    expect(r.ingredients[0]).toMatchObject({ amount: 3, unit: "Messlöffel" });
    expect(r.ingredients[1]).toMatchObject({ amount: 1.5, unit: "Tasse", name: "almond flour" });
    expect(r.ingredients[4]).toMatchObject({ amount: 1 / 3, unit: "Tasse" });
    expect(r.creatorMacros).toMatchObject({ kcal: 180, protein: 15, carbs: 10, fat: 9 });
    expect(r.steps).toHaveLength(1);
  });

  it("en3: 'handful of', total without servings", () => {
    const r = parseRecipeText(C.en3);
    expect(r.ingredients).toHaveLength(4);
    expect(r.ingredients[3]).toMatchObject({ amount: 1, unit: "Handvoll", name: "blueberries" });
    expect(r.creatorMacros?.kcal).toBe(420);
    expect(r.creatorMacros?.protein).toBe(30);
  });

  it("en4: serves 2 with macros on same line", () => {
    const r = parseRecipeText(C.en4);
    expect(r.servings).toBe(2);
    expect(r.ingredients).toHaveLength(5);
    expect(r.ingredients[0]).toMatchObject({ amount: 2, gramsHint: 250 });
    expect(r.creatorMacros).toMatchObject({ kcal: 560, protein: 38 });
    expect(r.steps).toHaveLength(1);
  });

  it("de8: per wrap macros, 'Scheiben'", () => {
    const r = parseRecipeText(C.de8);
    expect(r.title).toBe("Meal Prep Wraps");
    expect(r.servings).toBe(4);
    expect(r.ingredients[2]).toMatchObject({ amount: 4, unit: "Scheibe", name: "Gouda" });
    expect(r.creatorMacros).toMatchObject({ kcal: 430, protein: 40, carbs: 35, fat: 14 });
  });

  it("de9: 'Rezept:' prefix removed, cooked state detected", () => {
    const r = parseRecipeText(C.de9);
    expect(r.title).toBe("Kartoffel-Spinat-Pfanne");
    expect(r.ingredients[0]).toMatchObject({ amount: 800, name: "Kartoffeln", state: "cooked" });
    expect(r.steps).toHaveLength(1);
  });

  it("en5: inline lists after 'For the …:' headers", () => {
    const r = parseRecipeText(C.en5);
    expect(r.title).toBe("Peanut noodles");
    expect(r.servings).toBe(2);
    expect(names(r)).toEqual(["peanut butter", "soy sauce", "lime juice", "sriracha", "rice noodles", "carrot", "spring onions"]);
  });

  it("de10: total macros are divided by servings only when servings known", () => {
    const r = parseRecipeText(C.de10);
    expect(r.title).toBe("Kaiserschmarrn High Protein");
    expect(r.ingredients).toHaveLength(6);
    expect(r.ingredients[2]).toMatchObject({ amount: 150, unit: "ml" });
    expect(r.ingredients[3]).toMatchObject({ amount: 30, unit: "g" });
    expect(r.creatorMacros).toMatchObject({ kcal: 650, protein: 55 });
  });
});

describe("ingredient lines", () => {
  it.each([
    ["200g Hähnchenbrust", 200, "g", "Hähnchenbrust"],
    ["1 ½ EL Olivenöl", 1.5, "EL", "Olivenöl"],
    ["1½ TL Salz", 1.5, "TL", "Salz"],
    ["3/4 cup milk", 0.75, "Tasse", "milk"],
    ["2 große Zwiebeln, fein gehackt", 2, "Stück", "große Zwiebeln"],
    ["Hähnchenbrust: 250 g", 250, "g", "Hähnchenbrust"],
    ["eine Prise Salz", 1, "Prise", "Salz"],
    ["0,5 l Milch", 0.5, "l", "Milch"],
  ])("%s", (line, amount, unit, name) => {
    const p = parseIngredientLine(line)!;
    expect(p.amount).toBeCloseTo(amount as number);
    expect(p.unit).toBe(unit);
    expect(p.name).toBe(name);
  });
});

describe("macro parsing", () => {
  it("handles compact forms", () => {
    expect(parseMacros("40P / 50C / 15F").macros).toMatchObject({ protein: 40, carbs: 50, fat: 15 });
    expect(parseMacros("Kalorien 480 – Protein 35g").macros).toMatchObject({ kcal: 480, protein: 35 });
    expect(parseMacros("520kcal pro Portion").scope).toBe("serving");
    expect(parseMacros("insgesamt 1200 kcal").scope).toBe("total");
  });
});
