"use client";

import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "../icons";
import { SheetHeader, useNav } from "../nav";
import { Button, cx } from "../ui";
import { detectUrl, draftFromText, draftFromTikTok, draftManual, ocrImages } from "@/lib/importer";

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
  initialMode?: "menu" | "text" | "ocr";
  initialText?: string;
  hint?: "instagram" | "tiktok";
  hintText?: string;
}) {
  const nav = useNav();
  const [mode, setMode] = useState(initialMode);
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState(false);
  const [shots, setShots] = useState<File[]>([]);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [fromOcr, setFromOcr] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => thumbs.forEach((u) => URL.revokeObjectURL(u)), [thumbs]);

  const runOcr = async (files: File[]) => {
    if (!files.length) return;
    setShots((prev) => (mode === "text" && fromOcr ? [...prev, ...files] : files));
    setThumbs(files.map((f) => URL.createObjectURL(f)));
    setMode("ocr");
    setProgress("Texterkennung wird geladen …");
    try {
      const t = await ocrImages(files, (i, total, p) =>
        setProgress(`${total > 1 ? `Bild ${i + 1} von ${total}: ` : ""}Text wird gelesen … ${Math.round(p * 100)} %`),
      );
      setText((prev) => (prev.trim() ? prev.trim() + "\n\n" : "") + t);
      setFromOcr(true);
      setMode("text");
      if (!t.trim()) nav.toast("Kein Text erkannt – bitte ein schärferes Bild wählen");
    } catch {
      nav.toast("Texterkennung fehlgeschlagen – beim ersten Mal ist Internet nötig");
      setMode("text");
    } finally {
      setProgress(null);
    }
  };

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
    const d = await draftFromText(clean, { origin: fromOcr ? "ocr" : kind === "instagram" ? "instagram" : "text", source: fromOcr ? "Screenshot" : undefined });
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
          {opt("camera", "Screenshot", "Caption-Screenshots auf Deutsch oder Englisch auslesen", () => fileRef.current?.click())}
          {opt("edit", "Selber anlegen", "Titel, Zutaten und Schritte selbst eintippen", () => {
            const d = draftManual();
            close();
            nav.push({ name: "review", draftId: d.id });
          })}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            runOcr(files);
          }}
        />
        <p className="mt-4 px-1 text-[13px] leading-relaxed text-muted">
          Tipp: Beschreibung im Reel antippen, gedrückt halten und „Kopieren“ wählen.
        </p>
      </div>
    );
  }

  if (mode === "ocr") {
    return (
      <div className="px-4">
        <SheetHeader title="Screenshot" onClose={close} />
        <div className="mb-4 flex gap-2 overflow-x-auto">
          {thumbs.map((u) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={u} src={u} alt="" className="h-40 rounded-[12px] border border-line object-cover" />
          ))}
        </div>
        <div className="flex items-center gap-3 rounded-[14px] bg-card p-4 text-[15px]">
          <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          {progress}
        </div>
        <p className="mt-3 px-1 text-[13px] text-muted">Die Erkennung läuft auf deinem iPhone. Beim ersten Mal werden einmalig Sprachdaten geladen.</p>
      </div>
    );
  }

  return (
    <div className="px-4">
      <SheetHeader
        title={fromOcr ? "Text prüfen" : "Text einfügen"}
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
      {fromOcr && (
        <div className="mb-3 flex gap-3 rounded-[14px] bg-accent-soft p-3.5 text-[14px] leading-snug">
          <Icon name="info" size={20} className="mt-0.5 shrink-0 text-accent" />
          <span>
            Aus {shots.length === 1 ? "deinem Screenshot" : `${shots.length} Screenshots`} erkannt. Bitte kurz prüfen und Fehler korrigieren – besonders Mengen und Einheiten. Danach siehst du Zutaten und Schritte noch einmal zur Bestätigung.
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
      {fromOcr ? (
        <Button variant="secondary" icon="camera" className="mt-3 w-full" onClick={() => fileRef.current?.click()}>
          Weiteren Screenshot hinzufügen
        </Button>
      ) : (
        <Button variant="secondary" icon="clipboard" className="mt-3 w-full" onClick={paste}>
          Aus Zwischenablage einfügen
        </Button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          runOcr(files);
        }}
      />
      <Button className="mt-3 w-full" disabled={!text.trim() || busy} onClick={go}>
        {busy ? "Wird erkannt …" : fromOcr ? "Text bestätigen – Zutaten erkennen" : "Rezept erkennen"}
      </Button>
    </div>
  );
}
