"use client";

import { useRef, useState } from "react";
import { Icon } from "../icons";
import { Screen, SheetHeader, useNav } from "../nav";
import { Button, EmptyState, HalfRing, IconButton, MACRO_META, MacroBar, RecipeImage, Stepper, cx } from "../ui";
import { ImportSheet } from "./ImportSheet";
import { RecipePicker } from "./Recipes";
import { db, updateSettings } from "@/lib/db";
import { BACKUP_INTERVAL, shareBackup } from "@/lib/backup";
import { usePlanRange, useRecipeMap, useRecipes, useSettings } from "@/lib/hooks";
import { addMacros } from "@/lib/nutrition";
import { addToPlan, dayTotals, entryInfo, goalsFor } from "@/lib/plan";
import { addSampleData } from "@/lib/samples";
import { SLOTS, SLOT_LABEL, type Macros, type PlanEntry, type Slot } from "@/lib/types";
import { fmtAmount } from "@/lib/units";
import { addDays, fmtDate, haptic, today } from "@/lib/util";

export function TodayScreen() {
  const nav = useNav();
  const [date, setDate] = useState(today());
  const entries = usePlanRange(date, date) ?? [];
  const recipes = useRecipeMap();
  const allRecipes = useRecipes();
  const settings = useSettings();
  const goals = goalsFor(date, settings);
  const totals = dayTotals(entries, recipes);
  const remaining: Macros = {
    kcal: goals.kcal - totals.kcal,
    protein: goals.protein - totals.protein,
    carbs: goals.carbs - totals.carbs,
    fat: goals.fat - totals.fat,
    fiber: goals.fiber - totals.fiber,
  };

  const backupDue =
    (allRecipes?.length ?? 0) > 0 &&
    (!settings.lastBackupAt || Date.now() - settings.lastBackupAt > BACKUP_INTERVAL) &&
    (!settings.backupSnoozeUntil || Date.now() > settings.backupSnoozeUntil);

  const isToday = date === today();
  const label = isToday ? "Heute" : date === addDays(today(), 1) ? "Morgen" : date === addDays(today(), -1) ? "Gestern" : fmtDate(date, { weekday: "long" });

  const pick = (slot: Slot, replace?: PlanEntry) => {
    const replaced = replace ? entryInfo(replace, recipes)?.macros : undefined;
    const rem = replaced ? addMacros(remaining, replaced) : remaining;
    nav.openSheet(
      (close) => (
        <RecipePicker
          title={replace ? "Rezept tauschen" : `${SLOT_LABEL[slot]} wählen`}
          remaining={rem}
          close={close}
          onPick={async (r, servings) => {
            if (replace) await db.plan.update(replace.id, { recipeId: r.id, servings, snapshot: undefined });
            else await addToPlan(date, slot, r.id, servings);
          }}
        />
      ),
      { full: true },
    );
  };

  return (
    <Screen
      title={label}
      right={<IconButton name="gear" label="Einstellungen" onClick={() => nav.push({ name: "settings" })} />}
      left={
        <div className="flex">
          <IconButton name="back" label="Vortag" onClick={() => setDate(addDays(date, -1))} />
          <IconButton name="chevron" label="Nächster Tag" onClick={() => setDate(addDays(date, 1))} />
        </div>
      }
    >
      <p className="-mt-1 mb-3 px-0.5 text-[15px] text-muted">
        {fmtDate(date, { weekday: "long", day: "numeric", month: "long" })}
        {!isToday && (
          <button className="ml-2 text-accent" onClick={() => setDate(today())}>
            Zu heute
          </button>
        )}
      </p>

      {backupDue && (
        <div className="anim-pop-in mb-3 rounded-[18px] bg-card p-4">
          <div className="mb-1 flex items-center gap-2 text-[16px] font-semibold">
            <Icon name="backup" size={20} className="text-accent" /> Zeit für ein Backup
          </div>
          <p className="mb-3 text-[14px] text-muted">
            Deine Rezepte liegen nur auf diesem iPhone. Sichere sie alle 14 Tage, z. B. in iCloud Drive.
            {settings.lastBackupAt ? ` Letztes Backup: ${new Date(settings.lastBackupAt).toLocaleDateString("de-DE")}.` : ""}
          </p>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              icon="backup"
              onClick={async () => {
                const r = await shareBackup();
                if (r !== "cancelled") nav.toast("Backup erstellt");
              }}
            >
              Jetzt sichern
            </Button>
            <Button variant="secondary" onClick={() => updateSettings({ backupSnoozeUntil: Date.now() + 3 * 86400000 })}>
              Später
            </Button>
          </div>
        </div>
      )}

      {/* Ring */}
      <div className="relative rounded-[24px] bg-card px-5 pb-5 pt-6">
        <div className="relative mx-auto max-w-[320px]">
          <HalfRing value={totals.kcal} goal={goals.kcal} />
          <div className="absolute inset-x-0 bottom-1 text-center">
            <div className="tnum text-[46px] font-bold leading-none tracking-tight">{Math.round(totals.kcal).toLocaleString("de-DE")}</div>
            <div className="label mt-1.5">kcal geplant</div>
          </div>
        </div>
        <div className="mt-3 flex justify-between px-1">
          <div>
            <div className={cx("tnum text-[20px] font-bold", remaining.kcal < 0 && "text-danger")}>{Math.abs(Math.round(remaining.kcal)).toLocaleString("de-DE")}</div>
            <div className="label">{remaining.kcal < 0 ? "drüber" : "übrig"}</div>
          </div>
          <div className="text-right">
            <div className="tnum text-[20px] font-bold">{Math.round(goals.kcal).toLocaleString("de-DE")}</div>
            <div className="label">Ziel</div>
          </div>
        </div>
        <div className="mt-5 grid gap-3.5">
          {MACRO_META.map((m) => (
            <MacroBar key={m.key} label={m.label} value={totals[m.key]} goal={goals[m.key]} color={m.color} />
          ))}
        </div>
      </div>

      {/* Mahlzeiten */}
      {allRecipes && allRecipes.length === 0 ? (
        <EmptyState
          icon="book"
          title="Willkommen!"
          text="Tippe auf das orange Plus, um dein erstes Rezept einzufügen oder selbst anzulegen – oder lade erst mal Beispielrezepte zum Ausprobieren."
          action={
            <div className="flex w-full max-w-[300px] flex-col gap-2.5">
              <Button onClick={() => nav.openSheet((close) => <ImportSheet close={close} />)} icon="plus">
                Rezept hinzufügen
              </Button>
              <Button
                variant="secondary"
                onClick={async () => {
                  await addSampleData();
                  nav.toast("Beispielrezepte geladen");
                }}
              >
                Beispieldaten laden
              </Button>
            </div>
          }
        />
      ) : (
        SLOTS.map((slot) => {
          const list = entries.filter((e) => e.slot === slot);
          return (
            <div key={slot}>
              <div className="mb-2 mt-6 flex items-end justify-between px-1">
                <h3 className="label">{SLOT_LABEL[slot]}</h3>
                {list.length > 0 && (
                  <span className="tnum text-[13px] text-muted">{Math.round(dayTotals(list, recipes).kcal)} kcal</span>
                )}
              </div>
              <div className="space-y-2.5">
                {list.map((e) => (
                  <MealCard key={e.id} entry={e} onSwap={() => pick(slot, e)} />
                ))}
                <button
                  onClick={() => pick(slot)}
                  className={cx(
                    "press flex w-full items-center justify-center gap-2 rounded-[18px] border border-dashed border-line text-[15px] text-muted",
                    list.length ? "py-2.5" : "py-6",
                  )}
                >
                  <Icon name="plus" size={18} /> {list.length ? "Weiteres Rezept" : `${SLOT_LABEL[slot]} planen`}
                </button>
              </div>
            </div>
          );
        })
      )}
    </Screen>
  );
}

