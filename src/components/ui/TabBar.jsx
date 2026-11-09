"use client";
import { Brand } from "@/components/Brand";
import { Fragment, useEffect, useState } from "react";
import { HandCoins, TrendingUp } from "lucide-react";
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

const LENDING = "/more/lending";
const NETWORTH = "/more/networth";
// Page-specific add actions; the page listens for `event` and opens its sheet.
const PAGE_ADD = [
  { path: LENDING, label: "Add entry", event: "lending:add" },
  { path: NETWORTH, label: "Add instrument", event: "networth:add" },
  { path: "/budget", label: "Add budget", event: "budget:add" },
];
const LendingIcon = (p) => <HandCoins strokeWidth={2} {...p} />;
const NetWorthIcon = (p) => <TrendingUp strokeWidth={2} {...p} />;

// Pages under /more that get their own nav entry (sidebar + mobile "..." menu),
// so "More" must not light up for them.
const MORE_ITEMS = [
  { href: LENDING, label: "Track P2P Lending", Icon: LendingIcon },
  { href: NETWORTH, label: "Net Worth", Icon: NetWorthIcon },
];
const SIDEBAR_TABS = [...TABS.slice(0, 3), ...MORE_ITEMS, TABS[3]];

const isActive = (pathname, href) => {
  if (href === "/") return pathname === "/";
  if (href === "/more")
    return (
      pathname.startsWith(href) &&
      !MORE_ITEMS.some((m) => pathname.startsWith(m.href))
    );
  return pathname.startsWith(href);
};

/** Phone/tablet: floating glass bar. Desktop (lg+): glass sidebar. */
export function TabBar() {
  const pathname = usePathname();
  const sheet = useTxSheet();
  const [menu, setMenu] = useState(false);
  // Some pages repurpose the add buttons (tab bar "+" and sidebar button).
  const pageAdd = PAGE_ADD.find((p) => pathname.startsWith(p.path));
  const addLabel = pageAdd?.label ?? "Add transaction";
  const add = () =>
    pageAdd ? window.dispatchEvent(new Event(pageAdd.event)) : sheet.open();

  // Close the "..." menu on navigation and on Escape.
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMenu(false);
  }
  useEffect(() => {
    if (!menu) return;
    const onKey = (e) => e.key === "Escape" && setMenu(false);
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [menu]);

  return (
    <>
      {menu && (
        <button
          type="button"
          aria-label="Close menu"
          tabIndex={-1}
          onClick={() => setMenu(false)}
          className="fixed inset-0 z-30 cursor-default lg:hidden"
        />
      )}
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
                        aria-label={addLabel}
                        onClick={add}
                        className="flex size-12 items-center justify-center rounded-pill bg-accent text-on-accent shadow-fab transition-transform duration-200 ease-spring active:scale-90"
                      >
                        <PlusIcon width="26" height="26" />
                      </button>
                    </li>
                  )}
                  <li className="relative min-w-0 flex-1">
                    {href === "/more" ? (
                      <>
                        {menu && (
                          <ul
                            role="menu"
                            aria-label="More"
                            className="glass-strong pointer-events-auto absolute right-0 bottom-[calc(100%+0.75rem)] w-52 overflow-hidden rounded-card p-1"
                          >
                            {[
                              ...MORE_ITEMS,
                              { href: "/more", label: "More", Icon: MoreIcon },
                            ].map((m) => (
                              <li key={m.href} role="none">
                                <Link
                                  role="menuitem"
                                  href={m.href}
                                  className={cx(
                                    "flex min-h-tap items-center gap-3 rounded-control px-3 font-medium active:bg-fill",
                                    isActive(pathname, m.href) && "text-accent",
                                  )}
                                >
                                  <m.Icon width="22" height="22" />
                                  {m.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                        <button
                          type="button"
                          aria-label="More"
                          aria-haspopup="menu"
                          aria-expanded={menu}
                          onClick={() => setMenu((v) => !v)}
                          className={cx(
                            "flex min-h-[3.25rem] w-full items-center justify-center rounded-pill",
                            "transition-[background-color,color] duration-300 ease-spring focus-visible:-outline-offset-4",
                            active || menu || pathname.startsWith("/more")
                              ? "bg-accent-soft text-accent"
                              : "text-label-2",
                          )}
                        >
                          <Icon width="26" height="26" />
                        </button>
                      </>
                    ) : (
                      <Link
                        href={href}
                        aria-current={active ? "page" : undefined}
                        aria-label={label}
                        className={cx(
                          "flex min-h-[3.25rem] items-center justify-center rounded-pill",
                          "transition-[background-color,color] duration-300 ease-spring focus-visible:-outline-offset-4",
                          active
                            ? "bg-accent-soft text-accent"
                            : "text-label-2",
                        )}
                      >
                        <Icon width="26" height="26" />
                        <span className="sr-only">{label}</span>
                      </Link>
                    )}
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
            {SIDEBAR_TABS.map(({ href, label, Icon }) => {
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
          onClick={add}
          className="flex min-h-[3rem] items-center justify-center gap-2 rounded-control bg-accent font-semibold text-on-accent transition-transform duration-200 ease-spring active:scale-[0.97]"
        >
          <PlusIcon width="20" height="20" />
          {addLabel}
        </button>
      </aside>
    </>
  );
}
