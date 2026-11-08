"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { ChevronRightIcon } from "@/components/icons";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/Confirm";
import { AppLockSheet } from "@/components/AppLockSheet";
import { ExportSheet } from "@/components/ExportSheet";
import { ThemeSheet } from "@/components/ThemeSheet";
import { THEMES, readTheme } from "@/lib/client/theme";
import { readLock } from "@/lib/client/lock";
import { authClient } from "@/lib/auth-client";
import { apiFetch } from "@/lib/client/api";
import { invalidateAll } from "@/lib/client/query";
import { useMeta } from "@/lib/client/meta";

const Chevron = () => (
  <span className="text-label-2">
    <ChevronRightIcon width="18" height="18" />
  </span>
);

export function MoreScreen() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { currency } = useMeta();
  const { data: session } = authClient.useSession();
  const [busy, setBusy] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [lockOpen, setLockOpen] = useState(false);
  const [lockOn, setLockOn] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [themeId, setThemeId] = useState("glass");
  useEffect(() => {
    // localStorage is only readable after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLockOn(Boolean(readLock()));

    setThemeId(readTheme());
  }, []);

  async function recompute() {
    setBusy(true);
    try {
      await apiFetch("/api/accounts/recompute", { method: "POST" });
      invalidateAll();
      toast.show({
        message: "Balances rebuilt from transactions",
        duration: 3000,
      });
    } catch (e) {
      toast.show({ message: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await authClient.signOut();
    // Hard navigation on purpose: drops all cached user data from memory.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    location.assign("/sign-in");
  }

  async function deleteAccount() {
    const ok = await confirm({
      title: "Delete account?",
      message:
        "This permanently deletes your account and all transactions, accounts, categories and budgets. This can't be undone. Export a backup first if you might need it.",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await apiFetch("/api/account", { method: "DELETE" });
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      location.assign("/sign-in");
    } catch (e) {
      toast.show({ message: e.message });
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="sr-only">More</h1>

      <ListGroup>
        <ListRow
          title={session?.user?.name ?? "Signed in"}
          subtitle={session?.user?.email}
        />
      </ListGroup>

      <ListGroup header="Manage">
        <ListRow
          title="Accounts"
          onClick={() => router.push("/more/accounts")}
          trailing={<Chevron />}
        />
        <ListRow
          title="Categories"
          onClick={() => router.push("/more/categories")}
          trailing={<Chevron />}
        />
        <ListRow
          title="Appearance"
          onClick={() => setThemeOpen(true)}
          trailing={
            <span className="text-label-2">
              {THEMES.find((t) => t.id === themeId)?.name}
            </span>
          }
        />
        <ListRow
          title="Currency"
          trailing={<span className="text-label-2">{currency}</span>}
        />
      </ListGroup>

      <ListGroup header="Data & security">
        <ListRow
          title="Backup & restore"
          subtitle="Google Drive or a file on this device"
          onClick={() => router.push("/more/backup")}
          trailing={<Chevron />}
        />
        <ListRow
          title="Export CSV"
          onClick={() => setExportOpen(true)}
          trailing={<Chevron />}
        />
        <ListRow
          title="App lock"
          onClick={() => setLockOpen(true)}
          trailing={
            <span className="text-label-2">{lockOn ? "On" : "Off"}</span>
          }
        />
      </ListGroup>

      <ListGroup
        header="Maintenance"
        footer="Recalculates each account balance from its starting balance and active transactions."
      >
        <ListRow
          title={busy ? "Rebuilding…" : "Rebuild balances"}
          className="text-accent"
          onClick={busy ? undefined : recompute}
        />
      </ListGroup>

      <ListGroup footer="Permanently deletes your account and all your data.">
        <ListRow title="Sign out" className="text-danger" onClick={signOut} />
        <ListRow
          title="Delete account"
          className="text-danger"
          onClick={busy ? undefined : deleteAccount}
        />
      </ListGroup>
      <ThemeSheet
        open={themeOpen}
        onClose={() => setThemeOpen(false)}
        onChanged={() => setThemeId(readTheme())}
      />
      <ExportSheet open={exportOpen} onClose={() => setExportOpen(false)} />
      <AppLockSheet
        open={lockOpen}
        onClose={() => setLockOpen(false)}
        onChanged={() => setLockOn(Boolean(readLock()))}
      />
    </div>
  );
}
