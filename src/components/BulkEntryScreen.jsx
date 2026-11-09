"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Minus, Pencil, Plus, Trash2, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { OptionPanel, PickerField } from "@/components/ui/Picker";
import { TextInput } from "@/components/ui/Field";
import { ListGroup } from "@/components/ui/ListGroup";
import { EmptyState } from "@/components/ui/States";
import { useConfirm } from "@/components/ui/Confirm";
import { useErrorToast, useToast } from "@/components/ui/Toast";
import { ChevronLeftIcon } from "@/components/icons";
import { apiFetch } from "@/lib/client/api";
import { invalidateAll } from "@/lib/client/query";
import { useMeta } from "@/lib/client/meta";
import { fromDateInput, toDateInput } from "@/lib/dates";
import { currencySymbol, formatMoney, fromMinor, toMinor } from "@/lib/money";
import { cx } from "@/lib/cx";

const STORAGE_KEY = "mm:bulk-draft:v1";
const newId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function readDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (
      d &&
      typeof d === "object" &&
      d.entries &&
      typeof d.entries === "object"
    )
      return d;
  } catch {}
  return null;
}

/** Parses a typed amount into minor units; null when empty/invalid/non-positive. */
function parseAmount(text, currency) {
  const n = Number(String(text).replace(/,/g, "").trim());
  if (!text.trim() || !Number.isFinite(n) || n <= 0) return null;
  const minor = toMinor(n, currency);
  return minor > 0 ? minor : null;
}

const netOf = (entries) => entries.reduce((s, e) => s + e.sign * e.amount, 0);

