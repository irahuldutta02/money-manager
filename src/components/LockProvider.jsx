"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Delete } from "lucide-react";
import { readLock, checkPasscode } from "@/lib/client/lock";

const LockContext = createContext(null);

const RELOCK_AFTER_MS = 30_000;

function LockScreen({ onUnlock }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  async function submit(next) {
    setBusy(true);
    const r = await checkPasscode(next);
    setBusy(false);
    if (r.ok) return onUnlock();
    setCode("");
    setError(
      r.wait
        ? `Too many tries. Wait ${r.wait}s.`
        : "Wrong passcode. Try again.",
    );
  }

  const len = readLock()?.len ?? 4;

  function press(d) {
    if (busy) return;
    setError(null);
    const next = (code + d).slice(0, len);
    setCode(next);
    if (next.length === len) submit(next);
  }

  // Physical keyboard: digits and Backspace.
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") setCode((c) => c.slice(0, -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  const keyCls =
    "flex size-[4.5rem] items-center justify-center rounded-pill bg-fill text-2xl font-medium active:bg-accent-soft";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="App locked"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 bg-[var(--bg)] px-6 pt-safe pb-safe"
    >
      <h1 className="text-xl font-semibold">Enter passcode</h1>
      <div className="flex h-4 gap-3" aria-hidden>
        {Array.from({ length: len }, (_, i) => (
          <span
            key={i}
            className={
              "size-3.5 rounded-full border-2 border-accent " +
              (i < code.length ? "bg-accent" : "")
            }
          />
        ))}
      </div>
      <p role="alert" className="h-5 text-sm font-medium text-danger">
        {error}
      </p>
      <div className="grid grid-cols-3 gap-4">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            className={keyCls}
            onClick={() => press(k)}
          >
            {k}
          </button>
        ))}
        <button
          type="button"
          className="flex size-[4.5rem] items-center justify-center rounded-pill text-sm font-medium text-label-2 active:bg-fill"
          onClick={() => {
            setCode("");
            setError(null);
          }}
        >
          Reset
        </button>
        <button type="button" className={keyCls} onClick={() => press("0")}>
          0
        </button>
        <button
          type="button"
          className="flex size-[4.5rem] items-center justify-center rounded-pill text-label-2 active:bg-fill"
          aria-label="Delete"
          onClick={() => setCode((c) => c.slice(0, -1))}
        >
          <Delete size={28} strokeWidth={1.8} aria-hidden />
        </button>
      </div>
    </div>
  );
}

/**
 * Covers the app while locked. Locks on open and after the app has been in the
 * background for 30s. Children stay mounted (so no state is lost) but are
 * inert + hidden from assistive tech while the lock screen is up.
 */
export function LockProvider({ children }) {
  const [locked, setLocked] = useState(null); // null = not checked yet
  const hiddenAt = useRef(0);

  useEffect(() => {
    // Reading localStorage must wait until after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocked(Boolean(readLock()));
    const onVis = () => {
      if (document.hidden) hiddenAt.current = Date.now();
      else if (
        hiddenAt.current &&
        Date.now() - hiddenAt.current > RELOCK_AFTER_MS &&
        readLock()
      ) {
        setLocked(true);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const lockNow = useCallback(() => readLock() && setLocked(true), []);
  const unlock = useCallback(() => setLocked(false), []);

  return (
    <LockContext value={{ lockNow }}>
      <div inert={locked !== false} aria-hidden={locked !== false}>
        {children}
      </div>
      {locked === null && (
        <div className="fixed inset-0 z-[100] bg-[var(--bg)]" aria-hidden />
      )}
      {locked === true && <LockScreen onUnlock={unlock} />}
    </LockContext>
  );
}
