"use client";
import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/Field";
import { OptionPanel, PickerField } from "@/components/ui/Picker";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { CategoryIcon } from "@/components/CategoryIcon";
import { useMeta } from "@/lib/client/meta";
import { toMinor } from "@/lib/money";

export const EMPTY_FILTERS = {
  type: "",
  categoryId: null,
  accountId: null,
  min: "",
  max: "",
};

const TYPE_OPTIONS = [
  { value: "", label: "All" },
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfer" },
];

/** Query-string fragment for search text + filters (the period adds from/to). */
export function filterQuery(q, f, currency) {
  const p = new URLSearchParams();
  if (q.trim()) p.set("q", q.trim());
  if (f.type) p.set("type", f.type);
  if (f.categoryId) p.set("categoryId", f.categoryId);
  if (f.accountId) p.set("accountId", f.accountId);
  if (f.min !== "") p.set("min", String(toMinor(Number(f.min), currency)));
  if (f.max !== "") p.set("max", String(toMinor(Number(f.max), currency)));
  return p.toString();
}

export const filtersInvalid = (f) =>
  f.min !== "" && f.max !== "" && Number(f.min) > Number(f.max);

/** Removable chips describing the active filters. */
export function filterChips(f, { categoryById, accountById }) {
  const out = [];
  if (f.type) out.push({ k: "type", label: f.type, clear: { type: "" } });
  if (f.categoryId)
    out.push({
      k: "cat",
      label: categoryById.get(f.categoryId)?.name ?? "Category",
      clear: { categoryId: null },
    });
  if (f.accountId)
    out.push({
      k: "acc",
      label: accountById.get(f.accountId)?.name ?? "Account",
      clear: { accountId: null },
    });
  if (f.min !== "" || f.max !== "")
    out.push({
      k: "amt",
      label: `${f.min || "0"} – ${f.max || "any"}`,
      clear: { min: "", max: "" },
    });
  return out;
}

export function FiltersSheet({ state, onClose, onApply }) {
  const { accounts, topCategories, categoryById, accountById } = useMeta();
  const [f, setF] = useState(state.filters);
  const [panel, setPanel] = useState(null); // "category" | "account" | null
  const set = (patch) => setF((s) => ({ ...s, ...patch }));

  const catOptions = [
    ...topCategories("expense"),
    ...topCategories("income"),
  ].map((c) => ({
    id: c.id,
    label: `${c.name} (${c.type})`,
    leading: <CategoryIcon icon={c.icon} color={c.color} size={20} />,
  }));
  const accOptions = accounts.map((a) => ({ id: a.id, label: a.name }));

  const panels = {
    category: {
      title: "Category",
      options: catOptions,
      value: f.categoryId,
      clearLabel: "Any category",
      onPick: (v) => set({ categoryId: v }),
    },
    account: {
      title: "Account",
      options: accOptions,
      value: f.accountId,
      clearLabel: "Any account",
      onPick: (v) => set({ accountId: v }),
    },
  };
  const active = panel ? panels[panel] : null;

  return (
    <BottomSheet
      open={state.open}
      onClose={onClose}
      tall={false}
      title="Filters"
      footer={
        <div className="space-y-2">
          {active && (
            <OptionPanel
              {...active}
              onPick={(v) => {
                active.onPick(v);
                setPanel(null);
              }}
              onClose={() => setPanel(null)}
            />
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="tinted"
              size="lg"
              onClick={() => setF(EMPTY_FILTERS)}
            >
              Reset
            </Button>
            <Button
              size="lg"
              onClick={() => {
                onApply(f);
                onClose();
              }}
            >
              Apply
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-2.5 pt-2">
        <SegmentedControl
          label="Type"
          dense
          options={TYPE_OPTIONS}
          value={f.type}
          onChange={(type) => set({ type })}
        />
        <PickerField
          label="Category"
          placeholder="Any category"
          value={categoryById.get(f.categoryId)?.name}
          active={panel === "category"}
          onClick={() => setPanel(panel === "category" ? null : "category")}
        />
        <PickerField
          label="Account"
          placeholder="Any account"
          value={accountById.get(f.accountId)?.name}
          active={panel === "account"}
          onClick={() => setPanel(panel === "account" ? null : "account")}
        />
        <div className="grid grid-cols-2 gap-2.5">
          <TextInput
            id="f-min"
            label="Min amount"
            inputMode="decimal"
            placeholder="0"
            value={f.min}
            onFocus={() => setPanel(null)}
            onChange={(e) =>
              set({ min: e.target.value.replace(/[^0-9.]/g, "") })
            }
          />
          <TextInput
            id="f-max"
            label="Max amount"
            inputMode="decimal"
            placeholder="Any"
            value={f.max}
            onFocus={() => setPanel(null)}
            onChange={(e) =>
              set({ max: e.target.value.replace(/[^0-9.]/g, "") })
            }
          />
        </div>
        <p className="text-[0.8125rem] text-label-2">
          Filters apply within the period selected above the list.
        </p>
      </div>
    </BottomSheet>
  );
}
