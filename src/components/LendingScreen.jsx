"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Check } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextInput } from "@/components/ui/Field";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useConfirm } from "@/components/ui/Confirm";
import { useErrorToast, useToast } from "@/components/ui/Toast";
import { ChevronLeftIcon } from "@/components/icons";
import { apiFetch } from "@/lib/client/api";
import { invalidateAll, useQuery } from "@/lib/client/query";
import { useMeta } from "@/lib/client/meta";
import { fromDateInput, toDateInput } from "@/lib/dates";
import { currencyDigits, formatMoney, fromMinor, toMinor } from "@/lib/money";
import { cx } from "@/lib/cx";

// ------------------------------------------------------------------ helpers

const personKey = (name) => name.trim().toLowerCase().replace(/\s+/g, " ");

const dateLabel = (iso) =>
  new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));

// Static class pairs so Tailwind can see them. Colour is picked from the name,
// so a person keeps the same colour everywhere.
const AVATARS = [
  "bg-cat-blue/18 text-cat-blue",
  "bg-cat-green/18 text-cat-green",
  "bg-cat-orange/18 text-cat-orange",
  "bg-cat-purple/18 text-cat-purple",
  "bg-cat-pink/18 text-cat-pink",
  "bg-cat-teal/18 text-cat-teal",
  "bg-cat-indigo/18 text-cat-indigo",
  "bg-cat-red/18 text-cat-red",
];

function Avatar({ name, size = "md" }) {
  let h = 0;
  for (const ch of personKey(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden
      className={cx(
        "flex shrink-0 items-center justify-center rounded-pill font-semibold uppercase",
        size === "lg" ? "size-14 text-2xl" : "size-10 text-lg",
        AVATARS[h % AVATARS.length],
      )}
    >
      {name.trim().charAt(0) || "?"}
    </span>
  );
}

const BADGES = {
  owes: { label: "Owes you", cls: "bg-cat-green/18 text-cat-green" },
  owe: { label: "You owe", cls: "bg-cat-red/18 text-cat-red" },
  settled: { label: "Settled", cls: "bg-fill text-label-2" },
};

function StatusBadge({ balance }) {
  const b = BADGES[balance > 0 ? "owes" : balance < 0 ? "owe" : "settled"];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[0.75rem] font-semibold",
        b.cls,
      )}
    >
      {balance === 0 && <Check size={12} strokeWidth={3} aria-hidden />}
      {b.label}
    </span>
  );
}

