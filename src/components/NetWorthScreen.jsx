"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
  Check,
  ChevronDown,
  Download,
  GripVertical,
  Link2,
  Trash2,
} from "lucide-react";
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
import { cardLogoIcon, cardLogoUrl, fileToIcon } from "@/lib/client/image";
import { authClient } from "@/lib/auth-client";
import { currencyDigits, formatMoney, fromMinor, toMinor } from "@/lib/money";
import {
  CARD_NETWORKS,
  cardEmis,
  cardInfo,
  fdMaturity,
  fdPrincipal,
  fdValueNow,
  rowOptions,
  emiError,
  noInterestEmi,
  emiSchedule,
  emiState,
  holdingValue,
  MAX_EMIS,
  MAX_TENURE,
  cardGroupIds,
  cardIssuer,
  badgeIconFor,
  fdBackers,
  issuerIconFor,
  platformIconFor,
  withLinkedCards,
  NW_TYPES,
  formatDetailValue,
  netWorthTotals,
  MAX_DETAIL_ROWS,
  defaultDetailRows,
  detailRows,
  nwGroup,
  nwType,
} from "@/lib/networth";
import { cx } from "@/lib/cx";
import { ProgressBar } from "@/components/charts";

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
    at: h.autoBalance ? new Date().toISOString() : (last?.at ?? h.updatedAt),
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

/** The instrument's own logo if it has one, else its type icon. A card's
 * issuer logo rides on the corner as a small badge. */
function HoldingBadge({ h, type, color, issuer }) {
  const main = !h.icon ? (
    <CategoryBadge icon={type.icon} color={color} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={h.icon}
      alt=""
      className="size-10 shrink-0 rounded-pill bg-fill object-cover"
    />
  );
  if (!issuer) return main;
  return (
    <span className="relative inline-flex shrink-0">
      {main}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={issuer}
        alt="Issuer"
        className="absolute -right-1 -bottom-1 size-5 rounded-pill bg-white object-cover ring-2 ring-surface"
      />
    </span>
  );
}

let rowSeq = 0;
const newRow = (label = "", value = "", kind) => ({
  id: ++rowSeq,
  label,
  value,
  ...(kind && { kind }),
});
const toEditRows = (rows) => rows.map((r) => newRow(r.label, r.value, r.kind));

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));
const FIELD_CLASS =
  "mt-0.5 min-h-tap w-full rounded-control bg-fill px-3 text-base outline-none placeholder:text-label-2 focus:bg-accent-soft";

/** The value input of a detail row, by its kind. */
/** A small round logo for an account in a picker: its own icon, else its type's. */
function AccountLogo({ h }) {
  return h.icon ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={h.icon}
      alt=""
      className="size-7 shrink-0 rounded-pill bg-fill object-cover"
    />
  ) : (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-pill bg-fill text-label-2">
      <CategoryIcon icon={nwType(h.type).icon} size={16} />
    </span>
  );
}

function DetailValue({
  row,
  onUpdate,
  onFocus,
  active,
  onOpen,
  cards,
  accounts,
  fds,
}) {
  const common = {
    "aria-label": row.label || "Value",
    value: row.value,
    onFocus,
    className: FIELD_CLASS,
  };
  const set = (value) => onUpdate({ value });
  switch (row.kind) {
    case "date": {
      // Older free-text dates stay editable as text.
      const iso = !row.value || /^\d{4}-\d{2}-\d{2}$/.test(row.value);
      return (
        <input
          {...common}
          type={iso ? "date" : "text"}
          maxLength={iso ? undefined : 200}
          autoComplete="off"
          placeholder={iso ? undefined : "Value"}
          onChange={(e) => set(e.target.value)}
        />
      );
    }
    case "rate":
      return (
        <div className="relative">
          <input
            {...common}
            inputMode="decimal"
            maxLength={6}
            autoComplete="off"
            placeholder="e.g. 7.25"
            className={cx(FIELD_CLASS, "pr-16")}
            onChange={(e) => {
              const v = numeric(e.target.value).replace(/-/g, "");
              if (v === "" || (Number(v) <= 100 && /^\d*\.?\d{0,2}$/.test(v)))
                set(v);
            }}
          />
          <span className="pointer-events-none absolute top-1/2 right-3 mt-0.25 -translate-y-1/2 text-[0.8125rem] text-label-2">
            % p.a.
          </span>
        </div>
      );
    case "network":
    case "day":
    case "expiry":
    case "choice":
    case "account":
    case "linkcard":
    case "fdlink": {
      const shown =
        row.kind === "account"
          ? (accounts.find((a) => a.id === row.value)?.name ?? "")
          : row.kind === "linkcard" || row.kind === "fdlink"
            ? row.value
                .split(",")
                .map(
                  (id) =>
                    (row.kind === "fdlink" ? fds : cards).find(
                      (c) => c.id === id,
                    )?.name,
                )
                .filter(Boolean)
                .join(", ")
            : row.value;
      return (
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={active}
          aria-label={`${row.label}: ${shown || "Select"}`}
          onClick={onOpen}
          className={cx(
            FIELD_CLASS,
            "flex items-center gap-2 text-left transition-colors",
            active && "bg-accent-soft",
          )}
        >
          {row.kind === "account" &&
            accounts.find((a) => a.id === row.value) && (
              <AccountLogo h={accounts.find((a) => a.id === row.value)} />
            )}
          {row.kind === "network" && row.value && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cardLogoUrl(row.value)}
              alt=""
              className="size-6 rounded-pill"
            />
          )}
          <span className={cx("flex-1 truncate", !shown && "text-label-2")}>
            {shown ||
              (row.kind === "linkcard"
                ? "Not shared"
                : row.kind === "fdlink"
                  ? "No FD linked"
                  : row.kind === "account"
                    ? "Select account"
                    : "Select")}
          </span>
          <ChevronDown
            size={18}
            className={cx("shrink-0 text-label-2", active && "rotate-180")}
          />
        </button>
      );
    }
    case "days":
      return (
        <input
          {...common}
          inputMode="numeric"
          maxLength={3}
          autoComplete="off"
          placeholder="e.g. 20"
          onChange={(e) => set(e.target.value.replace(/\D/g, "").slice(0, 3))}
        />
      );
    case "digits":
      return (
        <input
          {...common}
          inputMode="numeric"
          maxLength={4}
          autoComplete="off"
          placeholder="1234"
          onChange={(e) => set(e.target.value.replace(/\D/g, "").slice(0, 4))}
        />
      );
    case "amount":
      return (
        <input
          {...common}
          inputMode="decimal"
          maxLength={20}
          autoComplete="off"
          placeholder="0"
          onChange={(e) => set(e.target.value.replace(/[^0-9.]/g, ""))}
        />
      );
    default:
      return (
        <input
          {...common}
          maxLength={200}
          autoComplete="off"
          placeholder="Value"
          onChange={(e) => set(e.target.value)}
        />
      );
  }
}

