"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { TextInput } from "@/components/ui/Field";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { OptionPanel, PickerField } from "@/components/ui/Picker";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { CategoryIcon } from "@/components/CategoryIcon";
import { useConfirm } from "@/components/ui/Confirm";
import { useErrorToast, useToast } from "@/components/ui/Toast";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { apiFetch } from "@/lib/client/api";
import { invalidateAll, useQuery } from "@/lib/client/query";
import { useMeta } from "@/lib/client/meta";
import { fromDateInput, toDateInput } from "@/lib/dates";
import { fileToIcon } from "@/lib/client/image";
import { authClient } from "@/lib/auth-client";
import { currencyDigits, formatMoney, fromMinor, toMinor } from "@/lib/money";
import {
  NW_GROUPS,
  NW_TYPES,
  netWorthTotals,
  nwFields,
  nwGroup,
  nwType,
} from "@/lib/networth";
import { cx } from "@/lib/cx";

// ------------------------------------------------------------------ helpers

const shortDate = (iso) =>
  new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));

// "as on 4 Oct, 2026", or "as on today" with "today" highlighted.
function AsOn({ iso }) {
  const d = new Date(iso);
  if (d.toDateString() === new Date().toDateString()) {
    return (
      <>
        as on <span className="font-semibold text-income">today</span>
      </>
    );
  }
  const f = (o) => new Intl.DateTimeFormat("en-GB", o).format(d);
  return `as on ${f({ day: "numeric" })} ${f({ month: "short" })}, ${f({ year: "numeric" })}`;
}

// Static class pairs so Tailwind can see them.
const TYPE_BADGE = {
  bank: "bg-cat-blue/18 text-cat-blue",
  investment: "bg-cat-green/18 text-cat-green",
  liability: "bg-cat-red/18 text-cat-red",
};

const isLiability = (h) => nwType(h.type).group === "liability";

/** Last balance update and the change since the point before it. */
function lastChange(h) {
  const hist = h.history ?? [];
  const last = hist[hist.length - 1];
  const prev = hist[hist.length - 2];
  return {
    at: last?.at ?? h.updatedAt,
    diff: prev ? h.balance - prev.balance : 0,
    since: prev?.at,
  };
}

function Switch({ on }) {
  return (
    <span
      aria-hidden
      className={cx(
        "relative inline-block h-7 w-12 shrink-0 rounded-full transition-colors",
        on ? "bg-accent" : "bg-fill",
      )}
    >
      <span
        className={cx(
          "absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition-transform",
          on && "translate-x-5",
        )}
      />
    </span>
  );
}

/** The instrument's own logo if it has one, else its type icon. */
function HoldingBadge({ h, type, color }) {
  if (!h.icon) return <CategoryBadge icon={type.icon} color={color} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={h.icon}
      alt=""
      className="size-10 shrink-0 rounded-pill bg-fill object-cover"
    />
  );
}

const isNominee = (f) => f.key.startsWith("nominee");

/** Detail inputs for the chosen type, split into details and nominee. */
function DetailFields({ type, values, onChange, onFocus }) {
  const fields = nwFields(type);
  if (fields.length === 0) return null;
  const input = (f) =>
    f.type === "choice" ? (
      <SegmentedControl
        key={f.key}
        label={f.label}
        value={values[f.key] ?? ""}
        onChange={(v) => onChange(f.key, v)}
        options={f.options.map((o) => ({ value: o, label: o }))}
      />
    ) : (
      <TextInput
        key={f.key}
        id={`nwd-${f.key}`}
        label={f.label}
        type={f.type === "date" ? "date" : "text"}
        value={values[f.key] ?? ""}
        maxLength={200}
        autoComplete="off"
        onFocus={onFocus}
        onChange={(e) => onChange(f.key, e.target.value)}
      />
    );
  const main = fields.filter((f) => !isNominee(f));
  const nominee = fields.filter(isNominee);
  const heading = (t) => (
    <h3 className="pt-2 text-[0.8125rem] font-medium tracking-wide text-label-2 uppercase">
      {t}
    </h3>
  );
  return (
    <div className="space-y-2.5 pt-2">
      {main.length > 0 && heading("Details")}
      {main.map(input)}
      {nominee.length > 0 && heading("Nominee")}
      {nominee.map(input)}
    </div>
  );
}

const TYPE_OPTIONS = NW_TYPES.map((t) => ({
  id: t.id,
  label: `${t.label}`,
  leading: <CategoryIcon icon={t.icon} size={20} />,
}));

