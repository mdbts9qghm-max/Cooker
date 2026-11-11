"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Screen, useNav } from "../nav";
import { EmptyState, Button } from "../ui";
import { db } from "@/lib/db";
import { applyTemplate } from "@/lib/plan";
import { SLOT_LABEL } from "@/lib/types";
import { fmtWeekRange } from "@/lib/util";
import { useRecipeMap } from "@/lib/hooks";

export function TemplatesScreen({ monday }: { monday: string }) {
  const nav = useNav();
  const templates = useLiveQuery(() => db.templates.orderBy("createdAt").reverse().toArray(), []);
  const recipes = useRecipeMap();

  return (
    <Screen title="Vorlagen" back="Woche">
      <p className="mb-4 px-1 text-[14px] text-muted">Anwenden auf die Woche {fmtWeekRange(monday)}. Bereits geplante Mahlzeiten bleiben erhalten.</p>
      {templates && templates.length === 0 && (
        <EmptyState icon="layers" title="Noch keine Vorlagen" text="Plane eine Woche und speichere sie im Woche-Menü (⋯) als Vorlage." />
      )}
      <div className="space-y-3">
        {templates?.map((t) => {
          const names = [...new Set(t.entries.map((e) => recipes.get(e.recipeId)?.title).filter(Boolean))];
          return (
            <div key={t.id} className="rounded-[18px] bg-card p-4">
              <div className="mb-1 text-[17px] font-semibold">{t.name}</div>
              <div className="mb-3 text-[13px] text-muted">
                {t.entries.length} Mahlzeiten · {Object.entries(t.entries.reduce<Record<string, number>>((a, e) => ({ ...a, [e.slot]: (a[e.slot] ?? 0) + 1 }), {}))
                  .map(([s, n]) => `${n}× ${SLOT_LABEL[s as keyof typeof SLOT_LABEL]}`)
                  .join(", ")}
              </div>
              <p className="mb-3 line-clamp-2 text-[13px] text-faint">{names.join(" · ")}</p>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={async () => {
                    const n = await applyTemplate(t.id, monday);
                    nav.pop();
                    nav.toast(`${n} Mahlzeiten eingeplant`);
                  }}
                >
                  Anwenden
                </Button>
                <Button
                  variant="danger"
                  icon="trash"
                  onClick={async () => {
                    await db.templates.delete(t.id);
                    nav.toast("Vorlage gelöscht", () => db.templates.put(t));
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Screen>
  );
}
