"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { OptionPanel, PickerField } from "@/components/ui/Picker";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TextInput } from "@/components/ui/Field";
import { useErrorToast, useToast } from "@/components/ui/Toast";
import { AmountPad } from "@/components/AmountPad";
import { ReceiptPicker } from "@/components/ReceiptPicker";
import { CategoryIcon } from "@/components/CategoryIcon";
import { useConfirm } from "@/components/ui/Confirm";
import { apiFetch } from "@/lib/client/api";
import { invalidateAll } from "@/lib/client/query";
import { useMeta } from "@/lib/client/meta";
import { evaluate, press, toExpr } from "@/lib/calc";
import { fromDateInput, toDateInput } from "@/lib/dates";
import {
  currencyDigits,
  currencySymbol,
  formatMoney,
  fromMinor,
  toMinor,
} from "@/lib/money";

const TYPES = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfer" },
];

/** Visual required marker (the validation message is the real guard). */
const Req = () => (
  <span aria-hidden className="text-danger">
    *
  </span>
);

const SheetContext = createContext(null);
export const useTxSheet = () => useContext(SheetContext);

/** Owns the open/close state; any screen can call `open()` or `open({ tx })`. */
export function TxSheetProvider({ children }) {
  const [state, setState] = useState({
    open: false,
    tx: null,
    type: "expense",
    date: null,
    n: 0,
  });

  const open = useCallback(
    (opts = {}) =>
      setState((s) => ({
        open: true,
        tx: opts.tx ?? null,
        type: opts.type ?? "expense",
        date: opts.date ?? null,
        n: s.n + 1,
      })),
    [],
  );
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);

  return (
    <SheetContext value={{ open, close }}>
      {children}
      {/* key remounts the form on every open, so state is always fresh */}
      <TxForm
        key={state.n}
        open={state.open}
        tx={state.tx}
        initialType={state.type}
        initialDate={state.date}
        onClose={close}
      />
    </SheetContext>
  );
}

function initialState(meta, tx, initialType, initialDate) {
  const { accounts, lastAccountId, currency } = meta;
  const live = accounts.filter((a) => !a.deletedAt);
  if (tx) {
    return {
      type: tx.type,
      expr: toExpr(fromMinor(tx.amount, currency), currencyDigits(currency)),
      accountId: tx.accountId,
      toAccountId: tx.toAccountId,
      categoryId: tx.categoryId,
      date: toDateInput(new Date(tx.date)),
      note: tx.note ?? "",
      // null until the photos are fetched (lists don't carry them).
      receipts: tx.receiptCount ? null : [],
    };
  }
  // Smart defaults: today, last-used account, no typing needed to save.
  const accountId =
    live.find((a) => a.id === lastAccountId)?.id ?? live[0]?.id ?? null;
  return {
    type: initialType,
    expr: "",
    accountId,
    toAccountId: live.find((a) => a.id !== accountId)?.id ?? null,
    categoryId: null,
    date: initialDate ?? toDateInput(new Date()),
    note: "",
    receipts: [],
  };
}

