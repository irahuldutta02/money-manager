"use client";
import { useState } from "react";
import Link from "next/link";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { CategoryBadge, ColorSwatches } from "@/components/ui/CategoryBadge";
import { TextInput } from "@/components/ui/Field";
import { IconPanel } from "@/components/ui/IconPanel";
import { CategoryIcon, iconLabel } from "@/components/CategoryIcon";
import { PickerField } from "@/components/ui/Picker";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useErrorToast, useToast } from "@/components/ui/Toast";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { useConfirm } from "@/components/ui/Confirm";
import { apiFetch } from "@/lib/client/api";
import { invalidateAll } from "@/lib/client/query";
import { useMeta } from "@/lib/client/meta";

function CategorySheet({ state, type, onClose }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { category } = state;
  const editing = Boolean(category);
  const [name, setName] = useState(category?.name ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "tag");
  const [color, setColor] = useState(category?.color ?? "blue");
  const setError = useErrorToast();
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState(false); // icon picker in the bottom panel

  async function save() {
    if (!name.trim()) return setError("Give it a name.");
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        await apiFetch(`/api/categories/${category.id}`, {
          method: "PATCH",
          body: { name, icon, color },
        });
      } else {
        await apiFetch("/api/categories", {
          method: "POST",
          body: { name, type, icon, color },
        });
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
    if (
      !(await confirm({
        title: "Delete category?",
        message: `"${category.name}" will be removed. You can undo this right after.`,
      }))
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/categories/${category.id}`, { method: "DELETE" });
      invalidateAll();
      onClose();
      toast.show({
        message: `${category.name} deleted`,
        actionLabel: "Undo",
        onAction: async () => {
          await apiFetch(`/api/categories/${category.id}`, {
            method: "PATCH",
            body: { deleted: false },
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
      title={editing ? "Edit category" : "New category"}
      footer={
        <div className="space-y-2">
          {panel && (
            <IconPanel
              value={icon}
              color={color}
              onPick={(slug) => {
                setIcon(slug);
                setPanel(false);
              }}
              onClose={() => setPanel(false)}
            />
          )}
          {editing ? (
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
        <TextInput
          id="cat-name"
          label="Name"
          value={name}
          maxLength={40}
          onFocus={() => setPanel(false)}
          onChange={(e) => setName(e.target.value)}
        />
        <PickerField
          label="Icon"
          placeholder="Choose icon"
          value={iconLabel(icon)}
          leading={<CategoryIcon icon={icon} color={color} size={20} />}
          active={panel}
          onClick={() => setPanel((p) => !p)}
        />
        <ColorSwatches value={color} onChange={setColor} />
      </div>
    </BottomSheet>
  );
}

export function CategoriesScreen() {
  const { categories } = useMeta();
  const [type, setType] = useState("expense");
  const [sheet, setSheet] = useState({ open: false, category: null, n: 0 });
  const open = (category = null) =>
    setSheet((s) => ({ open: true, category, n: s.n + 1 }));
  const close = () => setSheet((s) => ({ ...s, open: false }));

  const tops = categories.filter(
    (c) => !c.deletedAt && !c.parentId && c.type === type,
  );

  return (
    <div>
      <Link
        href="/more"
        className="-ml-2 inline-flex min-h-tap items-center text-accent"
      >
        <ChevronLeftIcon /> More
      </Link>
      <h1 className="sr-only">Categories</h1>
      <SegmentedControl
        label="Category type"
        className="mt-1 mb-5"
        value={type}
        onChange={setType}
        options={[
          { value: "expense", label: "Expense" },
          { value: "income", label: "Income" },
        ]}
      />

      {tops.length > 0 && (
        <ListGroup>
          {tops.map((cat) => (
            <ListRow
              key={cat.id}
              onClick={() => open(cat)}
              leading={<CategoryBadge icon={cat.icon} color={cat.color} />}
              title={cat.name}
              trailing={<EditHint />}
            />
          ))}
        </ListGroup>
      )}

      <Button variant="tinted" size="lg" onClick={() => open()}>
        Add category
      </Button>

      <CategorySheet key={sheet.n} state={sheet} type={type} onClose={close} />
    </div>
  );
}

// Subtle chevron: rows open an edit sheet.
function EditHint() {
  return (
    <span aria-hidden className="text-label-2">
      <ChevronRightIcon width="18" height="18" />
    </span>
  );
}
