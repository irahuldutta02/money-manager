"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { CategoryBadge } from "@/components/ui/CategoryBadge";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { TextInput } from "@/components/ui/Field";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useErrorToast, useToast } from "@/components/ui/Toast";
import { ChevronLeftIcon } from "@/components/icons";
import { authClient } from "@/lib/auth-client";
import { apiFetch } from "@/lib/client/api";
import { invalidateAll, useQuery } from "@/lib/client/query";
import {
  BACKUP_EXT,
  decodeBackup,
  encodeBackup,
  parseBackupFile,
} from "@/lib/client/backup-file";

const MODES = [
  { value: "merge", label: "Merge" },
  { value: "replace", label: "Replace" },
];

function RestoreSheet({ file, onClose, intro, extra, buildBody, fixedMode }) {
  const toast = useToast();
  const [pickedMode, setMode] = useState("merge");
  const mode = fixedMode ?? pickedMode;
  const [busy, setBusy] = useState(false);
  const setError = useErrorToast();

  async function restore() {
    setBusy(true);
    setError(null);
    try {
      const r = await apiFetch("/api/backup/restore", {
        method: "POST",
        body: await buildBody(mode),
      });
      invalidateAll();
      onClose();
      const n = r.restored;
      toast.show({
        message: `Restored ${n.transactions} transactions, ${n.accounts} accounts`,
        duration: 4000,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      open={Boolean(file)}
      onClose={onClose}
      title="Restore backup"
      tall={false}
      footer={
        <Button
          size="lg"
          variant={mode === "replace" ? "danger" : "primary"}
          onClick={restore}
          loading={busy}
        >
          {mode === "replace" ? "Replace my data" : "Merge backup"}
        </Button>
      }
    >
      <div className="space-y-3 pt-2">
        <p className="text-label-2">{intro}</p>
        {extra}
        {!fixedMode && (
          <SegmentedControl
            label="Restore mode"
            value={mode}
            onChange={setMode}
            options={MODES}
          />
        )}
        <p className="text-sm text-label-2">
          {mode === "merge"
            ? "Adds records from the backup and skips anything that already exists (matched by ID). Nothing is deleted."
            : "Deletes ALL current accounts, categories, transactions, budgets, lending and net worth, then loads the backup. This cannot be undone."}
        </p>
      </div>
    </BottomSheet>
  );
}

function FileBackup() {
  const toast = useToast();
  const fileRef = useRef(null);
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const [imported, setImported] = useState(null); // { name, env }
  const [importPass, setImportPass] = useState("");

  async function exportFile() {
    setBusy(true);
    try {
      const data = await apiFetch("/api/backup/export");
      const text = await encodeBackup(data, passcode);
      const url = URL.createObjectURL(
        new Blob([text], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `money-manager-${new Date().toISOString().slice(0, 10)}${BACKUP_EXT}`;
      a.click();
      URL.revokeObjectURL(url);
      const encrypted = Boolean(passcode);
      setPasscode("");
      toast.show({
        message: encrypted
          ? "Encrypted backup saved"
          : `Backed up ${data.transactions.length} transactions`,
        duration: 3500,
      });
    } catch (e) {
      toast.show({ message: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function pickFile(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const env = parseBackupFile(await f.text());
      setImportPass("");
      setImported({ name: f.name, env });
    } catch (err) {
      toast.show({ message: err.message });
    }
  }

  return (
    <div className="space-y-6 pt-2">
      <ListGroup
        header="Save to this device"
        footer="Saves everything (accounts, categories, transactions, budgets, lending, net worth and receipts) as a .mmbackup file. Add a passcode to encrypt it; leave it empty for a plain file. If you forget the passcode the file cannot be opened."
      >
        <div className="space-y-3 p-4">
          <TextInput
            id="backup-passcode"
            label="Passcode (optional)"
            type="password"
            autoComplete="new-password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="No passcode"
          />
          <Button size="lg" onClick={exportFile} loading={busy}>
            Export backup file
          </Button>
        </div>
      </ListGroup>

      <ListGroup
        header="Restore from a file"
        footer="Importing replaces everything in this account (accounts, categories, transactions, budgets, lending and net worth) with the contents of the file. This cannot be undone."
      >
        <div className="p-4">
          <input
            ref={fileRef}
            type="file"
            accept={`${BACKUP_EXT},application/json`}
            onChange={pickFile}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
          />
          <Button
            size="lg"
            variant="tinted"
            onClick={() => fileRef.current?.click()}
          >
            Import backup file
          </Button>
        </div>
      </ListGroup>

      <RestoreSheet
        key={imported?.name ?? "none"}
        file={imported}
        onClose={() => setImported(null)}
        intro={imported ? `File: ${imported.name}` : ""}
        extra={
          imported?.env.encrypted ? (
            <TextInput
              id="import-passcode"
              label="Passcode"
              type="password"
              autoComplete="off"
              value={importPass}
              onChange={(e) => setImportPass(e.target.value)}
              placeholder="Passcode for this backup"
            />
          ) : null
        }
        fixedMode="replace"
        buildBody={async (mode) => ({
          data: await decodeBackup(imported.env, importPass),
          mode,
        })}
      />
    </div>
  );
}

export function BackupScreen() {
  return (
    <div>
      <Link
        href="/more"
        className="-ml-2 inline-flex min-h-tap items-center text-accent"
      >
        <ChevronLeftIcon /> More
      </Link>
      <h1 className="mb-2 text-[2rem] leading-tight font-bold tracking-tight">
        Backup &amp; restore
      </h1>
      <FileBackup />
    </div>
  );
}