function ProgressBar({ value, label }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-2 overflow-hidden rounded-pill bg-fill"
    >
      <div
        className="h-full rounded-pill bg-income transition-[width] duration-500 ease-spring"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Groups the flat entry list into one ledger per person. */
function groupByPerson(entries) {
  const map = new Map();
  for (const e of entries) {
    const key = personKey(e.person);
    let g = map.get(key);
    if (!g) {
      // Entries arrive newest first, so the first one names the person.
      g = { key, person: e.person, entries: [], lent: 0, repaid: 0 };
      map.set(key, g);
    }
    g.entries.push(e);
    if (e.kind === "lent") g.lent += e.amount;
    else g.repaid += e.amount;
  }
  return [...map.values()].map((g) => ({
    ...g,
    balance: g.lent - g.repaid,
    lastDate: g.entries[0].date,
  }));
}

const todayInput = () => toDateInput(new Date());

// -------------------------------------------------------------- entry sheet

/**
 * Add or edit one entry. `state.entry` edits; otherwise `state.kind` and
 * `state.person` pre-fill a new one (so "Got money back" from a person's
 * page already knows who and how much).
 */
function EntrySheet({ state, people, onClose }) {
  const { currency } = useMeta();
  const toast = useToast();
  const confirm = useConfirm();
  const setError = useErrorToast();
  const entry = state.entry;

  const [kind, setKind] = useState(entry?.kind ?? state.kind ?? "lent");
  const [person, setPerson] = useState(entry?.person ?? state.person ?? "");
  const [amount, setAmount] = useState(
    entry ? String(fromMinor(entry.amount, currency)) : "",
  );
  const [day, setDay] = useState(
    entry ? toDateInput(new Date(entry.date)) : todayInput(),
  );
  const [note, setNote] = useState(entry?.note ?? "");
  const [busy, setBusy] = useState(false);

  const selected = people.find((p) => p.key === personKey(person));
  const owed = selected && selected.balance > 0 ? selected.balance : 0;
  const owe = selected && selected.balance < 0 ? -selected.balance : 0;
  // Suggest existing names only after at least 3 characters, matching what
  // they typed. An exact match needs no suggestion.
  const typed = personKey(person);
  const suggestions =
    typed.length >= 3
      ? people
          .filter((p) => p.key !== typed && p.key.includes(typed))
          .sort((a, b) => Number(b.balance !== 0) - Number(a.balance !== 0))
          .slice(0, 6)
      : [];

  // Amount shortcuts once a known person is picked: what settles the balance
  // (given the direction), and the last amount of this kind.
  const amountChips = [];
  if (selected && !entry) {
    if (kind === "repaid" && owed > 0)
      amountChips.push({ label: "Full amount", value: owed });
    if (kind === "lent" && owe > 0)
      amountChips.push({ label: "Settle what you owe", value: owe });
    const last = selected.entries.find((e) => e.kind === kind);
    if (last && !amountChips.some((c) => c.value === last.amount))
      amountChips.push({
        label: kind === "lent" ? "Last lent" : "Last paid back",
        value: last.amount,
      });
  }

  async function save() {
    setError(null);
    const parsed = Number(amount);
    if (!person.trim()) return setError("Who is this with?");
    if (!amount.trim() || !Number.isFinite(parsed) || parsed <= 0)
      return setError("Enter an amount greater than zero.");
    setBusy(true);
    try {
      const body = {
        person,
        kind,
        amount: toMinor(parsed, currency),
        date: fromDateInput(
          day,
          entry ? new Date(entry.date) : null,
        ).toISOString(),
        note,
      };
      await apiFetch(entry ? `/api/lending/${entry.id}` : "/api/lending", {
        method: entry ? "PATCH" : "POST",
        body,
      });
      invalidateAll();
      onClose();
      toast.show({
        message:
          kind === "lent"
            ? `Noted: lent ${formatMoney(body.amount, currency)} to ${person.trim()}`
            : `Noted: ${person.trim()} paid back ${formatMoney(body.amount, currency)}`,
        duration: 3000,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (
      !(await confirm({
        title: "Delete this entry?",
        message: "You can undo this right after.",
      }))
    )
      return;
    setBusy(true);
    try {
      await apiFetch(`/api/lending/${entry.id}`, { method: "DELETE" });
      invalidateAll();
      onClose();
      toast.show({
        message: "Entry deleted",
        actionLabel: "Undo",
        onAction: async () => {
          await apiFetch(`/api/lending/${entry.id}`, {
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
      title={entry ? "Edit entry" : "New entry"}
      tall={false}
      footer={
        entry ? (
          <div className="grid grid-cols-2 gap-2">
            <Button size="lg" onClick={save} loading={busy}>
              Save
            </Button>
            <Button size="lg" variant="danger" onClick={remove} disabled={busy}>
              Delete
            </Button>
          </div>
        ) : (
          <Button size="lg" onClick={save} loading={busy}>
            {kind === "lent" ? "Save: I lent" : "Save: I got money back"}
          </Button>
        )
      }
    >
      <div className="space-y-2.5 pt-2">
        <SegmentedControl
          label="What happened"
          value={kind}
          onChange={setKind}
          options={[
            { value: "lent", label: "I lent money" },
            { value: "repaid", label: "I got money back" },
          ]}
        />

        <div>
          <TextInput
            id="lend-person"
            label={kind === "lent" ? "Lent to" : "Received from"}
            value={person}
            maxLength={40}
            autoComplete="off"
            onChange={(e) => setPerson(e.target.value)}
            placeholder="Name"
          />
          {suggestions.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {suggestions.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPerson(p.person)}
                  className="flex min-h-9 items-center gap-1.5 rounded-pill bg-fill px-3 text-[0.875rem] active:bg-accent-soft"
                >
                  {p.person}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <TextInput
            id="lend-amount"
            label={`Amount (${currency})`}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder={`0${currencyDigits(currency) ? ".00" : ""}`}
          />
          {amountChips.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {amountChips.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() =>
                    setAmount(String(fromMinor(c.value, currency)))
                  }
                  className="flex min-h-9 items-center rounded-pill bg-accent-soft px-3 text-[0.875rem] font-medium text-accent"
                >
                  {c.label} · {formatMoney(c.value, currency)}
                </button>
              ))}
            </div>
          )}
        </div>

        <TextInput
          id="lend-date"
          label="Date"
          type="date"
          required
          value={day}
          onChange={(e) => e.target.value && setDay(e.target.value)}
        />
        <TextInput
          id="lend-note"
          label="Note"
          placeholder="Optional, e.g. for rent, trip share"
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </BottomSheet>
  );
}

// ------------------------------------------------------------- person sheet

function PersonSheet({ group, open, onClose, onEntry }) {
  const { currency } = useMeta();
  const toast = useToast();
  const setError = useErrorToast();
  const [busy, setBusy] = useState(false);

  // Keep the last group while the sheet animates closed.
  const [last, setLast] = useState(group);
  if (group && group !== last) setLast(group);
  const g = group ?? last;
  if (!g) return null;

  const owed = g.balance > 0;
  const iOwe = g.balance < 0;
  const unsettled = g.balance !== 0;
  const progress = g.lent > 0 ? Math.min(g.repaid, g.lent) / g.lent : 0;

  async function settle() {
    setBusy(true);
    try {
      const r = await apiFetch("/api/lending", {
        method: "POST",
        body: {
          person: g.person,
          // They owe me: they pay back. I owe them: I pay back (a "lent" entry
          // moves the balance towards zero the other way).
          kind: owed ? "repaid" : "lent",
          amount: Math.abs(g.balance),
          date: new Date().toISOString(),
          note: "Settled in full",
        },
      });
      invalidateAll();
      toast.show({
        message: `${g.person} is all settled up`,
        actionLabel: "Undo",
        onAction: async () => {
          await apiFetch(`/api/lending/${r.id}`, { method: "DELETE" }).catch(
            () => {},
          );
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
      open={open}
      onClose={onClose}
      title={g.person}
      footer={
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="lg"
              variant="tinted"
              onClick={() => onEntry({ kind: "lent", person: g.person })}
              className="px-3 whitespace-nowrap"
            >
              Lent more
            </Button>
            <Button
              size="lg"
              onClick={() => onEntry({ kind: "repaid", person: g.person })}
              className="px-3 whitespace-nowrap"
            >
              Got money back
            </Button>
          </div>
          {unsettled && (
            <Button
              size="lg"
              variant="plain"
              onClick={settle}
              loading={busy}
              className="!min-h-tap"
            >
              <Check size={18} strokeWidth={2.6} aria-hidden /> Mark fully
              settled
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col items-center pt-2 pb-4 text-center">
        <Avatar name={g.person} size="lg" />
        <p className="mt-3 text-[0.8125rem] font-medium tracking-wide text-label-2 uppercase">
          {owed ? "Still owes you" : iOwe ? "You owe" : "All settled"}
        </p>
        <p
          className={cx(
            "tabular text-[2.5rem] leading-tight font-bold tracking-tight",
            iOwe && "text-expense",
            !unsettled && "text-income",
          )}
        >
          {formatMoney(Math.abs(g.balance), currency)}
        </p>
        <div className="mt-3 w-full max-w-xs">
          <ProgressBar value={progress} label="Paid back" />
          <div className="tabular mt-1.5 flex justify-between text-[0.8125rem] text-label-2">
            <span>Lent {formatMoney(g.lent, currency)}</span>
            <span>Back {formatMoney(g.repaid, currency)}</span>
          </div>
        </div>
      </div>

      <ListGroup header="History" className="mb-2">
        {g.entries.map((e) => (
          <ListRow
            key={e.id}
            onClick={() => onEntry({ entry: e })}
            leading={
              <span
                aria-hidden
                className={cx(
                  "flex size-10 shrink-0 items-center justify-center rounded-pill",
                  e.kind === "lent"
                    ? "bg-expense/12 text-expense"
                    : "bg-income/12 text-income",
                )}
              >
                {e.kind === "lent" ? (
                  <ArrowUpRight size={20} />
                ) : (
                  <ArrowDownLeft size={20} />
                )}
              </span>
            }
            title={e.kind === "lent" ? "You lent" : "Paid you back"}
            subtitle={
              e.note ? `${dateLabel(e.date)} · ${e.note}` : dateLabel(e.date)
            }
            trailing={
              <span
                className={cx(
                  "tabular font-semibold",
                  e.kind === "repaid" && "text-income",
                )}
              >
                {e.kind === "lent" ? "−" : "+"}
                {formatMoney(e.amount, currency)}
              </span>
            }
          />
        ))}
      </ListGroup>
    </BottomSheet>
  );
}

// ------------------------------------------------------------------- screen

function Summary({ groups }) {
  const { currency } = useMeta();
  const lent = groups.reduce((n, g) => n + g.lent, 0);
  const repaid = groups.reduce((n, g) => n + g.repaid, 0);
  // Per-person balances, so one person's debt never cancels another's.
  const owed = groups.reduce((n, g) => n + Math.max(0, g.balance), 0);
  const owe = groups.reduce((n, g) => n + Math.max(0, -g.balance), 0);
  const net = owed - owe;
  const owedBy = groups.filter((g) => g.balance > 0).length;
  const oweTo = groups.filter((g) => g.balance < 0).length;
  const people = (n) => `${n} ${n === 1 ? "person" : "people"}`;

  return (
    <Card className="mb-5 p-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-medium tracking-wide text-label-2 uppercase">
            Owed to you
          </p>
          <p className="tabular text-[clamp(1.25rem,6vw,1.75rem)] leading-tight font-bold tracking-tight">
            {formatMoney(owed, currency)}
          </p>
          <p className="text-[0.8125rem] text-label-2">
            {owedBy === 0 ? "Nobody owes you" : `from ${people(owedBy)}`}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-medium tracking-wide text-label-2 uppercase">
            You owe
          </p>
          <p
            className={cx(
              "tabular text-[clamp(1.25rem,6vw,1.75rem)] leading-tight font-bold tracking-tight",
              owe > 0 && "text-expense",
            )}
          >
            {formatMoney(owe, currency)}
          </p>
          <p className="text-[0.8125rem] text-label-2">
            {oweTo === 0 ? "You owe nobody" : `to ${people(oweTo)}`}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-separator pt-3">
        <span className="text-[0.8125rem] font-medium tracking-wide text-label-2 uppercase">
          Net balance
        </span>
        <span
          className={cx(
            "tabular text-[1.25rem] font-bold",
            net > 0 && "text-income",
            net < 0 && "text-expense",
          )}
        >
          {net < 0 ? "−" : net > 0 ? "+" : ""}
          {formatMoney(Math.abs(net), currency)}
        </span>
      </div>
      <div className="mt-3">
        <ProgressBar value={lent > 0 ? repaid / lent : 0} label="Paid back" />
        <div className="tabular mt-1.5 flex justify-between text-[0.8125rem] text-label-2">
          <span>Lent {formatMoney(lent, currency)}</span>
          <span>Back {formatMoney(repaid, currency)}</span>
        </div>
      </div>
    </Card>
  );
}

export function LendingScreen() {
  const { currency } = useMeta();
  const q = useQuery("/api/lending");
  const [personKeyOpen, setPersonKeyOpen] = useState(null);
  const [personShown, setPersonShown] = useState(false);
  const [sheet, setSheet] = useState({ open: false, n: 0 });

  // The app's "+" / "Add entry" button (in the tab bar and sidebar) lives
  // outside this screen and asks us to open a new entry via this event.
  useEffect(() => {
    const onAdd = () => setSheet((s) => ({ open: true, n: s.n + 1 }));
    window.addEventListener("lending:add", onAdd);
    return () => window.removeEventListener("lending:add", onAdd);
  }, []);

  const groups = useMemo(
    () => (q.data ? groupByPerson(q.data.entries) : []),
    [q.data],
  );
  // Open balances first (largest first), then settled people by recency.
  const sorted = [...groups].sort(
    (a, b) =>
      Number(b.balance !== 0) - Number(a.balance !== 0) ||
      (a.balance !== 0
        ? Math.abs(b.balance) - Math.abs(a.balance)
        : Date.parse(b.lastDate) - Date.parse(a.lastDate)),
  );
  const openGroup = groups.find((g) => g.key === personKeyOpen) ?? null;

  const openEntry = (init = {}) =>
    setSheet((s) => ({ ...init, open: true, n: s.n + 1 }));
  const closeEntry = () => setSheet((s) => ({ ...s, open: false }));
  const openPerson = (g) => {
    setPersonKeyOpen(g.key);
    setPersonShown(true);
  };

  return (
    <div>
      <Link
        href="/more"
        className="-ml-2 inline-flex min-h-tap items-center text-accent"
      >
        <ChevronLeftIcon /> More
      </Link>
      <h1 className="sr-only">Track lending</h1>

      {q.loading ? (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : q.error && !q.data ? (
        <ErrorState message={q.error.message} onRetry={q.retry} />
      ) : groups.length === 0 ? (
        <EmptyState
          icon="hand-coins"
          title="Track money you lend"
          message="Note who you lent to and tick it off as it comes back. This stays separate from your transactions and balances."
          actionLabel="Add first entry"
          onAction={() => openEntry()}
        />
      ) : (
        <>
          <Summary groups={groups} />

          <ListGroup header="People" headerRight={`${groups.length}`}>
            {sorted.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => openPerson(g)}
                className="flex min-h-[4rem] w-full items-center gap-3 px-4 py-3 text-left active:bg-fill"
              >
                <Avatar name={g.person} />
                <span className="min-w-0 flex-1">
                  {/* Full name, wrapping if needed: never truncated. */}
                  <span className="block text-[1.0625rem] leading-snug break-words">
                    {g.person}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    {g.balance !== 0 && (
                      <span
                        className={cx(
                          "tabular text-[1.0625rem] font-semibold",
                          g.balance < 0 && "text-expense",
                        )}
                      >
                        {formatMoney(Math.abs(g.balance), currency)}
                      </span>
                    )}
                    <StatusBadge balance={g.balance} />
                  </span>
                </span>
              </button>
            ))}
          </ListGroup>
        </>
      )}

      <PersonSheet
        group={personShown ? openGroup : null}
        open={personShown && Boolean(openGroup)}
        onClose={() => setPersonShown(false)}
        onEntry={openEntry}
      />
      <EntrySheet
        key={sheet.n}
        state={sheet}
        people={groups}
        onClose={closeEntry}
      />
    </div>
  );
}
