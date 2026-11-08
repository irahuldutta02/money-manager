import { cx } from "@/lib/cx";

export function Card({ as: Tag = "div", className, ...props }) {
  return (
    <Tag {...props} className={cx("rounded-card glass-card", className)} />
  );
}
