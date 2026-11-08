"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { apiFetch } from "./api";

// A tiny stale-while-revalidate cache keyed by URL. Used instead of adding
// SWR/React Query: Phase 1 only needs fetch + refetch-after-mutation.

const store = new Map();
const IDLE = { data: undefined, error: null, loading: false, fetched: false };

function getEntry(key) {
  let e = store.get(key);
  if (!e) {
    e = { snap: IDLE, subs: new Set(), inflight: null };
    store.set(key, e);
  }
  return e;
}

function update(e, patch) {
  e.snap = { ...e.snap, ...patch };
  e.subs.forEach((fn) => fn());
}

export function refetch(key) {
  const e = getEntry(key);
  if (e.inflight) return e.inflight;
  update(e, { loading: true });
  e.inflight = apiFetch(key)
    .then((data) =>
      update(e, { data, error: null, loading: false, fetched: true }),
    )
    .catch((error) => update(e, { error, loading: false, fetched: true }))
    .finally(() => {
      e.inflight = null;
    });
  return e.inflight;
}

/** After any mutation: refresh what's on screen, mark the rest stale. */
export function invalidateAll() {
  for (const [key, e] of store) {
    if (e.subs.size > 0) refetch(key);
    else e.snap = { ...e.snap, fetched: false };
  }
}

/**
 * useQuery(url) -> { data, error, loading }
 * Keeps showing previous data while refetching (no flicker / layout shift).
 * Pass null to skip. With keepPrevious, a key change (e.g. "show more")
 * keeps the old data on screen until the new key's data arrives.
 */
export function useQuery(key, { keepPrevious = false } = {}) {
  const subscribe = (fn) => {
    if (!key) return () => {};
    const e = getEntry(key);
    e.subs.add(fn);
    return () => e.subs.delete(fn);
  };
  const snap = useSyncExternalStore(
    subscribe,
    () => (key ? getEntry(key).snap : IDLE),
    () => IDLE,
  );

  // Last data we had for this hook (set-state-in-render is React's pattern
  // for derived "previous value" state).
  const [prev, setPrev] = useState(undefined);
  if (keepPrevious && snap.data !== undefined && prev !== snap.data) {
    setPrev(snap.data);
  }
  const data =
    snap.data === undefined && keepPrevious && key ? prev : snap.data;

  useEffect(() => {
    if (!key) return;
    const e = getEntry(key);
    if (!e.snap.fetched && !e.inflight) refetch(key);
  }, [key]);

  return {
    data,
    error: snap.error,
    // "loading" = nothing to show yet (first load), not a background refresh.
    loading: Boolean(key) && data === undefined && !snap.error,
    refreshing: snap.loading,
    retry: () => key && refetch(key),
  };
}
