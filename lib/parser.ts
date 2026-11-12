/**
 * Regelbasierter Rezept-Parser für Social-Media-Captions (Deutsch + Englisch).
 * Keine KI: nur Mustererkennung.
 */
import type { Macros } from "./types";
import { QTY_RE_SRC, UNIT_RE_SRC, normalizeUnit, parseQuantity } from "./units";

export type ParsedIngredient = {
  raw: string;
  name: string;
  amount: number | null;
  unit: string | null;
  /** grams found in parentheses, e.g. "1 cup (90 g) oats" */
  gramsHint: number | null;
  state: "raw" | "cooked" | null;
  uncertain: boolean;
};

export type ParsedRecipe = {
  title: string;
  servings: number | null;
  ingredients: ParsedIngredient[];
  steps: string[];
  /** per serving */
  creatorMacros: Macros | null;
  /** fields the parser wasn't sure about */
  uncertain: { title: boolean; servings: boolean; macros: boolean };
};

// ---------- cleaning ----------

const EMOJI_RE = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}\u{1F3FB}-\u{1F3FF}]/gu;
const BULLET_RE = /^\s*(?:[-–—•·▪▫◦●○■□►▶➤➔→>*✓✔☑]+|\d+\s*[.)](?!\d)|\(\d+\)|step\s*\d+\s*[:.)-]?|schritt\s*\d+\s*[:.)-]?)\s*/i;

const JUNK_RE = new RegExp(
  [
    "link in (?:der )?bio", "speichern nicht vergessen", "nicht vergessen", "\\bfollow\\b", "\\bfolg(?:e|t)\\b", "link in bio", "folg(?:e|t) (?:mir|uns)", "follow (?:me|us|for)", "speicher(?:e|t|n)? (?:dir )?(?:das|dieses|den)",
    "save (?:this|for later|it)", "werbung", "anzeige", "\\bad\\b", "sponsored", "rabatt", "discount", "\\bcode\\b",
    "kommentier", "comment (?:below|\"|')", "teil(?:e|t) (?:das|es) mit", "share (?:this|with)", "markier", "tag (?:a|your|someone)",
    "like (?:for|if)", "mehr rezepte", "more recipes", "auf meinem blog", "on my blog", "abonnier", "subscribe",
    "dm me", "schreib mir", "^#", "^@", "^\\s*$",
  ].join("|"),
  "i",
);