const numeric = (v) => v.replace(/[^0-9.-]/g, "");

// ------------------------------------------------------------ balance entry

/** Add or edit one dated balance entry of an instrument. */
function BalanceEntrySheet({ state, holding, onClose }) {
  const { currency } = useMeta();
  const confirm = useConfirm();
  const setError = useErrorToast();
  const history = holding?.history ?? [];
  const entry = state.index != null ? history[state.index] : null;

  const [day, setDay] = useState(
    entry ? toDateInput(new Date(entry.at)) : toDateInput(new Date()),
  );
  const [balance, setBalance] = useState(
    entry ? String(fromMinor(entry.balance, currency)) : "",
  );
  const [busy, setBusy] = useState(false);

  async function persist(next) {
    setBusy(true);
    try {
      await apiFetch(`/api/networth/${holding.id}`, {
        method: "PATCH",
        body: { history: next },
      });
      invalidateAll();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function save() {
    setError(null);
    const n = Number(balance);
    if (balance.trim() === "" || !Number.isFinite(n))
      return setError("Enter the balance.");
    const item = {
      at: fromDateInput(day, entry ? new Date(entry.at) : null).toISOString(),
      balance: toMinor(n, currency),
    };
    const next = history.map((e) => ({ at: e.at, balance: e.balance }));
    if (entry) next[state.index] = item;
    else next.push(item);
    persist(next);
  }

  async function remove() {
    if (
      !(await confirm({
        title: "Delete this entry?",
        message: "The current balance becomes the latest remaining entry.",
      }))
    )
      return;
    persist(
      history
        .filter((_, i) => i !== state.index)
        .map((e) => ({ at: e.at, balance: e.balance })),
    );
  }

  return (
    <BottomSheet
      open={state.open}
      onClose={onClose}
      title={entry ? "Edit balance entry" : "Add balance entry"}
      tall={false}
      footer={
        entry ? (
          <div className="grid grid-cols-2 gap-2">
            <Button size="lg" onClick={save} loading={busy}>
              Save
            </Button>
            <Button
              size="lg"
              variant="danger"
              onClick={remove}
              disabled={busy || history.length <= 1}
            >
              Delete
            </Button>
          </div>
        ) : (
          <Button size="lg" onClick={save} loading={busy}>
            Add entry
          </Button>
        )
      }
    >
      <div className="space-y-2.5 pt-2">
        <TextInput
          id="bal-amount"
          label={`${isLiability(holding) ? "Outstanding" : "Balance"} (${currency})`}
          inputMode="decimal"
          value={balance}
          onChange={(e) => setBalance(numeric(e.target.value))}
          placeholder={`0${currencyDigits(currency) ? ".00" : ""}`}
          autoFocus
        />
        <TextInput
          id="bal-date"
          label="As of"
          type="date"
          required
          value={day}
          onChange={(e) => e.target.value && setDay(e.target.value)}
        />
      </div>
    </BottomSheet>
  );
}

// ------------------------------------------------------------ holding sheet

function HoldingSheet({ state, holdings, onClose }) {
  const { currency } = useMeta();
  const toast = useToast();
  const confirm = useConfirm();
  const setError = useErrorToast();
  // Live copy, so balance entries added below show up straight away.
  const h = state.holdingId
    ? (holdings.find((x) => x.id === state.holdingId) ?? null)
    : null;

  const [name, setName] = useState(h?.name ?? "");
  const [type, setType] = useState(h?.type ?? "savings");
  const [balance, setBalance] = useState("");
  const [included, setIncluded] = useState(h?.included ?? true);
  const [icon, setIcon] = useState(h?.icon ?? "");
  const [details, setDetails] = useState(h?.details ?? {});
  const fileRef = useRef(null);
  const [panel, setPanel] = useState(false);
  const [busy, setBusy] = useState(false);
  const t = nwType(type);
  const liability = t.group === "liability";

  async function save() {
    setError(null);
    const parsed = balance.trim() === "" ? 0 : Number(balance);
    if (!name.trim()) return setError("Give it a name.");
    if (!h && !Number.isFinite(parsed))
      return setError("Balance must be a number.");
    setBusy(true);
    try {
      const body = { name, type, included, icon, details };
      if (!h) body.balance = toMinor(parsed, currency);
      await apiFetch(h ? `/api/networth/${h.id}` : "/api/networth", {
        method: h ? "PATCH" : "POST",
        body,
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
        title: "Delete this instrument?",
        message: `"${h.name}" and its balance entries will be removed. You can undo this right after.`,
      }))
    )
      return;
    setBusy(true);
    try {
      await apiFetch(`/api/networth/${h.id}`, { method: "DELETE" });
      invalidateAll();
      onClose();
      toast.show({
        message: `${h.name} deleted`,
        actionLabel: "Undo",
        onAction: async () => {
          await apiFetch(`/api/networth/${h.id}`, {
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
      title={h ? "Edit instrument" : "New instrument"}
      footer={
        <div className="space-y-2">
          {panel && (
            <OptionPanel
              title="Type"
              options={TYPE_OPTIONS}
              value={type}
              onPick={(v) => {
                if (v) setType(v);
                setPanel(false);
              }}
              onClose={() => setPanel(false)}
            />
          )}
          {h ? (
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
              Add
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-2.5 pt-2">
        <PickerField
          label="Type"
          value={t.label}
          leading={<CategoryIcon icon={t.icon} size={20} />}
          active={panel}
          onClick={() => setPanel((p) => !p)}
        />
        <div>
          <span className="mb-0.5 block text-[0.8125rem] font-medium text-label-2">
            Icon
          </span>
          <div className="flex items-center gap-3">
            {icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={icon}
                alt=""
                className="size-14 rounded-pill bg-fill object-cover"
              />
            ) : (
              <CategoryBadge
                icon={t.icon}
                color={nwGroup(t.group).color}
                size="lg"
              />
            )}
            <Button variant="tinted" onClick={() => fileRef.current?.click()}>
              {icon ? "Change image" : "Choose image"}
            </Button>
            {icon && (
              <Button variant="plain" onClick={() => setIcon("")}>
                Remove
              </Button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                try {
                  setIcon(await fileToIcon(f));
                } catch (err) {
                  setError(err.message);
                }
              }}
            />
          </div>
        </div>
        <TextInput
          id="nw-name"
          label="Name"
          value={name}
          maxLength={60}
          onFocus={() => setPanel(false)}
          onChange={(e) => setName(e.target.value)}
          placeholder={
            liability
              ? "e.g. HDFC credit card"
              : "e.g. SBI savings, Nifty 50 fund"
          }
        />
        {!h && (
          <TextInput
            id="nw-balance"
            label={`${liability ? "Outstanding" : "Current balance"} (${currency})`}
            inputMode="decimal"
            value={balance}
            onFocus={() => setPanel(false)}
            onChange={(e) => setBalance(numeric(e.target.value))}
            placeholder={`0${currencyDigits(currency) ? ".00" : ""}`}
          />
        )}
        <ListGroup className="!mt-4 !mb-0">
          <ListRow
            role="switch"
            aria-checked={included}
            onClick={() => setIncluded((v) => !v)}
            title="Count in net worth"
            subtitle={
              included
                ? "Included in your total"
                : "Tracked only, not in your total"
            }
            trailing={<Switch on={included} />}
          />
        </ListGroup>
        <DetailFields
          type={type}
          values={details}
          onChange={(k, v) => setDetails((d) => ({ ...d, [k]: v }))}
          onFocus={() => setPanel(false)}
        />
      </div>
    </BottomSheet>
  );
}

// ----------------------------------------------------------- balance sheet

/** An instrument's balance entries. Editing the instrument itself is separate. */
function BalanceSheet({ state, holdings, onClose, onEdit }) {
  const { currency } = useMeta();
  const h = holdings.find((x) => x.id === state.holdingId) ?? null;
  const [entry, setEntry] = useState({ open: false, index: null, n: 0 });
  const [showDetails, setShowDetails] = useState(false);

  // Keep the last instrument while the sheet animates closed.
  const [last, setLast] = useState(h);
  if (h && h !== last) setLast(h);
  const holding = h ?? last;
  if (!holding) return null;

  const type = nwType(holding.type);
  const group = nwGroup(type.group);
  const liability = type.group === "liability";
  const openEntry = (index = null) =>
    setEntry((s) => ({ open: true, index, n: s.n + 1 }));
  const entries = (holding.history ?? [])
    .map((e, i) => ({ ...e, i }))
    .reverse();
  const latest = entries[0];
  const detailRows = nwFields(holding.type)
    .filter((f) => holding.details?.[f.key])
    .map((f) => ({
      key: f.key,
      label: f.label,
      value:
        f.type === "date"
          ? shortDate(`${holding.details[f.key]}T12:00:00`)
          : holding.details[f.key],
    }));

  return (
    <BottomSheet
      open={state.open && Boolean(h)}
      onClose={onClose}
      title={holding.name}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button size="lg" variant="tinted" onClick={() => onEdit(holding.id)}>
            Edit instrument
          </Button>
          <Button size="lg" onClick={() => openEntry()}>
            Add entry
          </Button>
        </div>
      }
    >
      <div className="flex flex-col items-center pt-2 pb-4 text-center">
        <HoldingBadge h={holding} type={type} color={group.color} />
        <span
          className={cx(
            "mt-2 rounded-pill px-2 py-0.5 text-[0.75rem] font-semibold",
            TYPE_BADGE[group.id],
          )}
        >
          {type.label}
        </span>
        <p className="mt-3 text-[0.8125rem] font-medium tracking-wide text-label-2 uppercase">
          {liability ? "Outstanding" : "Current balance"}
        </p>
        <p className="tabular text-[2.25rem] leading-tight font-bold tracking-tight">
          {formatMoney(holding.balance, currency)}
        </p>
        {latest && (
          <p className="text-[0.8125rem] text-label-2">
            (<AsOn iso={latest.at} />)
          </p>
        )}
      </div>

      {detailRows.length > 0 && (
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          aria-expanded={showDetails}
          className="mb-2 w-full px-4 py-2.5 text-center text-[0.9375rem] font-medium text-accent"
        >
          {showDetails ? "Hide details" : "Show details"}
        </button>
      )}

      {showDetails && detailRows.length > 0 && (
        <ListGroup header="Details" className="mb-2">
          {detailRows.map((r) => (
            <div
              key={r.key}
              className="flex items-baseline justify-between gap-4 px-4 py-2.5"
            >
              <span className="shrink-0 text-[0.9375rem] text-label-2">
                {r.label}
              </span>
              <span className="min-w-0 text-right text-[0.9375rem] break-words">
                {r.value}
              </span>
            </div>
          ))}
        </ListGroup>
      )}

      <ListGroup header="Balance entries" className="mb-2">
        {entries.map((e, k) => {
          const prev = entries[k + 1];
          const diff = prev ? e.balance - prev.balance : 0;
          const good = liability ? diff < 0 : diff > 0;
          return (
            <ListRow
              key={e.i}
              onClick={() => openEntry(e.i)}
              title={shortDate(e.at)}
              subtitle={k === 0 ? "Latest" : undefined}
              trailing={
                <span className="text-right">
                  <span className="tabular block font-semibold">
                    {formatMoney(e.balance, currency)}
                  </span>
                  {diff !== 0 && (
                    <span
                      className={cx(
                        "tabular block text-[0.75rem] font-medium",
                        good ? "text-income" : "text-expense",
                      )}
                    >
                      {diff > 0 ? "▲" : "▼"}{" "}
                      {formatMoney(Math.abs(diff), currency)}
                    </span>
                  )}
                </span>
              }
            />
          );
        })}
      </ListGroup>

      <BalanceEntrySheet
        key={entry.n}
        state={entry}
        holding={holding}
        onClose={() => setEntry((s) => ({ ...s, open: false }))}
      />
    </BottomSheet>
  );
}

// ------------------------------------------------------------------- screen

function Summary({ holdings, lending }) {
  const { currency } = useMeta();
  const { assets, liabilities, net } = netWorthTotals(holdings, lending);
  return (
    <Card className="mb-5 p-5">
      <p className="text-[0.8125rem] font-medium tracking-wide text-label-2 uppercase">
        Net worth
      </p>
      <p
        className={cx(
          "tabular text-[clamp(1.75rem,9vw,2.5rem)] leading-tight font-bold tracking-tight",
          net < 0 && "text-expense",
        )}
      >
        {formatMoney(net, currency)}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-separator pt-3">
        <div className="min-w-0">
          <p className="text-[0.8125rem] text-label-2">Assets</p>
          <p className="tabular font-semibold text-income">
            {formatMoney(assets, currency)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[0.8125rem] text-label-2">Liabilities</p>
          <p className="tabular font-semibold text-expense">
            {formatMoney(liabilities, currency)}
          </p>
        </div>
      </div>
    </Card>
  );
}

function HoldingRow({ h, onClick }) {
  const { currency } = useMeta();
  const type = nwType(h.type);
  const group = nwGroup(type.group);
  const { at } = lastChange(h);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex min-h-[4rem] w-full items-start gap-3 px-4 py-3 text-left active:bg-fill lg:items-center",
        !h.included && "opacity-60",
      )}
    >
      <HoldingBadge h={h} type={type} color={group.color} />
      {/* Phone: stacked. Large screens: one line (name, type, balance). */}
      <span className="min-w-0 flex-1 lg:grid lg:grid-cols-[1fr_14rem] lg:gap-x-4">
        <span className="block text-[1.0625rem] leading-snug break-words lg:col-start-1 lg:min-w-0">
          {h.name}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5 lg:col-start-1">
          <span
            className={cx(
              "rounded-pill px-2 py-0.5 text-[0.75rem] font-semibold",
              TYPE_BADGE[group.id],
            )}
          >
            {type.label}
          </span>
          {!h.included && (
            <span className="rounded-pill bg-fill px-2 py-0.5 text-[0.75rem] font-semibold text-label-2">
              Not counted
            </span>
          )}
        </span>
        <span className="mt-1.5 block lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0 lg:self-center lg:text-right">
          <span className="tabular text-[1.0625rem] font-semibold">
            {formatMoney(h.balance, currency)}
          </span>
          {at && (
            <span className="text-[0.8125rem] text-label-2 lg:block">
              {" "}
              (<AsOn iso={at} />)
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

export function NetWorthScreen() {
  const { currency } = useMeta();
  const q = useQuery("/api/networth");
  const [sheet, setSheet] = useState({ open: false, holdingId: null, n: 0 });
  const [bal, setBal] = useState({ open: false, holdingId: null });

  // Which sections are folded. Remembered per device; never required.
  const [folded, setFolded] = useState({});
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("nw-folded") ?? "{}");
      // localStorage is only readable after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFolded(saved && typeof saved === "object" ? saved : {});
    } catch {}
  }, []);
  const toggleFold = (key) =>
    setFolded((f) => {
      const next = { ...f, [key]: !f[key] };
      try {
        localStorage.setItem("nw-folded", JSON.stringify(next));
      } catch {}
      return next;
    });

  const open = (holdingId = null) =>
    setSheet((s) => ({ open: true, holdingId, n: s.n + 1 }));
  const close = () => setSheet((s) => ({ ...s, open: false }));

  // The app's add button (tab bar "+" / sidebar) asks this page to add one.
  useEffect(() => {
    const onAdd = () =>
      setSheet((s) => ({ open: true, holdingId: null, n: s.n + 1 }));
    window.addEventListener("networth:add", onAdd);
    return () => window.removeEventListener("networth:add", onAdd);
  }, []);

  const holdings = useMemo(() => q.data?.holdings ?? [], [q.data]);
  const lendingIncluded = q.data?.lendingIncluded ?? true;
  const rawLending = q.data?.lending ?? { owed: 0, owe: 0 };
  // When switched off, the ledger stays visible but adds nothing to the total.
  const lending = lendingIncluded ? rawLending : { owed: 0, owe: 0 };
  const toast = useToast();
  async function toggleLending() {
    try {
      await apiFetch("/api/networth/lending", {
        method: "POST",
        body: { included: !lendingIncluded },
      });
      invalidateAll();
    } catch (e) {
      toast.show({ message: e.message });
    }
  }
  const { data: session } = authClient.useSession();
  const [pdfBusy, setPdfBusy] = useState(false);
  async function downloadPdf() {
    setPdfBusy(true);
    try {
      // People balances come from the lending ledger (same rule as that page).
      const { entries } = await apiFetch("/api/lending");
      const byPerson = new Map();
      for (const e of entries) {
        const key = e.person.trim().toLowerCase().replace(/\s+/g, " ");
        const p = byPerson.get(key) ?? { person: e.person, balance: 0 };
        p.balance += e.kind === "lent" ? e.amount : -e.amount;
        byPerson.set(key, p);
      }
      const { downloadNetWorthPdf } = await import("@/lib/client/networth-pdf");
      await downloadNetWorthPdf({
        holdings,
        lending: rawLending,
        lendingIncluded,
        people: [...byPerson.values()],
        currency,
        user: session?.user,
      });
    } catch (e) {
      toast.show({ message: e.message || "Couldn't create the PDF." });
    } finally {
      setPdfBusy(false);
    }
  }
  const lendingNet = rawLending.owed - rawLending.owe;
  const hasLending = rawLending.owed > 0 || rawLending.owe > 0;

  return (
    <div>
      <div className="flex items-center justify-between">
        <Link
          href="/more"
          className="-ml-2 inline-flex min-h-tap items-center text-accent"
        >
          <ChevronLeftIcon /> More
        </Link>
        {holdings.length > 0 && (
          <Button
            variant="plain"
            onClick={downloadPdf}
            loading={pdfBusy}
            aria-label="Download PDF summary"
          >
            <Download size={18} aria-hidden /> PDF
          </Button>
        )}
      </div>
      <h1 className="sr-only">Net worth</h1>

      {q.loading ? (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      ) : q.error && !q.data ? (
        <ErrorState message={q.error.message} onRetry={q.retry} />
      ) : holdings.length === 0 ? (
        <EmptyState
          icon="trending-up"
          title="Know your net worth"
          message="Add your bank accounts, wallets, investments (FD, mutual funds, shares, NPS, PPF, EPF) and loans or credit cards. Tap any one to log its balance over time."
          actionLabel="Add first instrument"
          onAction={() => open()}
        />
      ) : (
        <>
          <Summary holdings={holdings} lending={lending} />

          {NW_GROUPS.map((g) => {
            const rows = holdings.filter((h) => nwType(h.type).group === g.id);
            if (rows.length === 0) return null;
            const total = rows
              .filter((h) => h.included)
              .reduce((n, h) => n + h.balance, 0);
            return (
              <ListGroup
                key={g.id}
                header={g.label}
                headerRight={
                  <span
                    className={
                      g.kind === "asset" ? "text-income" : "text-expense"
                    }
                  >
                    {g.kind === "asset" ? "+" : "−"}
                    {formatMoney(total, currency)}
                  </span>
                }
                collapsed={Boolean(folded[g.id])}
                onToggle={() => toggleFold(g.id)}
              >
                {rows.map((h) => (
                  <HoldingRow
                    key={h.id}
                    h={h}
                    onClick={() => setBal({ open: true, holdingId: h.id })}
                  />
                ))}
              </ListGroup>
            );
          })}

          {hasLending && (
            <ListGroup
              header="From Track Lending"
              headerRight={
                <span
                  className={cx(
                    !lendingIncluded
                      ? "text-label-2"
                      : lendingNet > 0
                        ? "text-income"
                        : lendingNet < 0
                          ? "text-expense"
                          : "",
                  )}
                >
                  {lendingNet > 0 ? "+" : lendingNet < 0 ? "−" : ""}
                  {formatMoney(Math.abs(lendingNet), currency)}
                </span>
              }
              collapsed={Boolean(folded.lending)}
              onToggle={() => toggleFold("lending")}
              footer={
                lendingIncluded
                  ? "Counted automatically from your lending ledger."
                  : "Not counted in your net worth."
              }
            >
              <ListRow
                role="switch"
                aria-checked={lendingIncluded}
                onClick={toggleLending}
                title="Count in net worth"
                trailing={<Switch on={lendingIncluded} />}
              />
              <div
                className={cx(
                  "[&>*:not(:first-child)]:border-t [&>*:not(:first-child)]:border-separator",
                  !lendingIncluded && "opacity-50",
                )}
              >
                {rawLending.owed > 0 && (
                  <ListRow
                    leading={<CategoryBadge icon="hand-coins" color="green" />}
                    title="Owed to you"
                    trailing={
                      <span className="tabular font-semibold text-income">
                        {formatMoney(rawLending.owed, currency)}
                      </span>
                    }
                  />
                )}
                {rawLending.owe > 0 && (
                  <ListRow
                    leading={<CategoryBadge icon="hand-coins" color="red" />}
                    title="You owe"
                    trailing={
                      <span className="tabular font-semibold text-expense">
                        {formatMoney(rawLending.owe, currency)}
                      </span>
                    }
                  />
                )}
              </div>
              <Link
                href="/more/lending"
                className="flex min-h-tap items-center justify-between px-4 text-accent"
              >
                Open Track Lending <ChevronRightIcon width="18" height="18" />
              </Link>
            </ListGroup>
          )}
        </>
      )}

      <BalanceSheet
        state={bal}
        holdings={holdings}
        onClose={() => setBal((b) => ({ ...b, open: false }))}
        onEdit={(id) => open(id)}
      />
      <HoldingSheet
        key={`h${sheet.n}`}
        state={sheet}
        holdings={holdings}
        onClose={close}
      />
    </div>
  );
}