function TxForm({ open, tx, initialType, initialDate, onClose }) {
  const meta = useMeta();
  const toast = useToast();
  const confirm = useConfirm();
  const { currency, accounts, topCategories } = meta;
  const digits = currencyDigits(currency);
  const editing = Boolean(tx);

  const [f, setF] = useState(() =>
    initialState(meta, tx, initialType, initialDate),
  );
  const setError = useErrorToast();
  const [saving, setSaving] = useState(false);
  const set = (patch) => setF((s) => ({ ...s, ...patch }));
  // One bottom panel, shared: the number pad, or an option list for
  // category / account. null = closed.
  const [panel, setPanel] = useState(null);

  // Editing a transaction that has photos: load them (lists only carry a count).
  useEffect(() => {
    if (!tx?.receiptCount) return;
    let cancelled = false;
    apiFetch(`/api/transactions/${tx.id}`)
      .then((full) => !cancelled && set({ receipts: full.receipts ?? [] }))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx?.id]);

  // Physical-keyboard typing: rebuild through the same rules as the keypad.
  const typeAmount = (raw) => {
    const mapped = raw
      .replaceAll("*", "×")
      .replaceAll("/", "÷")
      .replaceAll("-", "−");
    const expr = [...mapped].reduce(
      (e, k) => (/[0-9.+−×÷]/.test(k) ? press(e, k, digits) : e),
      "",
    );
    set({ expr });
  };
  const closePad = () => {
    const r = evaluate(f.expr);
    if (r != null) set({ expr: toExpr(r, digits) });
    setPanel(null);
  };

  const live = accounts.filter((a) => !a.deletedAt);
  const isTransfer = f.type === "transfer";
  const accountItems = live.map((a) => ({ id: a.id, label: a.name }));
  const catItems = topCategories(
    f.type === "income" ? "income" : "expense",
  ).map((c) => ({
    id: c.id,
    label: c.name,
    leading: <CategoryIcon icon={c.icon} color={c.color} size={20} />,
  }));

  const nameOf = (items, id) => items.find((i) => i.id === id);
  const PANELS = {
    category: {
      title: "Category",
      options: catItems,
      value: f.categoryId,
      onPick: (v) => v && set({ categoryId: v }),
    },
    account: {
      title: isTransfer ? "From account" : "Account",
      options: accountItems,
      value: f.accountId,
      onPick: (v) => v && set({ accountId: v }),
    },
    toAccount: {
      title: "To account",
      options: accountItems,
      value: f.toAccountId,
      onPick: (v) => v && set({ toAccountId: v }),
    },
  };
  const activePanel = panel && panel !== "amount" ? PANELS[panel] : null;

  async function save(keepOpen = false) {
    setError(null);
    const value = evaluate(f.expr);
    const amount = value == null ? 0 : toMinor(value, currency);
    if (amount <= 0) return setError("Enter an amount greater than zero.");
    if (!f.accountId)
      return setError("Add an account first (More → Accounts).");
    if (isTransfer) {
      if (!f.toAccountId) return setError("Choose the account to transfer to.");
      if (f.toAccountId === f.accountId)
        return setError("Choose two different accounts.");
    } else {
      if (!f.categoryId) return setError("Choose a category.");
    }
    if (!f.date) return setError("Choose a date.");
    const payload = {
      type: f.type,
      amount,
      accountId: f.accountId,
      toAccountId: isTransfer ? f.toAccountId : null,
      categoryId: isTransfer ? null : f.categoryId,
      subcategoryId: null,
      date: fromDateInput(f.date, tx ? new Date(tx.date) : null).toISOString(),
      note: f.note,
      // Omitted while photos are still loading so an edit can't wipe them.
      ...(f.receipts ? { receipts: f.receipts } : {}),
    };
    setSaving(true);
    try {
      await apiFetch(
        editing ? `/api/transactions/${tx.id}` : "/api/transactions",
        {
          method: editing ? "PATCH" : "POST",
          body: payload,
        },
      );
      invalidateAll();
      const message = editing
        ? "Changes saved"
        : `${formatMoney(amount, currency)} added`;
      if (keepOpen) {
        // Save & continue: keep the sheet open, clear only per-entry fields.
        set({ expr: "", note: "", receipts: [] });
        toast.show({ message, duration: 2000 });
      } else {
        onClose();
        toast.show({ message, duration: 3000 });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (
      !(await confirm({
        title: "Delete transaction?",
        message: "You can undo this right after.",
      }))
    )
      return;
    setSaving(true);
    try {
      await apiFetch(`/api/transactions/${tx.id}`, { method: "DELETE" });
      invalidateAll();
      onClose();
      toast.show({
        message: "Transaction deleted",
        actionLabel: "Undo",
        onAction: async () => {
          try {
            await apiFetch(`/api/transactions/${tx.id}/restore`, {
              method: "POST",
            });
          } catch (e) {
            toast.show({ message: e.message });
          } finally {
            invalidateAll();
          }
        },
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={editing ? "Edit transaction" : "New transaction"}
      footer={
        <div className="space-y-2">
          {panel === "amount" && (
            <AmountPad
              value={f.expr}
              onChange={(expr) => set({ expr })}
              decimals={digits}
              onDone={closePad}
            />
          )}
          {activePanel && (
            <OptionPanel
              {...activePanel}
              onPick={(v) => {
                setPanel(activePanel.onPick(v) ?? null);
              }}
              onClose={() => setPanel(null)}
            />
          )}
          {editing ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="danger"
                size="lg"
                onClick={remove}
                disabled={saving}
              >
                Delete
              </Button>
              <Button size="lg" onClick={() => save(false)} loading={saving}>
                Save changes
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="tinted"
                size="lg"
                aria-label="Save and continue with another"
                onClick={() => save(true)}
                disabled={saving}
              >
                Continue
              </Button>
              <Button size="lg" onClick={() => save(false)} loading={saving}>
                Save
              </Button>
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-2.5 pt-2">
        <SegmentedControl
          label="Type"
          options={TYPES}
          value={f.type}
          onChange={(type) => {
            set({ type, categoryId: null });
            setPanel(null);
          }}
        />

        <div>
          <label
            htmlFor="tx-amount"
            className="mb-0.5 block text-[0.8125rem] font-medium text-label-2"
          >
            Amount <Req />
          </label>
          <div
            className={
              "flex min-h-tap items-center gap-2 rounded-control px-3 transition-colors duration-200 " +
              (panel === "amount" ? "bg-accent-soft" : "bg-fill")
            }
          >
            <span aria-hidden className="text-xl font-semibold text-label-2">
              {currencySymbol(currency)}
            </span>
            <input
              id="tx-amount"
              type="text"
              inputMode="none"
              autoComplete="off"
              placeholder="0"
              value={f.expr}
              onFocus={() => setPanel("amount")}
              onClick={() => setPanel("amount")}
              onChange={(e) => typeAmount(e.target.value)}
              className="tabular min-w-0 flex-1 bg-transparent py-1.5 text-[1.5rem] leading-tight font-semibold outline-none focus-visible:outline-none placeholder:text-label-2"
            />
          </div>
        </div>

        {isTransfer ? (
          <>
            <PickerField
              label="From account"
              required
              placeholder="Select account"
              value={nameOf(accountItems, f.accountId)?.label}
              active={panel === "account"}
              onClick={() => setPanel(panel === "account" ? null : "account")}
            />
            <PickerField
              label="To account"
              required
              placeholder="Select account"
              value={nameOf(accountItems, f.toAccountId)?.label}
              active={panel === "toAccount"}
              onClick={() =>
                setPanel(panel === "toAccount" ? null : "toAccount")
              }
            />
          </>
        ) : (
          <>
            <PickerField
              label="Category"
              required
              placeholder="Select category"
              value={nameOf(catItems, f.categoryId)?.label}
              leading={nameOf(catItems, f.categoryId)?.leading}
              active={panel === "category"}
              onClick={() => setPanel(panel === "category" ? null : "category")}
            />
            <PickerField
              label="Account"
              required
              placeholder="Select account"
              value={nameOf(accountItems, f.accountId)?.label}
              active={panel === "account"}
              onClick={() => setPanel(panel === "account" ? null : "account")}
            />
          </>
        )}

        <div className="grid grid-cols-1 gap-2.5 pb-1">
          <TextInput
            id="tx-date"
            label="Date"
            required
            type="date"
            value={f.date}
            onChange={(e) => e.target.value && set({ date: e.target.value })}
          />
          <TextInput
            id="tx-note"
            label="Note"
            placeholder="Optional"
            maxLength={500}
            value={f.note}
            onChange={(e) => set({ note: e.target.value })}
          />
          <ReceiptPicker
            value={f.receipts ?? []}
            loading={f.receipts === null}
            onChange={(receipts) => set({ receipts })}
          />
        </div>
      </div>
    </BottomSheet>
  );
}
