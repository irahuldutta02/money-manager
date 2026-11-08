"use client";
import { Check } from "lucide-react";
import { cx } from "@/lib/cx";

const Chevron = ({ className }) => (
  <svg
    aria-hidden
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
);

/** Field-style button that opens an option list in the sheet's bottom panel. */
export function PickerField({
  label,
  value,
  placeholder,
  leading,
  active,
  onClick,
  required = false,
}) {
  return (
    <div>
      <div className="mb-0.5 text-[0.8125rem] font-medium text-label-2">
        {label}
        {required && (
          <span aria-hidden className="text-danger">
            {" "}
            *
          </span>
        )}
      </div>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={active}
        aria-label={`${label}: ${value || placeholder}`}
        onClick={onClick}
        className={cx(
          "flex min-h-tap w-full items-center gap-2 rounded-control px-3 text-left text-base transition-colors duration-200",
          active ? "bg-accent-soft" : "bg-fill",
        )}
      >
        {leading ? <span aria-hidden>{leading}</span> : null}
        <span className={cx("flex-1 truncate", !value && "text-label-2")}>
          {value || placeholder}
        </span>
        <Chevron
          className={cx(
            "shrink-0 text-label-2 transition-transform duration-200",
            active && "rotate-180",
          )}
        />
      </button>
    </div>
  );
}

/**
 * Option list shown where the number pad shows (bottom panel).
 * options: [{ id, label, leading? }]
 */
export function OptionPanel({
  title,
  options,
  value,
  clearLabel,
  onPick,
  onClose,
}) {
  const rowBase =
    "flex min-h-tap w-full items-center gap-2 rounded-control px-3 text-left active:bg-fill";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-[0.8125rem] font-semibold tracking-wide text-label-2 uppercase">
          {title}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="min-h-tap px-2 font-semibold text-accent"
        >
          Close
        </button>
      </div>
      <ul
        role="listbox"
        aria-label={title}
        className="h-[15.5rem] overflow-y-auto overscroll-contain rounded-control bg-fill/60 p-1"
      >
        {clearLabel && (
          <li role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={value == null}
              onClick={() => onPick(null)}
              className={cx(rowBase, "text-label-2")}
            >
              {clearLabel}
            </button>
          </li>
        )}
        {options.length === 0 && (
          <li className="px-3 py-6 text-center text-label-2">
            Nothing to choose yet.
          </li>
        )}
        {options.map((o) => {
          const active = o.id === value;
          return (
            <li key={o.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => onPick(o.id)}
                className={cx(rowBase, active && "bg-accent-soft text-accent")}
              >
                {o.leading ? <span aria-hidden>{o.leading}</span> : null}
                <span className="flex-1 truncate">{o.label}</span>
                {active ? (
                  <Check aria-hidden size={18} strokeWidth={2.6} />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
