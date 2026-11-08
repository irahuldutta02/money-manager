import { cx } from "@/lib/cx";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Check } from "lucide-react";

// Static class map so Tailwind can see every class at build time.
const TINTS = {
  red: "bg-cat-red/18",
  orange: "bg-cat-orange/18",
  yellow: "bg-cat-yellow/18",
  green: "bg-cat-green/18",
  teal: "bg-cat-teal/18",
  blue: "bg-cat-blue/18",
  indigo: "bg-cat-indigo/18",
  purple: "bg-cat-purple/18",
  pink: "bg-cat-pink/18",
  gray: "bg-cat-gray/18",
};

export function CategoryBadge({
  icon,
  color = "gray",
  size = "md",
  className,
}) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-pill",
        size === "lg" ? "size-12" : "size-10",
        TINTS[color] ?? TINTS.gray,
        className,
      )}
    >
      <CategoryIcon icon={icon} color={color} size={size === "lg" ? 26 : 22} />
    </span>
  );
}

export const COLOR_KEYS = Object.keys(TINTS);

const SOLID = {
  red: "bg-cat-red",
  orange: "bg-cat-orange",
  yellow: "bg-cat-yellow",
  green: "bg-cat-green",
  teal: "bg-cat-teal",
  blue: "bg-cat-blue",
  indigo: "bg-cat-indigo",
  purple: "bg-cat-purple",
  pink: "bg-cat-pink",
  gray: "bg-cat-gray",
};

/** Row of round colour swatches (radio group). */
export function ColorSwatches({ label = "Color", value, onChange }) {
  return (
    <div>
      <div className="mb-0.5 text-[0.8125rem] font-medium text-label-2">
        {label}
      </div>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex flex-wrap gap-x-1 gap-y-0.5"
      >
        {COLOR_KEYS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value === c}
            aria-label={c}
            onClick={() => onChange(c)}
            className="flex min-h-tap min-w-tap items-center justify-center rounded-pill"
          >
            <span
              className={cx(
                "flex size-8 items-center justify-center rounded-pill text-sm font-bold text-white transition-transform duration-200",
                SOLID[c],
                value === c &&
                  "scale-110 ring-2 ring-label ring-offset-2 ring-offset-surface",
              )}
            >
              {value === c ? <Check size={18} strokeWidth={3} /> : null}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
