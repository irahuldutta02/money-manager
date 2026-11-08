import { cx } from "@/lib/cx";
import { ChevronDown } from "lucide-react";
import { Card } from "./Card";

/** iOS-style grouped list section: optional header/footer, rounded inset card, hairline separators. */
export function ListGroup({
  header,
  headerRight,
  footer,
  collapsed = false,
  onToggle,
  children,
  className,
}) {
  return (
    <section className={cx("mb-6", className)}>
      {header ? (
        onToggle ? (
          // Collapsible: the whole header row is the toggle.
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
            className="mb-1.5 flex min-h-tap w-full items-center justify-between gap-2 px-4 text-left"
          >
            <span className="flex items-center gap-1.5">
              <ChevronDown
                aria-hidden
                size={16}
                strokeWidth={2.6}
                className={cx(
                  "text-label-2 transition-transform duration-200",
                  collapsed && "-rotate-90",
                )}
              />
              <h2 className="text-[0.8125rem] font-medium tracking-wide text-label-2 uppercase">
                {header}
              </h2>
            </span>
            {headerRight ? (
              <span className="tabular text-[0.8125rem] text-label-2">
                {headerRight}
              </span>
            ) : null}
          </button>
        ) : (
          <div className="mb-1.5 flex items-baseline justify-between px-4">
            <h2 className="text-[0.8125rem] font-medium tracking-wide text-label-2 uppercase">
              {header}
            </h2>
            {headerRight ? (
              <span className="tabular text-[0.8125rem] text-label-2">
                {headerRight}
              </span>
            ) : null}
          </div>
        )
      ) : null}
      {collapsed ? null : (
        <Card className="overflow-hidden [&>*:not(:first-child)]:border-t [&>*:not(:first-child)]:border-separator">
          {children}
        </Card>
      )}
      {footer && !collapsed ? (
        <p className="mt-1.5 px-4 text-[0.8125rem] text-label-2">{footer}</p>
      ) : null}
    </section>
  );
}

/** A row inside <ListGroup>. Renders a button when `onClick` is given. */
export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  onClick,
  className,
  ...props
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button", onClick } : {})}
      {...props}
      className={cx(
        "flex min-h-[3.5rem] w-full items-center gap-3 px-4 py-2 text-left",
        onClick && "active:bg-fill",
        className,
      )}
    >
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[1.0625rem]">{title}</span>
        {subtitle ? (
          <span className="block truncate text-[0.8125rem] text-label-2">
            {subtitle}
          </span>
        ) : null}
      </span>
      {trailing}
    </Tag>
  );
}
