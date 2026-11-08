"use client";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TabBar } from "@/components/ui/TabBar";
import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmProvider } from "@/components/ui/Confirm";
import { TxSheetProvider, useTxSheet } from "@/components/AddTransactionSheet";
import { MetaProvider } from "@/lib/client/meta";
import { LockProvider } from "@/components/LockProvider";

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
