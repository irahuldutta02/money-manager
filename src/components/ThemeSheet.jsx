"use client";
import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import {
  PALETTES,
  THEMES,
  applyPalette,
  applyTheme,
  readPalette,
  readTheme,
} from "@/lib/client/theme";
import { cx } from "@/lib/cx";

/** Pick one of the UI themes. Applies instantly, stored on this device. */
export function ThemeSheet({ open, onClose, onChanged }) {
  const [current, setCurrent] = useState("glass");
  const [palette, setPalette] = useState("default");
  useEffect(() => {
    if (!open) return;
    // localStorage is only readable after hydration.
    const t = readTheme();
    /* eslint-disable react-hooks/set-state-in-effect */
    setCurrent(t);
    setPalette(readPalette(t));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open]);

  function pick(id) {
    const t = applyTheme(id);
    setCurrent(t);
    setPalette(readPalette(t));
    onChanged?.();
  }

  function pickPalette(id) {
    setPalette(applyPalette(current, id));
  }

  const theme = THEMES.find((t) => t.id === current) ?? THEMES[0];
  const dark =
    current === "midnight" ||
    (typeof matchMedia === "function" &&
      matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Appearance"
      confirmClose={false}
    >
      <div
        role="radiogroup"
        aria-label="Theme"
        className="grid gap-2.5 pt-2 pb-2"
      >
        {THEMES.map((t) => {
          const on = t.id === current;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => pick(t.id)}
              className={cx(
                "flex min-h-tap items-center gap-3 rounded-card border-2 bg-surface p-3 text-left transition-colors",
                on ? "border-accent" : "border-transparent",
              )}
            >
              <span
                aria-hidden
                className="flex h-10 w-16 shrink-0 overflow-hidden rounded-control border border-separator"
                style={{ background: t.swatch[1] }}
              >
                <span className="w-1/3" style={{ background: t.swatch[0] }} />
                <span
                  className="m-1.5 flex-1 rounded"
                  style={{ background: t.swatch[2] }}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-label">{t.name}</span>
                <span className="block text-sm text-label-2">{t.note}</span>
              </span>
              {on && <span className="font-semibold text-accent">✓</span>}
            </button>
          );
        })}
      </div>

      <div className="px-1 pb-3 pt-2">
        <div className="mb-2 text-sm font-medium text-label-2">
          {theme.name} colors
        </div>
        <div
          role="radiogroup"
          aria-label="Color palette"
          className="flex flex-wrap gap-3"
        >
          {PALETTES.map((p) => {
            const on = p.id === palette;
            const color =
              p.id === "default" ? theme.swatch[0] : dark ? p.dark : p.light;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={p.name}
                onClick={() => pickPalette(p.id)}
                className="flex w-14 flex-col items-center gap-1"
              >
                <span
                  className={cx(
                    "flex h-11 w-11 items-center justify-center rounded-full border-2 p-0.5",
                    on ? "border-accent" : "border-transparent",
                  )}
                >
                  <span
                    className="block h-full w-full rounded-full border border-separator"
                    style={{ background: color }}
                  />
                </span>
                <span
                  className={cx(
                    "text-xs",
                    on ? "font-semibold text-label" : "text-label-2",
                  )}
                >
                  {p.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </BottomSheet>
  );
}
