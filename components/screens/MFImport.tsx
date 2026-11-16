"use client";

import { useMemo, useState } from "react";
import { Icon } from "../icons";
import { SheetHeader, useNav } from "../nav";
import { Button, cx } from "../ui";
import { db } from "@/lib/db";
import type { MFPreview } from "@/lib/mf-import";
import type { Recipe } from "@/lib/types";
import { haptic, similarity } from "@/lib/util";

const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

function findDupe(r: Recipe, existing: Recipe[]): Recipe | undefined {
  const a = norm(r.title);
  return existing.find((o) => {
    const b = norm(o.title);
    return similarity(a, b) > 0.8 || (a.length >= 8 && b.length >= 8 && (a.includes(b) || b.includes(a)));
  });
}

/** Bestätigungsliste für den MacroFactor-Import: alles auswählbar, Duplikate abgewählt. */
export function MFImportSheet({ previews, existing, close }: { previews: MFPreview[]; existing: Recipe[]; close: () => void }) {
  const nav = useNav();
  const items = useMemo(() => previews.map((p) => ({ p, dupe: findDupe(p.recipe, existing) })), [previews, existing]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(items.filter((i) => !i.dupe).map((i) => i.p.recipe.id)));
  const [busy, setBusy] = useState(false);
  const allOn = selected.size === items.length;

  const toggle = (id: string) => {
    haptic();
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const add = async () => {
    setBusy(true);
    const now = Date.now();
    const chosen = items.filter((i) => selected.has(i.p.recipe.id));
    // angehakte Duplikate ersetzen das vorhandene Rezept (gleiche id -> Plan, Favorit bleiben)
    const replaced = chosen.filter((i) => i.dupe).map((i) => i.dupe!);
    const recs = chosen.map((i, k) =>
      i.dupe ? { ...i.p.recipe, id: i.dupe.id, favorite: i.dupe.favorite, photos: i.dupe.photos.length ? i.dupe.photos : i.p.recipe.photos, createdAt: i.dupe.createdAt } : { ...i.p.recipe, createdAt: now - k },
    );
    await db.recipes.bulkPut(recs);
    close();
    nav.setTab("recipes");
    const added = recs.length - replaced.length;
    nav.toast(
      `${added ? `${added} hinzugefügt` : ""}${added && replaced.length ? ", " : ""}${replaced.length ? `${replaced.length} ersetzt` : ""}`,
      async () => {
        await db.recipes.bulkDelete(recs.filter((r) => !replaced.some((d) => d.id === r.id)).map((r) => r.id));
        await db.recipes.bulkPut(replaced);
      },
    );
  };

  return (
    <div>
      <SheetHeader
        title="Aus MacroFactor"
        onClose={close}
        right={
          <button onClick={() => setSelected(allOn ? new Set() : new Set(items.map((i) => i.p.recipe.id)))} className="press text-[15px] text-accent">
            {allOn ? "Keine" : "Alle"}
          </button>
        }
      />
      <p className="px-4 pb-3 text-[14px] leading-snug text-muted">
        {items.length} Rezepte gefunden. Makros pro Portion kommen genau aus MacroFactor. Wähle aus, was du übernehmen willst. Bereits vorhandene Rezepte sind abgewählt – anhaken ersetzt sie (Favorit und Wochenplan bleiben).
      </p>
      <div className="divide-y divide-line">
        {items.map(({ p, dupe }) => {
          const r = p.recipe;
          const on = selected.has(r.id);
          const m = r.creatorMacros;
          return (
            <button key={r.id} onClick={() => toggle(r.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-white/5">
              <span className={cx("grid h-6 w-6 shrink-0 place-items-center rounded-full border-2", on ? "border-accent bg-accent text-black" : "border-white/30")}>
                {on && <Icon name="check" size={14} stroke={3.2} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium">{r.title}</span>
                <span className="tnum block text-[12px] text-muted">
                  {r.servings} {r.servings === 1 ? "Portion" : "Portionen"}
                  {m && (
                    <>
                      {" "}· {m.kcal} kcal · <span className="text-protein">{Math.round(m.protein)} g P</span>
                    </>
                  )}{" "}
                  · {r.ingredients.length} Zutaten
                </span>
                <span className="mt-0.5 flex flex-wrap gap-1.5">
                  {dupe && (
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">{on ? "ersetzt vorhandenes" : "schon vorhanden"}</span>
                  )}
                  {p.missingAmounts > 0 && (
                    <span className="rounded-full bg-card2 px-2 py-0.5 text-[11px] font-semibold text-muted">
                      {p.missingAmounts} {p.missingAmounts === 1 ? "Menge fehlt" : "Mengen fehlen"}
                    </span>
                  )}
                  {r.tags.slice(0, 2).map((t) => (
                    <span key={t} className="rounded-full bg-card2 px-2 py-0.5 text-[11px] text-muted">
                      {t}
                    </span>
                  ))}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="px-4 pt-4">
        <p className="mb-3 text-[12px] leading-snug text-muted">
          Mengen werden so übernommen, wie sie im MacroFactor-Export stehen (z. B. „1 packet“, „1 oz“) und in Gramm umgerechnet. Die Makros kommen genau aus MacroFactor.
        </p>
        <Button className="w-full" disabled={!selected.size || busy} onClick={add} icon="plus">
          {selected.size} {selected.size === 1 ? "Rezept" : "Rezepte"} übernehmen
        </Button>
      </div>
    </div>
  );
}
