"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRef, useState, type ReactNode } from "react";
import { Icon } from "../icons";
import { Screen, SwipeRow, useNav } from "../nav";
import { Button, EmptyState, Group, ListRow, NumberField, Toggle, cx } from "../ui";
import { CustomFoodForm } from "./FoodPicker";
import { db, updateSettings } from "@/lib/db";
import { restoreBackup, shareBackup } from "@/lib/backup";
import { useRecipes, useSettings } from "@/lib/hooks";
import { addSampleData, removeSampleData } from "@/lib/samples";
import type { Goals } from "@/lib/types";
import { WD_LONG } from "@/lib/util";

export function SettingsScreen() {
  const nav = useNav();
  const s = useSettings();
  const recipes = useRecipes() ?? [];
  const fileRef = useRef<HTMLInputElement>(null);
  const hasSamples = recipes.some((r) => r.sample);
  const foods = useLiveQuery(() => db.foods.count(), []) ?? 0;

  return (
    <Screen title="Einstellungen" back>
      <h3 className="label mb-2 mt-2 px-1">Ernährung</h3>
      <Group>
        <ListRow
          icon="flame"
          title="Tagesziele"
          subtitle={`${s.goals.kcal} kcal · P ${s.goals.protein} · KH ${s.goals.carbs} · F ${s.goals.fat} · Bst ${s.goals.fiber}`}
          onClick={() => nav.push({ name: "goals" })}
        />
        <ListRow icon="pantry" title="Vorrat („Habe ich immer da“)" subtitle={`${s.pantry.length} Einträge`} onClick={() => nav.push({ name: "pantry" })} />
        <ListRow icon="barcode" title="Eigene Lebensmittel" subtitle={`${foods} angelegt`} onClick={() => nav.push({ name: "foods" })} />
      </Group>


      <h3 className="label mb-2 mt-6 px-1">Backup</h3>
      <Group>
        <ListRow
          icon="backup"
          title="Backup erstellen"
          subtitle={s.lastBackupAt ? `Letztes Backup: ${new Date(s.lastBackupAt).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })}` : "Noch nie gesichert"}
          onClick={async () => {
            const r = await shareBackup();
            if (r !== "cancelled") nav.toast("Backup erstellt");
          }}
        />
        <ListRow icon="restore" title="Aus Backup wiederherstellen" subtitle="Ersetzt alle aktuellen Daten" onClick={() => fileRef.current?.click()} />
      </Group>
      <p className="mt-2 px-1 text-[13px] leading-relaxed text-muted">
        Das Backup ist eine JSON-Datei mit allen Rezepten, Fotos, Plänen und Einstellungen. Speichere sie im Teilen-Menü unter „In Dateien sichern“ → iCloud Drive. Die App erinnert dich alle 14 Tage.
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (!window.confirm("Alle aktuellen Daten werden durch das Backup ersetzt. Fortfahren?")) return;
          try {
            const { recipes } = await restoreBackup(f);
            nav.toast(`Wiederhergestellt: ${recipes} Rezepte`);
          } catch (err) {
            nav.toast((err as Error).message || "Datei konnte nicht gelesen werden");
          }
        }}
      />

      <h3 className="label mb-2 mt-6 px-1">Beispieldaten</h3>
      <Group>
        {hasSamples ? (
          <ListRow
            icon="trash"
            danger
            title="Beispieldaten löschen"
            subtitle="Entfernt die 5 Beispielrezepte und ihre Einplanungen"
            onClick={async () => {
              const n = await removeSampleData();
              nav.toast(`${n} Beispielrezepte gelöscht`);
            }}
          />
        ) : (
          <ListRow
            icon="sparkle"
            title="Beispieldaten laden"
            subtitle="5 Rezepte und ein Wochenplan zum Ausprobieren"
            onClick={async () => {
              await addSampleData();
              nav.toast("Beispieldaten geladen");
            }}
          />
        )}
      </Group>

      <h3 className="label mb-2 mt-6 px-1">Speicher</h3>
      <Group>
        <ListRow
          icon="info"
          title="Dauerhafter Speicher"
          subtitle={s.persisted ? "Aktiv – iOS löscht die Daten nicht automatisch" : "Nicht bestätigt – zum Home-Bildschirm hinzufügen und regelmäßig sichern"}
          right={<span className={cx("text-[14px] font-semibold", s.persisted ? "text-ok" : "text-accent")}>{s.persisted ? "Ja" : "Nein"}</span>}
        />
        <ListRow icon="book" title="Rezepte" right={<span className="tnum text-muted">{recipes.length}</span>} />
      </Group>
      <p className="mt-6 text-center text-[12px] text-faint">Rezeptbuch · Nährwerte: USDA FoodData Central & Open Food Facts (ODbL)</p>
    </Screen>
  );
}

