"use client";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { CAT_VAR, Donut } from "@/components/charts";
import { PageTitle } from "@/components/MonthNav";
import { PeriodBar, usePeriod } from "@/components/PeriodBar";
import { useRouter } from "next/navigation";
import { useQuery } from "@/lib/client/query";
import { useMeta } from "@/lib/client/meta";
import { dayKey, labelFor, rangeFor, rangeQuery, shift } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cx } from "@/lib/cx";

const TYPE_OPTIONS = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
];

function Section({ title, children }) {
  return (
    <section className="mb-6">
      <h2 className="mb-1.5 px-4 text-[0.8125rem] font-medium tracking-wide text-label-2 uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** "▲ 12%" with colour by whether the change is good or bad for that row. */
function Delta({ now, before, goodWhenUp }) {
  if (before === 0) return null;
  const pct = ((now - before) / Math.abs(before)) * 100;
  if (Math.abs(pct) < 0.5)
    return <span className="text-label-2">No change</span>;
  const up = pct > 0;
  const good = up === goodWhenUp;
  return (
    <span
      className={cx("font-semibold", good ? "text-income" : "text-expense")}
    >
      {up ? "▲" : "▼"} {Math.abs(Math.round(pct))}%
    </span>
  );
}

function CategoryBreakdown({ type, range, prevRange, showDelta, currency }) {
  const { categoryById } = useMeta();
  const router = useRouter();
  const q = useQuery(
    `/api/stats?kind=categories&type=${type}&${rangeQuery(range)}`,
  );

  const prevQ = useQuery(
    showDelta
      ? `/api/stats?kind=categories&type=${type}&${rangeQuery(prevRange)}`
      : null,
  );
  const prevById = useMemo(
    () =>
      new Map(
        (prevQ.data?.categories ?? []).map((r) => [r.categoryId, r.total]),
      ),
    [prevQ.data],
  );

  const rows = useMemo(
    () =>
      (q.data?.categories ?? []).map((r) => {
        const cat = categoryById.get(r.categoryId);
        return {
          key: r.categoryId ?? "none",
          categoryId: r.categoryId ?? null,
          name: cat?.name ?? "Uncategorized",
          icon: cat?.icon ?? "tag",
          color: cat?.color ?? "gray",
          total: r.total,
          count: r.count,
          before: prevById.get(r.categoryId) ?? 0,
        };
      }),
    [q.data, categoryById, prevById],
  );
  const total = rows.reduce((n, r) => n + r.total, 0);

  if (q.loading) {
    return (
      <Card className="p-4">
        <Skeleton className="mx-auto size-[200px] rounded-full" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </Card>
    );
  }
  if (q.error && !q.data)
    return <ErrorState message={q.error.message} onRetry={q.retry} />;
  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState
          icon="bar-chart"
          title={`No ${type} in this period`}
          message="Add transactions and your breakdown will appear here."
        />
      </Card>
    );
  }

  return (
    <>
      <Card className="mb-3 p-4">
        <Donut
          label={`${type} by category, total ${formatMoney(total, currency)}`}
          slices={rows.map((r) => ({
            key: r.key,
            value: r.total,
            color: CAT_VAR[r.color] ?? CAT_VAR.gray,
          }))}
        >
          <span className="text-[0.8125rem] text-label-2 capitalize">
            {type}
          </span>
          <span className="tabular max-w-full truncate text-xl font-bold">
            {formatMoney(total, currency)}
          </span>
        </Donut>
      </Card>
      <ListGroup>
        {rows.map((r) => (
          <ListRow
            key={r.key}
            leading={<CategoryBadge icon={r.icon} color={r.color} />}
            onClick={
              r.categoryId
                ? () => {
                    const qs = new URLSearchParams({
                      from: dayKey(range.from),
                      to: dayKey(new Date(range.to.getTime() - 1)),
                      categoryId: r.categoryId,
                      type,
                    });
                    router.push(`/?${qs}`);
                  }
                : undefined
            }
            title={r.name}
            subtitle={`${Math.round((r.total / total) * 100)}% · ${r.count} ${r.count === 1 ? "transaction" : "transactions"}`}
            trailing={
              <span className="flex shrink-0 flex-col items-end text-right">
                <span className="tabular font-semibold">
                  {formatMoney(r.total, currency)}
                </span>
                {showDelta && prevQ.data && r.before > 0 && (
                  <span className="text-[0.8125rem]">
                    <Delta
                      now={r.total}
                      before={r.before}
                      goodWhenUp={type === "income"}
                    />
                  </span>
                )}
              </span>
            }
          />
        ))}
      </ListGroup>
    </>
  );
}

