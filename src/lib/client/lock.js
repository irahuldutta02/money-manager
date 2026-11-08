// Device-local app lock. The passcode is salted + PBKDF2-hashed in
// localStorage. This is a screen lock for this device, not server-side
// authentication.
const KEY = "mm.lock.v1";
const ITER = 150_000;

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function readLock() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? null;
  } catch {
    return null;
  }
}
function writeLock(v) {
  try {
    if (v) localStorage.setItem(KEY, JSON.stringify(v));
    else localStorage.removeItem(KEY);
  } catch {}
}

async function hash(code, salt) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(code),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITER },
    key,
    256,
  );
  return b64(bits);
}

export async function setPasscode(code) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  writeLock({
    salt: b64(salt),
    hash: await hash(code, salt),
    len: code.length,
    fails: 0,
    lockedUntil: 0,
  });
}

export const clearLock = () => writeLock(null);

/** Returns { ok, wait } where wait = seconds to wait after too many tries. */
export async function checkPasscode(code) {
  const l = readLock();
  if (!l) return { ok: true, wait: 0 };
  const now = Date.now();
  if (l.lockedUntil > now) {
    return { ok: false, wait: Math.ceil((l.lockedUntil - now) / 1000) };
  }
  const ok = (await hash(code, unb64(l.salt))) === l.hash;
  if (ok) {
    writeLock({ ...l, fails: 0, lockedUntil: 0 });
    return { ok: true, wait: 0 };
  }
  const fails = l.fails + 1;
  const wait = fails >= 5 ? 30 * 2 ** Math.min(fails - 5, 5) : 0;
  writeLock({ ...l, fails, lockedUntil: wait ? now + wait * 1000 : 0 });
  return { ok: false, wait };
}
