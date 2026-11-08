/**
 * The wallet mark as inline SVG so it can follow the theme: it is drawn with
 * the theme's CSS variables (--accent, --on-accent, --bg). Themes only apply
 * inside the signed-in app, so on landing/sign-in it keeps the stock green.
 */
export function BrandMark({ size = 40, className }) {
  const tint = "color-mix(in srgb, var(--on-accent) 65%, var(--accent))";
  const gap = {
    stroke: "var(--bg)",
    strokeWidth: 1.6,
    strokeLinejoin: "round",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 -2 100 102"
      aria-hidden
      className={className}
    >
      <path
        d="M9 36C9 29 13 24 19 22L72 2C77 0.5 80 3 80 8V11L26 24Z"
        fill="var(--accent)"
        fillOpacity="0.62"
      />
      <path
        d="M16 38C17 31 21 27 27 25.5L82 12C87 11 91 14 91 20V26L21 36Z"
        fill="var(--accent)"
        fillOpacity="0.82"
        {...gap}
      />
      <path
        d="M1 85V38C1 36 4 40 15 41L80 31.5C90 31 94.4 34 94.4 41V85Q94.4 98 81 98H14Q1 98 1 85Z"
        fill="var(--accent)"
        {...gap}
      />
      <rect x="16.3" y="72" width="11.1" height="12.7" rx="1.6" fill={tint} />
      <rect x="30.6" y="62.8" width="11.1" height="21.9" rx="1.6" fill={tint} />
      <rect x="45.1" y="51.4" width="11.1" height="33.3" rx="1.6" fill={tint} />
      <path
        d="M97.5 56V77H77A10.5 10.5 0 0 1 77 56Z"
        fill="var(--accent)"
        {...gap}
      />
      <circle cx="74" cy="66.5" r="4.4" fill="var(--on-accent)" />
    </svg>
  );
}
