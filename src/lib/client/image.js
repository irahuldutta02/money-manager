import { AMEX_LOGO } from "./amex-logo";
import { RUPAY_LOGO } from "./rupay-logo";
import { VISA_LOGO } from "./visa-logo";

// Downsizes a photo to a JPEG data URL small enough to store inline in MongoDB
// (typically 60–200 KB). Receipts stay legible at 1280px / quality 0.7.
const MAX_SIDE = 1280;

export async function fileToReceipt(file) {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("That image couldn't be read.");
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; // flatten transparency
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.7);
}

const ICON_SIDE = 128;

/** Centre-cropped square PNG data URL (keeps transparency) for small logos. */
export async function fileToIcon(file) {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("That image couldn't be read.");
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = ICON_SIDE;
  canvas
    .getContext("2d")
    .drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      ICON_SIDE,
      ICON_SIDE,
    );
  bitmap.close?.();
  return canvas.toDataURL("image/png");
}

const CARD_LOGOS = {
  Visa: `<image href="${VISA_LOGO}" width="128" height="128"/>`,
  Mastercard: `<rect width="128" height="128" fill="#fff"/><circle cx="48" cy="64" r="32" fill="#eb001b"/><circle cx="80" cy="64" r="32" fill="#f79e1b"/><path d="M64 38a32 32 0 0 1 0 52a32 32 0 0 1 0-52z" fill="#ff5f00"/>`,
  RuPay: `<image href="${RUPAY_LOGO}" width="128" height="128"/>`,
  "American Express": `<image href="${AMEX_LOGO}" width="128" height="128"/>`,
  "Diners Club": `<rect width="128" height="128" fill="#fff"/><circle cx="64" cy="64" r="44" fill="#0079be"/><circle cx="64" cy="64" r="34" fill="#fff"/><path d="M58 38a26 26 0 0 0 0 52z M70 38a26 26 0 0 1 0 52z" fill="#0079be"/>`,
  Discover: `<rect width="128" height="128" fill="#fff"/><circle cx="64" cy="52" r="26" fill="#f76f20"/><text x="64" y="104" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="800" fill="#231f20">DISCOVER</text>`,
};

/** SVG data URL of a card network's logo, for showing in lists. */
export function cardLogoUrl(network) {
  const body = CARD_LOGOS[network];
  if (!body) return "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">${body}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** PNG data URL of a card network's logo (same shape fileToIcon returns). */
export async function cardLogoIcon(network) {
  const url = cardLogoUrl(network);
  if (!url) return "";
  const img = new Image();
  img.src = url;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = ICON_SIDE;
  canvas.getContext("2d").drawImage(img, 0, 0, ICON_SIDE, ICON_SIDE);
  return canvas.toDataURL("image/png");
}
