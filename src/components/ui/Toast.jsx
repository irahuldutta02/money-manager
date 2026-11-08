"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

/** Returns a setError-style function that surfaces messages as a toast. */
export function useErrorToast() {
  const { show } = useToast();
  return useCallback(
    (message) => message && show({ message, duration: 4000 }),
    [show],
  );
}

/** Undo toast instead of confirm dialogs. show({ message, actionLabel, onAction }) */
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const seq = useRef(0);
  const box = useRef(null);

  // Re-showing moves the popover above any dialog opened since the last toast.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    try {
      if (el.matches(":popover-open")) el.hidePopover();
      if (toast) el.showPopover();
    } catch {}
  }, [toast]);

  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    setToast(null);
  }, []);

  const show = useCallback((t) => {
    clearTimeout(timer.current);
    seq.current += 1;
    setToast({ ...t, id: seq.current });
    timer.current = setTimeout(() => setToast(null), t.duration ?? 6000);
  }, []);

  return (
    <ToastContext value={{ show, dismiss }}>
      {children}
      {/* Always-mounted live region so screen readers announce changes. */}
      <div role="status" aria-live="polite" className="sr-only">
        {toast?.message}
      </div>
      {/* A popover lives in the top layer, so it shows above open sheets
          (native <dialog> modals), unlike a plain fixed element. */}
      <div
        ref={box}
        popover="manual"
        aria-hidden
        className={
          "pointer-events-none fixed inset-x-0 m-0 h-auto w-auto overflow-visible border-0 bg-transparent p-0 " +
          // Undo toasts sit above the tab bar; plain messages (errors) drop in
          // from the top so they never cover the form being filled in.
          (toast?.actionLabel
            ? "top-auto bottom-[calc(env(safe-area-inset-bottom)+10.5rem)]"
            : "top-[max(0.75rem,env(safe-area-inset-top))] bottom-auto")
        }
      >
        {toast ? (
          <div className="flex justify-center px-gutter">
            <div
              key={toast.id}
              className="pointer-events-auto flex min-h-tap max-w-md items-center gap-3 rounded-pill border border-separator bg-surface-2 py-1 pr-1 pl-5 text-[0.9375rem] shadow-[0_8px_24px_rgb(0_0_0/0.28)]"
            >
              <span className="min-w-0 flex-1 py-2 pr-4 font-medium">
                {toast.message}
              </span>
              {toast.actionLabel ? (
                <button
                  type="button"
                  onClick={() => {
                    dismiss();
                    toast.onAction?.();
                  }}
                  className="min-h-tap rounded-pill px-4 font-semibold underline-offset-2 hover:underline"
                >
                  {toast.actionLabel}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </ToastContext>
  );
}
