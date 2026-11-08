"use client";
import { useMemo, useState } from "react";
import { ChevronRightIcon } from "@/components/icons";
import { Card } from "@/components/ui/Card";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useMeta } from "@/lib/client/meta";
import { dayHeading, dayKey } from "@/lib/dates";
import { formatMoney, formatSigned } from "@/lib/money";
import { cx } from "@/lib/cx";

export function TxRow({ tx, onOpen }) {
  const { categoryById, accountById, currency } = useMeta();
  const cat = categoryById.get(tx.categoryId);
  const sub = categoryById.get(tx.subcategoryId);
  const from = accountById.get(tx.accountId)?.name ?? "Unknown account";
  const to = accountById.get(tx.toAccountId)?.name ?? "Unknown account";
  const isTransfer = tx.type === "transfer";

  const title = isTransfer
    ? "Transfer"
    : cat
      ? sub
        ? `${cat.name} › ${sub.name}`
        : cat.name
      : "Uncategorized";
  const where = isTransfer ? `${from} → ${to}` : from;

  return (
    <ListRow
      onClick={() => onOpen(tx)}
      leading={
        <CategoryBadge
          icon={isTransfer ? "arrow-left-right" : (cat?.icon ?? "tag")}
          color={isTransfer ? "gray" : (cat?.color ?? "gray")}
        />
      }
      title={title}
      subtitle={
        (tx.note ? `${tx.note} · ${where}` : where) +
        (tx.receiptCount ? ` · 📎${tx.receiptCount}` : "")
      }
      trailing={
        <span
          className={cx(
            "tabular shrink-0 text-[1.0625rem] font-semibold",
            tx.type === "income" && "text-income",
            tx.type === "expense" && "text-expense",
          )}
        >
          {formatSigned(tx.amount, currency, tx.type)}
        </span>
      }
    />
  );
}

export function TransactionList({ transactions, onOpen, onAddOnDay }) {
  const { currency } = useMeta();
  const [collapsed, setCollapsed] = useState(() => new Set());
  const toggle = (key) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const groups = useMemo(() => {
    const map = new Map();
    for (const tx of transactions) {
      const k = dayKey(new Date(tx.date));
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(tx);
    }
    return [...map.entries()];
  }, [transactions]);

  return (
    <>
      {groups.map(([key, rows]) => {
        const net = rows.reduce(
          (n, t) =>
            n +
            (t.type === "income"
              ? t.amount
              : t.type === "expense"
                ? -t.amount
                : 0),
          0,
        );
        return (
          <ListGroup
            key={key}
            collapsed={collapsed.has(key)}
            header={
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  aria-expanded={!collapsed.has(key)}
                  aria-label={`${collapsed.has(key) ? "Expand" : "Collapse"} ${dayHeading(key)}`}
                  className="-ml-1.5 grid size-6 place-items-center rounded-pill hover:text-label"
                >
                  <ChevronRightIcon
                    size={16}
                    className={cx(
                      "transition-transform",
                      !collapsed.has(key) && "rotate-90",
                    )}
                  />
                </button>
                {onAddOnDay ? (
                  <button
                    type="button"
                    onClick={() => onAddOnDay(key)}
                    aria-label={`Add transaction on ${dayHeading(key)}`}
                    className="uppercase hover:text-label"
                  >
                    {dayHeading(key)}
                  </button>
                ) : (
                  dayHeading(key)
                )}
              </span>
            }
            headerRight={formatMoney(net, currency)}
          >
            {rows.map((tx) => (
              <TxRow key={tx.id} tx={tx} onOpen={onOpen} />
            ))}
          </ListGroup>
        );
      })}
    </>
  );
}

export function ListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading transactions">
      <Skeleton className="mb-1.5 ml-4 h-4 w-24" />
      <Card className="mb-6 overflow-hidden [&>*:not(:first-child)]:border-t [&>*:not(:first-child)]:border-separator">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex h-14 items-center gap-3 px-4">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </Card>
    </div>
  );
}
