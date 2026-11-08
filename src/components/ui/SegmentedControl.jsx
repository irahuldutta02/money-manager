"use client";
import { cx } from "@/lib/cx";

/** iOS-style segmented control. `options`: [{ value, label }] */
export function SegmentedControl({
  options,
  value,
  onChange,
  label,
  className,
  dense = false,
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx("glass-card flex rounded-control p-0.5", className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx(
              "min-h-10 flex-1 rounded-[calc(var(--r-control)-2px)] font-medium",
              dense ? "px-0.5 text-[0.8125rem]" : "px-2 text-[0.9375rem]",
              "transition-[background-color,box-shadow] duration-200 ease-spring",
              active
                ? "bg-accent-soft text-accent shadow-card"
                : "text-label-2",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
