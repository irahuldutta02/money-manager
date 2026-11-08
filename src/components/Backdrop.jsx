/**
 * Shared decorative background (grid, colour glows, currency glyphs, grain).
 * Render inside a wrapper with `relative isolate` so it paints above the body.
 */
export function Backdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* drifting colour orbs */}
      <div className="lp-drift absolute -top-40 left-[8%] h-[32rem] w-[44rem] rounded-full bg-accent/20 blur-[110px]" />
      <div
        className="lp-drift absolute top-[35%] -right-40 size-[34rem] rounded-full bg-accent/12 blur-[120px]"
        style={{ animationDelay: "-5s" }}
      />
      <div
        className="lp-drift absolute -bottom-40 left-[20%] size-[30rem] rounded-full bg-accent/10 blur-[120px]"
        style={{ animationDelay: "-9s" }}
      />
      {/* grid, fading out toward the edges */}
      <div className="lp-grid absolute inset-0" />
      {/* drifting currency symbols */}
      {[
        ["₹", "left-[6%] top-[22%] text-7xl", "0s"],
        ["$", "left-[44%] top-[14%] text-5xl", "-4s"],
        ["€", "right-[8%] top-[30%] text-6xl", "-8s"],
        ["£", "left-[30%] bottom-[22%] text-6xl", "-2s"],
        ["¥", "right-[26%] bottom-[16%] text-5xl", "-6s"],
      ].map(([g, pos, delay]) => (
        <span
          key={g}
          className={`lp-glyph absolute font-bold text-accent/20 ${pos}`}
          style={{ animationDelay: delay }}
        >
          {g}
        </span>
      ))}
      {/* film grain */}
      <div className="lp-grain absolute inset-0 opacity-[0.07] mix-blend-overlay" />
    </div>
  );
}