const ING_HEADER_RE = /^(?:zutaten|ingredients?|du brauchst|ihr braucht|you(?:'ll)? need|what you need|einkaufsliste|für (?:den|die|das) [\wäöüß ]+|for the [\w ]+)\s*(?:\(.*\))?\s*[:：]?\s*(.*)$/i;
const STEP_HEADER_RE = /^(?:zubereitung|anleitung|so geht'?s|so wird'?s gemacht|schritte|instructions?|method|directions?|steps|how to(?: make)?|preparation|prep|vorgehen)\s*[:：]?\s*(.*)$/i;
const MACRO_HEADER_RE = /^(?:makros|macros|nährwerte|naehrwerte|nutrition(?:al)?(?: info| facts)?|nutrition per serving|pro portion|per serving)\b/i;

const STATE_COOKED_RE = /\b(gekocht(?:e[rsn]?)?|gegart(?:e[rsn]?)?|cooked|gebraten(?:e[rsn]?)?|gegrillt(?:e[rsn]?)?)\b/i;
const STATE_RAW_RE = /\b(roh(?:e[rsn]?)?|ungekocht(?:e[rsn]?)?|uncooked|raw|dry|dried|trocken(?:e[rsn]?)?|getrocknet(?:e[rsn]?)?)\b/i;

export function cleanLine(line: string): string {
  return line
    .replace(EMOJI_RE, " ")
    .replace(/#[\p{L}\p{N}_]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- macros ----------

const NUMG = `(\\d+(?:[.,]\\d+)?)`;

function num(s: string | undefined): number | null {
  if (!s) return null;
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function findMacro(text: string, words: string, allowShort: string | null): number | null {
  // "Protein: 45g" | "Protein 45 g" | "45g Protein" | "45 g Eiweiß"
  const a = text.match(new RegExp(`(?:${words})\\s*[:=\\-–]?\\s*(?:ca\\.?|~|≈)?\\s*${NUMG}\\s*(?:g|gr|gramm)?\\b`, "i"));
  if (a) return num(a[1]);
  const b = text.match(new RegExp(`${NUMG}\\s*(?:g|gr|gramm)?\\s*(?:${words})(?![a-zäöüß])`, "i"));
  if (b) return num(b[1]);
  if (allowShort) {
    // "P 40" "P: 40g" "40P" "40g P"
    const c = text.match(new RegExp(`(?:^|[\\s/|,(])(?:${allowShort})\\s*[:=]?\\s*${NUMG}\\s*g?(?=$|[\\s/|,)])`));
    if (c) return num(c[1]);
    const d = text.match(new RegExp(`(?:^|[\\s/|,(])${NUMG}\\s*g?\\s*(?:${allowShort})(?=$|[\\s/|,)])`));
    if (d) return num(d[1]);
  }
  return null;
}

export function parseMacros(text: string): { macros: Partial<Macros>; scope: "serving" | "total" | null } {
  const t = text.replace(EMOJI_RE, " ");
  const macros: Partial<Macros> = {};
  const kcalA = t.match(new RegExp(`${NUMG}\\s*(?:kcal|kalorien|calories|cals?|kcals)\\b`, "i"));
  const kcalB = t.match(new RegExp(`(?:kcal|kalorien|calories|energie|energy|cals?)\\s*[:=\\-–]?\\s*(?:ca\\.?|~)?\\s*${NUMG}`, "i"));
  const kcal = num(kcalA?.[1]) ?? num(kcalB?.[1]);
  if (kcal != null) macros.kcal = kcal;
  const p = findMacro(t, "protein|proteine|eiweiß|eiweiss|prot", "P");
  if (p != null) macros.protein = p;
  const c = findMacro(t, "kohlenhydrate|kohlenhydraten|carbs?|carbohydrates?|kh", "C|K");
  if (c != null) macros.carbs = c;
  const f = findMacro(t, "fett|fat|fats", "F");
  if (f != null) macros.fat = f;
  const fi = findMacro(t, "ballaststoffe|fiber|fibre|ballast", null);
  if (fi != null) macros.fiber = fi;

  let scope: "serving" | "total" | null = null;
  if (/(pro|je|per|each|a) ?(portion|serving|stück|piece|bowl|riegel|bar|muffin|wrap)|\/ ?portion|per serve/i.test(t)) scope = "serving";
  else if (/(gesamt|insgesamt|total|whole recipe|ganze[sn]? rezept|komplett)/i.test(t)) scope = "total";
  return { macros, scope };
}

function looksLikeMacroLine(line: string): boolean {
  const { macros } = parseMacros(line);
  const n = Object.keys(macros).length;
  if (n >= 2) return true;
  if (n === 1 && (macros.kcal != null || macros.protein != null) && line.length < 60 && !ingredientStartRe.test(line)) return true;
  return false;
}

// ---------- servings ----------

export function parseServings(text: string): number | null {
  const res = [
    /(?:für|ergibt|reicht für|macht|makes|serves|yields?|servings?|portionen)\s*[:=]?\s*(?:ca\.?\s*)?(\d+)(?:\s*(?:-|–|bis)\s*\d+)?\s*(?:portionen|portion|personen|servings?|people|persons|stück|pieces|bowls?|wraps?|muffins?|riegel|bars?)?/i,
    /(\d+)\s*(?:portionen|servings|portions|personen|people)\b/i,
  ];
  for (const re of res) {
    const m = text.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > 0 && n <= 50) return n;
    }
  }
  return null;
}

// ---------- ingredients ----------

const ingredientStartRe = new RegExp(`^(?:ca\\.?\\s*|~\\s*|etwa\\s*)?${QTY_RE_SRC}\\s*(?:${UNIT_RE_SRC}\\b\\.?)?`, "i");
const LEAD_RE = new RegExp(`^(?:ca\\.?\\s*|~\\s*|etwa\\s*|about\\s*)?(${QTY_RE_SRC})\\s*(${UNIT_RE_SRC}(?=[\\s.,)(]|$)\\.?)?\\s*(?:of\\s+|von\\s+)?(.*)$`, "i");
const TRAIL_RE = new RegExp(`^(.*?)[\\s:,–-]+(?:ca\\.?\\s*)?(${QTY_RE_SRC})\\s*(${UNIT_RE_SRC})?\\.?\\s*$`, "i");
const UNIT_ONLY_LEAD_RE = new RegExp(`^(?:a|an|ein|eine|einen|1)?\\s*(prise|pinch|schuss|spritzer|dash|splash|handvoll|handful|bund|bunch|etwas|some)\\s+(?:of\\s+)?(.*)$`, "i");
const PAREN_G_RE = /\(\s*(?:ca\.?\s*|~\s*|about\s*)?(\d+(?:[.,]\d+)?)\s*(g|gr|ml|oz|ounces?)\s*\)/i;

const NAME_NOISE = /\b(?:optional|nach belieben|nach geschmack|to taste|zum (?:anbraten|garnieren|servieren|bestreuen)|for (?:serving|garnish|frying)|etwas|some|ca\.?|about|frisch(?:e[rsn]?)?|fresh|große?n?|kleine?n?|mittelgroße?n?|large|small|medium|fein(?:e[rsn]?)?|grob(?:e[rsn]?)?|gehackt(?:e[rsn]?)?|gewürfelt(?:e[rsn]?)?|geschnitten(?:e[rsn]?)?|chopped|diced|sliced|minced|grated|gerieben(?:e[rsn]?)?|bio|organic|tk|frozen|tiefgekühlt(?:e[rsn]?)?|reife?n?|ripe)\b/gi;

export function cleanIngredientName(name: string): string {
  return name
    .replace(/\(.*?\)/g, " ")
    .replace(/\s*,.*$/, "") // ", gewürfelt"
    .replace(/\s+-\s+.*$/, "")
    .replace(/[*_~]/g, "")
    .replace(/[:.;]+$/, "")
    .replace(/^\s*(?:of|von|an?)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseIngredientLine(rawLine: string): ParsedIngredient | null {
  let line = cleanLine(rawLine).replace(BULLET_RE, "").trim();
  // "juice of 1 lime", "Saft einer Zitrone"
  const juice = line.match(/^(?:the\s+)?juice\s+(?:of|from)\s+(\S+)\s+(lemons?|limes?|oranges?)\b/i) ?? line.match(/^(?:den\s+)?saft\s+(?:von\s+|aus\s+)?(\S+)\s+(zitronen?|limetten?|orangen?)\b/i);
  if (juice) {
    const n = WORD_NUM[juice[1].toLowerCase()] ?? juice[1];
    const fruit = juice[2].toLowerCase();
    const name = /orange/.test(fruit) ? "Orangensaft" : /lim/.test(fruit) ? "Limettensaft" : "Zitronensaft";
    line = `${n} Stück ${name}`;
  }
  // "one onion", "a pinch of salt", "zwei Eier" -> digits
  line = wordNumToDigit(line);
  if (!line || line.length > 140) return null;
  const raw = line;
  const gramsHintM = line.match(PAREN_G_RE);
  let gramsHint = gramsHintM ? num(gramsHintM[1]) : null;
  if (gramsHint != null && /^oz|^ounce/i.test(gramsHintM![2])) gramsHint = Math.round(gramsHint * 28.35);
  const stateM = STATE_COOKED_RE.test(line) ? "cooked" : STATE_RAW_RE.test(line) ? "raw" : null;

  let amount: number | null = null;
  let unit: string | null = null;
  let name = line;
  let uncertain = false;

  line = line.replace(/(\d)([a-zA-ZäöüÄÖÜ])/g, "$1 $2"); // "200g" -> "200 g"
  const lead = line.match(LEAD_RE);
  if (lead && lead[3] !== undefined && /\p{L}/u.test(lead[3])) {
    const q = parseQuantity(lead[1]);
    amount = q?.value ?? null;
    if (q?.range) uncertain = true;
    unit = normalizeUnit(lead[2]?.replace(/\.$/, "")) ?? (lead[2] ? null : null);
    name = lead[3];
  } else {
    const trail = line.match(TRAIL_RE);
    if (trail && /\p{L}/u.test(trail[1]) && !/^\d/.test(trail[1])) {
      const q = parseQuantity(trail[2]);
      amount = q?.value ?? null;
      if (q?.range) uncertain = true;
      unit = normalizeUnit(trail[3]);
      name = trail[1];
    } else {
      const u = line.match(UNIT_ONLY_LEAD_RE);
      if (u) {
        const w = u[1].toLowerCase();
        if (w === "etwas" || w === "some") {
          name = u[2];
          uncertain = true;
        } else {
          amount = 1;
          unit = normalizeUnit(w);
          name = u[2];
        }
      } else {
        uncertain = true;
      }
    }
  }

  // "2 Knoblauchzehen" -> unit Zehe
  if (unit == null && /zehen?\b/i.test(name) && /knoblauch/i.test(name)) unit = "Zehe";
  if (unit == null && amount != null) unit = "Stück";

  name = cleanIngredientName(name);
  if (!name || !/\p{L}{2,}/u.test(name)) return null;
  // "Salz und Pfeffer" etc. — fine as no-quantity ingredient
  if (amount == null && gramsHint == null) uncertain = true;
  return { raw, name, amount, unit, gramsHint, state: stateM, uncertain };
}

function looksLikeIngredient(line: string): boolean {
  const l = wordNumToDigit(cleanLine(line).replace(BULLET_RE, "").trim()).replace(/(\d)([a-zA-ZäöüÄÖÜ])/g, "$1 $2");
  if (l.length > 90) return false;
  if (ingredientStartRe.test(l)) {
    // a sentence with a verb is more likely a step ("2 Minuten kochen")
    if (/\b(minuten?|min\.?|minutes?|stunden?|hours?|grad|°|degrees)\b/i.test(l)) return false;
    return true;
  }
  if (/^(?:the\s+)?juice\s+(?:of|from)\s+\S+\s+(?:lemons?|limes?|oranges?)\b|^(?:den\s+)?saft\s+(?:von\s+|aus\s+)?\S+\s+(?:zitronen?|limetten?|orangen?)\b/i.test(l)) return true;
  if (UNIT_ONLY_LEAD_RE.test(l) && l.split(" ").length <= 6 && !/^(etwas|some)\b/i.test(l)) return true;
  if (new RegExp(`[\\s:]${QTY_RE_SRC}\\s*(?:${UNIT_RE_SRC})\\.?\\s*$`, "i").test(l) && l.split(" ").length <= 6) return true;
  return false;
}

function looksLikeStep(line: string): boolean {
  const raw = cleanLine(line);
  const bulleted = /^\s*[-–—•·▪▫◦●○■□►▶➤➔→>*✓✔☑]/.test(raw);
  const l = raw.replace(BULLET_RE, "").trim();
  if (l.length <= 25 || !/\s/.test(l)) return false;
  const words = l.split(" ").length;
  if (/[.!]$/.test(l)) return true;
  return bulleted ? words >= 10 : words >= 7;
}

/** "Sauce:", "Für das Dressing:", "Topping" – short sub-heading inside the ingredient list */
function isSubHeading(line: string): boolean {
  const l = cleanLine(line).replace(BULLET_RE, "").trim();
  return /^[\p{L} &/-]{3,30}:$/u.test(l) && l.split(" ").length <= 4;
}

function wordNumToDigit(line: string): string {
  return line.replace(/^([\p{L}]+)\s+(?=\S)/u, (m, w: string) => (WORD_NUM[w.toLowerCase()] ? WORD_NUM[w.toLowerCase()] + " " : m));
}

const WORD_NUM: Record<string, string> = {
  a: "1", an: "1", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10", twelve: "12", dozen: "12", half: "½",
  ein: "1", eine: "1", einen: "1", einem: "1", einer: "1", zwei: "2", drei: "3", vier: "4", "fünf": "5", sechs: "6", acht: "8", zehn: "10", halbe: "½", halber: "½", halbes: "½",
};

/** Split "200g Quark, 1 Banane, 30g Haferflocken" into separate lines */
function splitInlineList(text: string): string[] {
  const parts = text.split(/\s*(?:,|;|\s\+\s|\s\|\s)\s*/).filter(Boolean);
  if (parts.length >= 2 && parts.filter((p) => looksLikeIngredient(p)).length >= 2) return parts;
  return [text];
}

// ---------- main ----------

export function parseRecipeText(input: string, opts: { titleHint?: string } = {}): ParsedRecipe {
  const text = input.replace(/\r/g, "").replace(/\u2028/g, "\n");
  const rawLines = text.split("\n");
  const ingredients: ParsedIngredient[] = [];
  const steps: string[] = [];
  let title = "";
  let titleUncertain = false;
  let section: "none" | "ing" | "steps" | "macros" = "none";
  const macroLines: string[] = [];
  const leftovers: string[] = [];

  // Titel: erste sinnvolle Zeile
  let titleIdx = -1;
  for (let i = 0; i < rawLines.length; i++) {
    const l = cleanLine(rawLines[i]);
    if (!l) continue;
    const junkAt = l.search(JUNK_RE);
    if (junkAt === 0) continue;
    if (ING_HEADER_RE.test(l) || STEP_HEADER_RE.test(l) || ingredientStartRe.test(l.replace(BULLET_RE, ""))) break;
    if (looksLikeMacroLine(l) && !/\p{L}{4,}.*\p{L}{4,}/u.test(l.replace(/kcal|protein|carbs|fett|fat|kalorien|calories/gi, ""))) break;
    titleIdx = i;
    title = cleanTitle(junkAt > 0 ? l.slice(0, junkAt) : l);
    break;
  }
  if (title.length > 70) {
    title = title.slice(0, 70).replace(/\s+\S*$/, "") + "…";
    titleUncertain = true;
  }
  if (!title && opts.titleHint) {
    title = cleanTitle(opts.titleHint);
    titleUncertain = true;
  }
  if (!title) {
    title = "Neues Rezept";
    titleUncertain = true;
  }

  for (let i = 0; i < rawLines.length; i++) {
    const rl = rawLines[i];
    const l = cleanLine(rl);
    if (!l) continue;
    if (i === titleIdx) {
      // the title line might also contain macros, e.g. "Protein Bowl (520 kcal, 45g P)"
      if (looksLikeMacroLine(l)) macroLines.push(l);
      continue;
    }
    if (MACRO_HEADER_RE.test(l) || looksLikeMacroLine(l)) {
      macroLines.push(l);
      if (MACRO_HEADER_RE.test(l) && !looksLikeMacroLine(l)) section = "macros";
      continue;
    }
    if (JUNK_RE.test(l) && !looksLikeIngredient(l)) continue;

    if ((section === "ing" || section === "none") && isSubHeading(l) && !STEP_HEADER_RE.test(l)) {
      section = "ing";
      continue;
    }
    const ih = l.match(ING_HEADER_RE);
    if (ih && l.length < 60 + (ih[1]?.length ?? 0)) {
      section = "ing";
      if (ih[1] && !(parseServings(ih[1]) != null && ih[1].length < 40)) for (const p of splitInlineList(ih[1])) pushIng(p);
      continue;
    }
    const sh = l.match(STEP_HEADER_RE);
    if (sh && (l.length < 40 || /[:：]/.test(l.slice(0, 25)))) {
      section = "steps";
      if (sh[1] && sh[1].length > 3) steps.push(cleanStep(sh[1]));
      continue;
    }
    // lines that only state the servings ("Makes 4 servings.", "ergibt 4 Portionen")
    if (l.length < 40 && parseServings(l) != null && !/\b(?:g|ml|el|tl|tbsp|tsp)\b/i.test(l.replace(/\d+\s*(portionen|servings?)/i, ""))) continue;
    if (section === "macros") {
      if (Object.keys(parseMacros(l).macros).length) {
        macroLines.push(l);
        continue;
      }
      section = "none";
    }

    if (section === "ing") {
      if (!looksLikeIngredient(l) && looksLikeStep(l)) {
        section = "steps";
        steps.push(cleanStep(l));
        continue;
      }
      for (const p of splitInlineList(l)) pushIng(p);
      continue;
    }
    if (section === "steps") {
      if (looksLikeIngredient(l) && !looksLikeStep(l)) {
        pushIng(l);
        continue;
      }
      steps.push(cleanStep(l));
      continue;
    }
    // no section yet: decide per line
    const parts = splitInlineList(l);
    if (parts.length > 1) {
      for (const p of parts) pushIng(p);
    } else if (looksLikeIngredient(l)) {
      pushIng(l);
    } else if (/^\s*(?:\d+\s*[.)]|step\s*\d|schritt\s*\d)/i.test(rl) || looksLikeStep(l)) {
      steps.push(cleanStep(l));
    } else {
      leftovers.push(l);
    }
  }

  function pushIng(line: string) {
    const ing = parseIngredientLine(line);
    if (ing) ingredients.push(ing);
  }

  // Portionen
  let servings = parseServings(text);
  if (servings == null && titleIdx >= 0) {
    const m = cleanLine(rawLines[titleIdx]).match(/(\d+)\s*(?:stück|pieces|wraps|muffins|riegel|bars|bowls|portionen)\b/i);
    if (m && +m[1] > 0 && +m[1] <= 50) servings = +m[1];
  }

  // Makros
  let creatorMacros: Macros | null = null;
  let macrosUncertain = false;
  if (macroLines.length) {
    const joined = macroLines.join(" | ");
    const { macros, scope } = parseMacros(joined);
    if (Object.keys(macros).length >= 2 || macros.kcal != null) {
      const m: Macros = {
        kcal: macros.kcal ?? 0,
        protein: macros.protein ?? 0,
        carbs: macros.carbs ?? 0,
        fat: macros.fat ?? 0,
        fiber: macros.fiber ?? 0,
      };
      if (macros.kcal == null) {
        m.kcal = Math.round(m.protein * 4 + m.carbs * 4 + m.fat * 9);
        macrosUncertain = true;
      }
      if (macros.protein == null || macros.carbs == null || macros.fat == null) macrosUncertain = true;
      if (scope === "total" && servings && servings > 1) {
        for (const k of Object.keys(m) as (keyof Macros)[]) m[k] = Math.round((m[k] / servings) * 10) / 10;
      }
      if (scope == null && servings && servings > 1) macrosUncertain = true;
      creatorMacros = m;
    }
  }

  return {
    title,
    servings,
    ingredients,
    steps: steps.filter((s) => s.length > 2),
    creatorMacros,
    uncertain: { title: titleUncertain, servings: servings == null, macros: macrosUncertain },
  };
}

function cleanTitle(t: string): string {
  let s = t.replace(/^(?:rezept|recipe)\s*[:\-–]\s*/i, "");
  s = s.split(/(?<=[!?.:])\s|\s[|–—-]\s/)[0];
  s = s
    .replace(/\(.*?\)/g, " ")
    .replace(/\b(?:ready in|fertig in) \d+.*$/i, "")
    .replace(/\s*[-–|,]?\s*\b(?:makes|serves|yields?|für|ergibt|reicht für)\s+\d+\b.*$/i, "")
    .replace(/\s*(?:only|nur|just|under|unter)?\s*\d+\s*(?:kcal|cals?|calories|kalorien|g protein)\b.*$/i, "")
    .replace(/\s+(?:recipe|rezept)\s*$/i, "")
    .replace(/[!?.:,]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return s;
}

function cleanStep(l: string): string {
  return cleanLine(l).replace(BULLET_RE, "").trim();
}
