"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useRef, useState } from "react";
import { Icon } from "../icons";
import { Screen, SheetHeader, SwipeRow, useNav } from "../nav";
import { EmptyState, IconButton, Segmented, cx } from "../ui";
import { db, updateSettings } from "@/lib/db";
import { usePlanRange, useRecipeMap, useSettings } from "@/lib/hooks";
import { buildShoppingList, fmtShopAmount, isPantry, type ShopItem } from "@/lib/shopping";
import { AISLES, type ShoppingState } from "@/lib/types";
import { addDays, fmtWeekRange, haptic, mondayOf, shareOrCopyText, today, uid, weekDays } from "@/lib/util";

export function ShoppingScreen() {
  const nav = useNav();
  const [which, setWhich] = useState<"this" | "next">("this");
  const monday = which === "this" ? mondayOf(today()) : addDays(mondayOf(today()), 7);
  // diese Woche: nur ab heute einkaufen
  const from = which === "this" ? today() : monday;
  const days = weekDays(monday);
  const entries = usePlanRange(from, days[6]) ?? [];
  const recipes = useRecipeMap();
  const settings = useSettings();
  const state = useLiveQuery(() => db.shopping.get(monday), [monday]);
  const st: ShoppingState = state ?? { week: monday, checked: [], have: [], manual: [] };
  const [showPantry, setShowPantry] = useState(false);
  const [manual, setManual] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => buildShoppingList(entries, recipes, settings.aisles), [entries, recipes, settings.aisles]);
  const pantryItems = items.filter((i) => isPantry(i.name, settings.pantry));
  const visible = items.filter((i) => (showPantry || !isPantry(i.name, settings.pantry)) && !st.have.includes(i.key));
  const haveItems = items.filter((i) => st.have.includes(i.key));

  const save = (patch: Partial<ShoppingState>) => db.shopping.put({ ...st, ...patch, week: monday });
  const toggle = (key: string) => {
    haptic();
    save({ checked: st.checked.includes(key) ? st.checked.filter((k) => k !== key) : [...st.checked, key] });
  };

  const groups = AISLES.map((a) => ({
    aisle: a,
    items: visible.filter((i) => i.aisle === a).sort((x, y) => Number(st.checked.includes(x.key)) - Number(st.checked.includes(y.key))),
  })).filter((g) => g.items.length);

  const open = visible.filter((i) => !st.checked.includes(i.key)).length + st.manual.filter((m) => !m.checked).length;

  const share = async () => {
    const lines: string[] = [`Einkauf ${fmtWeekRange(monday)}`];
    for (const g of groups) {
      const todo = g.items.filter((i) => !st.checked.includes(i.key));
      if (!todo.length) continue;
      lines.push("", g.aisle.toUpperCase());
      for (const i of todo) lines.push(`☐ ${i.name} – ${fmtShopAmount(i)}`);
    }
    const man = st.manual.filter((m) => !m.checked);
    if (man.length) lines.push("", "SONSTIGES", ...man.map((m) => `☐ ${m.text}`));
    const r = await shareOrCopyText(lines.join("\n"), "Einkaufsliste");
    if (r === "copied") nav.toast("Liste kopiert");
  };

  const changeAisle = (it: ShopItem) =>
    nav.openSheet((close) => (
      <div className="px-4">
        <SheetHeader title={it.name} />
        <p className="mb-3 px-1 text-[14px] text-muted">In welchem Bereich findest du das? Die App merkt sich deine Wahl.</p>
        <div className="divide-y divide-line overflow-hidden rounded-[16px] bg-card">
          {AISLES.map((a) => (
            <button
              key={a}
              className="flex w-full items-center justify-between px-4 py-3.5 text-left text-[16px]"
              onClick={async () => {
                await updateSettings({ aisles: { ...settings.aisles, [it.key]: a } });
                close();
              }}
            >
              {a}
              {it.aisle === a && <Icon name="check" size={20} className="text-accent" />}
            </button>
          ))}
        </div>
      </div>
    ));

  const addManual = () => {
    const t = manual.trim();
    if (!t) return;
    save({ manual: [...st.manual, { id: uid(), text: t, checked: false }] });
    setManual("");
    inputRef.current?.focus();
  };

  return (
    <Screen
      title="Einkauf"
      left={<IconButton name="gear" label="Einstellungen" onClick={() => nav.push({ name: "settings" })} />}
      right={<IconButton name="share" label="Liste teilen" onClick={share} />}
    >
      <Segmented
        className="mb-3"
        value={which}
        onChange={setWhich}
        options={[
          { value: "this", label: "Diese Woche" },
          { value: "next", label: "Nächste Woche" },
        ]}
      />
      <p className="mb-3 px-1 text-[13px] text-muted">
        {which === "this" ? "Ab heute bis Sonntag" : fmtWeekRange(monday)} · {open} offen · tippen zum Abhaken, wischen für Vorrat
      </p>

      {/* Manuell */}
      <div className="mb-4 flex items-center gap-2 rounded-[14px] bg-card px-3">
        <Icon name="plus" size={18} className="text-accent" />
        <input
          ref={inputRef}
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addManual()}
          enterKeyHint="done"
          placeholder="Eigener Eintrag, z. B. Spülmittel"
          className="min-w-0 flex-1 bg-transparent py-3 outline-none"
        />
      </div>

      {items.length === 0 && st.manual.length === 0 ? (
        <EmptyState icon="cart" title="Nichts zu kaufen" text="Plane Mahlzeiten im Wochenplaner – die Einkaufsliste entsteht dann automatisch." action={undefined} />
      ) : null}

      {groups.map((g) => (
        <div key={g.aisle}>
          <h3 className="label mb-2 mt-5 px-1">{g.aisle}</h3>
          <div className="divide-y divide-line overflow-hidden rounded-[16px] bg-card">
            {g.items.map((it) => {
              const done = st.checked.includes(it.key);
              const pantry = isPantry(it.name, settings.pantry);
              return (
                <SwipeRow
                  key={it.key}
                  className="bg-card"
                  actions={[
                    {
                      label: pantry ? "Kein Vorrat" : "Vorrat",
                      color: "#3a3a3f",
                      onAction: async () => {
                        const next = pantry ? settings.pantry.filter((p) => !isPantry(it.name, [p])) : [...settings.pantry, it.name];
                        await updateSettings({ pantry: next });
                        nav.toast(pantry ? `${it.name} ist kein Vorrat mehr` : `${it.name} zum Vorrat hinzugefügt`);
                      },
                    },
                    { label: "Hab ich", color: "var(--color-ok)", onAction: () => save({ have: [...st.have, it.key] }) },
                  ]}
                >
                  <div
                    role="button"
                    onClick={() => toggle(it.key)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      changeAisle(it);
                    }}
                    className="flex items-center gap-3 bg-card px-4 py-3"
                  >
                    <span className={cx("grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors", done ? "border-accent bg-accent text-black" : "border-white/30")}>
                      {done && <Icon name="check" size={14} stroke={3.2} />}
                    </span>
                    <span className={cx("min-w-0 flex-1 transition-opacity", done && "opacity-40")}>
                      <span className={cx("block truncate text-[16px]", done && "line-through")}>
                        {it.name}
                        {pantry && <span className="ml-2 text-[12px] text-muted">Vorrat</span>}
                      </span>
                      <span className="block truncate text-[12px] text-muted">{it.recipes.join(" · ")}</span>
                    </span>
                    <span className={cx("tnum shrink-0 text-[15px] font-semibold", done && "opacity-40")}>{fmtShopAmount(it)}</span>
                    <button
                      aria-label="Bereich ändern"
                      onClick={(e) => {
                        e.stopPropagation();
                        changeAisle(it);
                      }}
                      className="-mr-2 grid h-8 w-6 place-items-center text-faint"
                    >
                      <Icon name="more" size={18} stroke={3} />
                    </button>
                  </div>
                </SwipeRow>
              );
            })}
          </div>
        </div>
      ))}

      {st.manual.length > 0 && (
        <>
          <h3 className="label mb-2 mt-5 px-1">Eigene Einträge</h3>
          <div className="divide-y divide-line overflow-hidden rounded-[16px] bg-card">
            {st.manual.map((m) => (
              <SwipeRow key={m.id} className="bg-card" actions={[{ label: "Löschen", color: "var(--color-danger)", onAction: () => save({ manual: st.manual.filter((x) => x.id !== m.id) }) }]}>
                <div
                  role="button"
                  onClick={() => {
                    haptic();
                    save({ manual: st.manual.map((x) => (x.id === m.id ? { ...x, checked: !x.checked } : x)) });
                  }}
                  className="flex items-center gap-3 bg-card px-4 py-3"
                >
                  <span className={cx("grid h-6 w-6 shrink-0 place-items-center rounded-full border-2", m.checked ? "border-accent bg-accent text-black" : "border-white/30")}>
                    {m.checked && <Icon name="check" size={14} stroke={3.2} />}
                  </span>
                  <span className={cx("flex-1 text-[16px]", m.checked && "line-through opacity-40")}>{m.text}</span>
                </div>
              </SwipeRow>
            ))}
          </div>
        </>
      )}

      {(pantryItems.length > 0 || haveItems.length > 0) && (
        <div className="mt-5 space-y-2 px-1 text-[14px]">
          {pantryItems.length > 0 && (
            <button onClick={() => setShowPantry(!showPantry)} className="flex items-center gap-2 text-accent">
              <Icon name="pantry" size={18} />
              {showPantry ? "Vorratsartikel ausblenden" : `${pantryItems.length} Vorratsartikel ausgeblendet – einblenden`}
            </button>
          )}
          {haveItems.length > 0 && (
            <button onClick={() => save({ have: [] })} className="flex items-center gap-2 text-muted">
              <Icon name="undo" size={18} />
              {haveItems.length} als „Habe ich schon“ markiert ({haveItems.map((h) => h.name).join(", ")}) – zurücksetzen
            </button>
          )}
        </div>
      )}

      {st.checked.length > 0 && (
        <button onClick={() => save({ checked: [] })} className="mt-4 px-1 text-[14px] text-muted">
          Alle Häkchen entfernen
        </button>
      )}
    </Screen>
  );
}
