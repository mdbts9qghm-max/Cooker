"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import type { Macros } from "@/lib/types";
import { haptic } from "@/lib/util";

export const MACRO_META: { key: keyof Macros; label: string; short: string; color: string; unit: string }[] = [
  { key: "protein", label: "Protein", short: "P", color: "var(--color-protein)", unit: "g" },
  { key: "carbs", label: "Kohlenhydrate", short: "KH", color: "var(--color-carbs)", unit: "g" },
  { key: "fat", label: "Fett", short: "F", color: "var(--color-fat)", unit: "g" },
  { key: "fiber", label: "Ballaststoffe", short: "Bst", color: "var(--color-fiber)", unit: "g" },
];

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

// ---------- buttons ----------

export function Button({
  children,
  onClick,
  variant = "primary",
  icon,
  className,
  disabled,
  type = "button",
}: {
  children?: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: IconName;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const styles = {
    primary: "bg-accent text-black font-semibold",
    secondary: "bg-card2 text-white border border-line",
    ghost: "text-accent",
    danger: "bg-danger/15 text-danger font-semibold",
  }[variant];
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={() => {
        haptic();
        onClick?.();
      }}
      className={cx("press inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[14px] px-4 text-[16px] disabled:opacity-40", styles, className)}
    >
      {icon && <Icon name={icon} size={20} />}
      {children}
    </button>
  );
}

export function IconButton({ name, onClick, label, className, active }: { name: IconName; onClick?: () => void; label: string; className?: string; active?: boolean }) {
  return (
    <button
      aria-label={label}
      onClick={() => {
        haptic();
        onClick?.();
      }}
      className={cx("press grid h-11 w-11 place-items-center rounded-full", active ? "text-accent" : "text-white", className)}
    >
      <Icon name={name} size={22} fill={active && name === "heart" ? "currentColor" : undefined} />
    </button>
  );
}

export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={cx("rounded-[20px] bg-card", onClick && "press cursor-pointer", className)}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-end justify-between px-1">
      <h3 className="label">{children}</h3>
      {right}
    </div>
  );
}

// ---------- rings & bars ----------

/** Large semicircle gauge (Heute-Bildschirm). */
export function HalfRing({ value, goal, size = 300 }: { value: number; goal: number; size?: number }) {
  const stroke = 18;
  const r = (size - stroke) / 2;
  const len = Math.PI * r;
  const pct = goal > 0 ? Math.min(value / goal, 1.5) : 0;
  const over = value > goal * 1.05;
  const filled = len * Math.min(pct, 1);
  const h = size / 2 + stroke;
  return (
    <svg width="100%" viewBox={`0 0 ${size} ${h}`} className="block overflow-visible">
      <defs>
        <linearGradient id="ringgrad" x1="0" x2="1">
          <stop offset="0" stopColor="#ff8a3d" />
          <stop offset="1" stopColor="#ff5a00" />
        </linearGradient>
      </defs>
      <path d={`M ${stroke / 2} ${size / 2} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${size / 2}`} fill="none" stroke="var(--color-line)" strokeWidth={stroke} strokeLinecap="round" />
      {filled > 0.5 && <path
        key={Math.round(filled)}
        d={`M ${stroke / 2} ${size / 2} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${size / 2}`}
        fill="none"
        stroke={over ? "var(--color-danger)" : "url(#ringgrad)"}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${len}`}
        className="ring-anim"
        style={{ ["--ring-len" as string]: `${filled}`, filter: "drop-shadow(0 0 10px rgba(255,107,26,0.35))" }}
      />}
    </svg>
  );
}

export function MiniRing({ value, goal, size = 34, stroke = 4, color = "var(--color-accent)" }: { value: number; goal: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = goal > 0 ? Math.min(value / goal, 1) : 0;
  const over = goal > 0 && value > goal * 1.05;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={over ? "var(--color-danger)" : color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`}
        style={{ transition: "stroke-dasharray 700ms var(--ease-ios)" }}
      />
    </svg>
  );
}

export function MacroBar({ label, value, goal, color, compact }: { label: string; value: number; goal: number; color: string; compact?: boolean }) {
  const pct = goal > 0 ? Math.min(value / goal, 1) : 0;
  const over = goal > 0 && value > goal * 1.1;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className={cx("label", compact && "text-[10px]")}>{label}</span>
        <span className={cx("tnum font-semibold", compact ? "text-[13px]" : "text-[15px]")}>
          {Math.round(value)}
          <span className="text-muted"> / {Math.round(goal)} g</span>
        </span>
      </div>
      <div className={cx("overflow-hidden rounded-full bg-line", compact ? "h-1.5" : "h-2")}>
        <div
          className="h-full rounded-full"
          style={{ width: `${pct * 100}%`, background: over ? "var(--color-danger)" : color, transition: "width 800ms var(--ease-ios)" }}
        />
      </div>
    </div>
  );
}

export function MacroInline({ m, className }: { m: Macros; className?: string }) {
  return (
    <div className={cx("tnum flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]", className)}>
      <span className="font-semibold text-white">{Math.round(m.kcal)} kcal</span>
      {MACRO_META.map((x) => (
        <span key={x.key} className="flex items-center gap-1 text-muted">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: x.color }} />
          {Math.round(m[x.key])}
          {x.short === "Bst" ? " Bst" : ` ${x.short}`}
        </span>
      ))}
    </div>
  );
}

// ---------- inputs ----------

