"use client";
import { Brand } from "@/components/Brand";
import { createContext, useContext, useMemo, useState } from "react";
import { apiFetch } from "./api";
import { invalidateAll, useQuery } from "./query";
import { Button } from "@/components/ui/Button";
import { CURRENCIES } from "@/lib/currencies";
import { currencySymbol } from "@/lib/money";
import { PickerField } from "@/components/ui/Picker";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Check } from "lucide-react";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { ErrorState } from "@/components/ui/States";
import { Skeleton } from "@/components/ui/Skeleton";

const MetaContext = createContext(null);

export function useMeta() {
  const ctx = useContext(MetaContext);
  if (!ctx) throw new Error("useMeta must be used inside <MetaProvider>");
  return ctx;
}

// Pre-select a currency from the browser locale (INR if unknown).
const REGION_CURRENCY = {
  IN: "INR",
  US: "USD",
  GB: "GBP",
  AE: "AED",
  SG: "SGD",
  AU: "AUD",
  CA: "CAD",
  JP: "JPY",
  CN: "CNY",
  CH: "CHF",
  BD: "BDT",
  NP: "NPR",
  PK: "PKR",
  LK: "LKR",
  SA: "SAR",
  ID: "IDR",
  BR: "BRL",
  MX: "MXN",
  ZA: "ZAR",
  DE: "EUR",
  FR: "EUR",
  ES: "EUR",
  IT: "EUR",
  NL: "EUR",
  IE: "EUR",
  PT: "EUR",
};
function guessCurrency() {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    return REGION_CURRENCY[region] ?? "INR";
  } catch {
    return "INR";
  }
}

function Switch({ on }) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-block h-7 w-12 shrink-0 rounded-full transition-colors ${
        on ? "bg-accent" : "bg-fill"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-5" : ""
        }`}
      />
    </span>
  );
}

const CURRENCY_NAME = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, c.name]),
);
function Onboarding({ onDone }) {
  const [currency, setCurrency] = useState(guessCurrency);
  const [starter, setStarter] = useState(true);
  const [cash, setCash] = useState(true);
  const [panel, setPanel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/setup", {
        method: "POST",
        body: { currency, starterCategories: starter, cashAccount: cash },
      });
      onDone();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-7 px-gutter py-10 pt-safe pb-safe">
      <div className="text-center">
        <Brand size="lg" priority className="mb-6 justify-center" />
        <h1 className="text-[2rem] leading-tight font-bold tracking-tight">
          Welcome
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-label-2">
          One quick choice and you&apos;re ready to track your first expense.
        </p>
      </div>

      <ListGroup header="We'll set up" className="mb-0">
        <ListRow
          leading={<CategoryBadge icon="banknote" color="green" />}
          title="A Cash account"
          subtitle={cash ? undefined : "Off. You'll add your own accounts"}
          onClick={() => setCash((v) => !v)}
          role="switch"
          aria-checked={cash}
          trailing={<Switch on={cash} />}
        />
        <ListRow
          leading={<CategoryBadge icon="layout-grid" color="blue" />}
          title="Starter categories"
          subtitle={
            starter
              ? "Food, Transport, Bills, Salary and more"
              : "Off. You'll add your own categories"
          }
          onClick={() => setStarter((v) => !v)}
          role="switch"
          aria-checked={starter}
          trailing={<Switch on={starter} />}
        />
      </ListGroup>

      <div>
        <PickerField
          label="Currency"
          value={`${currencySymbol(currency)} ${CURRENCY_NAME[currency]} (${currency})`}
          active={panel}
          onClick={() => setPanel((p) => !p)}
        />
        <BottomSheet
          open={panel}
          onClose={() => setPanel(false)}
          title="Currency"
          tall={false}
        >
          <ul role="listbox" aria-label="Currency" className="space-y-0.5 pt-2">
            {CURRENCIES.map((c) => {
              const active = c.code === currency;
              return (
                <li key={c.code} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      setCurrency(c.code);
                      setPanel(false);
                    }}
                    className={`flex min-h-tap w-full items-center gap-3 rounded-control px-3 text-left active:bg-fill ${
                      active ? "bg-accent-soft text-accent" : ""
                    }`}
                  >
                    <span
                      aria-hidden
                      className="w-10 shrink-0 text-center text-label-2"
                    >
                      {currencySymbol(c.code)}
                    </span>
                    <span className="flex-1 truncate">
                      {c.name} ({c.code})
                    </span>
                    {active ? (
                      <Check aria-hidden size={18} strokeWidth={2.6} />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </BottomSheet>
        <p className="mt-2 px-1 text-xs text-label-2">
          Can&apos;t be changed later, because amounts are stored in this
          currency&apos;s smallest unit.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-center text-sm text-danger">
          {error}
        </p>
      )}
      <Button size="lg" onClick={start} loading={busy}>
        Get started
      </Button>
    </main>
  );
}

/** Loads accounts/categories/settings once and gates the app behind first-run setup. */
export function MetaProvider({ children }) {
  const { data, error, loading, retry } = useQuery("/api/meta");

  const value = useMemo(() => {
    if (!data?.seeded) return null;
    const accounts = data.accounts;
    const categories = data.categories;
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const live = categories.filter((c) => !c.deletedAt);

    // Smart default: most recently used first, then by sort order.
    const byRecency = (a, b) =>
      (b.lastUsedAt ? Date.parse(b.lastUsedAt) : 0) -
        (a.lastUsedAt ? Date.parse(a.lastUsedAt) : 0) ||
      a.sortOrder - b.sortOrder;

    return {
      currency: data.settings.currency,
      lastAccountId: data.settings.lastAccountId,
      accounts,
      categories,
      accountById,
      categoryById,
      topCategories: (type) =>
        live.filter((c) => c.type === type && !c.parentId).sort(byRecency),
    };
  }, [data]);

  if (loading) {
    return (
      <div
        className="mx-auto max-w-2xl space-y-4 px-gutter pt-6"
        aria-busy="true"
      >
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="mx-auto max-w-md px-gutter pt-10">
        <ErrorState message={error.message} onRetry={retry} />
      </div>
    );
  }
  if (!data.seeded) return <Onboarding onDone={invalidateAll} />;

  return <MetaContext value={value}>{children}</MetaContext>;
}
