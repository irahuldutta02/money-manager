import { ApiError } from "./api";

const ID_RE = /^[a-f0-9]{24}$/;
export const MAX_AMOUNT = 100_000_000_000_000; // minor units, well below 2^53

export const isId = (v) => typeof v === "string" && ID_RE.test(v);

export function id(v, field) {
  if (!isId(v)) throw new ApiError(400, `${field} is invalid`);
  return v;
}

export function optionalId(v, field) {
  return v == null || v === "" ? null : id(v, field);
}

export function str(v, field, { min = 1, max = 100, optional = false } = {}) {
  if (v == null || v === "") {
    if (optional) return "";
    throw new ApiError(400, `${field} is required`);
  }
  if (typeof v !== "string") throw new ApiError(400, `${field} is invalid`);
  const s = v.trim();
  if (s.length < min && !(optional && s.length === 0)) {
    throw new ApiError(400, `${field} is required`);
  }
  if (s.length > max) {
    throw new ApiError(400, `${field} must be at most ${max} characters`);
  }
  return s;
}

export function oneOf(v, field, allowed) {
  if (!allowed.includes(v)) {
    throw new ApiError(400, `${field} must be one of: ${allowed.join(", ")}`);
  }
  return v;
}

export function int(v, field, { min = -MAX_AMOUNT, max = MAX_AMOUNT } = {}) {
  if (!Number.isSafeInteger(v) || v < min || v > max) {
    throw new ApiError(400, `${field} is invalid`);
  }
  return v;
}

export function date(v, field) {
  const d = typeof v === "string" ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) {
    throw new ApiError(400, `${field} is invalid`);
  }
  return d;
}

export const MAX_RECEIPTS = 3;
// Receipts are stored inline as base64 data URLs (the client downsizes them).
const RECEIPT_RE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
const MAX_RECEIPT_CHARS = 700_000;

export function receipts(v) {
  if (v == null) return [];
  if (!Array.isArray(v) || v.length > MAX_RECEIPTS) {
    throw new ApiError(400, `At most ${MAX_RECEIPTS} receipt photos`);
  }
  for (const r of v) {
    if (
      typeof r !== "string" ||
      r.length > MAX_RECEIPT_CHARS ||
      !RECEIPT_RE.test(r)
    ) {
      throw new ApiError(400, "A receipt photo is invalid or too large");
    }
  }
  return v;
}

// One small logo stored inline as a base64 data URL (the client downsizes it).
const ICON_RE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
const MAX_ICON_CHARS = 120_000;

export function iconImage(v) {
  if (v == null || v === "") return "";
  if (typeof v !== "string" || v.length > MAX_ICON_CHARS || !ICON_RE.test(v)) {
    throw new ApiError(400, "The icon image is invalid or too large");
  }
  return v;
}

export const COLORS = [
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "indigo",
  "purple",
  "pink",
  "gray",
];
export const ACCOUNT_TYPES = ["cash", "bank", "card", "savings"];
export const CATEGORY_TYPES = ["expense", "income"];
export const TX_TYPES = ["expense", "income", "transfer"];

/** Drops Mongo-internal fields: _id -> id, hides userId. */
export function publicDoc(doc) {
  if (!doc) return doc;
  const { _id, userId: _userId, ...rest } = doc;
  return { id: _id, ...rest };
}