export function GoalsScreen() {
  const nav = useNav();
  const s = useSettings();
  const [goals, setGoals] = useState<Goals>(s.goals);
  const [perDay, setPerDay] = useState(s.dayGoals.some(Boolean));
  const [dayGoals, setDayGoals] = useState<(Goals | null)[]>(s.dayGoals);
  const [openDay, setOpenDay] = useState<number | null>(null);

  const fields: [keyof Goals, string, string][] = [
    ["kcal", "Kalorien", "kcal"],
    ["protein", "Protein", "g"],
    ["carbs", "Kohlenhydrate", "g"],
    ["fat", "Fett", "g"],
    ["fiber", "Ballaststoffe", "g"],
  ];

  const save = async () => {
    await updateSettings({ goals, dayGoals: perDay ? dayGoals : [null, null, null, null, null, null, null], goalsUpdatedAt: Date.now() });
    nav.pop();
    nav.toast("Ziele aktualisiert");
  };

  const editor = (g: Goals, onChange: (g: Goals) => void) => (
    <div className="divide-y divide-line">
      {fields.map(([k, label, unit]) => (
        <div key={k} className="flex items-center justify-between gap-3 px-4 py-2">
          <span className="text-[16px]">{label}</span>
          <NumberField className="w-32" value={g[k]} onChange={(v) => onChange({ ...g, [k]: v })} suffix={unit} />
        </div>
      ))}
    </div>
  );

  const kcalFromMacros = Math.round(goals.protein * 4 + goals.carbs * 4 + goals.fat * 9);

  return (
    <Screen
      title="Tagesziele"
      back
      right={
        <button onClick={save} className="press px-3 text-[17px] font-semibold text-accent">
          Sichern
        </button>
      }
    >
      <p className="mb-3 px-1 text-[14px] text-muted">
        Ziele aktualisiert am {new Date(s.goalsUpdatedAt).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}. Übernimm hier die neuen Werte, sobald MacroFactor sie wöchentlich anpasst.
      </p>
      <div className="overflow-hidden rounded-[16px] bg-card">{editor(goals, setGoals)}</div>
      <p className={cx("mt-2 px-1 text-[13px]", Math.abs(kcalFromMacros - goals.kcal) > 60 ? "text-accent" : "text-muted")}>
        Aus den Makros ergeben sich {kcalFromMacros} kcal.
      </p>

      <div className="mt-6 flex items-center justify-between rounded-[16px] bg-card px-4 py-3">
        <div>
          <div className="text-[16px]">Ziele pro Wochentag</div>
          <div className="text-[13px] text-muted">z. B. mehr an Trainingstagen</div>
        </div>
        <Toggle on={perDay} onChange={setPerDay} />
      </div>
      {perDay && (
        <div className="mt-3 space-y-2">
          {WD_LONG.map((d, i) => {
            const g = dayGoals[i];
            return (
              <div key={d} className="overflow-hidden rounded-[16px] bg-card">
                <button onClick={() => setOpenDay(openDay === i ? null : i)} className="flex w-full items-center justify-between px-4 py-3 text-left">
                  <span className="text-[16px]">{d}</span>
                  <span className="tnum text-[13px] text-muted">{g ? `${g.kcal} kcal · P ${g.protein}` : "Standard"}</span>
                </button>
                {openDay === i && (
                  <div className="border-t border-line pb-2">
                    {editor(g ?? goals, (ng) => setDayGoals(dayGoals.map((x, j) => (j === i ? ng : x))))}
                    {g && (
                      <button className="px-4 pt-2 text-[14px] text-accent" onClick={() => setDayGoals(dayGoals.map((x, j) => (j === i ? null : x)))}>
                        Auf Standard zurücksetzen
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Screen>
  );
}

export function PantryScreen() {
  const s = useSettings();
  const [text, setText] = useState("");
  const add = () => {
    const t = text.trim();
    if (!t || s.pantry.some((p) => p.toLowerCase() === t.toLowerCase())) return setText("");
    updateSettings({ pantry: [...s.pantry, t] });
    setText("");
  };
  return (
    <Screen title="Vorrat" back>
      <p className="mb-3 px-1 text-[14px] text-muted">Diese Zutaten hast du immer da. Sie werden in der Einkaufsliste ausgeblendet und lassen sich dort mit einem Tipp einblenden.</p>
      <div className="mb-4 flex items-center gap-2 rounded-[14px] bg-card px-3">
        <Icon name="plus" size={18} className="text-accent" />
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="z. B. Paprikapulver" className="min-w-0 flex-1 bg-transparent py-3 outline-none" />
      </div>
      <div className="divide-y divide-line overflow-hidden rounded-[16px] bg-card">
        {s.pantry.map((p) => (
          <SwipeRow key={p} className="bg-card" actions={[{ label: "Entfernen", color: "var(--color-danger)", onAction: () => updateSettings({ pantry: s.pantry.filter((x) => x !== p) }) }]}>
            <div className="bg-card px-4 py-3 text-[16px]">{p}</div>
          </SwipeRow>
        ))}
      </div>
      {s.pantry.length > 0 && <p className="mt-2 px-1 text-[13px] text-muted">Nach links wischen zum Entfernen.</p>}
    </Screen>
  );
}

export function FoodsScreen() {
  const nav = useNav();
  const foods = useLiveQuery(() => db.foods.orderBy("name").toArray(), []);
  return (
    <Screen
      title="Eigene Lebensmittel"
      back
      right={
        <button className="press px-3 text-accent" onClick={() => nav.openSheet((close) => <CustomFoodForm name="" close={close} />)}>
          <Icon name="plus" size={24} />
        </button>
      }
    >
      {foods && foods.length === 0 && (
        <EmptyState
          icon="barcode"
          title="Noch keine eigenen Lebensmittel"
          text="Lege Produkte an, die nicht in der Basisliste oder bei Open Food Facts sind – mit Werten pro 100 g oder pro Stück."
          action={<Button onClick={() => nav.openSheet((close) => <CustomFoodForm name="" close={close} />)}>Lebensmittel anlegen</Button>}
        />
      )}
      <div className="divide-y divide-line overflow-hidden rounded-[16px] bg-card">
        {foods?.map((f) => (
          <SwipeRow
            key={f.id}
            className="bg-card"
            actions={[
              {
                label: "Löschen",
                color: "var(--color-danger)",
                onAction: async () => {
                  await db.foods.delete(f.id);
                  nav.toast(`${f.name} gelöscht`, () => db.foods.put(f));
                },
              },
            ]}
          >
            <button className="block w-full bg-card px-4 py-3 text-left" onClick={() => nav.openSheet((close) => <CustomFoodForm name={f.name} existing={f} close={close} />)}>
              <div className="text-[16px]">{f.name}</div>
              <div className="tnum text-[12px] text-muted">
                {Math.round(f.per100.kcal)} kcal · P {Math.round(f.per100.protein * 10) / 10} · KH {Math.round(f.per100.carbs * 10) / 10} · F {Math.round(f.per100.fat * 10) / 10} pro 100 g
                {f.pieceG ? ` · 1 Stück = ${f.pieceG} g` : ""}
              </div>
            </button>
          </SwipeRow>
        ))}
      </div>
    </Screen>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="tnum grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-[14px] font-bold text-black">{n}</span>
      <div className="pt-0.5 text-[15px] leading-relaxed">{children}</div>
    </li>
  );
}

export function ShortcutScreen() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return (
    <Screen title="Kurzbefehl" back>
      <div className="mb-5 rounded-[18px] bg-card p-4 text-[15px] leading-relaxed">
        <p className="mb-2 font-semibold">So funktioniert der Import</p>
        <p className="text-muted">
          Web-Apps können sich nicht direkt ins Teilen-Menü von iOS eintragen. Deshalb baust du einmalig einen Kurzbefehl: Er kopiert den Link aus Instagram oder TikTok. Danach öffnest du das Rezeptbuch und tippst auf
          <b className="text-white"> „Rezept aus Zwischenablage importieren“</b>.
        </p>
      </div>

      <h3 className="label mb-3 px-1">Kurzbefehl anlegen (einmalig, ca. 2 Minuten)</h3>
      <ol className="space-y-4">
        <Step n={1}>
          Öffne die App <b>Kurzbefehle</b> (lila Symbol, ist auf jedem iPhone vorinstalliert).
        </Step>
        <Step n={2}>
          Tippe unten auf <b>Kurzbefehle</b> und dann oben rechts auf <b>+</b>.
        </Step>
        <Step n={3}>
          Tippe oben auf den Namen <b>Neuer Kurzbefehl</b> → <b>Umbenennen</b> und gib <b>Ins Rezeptbuch</b> ein. Tippe auf <b>Fertig</b> auf der Tastatur.
        </Step>
        <Step n={4}>
          Tippe nochmal oben auf den Namen → <b>Details</b> (bzw. das <b>ⓘ</b>-Symbol) → schalte <b>Im Share-Sheet anzeigen</b> ein → <b>Fertig</b>.
        </Step>
        <Step n={5}>
          Oben steht jetzt „Empfängt <b>Alle</b> Eingaben vom <b>Share-Sheet</b>“. Tippe auf <b>Alle</b>, lass nur <b>URLs</b> und <b>Text</b> eingeschaltet → <b>Fertig</b>.
        </Step>
        <Step n={6}>
          Tippe unten in das Suchfeld <b>Nach Apps und Aktionen suchen</b>, suche <b>In Zwischenablage kopieren</b> und tippe darauf. In der Aktion steht automatisch <b>Kurzbefehleingabe</b> – das ist richtig.
        </Step>
        <Step n={7}>
          Suche noch die Aktion <b>Mitteilung anzeigen</b>, tippe darauf und ersetze den Text durch: <b>Kopiert – jetzt Rezeptbuch öffnen</b>.
        </Step>
        <Step n={8}>
          Tippe oben rechts auf <b>Fertig</b>. Geschafft!
        </Step>
      </ol>

      <h3 className="label mb-3 mt-7 px-1">So benutzt du ihn</h3>
      <ol className="space-y-4">
        <Step n={1}>
          Im Reel auf <b>Teilen</b> (Papierflieger bei Instagram, Pfeil bei TikTok) tippen → <b>Mehr</b> bzw. <b>Teilen über …</b> → <b>Ins Rezeptbuch</b>.
        </Step>
        <Step n={2}>
          Rezeptbuch vom Home-Bildschirm öffnen und auf das orange Feld <b>Rezept aus Zwischenablage importieren</b> tippen (oder auf <b>+</b> → <b>Aus Zwischenablage</b>).
        </Step>
        <Step n={3}>
          iOS fragt einmal „Einfügen erlauben?“ → <b>Einfügen erlauben</b>. TikTok-Rezepte werden automatisch geladen, bei Instagram kopierst du zusätzlich die Caption (Caption gedrückt halten → <b>Kopieren</b>).
        </Step>
        <Step n={4}>Im Prüf-Bildschirm kurz die orange markierten Stellen checken und speichern.</Step>
      </ol>

      <div className="mt-7 rounded-[18px] bg-card p-4 text-[14px] leading-relaxed text-muted">
        <p className="mb-1 font-semibold text-white">Für Fortgeschrittene</p>
        <p>
          Die App versteht auch Import-Links: <span className="break-all font-mono text-[12px] text-white/80">{origin}/import?url=…&amp;text=…</span>. iOS öffnet solche Links aus Kurzbefehlen aber in Safari – und Safari hat einen
          getrennten Speicher von der Home-Bildschirm-App. Deshalb ist der Weg über die Zwischenablage zuverlässiger.
        </p>
        <p className="mt-2">Einen fertigen iCloud-Link zum Kurzbefehl kann ich leider nicht erzeugen – der muss einmal auf deinem iPhone gebaut werden.</p>
      </div>
    </Screen>
  );
}
