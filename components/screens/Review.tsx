"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../icons";
import { Screen, SheetHeader, useNav } from "../nav";
import { Button, Chip, MACRO_META, NumberField, RecipeImage, Segmented, Stepper, Toggle, cx } from "../ui";
import { FoodPicker } from "./FoodPicker";
import { db } from "@/lib/db";
import { variantOf } from "@/lib/foods-base";
import { loadMatchContext } from "@/lib/hooks";
import { dropDraft, getDraft, type Draft } from "@/lib/importer";
import { baseToRef, computedTotal, gramsFor, normKey, resolveIngredient, scaleMacros } from "@/lib/nutrition";
import { parseIngredientLine, parseRecipeText } from "@/lib/parser";
import type { FoodRef, Ingredient, Macros, Recipe } from "@/lib/types";
import { UNITS_FOR_UI, fmtAmount } from "@/lib/units";
import { compressImage, similarity } from "@/lib/util";

const TAG_SUGGESTIONS = ["Frühstück", "Mittag", "Abend", "High Protein", "Meal Prep", "Schnell", "Vegetarisch"];

const SOURCE_LABEL: Record<string, string> = { base: "Basis", custom: "Eigen", off: "OFF", none: "–" };

function recalc(ing: Ingredient, overrides: Record<string, number>): Ingredient {
  const { grams } = gramsFor(ing.amount, ing.unit, ing.food, overrides);
  return { ...ing, grams: Math.round(grams * 10) / 10, pieces: ing.unit === "Stück" && ing.amount != null ? ing.amount : undefined };
}

