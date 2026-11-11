import { db } from "./db";
import { resolveIngredient } from "./nutrition";
import { parseRecipeText } from "./parser";
import type { PlanEntry, Recipe, Slot } from "./types";
import { addDays, mondayOf, today, uid } from "./util";

const SAMPLES: { text: string; tags: string[] }[] = [
  {
    tags: ["Frühstück", "High Protein", "Schnell"],
    text: `Protein Overnight Oats
Zutaten für 1 Portion
50 g Haferflocken
150 g Skyr
100 ml Milch 1,5 %
80 g Heidelbeeren
1 TL Honig
10 g Chiasamen
Zubereitung
Alles in einem Glas verrühren und über Nacht in den Kühlschrank stellen.
Morgens mit den Heidelbeeren toppen.`,
  },
  {
    tags: ["Mittag", "Meal Prep", "High Protein"],
    text: `Hähnchen-Reis-Bowl mit Brokkoli
Zutaten für 3 Portionen
450 g Hähnchenbrust
180 g Basmatireis, ungekocht
400 g Brokkoli
1 Paprika
3 EL Sojasauce
1 EL Olivenöl
1 TL Paprikapulver
Zubereitung
Reis nach Packungsanweisung kochen.
Hähnchen würfeln, mit Paprikapulver würzen und in Olivenöl scharf anbraten.
Brokkoli und Paprika 5 Minuten mitbraten, mit Sojasauce ablöschen.
Auf drei Boxen verteilen.`,
  },
  {
    tags: ["Abend", "Vegetarisch"],
    text: `Rotes Linsen-Curry
Zutaten für 4 Portionen
250 g rote Linsen
400 ml Kokosmilch light
400 g gehackte Tomaten
1 Zwiebel
2 Knoblauchzehen
1 EL Currypaste
100 g Spinat
Zubereitung
Zwiebel und Knoblauch anschwitzen, Currypaste kurz mitrösten.
Linsen, Tomaten, Kokosmilch und 300 ml Wasser dazugeben und 15 Minuten köcheln.
Spinat unterheben und abschmecken.`,
  },
  {
    tags: ["Abend", "High Protein", "Schnell"],
    text: `Lachs mit Ofen-Süßkartoffeln
Zutaten für 2 Portionen
250 g Lachs
500 g Süßkartoffeln
200 g grüne Bohnen
1 EL Olivenöl
1 Zitrone
Zubereitung
Süßkartoffeln würfeln, mit Öl mischen und 20 Minuten bei 200 Grad backen.
Lachs und Bohnen dazulegen und weitere 12 Minuten garen.
Mit Zitrone beträufeln.`,
  },
  {
    tags: ["Frühstück", "High Protein"],
    text: `Protein-Pancakes
Zutaten für 2 Portionen
80 g Haferflocken
2 Eier
250 g Magerquark
1 Banane
1 Prise Zimt
1 TL Butter
Zubereitung
Alles zu einem glatten Teig mixen.
Kleine Pancakes in Butter von beiden Seiten goldbraun backen.
Pro Portion: 430 kcal, 36 g Protein, 48 g KH, 10 g Fett, 6 g Ballaststoffe`,
  },
];

export function buildSampleRecipes(): Recipe[] {
  const ctx = { mappings: new Map(), customFoods: [] };
  const now = Date.now();
  return SAMPLES.map((s, i) => {
    const p = parseRecipeText(s.text);
    const ingredients = p.ingredients.map((x) => {
      const ing = resolveIngredient(x, ctx);
      return { ...ing, uncertain: false, askState: false };
    });
    return {
      id: uid(),
      title: p.title,
      photos: [],
      tags: s.tags,
      notes: "Beispielrezept",
      servings: p.servings ?? 1,
      ingredients,
      steps: p.steps,
      creatorMacros: p.creatorMacros,
      favorite: i === 1,
      createdAt: now - (SAMPLES.length - i) * 60000,
      updatedAt: now,
      sample: true,
      origin: "manual",
    };
  });
}

export async function addSampleData() {
  const recipes = buildSampleRecipes();
  await db.recipes.bulkAdd(recipes);
  const monday = mondayOf(today());
  const [oats, bowl, curry, salmon, pancakes] = recipes;
  const plan: PlanEntry[] = [];
  const add = (day: number, slot: Slot, r: Recipe, servings = 1) =>
    plan.push({ id: uid(), date: addDays(monday, day), slot, recipeId: r.id, servings });
  for (let d = 0; d < 5; d++) {
    add(d, "breakfast", d % 2 ? pancakes : oats);
    add(d, "lunch", bowl);
    add(d, "dinner", d % 2 ? salmon : curry);
  }
  add(5, "breakfast", pancakes);
  add(5, "dinner", curry, 1.5);
  await db.plan.bulkAdd(plan);
}

export async function removeSampleData() {
  const ids = (await db.recipes.filter((r) => !!r.sample).primaryKeys()) as string[];
  await db.transaction("rw", db.recipes, db.plan, async () => {
    await db.recipes.bulkDelete(ids);
    const entries = await db.plan.where("recipeId").anyOf(ids).primaryKeys();
    await db.plan.bulkDelete(entries as string[]);
  });
  return ids.length;
}
