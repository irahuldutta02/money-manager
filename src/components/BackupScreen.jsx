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

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";

const SOURCES = [
  { value: "drive", label: "Google Drive" },
  { value: "file", label: "Manual file" },
];

const MODES = [
  { value: "merge", label: "Merge" },
  { value: "replace", label: "Replace" },
];

const when = (iso) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));

const kb = (n) => (n ? `${Math.max(1, Math.round(Number(n) / 1024))} KB` : "");

/** Asks Google for drive.appdata (offline), returning here afterwards. */
async function connectDrive() {
  const { error } = await authClient.linkSocial({
    provider: "google",
    scopes: [DRIVE_SCOPE],
    callbackURL: "/more/backup",
    errorCallbackURL: "/more/backup?drive=error",
    // offline + consent => Google returns a refresh token for server-side refresh.
    additionalParams: { access_type: "offline", prompt: "consent" },
  });
  if (error) throw new Error(error.message ?? "Could not start Google sign-in");
}

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
        body: buildBody ? await buildBody(mode) : { fileId: file.id, mode },
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
        <p className="text-label-2">
          {intro ?? (file ? `Backup from ${when(file.createdTime)}.` : "")}
        </p>
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
            : "Deletes ALL current accounts, categories, transactions and budgets, then loads the backup. This cannot be undone."}
        </p>
      </div>
    </BottomSheet>
  );
}

function DriveBackup() {
  const toast = useToast();
  const { data, error, loading, retry } = useQuery("/api/backup");
  const [busy, setBusy] = useState(false);
  const [restoreFile, setRestoreFile] = useState(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);

  const reconnectNeeded = needsReconnect || error?.code === "drive_reconnect";

  async function connect() {
    setBusy(true);
    try {
      await connectDrive();
    } catch (e) {
      toast.show({ message: e.message });
      setBusy(false);
    }
  }

  async function backupNow() {
    setBusy(true);
    try {
      const r = await apiFetch("/api/backup", { method: "POST" });
      toast.show({
        message: `Backed up ${r.counts.transactions} transactions`,
        duration: 3500,
      });
      retry();
    } catch (e) {
      if (e.code === "drive_reconnect") setNeedsReconnect(true);
      else toast.show({ message: e.message });
    } finally {
      setBusy(false);
    }
  }

  let body;
  if (loading) {
    body = (
      <div aria-busy="true" className="space-y-3 pt-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  } else if (reconnectNeeded) {
    body = (
      <EmptyState
        icon="alert"
        title="Reconnect Google Drive"
        message="Google Drive access expired or was revoked. Reconnect to back up and restore."
        actionLabel={busy ? "Opening Google…" : "Reconnect Google Drive"}
        onAction={connect}
      />
    );
  } else if (error && !data) {
    body = <ErrorState message={error.message} onRetry={retry} />;
  } else if (!data.connected) {
    body = (
      <EmptyState
        icon="landmark"
        title="Back up to Google Drive"
        message="Your backups live in a private app folder on your Drive that only this app can see. Nothing is uploaded until you tap Back up."
        actionLabel={busy ? "Opening Google…" : "Connect Google Drive"}
        onAction={connect}
      />
    );
  } else {
    body = (
      <>
        <Button size="lg" onClick={backupNow} loading={busy} className="mb-6">
          Back up now
        </Button>
        {data.backups.length === 0 ? (
          <EmptyState
            icon="receipt"
            title="No backups yet"
            message="Tap Back up now to save a copy of your data."
          />
        ) : (
          <ListGroup
            header="Backups"
            footer="The 10 most recent backups are kept; older ones are deleted automatically. Tap one to restore."
          >
            {data.backups.map((f) => (
              <ListRow
                key={f.id}
                onClick={() => setRestoreFile(f)}
                leading={<CategoryBadge icon="receipt" color="blue" />}
                title={when(f.createdTime)}
                subtitle={kb(f.size)}
              />
            ))}
          </ListGroup>
        )}
      </>
    );
  }

  return (
    <>
      {body}
      <RestoreSheet
        key={restoreFile?.id ?? "none"}
        file={restoreFile}
        onClose={() => setRestoreFile(null)}
      />
    </>
  );
}

function ManualBackup() {
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
        footer="Saves everything (accounts, categories, transactions, budgets and receipts) as a .mmbackup file. Add a passcode to encrypt it; leave it empty for a plain file. If you forget the passcode the file cannot be opened."
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
        footer="Importing replaces everything in this account (accounts, categories, transactions and budgets) with the contents of the file. This cannot be undone."
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
  const [source, setSource] = useState("drive");
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
      <SegmentedControl
        label="Backup type"
        className="mb-4"
        options={SOURCES}
        value={source}
        onChange={setSource}
      />
      {source === "drive" ? <DriveBackup /> : <ManualBackup />}
    </div>
  );
}