export function Stepper({ value, onChange, step = 1, min = 0.5, format }: { value: number; onChange: (v: number) => void; step?: number; min?: number; format?: (v: number) => string }) {
  return (
    <div className="flex items-center rounded-full bg-card2">
      <button
        aria-label="weniger"
        className="press grid h-10 w-10 place-items-center text-accent"
        onClick={() => {
          haptic();
          onChange(Math.max(min, Math.round((value - step) * 100) / 100));
        }}
      >
        <Icon name="minus" size={18} />
      </button>
      <span className="tnum min-w-[40px] text-center text-[16px] font-semibold">{format ? format(value) : value.toLocaleString("de-DE")}</span>
      <button
        aria-label="mehr"
        className="press grid h-10 w-10 place-items-center text-accent"
        onClick={() => {
          haptic();
          onChange(Math.round((value + step) * 100) / 100);
        }}
      >
        <Icon name="plus" size={18} />
      </button>
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange, className }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; className?: string }) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div className={cx("relative flex rounded-[11px] bg-card2 p-[3px]", className)}>
      <div
        className="absolute bottom-[3px] top-[3px] rounded-[9px] bg-[#3a3a3f] shadow"
        style={{ width: `calc((100% - 6px) / ${options.length})`, transform: `translateX(${idx * 100}%)`, transition: "transform 320ms var(--ease-ios)" }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => {
            haptic();
            onChange(o.value);
          }}
          className={cx("relative z-10 flex-1 py-1.5 text-[13px] font-semibold", o.value === value ? "text-white" : "text-muted")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ children, active, onClick }: { children: ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={() => {
        haptic();
        onClick?.();
      }}
      className={cx(
        "press shrink-0 rounded-full border px-3.5 py-1.5 text-[14px] font-medium",
        active ? "border-accent bg-accent-soft text-accent" : "border-line bg-card text-white/80",
      )}
    >
      {children}
    </button>
  );
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => {
        haptic();
        onChange(!on);
      }}
      className={cx("relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors", on ? "bg-ok" : "bg-[#39393d]")}
    >
      <span className="absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow" style={{ left: on ? 22 : 2, transition: "left 260ms var(--ease-spring)" }} />
    </button>
  );
}

export function NumberField({ value, onChange, suffix, className, placeholder, step = "any" }: { value: number | null | undefined; onChange: (v: number) => void; suffix?: string; className?: string; placeholder?: string; step?: string }) {
  const [text, setText] = useState(value == null ? "" : String(value).replace(".", ","));
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      setText(value == null ? "" : String(value).replace(".", ","));
      last.current = value;
    }
  }, [value]);
  return (
    <div className={cx("relative", className)}>
      <input
        inputMode="decimal"
        step={step}
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseFloat(e.target.value.replace(",", "."));
          if (Number.isFinite(n)) {
            last.current = n;
            onChange(n);
          } else if (e.target.value === "") {
            last.current = 0;
            onChange(0);
          }
        }}
        onFocus={(e) => e.target.select()}
        className={cx("field tnum", suffix && "pr-10")}
      />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[14px] text-muted">{suffix}</span>}
    </div>
  );
}

// ---------- misc ----------

const PLACEHOLDER_GRADS = [
  ["#3a1d0e", "#7a3410"],
  ["#14232f", "#244b66"],
  ["#1d2a1a", "#3c5a32"],
  ["#2a1830", "#553060"],
  ["#2e2410", "#6a5220"],
];

export function RecipeImage({ src, title, className, rounded = "rounded-[16px]" }: { src?: string; title: string; className?: string; rounded?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={cx("object-cover", rounded, className)} draggable={false} />;
  }
  const h = [...title].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7);
  const [a, b] = PLACEHOLDER_GRADS[h % PLACEHOLDER_GRADS.length];
  const initials = title
    .split(/\s+/)
    .filter((w) => /\p{L}/u.test(w[0] ?? ""))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  return (
    <div className={cx("grid place-items-center", rounded, className)} style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
      <span className="text-[22px] font-bold tracking-tight text-white/70">{initials}</span>
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: IconName; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="anim-pop-in flex flex-col items-center px-8 py-14 text-center">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-accent-soft text-accent">
        <Icon name={icon} size={30} />
      </div>
      <h3 className="mb-1.5 text-[19px] font-semibold">{title}</h3>
      <p className="mb-5 max-w-[300px] text-[15px] leading-relaxed text-muted">{text}</p>
      {action}
    </div>
  );
}

export function ListRow({ icon, title, subtitle, right, onClick, danger }: { icon?: IconName; title: ReactNode; subtitle?: ReactNode; right?: ReactNode; onClick?: () => void; danger?: boolean }) {
  return (
    <button
      onClick={() => {
        if (onClick) haptic();
        onClick?.();
      }}
      className={cx("flex w-full items-center gap-3 px-4 py-3 text-left active:bg-white/5", danger && "text-danger")}
    >
      {icon && (
        <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-[9px]", danger ? "bg-danger/15" : "bg-accent-soft text-accent")}>
          <Icon name={icon} size={18} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[16px]">{title}</span>
        {subtitle && <span className="block text-[13px] text-muted">{subtitle}</span>}
      </span>
      {right ?? (onClick && <Icon name="chevron" size={16} className="text-faint" />)}
    </button>
  );
}

export function Group({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("divide-y divide-line overflow-hidden rounded-[16px] bg-card", className)}>{children}</div>;
}
