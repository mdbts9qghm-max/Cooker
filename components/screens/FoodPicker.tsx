"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Icon } from "../icons";
import { SheetHeader, useNav } from "../nav";
import { Button, NumberField, Segmented, cx } from "../ui";
import { db } from "@/lib/db";
import { BASE_FOODS } from "@/lib/foods-base";
import { baseToRef, customToRef, normKey, searchBase } from "@/lib/nutrition";
import type { CustomFood, FoodRef, Macros } from "@/lib/types";
import { uid } from "@/lib/util";

type OFFItem = { id: string; name: string; brand?: string; barcode?: string; per100: Macros; pieceG?: number };

function offToRef(i: OFFItem): FoodRef {
  return { source: "off", id: i.barcode ?? i.id, name: i.brand ? `${i.name} (${i.brand})` : i.name, per100: i.per100, pieceG: i.pieceG };
}

function MacroLine({ m }: { m: Macros }) {
  return (
    <span className="tnum text-[12px] text-muted">
      {Math.round(m.kcal)} kcal · P {m.protein} · KH {m.carbs} · F {m.fat} · Bst {m.fiber} <span className="text-faint">/100 g</span>
    </span>
  );
}

export function FoodPicker({ initial, onPick, close }: { initial: string; onPick: (f: FoodRef) => void; close: () => void }) {
  const nav = useNav();
  const [q, setQ] = useState(initial);
  const [off, setOff] = useState<OFFItem[] | null>(null);
  const [offState, setOffState] = useState<"idle" | "loading" | "error">("idle");
  const custom = useLiveQuery(() => db.foods.toArray(), []) ?? [];
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const base = useMemo(() => (q.trim() ? searchBase(q, 12) : BASE_FOODS.slice(0, 0)), [q]);
  const own = useMemo(() => {
    const k = normKey(q);
    return custom.filter((c) => !k || normKey(c.name).includes(k)).slice(0, 10);
  }, [custom, q]);

  const searchOFF = async (term: string) => {
    if (term.trim().length < 2) return;
    setOffState("loading");
    try {
      const res = await fetch(`/api/food?q=${encodeURIComponent(term)}`);
      const data = await res.json();
      setOff(data.items ?? []);
      setOffState(res.ok ? "idle" : "error");
    } catch {
      setOffState("error");
    }
  };

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    setOff(null);
    if (q.trim().length >= 3 && navigator.onLine) timer.current = setTimeout(() => searchOFF(q), 700);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  const pick = (f: FoodRef) => {
    onPick(f);
    close();
  };

  const row = (key: string, title: string, badge: string, m: Macros, onClick: () => void) => (
    <button key={key} onClick={onClick} className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-white/5">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px]">{title}</span>
        <MacroLine m={m} />
      </span>
      <span className="shrink-0 rounded-full bg-card2 px-2 py-0.5 text-[11px] font-semibold text-muted">{badge}</span>
    </button>
  );

  return (
    <div>
      <SheetHeader title="Lebensmittel wählen" onClose={close} />
      <div className="flex gap-2 px-4 pb-3">
        <div className="relative flex-1">
          <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suchen …" className="field pl-9" autoFocus />
        </div>
        <button
          aria-label="Barcode scannen"
          onClick={() =>
            nav.setOverlay(
              <BarcodeScanner
                onClose={() => nav.setOverlay(null)}
                onFound={async (code) => {
                  nav.setOverlay(null);
                  nav.toast("Produkt wird gesucht …");
                  try {
                    const res = await fetch(`/api/food?barcode=${code}`);
                    const data = await res.json();
                    const item = data.items?.[0] as OFFItem | undefined;
                    if (item) pick(offToRef(item));
                    else nav.toast("Produkt nicht in Open Food Facts gefunden");
                  } catch {
                    nav.toast("Keine Verbindung zu Open Food Facts");
                  }
                }}
              />,
            )
          }
          className="press grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[12px] bg-card2 text-accent"
        >
          <Icon name="barcode" size={22} />
        </button>
      </div>

      {own.length > 0 && (
        <>
          <div className="label px-4 pb-1 pt-2">Eigene Lebensmittel</div>
          <div className="divide-y divide-line">{own.map((c) => row(c.id, c.name, "Eigen", c.per100, () => pick(customToRef(c))))}</div>
        </>
      )}
      {base.length > 0 && (
        <>
          <div className="label px-4 pb-1 pt-3">Grundzutaten</div>
          <div className="divide-y divide-line">{base.map((f) => row(f.id, f.name, "Basis", f.per100, () => pick(baseToRef(f))))}</div>
        </>
      )}
      <div className="label flex items-center justify-between px-4 pb-1 pt-3">
        <span>Open Food Facts</span>
        {offState === "loading" && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent border-t-transparent" />}
      </div>
      {off && off.length > 0 && <div className="divide-y divide-line">{off.map((i) => row(i.id, i.brand ? `${i.name} · ${i.brand}` : i.name, "OFF", i.per100, () => pick(offToRef(i))))}</div>}
      {off && off.length === 0 && <p className="px-4 py-2 text-[14px] text-muted">Keine Markenprodukte gefunden.</p>}
      {offState === "error" && <p className="px-4 py-2 text-[14px] text-muted">Open Food Facts gerade nicht erreichbar (offline?).</p>}
      {!off && offState === "idle" && q.trim().length >= 2 && (
        <button onClick={() => searchOFF(q)} className="px-4 py-2 text-[15px] text-accent">
          In Open Food Facts suchen
        </button>
      )}

      <div className="px-4 pt-5">
        <Button
          variant="secondary"
          icon="plus"
          className="w-full"
          onClick={() => nav.openSheet((c) => <CustomFoodForm name={q} close={c} onSaved={(f) => pick(customToRef(f))} />)}
        >
          Eigenes Lebensmittel anlegen
        </Button>
      </div>
    </div>
  );
}

export function CustomFoodForm({ name: initialName, close, onSaved, existing }: { name: string; close: () => void; onSaved?: (f: CustomFood) => void; existing?: CustomFood }) {
  const [name, setName] = useState(existing?.name ?? initialName);
  const [mode, setMode] = useState<"100g" | "piece">(existing?.perPiece ? "piece" : "100g");
  const [pieceG, setPieceG] = useState<number>(existing?.pieceG ?? 0);
  const [vals, setVals] = useState<Macros>(() => {
    if (existing?.perPiece && existing.pieceG) {
      const f = existing.pieceG / 100;
      const p = existing.per100;
      return { kcal: +(p.kcal * f).toFixed(1), protein: +(p.protein * f).toFixed(1), carbs: +(p.carbs * f).toFixed(1), fat: +(p.fat * f).toFixed(1), fiber: +(p.fiber * f).toFixed(1) };
    }
    return existing?.per100 ?? { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  });
  const set = (k: keyof Macros) => (v: number) => setVals((s) => ({ ...s, [k]: v }));
  const valid = name.trim() && (mode === "100g" || pieceG > 0);

  const save = async () => {
    if (!valid) return;
    let per100 = vals;
    if (mode === "piece") {
      const f = 100 / pieceG;
      per100 = { kcal: vals.kcal * f, protein: vals.protein * f, carbs: vals.carbs * f, fat: vals.fat * f, fiber: vals.fiber * f };
    }
    const food: CustomFood = {
      id: existing?.id ?? uid(),
      name: name.trim(),
      per100,
      pieceG: pieceG || undefined,
      perPiece: mode === "piece",
      createdAt: existing?.createdAt ?? Date.now(),
    };
    await db.foods.put(food);
    onSaved?.(food);
    close();
  };

  const fields: [keyof Macros, string, string][] = [
    ["kcal", "Kalorien", "kcal"],
    ["protein", "Protein", "g"],
    ["carbs", "Kohlenhydrate", "g"],
    ["fat", "Fett", "g"],
    ["fiber", "Ballaststoffe", "g"],
  ];

  return (
    <div className="px-4">
      <SheetHeader
        title={existing ? "Lebensmittel bearbeiten" : "Eigenes Lebensmittel"}
        onClose={close}
        right={
          <button disabled={!valid} onClick={save} className="press text-[17px] font-semibold text-accent disabled:opacity-40">
            Sichern
          </button>
        }
      />
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, z. B. Proteinbrot" className="field mb-3" />
      <Segmented
        className="mb-3"
        value={mode}
        onChange={setMode}
        options={[
          { value: "100g", label: "Pro 100 g" },
          { value: "piece", label: "Pro Stück" },
        ]}
      />
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-[15px] text-muted">{mode === "piece" ? "Gewicht pro Stück" : "Gewicht pro Stück (optional)"}</span>
        <NumberField className="w-32" value={pieceG || null} onChange={setPieceG} suffix="g" />
      </div>
      <div className="space-y-2">
        {fields.map(([k, label, unit]) => (
          <div key={k} className="flex items-center justify-between gap-3">
            <span className="text-[15px]">{label}</span>
            <NumberField className="w-32" value={vals[k]} onChange={set(k)} suffix={unit} />
          </div>
        ))}
      </div>
      <p className={cx("mt-3 text-[13px] text-muted")}>Werte findest du auf der Verpackung unter „Nährwerte“.</p>
    </div>
  );
}

export function BarcodeScanner({ onFound, onClose }: { onFound: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let stop: (() => void) | null = null;
    let done = false;
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          video.current!,
          (result) => {
            if (result && !done) {
              done = true;
              navigator.vibrate?.(30);
              controls.stop();
              onFound(result.getText());
            }
          },
        );
        stop = () => controls.stop();
      } catch {
        setErr("Kamera nicht verfügbar. Erlaube den Kamerazugriff in den Einstellungen.");
      }
    })();
    return () => stop?.();
  }, [onFound]);

  return (
    <div className="anim-fade-in fixed inset-0 z-[90] bg-black">
      <video ref={video} className="absolute inset-0 h-full w-full object-cover" playsInline muted />
      <div className="absolute inset-0 grid place-items-center">
        <div className="h-[160px] w-[78%] max-w-[340px] rounded-[20px] border-[3px] border-accent shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]" />
      </div>
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4" style={{ paddingTop: "calc(var(--sat) + 10px)" }}>
        <span className="text-[17px] font-semibold">Barcode scannen</span>
        <button onClick={onClose} className="press grid h-10 w-10 place-items-center rounded-full bg-white/15">
          <Icon name="x" size={20} />
        </button>
      </div>
      {err && <p className="absolute inset-x-6 bottom-24 rounded-[14px] bg-card p-4 text-center text-[15px]">{err}</p>}
    </div>
  );
}
