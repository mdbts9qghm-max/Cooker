"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "./icons";
import { cx } from "./ui";
import { haptic, uid } from "@/lib/util";

export type Tab = "today" | "week" | "recipes" | "shop";

export type Route =
  | { name: "recipe"; id: string }
  | { name: "review"; draftId: string }
  | { name: "settings" }
  | { name: "goals" }
  | { name: "pantry" }
  | { name: "shortcut" }
  | { name: "foods" }
  | { name: "templates"; monday: string };

type StackItem = { key: string; route: Route; closing?: boolean };
type SheetItem = { key: string; render: (close: () => void) => ReactNode; closing?: boolean; full?: boolean };
type ToastItem = { key: string; text: string; undo?: () => void };

type Ctx = {
  tab: Tab;
  setTab: (t: Tab) => void;
  stack: StackItem[];
  push: (r: Route) => void;
  pop: () => void;
  popTo: (n: number) => void;
  sheets: SheetItem[];
  openSheet: (render: (close: () => void) => ReactNode, opts?: { full?: boolean }) => void;
  closeSheet: (key?: string) => void;
  toast: (text: string, undo?: () => void) => void;
  overlay: ReactNode;
  setOverlay: (n: ReactNode) => void;
};

const NavCtx = createContext<Ctx | null>(null);

export function useNav() {
  const c = useContext(NavCtx);
  if (!c) throw new Error("NavProvider fehlt");
  return c;
}

export function NavProvider({ children }: { children: ReactNode }) {
  const [tab, setTabState] = useState<Tab>("today");
  const [stack, setStack] = useState<StackItem[]>([]);
  const [sheets, setSheets] = useState<SheetItem[]>([]);
  const [toastItem, setToast] = useState<ToastItem | null>(null);
  const [overlay, setOverlay] = useState<ReactNode>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    setStack([]);
    try {
      localStorage.setItem("tab", t);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const t = localStorage.getItem("tab") as Tab | null;
      if (t && ["today", "week", "recipes", "shop"].includes(t)) setTabState(t);
    } catch {}
  }, []);

  const push = useCallback((route: Route) => setStack((s) => [...s, { key: uid(), route }]), []);
  const pop = useCallback(() => {
    setStack((s) => {
      if (!s.length) return s;
      const last = s[s.length - 1];
      if (last.closing) return s;
      setTimeout(() => setStack((x) => x.filter((i) => i.key !== last.key)), 280);
      return s.map((i) => (i.key === last.key ? { ...i, closing: true } : i));
    });
  }, []);
  const popTo = useCallback((n: number) => setStack((s) => s.slice(0, n)), []);

  const openSheet = useCallback((render: SheetItem["render"], opts?: { full?: boolean }) => {
    setSheets((s) => [...s, { key: uid(), render, full: opts?.full }]);
  }, []);
  const closeSheet = useCallback((key?: string) => {
    setSheets((s) => {
      const target = key ? s.find((x) => x.key === key) : s[s.length - 1];
      if (!target || target.closing) return s;
      setTimeout(() => setSheets((x) => x.filter((i) => i.key !== target.key)), 300);
      return s.map((i) => (i.key === target.key ? { ...i, closing: true } : i));
    });
  }, []);

  const toast = useCallback((text: string, undo?: () => void) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ key: uid(), text, undo });
    toastTimer.current = setTimeout(() => setToast(null), undo ? 5000 : 2600);
  }, []);

  const value = useMemo(
    () => ({ tab, setTab, stack, push, pop, popTo, sheets, openSheet, closeSheet, toast, overlay, setOverlay }),
    [tab, setTab, stack, push, pop, popTo, sheets, openSheet, closeSheet, toast, overlay],
  );

  return (
    <NavCtx.Provider value={value}>
      {children}
      {sheets.map((s) => (
        <Sheet key={s.key} closing={s.closing} full={s.full} onClose={() => closeSheet(s.key)}>
          {s.render(() => closeSheet(s.key))}
        </Sheet>
      ))}
      {overlay}
      {toastItem && (
        <div key={toastItem.key} className="anim-pop-in pointer-events-none fixed inset-x-0 z-[80] flex justify-center px-4" style={{ bottom: "calc(var(--tabbar-h) + 14px)" }}>
          <div className="blurbar pointer-events-auto flex max-w-[420px] items-center gap-3 rounded-[16px] border border-line py-2.5 pl-4 pr-2 shadow-2xl">
            <span className="text-[15px]">{toastItem.text}</span>
            {toastItem.undo && (
              <button
                className="press flex items-center gap-1 rounded-full px-3 py-1.5 text-[15px] font-semibold text-accent"
                onClick={() => {
                  toastItem.undo?.();
                  setToast(null);
                }}
              >
                <Icon name="undo" size={16} /> Rückgängig
              </button>
            )}
          </div>
        </div>
      )}
    </NavCtx.Provider>
  );
}

