"use client";

import { useRef, useState } from "react";
import { Icon } from "../icons";
import { Screen, SheetHeader, useNav } from "../nav";
import { IconButton, MiniRing, RecipeImage, cx } from "../ui";
import { RecipePicker } from "./Recipes";
import { EntrySheet } from "./Today";
import { AddToPlanSheet } from "./RecipeDetail";
import { db } from "@/lib/db";
import { usePlanRange, useRecipeMap, useSettings } from "@/lib/hooks";
import { addToPlan, copyWeek, dayTotals, entryInfo, goalsFor, saveTemplate } from "@/lib/plan";
import { SLOTS, SLOT_LABEL, type Macros, type Slot } from "@/lib/types";
import { fmtAmount } from "@/lib/units";
import { WD_LONG, addDays, fmtDate, fmtWeekRange, haptic, isoWeekNumber, mondayOf, today, weekDays } from "@/lib/util";

export function WeekScreen() {
  const nav = useNav();
  const [monday, setMonday] = useState(mondayOf(today()));
  const days = weekDays(monday);
  const entries = usePlanRange(days[0], days[6]) ?? [];
  const recipes = useRecipeMap();
  const settings = useSettings();
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const [anim, setAnim] = useState<"l" | "r" | null>(null);

  const change = (dir: 1 | -1) => {
    haptic();
    setAnim(dir === 1 ? "l" : "r");
    setMonday(addDays(monday, dir * 7));
    setTimeout(() => setAnim(null), 350);
  };

  const dayData = days.map((d) => {
    const list = entries.filter((e) => e.date === d);
    return { d, list, totals: dayTotals(list, recipes), goals: goalsFor(d, settings) };
  });
  const planned = dayData.filter((x) => x.list.length > 0);
  const avg = (k: keyof Macros) => (planned.length ? planned.reduce((s, x) => s + x.totals[k], 0) / planned.length : 0);
  const avgGoal = (k: keyof Macros) => dayData.reduce((s, x) => s + x.goals[k], 0) / 7;
  const isCurrent = monday === mondayOf(today());

  const pick = (date: string, slot: Slot) => {
    const dd = dayData.find((x) => x.d === date)!;
    const remaining: Macros = {
      kcal: dd.goals.kcal - dd.totals.kcal,
      protein: dd.goals.protein - dd.totals.protein,
      carbs: dd.goals.carbs - dd.totals.carbs,
      fat: dd.goals.fat - dd.totals.fat,
      fiber: dd.goals.fiber - dd.totals.fiber,
    };
    nav.openSheet(
      (close) => (
        <RecipePicker
          title={`${SLOT_LABEL[slot]} · ${fmtDate(date, { weekday: "short", day: "numeric", month: "numeric" })}`}
          remaining={remaining}
          close={close}
          onPick={(r, servings) => addToPlan(date, slot, r.id, servings)}
        />
      ),
      { full: true },
    );
  };

  const menu = () =>
    nav.openSheet((close) => (
      <div className="px-4">
        <SheetHeader title={`KW ${isoWeekNumber(monday)}`} />
        <div className="divide-y divide-line overflow-hidden rounded-[16px] bg-card">
          {[
            {
              icon: "copy" as const,
              label: "Woche in nächste Woche kopieren",
              run: async () => {
                const n = await copyWeek(monday, addDays(monday, 7));
                nav.toast(n ? `${n} Mahlzeiten kopiert` : "Diese Woche ist leer");
              },
            },
            {
              icon: "layers" as const,
              label: "Als Vorlage speichern",
              run: async () => {
                if (!entries.length) return nav.toast("Diese Woche ist leer");
                const name = window.prompt("Name der Vorlage", `Woche ${isoWeekNumber(monday)}`);
                if (name) {
                  await saveTemplate(monday, name);
                  nav.toast("Vorlage gespeichert");
                }
              },
            },
            { icon: "grid" as const, label: "Vorlage anwenden", run: () => nav.push({ name: "templates", monday }) },
            {
              icon: "flame" as const,
              label: "Meal Prep planen",
              run: () =>
                nav.openSheet(
                  (c) => (
                    <RecipePicker
                      title="Meal-Prep-Rezept"
                      remaining={null}
                      close={c}
                      onPick={(r) => setTimeout(() => nav.openSheet((cc) => <AddToPlanSheet recipe={r} close={cc} initialDate={isCurrent ? today() : monday} />), 330)}
                    />
                  ),
                  { full: true },
                ),
            },
            {
              icon: "trash" as const,
              label: "Woche leeren",
              danger: true,
              run: async () => {
                const backup = [...entries];
                await db.plan.bulkDelete(entries.map((e) => e.id));
                nav.toast("Woche geleert", () => db.plan.bulkPut(backup));
              },
            },
          ].map((a) => (
            <button
              key={a.label}
              className={cx("flex w-full items-center gap-3 px-4 py-3.5 text-left text-[16px]", a.danger && "text-danger")}
              onClick={() => {
                close();
                setTimeout(a.run, 320);
              }}
            >
              <Icon name={a.icon} size={20} className={a.danger ? "" : "text-accent"} /> {a.label}
            </button>
          ))}
        </div>
      </div>
    ));

  return (
    <Screen
      title="Woche"
      left={<IconButton name="gear" label="Einstellungen" onClick={() => nav.push({ name: "settings" })} />}
      right={<IconButton name="more" label="Woche-Menü" onClick={menu} />}
    >
      {/* Wochenkopf, wischbar */}
      <div
        onTouchStart={(e) => (swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          const s = swipe.current;
          swipe.current = null;
          if (!s) return;
          const dx = e.changedTouches[0].clientX - s.x;
          const dy = e.changedTouches[0].clientY - s.y;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) change(dx < 0 ? 1 : -1);
        }}
      >
        <div className="mb-3 flex items-center justify-between rounded-[18px] bg-card px-2 py-2">
          <IconButton name="back" label="Vorige Woche" onClick={() => change(-1)} className="text-accent!" />
          <div className="text-center">
            <div className="text-[16px] font-semibold">{isCurrent ? "Diese Woche" : monday === addDays(mondayOf(today()), 7) ? "Nächste Woche" : `KW ${isoWeekNumber(monday)}`}</div>
            <div className="tnum text-[13px] text-muted">{fmtWeekRange(monday)}</div>
          </div>
          <IconButton name="chevron" label="Nächste Woche" onClick={() => change(1)} className="text-accent!" />
        </div>

        <div key={monday} className={cx(anim === "l" && "anim-slide-in", anim === "r" && "anim-pop-in")}>
          {/* Wochenschnitt */}
          <div className="mb-4 rounded-[20px] bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="label">Wochenschnitt</span>
              <span className="text-[12px] text-muted">{planned.length} von 7 Tagen geplant</span>
            </div>
            <div className="grid grid-cols-5 gap-2 text-center">
              {(
                [
                  ["kcal", "kcal", "var(--color-accent)"],
                  ["protein", "Protein", "var(--color-protein)"],
                  ["carbs", "KH", "var(--color-carbs)"],
                  ["fat", "Fett", "var(--color-fat)"],
                  ["fiber", "Bst", "var(--color-fiber)"],
                ] as [keyof Macros, string, string][]
              ).map(([k, l, c]) => (
                <div key={k} className="flex flex-col items-center gap-1">
                  <div className="relative">
                    <MiniRing value={avg(k)} goal={avgGoal(k)} size={46} stroke={5} color={c} />
                    <span className="tnum absolute inset-0 grid place-items-center text-[11px] font-bold">{avgGoal(k) ? Math.round((avg(k) / avgGoal(k)) * 100) : 0}%</span>
                  </div>
                  <span className="tnum text-[13px] font-semibold">{Math.round(avg(k))}</span>
                  <span className="text-[10px] text-muted">{l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tage */}
          <div className="space-y-3">
            {dayData.map(({ d, list, totals, goals }, i) => {
              const isToday = d === today();
              return (
                <div key={d} className={cx("rounded-[20px] bg-card p-3.5", isToday && "ring-1 ring-accent/60")}>
                  <div className="mb-2.5 flex items-center gap-3">
                    <div className="relative">
                      <MiniRing value={totals.kcal} goal={goals.kcal} size={42} stroke={4.5} />
                      <span className="tnum absolute inset-0 grid place-items-center text-[12px] font-bold">{+d.slice(8)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className={cx("text-[16px] font-semibold", isToday && "text-accent")}>{WD_LONG[i]}</span>
                        {isToday && <span className="label text-accent!">Heute</span>}
                      </div>
                      <div className="tnum text-[12px] text-muted">
                        <span className={cx("font-semibold", totals.kcal > goals.kcal * 1.05 ? "text-danger" : "text-white")}>{Math.round(totals.kcal)}</span> / {Math.round(goals.kcal)} kcal · P{" "}
                        <span className="text-white">{Math.round(totals.protein)}</span>/{Math.round(goals.protein)} · KH {Math.round(totals.carbs)} · F {Math.round(totals.fat)}
                      </div>
                    </div>
                  </div>
                  {/* Makro-Balken des Tages */}
                  <div className="mb-2.5 flex h-1.5 gap-1 overflow-hidden rounded-full">
                    {(["protein", "carbs", "fat", "fiber"] as const).map((k) => (
                      <div key={k} className="relative flex-1 overflow-hidden rounded-full bg-line">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{
                            width: `${Math.min(100, goals[k] ? (totals[k] / goals[k]) * 100 : 0)}%`,
                            background: `var(--color-${k})`,
                            transition: "width 600ms var(--ease-ios)",
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    {SLOTS.map((slot) => {
                      const se = list.filter((e) => e.slot === slot);
                      return (
                        <div key={slot} className="flex items-start gap-2">
                          <span className="w-[62px] shrink-0 pt-2 text-[12px] font-medium text-muted">{SLOT_LABEL[slot]}</span>
                          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                            {se.map((e) => {
                              const info = entryInfo(e, recipes);
                              if (!info) return null;
                              return (
                                <button
                                  key={e.id}
                                  onClick={() => nav.openSheet((close) => <EntrySheet entry={e} close={close} />)}
                                  className="press flex min-w-0 max-w-[calc(100%-42px)] items-center gap-2 rounded-[11px] bg-card2 py-1 pl-1 pr-2.5"
                                >
                                  <RecipeImage src={info.photo} title={info.title} className="h-7 w-7 shrink-0" rounded="rounded-[8px]" />
                                  <span className="truncate text-[13px] font-medium">{info.title}</span>
                                  {e.servings !== 1 && <span className="tnum shrink-0 text-[12px] text-accent">×{fmtAmount(e.servings)}</span>}
                                </button>
                              );
                            })}
                            <button
                              aria-label={`${SLOT_LABEL[slot]} hinzufügen`}
                              onClick={() => pick(d, slot)}
                              className="press grid h-9 w-9 place-items-center rounded-[11px] border border-dashed border-line text-muted"
                            >
                              <Icon name="plus" size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Screen>
  );
}
