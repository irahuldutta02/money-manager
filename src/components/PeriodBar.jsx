"use client";
import { useMemo, useState } from "react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TextInput } from "@/components/ui/Field";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { dayKey, labelFor, rangeFor, shift } from "@/lib/dates";

const DAY_MS = 86400000;

const PERIOD_OPTIONS = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
  { value: "range", label: "Range" },
];

const dayStart = (v) => new Date(`${v}T00:00:00`);
const dayAfter = (v) => {
  const d = dayStart(v);
  d.setDate(d.getDate() + 1);
  return d;
};

/**
 * Period state shared by Transactions and Stats: day / week / month / year or a
 * custom range. `range` is { from, to } (to exclusive) or null if the range is
 * invalid (start after end).
 */
export function usePeriod(initial = "month", initialCustom = null) {
  const [period, setPeriod] = useState(initial);
  const [anchor, setAnchor] = useState(() => new Date());
  // Custom range defaults to the last 30 days.
  const [custom, setCustom] = useState(() => {
    if (initialCustom) return initialCustom;
    const to = new Date();
    return {
      from: dayKey(new Date(to.getTime() - 29 * DAY_MS)),
      to: dayKey(to),
    };
  });

  const isRange = period === "range";
  const rangeOk =
    !isRange || Boolean(custom.from && custom.to && custom.from <= custom.to);
  const range = useMemo(() => {
    if (!isRange) return rangeFor(period, anchor);
    return rangeOk
      ? { from: dayStart(custom.from), to: dayAfter(custom.to) }
      : null;
  }, [isRange, rangeOk, custom, period, anchor]);

  return {
    period,
    setPeriod,
    anchor,
    setAnchor,
    custom,
    setCustom,
    isRange,
    rangeOk,
    range,
  };
}

/** Segmented period picker + prev/next (or From/To for Range). `actions` sit beside the picker. */
export function PeriodBar({ p, actions }) {
  const navBtn =
    "flex min-h-tap min-w-tap items-center justify-center rounded-pill text-accent";
  return (
    <div>
      <div className="flex items-center gap-2">
        <SegmentedControl
          label="Period"
          dense
          className="min-w-0 flex-1"
          options={PERIOD_OPTIONS}
          value={p.period}
          onChange={p.setPeriod}
        />
        {actions}
      </div>

      <div className="mt-2">
        {p.isRange ? (
          <div className="grid grid-cols-2 gap-2.5">
            <TextInput
              id="period-from"
              label="From"
              type="date"
              value={p.custom.from}
              max={p.custom.to || undefined}
              onChange={(e) =>
                p.setCustom((c) => ({ ...c, from: e.target.value }))
              }
            />
            <TextInput
              id="period-to"
              label="To"
              type="date"
              value={p.custom.to}
              min={p.custom.from || undefined}
              onChange={(e) =>
                p.setCustom((c) => ({ ...c, to: e.target.value }))
              }
            />
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label={`Previous ${p.period}`}
              onClick={() => p.setAnchor(shift(p.period, p.anchor, -1))}
              className={navBtn}
            >
              <ChevronLeftIcon />
            </button>
            <div className="text-[1.0625rem] font-semibold" aria-live="polite">
              {labelFor(p.period, p.anchor)}
            </div>
            <button
              type="button"
              aria-label={`Next ${p.period}`}
              onClick={() => p.setAnchor(shift(p.period, p.anchor, 1))}
              className={navBtn}
            >
              <ChevronRightIcon />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
