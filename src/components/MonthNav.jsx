"use client";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { labelFor } from "@/lib/dates";

/** Prev / label / next, shared by Calendar, Stats and Budget. */
export function MonthNav({ anchor, onShift }) {
  const btn =
    "flex min-h-tap min-w-tap items-center justify-center rounded-pill text-accent";
  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        aria-label="Previous month"
        onClick={() => onShift(-1)}
        className={btn}
      >
        <ChevronLeftIcon />
      </button>
      <div className="text-[1.0625rem] font-semibold" aria-live="polite">
        {labelFor("month", anchor)}
      </div>
      <button
        type="button"
        aria-label="Next month"
        onClick={() => onShift(1)}
        className={btn}
      >
        <ChevronRightIcon />
      </button>
    </div>
  );
}

/** Visually hidden page heading (kept for screen readers and document outline). */
export function PageTitle({ children }) {
  return <h1 className="sr-only">{children}</h1>;
}