function MealCard({ entry, onSwap }: { entry: PlanEntry; onSwap: () => void }) {
  const nav = useNav();
  const recipes = useRecipeMap();
  const info = entryInfo(entry, recipes);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const long = useRef(false);
  if (!info) return null;

  const start = () => {
    long.current = false;
    timer.current = setTimeout(() => {
      long.current = true;
      haptic(20);
      onSwap();
    }, 480);
  };
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
  };

  return (
    <div
      className="press anim-pop-in flex items-center gap-3 rounded-[18px] bg-card p-2.5 pr-3"
      onTouchStart={start}
      onTouchEnd={cancel}
      onTouchMove={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (long.current) return;
        if (info.recipe) nav.push({ name: "recipe", id: info.recipe.id });
      }}
    >
      <RecipeImage src={info.photo} title={info.title} className="h-[68px] w-[68px] shrink-0" rounded="rounded-[14px]" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[16px] font-semibold">{info.title}</div>
        <div className="tnum mt-0.5 text-[13px] text-muted">
          {fmtAmount(entry.servings)} {entry.servings === 1 ? "Portion" : "Portionen"} · <span className="text-white">{Math.round(info.macros.kcal)} kcal</span> ·{" "}
          <span className="text-protein">{Math.round(info.macros.protein)} g P</span>
        </div>
      </div>
      <button
        aria-label="Optionen"
        onClick={(e) => {
          e.stopPropagation();
          nav.openSheet((close) => <EntrySheet entry={entry} close={close} onSwap={onSwap} />);
        }}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted"
      >
        <Icon name="more" size={22} stroke={3} />
      </button>
    </div>
  );
}