function Comparison({ qsNow, qsPrev, showDelta, currency, prevLabel }) {
  const now = useQuery(`/api/summary?${qsNow}`);
  const prev = useQuery(showDelta ? `/api/summary?${qsPrev}` : null);
  if (now.error || prev.error) {
    return (
      <ErrorState
        message={(now.error ?? prev.error).message}
        onRetry={() => {
          now.retry();
          prev.retry();
        }}
      />
    );
  }
  if (!now.data || (showDelta && !prev.data))
    return <Skeleton className="h-40 w-full" />;
  const a = now.data;
  const b = prev.data ?? { income: 0, expense: 0 };
  const rows = [
    { label: "Income", now: a.income, before: b.income, goodWhenUp: true },
    { label: "Expense", now: a.expense, before: b.expense, goodWhenUp: false },
    {
      label: "Balance",
      now: a.income - a.expense,
      before: b.income - b.expense,
      goodWhenUp: true,
    },
  ];
  return (
    <ListGroup>
      {rows.map((r) => (
        <ListRow
          key={r.label}
          title={r.label}
          subtitle={
            showDelta
              ? `${prevLabel} ${formatMoney(r.before, currency)}`
              : undefined
          }
          trailing={
            <span className="flex flex-col items-end text-right">
              <span className="tabular font-semibold">
                {formatMoney(r.now, currency)}
              </span>
              {showDelta && (
                <span className="text-[0.8125rem]">
                  <Delta
                    now={r.now}
                    before={r.before}
                    goodWhenUp={r.goodWhenUp}
                  />
                </span>
              )}
            </span>
          }
        />
      ))}
    </ListGroup>
  );
}

export function StatsScreen() {
  const { currency } = useMeta();
  const p = usePeriod("month");
  const [type, setType] = useState("expense");

  const { range, period, isRange, anchor } = p;
  const prevRange = useMemo(() => {
    if (!range) return null;
    if (isRange) {
      const len = range.to - range.from;
      return { from: new Date(range.from.getTime() - len), to: range.from };
    }
    return rangeFor(period, shift(period, anchor, -1));
  }, [range, isRange, period, anchor]);

  const showDelta = !isRange && (period === "month" || period === "year");
  const prevLabel = isRange ? "Previous period" : `Last ${period}`;

  return (
    <div>
      <PageTitle>Stats</PageTitle>
      <PeriodBar p={p} />

      {!range ? (
        <p role="alert" className="py-8 text-center text-danger">
          Pick a start date that is on or before the end date.
        </p>
      ) : (
        <>
          <SegmentedControl
            label="Type"
            className="my-3"
            options={TYPE_OPTIONS}
            value={type}
            onChange={setType}
          />
          <Section title="By category">
            <CategoryBreakdown
              type={type}
              range={range}
              prevRange={prevRange}
              showDelta={showDelta}
              currency={currency}
            />
          </Section>
          <Section title="Summary">
            <Comparison
              qsNow={rangeQuery(range)}
              qsPrev={rangeQuery(prevRange)}
              currency={currency}
              showDelta={showDelta}
              prevLabel={prevLabel}
            />
          </Section>
        </>
      )}
    </div>
  );
}
