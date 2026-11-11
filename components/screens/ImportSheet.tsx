"use client";

import { useRef, useState } from "react";
import { Icon, type IconName } from "../icons";
import { SheetHeader, useNav } from "../nav";
import { Button, Toggle, cx } from "../ui";
import { detectUrl, draftFromText, draftFromTikTok, draftManual, ocrImage } from "@/lib/importer";
import { compressImage } from "@/lib/util";

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
    } catch {
      nav.toast("TikTok nicht erreichbar – bitte Caption einfügen");
      nav.openSheet((close) => <ImportSheet close={close} initialMode="text" initialText={textWithoutUrl} hint="tiktok" />);
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
}: {
  close: () => void;
  initialMode?: "menu" | "text" | "ocr";
  initialText?: string;
  hint?: "instagram" | "tiktok";
}) {
  const nav = useNav();
  const [mode, setMode] = useState(initialMode);
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState<string | null>(null);
  const [useAsPhoto, setUseAsPhoto] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [hintState, setHint] = useState(hint);

  const pasteClipboard = async (auto: boolean) => {
    try {
      const t = await navigator.clipboard.readText();
      if (!t.trim()) {
        nav.toast("Zwischenablage ist leer");
        return;
      }
      const { kind } = detectUrl(t);
      if (auto && kind === "tiktok") {
        close();
        await runImport(nav, t);
        return;
      }
      if (kind === "instagram" && t.trim().split(/\s+/).length < 4) {
        setHint("instagram");
        setMode("text");
        return;
      }
      if (auto && t.length > 30) {
        close();
        await runImport(nav, t);
        return;
      }
      setText(t);
      setMode("text");
    } catch {
      nav.toast("Kein Zugriff auf die Zwischenablage – bitte lange tippen und „Einfügen“");
      setMode("text");
    }
  };

  const go = async () => {
    if (!text.trim()) return;
    setBusy("Wird erkannt …");
    let photo: string | null = null;
    if (image && useAsPhoto) photo = await compressImage(image);
    const { url, kind } = detectUrl(text);
    if (kind === "tiktok" && url) {
      close();
      await runImport(nav, text);
      return;
    }
    const clean = url ? text.replace(url, "") : text;
    const d = await draftFromText(clean, { origin: image ? "ocr" : hintState === "instagram" ? "instagram" : "text", photo, source: hintState === "instagram" ? "Instagram" : undefined });
    setBusy(null);
    close();
    nav.push({ name: "review", draftId: d.id });
  };

  const onImage = async (f: File) => {
    setImage(f);
    setMode("ocr");
    setBusy("Texterkennung lädt …");
    try {
      const t = await ocrImage(f, (p) => setBusy(`Text wird erkannt … ${Math.round(p * 100)} %`));
      setText(t);
      setMode("text");
    } catch {
      nav.toast("Texterkennung fehlgeschlagen – bitte Text mit Live Text kopieren");
      setMode("text");
    } finally {
      setBusy(null);
    }
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
          {opt("clipboard", "Aus Zwischenablage", "Link oder Caption, die du kopiert hast", () => pasteClipboard(true), true)}
          {opt("text", "Caption-Text einfügen", "Text aus Instagram, TikTok oder Webseite", () => setMode("text"))}
          {opt("camera", "Screenshot", "Text mit Live Text kopieren oder Bild erkennen lassen", () => fileRef.current?.click())}
          {opt("edit", "Manuell", "Zutaten einzeln eintippen", () => {
            const d = draftManual();
            close();
            nav.push({ name: "review", draftId: d.id });
          })}
        </div>
        <p className="mt-4 px-1 text-[13px] leading-relaxed text-muted">
          Tipp: Mit dem Kurzbefehl „Ins Rezeptbuch“ teilst du Reels direkt aus Instagram oder TikTok. Anleitung unter Einstellungen.
        </p>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onImage(e.target.files[0])} />
      </div>
    );
  }

  return (
    <div className="px-4">
      <SheetHeader
        title={mode === "ocr" ? "Screenshot" : "Caption einfügen"}
        onClose={close}
        right={
          <button disabled={!text.trim() || !!busy} onClick={go} className="press text-[17px] font-semibold text-accent disabled:opacity-40">
            Weiter
          </button>
        }
      />
      {hintState === "instagram" && (
        <div className="mb-3 flex gap-3 rounded-[14px] bg-accent-soft p-3.5 text-[14px] leading-snug">
          <Icon name="info" size={20} className="mt-0.5 shrink-0 text-accent" />
          <span>
            Instagram gibt die Caption ohne Login nicht heraus. Öffne das Reel, tippe auf die Caption, halte gedrückt und wähle <b>Kopieren</b> – dann hier einfügen.
          </span>
        </div>
      )}
      {hintState === "tiktok" && (
        <div className="mb-3 rounded-[14px] bg-accent-soft p-3.5 text-[14px]">TikTok war gerade nicht erreichbar. Kopiere die Caption und füge sie hier ein.</div>
      )}
      {busy && (
        <div className="mb-3 flex items-center gap-3 rounded-[14px] bg-card p-3.5 text-[15px]">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          {busy}
        </div>
      )}
      <textarea
        autoFocus={!busy && mode === "text" && !text}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"Caption hier einfügen …\n\nZ. B.\nProtein Bowl\n200 g Hähnchenbrust\n100 g Reis\n…"}
        className="field min-h-[280px] resize-none leading-relaxed"
      />
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Button variant="secondary" icon="clipboard" onClick={() => pasteClipboard(false)}>
          Einfügen
        </Button>
        <Button variant="secondary" icon="camera" onClick={() => fileRef.current?.click()}>
          Bild erkennen
        </Button>
      </div>
      {image && (
        <div className="mt-3 flex items-center justify-between rounded-[14px] bg-card px-4 py-3">
          <span className="text-[15px]">Bild als Rezeptfoto verwenden</span>
          <Toggle on={useAsPhoto} onChange={setUseAsPhoto} />
        </div>
      )}
      <Button className="mt-4 w-full" disabled={!text.trim() || !!busy} onClick={go}>
        Rezept erkennen
      </Button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onImage(e.target.files[0])} />
    </div>
  );
}
