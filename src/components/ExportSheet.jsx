"use client";
import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { TextInput } from "@/components/ui/Field";
import { rangeFor, toDateInput } from "@/lib/dates";
import { cx } from "@/lib/cx";

// [from, to] as <input type="date"> values; `to` is the last day, inclusive.
function presetRange(period, offset = 0) {
  const now = new Date();
  const anchor =
    period === "month"
      ? new Date(now.getFullYear(), now.getMonth() + offset, 1)
      : now;
  const { from, to } = rangeFor(period, anchor);
  const last = new Date(to.getFullYear(), to.getMonth(), to.getDate() - 1);
  return [toDateInput(from), toDateInput(last)];
}

const PRESETS = [
  { label: "This week", range: () => presetRange("week") },
  { label: "This month", range: () => presetRange("month") },
  { label: "Last month", range: () => presetRange("month", -1) },
  { label: "This year", range: () => presetRange("year") },
  { label: "All time", range: () => ["", ""] },
];

/** CSV download for a date range. A plain link: the browser handles the file. */
export function ExportSheet({ open, onClose }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Local-day boundaries -> instants; `to` is inclusive of the chosen day.
  const q = new URLSearchParams();
  if (from) {
    const [y, m, d] = from.split("-").map(Number);
    q.set("from", new Date(y, m - 1, d).toISOString());
  }
  if (to) {
    const [y, m, d] = to.split("-").map(Number);
    q.set("to", new Date(y, m - 1, d + 1).toISOString());
  }
  const invalid = from && to && from > to;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Export CSV"
      tall={false}
      footer={
        <a
          href={invalid ? undefined : `/api/export?${q}`}
          download
          aria-disabled={invalid || undefined}
          onClick={() => !invalid && setTimeout(onClose, 300)}
          className="inline-flex min-h-[3.25rem] w-full items-center justify-center rounded-control bg-accent px-5 text-[1.0625rem] font-semibold text-on-accent aria-disabled:opacity-40"
        >
          Download CSV
        </a>
      }
    >
      <div className="space-y-2.5 pt-2">
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Quick ranges"
        >
          {PRESETS.map((p) => {
            const [f, t] = p.range();
            const active = f === from && t === to;
            return (
              <button
                key={p.label}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setFrom(f);
                  setTo(t);
                }}
                className={cx(
                  "min-h-tap rounded-pill px-4 text-[0.9375rem] font-medium",
                  active ? "bg-accent text-on-accent" : "bg-fill text-label",
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <TextInput
          id="exp-from"
          label="From"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <TextInput
          id="exp-to"
          label="To"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        {invalid && (
          <p role="alert" className="text-sm font-medium text-danger">
            “From” must be before “To”.
          </p>
        )}
      </div>
    </BottomSheet>
  );
}
