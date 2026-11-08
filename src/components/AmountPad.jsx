"use client";
import { cx } from "@/lib/cx";
import { evaluate, press, toExpr } from "@/lib/calc";

const ROWS = [
  [["7"], ["8"], ["9"], ["÷", "Divide"]],
  [["4"], ["5"], ["6"], ["×", "Multiply"]],
  [["1"], ["2"], ["3"], ["−", "Subtract"]],
  [[".", "Decimal point"], ["0"], ["⌫", "Backspace"], ["+", "Add"]],
];

const keyBase =
  "flex min-h-12 items-center justify-center rounded-control text-2xl [@media(max-height:780px)]:min-h-11 [@media(max-height:780px)]:text-xl " +
  "transition-[transform,background-color] duration-100 active:scale-95";

/**
 * Large number pad with a built-in calculator. `value` is the expression string
 * (e.g. "12.5+3×2"). "=" collapses it to its result.
 */
export function AmountPad({ value, onChange, decimals, onDone }) {
  const tap = (k) => onChange(press(value, k, decimals));
  const equals = () => {
    const r = evaluate(value);
    if (r != null) onChange(toExpr(r, decimals));
  };

  return (
    <div
      className="grid grid-cols-4 gap-1.5"
      role="group"
      aria-label="Number pad"
    >
      {ROWS.flat().map(([key, name]) => {
        const op = "÷×−+".includes(key);
        return (
          <button
            key={key}
            type="button"
            aria-label={name}
            onClick={() => tap(key)}
            className={cx(
              keyBase,
              op ? "bg-accent-soft text-accent" : "bg-fill",
            )}
          >
            {key}
          </button>
        );
      })}
      <button
        type="button"
        aria-label="Clear"
        onClick={() => tap("C")}
        className={cx(keyBase, "bg-fill text-xl text-danger")}
      >
        C
      </button>
      <button
        type="button"
        aria-label="Equals"
        onClick={equals}
        className={cx(keyBase, "col-span-2 bg-accent-soft text-accent")}
      >
        =
      </button>
      <button
        type="button"
        aria-label="Done"
        onClick={onDone}
        className={cx(
          keyBase,
          "bg-accent text-base font-semibold text-on-accent",
        )}
      >
        Done
      </button>
    </div>
  );
}