export function ReviewScreen({ draftId }: { draftId: string }) {
  const nav = useNav();
  const draft = getDraft(draftId);
  const [r, setR] = useState<Recipe | null>(draft?.recipe ?? null);
  const [unc, setUnc] = useState(draft?.uncertain ?? { title: false, servings: false, macros: false });
  const [useCreator, setUseCreator] = useState(!!draft?.recipe.creatorMacros);
  const [creator, setCreator] = useState<Macros>(draft?.recipe.creatorMacros ?? { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [quick, setQuick] = useState("");
  const [newTag, setNewTag] = useState("");
  const [extra, setExtra] = useState("");
  const quickRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    db.settings.get("main").then((s) => setOverrides(s?.unitOverrides ?? {}));
  }, []);

  const computed = useMemo(() => (r ? scaleMacros(computedTotal(r.ingredients), 1 / Math.max(r.servings, 0.1)) : null), [r]);

  if (!draft || !r || !computed) {
    return (
      <Screen title="Prüfen" back>
        <p className="py-10 text-center text-muted">Dieser Entwurf ist nicht mehr verfügbar.</p>
      </Screen>
    );
  }

  const update = (patch: Partial<Recipe>) => setR((x) => (x ? { ...x, ...patch } : x));
  const updateIng = (id: string, fn: (i: Ingredient) => Ingredient) => setR((x) => (x ? { ...x, ingredients: x.ingredients.map((i) => (i.id === id ? fn(i) : i)) } : x));
  const removeIng = (id: string) => setR((x) => (x ? { ...x, ingredients: x.ingredients.filter((i) => i.id !== id) } : x));

  const addQuick = async () => {
    const line = quick.trim();
    if (!line) return;
    const p = parseIngredientLine(line);
    if (!p) return;
    const ctx = await loadMatchContext();
    const ing = resolveIngredient(p, ctx);
    setR((x) => (x ? { ...x, ingredients: [...x.ingredients, ing] } : x));
    setQuick("");
    quickRef.current?.focus();
  };

  const mergeExtra = async () => {
    const text = extra.trim();
    if (!text) return;
    const p = parseRecipeText(text);
    const ctx = await loadMatchContext();
    const ings = p.ingredients.map((x) => resolveIngredient(x, ctx));
    if (!ings.length && !p.steps.length) {
      nav.toast("Darin habe ich keine Zutaten gefunden");
      return;
    }
    setR((x) =>
      x
        ? {
            ...x,
            ingredients: [...x.ingredients, ...ings],
            steps: x.steps.length ? x.steps : p.steps,
            servings: unc.servings && p.servings ? p.servings : x.servings,
          }
        : x,
    );
    if (p.servings && unc.servings) setUnc((u) => ({ ...u, servings: false }));
    if (p.creatorMacros && !useCreator) {
      setCreator(p.creatorMacros);
      setUseCreator(true);
    }
    setExtra("");
    nav.toast(`${ings.length} Zutaten erkannt`);
  };

  const learnMapping = async (ing: Ingredient, food: FoodRef) => {
    const key = normKey(ing.name);
    if (key) await db.mappings.put({ key, food });
  };

  const openIngredient = (ing: Ingredient) => {
    nav.openSheet((close) => (
      <IngredientEditor
        ing={ing}
        overrides={overrides}
        close={close}
        onChange={(next, mappedFood) => {
          updateIng(ing.id, () => next);
          if (mappedFood) learnMapping(next, mappedFood);
        }}
        onDelete={() => removeIng(ing.id)}
        onUnitOverride={async (key, g) => {
          const s = await db.settings.get("main");
          const unitOverrides = { ...(s?.unitOverrides ?? {}), [key]: g };
          if (s) await db.settings.put({ ...s, unitOverrides });
          setOverrides(unitOverrides);
        }}
      />
    ));
  };

  const finalRecipe = (): Recipe => ({
    ...r,
    title: r.title.trim() || "Neues Rezept",
    steps: r.steps.map((s) => s.trim()).filter(Boolean),
    creatorMacros: useCreator && creator.kcal > 0 ? creator : null,
    ingredients: r.ingredients.map((i) => ({ ...i, uncertain: false, askState: false })),
    updatedAt: Date.now(),
  });

  const doSave = async (rec: Recipe, replaceId?: string) => {
    if (replaceId) {
      const old = await db.recipes.get(replaceId);
      await db.recipes.put({ ...rec, id: replaceId, favorite: old?.favorite ?? rec.favorite, createdAt: old?.createdAt ?? rec.createdAt });
    } else await db.recipes.put(rec);
    dropDraft(draft.id);
    nav.pop();
    if (!draft.editId) {
      setTimeout(() => nav.push({ name: "recipe", id: replaceId ?? rec.id }), 320);
      nav.toast(replaceId ? "Rezept ersetzt" : "Rezept gespeichert");
    } else nav.toast("Änderungen gespeichert");
  };

  const save = async () => {
    const rec = finalRecipe();
    if (draft.editId) return doSave(rec, draft.editId);
    const all = await db.recipes.toArray();
    const ids = new Set(rec.ingredients.map((i) => i.food?.id).filter(Boolean));
    const normT = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const dupe = all.find((o) => {
      const a = normT(o.title);
      const b = normT(rec.title);
      if (similarity(a, b) > 0.75) return true;
      if (a.length >= 8 && b.length >= 8 && (a.includes(b) || b.includes(a))) return true;
      const oids = new Set(o.ingredients.map((i) => i.food?.id).filter(Boolean));
      if (ids.size < 3 || oids.size < 3) return false;
      const inter = [...ids].filter((x) => oids.has(x)).length;
      const overlap = inter / Math.min(ids.size, oids.size);
      const jaccard = inter / new Set([...ids, ...oids]).size;
      return overlap >= 0.8 && jaccard >= 0.5;
    });
    if (!dupe) return doSave(rec);
    nav.openSheet((close) => (
      <div className="px-4">
        <SheetHeader title="Schon vorhanden?" />
        <div className="mb-4 flex items-center gap-3 rounded-[16px] bg-card p-3">
          <RecipeImage src={dupe.photos[0]} title={dupe.title} className="h-14 w-14 shrink-0" rounded="rounded-[12px]" />
          <div className="min-w-0">
            <div className="truncate text-[16px] font-semibold">{dupe.title}</div>
            <div className="text-[13px] text-muted">Ähnliches Rezept in deinem Rezeptbuch</div>
          </div>
        </div>
        <div className="space-y-2.5">
          <Button className="w-full" onClick={() => (close(), doSave(rec))}>
            Trotzdem speichern
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              close();
              dropDraft(draft.id);
              nav.pop();
              setTimeout(() => nav.push({ name: "recipe", id: dupe.id }), 320);
            }}
          >
            Vorhandenes öffnen
          </Button>
          <Button variant="danger" className="w-full" onClick={() => (close(), doSave(rec, dupe.id))}>
            Ersetzen
          </Button>
        </div>
      </div>
    ));
  };

  const shown = useCreator ? creator : computed;

  return (
    <Screen
      title={draft.editId ? "Bearbeiten" : "Prüfen"}
      back="Abbrechen"
      large={false}
      right={
        <button onClick={save} className="press px-3 text-[17px] font-semibold text-accent">
          Sichern
        </button>
      }
      footer={
        <Button className="w-full" onClick={save} icon="check">
          {draft.editId ? "Änderungen speichern" : "Rezept speichern"}
        </Button>
      }
    >
      {/* Foto */}
      <div className="relative mt-1">
        <button onClick={() => photoRef.current?.click()} className="press block w-full">
          <RecipeImage src={r.photos[0]} title={r.title || "Neu"} className="h-[180px] w-full" rounded="rounded-[20px]" />
          <span className="blurbar absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold">
            <Icon name="camera" size={16} /> {r.photos[0] ? "Foto ändern" : "Foto hinzufügen"}
          </span>
        </button>
        {r.photos[0] && (
          <button onClick={() => update({ photos: r.photos.slice(1) })} className="blurbar absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-full">
            <Icon name="x" size={16} />
          </button>
        )}
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) update({ photos: [await compressImage(f), ...r.photos].slice(0, 4) });
          }}
        />
      </div>

      {draft.source && <p className="mt-3 px-1 text-[13px] text-muted">Importiert aus {draft.source}. Orange markierte Felder bitte kurz prüfen.</p>}

      {draft.rawText !== undefined && r.ingredients.length < 2 && (
        <div className="mt-3 rounded-[18px] border border-accent/40 bg-accent-soft p-4">
          <div className="mb-1 flex items-center gap-2 text-[16px] font-semibold">
            <Icon name="info" size={20} className="text-accent" /> Kein Rezept in der Beschreibung
          </div>
          <p className="mb-3 text-[14px] leading-snug text-white/80">
            {draft.source === "TikTok" && !draft.rawText.trim()
              ? "TikTok hat für dieses Video keine Beschreibung geliefert. Öffne das Video, tippe auf die Beschreibung, halte sie gedrückt und wähle „Kopieren“ – oder kopiere das Rezept aus den Kommentaren – und füge es hier ein."
              : draft.source === "TikTok"
              ? "Die TikTok-Beschreibung enthält keine Zutatenliste – das Rezept steht wohl im Video, in den Kommentaren oder hinter „mehr“. Kopiere den Rezepttext und füge ihn hier ein."
              : "Füge den Rezepttext (Zutaten und Schritte) hier ein."}
          </p>
          <textarea value={extra} onChange={(e) => setExtra(e.target.value)} rows={5} placeholder={"200 g Nudeln\n150 g Hähnchenbrust\n…"} className="field mb-2 resize-none" />
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              icon="clipboard"
              onClick={async () => {
                try {
                  const t = await navigator.clipboard.readText();
                  if (t.trim()) setExtra(t);
                } catch {
                  nav.toast("Bitte lange ins Feld tippen und „Einfügen“ wählen");
                }
              }}
            >
              Einfügen
            </Button>
            <Button disabled={!extra.trim()} onClick={mergeExtra}>
              Erkennen
            </Button>
          </div>
        </div>
      )}
      {draft.rawText !== undefined && (
        <details className="mt-3 rounded-[14px] bg-card px-4 py-2.5 text-[14px]">
          <summary className="cursor-pointer text-muted">Original-Text anzeigen</summary>
          <p className="mt-2 whitespace-pre-wrap leading-relaxed text-white/80">{draft.rawText.trim() || "(leer – die Quelle hat keinen Text geliefert)"}</p>
        </details>
      )}

      {/* Titel & Portionen */}
      <input
        value={r.title}
        onChange={(e) => {
          update({ title: e.target.value });
          setUnc((u) => ({ ...u, title: false }));
        }}
        placeholder="Rezeptname"
        className={cx("field mt-3 text-[20px]! font-semibold", unc.title && "border-accent!")}
      />
      <div className={cx("mt-3 flex items-center justify-between rounded-[16px] bg-card px-4 py-2.5", unc.servings && "ring-1 ring-accent")}>
        <span className="text-[16px]">Portionen</span>
        <Stepper
          value={r.servings}
          min={1}
          onChange={(v) => {
            update({ servings: v });
            setUnc((u) => ({ ...u, servings: false }));
          }}
        />
      </div>

      {/* Makros */}
      <div className={cx("mt-3 rounded-[20px] bg-card p-4", unc.macros && useCreator && "ring-1 ring-accent")}>
        <div className="mb-3 flex items-center justify-between">
          <span className="label">Pro Portion</span>
          <span className="flex items-center gap-2 text-[13px] text-muted">
            Creator-Makros
            <Toggle on={useCreator} onChange={setUseCreator} />
          </span>
        </div>
        <div className="flex items-end gap-4">
          <div>
            <div className="tnum text-[34px] font-bold leading-none">{Math.round(shown.kcal)}</div>
            <div className="label mt-1">kcal</div>
          </div>
          <div className="grid flex-1 grid-cols-4 gap-2">
            {MACRO_META.map((m) => (
              <div key={m.key}>
                <div className="tnum text-[17px] font-semibold" style={{ color: m.color }}>
                  {Math.round(shown[m.key])}
                </div>
                <div className="text-[11px] text-muted">{m.short}</div>
              </div>
            ))}
          </div>
        </div>
        {useCreator && (
          <div className="mt-4 grid grid-cols-5 gap-1.5 border-t border-line pt-3">
            {(["kcal", "protein", "carbs", "fat", "fiber"] as const).map((k) => (
              <label key={k} className="text-center">
                <NumberField value={creator[k]} onChange={(v) => setCreator((c) => ({ ...c, [k]: v }))} className="[&_input]:px-1.5 [&_input]:text-center" />
                <span className="text-[11px] text-muted">{{ kcal: "kcal", protein: "P", carbs: "KH", fat: "F", fiber: "Bst" }[k]}</span>
              </label>
            ))}
            <p className="col-span-5 mt-1 text-[12px] text-muted">
              Berechnet aus Zutaten: {Math.round(computed.kcal)} kcal · P {Math.round(computed.protein)} · KH {Math.round(computed.carbs)} · F {Math.round(computed.fat)}
            </p>
          </div>
        )}
      </div>

      {/* Zutaten */}
      <div className="mb-2 mt-6 flex items-end justify-between px-1">
        <h3 className="label">Zutaten ({r.ingredients.length})</h3>
        <span className="text-[12px] text-muted">Tippen zum Ändern</span>
      </div>
      <div className="divide-y divide-line overflow-hidden rounded-[16px] bg-card">
        {r.ingredients.map((ing) => (
          <div key={ing.id} className={cx("relative", ing.uncertain && "bg-accent/[0.06]")}>
            {ing.uncertain && <span className="absolute inset-y-0 left-0 w-[3px] bg-accent" />}
            <button onClick={() => openIngredient(ing)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-white/5">
              <span className="tnum w-[64px] shrink-0 text-[15px] font-semibold">
                {ing.grams > 0 ? `${Math.round(ing.grams)} g` : <span className="text-accent">? g</span>}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px]">
                  {ing.amount != null && ing.unit !== "g" && <span className="text-muted">{fmtAmount(ing.amount)} {ing.unit === "Stück" ? "" : ing.unit} </span>}
                  {ing.name}
                </span>
                <span className={cx("block truncate text-[12px]", ing.food ? "text-muted" : "text-accent")}>
                  {ing.food ? `→ ${ing.food.name}` : "Kein Lebensmittel zugeordnet"}
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-card2 px-2 py-0.5 text-[11px] font-semibold text-muted">{SOURCE_LABEL[ing.food?.source ?? "none"]}</span>
            </button>
            {ing.askState && ing.food?.source === "base" && (
              <div className="flex items-center gap-3 px-4 pb-3">
                <span className="text-[13px] text-accent">Roh oder gekocht?</span>
                <Segmented
                  className="flex-1"
                  value={ing.food.state ?? "raw"}
                  onChange={(st) => {
                    const v = variantOf(ing.food!.id, st);
                    if (!v) return;
                    updateIng(ing.id, (i) => ({ ...recalc({ ...i, food: baseToRef(v) }, overrides), askState: false, uncertain: false }));
                  }}
                  options={[
                    { value: "raw", label: "Roh" },
                    { value: "cooked", label: "Gekocht" },
                  ]}
                />
              </div>
            )}
          </div>
        ))}
        <div className="flex items-center gap-2 px-3 py-2">
          <Icon name="plus" size={18} className="shrink-0 text-accent" />
          <input
            ref={quickRef}
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addQuick();
              }
            }}
            enterKeyHint="next"
            placeholder="200 g Hähnchenbrust ↵"
            className="min-w-0 flex-1 bg-transparent py-2 outline-none"
          />
          {quick && (
            <button onClick={addQuick} className="text-[15px] font-semibold text-accent">
              Hinzufügen
            </button>
          )}
        </div>
      </div>

      {/* Schritte */}
      <h3 className="label mb-2 mt-6 px-1">Zubereitung</h3>
      <div className="space-y-2">
        {r.steps.map((s, i) => (
          <div key={i} className="flex gap-2">
            <span className="tnum mt-3 w-5 shrink-0 text-center text-[14px] font-bold text-accent">{i + 1}</span>
            <textarea
              value={s}
              rows={Math.max(2, Math.ceil(s.length / 38))}
              onChange={(e) => update({ steps: r.steps.map((x, j) => (j === i ? e.target.value : x)) })}
              className="field resize-none leading-snug"
            />
            <button onClick={() => update({ steps: r.steps.filter((_, j) => j !== i) })} className="mt-2 grid h-9 w-9 shrink-0 place-items-center text-faint">
              <Icon name="x" size={18} />
            </button>
          </div>
        ))}
        <button onClick={() => update({ steps: [...r.steps, ""] })} className="press flex items-center gap-2 px-1 py-2 text-[15px] text-accent">
          <Icon name="plus" size={18} /> Schritt hinzufügen
        </button>
      </div>

      {/* Tags */}
      <h3 className="label mb-2 mt-6 px-1">Tags</h3>
      <div className="flex flex-wrap gap-2">
        {[...new Set([...TAG_SUGGESTIONS, ...r.tags])].map((t) => (
          <Chip key={t} active={r.tags.includes(t)} onClick={() => update({ tags: r.tags.includes(t) ? r.tags.filter((x) => x !== t) : [...r.tags, t] })}>
            {t}
          </Chip>
        ))}
        <input
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newTag.trim()) {
              update({ tags: [...new Set([...r.tags, newTag.trim()])] });
              setNewTag("");
            }
          }}
          placeholder="+ Eigener Tag"
          className="w-[130px] rounded-full border border-dashed border-line bg-transparent px-3.5 py-1.5 outline-none"
        />
      </div>

      <h3 className="label mb-2 mt-6 px-1">Notizen</h3>
      <textarea value={r.notes} onChange={(e) => update({ notes: e.target.value })} rows={3} placeholder="Eigene Notizen …" className="field resize-none" />
    </Screen>
  );
}

