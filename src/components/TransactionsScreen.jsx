"use client";
import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { CloseIcon, FilterIcon, SearchIcon } from "@/components/icons";
import { PeriodBar, usePeriod } from "@/components/PeriodBar";
import {
  EMPTY_FILTERS,
  FiltersSheet,
  filterChips,
  filterQuery,
  filtersInvalid,
} from "@/components/FiltersSheet";
import { ListSkeleton, TransactionList } from "@/components/TransactionList";
import { useTxSheet } from "@/components/AddTransactionSheet";
import { useQuery } from "@/lib/client/query";
import { useMeta } from "@/lib/client/meta";
import { rangeQuery } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cx } from "@/lib/cx";

const STEP = 100;

function Stat({ label, value, tone, arrow }) {
  return (
    <div
      className={cx(
        "min-w-0 rounded-control px-3 py-2",
        tone === "income" ? "bg-income/10" : "bg-expense/10",
      )}
    >
      <div
        className={cx(
          "flex items-center gap-1 text-[0.75rem] font-semibold",
          tone === "income" ? "text-income" : "text-expense",
        )}
      >
        <span aria-hidden>{arrow}</span>
        {label}
      </div>
      <div className="tabular mt-0.5 min-h-6 truncate text-[1.0625rem] font-semibold">
        {value}
      </div>
    </div>
  );
}

function SummaryCard({ summary, currency, filtered }) {
  const income = summary?.income ?? 0;
  const expense = summary?.expense ?? 0;
  const money = (n) =>
    summary ? formatMoney(n, currency) : <Skeleton className="h-5 w-20" />;
  return (
    <Card className="p-4">
      <div className="text-[0.8125rem] font-medium text-label-2">
        {filtered ? "Balance (filtered)" : "Balance"}
      </div>
      <div className="tabular min-h-10 truncate text-[2rem] leading-10 font-bold tracking-tight">
        {money(income - expense)}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat label="Income" value={money(income)} tone="income" arrow="↓" />
        <Stat label="Expense" value={money(expense)} tone="expense" arrow="↑" />
      </div>
    </Card>
  );
}

const iconBtn =
  "glass-card relative flex min-h-tap min-w-tap shrink-0 items-center justify-center rounded-control";

