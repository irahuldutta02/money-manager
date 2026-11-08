import "server-only";
import { auth } from "./auth";
import { ApiError } from "./api";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
export const KEEP_BACKUPS = 10;

const reconnect = () =>
  new ApiError(
    403,
    "Google Drive access expired. Reconnect Google Drive.",
    "drive_reconnect",
  );

/** True once the user has granted drive.appdata (incrementally, after sign-in). */
export async function isDriveConnected(headers) {
  const accounts = await auth.api.listUserAccounts({ headers });
  const g = accounts.find((a) => a.providerId === "google");
  return Boolean(g?.scopes?.includes(DRIVE_SCOPE));
}

/** A valid access token; Better Auth refreshes it server-side when needed. */
async function accessToken(headers) {
  if (!(await isDriveConnected(headers))) {
    throw new ApiError(
      403,
      "Connect Google Drive first.",
      "drive_not_connected",
    );
  }
  try {
    const t = await auth.api.getAccessToken({
      body: { providerId: "google" },
      headers,
    });
    if (!t?.accessToken) throw new Error("no token");
    return t.accessToken;
  } catch {
    throw reconnect();
  }
}

async function drive(headers, url, init = {}) {
  const token = await accessToken(headers);
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init.headers },
    cache: "no-store",
  });
  if (res.status === 401) throw reconnect();
  if (res.status === 403) {
    const body = await res.json().catch(() => null);
    const reason = body?.error?.errors?.[0]?.reason ?? "";
    if (/insufficient|forbidden|authError/i.test(reason)) throw reconnect();
    throw new ApiError(502, "Google Drive refused the request.", "drive_error");
  }
  if (!res.ok) {
    throw new ApiError(502, "Google Drive request failed.", "drive_error");
  }
  return res;
}

export async function listBackups(headers) {
  const qs = new URLSearchParams({
    spaces: "appDataFolder",
    orderBy: "createdTime desc",
    pageSize: "100",
    fields: "files(id,name,createdTime,size)",
  });
  const res = await drive(headers, `${API}/files?${qs}`);
  const { files = [] } = await res.json();
  return files.filter((f) => f.name.startsWith("money-manager-backup-"));
}

export async function uploadBackup(headers, name, data) {
  const boundary = `mm-${crypto.randomUUID()}`;
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name, parents: ["appDataFolder"] }) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
    JSON.stringify(data) +
    `\r\n--${boundary}--`;
  const res = await drive(
    headers,
    `${UPLOAD}/files?uploadType=multipart&fields=id,name,createdTime,size`,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  return res.json();
}

export async function downloadBackup(headers, fileId) {
  const res = await drive(
    headers,
    `${API}/files/${encodeURIComponent(fileId)}?alt=media`,
  );
  return res.json().catch(() => {
    throw new ApiError(400, "That backup file is not valid JSON.");
  });
}

/** Keep the newest KEEP_BACKUPS files; delete the rest. */
export async function pruneBackups(headers) {
  const files = await listBackups(headers);
  for (const f of files.slice(KEEP_BACKUPS)) {
    await drive(headers, `${API}/files/${encodeURIComponent(f.id)}`, {
      method: "DELETE",
    }).catch(() => {});
  }
  return files.slice(0, KEEP_BACKUPS);
}
