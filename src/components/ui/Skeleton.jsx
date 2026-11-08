import { cx } from "@/lib/cx";

export function Skeleton({ className }) {
  return (
    <div
      aria-hidden
      className={cx("animate-shimmer rounded-control bg-fill", className)}
    />
  );
}
