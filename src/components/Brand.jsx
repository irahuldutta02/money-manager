import { BrandMark } from "@/components/BrandMark";
import Link from "next/link";
import { cx } from "@/lib/cx";

const SIZES = {
  sm: {
    img: 36,
    box: "size-9 rounded-[0.6rem]",
    text: "text-lg",
    gap: "gap-2.5",
  },
  md: { img: 44, box: "size-11 rounded-xl", text: "text-xl", gap: "gap-3" },
  lg: {
    img: 64,
    box: "size-16 rounded-[1.1rem]",
    text: "text-4xl",
    gap: "gap-4",
  },
};

/**
 * The one logo lockup used everywhere: mark + wordmark, side by side.
 * Pass `href` to make it a link.
 */
export function Brand({ size = "md", href, stacked = false, className }) {
  const s = SIZES[size];
  const body = (
    <>
      <BrandMark size={s.img} className="shrink-0" />
      <span
        className={cx("font-bold tracking-tight whitespace-nowrap", s.text)}
      >
        Money Manager
      </span>
    </>
  );
  const cls = cx(
    "inline-flex items-center",
    stacked && "flex-col text-center",
    s.gap,
    className,
  );
  return href ? (
    <Link href={href} aria-label="Money Manager home" className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
