"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../icons";
import { SheetHeader, useNav } from "../nav";
import { Button, Chip, IconButton, MACRO_META, RecipeImage, Segmented, Stepper, cx } from "../ui";
import { db } from "@/lib/db";
import { useRecipe } from "@/lib/hooks";
import { draftFromRecipe } from "@/lib/importer";
import { exportUrl, recipeAsText } from "@/lib/macrofactor";
import { recipeMacros, scaleMacros } from "@/lib/nutrition";
import { addToPlan, mealPrep } from "@/lib/plan";
import { SLOTS, SLOT_LABEL, type Recipe, type Slot } from "@/lib/types";
import { fmtAmount } from "@/lib/units";
import { WD_SHORT, addDays, fmtDate, haptic, mondayOf, today, weekDays } from "@/lib/util";

export function RecipeDetail({ id }: { id: string }) {
  const nav = useNav();
  const r = useRecipe(id);
  const [servings, setServings] = useState<number | null>(null);
  const [view, setView] = useState<"serving" | "100g" | "total">("serving");
  const [scrollY, setScrollY] = useState(0);

  const macros = useMemo(() => (r ? recipeMacros(r) : null), [r]);

  if (r === null) {
    return (
      <div className="grid h-full place-items-center p-8 text-center text-muted">
        <div>
          Rezept nicht gefunden.
          <Button variant="ghost" onClick={nav.pop}>
            Zurück
          </Button>
        </div>
      </div>
    );
  }
  if (!r || !macros) return <div className="h-full bg-bg" />;

  const s = servings ?? r.servings;
  const factor = s / Math.max(r.servings, 0.1);
  const shown = view === "serving" ? macros.perServing : view === "100g" ? macros.per100 ?? macros.perServing : scaleMacros(macros.perServing, s);

  const del = async () => {
    const entries = await db.plan.where("recipeId").equals(r.id).toArray();
    await db.recipes.delete(r.id);
    await db.plan.bulkDelete(entries.map((e) => e.id));
    nav.pop();
    nav.toast("Rezept gelöscht", async () => {
      await db.recipes.put(r);
      await db.plan.bulkPut(entries);
    });
  };

  const toMacroFactor = async () => {
    const url = exportUrl(r, window.location.origin);
    try {
      await navigator.clipboard.writeText(url);
      nav.toast("Link kopiert – in MacroFactor unter Rezept erstellen → Importieren einfügen");
    } catch {
      nav.openSheet((close) => (
        <div className="px-4">
          <SheetHeader title="MacroFactor-Link" onClose={close} />
          <p className="mb-2 text-[14px] text-muted">Halte den Link gedrückt und wähle „Kopieren“.</p>
          <textarea readOnly value={url} className="field h-32 text-[13px]!" onFocus={(e) => e.target.select()} />
        </div>
      ));
    }
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(recipeAsText(r));
      nav.toast("Rezept als Text kopiert");
    } catch {
      nav.toast("Kopieren nicht möglich");
    }
  };

  const headerSolid = scrollY > 220;

  return (
    <div className="absolute inset-0 bg-bg">
      {/* floating nav */}
      <div className={cx("absolute inset-x-0 top-0 z-30 flex items-center justify-between px-2 transition-colors", headerSolid ? "blurbar border-b border-line/70" : "")} style={{ paddingTop: "var(--sat)" }}>
        <button onClick={nav.pop} className={cx("press m-1 grid h-9 w-9 place-items-center rounded-full", !headerSolid && "bg-black/45 backdrop-blur")}>
          <Icon name="back" size={22} stroke={2.4} className="text-white" />
        </button>
        <span className={cx("truncate px-2 text-[17px] font-semibold transition-opacity", headerSolid ? "opacity-100" : "opacity-0")}>{r.title}</span>
        <div className={cx("m-1 flex rounded-full", !headerSolid && "bg-black/45 backdrop-blur")}>
          <IconButton
            name="heart"
            label="Favorit"
            active={r.favorite}
            className="h-9 w-9"
            onClick={() => db.recipes.update(r.id, { favorite: !r.favorite })}
          />
        </div>
      </div>

      <div className="scroll h-full" onScroll={(e) => setScrollY(e.currentTarget.scrollTop)}>
        <div className="relative">
          <RecipeImage src={r.photos[0]} title={r.title} className="h-[340px] w-full" rounded="" />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 px-4 pb-2">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {r.tags.map((t) => (
                <span key={t} className="rounded-full bg-white/12 px-2.5 py-0.5 text-[12px] font-medium backdrop-blur">
                  {t}
                </span>
              ))}
            </div>
            <h1 className="text-[30px] font-bold leading-tight tracking-tight">{r.title}</h1>
          </div>
        </div>

        <div className="px-4" style={{ paddingBottom: "calc(var(--tabbar-h) + 40px)" }}>
          {/* Makros */}
          <div className="mt-3 rounded-[20px] bg-card p-4">
            <Segmented
              value={view}
              onChange={setView}
              className="mb-4"
              options={[
                { value: "serving", label: "Portion" },
                { value: "100g", label: "100 g" },
                { value: "total", label: `Gesamt (${fmtAmount(s)})` },
              ]}
            />
            <div className="flex items-end gap-4">
              <div>
                <div className="tnum text-[40px] font-bold leading-none tracking-tight">{Math.round(shown.kcal)}</div>
                <div className="label mt-1.5">kcal</div>
              </div>
              <div className="grid flex-1 grid-cols-4 gap-2">
                {MACRO_META.map((m) => (
                  <div key={m.key}>
                    <div className="tnum text-[19px] font-bold" style={{ color: m.color }}>
                      {Math.round(shown[m.key])}
                      <span className="text-[12px] font-medium">g</span>
                    </div>
                    <div className="text-[11px] text-muted">{m.short}</div>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-3 text-[12px] text-muted">
              {macros.source === "creator" ? "Makros vom Creator" : "Berechnet aus den Zutaten"} · {Math.round(macros.perServing.protein / Math.max(macros.perServing.kcal, 1) * 1000) / 10} g Protein pro 100 kcal
            </p>
          </div>

          {/* Aktionen */}
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <Button icon="play" onClick={() => nav.setOverlay(<CookMode recipe={r} servings={s} onClose={() => nav.setOverlay(null)} />)}>
              Kochen
            </Button>
            <Button variant="secondary" icon="week" onClick={() => nav.openSheet((close) => <AddToPlanSheet recipe={r} close={close} />)}>
              In Plan
            </Button>
          </div>

          {/* Zutaten */}
          <div className="mb-2 mt-7 flex items-center justify-between px-1">
            <h3 className="label">Zutaten</h3>
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-muted">Portionen</span>
              <Stepper value={s} min={0.5} step={r.servings >= 4 ? 1 : 0.5} onChange={setServings} />
            </div>
          </div>
          <div className="divide-y divide-line overflow-hidden rounded-[16px] bg-card">
            {r.ingredients.map((i) => {
              const showUnit = i.amount != null && i.unit && i.unit !== "g" && i.unit !== "ml";
              return (
                <div key={i.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="tnum w-[70px] shrink-0 text-[15px] font-semibold">
                    {showUnit ? `${fmtAmount(i.amount! * factor)} ${i.unit === "Stück" ? "Stk." : i.unit}` : i.grams > 0 ? `${Math.round(i.grams * factor)} ${i.unit === "ml" ? "ml" : "g"}` : <span className="text-[13px] font-normal text-muted">nach Bedarf</span>}
                  </span>
                  <span className="min-w-0 flex-1 text-[15px]">{i.name}</span>
                  {showUnit && <span className="tnum shrink-0 text-[13px] text-muted">{Math.round(i.grams * factor)} g</span>}
                </div>
              );
            })}
            {!r.ingredients.length && <p className="px-4 py-3 text-[15px] text-muted">Keine Zutaten erfasst.</p>}
          </div>

          {/* Schritte */}
          {r.steps.length > 0 && (
            <>
              <h3 className="label mb-2 mt-7 px-1">Zubereitung</h3>
              <ol className="space-y-3">
                {r.steps.map((st, i) => (
                  <li key={i} className="flex gap-3 rounded-[16px] bg-card p-4">
                    <span className="tnum grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-[14px] font-bold text-accent">{i + 1}</span>
                    <span className="text-[15px] leading-relaxed">{st}</span>
                  </li>
                ))}
              </ol>
            </>
          )}

          {r.notes && (
            <>
              <h3 className="label mb-2 mt-7 px-1">Notizen</h3>
              <p className="whitespace-pre-wrap rounded-[16px] bg-card p-4 text-[15px] leading-relaxed">{r.notes}</p>
            </>
          )}

          {/* Export */}
          <h3 className="label mb-2 mt-7 px-1">Export</h3>
          <div className="divide-y divide-line overflow-hidden rounded-[16px] bg-card">
            <button onClick={toMacroFactor} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-white/5">
              <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-accent-soft text-accent">
                <Icon name="link" size={18} />
              </span>
              <span className="flex-1">
                <span className="block text-[16px]">Nach MacroFactor</span>
                <span className="block text-[13px] text-muted">Kopiert einen Import-Link</span>
              </span>
            </button>
            <button onClick={copyText} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-white/5">
              <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-accent-soft text-accent">
                <Icon name="copy" size={18} />
              </span>
              <span className="flex-1 text-[16px]">Als Text kopieren</span>
            </button>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-2.5">
            <Button
              variant="secondary"
              icon="edit"
              onClick={() => {
                const d = draftFromRecipe(r);
                nav.push({ name: "review", draftId: d.id });
              }}
            >
              Bearbeiten
            </Button>
            <Button variant="danger" icon="trash" onClick={del}>
              Löschen
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AddToPlanSheet({ recipe, close, initialDate, initialSlot }: { recipe: Recipe; close: () => void; initialDate?: string; initialSlot?: Slot }) {
  const nav = useNav();
  const [mode, setMode] = useState<"single" | "prep">("single");
  const [monday, setMonday] = useState(mondayOf(initialDate ?? today()));
  const [date, setDate] = useState(initialDate ?? today());
  const [slot, setSlot] = useState<Slot>(initialSlot ?? (recipe.tags.includes("Frühstück") ? "breakfast" : recipe.tags.includes("Abend") ? "dinner" : "lunch"));
  const [servings, setServings] = useState(1);
  const [days, setDays] = useState(Math.max(2, Math.min(7, Math.floor(recipe.servings))));

  const save = async () => {
    if (mode === "single") {
      await addToPlan(date, slot, recipe.id, servings);
      nav.toast(`${SLOT_LABEL[slot]} am ${fmtDate(date, { weekday: "long" })} geplant`);
    } else {
      await mealPrep(recipe.id, date, days, slot, servings);
      nav.toast(`${days} Tage Meal Prep geplant`);
    }
    close();
  };

  const totalPortions = days * servings;

  return (
    <div className="px-4">
      <SheetHeader
        title="In Plan legen"
        onClose={close}
        right={
          <button onClick={save} className="press text-[17px] font-semibold text-accent">
            Planen
          </button>
        }
      />
      <Segmented
        className="mb-4"
        value={mode}
        onChange={setMode}
        options={[
          { value: "single", label: "Einzeln" },
          { value: "prep", label: "Meal Prep" },
        ]}
      />
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="label">{mode === "prep" ? "Starttag" : "Tag"}</span>
        <div className="flex items-center">
          <button className="press grid h-8 w-8 place-items-center text-accent" onClick={() => setMonday(addDays(monday, -7))}>
            <Icon name="back" size={18} />
          </button>
          <span className="tnum text-[13px] text-muted">{fmtDate(monday)}</span>
          <button className="press grid h-8 w-8 place-items-center text-accent" onClick={() => setMonday(addDays(monday, 7))}>
            <Icon name="chevron" size={18} />
          </button>
        </div>
      </div>
      <div className="mb-4 grid grid-cols-7 gap-1.5">
        {weekDays(monday).map((d, i) => {
          const inPrep = mode === "prep" && d >= date && d < addDays(date, days);
          return (
            <button
              key={d}
              onClick={() => {
                haptic();
                setDate(d);
              }}
              className={cx(
                "press flex flex-col items-center rounded-[12px] py-2",
                d === date ? "bg-accent text-black" : inPrep ? "bg-accent-soft text-accent" : "bg-card",
              )}
            >
              <span className="text-[11px] font-semibold opacity-70">{WD_SHORT[i]}</span>
              <span className="tnum text-[17px] font-bold">{+d.slice(8)}</span>
            </button>
          );
        })}
      </div>
      <span className="label mb-2 block px-1">Mahlzeit</span>
      <div className="mb-4 flex gap-2">
        {SLOTS.map((sl) => (
          <Chip key={sl} active={slot === sl} onClick={() => setSlot(sl)}>
            {SLOT_LABEL[sl]}
          </Chip>
        ))}
      </div>
      <div className="mb-3 flex items-center justify-between rounded-[16px] bg-card px-4 py-2.5">
        <span className="text-[16px]">{mode === "prep" ? "Portionen pro Tag" : "Portionen"}</span>
        <Stepper value={servings} min={0.5} step={0.5} onChange={setServings} />
      </div>
      {mode === "prep" && (
        <>
          <div className="mb-3 flex items-center justify-between rounded-[16px] bg-card px-4 py-2.5">
            <span className="text-[16px]">Anzahl Tage</span>
            <Stepper value={days} min={1} step={1} onChange={(v) => setDays(Math.min(14, v))} />
          </div>
          <p className={cx("px-1 text-[13px]", totalPortions > recipe.servings ? "text-accent" : "text-muted")}>
            Braucht {fmtAmount(totalPortions)} von {recipe.servings} Portionen des Rezepts
            {totalPortions > recipe.servings ? " – die Einkaufsliste rechnet die Mengen entsprechend hoch." : "."}
          </p>
        </>
      )}
      <Button className="mt-4 w-full" onClick={save}>
        {mode === "prep" ? `${days} Tage planen` : "Planen"}
      </Button>
    </div>
  );
}

export function CookMode({ recipe, servings, onClose }: { recipe: Recipe; servings: number; onClose: () => void }) {
  const [tab, setTab] = useState<"steps" | "ing">(recipe.steps.length ? "steps" : "ing");
  const [idx, setIdx] = useState(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [wake, setWake] = useState<"on" | "off" | "unsupported">("off");
  const scroller = useRef<HTMLDivElement>(null);
  const factor = servings / Math.max(recipe.servings, 0.1);

  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const req = async () => {
      try {
        if (!("wakeLock" in navigator)) return setWake("unsupported");
        lock = await navigator.wakeLock.request("screen");
        setWake("on");
        lock.addEventListener("release", () => setWake("off"));
      } catch {
        setWake("off");
      }
    };
    req();
    const vis = () => document.visibilityState === "visible" && req();
    document.addEventListener("visibilitychange", vis);
    return () => {
      document.removeEventListener("visibilitychange", vis);
      lock?.release().catch(() => {});
    };
  }, []);

  const goTo = (i: number) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="anim-sheet-in fixed inset-0 z-[70] flex flex-col bg-bg" style={{ paddingTop: "var(--sat)" }}>
      <div className="flex items-center justify-between px-3 py-2">
        <button aria-label="Kochmodus schließen" onClick={onClose} className="press grid h-10 w-10 place-items-center rounded-full bg-card">
          <Icon name="x" size={20} />
        </button>
        <div className="min-w-0 flex-1 px-3 text-center">
          <div className="truncate text-[16px] font-semibold">{recipe.title}</div>
          <div className="text-[12px] text-muted">{wake === "on" ? "Bildschirm bleibt an" : wake === "unsupported" ? "Bildschirm-Sperre nicht steuerbar" : `${fmtAmount(servings)} Portionen`}</div>
        </div>
        <div className="w-10" />
      </div>
      <div className="px-4 pb-3">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "steps", label: `Schritte (${recipe.steps.length})` },
            { value: "ing", label: `Zutaten (${checked.size}/${recipe.ingredients.length})` },
          ]}
        />
      </div>

      {tab === "steps" ? (
        <>
          <div
            ref={scroller}
            className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden"
            style={{ scrollbarWidth: "none" }}
            onScroll={(e) => {
              const el = e.currentTarget;
              const i = Math.round(el.scrollLeft / el.clientWidth);
              if (i !== idx) {
                setIdx(i);
                haptic();
              }
            }}
          >
            {recipe.steps.map((st, i) => (
              <div key={i} className="scroll flex w-full shrink-0 snap-center flex-col px-6 pt-6">
                <span className="label mb-3 text-accent!">
                  Schritt {i + 1} von {recipe.steps.length}
                </span>
                <p className="text-[28px] font-semibold leading-[1.3] tracking-tight">{st}</p>
              </div>
            ))}
            {!recipe.steps.length && <p className="w-full p-8 text-center text-muted">Keine Schritte erfasst.</p>}
          </div>
          <div className="flex items-center justify-between px-4 pt-3" style={{ paddingBottom: "calc(var(--sab) + 16px)" }}>
            <Button variant="secondary" disabled={idx === 0} onClick={() => goTo(idx - 1)} className="w-28">
              Zurück
            </Button>
            <div className="flex gap-1.5">
              {recipe.steps.map((_, i) => (
                <span key={i} className={cx("h-2 rounded-full transition-all", i === idx ? "w-5 bg-accent" : "w-2 bg-white/25")} />
              ))}
            </div>
            <Button disabled={idx >= recipe.steps.length - 1} onClick={() => goTo(idx + 1)} className="w-28">
              Weiter
            </Button>
          </div>
        </>
      ) : (
        <div className="scroll flex-1 px-4" style={{ paddingBottom: "calc(var(--sab) + 24px)" }}>
          <div className="divide-y divide-line overflow-hidden rounded-[18px] bg-card">
            {recipe.ingredients.map((i) => {
              const on = checked.has(i.id);
              return (
                <button
                  key={i.id}
                  onClick={() => {
                    haptic();
                    setChecked((s) => {
                      const n = new Set(s);
                      if (on) n.delete(i.id);
                      else n.add(i.id);
                      return n;
                    });
                  }}
                  className="flex w-full items-center gap-4 px-4 py-4 text-left"
                >
                  <span className={cx("grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-colors", on ? "border-accent bg-accent text-black" : "border-white/30")}>
                    {on && <Icon name="check" size={16} stroke={3} />}
                  </span>
                  <span className={cx("flex-1 text-[19px] transition-opacity", on && "line-through opacity-40")}>
                    <b className="tnum">
                      {i.amount != null && i.unit && !["g", "ml"].includes(i.unit) ? `${fmtAmount(i.amount * factor)} ${i.unit === "Stück" ? "" : i.unit}` : `${Math.round(i.grams * factor)} g`}
                    </b>{" "}
                    {i.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
