"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "../icons";
import { Screen, SheetHeader, SwipeRow, useNav } from "../nav";
import { Chip, EmptyState, Button, IconButton, RecipeImage, Segmented, Stepper, cx } from "../ui";
import { ImportSheet } from "./ImportSheet";
import { db } from "@/lib/db";
import { useRecipes } from "@/lib/hooks";
import { perServing, proteinPer100kcal } from "@/lib/nutrition";
import { planCounts } from "@/lib/plan";
import type { Macros, Recipe } from "@/lib/types";
import { haptic } from "@/lib/util";

type Sort = "density" | "kcal" | "recent" | "planned";
const SORTS: { value: Sort; label: string }[] = [
  { value: "recent", label: "Zuletzt hinzugefügt" },
  { value: "density", label: "Protein pro 100 kcal" },
  { value: "kcal", label: "Kalorien (wenig zuerst)" },
  { value: "planned", label: "Am häufigsten geplant" },
];

export function RecipesScreen() {
  const nav = useNav();
  const recipes = useRecipes();
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [favOnly, setFavOnly] = useState(false);
  const [sort, setSort] = useState<Sort>(() => {
    try {
      return (localStorage.getItem("recipeSort") as Sort) || "recent";
    } catch {
      return "recent";
    }
  });
  const [counts, setCounts] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    planCounts().then(setCounts);
  }, [recipes]);

  const tags = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of recipes ?? []) for (const t of r.tags) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [recipes]);

  const list = useMemo(() => {
    const k = q.trim().toLowerCase();
    let out = (recipes ?? []).filter(
      (r) =>
        (!k || r.title.toLowerCase().includes(k) || r.ingredients.some((i) => i.name.toLowerCase().includes(k)) || r.tags.some((t) => t.toLowerCase().includes(k))) &&
        (!tag || r.tags.includes(tag)) &&
        (!favOnly || r.favorite),
    );
    const ps = new Map(out.map((r) => [r.id, perServing(r)]));
    out = out.sort((a, b) => {
      switch (sort) {
        case "density":
          return proteinPer100kcal(ps.get(b.id)!) - proteinPer100kcal(ps.get(a.id)!);
        case "kcal":
          return ps.get(a.id)!.kcal - ps.get(b.id)!.kcal;
        case "planned":
          return (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0);
        default:
          return b.createdAt - a.createdAt;
      }
    });
    return out.map((r) => ({ r, m: ps.get(r.id)! }));
  }, [recipes, q, tag, favOnly, sort, counts]);

  const remove = async (r: Recipe) => {
    const entries = await db.plan.where("recipeId").equals(r.id).toArray();
    await db.recipes.delete(r.id);
    await db.plan.bulkDelete(entries.map((e) => e.id));
    nav.toast(`„${r.title}“ gelöscht`, async () => {
      await db.recipes.put(r);
      await db.plan.bulkPut(entries);
    });
  };

  const sortSheet = () =>
    nav.openSheet((close) => (
      <div className="px-4">
        <SheetHeader title="Sortieren" />
        <div className="divide-y divide-line overflow-hidden rounded-[16px] bg-card">
          {SORTS.map((s) => (
            <button
              key={s.value}
              onClick={() => {
                setSort(s.value);
                try {
                  localStorage.setItem("recipeSort", s.value);
                } catch {}
                close();
              }}
              className="flex w-full items-center justify-between px-4 py-3.5 text-left text-[16px]"
            >
              {s.label}
              {sort === s.value && <Icon name="check" size={20} className="text-accent" />}
            </button>
          ))}
        </div>
      </div>
    ));

  return (
    <Screen
      title="Rezepte"
      left={<IconButton name="gear" label="Einstellungen" onClick={() => nav.push({ name: "settings" })} />}
      right={<IconButton name="sort" label="Sortieren" onClick={sortSheet} />}
    >
      <div className="relative mb-3">
        <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rezepte, Zutaten, Tags" className="field rounded-[12px]! border-transparent! pl-9" type="search" />
      </div>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: "none" }}>
        <Chip active={favOnly} onClick={() => setFavOnly(!favOnly)}>
          ♥ Favoriten
        </Chip>
        {tags.map((t) => (
          <Chip key={t} active={tag === t} onClick={() => setTag(tag === t ? null : t)}>
            {t}
          </Chip>
        ))}
      </div>
      {recipes && recipes.length === 0 ? (
        <EmptyState
          icon="book"
          title="Noch keine Rezepte"
          text="Tippe auf das orange Plus und füge einen kopierten Rezepttext ein oder lege ein Rezept selbst an."
          action={<Button onClick={() => nav.openSheet((close) => <ImportSheet close={close} />)}>Erstes Rezept hinzufügen</Button>}
        />
      ) : list.length === 0 && recipes ? (
        <p className="py-12 text-center text-muted">Keine Treffer.</p>
      ) : (
        <>
          <p className="mb-2 px-1 text-[12px] text-muted">
            {list.length} {list.length === 1 ? "Rezept" : "Rezepte"} · {SORTS.find((s) => s.value === sort)?.label} · nach links wischen zum Löschen
          </p>
          <div className="grid grid-cols-2 gap-3">
            {list.map(({ r, m }, i) => (
              <SwipeRow key={r.id} className="rounded-[18px] bg-card" actions={[{ label: "Löschen", color: "var(--color-danger)", onAction: () => remove(r) }]}>
                <button
                  onClick={() => {
                    haptic();
                    nav.push({ name: "recipe", id: r.id });
                  }}
                  className="anim-pop-in block w-full bg-card text-left"
                  style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                >
                  <div className="relative">
                    <RecipeImage src={r.photos[0]} title={r.title} className="aspect-[4/5] w-full" rounded="rounded-t-[18px]" />
                    {r.favorite && (
                      <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/45 text-accent backdrop-blur">
                        <Icon name="heart" size={15} fill="currentColor" />
                      </span>
                    )}
                  </div>
                  <div className="px-3 pb-3 pt-2.5">
                    <div className="line-clamp-2 min-h-[40px] text-[15px] font-semibold leading-tight">{r.title}</div>
                    <div className="tnum mt-1.5 flex items-center gap-2 text-[13px]">
                      <span className="font-semibold">{Math.round(m.kcal)} kcal</span>
                      <span className="text-protein font-semibold">{Math.round(m.protein)} g P</span>
                    </div>
                  </div>
                </button>
              </SwipeRow>
            ))}
          </div>
        </>
      )}
    </Screen>
  );
}