// ---------- Screen with large title ----------

export function Screen({
  title,
  children,
  right,
  left,
  back,
  large = true,
  footer,
  scrollRef,
  onScroll,
}: {
  title: string;
  children: ReactNode;
  right?: ReactNode;
  left?: ReactNode;
  back?: boolean | string;
  large?: boolean;
  footer?: ReactNode;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  onScroll?: (y: number) => void;
}) {
  const nav = useNav();
  const [scrolled, setScrolled] = useState(false);
  const [compact, setCompact] = useState(!large);
  return (
    <div className="absolute inset-0 flex flex-col bg-bg">
      <header
        className={cx("absolute inset-x-0 top-0 z-30 transition-colors duration-200", scrolled ? "blurbar border-b border-line/70" : "border-b border-transparent")}
        style={{ paddingTop: "var(--sat)" }}
      >
        <div className="relative flex h-[46px] items-center justify-between px-2">
          <div className="flex min-w-[80px] items-center">
            {back ? (
              <button onClick={() => nav.pop()} className="press flex h-11 items-center gap-0.5 pl-1 pr-3 text-[17px] text-accent">
                <Icon name="back" size={24} stroke={2.4} />
                <span className="max-w-[100px] truncate">{typeof back === "string" ? back : "Zurück"}</span>
              </button>
            ) : (
              left
            )}
          </div>
          <div
            className={cx("pointer-events-none absolute inset-x-[96px] truncate text-center text-[17px] font-semibold transition-opacity duration-200", compact ? "opacity-100" : "opacity-0")}
          >
            {title}
          </div>
          <div className="flex min-w-[80px] items-center justify-end">{right}</div>
        </div>
      </header>
      <div
        ref={scrollRef}
        className="scroll flex-1"
        style={{ paddingTop: "calc(var(--sat) + 46px)" }}
        onScroll={(e) => {
          const y = e.currentTarget.scrollTop;
          setScrolled(y > 4);
          if (large) setCompact(y > 38);
          onScroll?.(y);
        }}
      >
        {large && (
          <h1 className="px-4 pb-2 pt-1 text-[34px] font-bold leading-tight tracking-tight" style={{ paddingLeft: "max(16px, var(--sal))" }}>
            {title}
          </h1>
        )}
        <div className="px-4 pb-8" style={{ paddingBottom: footer ? 120 : "calc(var(--tabbar-h) + 32px)" }}>
          {children}
        </div>
      </div>
      {footer && (
        <div className="blurbar absolute inset-x-0 bottom-0 z-30 border-t border-line px-4 pt-3" style={{ paddingBottom: "calc(var(--sab) + 12px)" }}>
          {footer}
        </div>
      )}
    </div>
  );
}

// ---------- pushed screen with edge-swipe back ----------

