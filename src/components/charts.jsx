"use client";
import { cx } from "@/lib/cx";

// Category colours come from the same palette tokens as the rest of the app.
export const CAT_VAR = {
  red: "var(--color-cat-red)",
  orange: "var(--color-cat-orange)",
  yellow: "var(--color-cat-yellow)",
  green: "var(--color-cat-green)",
  teal: "var(--color-cat-teal)",
  blue: "var(--color-cat-blue)",
  indigo: "var(--color-cat-indigo)",
  purple: "var(--color-cat-purple)",
  pink: "var(--color-cat-pink)",
  gray: "var(--color-cat-gray)",
};

/**
 * Donut chart. slices: [{ key, value, color }]. `children` render in the hole.
 * Decorative: the legend/list beside it carries the real numbers.
 */
export function Donut({ slices, size = 200, thickness = 26, children, label }) {
  const total = slices.reduce((n, s) => n + s.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const gap = slices.length > 1 ? 3 : 0; // px gap between slices
  let offset = 0;

  return (
    <div
      className="relative mx-auto"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={thickness}
          style={{ stroke: "var(--fill)" }}
        />
        {total > 0 &&
          slices.map((s) => {
            const len = (s.value / total) * c;
            const dash = Math.max(len - gap, 0.5);
            const el = (
              <circle
                key={s.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
                style={{ stroke: s.color }}
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
        {children}
      </div>
    </div>
  );
}

export function ProgressBar({ value, max, tone, label }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className="h-2.5 overflow-hidden rounded-full bg-fill"
    >
      <div
        className={cx(
          "h-full rounded-full transition-[width] duration-500 ease-spring",
          tone === "danger"
            ? "bg-expense"
            : tone === "warn"
              ? "bg-cat-orange"
              : "bg-accent",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
