"use client";
import {
  CategoryIcon,
  PICKER_ICONS,
  iconLabel,
} from "@/components/CategoryIcon";
import { cx } from "@/lib/cx";

/** Icon grid shown in the sheet's bottom panel. `color` tints the icons. */
export function IconPanel({ value, color, onPick, onClose }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-[0.8125rem] font-semibold tracking-wide text-label-2 uppercase">
          Choose icon
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="min-h-tap px-2 font-semibold text-accent"
        >
          Close
        </button>
      </div>
      <div
        role="listbox"
        aria-label="Icon"
        className="h-[15.5rem] overflow-y-auto overscroll-contain rounded-control bg-fill/60 p-2"
      >
        <div className="grid grid-cols-6 gap-1">
          {PICKER_ICONS.map((slug) => (
            <button
              key={slug}
              type="button"
              role="option"
              aria-selected={slug === value}
              aria-label={iconLabel(slug)}
              onClick={() => onPick(slug)}
              className={cx(
                "flex min-h-tap items-center justify-center rounded-control transition-colors duration-150 active:bg-fill",
                slug === value && "bg-accent-soft",
              )}
            >
              <CategoryIcon icon={slug} color={color} size={24} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
