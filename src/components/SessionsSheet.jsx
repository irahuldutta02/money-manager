"use client";
import { useCallback, useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/Confirm";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { authClient } from "@/lib/auth-client";

const when = (d) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(d));

/** Loopback addresses (dev server) read better as "Local" than as zeros. */
function describeIp(ip) {
  if (!ip) return "";
  if (
    /^(::1?|0{1,4}(:0{1,4}){7}|0{1,4}(:0{1,4}){6}:0{0,3}1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/i.test(
      ip,
    )
  ) {
    return "Local";
  }
  return ip;
}

/** Turns a user-agent string into "Chrome on macOS". */
function describeDevice(ua = "") {
  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /opr\/|opera/i.test(ua)
      ? "Opera"
      : /firefox|fxios/i.test(ua)
        ? "Firefox"
        : /chrome|crios/i.test(ua)
          ? "Chrome"
          : /safari/i.test(ua)
            ? "Safari"
            : "Browser";
  const os = /iphone|ipad|ios/i.test(ua)
    ? "iOS"
    : /android/i.test(ua)
      ? "Android"
      : /windows/i.test(ua)
        ? "Windows"
        : /mac os|macintosh/i.test(ua)
          ? "macOS"
          : /linux/i.test(ua)
            ? "Linux"
            : "unknown device";
  return `${browser} on ${os}`;
}

/** Lists every signed-in device; sign out one, the others, or all of them. */
export function SessionsSheet({ open, onClose }) {
  const toast = useToast();
  const askConfirm = useConfirm();
  const { data: current } = authClient.useSession();
  const [sessions, setSessions] = useState(null);
  const [busy, setBusy] = useState(false);

  const currentToken = current?.session?.token;

  const load = useCallback(async () => {
    const { data, error } = await authClient.listSessions();
    if (error) {
      toast.show({ message: error.message || "Couldn't load sessions." });
      return;
    }
    setSessions(
      [...data].sort(
        (a, b) =>
          (b.token === currentToken) - (a.token === currentToken) ||
          new Date(b.createdAt) - new Date(a.createdAt),
      ),
    );
  }, [toast, currentToken]);

  useEffect(() => {
    if (!open) return;
    // Fetch the latest list each time the sheet opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSessions(null);
    load();
  }, [open, load]);

  async function revokeOne(s) {
    const ok = await askConfirm({
      title: "Sign out this device?",
      message: describeDevice(s.userAgent),
      confirmLabel: "Sign out",
    });
    if (!ok) return;
    const { error } = await authClient.revokeSession({ token: s.token });
    if (error) {
      toast.show({ message: error.message || "Couldn't sign it out." });
      return;
    }
    load();
  }

  async function revokeOthers() {
    const ok = await askConfirm({
      title: "Sign out other devices?",
      message: "Every device except this one will be signed out.",
      confirmLabel: "Sign out",
    });
    if (!ok) return;
    setBusy(true);
    const { error } = await authClient.revokeOtherSessions();
    setBusy(false);
    if (error) {
      toast.show({ message: error.message || "Couldn't sign them out." });
      return;
    }
    toast.show({ message: "Signed out of other devices", duration: 3000 });
    load();
  }

  async function revokeAll() {
    const ok = await askConfirm({
      title: "Sign out everywhere?",
      message: "You'll be signed out on every device, including this one.",
      confirmLabel: "Sign out",
    });
    if (!ok) return;
    setBusy(true);
    const { error } = await authClient.revokeSessions();
    if (error) {
      setBusy(false);
      toast.show({ message: error.message || "Couldn't sign out." });
      return;
    }
    // Full load so no signed-in page is served from the client cache.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    location.assign("/sign-in");
  }

  const others = sessions?.filter((s) => s.token !== currentToken) ?? [];

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Signed-in devices"
      tall={false}
      footer={
        <div className="space-y-2">
          <Button
            size="lg"
            variant="tinted"
            onClick={revokeOthers}
            loading={busy}
            disabled={others.length === 0}
          >
            Sign out other devices
          </Button>
          <Button
            size="lg"
            variant="danger"
            onClick={revokeAll}
            disabled={busy}
          >
            Sign out everywhere
          </Button>
        </div>
      }
    >
      <div className="pt-2">
        {sessions === null ? (
          <div aria-busy="true" className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <ListGroup>
            {sessions.map((s) => {
              const isCurrent = s.token === currentToken;
              return (
                <ListRow
                  key={s.id}
                  title={describeDevice(s.userAgent)}
                  subtitle={[
                    isCurrent && "This device",
                    describeIp(s.ipAddress),
                    when(s.createdAt),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  trailing={
                    isCurrent ? null : (
                      <button
                        type="button"
                        onClick={() => revokeOne(s)}
                        className="min-h-tap rounded-control px-3 text-[0.9375rem] font-medium text-danger hover:bg-fill"
                      >
                        Sign out
                      </button>
                    )
                  }
                />
              );
            })}
          </ListGroup>
        )}
      </div>
    </BottomSheet>
  );
}