export function StackLayer({ closing, onBack, children, z }: { closing?: boolean; onBack: () => void; children: ReactNode; z: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; t: number; active: boolean; dx: number } | null>(null);

  const onStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (t.clientX > 28) return;
    drag.current = { x: t.clientX, y: t.clientY, t: Date.now(), active: false, dx: 0 };
  };
  const onMove = (e: React.TouchEvent) => {
    const d = drag.current;
    if (!d || !ref.current) return;
    const t = e.touches[0];
    const dx = t.clientX - d.x;
    const dy = t.clientY - d.y;
    if (!d.active) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
        drag.current = null;
        return;
      }
      if (dx > 8) d.active = true;
    }
    if (d.active) {
      d.dx = Math.max(0, dx);
      ref.current.style.transition = "none";
      ref.current.style.transform = `translate3d(${d.dx}px,0,0)`;
      ref.current.style.boxShadow = "-12px 0 30px rgba(0,0,0,0.5)";
    }
  };
  const onEnd = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.active || !ref.current) return;
    const w = ref.current.offsetWidth;
    const v = d.dx / Math.max(1, Date.now() - d.t);
    ref.current.style.transition = "transform 280ms var(--ease-ios)";
    if (d.dx > w * 0.33 || v > 0.6) {
      ref.current.style.transform = `translate3d(${w}px,0,0)`;
      haptic();
      setTimeout(onBack, 10);
    } else {
      ref.current.style.transform = "translate3d(0,0,0)";
    }
  };

  return (
    <div
      ref={ref}
      className={cx("absolute inset-0 bg-bg", closing ? "anim-slide-out" : "anim-slide-in")}
      style={{ zIndex: z }}
      onTouchStart={onStart}
      onTouchMove={onMove}
      onTouchEnd={onEnd}
      onTouchCancel={onEnd}
    >
      {children}
    </div>
  );
}

// ---------- bottom sheet ----------

