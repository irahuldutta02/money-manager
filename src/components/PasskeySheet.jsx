"use client";
import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/Confirm";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { useToast } from "@/components/ui/Toast";
import { authClient } from "@/lib/auth-client";

const when = (d) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(d),
  );

/** List, add and remove passkeys for the signed-in user. */
export function PasskeySheet({ open, onClose }) {
  const toast = useToast();
  const askConfirm = useConfirm();
  const { data: passkeys, isPending, refetch } = authClient.useListPasskeys();
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    const { error } = await authClient.passkey.addPasskey({
      // Ask for the built-in authenticator (Touch ID / Mac screen lock) rather
      // than offering phones and security keys first.
      authenticatorAttachment: "platform",
      name: `Passkey ${new Date().toLocaleDateString()}`,
    });
    setBusy(false);
    if (error) {
      // The user dismissing the browser prompt is not worth an error toast.
      if (!/cancel|abort|not allowed/i.test(error.message ?? "")) {
        toast.show({ message: error.message || "Couldn't add passkey." });
      }
      return;
    }
    refetch();
    toast.show({ message: "Passkey added", duration: 3000 });
  }

  async function remove(p) {
    const ok = await askConfirm({
      title: "Remove passkey?",
      message: `"${p.name || "Passkey"}" will no longer sign you in.`,
      confirmLabel: "Remove",
    });
    if (!ok) return;
    const { error } = await authClient.$fetch("/passkey/delete-passkey", {
      method: "POST",
      body: { id: p.id },
    });
    if (error) {
      toast.show({ message: error.message || "Couldn't remove it." });
      return;
    }
    refetch();
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Passkeys"
      tall={false}
      footer={
        <Button size="lg" onClick={add} loading={busy}>
          Add a passkey
        </Button>
      }
    >
      <div className="space-y-3 pt-2">
        <p className="text-sm text-label-2">
          Sign in with your fingerprint, face or screen lock instead of Google.
          Your biometrics never leave your device.
        </p>
        {!isPending && passkeys?.length > 0 && (
          <ListGroup header="Your passkeys">
            {passkeys.map((p) => (
              <ListRow
                key={p.id}
                title={p.name || "Passkey"}
                subtitle={p.createdAt ? `Added ${when(p.createdAt)}` : null}
                trailing={
                  <button
                    type="button"
                    onClick={() => remove(p)}
                    className="min-h-tap rounded-control px-3 text-[0.9375rem] font-medium text-danger hover:bg-fill"
                  >
                    Remove
                  </button>
                }
              />
            ))}
          </ListGroup>
        )}
      </div>
    </BottomSheet>
  );
}
