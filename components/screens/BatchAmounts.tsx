"use client";

import { useState } from "react";
import { Icon } from "../icons";
import { SheetHeader, useNav } from "../nav";
import { Button, cx } from "../ui";
import { db } from "@/lib/db";
import type { ShotAssignment, ShotInput } from "@/lib/amounts";
import type { Recipe } from "@/lib/types";
import { haptic } from "@/lib/util";

/** Bestätigung für "Mengen aus MacroFactor-Screenshots": pro Rezept die erkannten Gramm. */
export function BatchAmountsSheet({ assigned, unassigned, total, close }: { assigned: ShotAssignment[]; unassigned: ShotInput[]; total: number; close: () => void }) {
  const nav = useNav();
  const [on, setOn] = useState<Set<string>>(() => new Set(assigned.filter((a) => a.matches.length).map((a) => a.recipe.id)));
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    setBusy(true);
    const before: Recipe[] = [];
    let n = 0;
    for (const a of assigned) {
      if (!on.has(a.recipe.id)) continue;
      const r = await db.recipes.get(a.recipe.id);
      if (!r) continue;
      before.push(r);
      const g = new Map(a.matches.map((m) => [m.ingredientId, m.found.grams]));
      n += g.size;
      await db.recipes.put({
        ...r,
        updatedAt: Date.now(),
        ingredients: r.ingredients.map((i) => {
          const v = g.get(i.id);
          return v == null ? i : { ...i, grams: v, amount: v, unit: "g", pieces: undefined, uncertain: false };
        }),
      });
    }
    close();
    nav.toast(`${n} Mengen in ${before.length} ${before.length === 1 ? "Rezept" : "Rezepten"} übernommen`, async () => {
      await db.recipes.bulkPut(before);
    });
  };

  return (
    <div>
      <SheetHeader
        title="Mengen prüfen"
        onClose={close}
        right={
          <button disabled={!on.size || busy} onClick={apply} className="press text-[17px] font-semibold text-accent disabled:opacity-40">
            Übernehmen
          </button>
        }
      />
      <p className="px-4 pb-3 text-[14px] leading-snug text-muted">
        {total} Screenshots gelesen, {assigned.length} {assigned.length === 1 ? "Rezept" : "Rezepte"} erkannt. Tippe ein Rezept an, um die Mengen zu sehen.
      </p>
      <div className="divide-y divide-line">
        {assigned.map((a) => {
          const sel = on.has(a.recipe.id);
          const expanded = open === a.recipe.id;
          const missing = a.recipe.ingredients.length - a.matches.length;
          return (
            <div key={a.recipe.id}>
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  aria-label={sel ? "abwählen" : "auswählen"}
                  onClick={() => {
                    haptic();
                    setOn((s) => {
                      const x = new Set(s);
                      if (x.has(a.recipe.id)) x.delete(a.recipe.id);
                      else x.add(a.recipe.id);
                      return x;
                    });
                  }}
                  className={cx("grid h-6 w-6 shrink-0 place-items-center rounded-full border-2", sel ? "border-accent bg-accent text-black" : "border-white/30")}
                >
                  {sel && <Icon name="check" size={14} stroke={3.2} />}
                </button>
                <button onClick={() => setOpen(expanded ? null : a.recipe.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{a.recipe.title}</span>
                    <span className="block text-[12px] text-muted">
                      {a.matches.length} von {a.recipe.ingredients.length} Mengen · {a.shots.length} {a.shots.length === 1 ? "Screenshot" : "Screenshots"}
                      {missing > 0 && <span className="text-accent"> · {missing} ohne Treffer</span>}
                    </span>
                  </span>
                  <Icon name="down" size={18} className={cx("shrink-0 text-faint transition-transform", expanded && "rotate-180")} />
                </button>
              </div>
              {expanded && (
                <div className="mx-4 mb-3 divide-y divide-line overflow-hidden rounded-[12px] bg-card">
                  {a.matches.map((m) => (
                    <div key={m.ingredientId} className="flex items-center gap-3 px-3 py-2 text-[14px]">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{m.ingredientName}</span>
                        {m.score < 0.8 && <span className="block truncate text-[12px] text-accent">erkannt als „{m.found.name}“</span>}
                      </span>
                      <span className="tnum shrink-0 font-semibold">{m.found.grams.toLocaleString("de-DE")} g</span>
                    </div>
                  ))}
                  {a.unmatched.length > 0 && (
                    <p className="px-3 py-2 text-[12px] text-muted">Nicht zugeordnet: {a.unmatched.map((u) => `${u.name} (${u.grams} g)`).join(", ")}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {unassigned.length > 0 && (
        <p className="px-4 pt-4 text-[13px] leading-snug text-muted">
          {unassigned.length} {unassigned.length === 1 ? "Screenshot konnte" : "Screenshots konnten"} keinem Rezept zugeordnet werden (Bild {unassigned.map((u) => u.index + 1).join(", ")}). Ist das Rezept schon importiert und die Zutatenliste mit Gramm zu sehen?
        </p>
      )}
      <div className="px-4 pt-4">
        <Button className="w-full" disabled={!on.size || busy} onClick={apply} icon="check">
          Mengen für {on.size} {on.size === 1 ? "Rezept" : "Rezepte"} übernehmen
        </Button>
      </div>
    </div>
  );
}