function HistoryRow({ entry, currency, onChange, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [sign, setSign] = useState(1);

  function startEdit() {
    setText(String(fromMinor(entry.amount, currency)));
    setSign(entry.sign);
    setEditing(true);
  }
  function commit() {
    const amount = parseAmount(text, currency);
    if (amount == null) return;
    onChange({ ...entry, amount, sign });
    setEditing(false);
  }

  const signBtn = (value, Icon, label, on) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={sign === value}
      onClick={() => setSign(value)}
      className={cx(
        "flex size-9 shrink-0 items-center justify-center rounded-pill transition-colors",
        sign === value ? on : "bg-fill text-label-2",
      )}
    >
      <Icon size={16} />
    </button>
  );

  return (
    <li className="flex h-14 items-center gap-2 px-4">
      {editing ? (
        <>
          {signBtn(1, Plus, "Add", "bg-income/15 text-income")}
          {signBtn(-1, Minus, "Subtract", "bg-danger/12 text-danger")}
          <input
            autoFocus
            type="text"
            inputMode="decimal"
            aria-label="Amount"
            value={text}
            onChange={(e) => setText(e.target.value.replace(/[^0-9.,]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && commit()}
            className="tabular h-10 min-w-0 flex-1 rounded-control bg-accent-soft px-3 outline-none"
          />
          <button
            type="button"
            aria-label="Save change"
            onClick={commit}
            className="flex size-9 shrink-0 items-center justify-center rounded-pill text-accent"
          >
            <Check size={18} />
          </button>
        </>
      ) : (
        <>
          <span
            aria-hidden
            className={cx(
              "flex size-7 shrink-0 items-center justify-center rounded-pill",
              entry.sign > 0
                ? "bg-income/15 text-income"
                : "bg-danger/12 text-danger",
            )}
          >
            {entry.sign > 0 ? <Plus size={14} /> : <Minus size={14} />}
          </span>
          <span className="tabular flex-1">
            {entry.sign > 0 ? "+" : "−"}
            {formatMoney(entry.amount, currency)}
          </span>
          <button
            type="button"
            aria-label="Edit entry"
            onClick={startEdit}
            className="flex size-9 items-center justify-center rounded-pill text-label-2"
          >
            <Pencil size={16} />
          </button>
        </>
      )}
      <button
        type="button"
        aria-label="Delete entry"
        onClick={onDelete}
        className="flex size-9 shrink-0 items-center justify-center rounded-pill text-danger"
      >
        <Trash2 size={16} />
      </button>
    </li>
  );
}

function CategoryRow({ category, entries, currency, onAdd, onOpenHistory }) {
  const [text, setText] = useState("");
  const net = netOf(entries);

  function add(sign) {
    const amount = parseAmount(text, currency);
    if (amount == null) return;
    onAdd({ id: newId(), sign, amount });
    setText("");
  }

  return (
    <div>
      <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 lg:flex-col lg:items-stretch lg:gap-2">
        <div className="flex min-w-0 items-center gap-3 sm:w-56 sm:shrink-0 lg:w-auto">
          <CategoryBadge icon={category.icon} color={category.color} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[1.0625rem]">{category.name}</div>
            <button
              type="button"
              disabled={entries.length === 0}
              onClick={onOpenHistory}
              className="flex items-center gap-1 text-[0.8125rem] text-label-2 disabled:opacity-60"
            >
              <span className={cx("tabular", net < 0 && "text-danger")}>
                {entries.length === 0
                  ? "No entries"
                  : `${formatMoney(net, currency)} · ${entries.length} ${entries.length === 1 ? "entry" : "entries"}`}
              </span>
              {entries.length > 0 && (
                <ChevronDown size={14} className="-rotate-90" />
              )}
            </button>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex min-h-tap min-w-0 flex-1 items-center gap-2 rounded-control bg-fill px-3 focus-within:bg-accent-soft">
            <span aria-hidden className="text-label-2">
              {currencySymbol(currency)}
            </span>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="Amount"
              title="Enter adds · Ctrl/⌘+Enter subtracts"
              aria-label={`${category.name} amount`}
              value={text}
              onChange={(e) => setText(e.target.value.replace(/[^0-9.,]/g, ""))}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                add(e.ctrlKey || e.metaKey ? -1 : 1);
              }}
              className="tabular min-w-0 flex-1 bg-transparent py-2 outline-none"
            />
          </div>
          <Button
            variant="tinted"
            size="icon"
            aria-label={`Add to ${category.name}`}
            onClick={() => add(1)}
          >
            <Plus size={20} />
          </Button>
          <Button
            variant="danger"
            size="icon"
            aria-label={`Subtract from ${category.name}`}
            onClick={() => add(-1)}
          >
            <Minus size={20} />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function BulkEntryScreen() {
  const meta = useMeta();
  const { currency, accounts, lastAccountId, topCategories } = meta;
  const toast = useToast();
  const confirm = useConfirm();
  const setError = useErrorToast();

  const liveAccounts = accounts.filter((a) => !a.deletedAt);
  // Draft lives in localStorage and syncs live between tabs.
  const [draft, setDraft] = useState({
    date: toDateInput(new Date()),
    accountId: "",
    entries: {},
  });
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const saved = readDraft();
    // localStorage is only readable after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setDraft((d) => ({ ...d, ...saved }));
    setHydrated(true);
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY) return;
      const next = readDraft();
      setDraft(
        (d) => (next ? { ...d, ...next } : { ...d, entries: {} }), // cleared in another tab
      );
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {}
  }, [draft, hydrated]);

  const { date, entries } = draft;
  const accountId = liveAccounts.some((a) => a.id === draft.accountId)
    ? draft.accountId
    : (liveAccounts.find((a) => a.id === lastAccountId)?.id ??
      liveAccounts[0]?.id ??
      "");
  const setDate = (date) => setDraft((d) => ({ ...d, date }));
  const setAccountId = (accountId) => setDraft((d) => ({ ...d, accountId }));
  const setEntries = (fn) =>
    setDraft((d) => ({ ...d, entries: fn(d.entries) }));
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [historyFor, setHistoryFor] = useState(null);
  const accountItems = liveAccounts.map((a) => ({ id: a.id, label: a.name }));

  const expense = topCategories("expense");
  const income = topCategories("income");
  const byId = useMemo(
    () => new Map([...expense, ...income].map((c) => [c.id, c])),
    [expense, income],
  );

  const patch = (catId, fn) =>
    setEntries((s) => ({ ...s, [catId]: fn(s[catId] ?? []) }));

  const totals = Object.entries(entries)
    .map(([categoryId, list]) => ({ categoryId, net: netOf(list) }))
    .filter((t) => t.net !== 0 && byId.has(t.categoryId));
  const negative = totals.filter((t) => t.net < 0);
  const valid = totals.filter((t) => t.net > 0);
  const sum = (type) =>
    valid
      .filter((t) => byId.get(t.categoryId).type === type)
      .reduce((s, t) => s + t.net, 0);

  const hasEntries = Object.values(entries).some((l) => l.length > 0);

  async function reset() {
    const ok = await confirm({
      title: "Reset all entries?",
      message: "This clears every amount you've entered. It can't be undone.",
      confirmLabel: "Reset",
    });
    if (ok) setEntries(() => ({}));
  }

  async function submit() {
    setError(null);
    if (!accountId) return setError("Add an account first (More → Accounts).");
    if (negative.length)
      return setError(
        `${byId.get(negative[0].categoryId).name} has a negative total. Fix it first.`,
      );
    if (!valid.length) return setError("Enter at least one amount.");
    const ok = await confirm({
      title: "Add bulk entries?",
      message: `This adds ${valid.length} ${valid.length === 1 ? "transaction" : "transactions"} on ${date} (expense ${formatMoney(sum("expense"), currency)}, income ${formatMoney(sum("income"), currency)}).`,
      confirmLabel: "Add",
    });
    if (!ok) return;
    setSaving(true);
    const iso = fromDateInput(date, null).toISOString();
    let done = 0;
    try {
      for (const t of valid) {
        const cat = byId.get(t.categoryId);
        await apiFetch("/api/transactions", {
          method: "POST",
          body: {
            type: cat.type,
            amount: t.net,
            accountId,
            toAccountId: null,
            categoryId: cat.id,
            subcategoryId: null,
            date: iso,
            note: "",
          },
        });
        done++;
        // Drop only what was saved, so a failure can be retried safely.
        setEntries((s) => {
          const { [t.categoryId]: _, ...rest } = s;
          return rest;
        });
      }
      toast.show({
        message: `${done} ${done === 1 ? "transaction" : "transactions"} added`,
        duration: 3000,
      });
    } catch (e) {
      setError(done ? `${done} saved, then failed: ${e.message}` : e.message);
    } finally {
      invalidateAll();
      setSaving(false);
    }
  }

  const renderGroup = (header, list) =>
    list.length === 0 ? null : (
      <div className="lg:min-h-0">
        <ListGroup
          header={header}
          className="lg:mb-0 lg:flex lg:h-full lg:flex-col lg:[&>div:nth-child(2)]:min-h-0 lg:[&>div:nth-child(2)]:overflow-y-auto"
        >
          {list.map((c) => (
            <CategoryRow
              key={c.id}
              category={c}
              currency={currency}
              entries={entries[c.id] ?? []}
              onAdd={(e) => patch(c.id, (l) => [...l, e])}
              onOpenHistory={() => setHistoryFor(c.id)}
            />
          ))}
        </ListGroup>
      </div>
    );

  return (
    <div className="lg:flex lg:h-[calc(100dvh-3.5rem)] lg:flex-col">
      <Link
        href="/more"
        className="-ml-2 inline-flex min-h-tap items-center text-accent lg:shrink-0 lg:self-start"
      >
        <ChevronLeftIcon /> More
      </Link>
      <h1 className="mb-3 text-[2rem] leading-tight font-bold tracking-tight">
        Bulk transactions
      </h1>

      <div className="mb-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:shrink-0">
        <TextInput
          id="bulk-date"
          label="Date"
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
        />
        <PickerField
          label="Account"
          placeholder="Select account"
          value={accountItems.find((a) => a.id === accountId)?.label}
          active={pickerOpen}
          onClick={() => setPickerOpen(true)}
        />
      </div>

      {expense.length + income.length === 0 ? (
        <EmptyState
          title="No categories yet"
          message="Add some in More → Categories."
        />
      ) : (
        <div className="lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-2 lg:gap-4">
          {renderGroup("Expenses", expense)}
          {renderGroup("Income", income)}
        </div>
      )}

      <BottomSheet
        open={historyFor != null && (entries[historyFor] ?? []).length > 0}
        onClose={() => setHistoryFor(null)}
        title={`${byId.get(historyFor)?.name ?? ""} entries`}
        tall={false}
        subheader={
          <div className="flex items-center justify-between rounded-control bg-accent-soft px-3 py-2">
            <span className="text-[0.8125rem] font-medium text-label-2">
              Total
            </span>
            <span className="tabular text-xl font-semibold">
              {formatMoney(netOf(entries[historyFor] ?? []), currency)}
            </span>
          </div>
        }
        footer={
          <Button
            size="lg"
            variant="tinted"
            onClick={() => setHistoryFor(null)}
          >
            Done
          </Button>
        }
        confirmClose={false}
      >
        <div className="pt-2 pb-3">
          <ul className="overflow-hidden rounded-control bg-fill/50 [&>li:not(:first-child)]:border-t [&>li:not(:first-child)]:border-separator">
            {(entries[historyFor] ?? []).map((e) => (
              <HistoryRow
                key={e.id}
                entry={e}
                currency={currency}
                onChange={(next) =>
                  patch(historyFor, (l) =>
                    l.map((x) => (x.id === e.id ? next : x)),
                  )
                }
                onDelete={() =>
                  patch(historyFor, (l) => l.filter((x) => x.id !== e.id))
                }
              />
            ))}
          </ul>
        </div>
      </BottomSheet>

      <BottomSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Account"
        tall={false}
        fixed={false}
        confirmClose={false}
      >
        <div className="pt-2 pb-3">
          <OptionPanel
            title="Account"
            options={accountItems}
            value={accountId}
            onPick={(v) => {
              if (v) setAccountId(v);
              setPickerOpen(false);
            }}
            onClose={() => setPickerOpen(false)}
          />
        </div>
      </BottomSheet>

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+var(--spacing-tabbar))] z-20 lg:static lg:mt-3 lg:shrink-0">
        <div className="flex flex-col gap-1.5 rounded-card border border-separator bg-bg/90 p-2 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:gap-2 sm:pl-4">
          <div className="tabular flex justify-between gap-3 px-2 text-[0.8125rem] leading-snug text-label-2 sm:block sm:min-w-0 sm:flex-1 sm:px-0">
            <div className="truncate">
              Expense {formatMoney(sum("expense"), currency)}
            </div>
            <div className="truncate">
              Income {formatMoney(sum("income"), currency)}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="danger"
              onClick={reset}
              disabled={saving || !hasEntries}
            >
              Reset
            </Button>
            <Button
              onClick={submit}
              loading={saving}
              className="flex-1 whitespace-nowrap sm:flex-none"
            >
              Add bulk entries
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