/** Rezeptauswahl für einen Slot, mit „Passt noch rein“-Sortierung nach verbleibenden Makros. */
export function RecipePicker({ remaining, onPick, close, title = "Rezept wählen" }: { remaining: Macros | null; onPick: (r: Recipe, servings: number) => void; close: () => void; title?: string }) {
  const recipes = useRecipes() ?? [];
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"fit" | "all">(remaining ? "fit" : "all");
  const [servings, setServings] = useState(1);

  const list = useMemo(() => {
    const k = q.trim().toLowerCase();
    const items = recipes
      .filter((r) => !k || r.title.toLowerCase().includes(k) || r.tags.some((t) => t.toLowerCase().includes(k)))
      .map((r) => {
        const m = perServing(r);
        const kcal = m.kcal * servings;
        const p = m.protein * servings;
        let score = 0;
        let fits = true;
        if (remaining) {
          fits = kcal <= remaining.kcal + 60;
          const pShare = remaining.protein > 0 ? Math.min(p / remaining.protein, 1) : 0;
          const kShare = remaining.kcal > 0 ? kcal / remaining.kcal : 9;
          // gut: viel vom fehlenden Protein, wenig Kalorien-Überschuss
          score = pShare * 2 - Math.max(0, kShare - 1) * 4 + (fits ? 1 : 0) + proteinPer100kcal(m) / 20;
        }
        return { r, m, fits, score };
      });
    if (mode === "fit") items.sort((a, b) => b.score - a.score);
    else items.sort((a, b) => a.r.title.localeCompare(b.r.title, "de"));
    return items;
  }, [recipes, q, mode, remaining, servings]);

  return (
    <div>
      <SheetHeader title={title} onClose={close} />
      <div className="px-4">
        <div className="relative mb-3">
          <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suchen" className="field pl-9" />
        </div>
        {remaining && (
          <div className="mb-3 flex items-center justify-between gap-3">
            <Segmented
              className="flex-1"
              value={mode}
              onChange={setMode}
              options={[
                { value: "fit", label: "Passt noch rein" },
                { value: "all", label: "A–Z" },
              ]}
            />
          </div>
        )}
        <div className="mb-3 flex items-center justify-between rounded-[14px] bg-card px-4 py-2">
          <span className="text-[15px]">Portionen</span>
          <Stepper value={servings} min={0.5} step={0.5} onChange={setServings} />
        </div>
        {remaining && (
          <p className="tnum mb-2 px-1 text-[13px] text-muted">
            Noch offen heute: <b className="text-white">{Math.max(0, Math.round(remaining.kcal))} kcal</b> · {Math.max(0, Math.round(remaining.protein))} g Protein
          </p>
        )}
      </div>
      <div className="divide-y divide-line">
        {list.map(({ r, m, fits }) => (
          <button
            key={r.id}
            onClick={() => {
              haptic();
              onPick(r, servings);
              close();
            }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-white/5"
          >
            <RecipeImage src={r.photos[0]} title={r.title} className="h-12 w-12 shrink-0" rounded="rounded-[11px]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium">{r.title}</span>
              <span className="tnum text-[13px] text-muted">
                {Math.round(m.kcal * servings)} kcal · <span className="text-protein">{Math.round(m.protein * servings)} g P</span>
              </span>
            </span>
            {remaining && mode === "fit" && (
              <span className={cx("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", fits ? "bg-ok/15 text-ok" : "bg-danger/15 text-danger")}>{fits ? "passt" : "zu viel"}</span>
            )}
          </button>
        ))}
        {!list.length && <p className="px-4 py-8 text-center text-muted">Noch keine Rezepte vorhanden.</p>}
      </div>
    </div>
  );
}
