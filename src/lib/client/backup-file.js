// Manual backup files (.mmbackup). A JSON envelope around the server's backup
// data; with a passcode the data is encrypted in the browser (PBKDF2 ->
// AES-GCM), so the passcode never leaves the device.

export const BACKUP_EXT = ".mmbackup";
const APP = "money-manager";
const ITERATIONS = 310000;

const b64 = (buf) => {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s);
};
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function keyFor(passcode, salt, iterations) {
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passcode),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Backup data -> file text. Empty passcode = plain (unencrypted) file. */
export async function encodeBackup(data, passcode) {
  if (!passcode) {
    return JSON.stringify({ app: APP, format: 1, encrypted: false, data });
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFor(passcode, salt, ITERATIONS);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(data)),
  );
  return JSON.stringify({
    app: APP,
    format: 1,
    encrypted: true,
    iterations: ITERATIONS,
    salt: b64(salt),
    iv: b64(iv),
    ciphertext: b64(ct),
  });
}

/** File text -> envelope (validated shape only). Throws a readable Error. */
export function parseBackupFile(text) {
  let env;
  try {
    env = JSON.parse(text);
  } catch {
    throw new Error("This is not a Money Manager backup file.");
  }
  if (env?.app !== APP || env.format !== 1) {
    throw new Error("This is not a Money Manager backup file.");
  }
  return env;
}

/** Envelope -> backup data. Needs the passcode when env.encrypted. */
export async function decodeBackup(env, passcode) {
  if (!env.encrypted) return env.data;
  if (!passcode) throw new Error("Enter the passcode for this backup.");
  try {
    const key = await keyFor(passcode, unb64(env.salt), env.iterations);
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: unb64(env.iv) },
      key,
      unb64(env.ciphertext),
    );
    return JSON.parse(new TextDecoder().decode(pt));
  } catch {
    throw new Error("Wrong passcode, or the file is damaged.");
  }
}
