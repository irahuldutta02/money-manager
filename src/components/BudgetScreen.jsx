"use client";
import { useEffect, useMemo, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { CategoryIcon } from "@/components/CategoryIcon";
import { TextInput } from "@/components/ui/Field";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { OptionPanel, PickerField } from "@/components/ui/Picker";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useErrorToast, useToast } from "@/components/ui/Toast";
import { ProgressBar } from "@/components/charts";
import { MonthNav, PageTitle } from "@/components/MonthNav";
import { useConfirm } from "@/components/ui/Confirm";
import { apiFetch } from "@/lib/client/api";
import { invalidateAll, useQuery } from "@/lib/client/query";
import { useMeta } from "@/lib/client/meta";
import {
  daysInMonth,
  labelFor,
  monthKey,
  monthStart,
  rangeFor,
  rangeQuery,
  shift,
} from "@/lib/dates";
import { currencyDigits, formatMoney, fromMinor, toMinor } from "@/lib/money";
import { cx } from "@/lib/cx";

const OVERALL = "overall";

/** Days left to spend in, incl. today. null for months already over. */
function daysLeft(anchor) {
  const now = new Date();
  const cur = monthStart(now).getTime();
  const a = anchor.getTime();
  if (a < cur) return null;
  if (a > cur) return daysInMonth(anchor);
  return daysInMonth(anchor) - now.getDate() + 1;
}

const toneOf = (spent, amount) =>
  spent >= amount ? "danger" : spent >= amount * 0.8 ? "warn" : "ok";

// Past months: what was actually spent per day (month total / days in month).
function Status({ spent, amount, left, days, currency }) {
  const remaining = amount - spent;
  const perDay = left
    ? ""
    : ` · ${formatMoney(Math.round(spent / days), currency)}/day spent`;
  if (remaining < 0) {
    return (
      <span className="font-semibold text-expense">
        Over by {formatMoney(-remaining, currency)}
        <span className="font-normal text-label-2">{perDay}</span>
      </span>
    );
  }
  return (
    <span className="text-label-2">
      {formatMoney(remaining, currency)} left
      {left
        ? ` · ${formatMoney(Math.floor(remaining / left), currency)}/day remaining`
        : perDay}
    </span>
  );
}

