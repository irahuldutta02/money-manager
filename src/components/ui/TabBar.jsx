"use client";
import { Brand } from "@/components/Brand";
import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/cx";
import { useTxSheet } from "@/components/AddTransactionSheet";
import {
  ChartIcon,
  ListIcon,
  MoreIcon,
  PlusIcon,
  TargetIcon,
} from "@/components/icons";

const TABS = [
  { href: "/", label: "Transactions", Icon: ListIcon },
  { href: "/stats", label: "Stats", Icon: ChartIcon },
  { href: "/budget", label: "Budget", Icon: TargetIcon },
  { href: "/more", label: "More", Icon: MoreIcon },
];

const isActive = (pathname, href) =>
  href === "/" ? pathname === "/" : pathname.startsWith(href);

/** Phone/tablet: floating glass bar. Desktop (lg+): glass sidebar. */
export function TabBar() {
  const pathname = usePathname();
  const sheet = useTxSheet();
  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-gutter pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <nav
          aria-label="Main"
          className="glass pointer-events-auto mx-auto max-w-sm rounded-pill p-1.5"
        >
          <ul className="flex gap-0.5">
            {TABS.map(({ href, label, Icon }, i) => {
              const active = isActive(pathname, href);
              return (
                <Fragment key={href}>
                  {/* Add button sits in the middle of the menu */}
                  {i === 2 && (
                    <li className="flex shrink-0 items-center px-1">
                      <button
                        type="button"
                        aria-label="Add transaction"
                        onClick={() => sheet.open()}
                        className="flex size-12 items-center justify-center rounded-pill bg-accent text-on-accent shadow-fab transition-transform duration-200 ease-spring active:scale-90"
                      >
                        <PlusIcon width="26" height="26" />
                      </button>
                    </li>
                  )}
                  <li className="min-w-0 flex-1">
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      aria-label={label}
                      className={cx(
                        "flex min-h-[3.25rem] items-center justify-center rounded-pill",
                        "transition-[background-color,color] duration-300 ease-spring focus-visible:-outline-offset-4",
                        active ? "bg-accent-soft text-accent" : "text-label-2",
                      )}
                    >
                      <Icon width="26" height="26" />
                      <span className="sr-only">{label}</span>
                    </Link>
                  </li>
                </Fragment>
              );
            })}
          </ul>
        </nav>
      </div>

      <aside className="glass fixed top-3 bottom-3 left-3 z-30 hidden w-64 flex-col rounded-sheet p-3 lg:flex">
        <Brand size="sm" className="px-2 pt-2 pb-5" />
        <nav aria-label="Main" className="flex-1">
          <ul className="space-y-1">
            {TABS.map(({ href, label, Icon }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "flex min-h-tap items-center gap-3 rounded-control px-3 text-[1.0625rem] font-medium",
                      "transition-[background-color,color] duration-300 ease-spring",
                      active
                        ? "bg-accent-soft text-accent"
                        : "text-label hover:bg-fill",
                    )}
                  >
                    <Icon width="24" height="24" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <button
          type="button"
          onClick={() => sheet.open()}
          className="flex min-h-[3rem] items-center justify-center gap-2 rounded-control bg-accent font-semibold text-on-accent transition-transform duration-200 ease-spring active:scale-[0.97]"
        >
          <PlusIcon width="20" height="20" />
          Add transaction
        </button>
      </aside>
    </>
  );
}
