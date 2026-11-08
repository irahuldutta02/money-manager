import "server-only";
import { col } from "../mongodb";
import { currencyDigits } from "@/lib/money";
import { buildFilter } from "./search";

const HEADER = [
  "Date",
  "Type",
  "Category",
  "Account",
  "To account",
  "Amount",
  "Currency",
  "Note",
];

// Spreadsheet apps run cells that start with these as formulas (CSV injection).
function cell(v) {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/** CSV of the user's live transactions, honouring the same filters as search. */
export async function exportCsv(userId, params) {
  const filter = await buildFilter(userId, params);
  const [settings, accounts, categories] = await Promise.all([
    col("userSettings").findOne({ _id: userId }),
    col("accounts").find({ userId }).toArray(),
    col("categories").find({ userId }).toArray(),
  ]);
  const currency = settings?.currency ?? "INR";
  const digits = currencyDigits(currency);
  const acc = new Map(accounts.map((a) => [a._id, a.name]));
  const cat = new Map(categories.map((c) => [c._id, c.name]));

  const lines = [HEADER.join(",")];
  const cursor = col("transactions")
    .find(filter, { projection: { receipts: 0 } })
    .sort({ date: -1, _id: -1 });
  for await (const t of cursor) {
    lines.push(
      [
        t.date.toISOString(),
        t.type,
        cat.get(t.categoryId) ?? "",
        acc.get(t.accountId) ?? "",
        acc.get(t.toAccountId) ?? "",
        (t.amount / 10 ** digits).toFixed(digits),
        currency,
        t.note,
      ]
        .map(cell)
        .join(","),
    );
  }
  // BOM so Excel reads UTF-8 (₹, accents) correctly.
  return "﻿" + lines.join("\r\n") + "\r\n";
}