function BudgetSheet({ state, onClose, month, budgetedIds }) {
  const { currency, topCategories, categoryById } = useMeta();
  const toast = useToast();
  const confirm = useConfirm();
  const editing = state.budget;
  const [categoryId, setCategoryId] = useState(
    editing ? (editing.categoryId ?? OVERALL) : null,
  );
  const [amount, setAmount] = useState(
    editing ? String(fromMinor(editing.amount, currency)) : "",
  );
  const [panel, setPanel] = useState(false);
  const setError = useErrorToast();
  const [busy, setBusy] = useState(false);

  const options = [
    ...(budgetedIds.has(OVERALL)
      ? []
      : [
          {
            id: OVERALL,
            label: "Overall (all spending)",
            leading: <CategoryIcon icon="target" size={20} />,
          },
        ]),
    ...topCategories("expense")
      .filter((c) => !budgetedIds.has(c.id))
      .map((c) => ({
        id: c.id,
        label: c.name,
        leading: <CategoryIcon icon={c.icon} color={c.color} size={20} />,
      })),
  ];
  const label =
    categoryId === OVERALL
      ? "Overall (all spending)"
      : categoryById.get(categoryId)?.name;

  async function save() {
    setError(null);
    const parsed = Number(amount);
    if (!categoryId) return setError("Choose a category or Overall.");
    if (!Number.isFinite(parsed) || parsed <= 0)
      return setError("Enter an amount greater than zero.");
    setBusy(true);
    try {
      await apiFetch("/api/budgets", {
        method: "POST",
        body: {
          month,
          categoryId: categoryId === OVERALL ? null : categoryId,
          amount: toMinor(parsed, currency),
        },
      });
      invalidateAll();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (
      !(await confirm({
        title: "Remove budget?",
        message: `The ${label} budget for this month will be removed. You can undo this right after.`,
        confirmLabel: "Remove",
      }))
    )
      return;
    setBusy(true);
    const cat = editing.categoryId;
    const qs = `month=${month}${cat ? `&categoryId=${cat}` : ""}`;
    try {
      await apiFetch(`/api/budgets?${qs}`, { method: "DELETE" });
      invalidateAll();
      onClose();
      toast.show({
        message: "Budget removed",
        actionLabel: "Undo",
        onAction: async () => {
          await apiFetch("/api/budgets", {
            method: "POST",
            body: { month, categoryId: cat, amount: editing.amount },
          }).catch(() => {});
          invalidateAll();
        },
      });
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      open={state.open}
      onClose={onClose}
      tall={false}
      title={editing ? "Edit budget" : "New budget"}
      footer={
        <div className="space-y-2">
          {panel && (
            <OptionPanel
              title="Category"
              options={options}
              value={categoryId}
              onPick={(v) => {
                if (v) setCategoryId(v);
                setPanel(false);
              }}
              onClose={() => setPanel(false)}
            />
          )}
          <Button size="lg" onClick={save} loading={busy}>
            Save budget
          </Button>
        </div>
      }
    >
      <div className="space-y-2.5 pt-2">
        {editing ? (
          <div>
            <div className="mb-0.5 text-[0.8125rem] font-medium text-label-2">
              Category
            </div>
            <div className="flex min-h-tap items-center rounded-control bg-fill px-3">
              {label}
            </div>
          </div>
        ) : (
          <PickerField
            label="Category"
            placeholder="Choose category or Overall"
            value={label}
            active={panel}
            onClick={() => setPanel((p) => !p)}
          />
        )}
        <TextInput
          id="budget-amount"
          label={`Monthly amount (${currency})`}
          inputMode="decimal"
          placeholder={currencyDigits(currency) ? "0.00" : "0"}
          value={amount}
          onFocus={() => setPanel(false)}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
        />
        {editing && (
          <Button variant="danger" size="lg" onClick={remove} disabled={busy}>
            Remove budget
          </Button>
        )}
      </div>
    </BottomSheet>
  );
}

function CopySheet({ state, onClose, month, anchor }) {
  const toast = useToast();
  const setError = useErrorToast();
  const [busy, setBusy] = useState(false);
  const prev = shift("month", anchor, -1);
  const [m, setM] = useState(prev.getMonth());
  const [y, setY] = useState(prev.getFullYear());
  const [picking, setPicking] = useState(null);

  const thisYear = new Date().getFullYear();
  const years = [];
  for (let i = thisYear - 5; i <= thisYear + 1; i++) years.push(i);
  if (!years.includes(y)) years.push(y);
  years.sort((a, b) => a - b);
  const monthNames = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(undefined, { month: "long" }).format(
      new Date(2000, i, 1),
    ),
  );
  const from = monthKey(new Date(y, m, 1));
  const same = from === month;

  async function copy() {
    setError(null);
    setBusy(true);
    try {
      const r = await apiFetch("/api/budgets/copy", {
        method: "POST",
        body: { from, to: month },
      });
      invalidateAll();
      onClose();
      toast.show({
        message: r.copied
          ? `Copied ${r.copied} budget${r.copied === 1 ? "" : "s"}`
          : "Nothing new to copy. This month already has them.",
      });
    } catch (e) {
      setError(
        e.status === 404 ? "There are no budgets in that month." : e.message,
      );
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      open={state.open}
      onClose={onClose}
      tall={false}
      title="Copy budget from"
      footer={
        <div className="space-y-2">
          {picking && (
            <OptionPanel
              title={picking === "month" ? "Month" : "Year"}
              options={
                picking === "month"
                  ? monthNames.map((n, i) => ({ id: i, label: n }))
                  : years.map((n) => ({ id: n, label: String(n) }))
              }
              value={picking === "month" ? m : y}
              onPick={(id) => {
                if (picking === "month") setM(id);
                else setY(id);
                setPicking(null);
              }}
              onClose={() => setPicking(null)}
            />
          )}
          <Button size="lg" onClick={copy} loading={busy} disabled={same}>
            Copy to {labelFor("month", anchor)}
          </Button>
        </div>
      }
    >
      <div className="space-y-2.5 pt-2">
        <p className="text-[0.9375rem] text-label-2">
          Choose a month. Its budgets are added here; any this month already has
          stay as they are.
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <PickerField
            label="Month"
            value={monthNames[m]}
            active={picking === "month"}
            onClick={() => setPicking(picking === "month" ? null : "month")}
          />
          <PickerField
            label="Year"
            value={String(y)}
            active={picking === "year"}
            onClick={() => setPicking(picking === "year" ? null : "year")}
          />
        </div>
        {same && (
          <p role="alert" className="text-sm text-danger">
            Pick a different month than the one you are copying into.
          </p>
        )}
      </div>
    </BottomSheet>
  );
}

export function BudgetScreen() {
  const { currency, categoryById } = useMeta();
  const [anchor, setAnchor] = useState(() => monthStart(new Date()));
  const [sheet, setSheet] = useState({ open: false, budget: null, n: 0 });
  const open = (budget = null) =>
    setSheet((s) => ({ open: true, budget, n: s.n + 1 }));
  const close = () => setSheet((s) => ({ ...s, open: false }));

  // The app's add button (tab bar "+" / sidebar) asks this page to add a budget.
  useEffect(() => {
    const onAdd = () =>
      setSheet((s) => ({ open: true, budget: null, n: s.n + 1 }));
    window.addEventListener("budget:add", onAdd);
    return () => window.removeEventListener("budget:add", onAdd);
  }, []);
  const [copyOpen, setCopyOpen] = useState({ open: false, n: 0 });
  const toast = useToast();
  const confirm = useConfirm();
  const setError = useErrorToast();

  const month = monthKey(anchor);
  const range = useMemo(() => rangeFor("month", anchor), [anchor]);
  const q = useQuery(`/api/budgets?month=${month}&${rangeQuery(range)}`);
  const left = daysLeft(anchor);
  const days = daysInMonth(anchor);

  const budgets = q.data?.budgets ?? [];
  const overall = budgets.find((b) => !b.categoryId);
  const perCategory = budgets.filter((b) => b.categoryId);
  const budgetedIds = new Set(budgets.map((b) => b.categoryId ?? OVERALL));

  async function clearAll() {
    if (
      !(await confirm({
        title: "Delete all budgets?",
        message: `All ${budgets.length} budget${budgets.length === 1 ? "" : "s"} for ${labelFor("month", anchor)} will be removed. You can undo this right after.`,
        confirmLabel: "Delete all",
      }))
    )
      return;
    const saved = budgets;
    try {
      await apiFetch(`/api/budgets?month=${month}&all=1`, { method: "DELETE" });
      invalidateAll();
      toast.show({
        message: "All budgets removed",
        actionLabel: "Undo",
        onAction: async () => {
          await Promise.all(
            saved.map((b) =>
              apiFetch("/api/budgets", {
                method: "POST",
                body: { month, categoryId: b.categoryId, amount: b.amount },
              }).catch(() => {}),
            ),
          );
          invalidateAll();
        },
      });
    } catch (e) {
      setError(e.message);
    }
  }
  const openCopy = () => setCopyOpen((c) => ({ open: true, n: c.n + 1 }));

  return (
    <div>
      <PageTitle>Budget</PageTitle>
      <MonthNav
        anchor={anchor}
        onShift={(d) => setAnchor(shift("month", anchor, d))}
      />
      <div className="h-3" />

      {q.loading ? (
        <div aria-busy="true" className="space-y-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      ) : q.error && !q.data ? (
        <ErrorState message={q.error.message} onRetry={q.retry} />
      ) : budgets.length === 0 ? (
        <>
          <Card>
            <EmptyState
              icon="target"
              title="No budgets for this month"
              message="Set an overall limit or one per category and track your progress."
              actionLabel="Set a budget"
              onAction={() => open()}
            />
          </Card>
          <div className="mt-3">
            <Button variant="tinted" size="lg" onClick={openCopy}>
              Copy budget from another month
            </Button>
          </div>
        </>
      ) : (
        <>
          {overall ? (
            <button
              type="button"
              onClick={() => open(overall)}
              className="mb-6 block w-full text-left"
            >
              <Card className="p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-[0.8125rem] font-medium text-label-2">
                    Overall budget
                  </span>
                  <span className="tabular text-[0.8125rem] text-label-2">
                    {Math.round((overall.spent / overall.amount) * 100)}%
                  </span>
                </div>
                <div className="tabular mt-0.5 text-[1.75rem] leading-9 font-bold tracking-tight">
                  {formatMoney(overall.spent, currency)}
                  <span className="text-base font-medium text-label-2">
                    {" "}
                    of {formatMoney(overall.amount, currency)}
                  </span>
                </div>
                <div className="my-3">
                  <ProgressBar
                    label="Overall budget used"
                    value={overall.spent}
                    max={overall.amount}
                    tone={toneOf(overall.spent, overall.amount)}
                  />
                </div>
                <div className="text-[0.9375rem]">
                  <Status
                    spent={overall.spent}
                    amount={overall.amount}
                    left={left}
                    days={days}
                    currency={currency}
                  />
                </div>
              </Card>
            </button>
          ) : null}

          {perCategory.length > 0 && (
            <ListGroup header="By category">
              {perCategory.map((b) => {
                const cat = categoryById.get(b.categoryId);
                return (
                  <ListRow
                    key={b.categoryId}
                    onClick={() => open(b)}
                    className="items-start py-3"
                    leading={
                      <CategoryBadge
                        icon={cat?.icon ?? "tag"}
                        color={cat?.color ?? "gray"}
                      />
                    }
                    title={
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate">
                          {cat?.name ?? "Category"}
                        </span>
                        <span className="tabular shrink-0 text-[0.9375rem] font-semibold">
                          {formatMoney(b.spent, currency)}
                          <span className="font-normal text-label-2">
                            {" "}
                            / {formatMoney(b.amount, currency)}
                          </span>
                        </span>
                      </span>
                    }
                    subtitle={
                      <span className="mt-1.5 block space-y-1.5">
                        <ProgressBar
                          label={`${cat?.name ?? "Category"} budget used`}
                          value={b.spent}
                          max={b.amount}
                          tone={toneOf(b.spent, b.amount)}
                        />
                        <span className="block text-[0.8125rem]">
                          <Status
                            spent={b.spent}
                            amount={b.amount}
                            left={left}
                            days={days}
                            currency={currency}
                          />
                        </span>
                      </span>
                    }
                  />
                );
              })}
            </ListGroup>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="tinted"
              size="lg"
              onClick={openCopy}
              aria-label="Copy budget from another month"
              className="px-3 whitespace-nowrap"
            >
              Copy from
            </Button>
            <Button
              variant="danger"
              size="lg"
              onClick={clearAll}
              aria-label="Delete all budgets"
              className="px-3 whitespace-nowrap"
            >
              Delete all
            </Button>
          </div>
        </>
      )}

      <CopySheet
        key={`c${copyOpen.n}`}
        state={copyOpen}
        onClose={() => setCopyOpen((c) => ({ ...c, open: false }))}
        month={month}
        anchor={anchor}
      />
      <BudgetSheet
        key={sheet.n}
        state={sheet}
        onClose={close}
        month={month}
        budgetedIds={budgetedIds}
      />
    </div>
  );
}
