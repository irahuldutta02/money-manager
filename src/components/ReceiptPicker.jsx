"use client";
import { useErrorToast } from "@/components/ui/Toast";
import { useRef, useState } from "react";
import { CloseIcon } from "@/components/icons";
import { fileToReceipt } from "@/lib/client/image";

export const MAX_RECEIPTS = 3;

/** Up to 3 receipt photos, stored as base64 on the transaction. */
export function ReceiptPicker({ value, onChange, loading }) {
  const input = useRef(null);
  const setError = useErrorToast();
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState(null);

  async function add(e) {
    const files = [...(e.target.files ?? [])].slice(
      0,
      MAX_RECEIPTS - value.length,
    );
    e.target.value = "";
    if (!files.length) return;
    setError(null);
    setBusy(true);
    try {
      const added = [];
      for (const f of files) added.push(await fileToReceipt(f));
      onChange([...value, ...added]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <span className="mb-0.5 block text-[0.8125rem] font-medium text-label-2">
        Receipts ({value.length}/{MAX_RECEIPTS})
      </span>
      <div className="flex flex-wrap gap-2">
        {value.map((src, i) => (
          <div key={i} className="relative size-16">
            <button
              type="button"
              aria-label={`View receipt ${i + 1}`}
              onClick={() => setView(src)}
              className="size-16 overflow-hidden rounded-control bg-fill"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="size-full object-cover" />
            </button>
            <button
              type="button"
              aria-label={`Remove receipt ${i + 1}`}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              // Small visual badge, but the ::before keeps a 44px tap area.
              className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur-sm before:absolute before:-inset-3 before:content-['']"
            >
              <CloseIcon width="12" height="12" aria-hidden />
            </button>
          </div>
        ))}
        {value.length < MAX_RECEIPTS && (
          <button
            type="button"
            disabled={busy || loading}
            onClick={() => input.current?.click()}
            className="flex size-16 items-center justify-center rounded-control bg-fill text-center text-xs font-medium text-accent disabled:opacity-40"
          >
            {busy ? "…" : loading ? "Loading" : "+ Photo"}
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={add}
      />
      {view && (
        <div
          role="dialog"
          aria-label="Receipt"
          onClick={() => setView(null)}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={view}
            alt="Receipt"
            className="max-h-full max-w-full rounded-control object-contain"
          />
          <button
            type="button"
            aria-label="Close"
            className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 flex min-h-tap min-w-tap items-center justify-center rounded-pill bg-white/20 text-2xl text-white"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