export function EntrySheet({ entry, close, onSwap }: { entry: PlanEntry; close: () => void; onSwap?: () => void }) {
  const nav = useNav();
  const recipes = useRecipeMap();
  const info = entryInfo(entry, recipes);
  const [servings, setServings] = useState(entry.servings);
  if (!info) return null;
  return (
    <div className="px-4">
      <SheetHeader
        title={SLOT_LABEL[entry.slot]}
        right={
          <button
            className="press text-[17px] font-semibold text-accent"
            onClick={async () => {
              if (servings !== entry.servings) await db.plan.update(entry.id, { servings });
              close();
            }}
          >
            Fertig
          </button>
        }
      />
      <div className="mb-3 flex items-center gap-3 rounded-[16px] bg-card p-3">
        <RecipeImage src={info.photo} title={info.title} className="h-14 w-14 shrink-0" rounded="rounded-[12px]" />
        <div className="min-w-0">
          <div className="truncate text-[16px] font-semibold">{info.title}</div>
          <div className="text-[13px] text-muted">{fmtDate(entry.date, { weekday: "long", day: "numeric", month: "short" })}{info.frozen ? " · Werte eingefroren" : ""}</div>
        </div>
      </div>
      <div className="mb-3 flex items-center justify-between rounded-[16px] bg-card px-4 py-2.5">
        <span className="text-[16px]">Portionen</span>
        <Stepper value={servings} min={0.25} step={0.5} onChange={setServings} />
      </div>
      <div className="divide-y divide-line overflow-hidden rounded-[16px] bg-card">
        {info.recipe && (
          <button className="flex w-full items-center gap-3 px-4 py-3.5 text-[16px]" onClick={() => (close(), nav.push({ name: "recipe", id: info.recipe!.id }))}>
            <Icon name="book" size={20} className="text-accent" /> Rezept öffnen
          </button>
        )}
        {onSwap && (
          <button className="flex w-full items-center gap-3 px-4 py-3.5 text-[16px]" onClick={() => (close(), setTimeout(onSwap, 320))}>
            <Icon name="swap" size={20} className="text-accent" /> Tauschen
          </button>
        )}
        <button
          className="flex w-full items-center gap-3 px-4 py-3.5 text-[16px] text-danger"
          onClick={async () => {
            await db.plan.delete(entry.id);
            close();
            nav.toast("Aus dem Plan entfernt", () => db.plan.put(entry));
          }}
        >
          <Icon name="trash" size={20} /> Entfernen
        </button>
      </div>
    </div>
  );
}
