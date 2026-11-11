"use client";

import { useState } from "react";
import { Icon, type IconName } from "../icons";
import { SheetHeader, useNav } from "../nav";
import { Button, cx } from "../ui";
import { detectUrl, draftFromText, draftFromTikTok, draftManual } from "@/lib/importer";

type Nav = ReturnType<typeof useNav>;

/**
 * Zentraler Import: erkennt TikTok-/Instagram-Links oder Caption-Text und öffnet den Prüf-Bildschirm.
 */
export async function runImport(nav: Nav, input: string) {
  const { url, kind } = detectUrl(input);
  const textWithoutUrl = url ? input.replace(url, "").trim() : input.trim();
  if (kind === "tiktok" && url) {
    nav.toast("TikTok-Rezept wird geladen …");
    try {
      const d = await draftFromTikTok(url, textWithoutUrl);
      nav.push({ name: "review", draftId: d.id });
    } catch (e) {
      const msg = (e as Error).message || "TikTok nicht erreichbar";
      nav.openSheet((close) => <ImportSheet close={close} initialMode="text" initialText={textWithoutUrl} hint="tiktok" hintText={msg} />);
    }
    return;
  }
  if (kind === "instagram" && textWithoutUrl.length < 20) {
    nav.openSheet((close) => <ImportSheet close={close} initialMode="text" hint="instagram" />);
    return;
  }
  if (!textWithoutUrl) {
    nav.openSheet((close) => <ImportSheet close={close} initialMode="text" />);
    return;
  }
  const d = await draftFromText(textWithoutUrl, { origin: kind === "instagram" ? "instagram" : "text", source: kind === "instagram" ? "Instagram" : undefined });
  nav.push({ name: "review", draftId: d.id });
}

export function ImportSheet({
  close,
  initialMode = "menu",
  initialText = "",
  hint,
  hintText,
}: {
  close: () => void;
  initialMode?: "menu" | "text";
  initialText?: string;
  hint?: "instagram" | "tiktok";
  hintText?: string;
}) {
  const nav = useNav();
  const [mode, setMode] = useState(initialMode);
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState(false);

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t.trim()) setText(t);
      else nav.toast("Zwischenablage ist leer");
    } catch {
      nav.toast("Bitte lange ins Textfeld tippen und „Einfügen“ wählen");
    }
  };

  const go = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    const { url, kind } = detectUrl(text);
    if (kind === "tiktok" && url && text.replace(url, "").trim().length < 20) {
      close();
      await runImport(nav, text);
      return;
    }
    const clean = url ? text.replace(url, "") : text;
    const d = await draftFromText(clean, { origin: kind === "instagram" ? "instagram" : "text" });
    close();
    nav.push({ name: "review", draftId: d.id });
  };

  if (mode === "menu") {
    const opt = (icon: IconName, title: string, sub: string, onClick: () => void, primary?: boolean) => (
      <button onClick={onClick} className={cx("press flex w-full items-center gap-3.5 rounded-[18px] p-4 text-left", primary ? "bg-accent text-black" : "bg-card")}>
        <span className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-[13px]", primary ? "bg-black/15" : "bg-accent-soft text-accent")}>
          <Icon name={icon} size={23} />
        </span>
        <span className="min-w-0">
          <span className="block text-[17px] font-semibold">{title}</span>
          <span className={cx("block text-[13px]", primary ? "text-black/70" : "text-muted")}>{sub}</span>
        </span>
      </button>
    );
    return (
      <div className="px-4">
        <SheetHeader title="Rezept hinzufügen" />
        <div className="space-y-2.5">
          {opt("text", "Text einfügen", "Rezepttext aus Instagram, TikTok & Co. kopieren und einfügen", () => setMode("text"), true)}
          {opt("edit", "Selber anlegen", "Titel, Zutaten und Schritte selbst eintippen", () => {
            const d = draftManual();
            close();
            nav.push({ name: "review", draftId: d.id });
          })}
        </div>
        <p className="mt-4 px-1 text-[13px] leading-relaxed text-muted">
          Tipp: Beschreibung im Reel antippen, gedrückt halten und „Kopieren“ wählen.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4">
      <SheetHeader
        title="Text einfügen"
        onClose={close}
        right={
          <button disabled={!text.trim() || busy} onClick={go} className="press text-[17px] font-semibold text-accent disabled:opacity-40">
            Weiter
          </button>
        }
      />
      {(hint === "instagram" || hint === "tiktok") && (
        <div className="mb-3 flex gap-3 rounded-[14px] bg-accent-soft p-3.5 text-[14px] leading-snug">
          <Icon name="info" size={20} className="mt-0.5 shrink-0 text-accent" />
          <span>
            {hint === "tiktok" ? `${(hintText ?? "TikTok war gerade nicht erreichbar").replace(/\.?$/, ".")} ` : "Ein Link allein reicht nicht. "}
            Öffne das Video, tippe auf die Beschreibung, halte sie gedrückt und wähle <b>Kopieren</b> – dann hier einfügen.
          </span>
        </div>
      )}
      <textarea
        autoFocus={!text}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"Rezepttext hier einfügen …\n\nZ. B.\nProtein Bowl\n200 g Hähnchenbrust\n100 g Reis\n…"}
        className="field min-h-[300px] resize-none leading-relaxed"
      />
      <Button variant="secondary" icon="clipboard" className="mt-3 w-full" onClick={paste}>
        Aus Zwischenablage einfügen
      </Button>
      <Button className="mt-3 w-full" disabled={!text.trim() || busy} onClick={go}>
        {busy ? "Wird erkannt …" : "Rezept erkennen"}
      </Button>
    </div>
  );
}
