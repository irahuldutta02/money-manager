"use client";
import { cx } from "@/lib/cx";

const base =
  "inline-flex items-center justify-center gap-2 rounded-control font-semibold select-none " +
  "transition-[transform,opacity,background-color] duration-200 ease-spring " +
  "active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none";

const variants = {
  primary: "bg-accent text-on-accent",
  tinted: "bg-accent-soft text-accent",
  plain: "text-accent",
  danger: "bg-danger/12 text-danger",
  // Google brand button: white surface, neutral text, full-colour "G".
  google: "border border-[#dadce0] bg-white text-[#1f1f1f]",
};

const sizes = {
  md: "min-h-tap px-4 text-[1.0625rem]",
  lg: "min-h-[3.25rem] px-5 text-[1.0625rem] w-full",
  icon: "min-h-tap min-w-tap rounded-pill",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  ...props
}) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || loading}
      aria-busy={loading || undefined}
      className={cx(base, variants[variant], sizes[size], className)}
    >
      {loading ? (
        <span
          className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      ) : null}
      {children}
    </button>
  );
}