export function Sheet({ children, onClose, closing, full }: { children: ReactNode; onClose: () => void; closing?: boolean; full?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; t: number; dy: number } | null>(null);

  const start = (y: number) => {
    drag.current = { y, t: Date.now(), dy: 0 };
  };
  const move = (y: number) => {
    const d = drag.current;
    if (!d || !ref.current) return;
    d.dy = Math.max(0, y - d.y);
    ref.current.style.transition = "none";
    ref.current.style.transform = `translate3d(0,${d.dy}px,0)`;
  };
  const end = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || !ref.current) return;
    const v = d.dy / Math.max(1, Date.now() - d.t);
    ref.current.style.transition = "transform 320ms var(--ease-ios)";
    if (d.dy > 110 || v > 0.7) {
      ref.current.style.transform = "translate3d(0,100%,0)";
      setTimeout(onClose, 10);
    } else ref.current.style.transform = "translate3d(0,0,0)";
  };

  useEffect(() => {
    if (closing && ref.current) {
      ref.current.style.transition = "transform 300ms var(--ease-ios)";
      ref.current.style.transform = "translate3d(0,100%,0)";
    }
  }, [closing]);

  return (
    <div className="fixed inset-0 z-[60]">
      <div className={cx("absolute inset-0 bg-black/55", closing ? "opacity-0 transition-opacity duration-300" : "anim-fade-in")} onClick={onClose} />
      <div
        ref={ref}
        className="anim-sheet-in absolute inset-x-0 bottom-0 flex flex-col rounded-t-[22px] border-t border-line bg-[#141416] shadow-2xl"
        style={{ maxHeight: full ? "calc(100% - var(--sat) - 12px)" : "88%", height: full ? "calc(100% - var(--sat) - 12px)" : undefined }}
      >
        <div
          className="flex shrink-0 cursor-grab justify-center pb-2 pt-2.5"
          onTouchStart={(e) => start(e.touches[0].clientY)}
          onTouchMove={(e) => move(e.touches[0].clientY)}
          onTouchEnd={end}
          onPointerDown={(e) => {
            if (e.pointerType === "mouse") {
              start(e.clientY);
              const mm = (ev: PointerEvent) => move(ev.clientY);
              const up = () => {
                end();
                window.removeEventListener("pointermove", mm);
                window.removeEventListener("pointerup", up);
              };
              window.addEventListener("pointermove", mm);
              window.addEventListener("pointerup", up);
            }
          }}
        >
          <div className="h-[5px] w-10 rounded-full bg-white/25" />
        </div>
        <div className="scroll min-h-0 flex-1" style={{ paddingBottom: "calc(var(--sab) + 16px)" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function SheetHeader({ title, onClose, right }: { title: string; onClose?: () => void; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 pb-3">
      <div className="min-w-[60px]">
        {onClose && (
          <button onClick={onClose} className="press text-[17px] text-accent">
            Abbrechen
          </button>
        )}
      </div>
      <h2 className="text-[17px] font-semibold">{title}</h2>
      <div className="flex min-w-[60px] justify-end">{right}</div>
    </div>
  );
}

// ---------- swipe row ----------

export function SwipeRow({
  children,
  actions,
  className,
}: {
  children: ReactNode;
  actions: { label: string; color: string; onAction: () => void }[];
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const st = useRef<{ x: number; y: number; base: number; active: boolean; dx: number } | null>(null);
  const [open, setOpen] = useState(false);
  const width = actions.length * 84;

  const setX = (x: number, anim: boolean) => {
    if (!ref.current) return;
    ref.current.style.transition = anim ? "transform 300ms var(--ease-ios)" : "none";
    ref.current.style.transform = `translate3d(${x}px,0,0)`;
  };

  return (
    <div className={cx("relative overflow-hidden", className)}>
      <div className="absolute inset-y-0 right-0 flex" style={{ width }}>
        {actions.map((a) => (
          <button
            key={a.label}
            className="flex-1 text-[14px] font-semibold text-white"
            style={{ background: a.color }}
            onClick={() => {
              haptic(12);
              setX(0, true);
              setOpen(false);
              a.onAction();
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div
        ref={ref}
        className="relative bg-inherit"
        onTouchStart={(e) => {
          const t = e.touches[0];
          st.current = { x: t.clientX, y: t.clientY, base: open ? -width : 0, active: false, dx: 0 };
        }}
        onTouchMove={(e) => {
          const s = st.current;
          if (!s) return;
          const t = e.touches[0];
          const dx = t.clientX - s.x;
          const dy = t.clientY - s.y;
          if (!s.active) {
            if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 6) {
              st.current = null;
              return;
            }
            if (Math.abs(dx) > 8) s.active = true;
          }
          if (s.active) {
            s.dx = Math.min(0, Math.max(-width * 1.4, s.base + dx));
            setX(s.dx, false);
          }
        }}
        onTouchEnd={() => {
          const s = st.current;
          st.current = null;
          if (!s?.active) return;
          if (s.dx < -width * 1.25 && actions.length === 1) {
            haptic(14);
            setX(0, true);
            setOpen(false);
            actions[0].onAction();
            return;
          }
          const o = s.dx < -width / 2;
          setOpen(o);
          setX(o ? -width : 0, true);
        }}
        onClickCapture={(e) => {
          if (open) {
            e.stopPropagation();
            e.preventDefault();
            setOpen(false);
            setX(0, true);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ---------- tab bar ----------

export function TabBar({ onPlus }: { onPlus: () => void }) {
  const { tab, setTab, stack } = useNav();
  const items: { t: Tab; label: string; icon: "today" | "week" | "book" | "cart" }[] = [
    { t: "today", label: "Heute", icon: "today" },
    { t: "week", label: "Woche", icon: "week" },
    { t: "recipes", label: "Rezepte", icon: "book" },
    { t: "shop", label: "Einkauf", icon: "cart" },
  ];
  const btn = (i: (typeof items)[number]) => (
    <button
      key={i.t}
      onClick={() => {
        haptic();
        setTab(i.t);
      }}
      className={cx("flex flex-1 flex-col items-center gap-0.5 pt-2 text-[10px] font-medium", tab === i.t && !stack.length ? "text-accent" : tab === i.t ? "text-accent/80" : "text-white/45")}
    >
      <Icon name={i.icon} size={25} stroke={tab === i.t ? 2.2 : 1.8} />
      {i.label}
    </button>
  );
  return (
    <nav className="blurbar fixed inset-x-0 bottom-0 z-40 border-t border-line/80" style={{ height: "var(--tabbar-h)", paddingBottom: "var(--sab)" }}>
      <div className="mx-auto flex h-[58px] max-w-[600px] items-start px-2">
        {items.slice(0, 2).map(btn)}
        <div className="flex flex-1 justify-center">
          <button
            aria-label="Rezept hinzufügen"
            onClick={() => {
              haptic(12);
              onPlus();
            }}
            className="press -mt-3 grid h-[54px] w-[54px] place-items-center rounded-full bg-accent text-black shadow-[0_6px_24px_rgba(255,107,26,0.45)]"
          >
            <Icon name="plus" size={28} stroke={2.6} />
          </button>
        </div>
        {items.slice(2).map(btn)}
      </div>
    </nav>
  );
}
