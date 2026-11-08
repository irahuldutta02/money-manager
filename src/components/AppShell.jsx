"use client";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TabBar } from "@/components/ui/TabBar";
import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmProvider } from "@/components/ui/Confirm";
import { TxSheetProvider, useTxSheet } from "@/components/AddTransactionSheet";
import { MetaProvider } from "@/lib/client/meta";
import { LockProvider } from "@/components/LockProvider";
import { authClient } from "@/lib/auth-client";

// Supports the PWA "Add expense" shortcut: /?add=expense opens the sheet.
function AddShortcut() {
  const params = useSearchParams();
  const router = useRouter();
  const sheet = useTxSheet();
  const wanted = params.get("add");
  useEffect(() => {
    if (!wanted) return;
    sheet.open({
      type: ["income", "transfer"].includes(wanted) ? wanted : "expense",
    });
    router.replace("/");
  }, [wanted, sheet, router]);
  return null;
}

// The session can end elsewhere (sign out on another device, "sign out other
// devices"). Better Auth re-checks it when the tab regains focus; once it is
// gone, leave instead of showing a stale signed-in screen.
function SessionGuard() {
  const { data, error, isPending } = authClient.useSession();
  const gone = !isPending && !error && !data?.user;
  useEffect(() => {
    // Hard navigation also clears the in-memory query cache.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (gone) location.assign("/sign-in");
  }, [gone]);
  return null;
}

export function AppShell({ children }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <LockProvider>
          <MetaProvider>
            <TxSheetProvider>
              <div className="lg:pl-72">
                <div className="mx-auto min-h-dvh max-w-2xl lg:max-w-3xl pt-[max(0.75rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] pb-[calc(env(safe-area-inset-bottom)+var(--spacing-tabbar)+1.5rem)] lg:pb-10">
                  {children}
                </div>
              </div>
              <TabBar />
              <SessionGuard />
              <Suspense>
                <AddShortcut />
              </Suspense>
            </TxSheetProvider>
          </MetaProvider>
        </LockProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
