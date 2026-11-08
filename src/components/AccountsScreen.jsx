"use client";
import { useState } from "react";
import Link from "next/link";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { CategoryBadge, ColorSwatches } from "@/components/ui/CategoryBadge";
import { TextInput } from "@/components/ui/Field";
import { CategoryIcon } from "@/components/CategoryIcon";
import { OptionPanel, PickerField } from "@/components/ui/Picker";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { EmptyState } from "@/components/ui/States";
import { useErrorToast, useToast } from "@/components/ui/Toast";
import { ChevronLeftIcon } from "@/components/icons";
import { useConfirm } from "@/components/ui/Confirm";
import { apiFetch } from "@/lib/client/api";
import { invalidateAll } from "@/lib/client/query";
import { useMeta } from "@/lib/client/meta";
import { currencyDigits, formatMoney, fromMinor, toMinor } from "@/lib/money";
import { cx } from "@/lib/cx";

const TYPE_ICON = {
  cash: "banknote",
  bank: "landmark",
  card: "credit-card",
  savings: "piggy-bank",
};
const TYPE_LABEL = {
  cash: "Cash",
  bank: "Bank",
  card: "Card",
  savings: "Savings",
};

const TYPE_OPTIONS = Object.entries(TYPE_LABEL).map(([id, label]) => ({
  id,
  label,
  leading: <CategoryIcon icon={TYPE_ICON[id]} size={20} />,
}));

function AccountSheet({ state, onClose }) {
  const { currency } = useMeta();
  const toast = useToast();
  const confirm = useConfirm();
  const account = state.account;
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState(account?.type ?? "bank");
  const [color, setColor] = useState(account?.color ?? "blue");
  const [opening, setOpening] = useState(
    account ? String(fromMinor(account.openingBalance, currency)) : "",
  );
  const [panel, setPanel] = useState(false);
  const setError = useErrorToast();
  const [busy, setBusy] = useState(false);

  async function save() {
    setError(null);
    const parsed = opening.trim() === "" ? 0 : Number(opening);
    if (!name.trim()) return setError("Give the account a name.");
    if (!Number.isFinite(parsed))
      return setError("Starting balance must be a number.");
    setBusy(true);
    try {
      await apiFetch(
        account ? `/api/accounts/${account.id}` : "/api/accounts",
        {
          method: account ? "PATCH" : "POST",
          body: {
            name,
            type,
            color,
            openingBalance: toMinor(parsed, currency),
          },
        },
      );
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
        title: "Delete account?",
        message: `"${account.name}" will be removed. You can undo this right after.`,
      }))
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/accounts/${account.id}`, { method: "DELETE" });
      invalidateAll();
      onClose();
      toast.show({
        message: `${account.name} deleted`,
        actionLabel: "Undo",
        onAction: async () => {
          await apiFetch(`/api/accounts/${account.id}`, {
            method: "PATCH",
            body: { deleted: false },
          }).catch(() => {});
          invalidateAll();
        },
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      open={state.open}
      onClose={onClose}
      title={account ? "Edit account" : "New account"}
      footer={
        <div className="space-y-2">
          {panel && (
            <OptionPanel
              title="Account type"
              options={TYPE_OPTIONS}
              value={type}
              onPick={(v) => {
                if (v) setType(v);
                setPanel(false);
              }}
              onClose={() => setPanel(false)}
            />
          )}
          {account ? (
            <div className="grid grid-cols-2 gap-2">
              <Button size="lg" onClick={save} loading={busy}>
                Save
              </Button>
              <Button
                size="lg"
                variant="danger"
                onClick={remove}
                disabled={busy}
              >
                Delete
              </Button>
            </div>
          ) : (
            <Button size="lg" onClick={save} loading={busy}>
              Add account
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-2.5 pt-2">
        <TextInput
          id="acc-name"
          label="Name"
          value={name}
          maxLength={40}
          onFocus={() => setPanel(false)}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Main bank"
        />
        <PickerField
          label="Type"
          placeholder="Choose type"
          value={TYPE_LABEL[type]}
          leading={<CategoryIcon icon={TYPE_ICON[type]} size={20} />}
          active={panel}
          onClick={() => setPanel((p) => !p)}
        />
        <TextInput
          id="acc-opening"
          label={`Starting balance (${currency})`}
          inputMode="decimal"
          value={opening}
          onFocus={() => setPanel(false)}
          onChange={(e) => setOpening(e.target.value.replace(/[^0-9.-]/g, ""))}
          placeholder={`0${currencyDigits(currency) ? ".00" : ""}`}
        />
        <ColorSwatches value={color} onChange={setColor} />
      </div>
    </BottomSheet>
  );
}

export function AccountsScreen() {
  const { accounts, currency } = useMeta();
  const [sheet, setSheet] = useState({ open: false, account: null, n: 0 });
  const open = (account = null) =>
    setSheet((s) => ({ open: true, account, n: s.n + 1 }));
  const close = () => setSheet((s) => ({ ...s, open: false }));

  const total = accounts.reduce((n, a) => n + a.balance, 0);

  return (
    <div>
      <Link
        href="/more"
        className="-ml-2 inline-flex min-h-tap items-center text-accent"
      >
        <ChevronLeftIcon /> More
      </Link>
      <h1 className="sr-only">Accounts</h1>

      {accounts.length === 0 ? (
        <EmptyState
          icon="landmark"
          title="No accounts yet"
          message="Add a cash, bank, card or savings account to start tracking."
          actionLabel="Add account"
          onAction={() => open()}
        />
      ) : (
        <>
          <ListGroup
            header="All accounts"
            headerRight={formatMoney(total, currency)}
          >
            {accounts.map((a) => (
              <ListRow
                key={a.id}
                onClick={() => open(a)}
                leading={
                  <CategoryBadge icon={TYPE_ICON[a.type]} color={a.color} />
                }
                title={a.name}
                subtitle={TYPE_LABEL[a.type]}
                trailing={
                  <span
                    className={cx(
                      "tabular font-semibold",
                      a.balance < 0 && "text-expense",
                    )}
                  >
                    {formatMoney(a.balance, currency)}
                  </span>
                }
              />
            ))}
          </ListGroup>
          <Button variant="tinted" size="lg" onClick={() => open()}>
            Add account
          </Button>
        </>
      )}

      <AccountSheet key={sheet.n} state={sheet} onClose={close} />
    </div>
  );
}
