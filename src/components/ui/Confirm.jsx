"use client";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/Button";

const ConfirmContext = createContext(null);

/**
 * const confirm = useConfirm();
 * if (!(await confirm({ title, message, confirmLabel }))) return;
 *
 * Rendered in a native modal <dialog>, so it stacks above open bottom sheets.
 */
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}

export function ConfirmProvider({ children }) {
  const [opts, setOpts] = useState(null);
  const resolver = useRef(null);
  const dialogRef = useRef(null);

  const confirm = useCallback(
    (o) =>
      new Promise((resolve) => {
        resolver.current?.(false);
        resolver.current = resolve;
        setOpts(o);
      }),
    [],
  );

  const finish = (result) => {
    resolver.current?.(result);
    resolver.current = null;
    setOpts(null);
  };

  // Open the dialog as soon as it mounts.
  const setRef = (el) => {
    dialogRef.current = el;
    if (el && !el.open) el.showModal();
  };

  return (
    <ConfirmContext value={confirm}>
      {children}
      {opts && (
        <dialog
          ref={setRef}
          aria-labelledby="confirm-title"
          aria-describedby="confirm-msg"
          onCancel={(e) => {
            e.preventDefault();
            finish(false);
          }}
          className="fixed inset-0 m-auto w-[min(22rem,calc(100vw-2rem))] rounded-card border border-separator bg-surface p-5 text-label shadow-2xl backdrop:bg-overlay"
        >
          <h2 id="confirm-title" className="text-lg font-semibold">
            {opts.title ?? "Are you sure?"}
          </h2>
          {opts.message && (
            <p
              id="confirm-msg"
              className="mt-1.5 text-[0.9375rem] text-label-2"
            >
              {opts.message}
            </p>
          )}
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button
              variant="tinted"
              size="lg"
              autoFocus
              onClick={() => finish(false)}
            >
              {opts.cancelLabel ?? "Cancel"}
            </Button>
            <Button variant="danger" size="lg" onClick={() => finish(true)}>
              {opts.confirmLabel ?? "Delete"}
            </Button>
          </div>
        </dialog>
      )}
    </ConfirmContext>
  );
}