function TransactionsView({ seed }) {
  const meta = useMeta();
  const { currency } = meta;
  const sheet = useTxSheet();
  // Deep link from Stats: /?from=YYYY-MM-DD&to=YYYY-MM-DD&categoryId=…&type=…
  const p = usePeriod(seed ? "range" : "month", seed?.custom);

  // The filter button lives in this row, so a filtered deep link opens it.
  const [searchOpen, setSearchOpen] = useState(Boolean(seed));
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState(seed?.filters ?? EMPTY_FILTERS);
  const [limit, setLimit] = useState(STEP);
  const [fsheet, setFsheet] = useState({
    open: false,
    filters: EMPTY_FILTERS,
    n: 0,
  });
  const timer = useRef(null);

  const onType = (v) => {
    setInput(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setQ(v);
      setLimit(STEP);
    }, 300);
  };
  const toggleSearch = () => {
    if (searchOpen) {
      clearTimeout(timer.current);
      setInput("");
      setQ("");
      setLimit(STEP);
    }
    setSearchOpen(!searchOpen);
  };
  const applyFilters = (f) => {
    setFilters(f);
    setLimit(STEP);
  };

  const invalid = filtersInvalid(filters);
  const chips = useMemo(() => filterChips(filters, meta), [filters, meta]);
  const narrowed = chips.length > 0 || Boolean(q.trim());

  // The period supplies from/to; search text and filters narrow within it.
  const base =
    p.range && !invalid
      ? `${rangeQuery(p.range)}&${filterQuery(q, filters, currency)}`
      : null;
  const list = useQuery(base && `/api/search?${base}&limit=${limit}`, {
    keepPrevious: true,
  });
  const summary = useQuery(base && `/api/summary?${base}`);
  const shown = list.data;
  const txs = shown?.transactions;

  return (
    <div>
      <h1 className="sr-only">Transactions</h1>

      <PeriodBar
        p={p}
        actions={
          <>
            <button
              type="button"
              aria-label="Search"
              aria-pressed={searchOpen}
              onClick={toggleSearch}
              className={cx(
                iconBtn,
                searchOpen ? "text-accent" : "text-label-2",
              )}
            >
              <SearchIcon />
            </button>
          </>
        }
      />

      {searchOpen && (
        <div className="mt-2 flex items-center gap-2">
          <label className="glass-card flex min-h-tap min-w-0 flex-1 items-center gap-2 rounded-control px-3">
            <span className="text-label-2">
              <SearchIcon width="20" height="20" />
            </span>
            <input
              type="search"
              autoFocus
              value={input}
              onChange={(e) => onType(e.target.value)}
              placeholder="Search notes and categories"
              aria-label="Search notes and categories"
              className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-label-2"
            />
          </label>
          <button
            type="button"
            aria-label="Filters"
            aria-expanded={fsheet.open}
            onClick={() =>
              setFsheet((s) => ({ open: true, filters, n: s.n + 1 }))
            }
            className={cx(
              iconBtn,
              chips.length ? "text-accent" : "text-label-2",
            )}
          >
            <FilterIcon />
            {chips.length > 0 && (
              <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-accent text-[0.6875rem] font-bold text-on-accent">
                {chips.length}
              </span>
            )}
          </button>
        </div>
      )}

      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c.k}
              type="button"
              onClick={() => applyFilters({ ...filters, ...c.clear })}
              aria-label={`Remove filter ${c.label}`}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-pill bg-accent-soft px-3 text-sm font-medium text-accent capitalize"
            >
              {c.label} <CloseIcon size={14} strokeWidth={2.6} />
            </button>
          ))}
          {chips.length > 1 && (
            <button
              type="button"
              onClick={() => applyFilters(EMPTY_FILTERS)}
              className="inline-flex min-h-9 items-center rounded-pill px-3 text-sm font-medium text-label-2 hover:text-label"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      <div className="mt-3 mb-5">
        <SummaryCard
          summary={summary.data}
          currency={currency}
          filtered={narrowed}
        />
      </div>

      {!p.range ? (
        <p role="alert" className="py-8 text-center text-danger">
          Pick a start date that is on or before the end date.
        </p>
      ) : invalid ? (
        <p role="alert" className="py-8 text-center text-danger">
          Minimum amount is higher than maximum.
        </p>
      ) : list.loading ? (
        <ListSkeleton />
      ) : list.error && !txs ? (
        <ErrorState message={list.error.message} onRetry={list.retry} />
      ) : txs.length === 0 ? (
        narrowed ? (
          <EmptyState
            icon="search"
            title="No matches"
            message="Try a different word, period or filter."
            actionLabel="Clear search and filters"
            onAction={() => {
              applyFilters(EMPTY_FILTERS);
              clearTimeout(timer.current);
              setInput("");
              setQ("");
            }}
          />
        ) : (
          <EmptyState
            icon="receipt"
            title="Nothing here yet"
            message="Add an expense or income and it will show up for this period."
            actionLabel="Add transaction"
            onAction={() => sheet.open()}
          />
        )
      ) : (
        <>
          <TransactionList
            transactions={txs}
            onOpen={(tx) => sheet.open({ tx })}
            onAddOnDay={(date) => sheet.open({ date })}
          />
          {shown.hasMore && (
            <Button
              variant="tinted"
              size="lg"
              onClick={() => setLimit((l) => l + STEP)}
            >
              Show more
            </Button>
          )}
        </>
      )}

      <FiltersSheet
        key={fsheet.n}
        state={fsheet}
        onClose={() => setFsheet((s) => ({ ...s, open: false }))}
        onApply={applyFilters}
      />
    </div>
  );
}

/**
 * Deep link from Stats: /?from=YYYY-MM-DD&to=YYYY-MM-DD&categoryId=…&type=…
 * The route stays mounted between visits, so the view is keyed by the URL to
 * start fresh (seeded or not) on every arrival.
 */
export function TransactionsScreen() {
  const params = useSearchParams();
  const key = params.toString();
  const seed = useMemo(() => {
    const from = params.get("from");
    const to = params.get("to");
    const day = /^\d{4}-\d{2}-\d{2}$/;
    if (!day.test(from ?? "") || !day.test(to ?? "")) return null;
    const type = params.get("type");
    return {
      custom: { from, to },
      filters: {
        ...EMPTY_FILTERS,
        type: ["expense", "income", "transfer"].includes(type) ? type : "",
        categoryId: params.get("categoryId") || null,
      },
    };
  }, [params]);
  return <TransactionsView key={key} seed={seed} />;
}
