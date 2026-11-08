"use client";
import { useErrorToast } from "@/components/ui/Toast";
import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useConfirm } from "@/components/ui/Confirm";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/Field";
import {
  checkPasscode,
  clearLock,
  readLock,
  setPasscode,
} from "@/lib/client/lock";

const PIN_RE = /^\d{4,6}$/;
const digits = (v) => v.replace(/\D/g, "").slice(0, 6);

/** Set / change / remove the passcode. */
export function AppLockSheet({ open, onClose, onChanged }) {
  const askConfirm = useConfirm();
  const [lock, setLock] = useState(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const setError = useErrorToast();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Refresh from localStorage each time the sheet opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLock(readLock());
    setCurrent("");
    setNext("");
    setConfirm("");
  }, [open]);

  const enabled = Boolean(lock);

  async function run(fn, done) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setLock(readLock());
      onChanged?.();
      done?.();
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCurrent() {
    const r = await checkPasscode(current);
    if (!r.ok) {
      throw new Error(
        r.wait
          ? `Too many tries. Wait ${r.wait}s.`
          : "Current passcode is wrong.",
      );
    }
  }

  const save = () =>
    run(async () => {
      if (enabled) await verifyCurrent();
      if (!PIN_RE.test(next)) throw new Error("Use 4 to 6 digits.");
      if (next !== confirm) throw new Error("Passcodes don't match.");
      await setPasscode(next);
    }, onClose);

  const remove = async () => {
    if (
      !(await askConfirm({
        title: "Remove passcode?",
        message: "The app will no longer lock on this device.",
        confirmLabel: "Remove",
      }))
    )
      return;
    run(async () => {
      await verifyCurrent();
      clearLock();
    }, onClose);
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="App lock"
      tall={false}
      footer={
        <Button size="lg" onClick={save} loading={busy}>
          {enabled ? "Change passcode" : "Turn on passcode"}
        </Button>
      }
    >
      <div className="space-y-2.5 pt-2">
        <p className="text-sm text-label-2">
          Locks this device when you open the app or return after 30 seconds.
          The passcode never leaves this device; if you forget it, sign out and
          back in after clearing site data.
        </p>
        {enabled && (
          <TextInput
            id="lock-current"
            label="Current passcode"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={current}
            onChange={(e) => setCurrent(digits(e.target.value))}
          />
        )}
        <TextInput
          id="lock-new"
          label="New passcode (4–6 digits)"
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(digits(e.target.value))}
        />
        <TextInput
          id="lock-confirm"
          label="Confirm passcode"
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(digits(e.target.value))}
        />
        {enabled && (
          <Button variant="danger" size="lg" onClick={remove} disabled={busy}>
            Remove passcode
          </Button>
        )}
      </div>
    </BottomSheet>
  );
}