function DetailRow({
  row,
  onUpdate,
  onRemove,
  onFocus,
  active,
  onOpen,
  cards,
  accounts,
  fds,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(
          transform && { ...transform, x: 0 }, // vertical only
        ),
        transition,
      }}
      className={cx(
        "relative flex items-center gap-1 rounded-control bg-surface p-1.5 ring-1 ring-separator",
        isDragging && "z-10 shadow-2xl ring-accent",
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder ${row.label || "detail"}`}
        className="flex min-h-tap w-8 shrink-0 cursor-grab touch-none items-center justify-center text-label-2 select-none active:cursor-grabbing"
      >
        <GripVertical size={18} />
      </button>
      <div className="min-w-0 flex-1">
        <input
          aria-label="Label"
          value={row.label}
          maxLength={60}
          placeholder="Label"
          autoComplete="off"
          onFocus={onFocus}
          onChange={(e) => onUpdate({ label: e.target.value.toUpperCase() })}
          className="w-full bg-transparent px-1 text-[0.8125rem] font-medium text-label-2 outline-none placeholder:text-label-2"
        />
        <DetailValue
          row={row}
          onUpdate={onUpdate}
          onFocus={onFocus}
          active={active}
          onOpen={onOpen}
          cards={cards}
          accounts={accounts}
          fds={fds}
        />
      </div>
      <button
        type="button"
        aria-label={`Remove ${row.label || "detail"}`}
        onClick={onRemove}
        className="flex min-h-tap w-9 shrink-0 items-center justify-center rounded-pill text-danger active:bg-fill"
      >
        <Trash2 size={17} />
      </button>
    </div>
  );
}

/** Free-form details: rename, remove and drag the grip to reorder. */
function DetailFields({
  type,
  rows,
  onChange,
  onFocus,
  activeRow,
  onOpenRow,
  cards,
  accounts,
  fds,
}) {
  // A few px (mouse) or a short press (touch) before a drag starts, so taps
  // and scrolls never move rows by accident.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const update = (id, patch) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  // Default labels back in their original order, keeping anything already
  // typed; your own extra rows follow after them.
  function restoreDefaults() {
    const norm = (t) => t.trim().toLowerCase();
    const defaults = defaultDetailRows(type);
    const taken = new Set();
    const restored = defaults.map((d) => {
      const own = rows.find(
        (r) => !taken.has(r.id) && norm(r.label) === norm(d.label),
      );
      if (own) taken.add(own.id);
      return own ? { ...own, kind: d.kind } : newRow(d.label, "", d.kind);
    });
    onChange([...restored, ...rows.filter((r) => !taken.has(r.id))]);
  }

  function onDragEnd({ active, over }) {
    if (!over || active.id === over.id) return;
    const from = rows.findIndex((r) => r.id === active.id);
    const to = rows.findIndex((r) => r.id === over.id);
    onChange(arrayMove(rows, from, to));
  }

  return (
    <div className="space-y-2.5 pt-2">
      <div className="flex items-center justify-between pt-2">
        <h3 className="text-[0.8125rem] font-medium tracking-wide text-label-2 uppercase">
          Details
        </h3>
        {defaultDetailRows(type).length > 0 && (
          <button
            type="button"
            onClick={restoreDefaults}
            className="text-[0.8125rem] font-medium text-accent"
          >
            Restore defaults
          </button>
        )}
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={rows.map((r) => r.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2.5">
            {rows.map((r) => (
              <DetailRow
                key={r.id}
                row={r}
                onUpdate={(patch) => update(r.id, patch)}
                onRemove={() => onChange(rows.filter((x) => x.id !== r.id))}
                onFocus={onFocus}
                active={activeRow === r.id}
                onOpen={() => onOpenRow(r.id)}
                cards={cards}
                accounts={accounts}
                fds={fds}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {rows.length < MAX_DETAIL_ROWS && (
        <Button
          variant="tinted"
          type="button"
          onClick={() => onChange([...rows, newRow()])}
        >
          + Add detail
        </Button>
      )}
    </div>
  );
}

const ISSUER_LABEL =
  /bank|platform|broker|issuer|lender|insurer|employer|scheme|exchange|amc|custodian/i;

const NUMBER_LABEL =
  /account|card|policy|demat|pran|uan|folio|number|digit|id\b/i;
const NOT_NUMBER = /cus|cif|ifsc|nominee|branch|bank|name/i;

/** e.g. "ICICI BANK - 7877": provider plus the last 4 digits of its number. */
function suggestName(type, rows) {
  const row = rows.find((r) => r.value.trim() && ISSUER_LABEL.test(r.label));
  if (!row) return "";
  const who = row.value.trim();
  const num = rows.find(
    (r) =>
      r !== row &&
      NUMBER_LABEL.test(r.label) &&
      !NOT_NUMBER.test(r.label) &&
      r.value.replace(/\D/g, "").length > 0,
  );
  const variant = rows
    .find((r) => /variant/i.test(r.label) && r.value.trim())
    ?.value.trim();
  const head = variant ? `${who} ${variant}` : who;
  if (num) return `${head} - ${num.value.replace(/\D/g, "").slice(-4)}`;
  if (variant) return head;
  const kind = nwType(type).label.replace(/ account$/i, "");
  return who.toLowerCase().includes(kind.toLowerCase())
    ? who
    : `${who} ${kind}`;
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

const MONTHS = Array.from({ length: 12 }, (_, i) =>
  String(i + 1).padStart(2, "0"),
);

/** Pick any number of other cards to share a limit with; stays open. */
function LinkPanel({ title, cards, selected, emptyText, onToggle, onClose }) {
  return (
    <div className="pb-1">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <h3 className="text-[0.8125rem] font-semibold tracking-wide text-label-2 uppercase">
          {title}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="min-h-tap px-2 font-semibold text-accent"
        >
          Done
        </button>
      </div>
      <ul
        role="listbox"
        aria-multiselectable="true"
        aria-label={title}
        className="h-[14rem] space-y-1 overflow-y-auto overscroll-contain rounded-control bg-fill/60 p-2"
      >
        {cards.length === 0 && (
          <li className="px-3 py-6 text-center text-label-2">
            {emptyText ?? "No other credit cards yet."}
          </li>
        )}
        {cards.map((c) => {
          const on = selected.includes(c.id);
          return (
            <li key={c.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => onToggle(c.id)}
                className={cx(
                  "flex min-h-tap w-full items-center gap-3 rounded-control px-4 py-1 text-left active:bg-fill",
                  on && "bg-accent-soft text-accent",
                )}
              >
                <span className="flex-1 truncate">{c.name}</span>
                {on ? <Check aria-hidden size={18} strokeWidth={2.6} /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Bottom panel for a detail row: network, day of month, or expiry. */
function RowPicker({
  row,
  type,
  cards,
  accounts,
  fds,
  emptyText,
  onPick,
  onToggle,
  onClose,
}) {
  if (row.kind === "choice") {
    return (
      <OptionPanel
        title={row.label}
        options={rowOptions(type, row).map((o) => ({ id: o, label: o }))}
        value={row.value}
        onPick={onPick}
        onClose={onClose}
      />
    );
  }
  if (row.kind === "account") {
    return (
      <OptionPanel
        title={row.label}
        options={accounts.map((a) => ({
          id: a.id,
          label: a.name,
          leading: <AccountLogo h={a} />,
        }))}
        value={row.value || null}
        clearLabel="None"
        onPick={onPick}
        onClose={onClose}
      />
    );
  }
  if (row.kind === "fdlink") {
    return (
      <LinkPanel
        title={row.label}
        cards={fds}
        selected={row.value.split(",").filter(Boolean)}
        emptyText="No fixed deposits to link. An FD can back one card at a time."
        onToggle={onToggle}
        onClose={onClose}
      />
    );
  }
  if (row.kind === "linkcard") {
    return (
      <LinkPanel
        title={row.label}
        cards={cards}
        selected={row.value.split(",").filter(Boolean)}
        emptyText={emptyText}
        onToggle={onToggle}
        onClose={onClose}
      />
    );
  }
  if (row.kind === "expiry") {
    return <ExpiryPanel value={row.value} onPick={onPick} onClose={onClose} />;
  }
  if (row.kind === "day") {
    return (
      <OptionPanel
        title={row.label}
        options={DAYS.map((d) => ({ id: d, label: d }))}
        value={row.value}
        onPick={onPick}
        onClose={onClose}
      />
    );
  }
  return (
    <OptionPanel
      title={row.label}
      options={CARD_NETWORKS.map((n) => ({
        id: n,
        label: n,
        leading: (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cardLogoUrl(n)} alt="" className="size-7 rounded-pill" />
        ),
      }))}
      value={row.value}
      onPick={onPick}
      onClose={onClose}
    />
  );
}

/** Month and year lists side by side; the value is saved as MM/YY. */
function ExpiryPanel({ value, onPick, onClose }) {
  const [m0, y0] = /^\d{2}\/\d{2}$/.test(value) ? value.split("/") : ["", ""];
  const [month, setMonth] = useState(m0);
  const [year, setYear] = useState(y0);
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 21 }, (_, i) =>
    String((thisYear - 1 + i) % 100).padStart(2, "0"),
  );
  const pick = (m, y) => {
    setMonth(m);
    setYear(y);
    if (m && y) onPick(`${m}/${y}`);
  };
  const col = (items, cur, onSel, label) => (
    <ul
      role="listbox"
      aria-label={label}
      className="h-[15.5rem] flex-1 overflow-y-auto overscroll-contain rounded-control bg-fill/60 p-1"
    >
      {items.map((v) => (
        <li key={v} role="presentation">
          <button
            type="button"
            role="option"
            aria-selected={v === cur}
            onClick={() => onSel(v)}
            className={cx(
              "flex min-h-tap w-full items-center rounded-control px-3 text-left active:bg-fill",
              v === cur && "bg-accent-soft text-accent",
            )}
          >
            {label === "Year" ? `20${v}` : v}
          </button>
        </li>
      ))}
    </ul>
  );
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-[0.8125rem] font-semibold tracking-wide text-label-2 uppercase">
          Expiry
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="min-h-tap px-2 font-semibold text-accent"
        >
          Close
        </button>
      </div>
      <div className="flex gap-2">
        {col(MONTHS, month, (m) => pick(m, year), "Month")}
        {col(years, year, (y) => pick(month, y), "Year")}
      </div>
    </div>
  );
}

/** Logo field: tap + paste, Upload or Paste. Shows `fallback` until one is set. */
function IconPicker({ label, value, onChange, onError, onOpen, fallback }) {
  const fileRef = useRef(null);
  const apply = async (file) => {
    try {
      onChange(await fileToIcon(file));
    } catch (err) {
      onError(err.message);
    }
  };
  async function pasteFromClipboard() {
    onOpen?.();
    try {
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find((x) => x.startsWith("image/"));
        if (!type) continue;
        const blob = await item.getType(type);
        return apply(new File([blob], "icon", { type }));
      }
      onError("No image on the clipboard.");
    } catch {
      onError(
        "Couldn't read the clipboard. Tap the icon and press Ctrl/Cmd + V.",
      );
    }
  }
  return (
    <div>
      <span className="mb-0.5 block text-[0.8125rem] font-medium text-label-2">
        {label}
      </span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`${label}: select it, then paste an image`}
          onClick={(e) => e.currentTarget.focus()}
          onPaste={(e) => {
            const file = [...(e.clipboardData?.files ?? [])].find((f) =>
              f.type.startsWith("image/"),
            );
            if (!file) return;
            e.preventDefault();
            onOpen?.();
            apply(file);
          }}
          className="shrink-0 rounded-pill outline-none focus:ring-2 focus:ring-accent"
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt=""
              className="size-12 shrink-0 rounded-pill bg-fill object-cover"
            />
          ) : (
            fallback
          )}
        </button>
        <div
          className={cx(
            "grid min-w-0 flex-1 gap-2",
            value ? "grid-cols-3" : "grid-cols-2",
          )}
        >
          <Button
            variant="tinted"
            onClick={() => {
              onOpen?.();
              fileRef.current?.click();
            }}
          >
            Upload
          </Button>
          <Button variant="tinted" onClick={pasteFromClipboard}>
            Paste
          </Button>
          {value && (
            <Button
              variant="tinted"
              onClick={() => {
                onOpen?.();
                onChange("");
              }}
              aria-label={`Reset ${label.toLowerCase()} to default`}
            >
              Reset
            </Button>
          )}
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) apply(f);
        }}
      />
    </div>
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

  // "Clone": a new instrument that starts as a copy of this one.
  const src =
    !h && state.cloneId
      ? (holdings.find((x) => x.id === state.cloneId) ?? null)
      : null;
  const base = h ?? src;

  const [name, setName] = useState(base?.name ?? "");
  const [type, setType] = useState(base?.type ?? "savings");
  const [balance, setBalance] = useState("");
  const [included, setIncluded] = useState(base?.included ?? true);
  const [icon, setIcon] = useState(base?.icon ?? "");
  const [issuerIcon, setIssuerIcon] = useState(
    base ? issuerIconFor(base, holdings) : "",
  );
  const [platformIcon, setPlatformIcon] = useState(
    base ? platformIconFor(base, holdings) : "",
  );
  const [details, setDetails] = useState(() =>
    toEditRows(
      base
        ? base.details == null
          ? defaultDetailRows(base.type)
          : withLinkedCards(base, holdings).map((r) =>
              src
                ? {
                    ...r,
                    // A copy has its own card number, expiry and links.
                    ...(["digits", "expiry", "linkcard"].includes(r.kind) && {
                      value: "",
                    }),
                  }
                : r,
            )
        : defaultDetailRows("savings"),
    ),
  );
  const [panel, setPanel] = useState(false); // false | "type"
  const [busy, setBusy] = useState(false);
  const t = nwType(type);
  const liability = t.group === "liability";

  const suggestion = suggestName(type, details);
  // Other credit cards this one can share a limit with.
  const otherCards = holdings.filter(
    (x) => x.type === "credit_card" && x.id !== h?.id,
  );
  // Only cards with the same credit limit can share it.
  const formLimit = Number(
    details.find((r) => r.kind !== "linkcard" && /limit/i.test(r.label))?.value,
  );
  const linkedIds =
    details
      .find((r) => r.kind === "linkcard")
      ?.value.split(",")
      .filter(Boolean) ?? [];
  const formIssuer = cardIssuer({ type, details });
  const sameLimit = (c) =>
    formLimit > 0 && cardInfo(c, holdings)?.limit === formLimit;
  const sameIssuer = (c) => formIssuer !== "" && cardIssuer(c) === formIssuer;
  const canLink = (c) => sameLimit(c) && sameIssuer(c);
  // Already-linked cards stay listed so they can be unticked.
  const linkable = otherCards.filter(
    (c) => canLink(c) || linkedIds.includes(c.id),
  );
  // Savings and current accounts an FD can pay into at maturity.
  const accounts = holdings.filter(
    (x) => (x.type === "savings" || x.type === "current") && x.id !== h?.id,
  );

  // An FD's maturity amount follows the figures it depends on, until it is
  // typed over (clearing it brings the calculated value back).
  const rowVal = (re, kind) =>
    details.find((r) => (kind ? r.kind === kind : re.test(r.label)))?.value ??
    "";
  // The deposit amount typed in; else what the instrument was opened with.
  const depositTyped = toMinor(
    Number(rowVal(/deposit amount/i)) || 0,
    currency,
  );
  const principalMinor =
    depositTyped > 0
      ? depositTyped
      : h
        ? (h.history?.find((e) => e.balance > 0)?.balance ??
          h.rawBalance ??
          h.balance)
        : toMinor(Number(balance) || 0, currency);
  const autoMaturity =
    type === "fd"
      ? fdMaturity({
          principal: principalMinor,
          rate: rowVal(null, "rate"),
          deposit: rowVal(/date of deposit|deposit date/i),
          maturity: rowVal(/maturity date/i),
          compounding: rowVal(/compounding/i) || "Quarterly",
        })
      : null;
  const autoText =
    autoMaturity == null ? "" : String(fromMinor(autoMaturity, currency));
  const lastAuto = useRef(autoText);
  useEffect(() => {
    if (type !== "fd") return;
    const row = details.find(
      (r) => r.kind === "amount" && /maturity/i.test(r.label),
    );
    if (!row || row.value === autoText) {
      lastAuto.current = autoText;
      return;
    }
    if (row.value === "" || row.value === lastAuto.current) {
      lastAuto.current = autoText;
      setDetails((rows) =>
        rows.map((r) => (r.id === row.id ? { ...r, value: autoText } : r)),
      );
    }
  }, [autoText, type, details]);

  const panelRow = panel?.row ? details.find((r) => r.id === panel.row) : null;

  function toggleLink(id) {
    const row = panelRow;
    if (!row) return;
    const cur = row.value.split(",").filter(Boolean);
    let next;
    if (cur.includes(id)) next = cur.filter((x) => x !== id);
    else {
      // Joining a card brings along the cards it already shares with.
      const cards = holdings.filter((x) => x.type === "credit_card");
      const card = cards.find((c) => c.id === id);
      const more = card ? cardGroupIds(card, cards) : [];
      next = [...new Set([...cur, id, ...more])].filter((x) => x !== h?.id);
    }
    setDetails((rows) =>
      rows.map((r) => (r.id === row.id ? { ...r, value: next.join(",") } : r)),
    );
  }

  // An FD backs one card at a time; ones backing another card aren't offered.
  const fdOptions = holdings.filter(
    (x) =>
      x.type === "fd" && fdBackers(x.id, holdings).every((c) => c.id === h?.id),
  );
  function toggleFd(id) {
    const row = panelRow;
    if (!row) return;
    const cur = row.value.split(",").filter(Boolean);
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    setDetails((rows) =>
      rows.map((r) => (r.id === row.id ? { ...r, value: next.join(",") } : r)),
    );
  }

  async function pickRow(value) {
    const row = panelRow;
    setPanel(false);
    if (
      !row ||
      (value == null && row.kind !== "linkcard" && row.kind !== "account")
    )
      return;
    setDetails((rows) =>
      rows.map((r) => (r.id === row.id ? { ...r, value: value ?? "" } : r)),
    );
    if (row.kind === "network") {
      try {
        setIcon(await cardLogoIcon(value));
      } catch {}
    }
  }

  async function save() {
    setError(null);
    const parsed = balance.trim() === "" ? 0 : Number(balance);
    if (!name.trim()) return setError("Give it a name.");
    if (!h && !Number.isFinite(parsed))
      return setError("Balance must be a number.");
    const mismatch = linkedIds
      .map((id) => holdings.find((c) => c.id === id))
      .find((c) => c && !canLink(c));
    if (type === "credit_card" && mismatch)
      return setError(
        `${mismatch.name} has a different issuer or credit limit. Only cards from the same issuer with the same limit can share it.`,
      );
    setBusy(true);
    try {
      const body = {
        name,
        type,
        included,
        icon,
        issuerIcon: type === "credit_card" ? issuerIcon : "",
        platformIcon: type === "fd" ? platformIcon : "",
        details: details.map((r) => ({
          label: r.label,
          value: r.value,
          kind: r.kind,
        })),
      };
      // An FD is valued from its deposit details; the deposit amount is also
      // its opening balance entry.
      if (!h)
        body.balance =
          type === "fd"
            ? toMinor(Number(rowVal(/deposit amount/i)) || 0, currency)
            : toMinor(parsed, currency);
      await apiFetch(h ? `/api/networth/${h.id}` : "/api/networth", {
        method: h ? "PATCH" : "POST",
        body,
      });
      // Cards taken out of the group are cut loose from every remaining
      // member (their own list, and the members' lists), so the link is gone
      // from both sides even when they were chained through another card.
      if (h) {
        const cards = holdings.filter((x) => x.type === "credit_card");
        const keep = new Set([h.id, ...linkedIds]);
        const removed = cardGroupIds(h, cards).filter((id) => !keep.has(id));
        const strip = async (id, drop) => {
          const c = cards.find((x) => x.id === id);
          const rows = detailRows(c.type, c.details);
          const row = rows.find((r) => r.kind === "linkcard");
          const ids = row?.value.split(",").filter(Boolean) ?? [];
          if (!ids.some((x) => drop.has(x))) return;
          await apiFetch(`/api/networth/${id}`, {
            method: "PATCH",
            body: {
              details: rows.map((r) =>
                r === row
                  ? { ...r, value: ids.filter((x) => !drop.has(x)).join(",") }
                  : r,
              ),
            },
          });
        };
        for (const r of removed) {
          await strip(r, keep);
          for (const m of linkedIds) await strip(m, new Set([r]));
        }
      }
      invalidateAll();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const backed = h.type === "fd" ? fdBackers(h.id, holdings) : [];
    if (backed.length)
      return setError(
        `This FD backs ${backed.map((c) => c.name).join(", ")}. Delete the card or remove the link first.`,
      );
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
      title={
        h ? "Edit instrument" : src ? "Clone instrument" : "New instrument"
      }
      footer={
        <div className="space-y-2">
          {panel === "type" && (
            <OptionPanel
              title="Type"
              options={TYPE_OPTIONS}
              value={type}
              onPick={(v) => {
                if (v) {
                  setType(v);
                  // Nothing typed yet: swap in the new type's suggested labels.
                  if (details.every((r) => !r.value.trim()))
                    setDetails(toEditRows(defaultDetailRows(v)));
                }
                setPanel(false);
              }}
              onClose={() => setPanel(false)}
            />
          )}
          {panelRow && (
            <RowPicker
              row={panelRow}
              type={type}
              accounts={accounts}
              cards={linkable}
              emptyText={
                formLimit > 0 && formIssuer
                  ? `No other cards from this issuer with a ${formatMoney(toMinor(formLimit, currency), currency)} limit.`
                  : "Enter this card's issuer and credit limit first. Only cards from the same issuer with the same limit can be linked."
              }
              fds={fdOptions}
              onToggle={panelRow.kind === "fdlink" ? toggleFd : toggleLink}
              onPick={pickRow}
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
          active={panel === "type"}
          onClick={() => setPanel((p) => (p === "type" ? false : "type"))}
        />
        <IconPicker
          label="Icon"
          value={icon}
          onChange={setIcon}
          onError={setError}
          onOpen={() => setPanel(false)}
          fallback={
            <CategoryBadge
              icon={t.icon}
              color={nwGroup(t.group).color}
              size="lg"
            />
          }
        />
        {type === "credit_card" && (
          <IconPicker
            label="Issuer logo"
            value={issuerIcon}
            onChange={setIssuerIcon}
            onError={setError}
            onOpen={() => setPanel(false)}
            fallback={
              <CategoryBadge
                icon={t.icon}
                color={nwGroup(t.group).color}
                size="lg"
              />
            }
          />
        )}
        {type === "fd" && (
          <IconPicker
            label="Platform logo"
            value={platformIcon}
            onChange={setPlatformIcon}
            onError={setError}
            onOpen={() => setPanel(false)}
            fallback={
              <CategoryBadge
                icon={t.icon}
                color={nwGroup(t.group).color}
                size="lg"
              />
            }
          />
        )}
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
        {suggestion && suggestion !== name.trim() && (
          <div className="!mt-1.5 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setName(suggestion)}
              className="flex min-h-9 items-center rounded-pill bg-accent-soft px-3 text-[0.875rem] font-medium text-accent"
            >
              {suggestion}
            </button>
          </div>
        )}
        {!h && type !== "fd" && (
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
          rows={details}
          onChange={setDetails}
          onFocus={() => setPanel(false)}
          cards={otherCards}
          accounts={accounts}
          fds={fdOptions}
          activeRow={panel?.row}
          onOpenRow={(id) =>
            setPanel((p) => (p?.row === id ? false : { row: id }))
          }
        />
      </div>
    </BottomSheet>
  );
}

// ----------------------------------------------------------------- card EMIs

/** A card's EMIs / loans: open ones with a way to add more, finished ones below. */
function EmiList({ holding, currency, onOpen }) {
  const { list, monthly } = cardEmis(holding);
  const open = list.filter((e) => e.active);
  const closed = list.filter((e) => !e.active);
  const [closedOpen, setClosedOpen] = useState(false);
  return (
    <>
      <ListGroup
        header="EMIs & loans"
        headerRight={
          monthly > 0 ? `${formatMoney(monthly, currency)}/mo` : null
        }
        className="mb-3"
      >
        {open.map((e) => (
          <ListRow
            key={e.id}
            onClick={() => onOpen(e.id)}
            title={e.name}
            subtitle={`${formatMoney(e.monthly, currency)}/mo · ${e.paid} of ${e.tenure} paid · next ${dayMonth(e.nextAt)}`}
            trailing={
              <span className="text-right">
                <span className="tabular block font-semibold">
                  {formatMoney(e.payable, currency)}
                </span>
                <span className="block text-[0.75rem] text-label-2">
                  payable · {e.remaining} left
                </span>
              </span>
            }
          />
        ))}
        {list.length < MAX_EMIS && (
          <ListRow
            onClick={() => onOpen(null)}
            title={
              <span className="font-medium text-accent">+ Add EMI / loan</span>
            }
          />
        )}
      </ListGroup>
      {closed.length > 0 && (
        <ListGroup
          header="Closed EMIs & loans"
          headerRight={`${closed.length}`}
          collapsed={!closedOpen}
          onToggle={() => setClosedOpen((v) => !v)}
          className="mb-3"
        >
          {closed.map((e) => (
            <ListRow
              key={e.id}
              onClick={() => onOpen(e.id)}
              title={e.name}
              subtitle={`${formatMoney(e.principal, currency)} · ${e.tenure} instalments`}
              trailing={
                <span className="flex items-center gap-1 text-[0.875rem] font-medium text-label-2">
                  <Check size={16} aria-hidden strokeWidth={2.6} /> Paid off
                </span>
              }
            />
          ))}
        </ListGroup>
      )}
    </>
  );
}

/** Repayment schedule as a list: tap an instalment's circle to mark it (and the ones before it) paid. */
function EmiTable({ schedule, paid, currency, onToggle }) {
  const money = (v) => formatMoney(v, currency);
  const cell = (label, value) => (
    <div className="min-w-0">
      <p className="truncate text-[0.6875rem] tracking-wide text-label-2 uppercase">
        {label}
      </p>
      <p className="tabular truncate text-[0.8125rem]">{value}</p>
    </div>
  );
  return (
    <div>
      <h3 className="mb-1.5 px-1 text-[0.8125rem] font-medium tracking-wide text-label-2 uppercase">
        Schedule
      </h3>
      <ul className="overflow-hidden rounded-control bg-surface ring-1 ring-separator">
        {schedule.rows.map((r) => {
          const done = r.n <= paid;
          const next = r.n === paid + 1;
          return (
            <li
              key={r.n}
              className={cx(
                "flex items-start gap-3 border-b border-separator px-3 py-3 last:border-b-0",
                next && "bg-accent-soft",
              )}
            >
              <button
                type="button"
                onClick={() => onToggle(r.n)}
                aria-pressed={done}
                aria-label={
                  done
                    ? `Instalment ${r.n} paid. Tap to unmark`
                    : `Mark instalment ${r.n} as paid`
                }
                className={cx(
                  "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-pill text-[0.8125rem] font-semibold",
                  done ? "bg-accent text-white" : "bg-fill text-label-2",
                )}
              >
                {done ? <Check size={16} strokeWidth={3} /> : r.n}
              </button>
              <div className={cx("min-w-0 flex-1", done && "opacity-60")}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[0.9375rem] font-medium">
                    {shortDate(r.due)}
                  </p>
                  <p className="tabular text-[0.9375rem] font-semibold">
                    {money(r.emi)}
                  </p>
                </div>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {cell("Outstanding", money(r.outstanding))}
                  {cell("Principal", money(r.principal))}
                  {cell("Interest", money(r.interest))}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-1.5 px-1 text-[0.75rem] text-label-2">
        Tap a circle to mark that instalment and the ones before it as paid.
      </p>
    </div>
  );
}

/** One editable instalment of the schedule in the EMI form. */
function EditableInstalment({ row, text, currency, onChange }) {
  const input = (label, key) => (
    <label className="min-w-0">
      <span className="block truncate text-[0.6875rem] tracking-wide text-label-2 uppercase">
        {label}
      </span>
      <input
        inputMode="decimal"
        aria-label={`${label} of instalment ${row.n}`}
        value={text[key]}
        onChange={(e) => onChange({ ...text, [key]: numeric(e.target.value) })}
        className="tabular mt-0.5 h-9 w-full min-w-0 rounded-control bg-fill px-2 text-[0.8125rem] outline-none focus:bg-accent-soft"
      />
    </label>
  );
  return (
    <li className="border-b border-separator px-3 py-3 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[0.9375rem] font-medium">
          <span className="mr-2 text-label-2">#{row.n}</span>
          {shortDate(row.due)}
        </p>
        <p className="tabular text-[0.9375rem] font-semibold">
          {formatMoney(row.emi, currency)}
        </p>
      </div>
      <div className="mt-1.5 grid grid-cols-3 gap-2">
        <div className="min-w-0">
          <span className="block truncate text-[0.6875rem] tracking-wide text-label-2 uppercase">
            Outstanding
          </span>
          <p className="tabular mt-0.5 flex h-9 items-center truncate text-[0.8125rem] text-label-2">
            {formatMoney(row.outstanding, currency)}
          </p>
        </div>
        {input("Principal", "principal")}
        {input("Interest", "interest")}
      </div>
    </li>
  );
}

/** Add or edit one EMI of a card. What's left of it counts against the limit. */
function EmiSheet({ state, holding, onClose }) {
  const { currency } = useMeta();
  const confirm = useConfirm();
  const setError = useErrorToast();
  const list = Array.isArray(holding?.emis) ? holding.emis : [];
  const emi = state.id ? (list.find((e) => e.id === state.id) ?? null) : null;
  const unit = 10 ** currencyDigits(currency);
  const toText = (v) => String(fromMinor(v, currency));

  const [name, setName] = useState(emi?.name ?? "");
  const [principal, setPrincipal] = useState(emi ? toText(emi.principal) : "");
  const [monthly, setMonthly] = useState(emi ? toText(emi.monthly) : "");
  const [tenure, setTenure] = useState(emi ? String(emi.tenure) : "");
  const [noInterest, setNoInterest] = useState(Boolean(emi?.noInterest));
  const [start, setStart] = useState(
    emi ? toDateInput(new Date(emi.start)) : toDateInput(new Date()),
  );
  // The schedule typed in by hand (null = calculated from the figures above).
  const [custom, setCustom] = useState(
    emi?.custom?.map((c) => ({
      principal: toText(c.principal),
      interest: toText(c.interest),
    })) ?? null,
  );
  const [busy, setBusy] = useState(false);

  // Anything typed since the form opened asks before it is thrown away.
  const formState = JSON.stringify({
    name,
    principal,
    monthly,
    tenure,
    start,
    noInterest,
    custom,
  });
  const [initialState] = useState(formState);
  const dirty = formState !== initialState;

  const P = Number(principal);
  const T = Number(tenure);
  // A no-interest loan's EMI is just the amount split over the tenure.
  const autoMonthly =
    P > 0 && Number.isInteger(T) && T > 0
      ? toText(noInterestEmi(toMinor(P, currency), T))
      : "";
  const monthlyShown = noInterest ? autoMonthly : monthly;
  const M = Number(monthlyShown);
  const startAt = start ? new Date(`${start}T00:00:00`) : null;
  const minor = (v) => toMinor(Number(v) || 0, currency);
  const customMinor = custom
    ? custom.map((c) => ({
        principal: minor(c.principal),
        interest: minor(c.interest),
      }))
    : null;
  const draft = {
    name,
    principal: P > 0 ? toMinor(P, currency) : 0,
    monthly: M > 0 ? toMinor(M, currency) : 0,
    tenure: T,
    start: startAt,
    paidCount: emi ? Math.min(emiState(emi).paid, T) : 0,
    ...(noInterest && { noInterest: true }),
    ...(customMinor && { custom: customMinor }),
  };
  const baseOk =
    P > 0 &&
    M > 0 &&
    Number.isInteger(T) &&
    T >= 1 &&
    T <= MAX_TENURE &&
    startAt &&
    !Number.isNaN(startAt.getTime()) &&
    M <= P &&
    M * T >= P;
  const schedule = baseOk ? emiSchedule(draft, unit) : null;
  const sumP = customMinor?.reduce((n, c) => n + c.principal, 0) ?? 0;
  const scheduleError =
    custom && baseOk ? emiError({ ...draft, name: draft.name || "x" }) : "";

  // Changing the amount, EMI or tenure recalculates the schedule.
  const recalc = (set) => (e) => {
    set(e.target.value);
    setCustom(null);
  };
  function editRow(i, text) {
    const base =
      custom ??
      schedule.rows.map((r) => ({
        principal: toText(r.principal),
        interest: toText(r.interest),
      }));
    setCustom(base.map((c, j) => (j === i ? text : c)));
  }

  async function persist(next) {
    setBusy(true);
    try {
      await apiFetch(`/api/networth/${holding.id}`, {
        method: "PATCH",
        body: emisBody(next),
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
    if (!Number.isFinite(P) || !Number.isFinite(M))
      return setError("Enter the amounts as numbers.");
    const dup = list.find(
      (e) =>
        e.id !== emi?.id &&
        e.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );
    if (dup) return setError(`Another EMI is already called "${dup.name}".`);
    const item = {
      ...draft,
      id: emi?.id ?? crypto.randomUUID(),
      name: name.trim(),
      start: fromDateInput(
        start,
        emi ? new Date(emi.start) : null,
      ).toISOString(),
    };
    const err = emiError(item);
    if (err) return setError(err);
    persist(
      emi ? list.map((e) => (e.id === emi.id ? item : e)) : [...list, item],
    );
  }

  async function remove() {
    if (
      !(await confirm({
        title: "Delete this EMI?",
        message: `"${emi.name}" will stop counting against the card's limit.`,
      }))
    )
      return;
    persist(list.filter((e) => e.id !== emi.id));
  }

  // Quick hints for the figures above, shown as you type.
  const hint = noInterest
    ? ""
    : P > 0 && M > P
      ? "The monthly EMI can't be more than the total amount."
      : P > 0 && M > 0 && Number.isInteger(T) && T > 0 && M * T < P
        ? "Monthly EMI × tenure is less than the total amount."
        : "";

  return (
    <BottomSheet
      open={state.open}
      onClose={onClose}
      title={emi ? "Edit EMI" : "Add EMI / loan"}
      dirty={dirty}
      footer={
        emi ? (
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
            Add EMI
          </Button>
        )
      }
    >
      <div className="space-y-2.5 pt-2">
        <TextInput
          id="emi-name"
          label="Name"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. iPhone EMI"
          autoFocus
        />
        <TextInput
          id="emi-principal"
          label={`Total amount (${currency})`}
          inputMode="decimal"
          value={principal}
          onChange={recalc(setPrincipal)}
          placeholder="Loan amount taken on the card"
        />
        <TextInput
          id="emi-tenure"
          label="Tenure (months)"
          inputMode="numeric"
          value={tenure}
          onChange={(e) => {
            setTenure(e.target.value.replace(/\D/g, "").slice(0, 3));
            setCustom(null);
          }}
          placeholder="e.g. 12"
        />
        <ListGroup className="!my-4">
          <ListRow
            role="switch"
            aria-checked={noInterest}
            onClick={() => {
              // Switching off keeps the figure that was filled in.
              if (noInterest) setMonthly(autoMonthly);
              setNoInterest(!noInterest);
              setCustom(null);
            }}
            title="No-interest EMI"
            trailing={<Switch on={noInterest} />}
          />
        </ListGroup>
        <TextInput
          id="emi-monthly"
          label={`Monthly EMI (${currency})${noInterest ? " · automatic" : ""}`}
          inputMode="decimal"
          value={monthlyShown}
          readOnly={noInterest}
          onChange={recalc(setMonthly)}
          placeholder="0"
        />
        <TextInput
          id="emi-start"
          label="First EMI date"
          type="date"
          required
          value={start}
          onChange={(e) => e.target.value && setStart(e.target.value)}
        />
        {hint && (
          <p className="text-[0.8125rem] font-medium text-expense">{hint}</p>
        )}
        {schedule && (
          <div className="!mt-5">
            <div className="mb-1.5 flex items-center justify-between gap-3 px-1">
              <h3 className="text-[0.8125rem] font-medium tracking-wide text-label-2 uppercase">
                Schedule ·{" "}
                {schedule.annualRate === 0
                  ? "no interest"
                  : `~${schedule.annualRate.toFixed(1)}% p.a.`}
              </h3>
              {custom && (
                <button
                  type="button"
                  onClick={() => setCustom(null)}
                  className="text-[0.8125rem] font-medium text-accent"
                >
                  Reset to calculated
                </button>
              )}
            </div>
            <ul className="overflow-hidden rounded-control bg-surface ring-1 ring-separator">
              {schedule.rows.map((r, i) => (
                <EditableInstalment
                  key={`${r.n}-${tenure}`}
                  row={r}
                  currency={currency}
                  text={
                    custom?.[i] ?? {
                      principal: toText(r.principal),
                      interest: toText(r.interest),
                    }
                  }
                  onChange={(t) => editRow(i, t)}
                />
              ))}
            </ul>
            <p
              className={cx(
                "mt-1.5 px-1 text-[0.8125rem]",
                scheduleError ? "font-medium text-expense" : "text-label-2",
              )}
            >
              {scheduleError ||
                (custom
                  ? `Edited to match your statement. Principal ${formatMoney(sumP, currency)} of ${formatMoney(draft.principal, currency)}.`
                  : "Calculated from the figures above. Edit any principal or interest to match your bank's statement.")}
            </p>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

const emisBody = (next) => ({
  emis: next.map((e) => ({
    id: e.id,
    name: e.name,
    principal: e.principal,
    monthly: e.monthly,
    tenure: e.tenure,
    start: e.start,
    paidCount: e.paidCount,
    custom: e.custom,
    noInterest: e.noInterest,
  })),
});

/** Read-only view of one EMI: where it stands and its schedule. */
function EmiViewSheet({ state, holding, onClose, onEdit }) {
  const { currency } = useMeta();
  const setError = useErrorToast();
  const emi = state.id
    ? ((holding?.emis ?? []).find((e) => e.id === state.id) ?? null)
    : null;
  const [pending, setPending] = useState(null);

  // Keep the last EMI while the sheet animates closed.
  const [last, setLast] = useState(emi);
  if (emi && emi !== last) setLast(emi);
  const cur = emi ?? last;
  if (!cur || !holding) return null;
  // Drop the optimistic count once the saved one has caught up.
  if (pending !== null && cur.paidCount === pending) setPending(null);

  const t = emiState(cur);
  const paid = pending ?? t.paid;
  const schedule = emiSchedule(cur, 10 ** currencyDigits(currency));
  const left = cur.tenure - paid;
  const outstanding =
    paid === 0 ? cur.principal : schedule.rows[paid - 1].closing;
  const next = left > 0 ? schedule.rows[paid] : null;
  const toPay = schedule.rows.slice(paid);
  const payable = toPay.reduce((n, x) => n + x.emi, 0);
  const interestLeft = toPay.reduce((n, x) => n + x.interest, 0);

  async function setPaid(count) {
    setPending(count);
    try {
      await apiFetch(`/api/networth/${holding.id}`, {
        method: "PATCH",
        body: emisBody(
          holding.emis.map((e) =>
            e.id === cur.id ? { ...e, paidCount: count } : e,
          ),
        ),
      });
      invalidateAll();
    } catch (e) {
      setError(e.message);
      setPending(null);
    }
  }
  // Ticking instalment k marks 1..k paid; unticking it leaves 1..k-1.
  const toggle = (k) => setPaid(paid >= k ? k - 1 : k);

  const stat = (label, value, sub) => (
    <div className="min-w-0 rounded-control bg-surface px-3 py-2.5 ring-1 ring-separator">
      <p className="truncate text-[0.6875rem] font-medium tracking-wide text-label-2 uppercase">
        {label}
      </p>
      <p className="tabular mt-0.5 truncate text-[0.9375rem] leading-tight font-semibold">
        {value}
      </p>
      <p className="truncate text-[0.75rem] text-label-2">{sub ?? "\u00a0"}</p>
    </div>
  );
  const interestShare = payable > 0 ? (interestLeft / payable) * 100 : 0;

  return (
    <BottomSheet
      open={state.open && Boolean(emi)}
      onClose={onClose}
      confirmClose={false}
      title={cur.name}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button size="lg" variant="tinted" onClick={() => onEdit(cur.id)}>
            Edit
          </Button>
          <Button
            size="lg"
            onClick={() => setPaid(paid + 1)}
            disabled={left === 0}
          >
            {left === 0 ? "All paid" : `Mark #${paid + 1} paid`}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col items-center pt-2 pb-4 text-center">
        <CategoryBadge icon="hand-coins" color="red" size="lg" />
        <p className="mt-3 text-[0.8125rem] font-medium tracking-wide text-label-2 uppercase">
          Outstanding
        </p>
        <p className="tabular text-[2.25rem] leading-tight font-bold tracking-tight">
          {formatMoney(outstanding, currency)}
        </p>
        <p className="text-[0.8125rem] text-label-2">
          {holding.name} · {left} of {cur.tenure} left
        </p>
      </div>
      <div className="mb-2.5 rounded-control bg-surface p-4 ring-1 ring-separator">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.75rem] font-medium tracking-wide text-label-2 uppercase">
              Total payable
            </p>
            <p className="tabular text-[1.5rem] leading-tight font-bold">
              {formatMoney(payable, currency)}
            </p>
          </div>
          <span className="shrink-0 rounded-pill bg-fill px-2.5 py-1 text-[0.75rem] font-medium text-label-2">
            {schedule.annualRate === 0
              ? "No interest"
              : `~${schedule.annualRate.toFixed(1)}% p.a.`}
          </span>
        </div>
        <div
          role="img"
          aria-label="Principal and interest still to pay"
          className="mt-3 flex h-2 overflow-hidden rounded-full bg-fill"
        >
          <div
            className="h-full bg-accent"
            style={{ width: `${100 - interestShare}%` }}
          />
          <div
            className="h-full bg-cat-orange"
            style={{ width: `${interestShare}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between gap-3 text-[0.8125rem] text-label-2">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-accent" />
            Principal{" "}
            <span className="tabular font-medium text-label">
              {formatMoney(outstanding, currency)}
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-cat-orange" />
            Interest{" "}
            <span className="tabular font-medium text-label">
              {formatMoney(interestLeft, currency)}
            </span>
          </span>
        </div>
      </div>
      <div className="mb-4 grid grid-cols-3 gap-2">
        {stat("Monthly", formatMoney(cur.monthly, currency))}
        {stat(
          "Next due",
          next ? dayMonth(next.due) : "Done",
          next ? dueText(daysUntil(next.due)) : null,
        )}
        {stat("Paid", `${paid} of ${cur.tenure}`)}
      </div>
      <EmiTable
        schedule={schedule}
        paid={paid}
        currency={currency}
        onToggle={toggle}
      />
    </BottomSheet>
  );
}

// ----------------------------------------------------------- balance sheet

/** "2 yrs 6 mths 4 days" between two dates (months counted on the calendar). */
function periodText(from, to) {
  let months =
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth());
  let anchor = new Date(
    from.getFullYear(),
    from.getMonth() + months,
    from.getDate(),
  );
  if (anchor > to) {
    months -= 1;
    anchor = new Date(
      from.getFullYear(),
      from.getMonth() + months,
      from.getDate(),
    );
  }
  const days = Math.round((to - anchor) / 864e5);
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts = [
    y && `${y} ${y === 1 ? "yr" : "yrs"}`,
    m && `${m} ${m === 1 ? "mth" : "mths"}`,
    days && `${days} ${days === 1 ? "day" : "days"}`,
  ].filter(Boolean);
  return parts.length ? parts.join(" ") : "Same day";
}

/** What an FD pays at maturity, and over what period, from its detail rows. */
function fdSummary(rows) {
  const get = (re, kind) =>
    rows.find((r) => (kind ? r.kind === kind : re.test(r.label)))?.value ?? "";
  const day = (v) =>
    /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00`) : null;
  const date = day(get(/maturity date/i));
  const from = day(get(/date of deposit|deposit date/i));
  const amount = Number(get(/maturity amount/i));
  const deposit = Number(get(/deposit amount/i));
  return {
    rate: get(null, "rate"),
    date,
    from,
    days: date ? daysUntil(date) : null,
    period: date && from && date > from ? periodText(from, date) : "",
    amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
    deposit: Number.isFinite(deposit) && deposit > 0 ? deposit : 0,
  };
}

/** An instrument's balance entries. Editing the instrument itself is separate. */
function BalanceSheet({ state, holdings, onClose, onEdit, onClone, onEmi }) {
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
  const cardInf = cardInfo(holding, holdings);
  const cardSummary = cardInf
    ? { info: cardInf, usage: cardUsage(holding, cardInf, currency) }
    : null;
  const allRows = detailRows(holding.type, holding.details);
  const detailList = allRows.filter((r) => r.value && r.kind !== "linkcard");
  const fd = holding.type === "fd" ? fdSummary(allRows) : null;

  return (
    <BottomSheet
      open={state.open && Boolean(h)}
      onClose={onClose}
      confirmClose={false}
      title={holding.name}
      footer={
        <div
          className={cx(
            "grid gap-2",
            holding.autoBalance
              ? "grid-cols-[auto_1fr]"
              : "grid-cols-[auto_1fr_1fr]",
          )}
        >
          <Button
            size="lg"
            variant="tinted"
            onClick={() => onClone(holding.id)}
            aria-label="Clone instrument"
          >
            Clone
          </Button>
          <Button size="lg" variant="tinted" onClick={() => onEdit(holding.id)}>
            Edit
          </Button>
          {!holding.autoBalance && (
            <Button size="lg" onClick={() => openEntry()}>
              Add entry
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col items-center pt-2 pb-4 text-center">
        <HoldingBadge
          h={holding}
          type={type}
          color={group.color}
          issuer={badgeIconFor(holding, holdings)}
        />
        <span
          className={cx(
            "mt-2 rounded-pill px-2 py-0.5 text-[0.75rem] font-semibold",
            TYPE_BADGE[group.id],
          )}
        >
          {type.label}
        </span>
        <p className="mt-3 text-[0.8125rem] font-medium tracking-wide text-label-2 uppercase">
          {liability
            ? "Outstanding"
            : holding.autoBalance
              ? "Current value"
              : "Current balance"}
        </p>
        <p className="tabular text-[2.25rem] leading-tight font-bold tracking-tight">
          {formatMoney(holding.balance, currency)}
        </p>
        {holding.autoBalance && holding.principal > 0 && (
          <p
            className={cx(
              "tabular mt-1 text-[0.9375rem] font-semibold",
              holding.gain >= 0 ? "text-income" : "text-expense",
            )}
          >
            {holding.gain >= 0 ? "▲ +" : "▼ −"}
            {formatMoney(Math.abs(holding.gain), currency)} gain
            <span className="font-medium">
              {" "}
              ({((holding.gain / holding.principal) * 100).toFixed(2)}%)
            </span>
          </p>
        )}
        {holding.autoBalance ? (
          <p className="text-[0.8125rem] text-label-2">
            (calculated as on{" "}
            <span className="font-semibold text-income">today</span>)
          </p>
        ) : (
          latest && (
            <p className="text-[0.8125rem] text-label-2">
              (<AsOn iso={latest.at} />)
            </p>
          )
        )}
      </div>

      {cardSummary && (
        <div className="mb-3 space-y-2.5">
          {cardSummary.usage && (
            <div className="rounded-control bg-surface p-4 ring-1 ring-separator">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[0.75rem] font-medium tracking-wide text-label-2 uppercase">
                    Available credit
                  </p>
                  <p className="tabular text-[1.5rem] leading-tight font-bold text-income">
                    {formatMoney(cardSummary.usage.left, currency)}
                  </p>
                </div>
                <p className="tabular pb-0.5 text-right text-[0.8125rem] text-label-2">
                  of {formatMoney(cardSummary.usage.limit, currency)}
                </p>
              </div>
              <div className="my-3">
                <ProgressBar
                  label="Credit used"
                  value={Math.max(0, cardSummary.usage.used)}
                  max={cardSummary.usage.limit}
                  tone={cardSummary.usage.tone}
                />
              </div>
              <div className="flex justify-between text-[0.8125rem] text-label-2">
                <span>
                  {cardSummary.usage.used < 0 ? "Credit balance" : "Used"}{" "}
                  <span className="tabular font-medium text-label">
                    {formatMoney(Math.abs(cardSummary.usage.used), currency)}
                  </span>
                </span>
                <span className="tabular">
                  {Math.max(
                    0,
                    Math.round(
                      (cardSummary.usage.used / cardSummary.usage.limit) * 100,
                    ),
                  )}
                  % used
                </span>
              </div>
              {cardSummary.usage.shared.length > 0 && (
                <div className="mt-3 border-t border-separator pt-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[0.75rem] font-medium tracking-wide text-label-2 uppercase">
                    <Link2 size={14} aria-hidden className="text-accent" />
                    Shared limit with
                  </p>
                  <ul className="space-y-1.5">
                    {cardSummary.usage.shared.map((n, i) => (
                      <li
                        key={`${i}-${n}`}
                        className="truncate rounded-control bg-accent-soft px-3 py-2 text-[0.875rem] font-medium text-accent"
                      >
                        {n}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {(cardSummary.info.dueAt || cardSummary.info.billAt) && (
            <div className="grid grid-cols-2 gap-2.5">
              <DateTile
                label="Next due"
                date={cardSummary.info.dueAt}
                days={cardSummary.info.dueInDays}
                owes={holding.balance > 0 && cardSummary.info.dueBilled}
                empty="Add days to pay bill"
              />
              <DateTile
                label="Next bill"
                date={cardSummary.info.billAt}
                days={cardSummary.info.billInDays}
                empty="Add billing date"
              />
            </div>
          )}
        </div>
      )}

      {fd && (
        <div className="mb-3 grid grid-cols-2 gap-2.5">
          <DateTile
            label="Matures"
            date={fd.date}
            days={fd.days}
            empty="Add the maturity date"
          />
          <div className="rounded-control bg-surface p-3 ring-1 ring-separator">
            <p className="text-[0.75rem] font-medium tracking-wide text-label-2 uppercase">
              Maturity amount
            </p>
            {fd.amount ? (
              <>
                <p className="tabular mt-0.5 text-[1.25rem] leading-tight font-semibold">
                  {formatMoney(toMinor(fd.amount, currency), currency)}
                </p>
                {fd.rate !== "" && (
                  <p className="text-[0.8125rem] text-label-2">
                    {fd.rate}% p.a.
                  </p>
                )}
              </>
            ) : (
              <p className="mt-1 text-[0.8125rem] text-label-2">
                Add the rate and dates
              </p>
            )}
          </div>
          <div className="min-w-0 rounded-control bg-surface p-3 ring-1 ring-separator">
            <p className="text-[0.75rem] font-medium tracking-wide text-label-2 uppercase">
              Period
            </p>
            {fd.period ? (
              <>
                <p className="tabular mt-0.5 text-[1.25rem] leading-tight font-semibold">
                  {fd.period}
                </p>
                <p className="truncate text-[0.8125rem] text-label-2">
                  {shortDate(fd.from)} – {shortDate(fd.date)}
                </p>
              </>
            ) : (
              <p className="mt-1 text-[0.8125rem] text-label-2">
                Add the deposit and maturity dates
              </p>
            )}
          </div>
          <div className="min-w-0 rounded-control bg-surface p-3 ring-1 ring-separator">
            <p className="text-[0.75rem] font-medium tracking-wide text-label-2 uppercase">
              Deposited
            </p>
            {fd.deposit ? (
              <>
                <p className="tabular mt-0.5 truncate text-[1.25rem] leading-tight font-semibold">
                  {formatMoney(toMinor(fd.deposit, currency), currency)}
                </p>
                {fd.from && (
                  <p className="truncate text-[0.8125rem] text-label-2">
                    on {shortDate(fd.from)}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-1 text-[0.8125rem] text-label-2">
                Add the deposit amount
              </p>
            )}
          </div>
        </div>
      )}

      {holding.type === "fd" && fdBackers(holding.id, holdings).length > 0 && (
        <div className="mb-3 rounded-control bg-surface p-3 ring-1 ring-separator">
          <p className="flex items-center gap-1.5 text-[0.75rem] font-medium tracking-wide text-label-2 uppercase">
            <Link2 size={14} aria-hidden className="text-accent" />
            Backs credit card
          </p>
          <ul className="mt-1.5 space-y-1">
            {fdBackers(holding.id, holdings).map((c) => (
              <li key={c.id} className="truncate text-[0.9375rem] font-medium">
                {c.name}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[0.8125rem] text-label-2">
            This FD can&apos;t be deleted while it backs a card.
          </p>
        </div>
      )}

      {holding.type === "credit_card" && (
        <EmiList
          holding={holding}
          currency={currency}
          onOpen={(id) => onEmi(holding.id, id)}
        />
      )}

      {detailList.length > 0 && (
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          aria-expanded={showDetails}
          className="mb-2 w-full px-4 py-2.5 text-center text-[0.9375rem] font-medium text-accent"
        >
          {showDetails ? "Hide details" : "Show details"}
        </button>
      )}

      {showDetails && detailList.length > 0 && (
        <ListGroup header="Details" className="mb-2">
          {detailList.map((r, i) => (
            <div
              key={i}
              className="flex items-baseline justify-between gap-4 px-4 py-2.5"
            >
              <span className="shrink-0 text-[0.9375rem] text-label-2">
                {r.label}
              </span>
              <span className="min-w-0 text-right text-[0.9375rem] break-words">
                {formatDetailValue(r, { currency, holdings })}
              </span>
            </div>
          ))}
        </ListGroup>
      )}

      {!holding.autoBalance && (
        <ListGroup header="Balance entries" className="mb-2">
          {entries.map((e, k) => (
            <ListRow
              key={e.i}
              onClick={() => openEntry(e.i)}
              title={shortDate(e.at)}
              subtitle={k === 0 ? "Latest" : undefined}
              trailing={
                <span className="tabular font-semibold">
                  {formatMoney(e.balance, currency)}
                </span>
              }
            />
          ))}
        </ListGroup>
      )}

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

const dayMonth = (d) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(
    d,
  );

const daysUntil = (d) => {
  const t = new Date();
  return Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()) -
      new Date(t.getFullYear(), t.getMonth(), t.getDate())) /
      864e5,
  );
};

const dueText = (n) =>
  n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`;

/** Credit used vs limit as minor units, with the bar's warning tone. */
function cardUsage(h, info, currency) {
  if (!info?.limit) return null;
  const limit = toMinor(info.limit, currency);
  const used = info.groupUsed;
  return {
    limit,
    used,
    left: limit - used,
    shared: info.shared,
    tone: used / limit >= 0.9 ? "danger" : used / limit >= 0.5 ? "warn" : "ok",
  };
}

/** A date with a countdown, e.g. "20 Nov" / "in 11 days". */
function DateTile({ label, date, days, owes, empty }) {
  const soon = owes && date && days <= 3;
  return (
    <div
      className={cx(
        "rounded-control p-3 ring-1",
        soon
          ? "bg-expense/10 ring-expense/40"
          : owes && date
            ? "bg-cat-orange/10 ring-cat-orange/40"
            : "bg-surface ring-separator",
      )}
    >
      <p className="text-[0.75rem] font-medium tracking-wide text-label-2 uppercase">
        {label}
      </p>
      {date ? (
        <>
          <p className="tabular mt-0.5 text-[1.25rem] leading-tight font-semibold">
            {dayMonth(date)}
          </p>
          <p
            className={cx(
              "text-[0.8125rem]",
              soon
                ? "font-medium text-expense"
                : owes
                  ? "font-medium text-cat-orange"
                  : "text-label-2",
            )}
          >
            {dueText(days)}
            {owes && " · payment pending"}
          </p>
        </>
      ) : (
        <p className="mt-1 text-[0.8125rem] text-label-2">{empty}</p>
      )}
    </div>
  );
}

function HoldingRow({ h, all, onClick }) {
  const { currency } = useMeta();
  const type = nwType(h.type);
  const group = nwGroup(type.group);
  const { at } = lastChange(h);
  const info = cardInfo(h, all);
  const usage = cardUsage(h, info, currency);

  const emis = cardEmis(h);
  if (info) {
    // Money is owed on this card: the due date is the one to watch.
    const owes = h.balance > 0 && info.dueBilled;
    const urgent = owes && info.dueInDays != null && info.dueInDays <= 3;
    const chip =
      "inline-flex items-center rounded-pill bg-fill px-2.5 py-1 text-[0.75rem] font-medium whitespace-nowrap text-label-2";
    return (
      <button
        type="button"
        onClick={onClick}
        className={cx(
          "block w-full px-4 py-3.5 text-left active:bg-fill",
          !h.included && "opacity-60",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-3">
            <HoldingBadge
              h={h}
              type={type}
              color={group.color}
              issuer={badgeIconFor(h, all)}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[1.0625rem] leading-snug break-words">
                {h.name}
              </span>
              {at && (
                <span className="block text-[0.75rem] text-label-2">
                  <AsOn iso={at} />
                </span>
              )}
            </span>
            <span className="tabular shrink-0 text-[1.0625rem] font-semibold">
              {formatMoney(h.balance, currency)}
            </span>
          </span>
          {usage && (
            <span className="mt-3 block space-y-1.5">
              <ProgressBar
                label="Credit used"
                value={Math.max(0, usage.used)}
                max={usage.limit}
                tone={usage.tone}
              />
              <span className="flex justify-between gap-3 text-[0.8125rem] text-label-2">
                <span className="font-medium text-label">
                  {formatMoney(usage.left, currency)} available
                </span>
                <span>
                  of {formatMoney(usage.limit, currency)}
                  {usage.shared.length > 0 && " · shared"}
                </span>
              </span>
            </span>
          )}
          {(info.dueAt || info.billAt || emis.monthly > 0) && (
            <span className="mt-2.5 flex flex-wrap gap-1.5">
              {info.dueAt && (
                <span
                  className={cx(
                    chip,
                    owes && "!bg-cat-orange/15 !font-semibold !text-cat-orange",
                    urgent && "!bg-expense/15 !text-expense",
                  )}
                >
                  Due {dayMonth(info.dueAt)} · {dueText(info.dueInDays)}
                </span>
              )}
              {emis.monthly > 0 && (
                <span
                  className={cx(
                    chip,
                    "!bg-accent-soft !font-semibold !text-accent",
                  )}
                >
                  EMI {formatMoney(emis.monthly, currency)}/mo
                </span>
              )}
              {info.billAt && (
                <span className={chip}>
                  Bill {dayMonth(info.billAt)} · {dueText(info.billInDays)}
                </span>
              )}
            </span>
          )}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex min-h-[4rem] w-full items-center gap-3 px-4 py-3 text-left active:bg-fill",
        !h.included && "opacity-60",
      )}
    >
      <HoldingBadge
        h={h}
        type={type}
        color={group.color}
        issuer={badgeIconFor(h, all)}
      />
      {/* Phone: stacked. Large screens: one line (name, type, balance). */}
      <span className="min-w-0 flex-1 lg:grid lg:grid-cols-[1fr_14rem] lg:gap-x-4">
        <span
          className={cx(
            "block text-[1.0625rem] leading-snug break-words lg:col-start-1 lg:min-w-0",
            "lg:row-span-2 lg:row-start-1 lg:self-center",
          )}
        >
          {h.name}
          {!h.included && (
            <span className="ml-2 rounded-pill bg-fill px-2 py-0.5 text-[0.75rem] font-semibold whitespace-nowrap text-label-2">
              Not counted
            </span>
          )}
        </span>
        <span
          className={cx(
            "mt-1.5 block lg:col-start-2 lg:row-start-1 lg:mt-0 lg:self-center lg:text-right",
            "lg:row-span-2",
          )}
        >
          <span className="tabular text-[1.0625rem] font-semibold">
            {formatMoney(h.balance, currency)}
          </span>
          {h.autoBalance && h.principal > 0 && (
            <span
              className={cx(
                "tabular block text-[0.8125rem] font-medium",
                h.gain >= 0 ? "text-income" : "text-expense",
              )}
            >
              {h.gain >= 0 ? "+" : "−"}
              {formatMoney(Math.abs(h.gain), currency)} gain
            </span>
          )}
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

/** A holding row with a grip on the left to drag it up or down its section. */
function SortableHolding({ h, all, onClick, reorder }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: h.id, disabled: !reorder });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform && { ...transform, x: 0 }),
        transition,
      }}
      className={cx(
        "relative flex items-stretch bg-surface",
        isDragging && "z-10 shadow-2xl ring-1 ring-accent",
      )}
    >
      {reorder && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Drag to reorder ${h.name}`}
          className="flex w-8 shrink-0 cursor-grab touch-none items-center justify-center pl-1 text-label-2 select-none active:cursor-grabbing"
        >
          <GripVertical size={18} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <HoldingRow h={h} all={all} onClick={onClick} />
      </div>
    </div>
  );
}

export function NetWorthScreen() {
  const { currency } = useMeta();
  const q = useQuery("/api/networth");
  const [sheet, setSheet] = useState({ open: false, holdingId: null, n: 0 });
  const [bal, setBal] = useState({ open: false, holdingId: null });
  const [emiSheet, setEmiSheet] = useState({
    open: false,
    cardId: null,
    id: null,
    n: 0,
  });
  // Tapping an EMI views it; Edit / Add open the form.
  const [emiView, setEmiView] = useState({
    open: false,
    cardId: null,
    id: null,
  });
  const openEmi = (cardId, id = null) =>
    id
      ? setEmiView({ open: true, cardId, id })
      : setEmiSheet((x) => ({ open: true, cardId, id: null, n: x.n + 1 }));
  const editEmi = (cardId, id) =>
    setEmiSheet((x) => ({ open: true, cardId, id, n: x.n + 1 }));
  // Order set by dragging; shown at once while the save round-trips.
  const [order, setOrder] = useState(null);
  const [reorder, setReorder] = useState(false);
  const toastDrag = useToast();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

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

  // Closed EMIs start folded; false means the user opened them.
  const closedOpen = folded["card-emi-closed"] === false;
  const toggleClosed = () =>
    setFolded((f) => {
      const next = { ...f, "card-emi-closed": f["card-emi-closed"] === false };
      try {
        localStorage.setItem("nw-folded", JSON.stringify(next));
      } catch {}
      return next;
    });

  async function onDragEnd(all, { active, over }) {
    if (!over || active.id === over.id) return;
    const ids = all.map((x) => x.id);
    const from = ids.indexOf(active.id);
    const to = ids.indexOf(over.id);
    const next = arrayMove(ids, from, to);
    setOrder(next);
    try {
      await apiFetch("/api/networth/reorder", {
        method: "POST",
        body: { ids: next },
      });
      invalidateAll();
    } catch (e) {
      setOrder(null);
      toastDrag.show({ message: e.message });
    }
  }

  const open = (holdingId = null, cloneId = null) =>
    setSheet((s) => ({ open: true, holdingId, cloneId, n: s.n + 1 }));
  // Closing Edit / Clone also closes the instrument sheet it was opened from.
  const close = () => {
    setSheet((s) => ({ ...s, open: false }));
    setBal((b) => ({ ...b, open: false }));
  };

  // The app's add button (tab bar "+" / sidebar) asks this page to add one.
  useEffect(() => {
    const onAdd = () =>
      setSheet((s) => ({
        open: true,
        holdingId: null,
        cloneId: null,
        n: s.n + 1,
      }));
    window.addEventListener("networth:add", onAdd);
    return () => window.removeEventListener("networth:add", onAdd);
  }, []);

  const holdings = useMemo(() => {
    // An FD with its deposit details is valued by calculation, not entries.
    const list = (q.data?.holdings ?? []).map((h) => {
      const v = fdValueNow(h, currency);
      return v == null
        ? h
        : {
            ...h,
            rawBalance: h.balance,
            balance: v,
            autoBalance: true,
            gain: v - (fdPrincipal(h, currency) ?? v),
            principal: fdPrincipal(h, currency),
          };
    });
    if (!order) return list;
    const at = new Map(order.map((id, i) => [id, i]));
    return [...list].sort(
      (a, b) => (at.get(a.id) ?? Infinity) - (at.get(b.id) ?? Infinity),
    );
  }, [q.data, order, currency]);
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
  // Open EMIs of the cards, listed on their own; their sum is what the
  // credit card section leaves out of its total.
  const emiRows = holdings.flatMap((card) =>
    card.type === "credit_card"
      ? cardEmis(card)
          .list.filter((e) => e.active)
          .map((emi) => ({ card, emi }))
      : [],
  );
  const closedEmiRows = holdings.flatMap((card) =>
    card.type === "credit_card"
      ? cardEmis(card)
          .list.filter((e) => !e.active)
          .map((emi) => ({ card, emi }))
      : [],
  );
  const emiTotal = holdings
    .filter((h) => h.included && h.type === "credit_card")
    .reduce((n, h) => n + cardEmis(h).payable, 0);

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
          <div className="flex items-center">
            {holdings.length > 1 && (
              <Button
                variant="plain"
                onClick={() => setReorder((v) => !v)}
                aria-pressed={reorder}
              >
                {reorder ? "Done" : "Reorder"}
              </Button>
            )}
            <Button
              variant="plain"
              onClick={downloadPdf}
              loading={pdfBusy}
              aria-label="Download PDF summary"
            >
              <Download size={18} aria-hidden /> PDF
            </Button>
          </div>
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

          {NW_TYPES.map((t) => {
            const g = nwGroup(t.group);
            const rows = holdings.filter((h) => h.type === t.id);
            if (rows.length === 0) return null;
            const total = rows
              .filter((h) => h.included)
              .reduce((n, h) => n + h.balance, 0);
            return (
              <ListGroup
                key={t.id}
                header={t.label}
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
                collapsed={Boolean(folded[t.id])}
                onToggle={() => toggleFold(t.id)}
              >
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                  onDragEnd={(e) => onDragEnd(holdings, e)}
                >
                  <SortableContext
                    items={rows.map((h) => h.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {rows.map((h) => (
                      <SortableHolding
                        key={h.id}
                        h={h}
                        all={holdings}
                        reorder={reorder}
                        onClick={() => setBal({ open: true, holdingId: h.id })}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </ListGroup>
            );
          })}

          {emiRows.length > 0 && (
            <ListGroup
              header="Credit card loan / EMI"
              headerRight={
                <span className="text-expense">
                  −{formatMoney(emiTotal, currency)}
                </span>
              }
              collapsed={Boolean(folded["card-emi"])}
              onToggle={() => toggleFold("card-emi")}
            >
              {emiRows.map(({ card, emi }) => (
                <ListRow
                  key={`${card.id}-${emi.id}`}
                  onClick={() => openEmi(card.id, emi.id)}
                  leading={<CategoryBadge icon="hand-coins" color="red" />}
                  title={emi.name}
                  subtitle={`${card.name} · ${formatMoney(emi.monthly, currency)}/mo · ${emi.paid} of ${emi.tenure} paid`}
                  trailing={
                    <span className="text-right">
                      <span className="tabular block font-semibold">
                        {formatMoney(emi.payable, currency)}
                      </span>
                      <span className="block text-[0.75rem] text-label-2">
                        payable · {emi.remaining} left
                      </span>
                    </span>
                  }
                />
              ))}
            </ListGroup>
          )}

          {closedEmiRows.length > 0 && (
            <ListGroup
              header="Closed loan / EMI"
              headerRight={`${closedEmiRows.length}`}
              collapsed={!closedOpen}
              onToggle={toggleClosed}
            >
              {closedEmiRows.map(({ card, emi }) => (
                <ListRow
                  key={`${card.id}-${emi.id}`}
                  onClick={() => openEmi(card.id, emi.id)}
                  leading={<CategoryBadge icon="hand-coins" color="gray" />}
                  title={emi.name}
                  subtitle={`${card.name} · ${emi.tenure} instalments`}
                  trailing={
                    <span className="flex items-center gap-1 text-[0.875rem] font-medium text-label-2">
                      <Check size={16} aria-hidden strokeWidth={2.6} /> Paid off
                    </span>
                  }
                />
              ))}
            </ListGroup>
          )}

          {hasLending && (
            <ListGroup
              header="From Track P2P Lending"
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
                Open Track P2P Lending{" "}
                <ChevronRightIcon width="18" height="18" />
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
        onClone={(id) => open(null, id)}
        onEmi={openEmi}
      />
      {emiView.cardId && (
        <EmiViewSheet
          state={emiView}
          holding={holdings.find((x) => x.id === emiView.cardId) ?? null}
          onClose={() => setEmiView((x) => ({ ...x, open: false }))}
          onEdit={(id) => editEmi(emiView.cardId, id)}
        />
      )}
      {emiSheet.cardId && (
        <EmiSheet
          key={`e${emiSheet.n}`}
          state={emiSheet}
          holding={holdings.find((x) => x.id === emiSheet.cardId) ?? null}
          onClose={() => setEmiSheet((x) => ({ ...x, open: false }))}
        />
      )}
      <HoldingSheet
        key={`h${sheet.n}`}
        state={sheet}
        holdings={holdings}
        onClose={close}
      />
    </div>
  );
}