function IngredientEditor({
  ing,
  overrides,
  close,
  onChange,
  onDelete,
  onUnitOverride,
}: {
  ing: Ingredient;
  overrides: Record<string, number>;
  close: () => void;
  onChange: (i: Ingredient, mappedFood?: FoodRef) => void;
  onDelete: () => void;
  onUnitOverride: (key: string, grams: number) => void;
}) {
  const nav = useNav();
  const [cur, setCur] = useState<Ingredient>(ing);
  const [mapped, setMapped] = useState<FoodRef | undefined>();
  const [ov, setOv] = useState(overrides);
  const isWeight = !cur.unit || ["g", "kg", "ml", "l", "oz", "lb", "cl", "dl", "mg"].includes(cur.unit);
  const ovKey = cur.food && cur.unit ? `${cur.food.id}|${cur.unit}` : null;
  const perUnit = cur.amount ? cur.grams / cur.amount : 0;

  const apply = (next: Ingredient) => setCur({ ...next, uncertain: false });

  return (
    <div className="px-4">
      <SheetHeader
        title="Zutat"
        onClose={close}
        right={
          <button
            onClick={() => {
              onChange(cur, mapped);
              close();
            }}
            className="press text-[17px] font-semibold text-accent"
          >
            Fertig
          </button>
        }
      />
      <label className="label mb-1 block px-1">Bezeichnung</label>
      <input value={cur.name} onChange={(e) => setCur({ ...cur, name: e.target.value })} className="field mb-4" />

      <label className="label mb-1 block px-1">Menge</label>
      <div className="mb-2 flex gap-2">
        <NumberField
          className="w-28"
          value={cur.amount}
          onChange={(v) => apply(recalc({ ...cur, amount: v }, ov))}
        />
        <select
          value={cur.unit ?? "g"}
          onChange={(e) => apply(recalc({ ...cur, unit: e.target.value, amount: cur.amount ?? 1 }, ov))}
          className="field flex-1"
        >
          {[...new Set([...(cur.unit ? [cur.unit] : []), ...UNITS_FOR_UI])].map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-4 flex items-center justify-between gap-3 rounded-[14px] bg-card px-4 py-2.5">
        <span className="text-[15px] text-muted">Entspricht</span>
        <NumberField className="w-32" value={cur.grams} onChange={(v) => apply({ ...cur, grams: v })} suffix="g" />
      </div>
      {!isWeight && ovKey && cur.amount ? (
        <button
          onClick={() => {
            const g = Math.round(perUnit * 10) / 10;
            onUnitOverride(ovKey, g);
            setOv({ ...ov, [ovKey]: g });
            nav.toast(`Gespeichert: 1 ${cur.unit} ${cur.food?.name} = ${g} g`);
          }}
          className="mb-4 w-full rounded-[14px] border border-dashed border-line px-4 py-2.5 text-left text-[14px] text-muted"
        >
          Als Standard merken: 1 {cur.unit} = {Math.round(perUnit * 10) / 10} g {ov[ovKey] ? "(gespeichert)" : ""}
        </button>
      ) : null}

      <label className="label mb-1 block px-1">Lebensmittel (Nährwertquelle)</label>
      <button
        onClick={() =>
          nav.openSheet(
            (c) => (
              <FoodPicker
                initial={cur.name}
                close={c}
                onPick={(f) => {
                  const next = recalc({ ...cur, food: f, askState: false }, ov);
                  apply(next);
                  setMapped(f);
                }}
              />
            ),
            { full: true },
          )
        }
        className="press mb-2 flex w-full items-center gap-3 rounded-[14px] bg-card px-4 py-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px]">{cur.food?.name ?? "Nicht zugeordnet"}</span>
          {cur.food && (
            <span className="tnum text-[12px] text-muted">
              {SOURCE_LABEL[cur.food.source]} · {Math.round(cur.food.per100.kcal)} kcal · P {cur.food.per100.protein} /100 g
            </span>
          )}
        </span>
        <span className="text-[15px] text-accent">Ändern</span>
      </button>
      {mapped && <p className="mb-2 px-1 text-[12px] text-muted">Wird für „{cur.name}“ bei künftigen Importen gemerkt.</p>}

      <Button
        variant="danger"
        icon="trash"
        className="mt-4 w-full"
        onClick={() => {
          onDelete();
          close();
        }}
      >
        Zutat entfernen
      </Button>
    </div>
  );
}

export type { Draft };
