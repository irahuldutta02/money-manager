import { fromMinor, toMinor } from "@/lib/money";
import {
  NW_GROUPS,
  detailRows,
  cardEmis,
  formatDetailValue,
  holdingValue,
  issuerIconFor,
  netWorthTotals,
  nwType,
  platformIconFor,
} from "@/lib/networth";

// Builds the "handover" PDF in the browser (jsPDF is loaded on demand, so it
// costs nothing until the button is used). The built-in PDF fonts have no
// rupee sign, so money is written with the currency code ("INR 5,000.00").

const PAGE = { w: 210, h: 297, m: 15 };
const GREY = [110, 110, 115];
const INK = [20, 20, 24];
const GREEN = [24, 140, 70];
const RED = [200, 40, 40];

/** Draws a data-URL logo as a circle with a thin border; unreadable ones are skipped. */
function drawLogo(doc, src, x, y, size) {
  const fmt = /^data:image\/(\w+);/.exec(src ?? "")?.[1];
  if (!fmt) return false;
  const r = size / 2;
  const cx = x + r;
  const cy = y + r;
  try {
    doc.saveGraphicsState();
    doc.setFillColor(255, 255, 255);
    doc.circle(cx, cy, r, "F");
    doc.circle(cx, cy, r, null);
    doc.clip();
    doc.discardPath();
    doc.addImage(src, fmt.toUpperCase(), x, y, size, size);
    doc.restoreGraphicsState();
    doc.setDrawColor(205, 205, 212);
    doc.setLineWidth(0.25);
    doc.circle(cx, cy, r, "S");
    return true;
  } catch {
    doc.restoreGraphicsState();
    return false;
  }
}

const dateText = (d) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);

/**
 * input: { holdings, lending: { owed, owe }, lendingIncluded, people,
 *          currency, user: { name, email } }
 */
export async function downloadNetWorthPdf(input) {
  const { jsPDF } = await import("jspdf");
  const { holdings, lending, lendingIncluded, people, currency, user } = input;

  const nf = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    currencyDisplay: "code",
  });
  const money = (minor) =>
    nf.format(fromMinor(minor, currency)).replace(/[  ]/g, " ");

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const { w, h, m } = PAGE;
  const cw = w - m * 2;
  let y = m;

  const color = (c) => doc.setTextColor(c[0], c[1], c[2]);
  const font = (style, size) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
  };
  const ensure = (need) => {
    if (y + need > h - 16) {
      doc.addPage();
      y = m;
    }
  };
  const rule = (gap = 2) => {
    doc.setDrawColor(215, 215, 220);
    doc.line(m, y, w - m, y);
    y += gap;
  };

  // ---- title
  font("bold", 20);
  color(INK);
  doc.text("Financial summary", m, y + 6);
  y += 11;
  font("normal", 9.5);
  color(GREY);
  doc.text(`Prepared on ${dateText(new Date())}`, m, y);
  y += 4.5;
  const owner = [user?.name, user?.email].filter(Boolean).join("  ·  ");
  if (owner) {
    doc.text(`Account holder: ${owner}`, m, y);
    y += 4.5;
  }
  y += 3;

  // ---- summary
  const totals = netWorthTotals(
    holdings,
    lendingIncluded ? lending : { owed: 0, owe: 0 },
  );
  doc.setFillColor(244, 244, 247);
  doc.roundedRect(m, y, cw, 21, 3, 3, "F");
  font("normal", 9);
  color(GREY);
  doc.text("NET WORTH", m + 5, y + 6.5);
  font("bold", 18);
  color(totals.net < 0 ? RED : INK);
  doc.text(money(totals.net), m + 5, y + 15);
  font("normal", 9);
  color(GREY);
  doc.text("Assets", m + cw / 2 + 8, y + 6.5);
  doc.text("Liabilities", m + cw / 2 + 8 + 38, y + 6.5);
  font("bold", 10.5);
  color(GREEN);
  doc.text(money(totals.assets), m + cw / 2 + 8, y + 13);
  color(RED);
  doc.text(money(totals.liabilities), m + cw / 2 + 8 + 38, y + 13);
  y += 28;

  // ---- groups
  for (const g of NW_GROUPS) {
    const rows = holdings.filter((x) => nwType(x.type).group === g.id);
    if (rows.length === 0) continue;
    const total = rows
      .filter((x) => x.included)
      .reduce((n, x) => n + holdingValue(x), 0);

    ensure(22);
    font("bold", 12);
    color(INK);
    doc.text(g.label, m, y + 4);
    color(g.kind === "asset" ? GREEN : RED);
    doc.text(money(total), w - m, y + 4, { align: "right" });
    y += 7;
    rule(3);

    for (const x of rows) {
      const type = nwType(x.type);
      const last = x.history?.[x.history.length - 1];
      const pairs = detailRows(x.type, x.details)
        .filter((r) => r.value)
        .map((r) =>
          r.kind === "amount" && Number.isFinite(Number(r.value))
            ? { ...r, value: money(toMinor(Number(r.value), currency)) }
            : r.kind === "account"
              ? {
                  ...r,
                  kind: undefined,
                  value: holdings.find((c) => c.id === r.value)?.name ?? "",
                }
              : r,
        )
        .map((r) =>
          r.kind === "linkcard"
            ? {
                ...r,
                kind: undefined,
                value: r.value
                  .split(",")
                  .map((id) => holdings.find((c) => c.id === id)?.name)
                  .filter(Boolean)
                  .join(", "),
              }
            : r,
        )
        .filter((r) => r.value)
        .concat(
          cardEmis(x).list.map((e) => ({
            label:
              `EMI: ${e.purpose ? `${e.name} - ${e.purpose}` : e.name}`.toUpperCase(),
            value: e.active
              ? `${money(e.monthly)}/mo, ${e.remaining} of ${e.tenure} left, ${money(e.payable)} payable`
              : "Completed",
          })),
        );
      const wrapped = pairs.map((p) => ({
        ...p,
        lines: doc.splitTextToSize(formatDetailValue(p, { holdings }), cw - 62),
      }));
      const need =
        11 + wrapped.reduce((n, p) => n + p.lines.length * 4.3 + 1, 0) + 4;
      ensure(Math.min(need, 60));

      // Logos: a card shows its issuer logo with the co-branding one beside
      // it; others show their own, with the platform's next to it.
      const card = x.type === "credit_card";
      const logos = [
        card ? issuerIconFor(x, holdings) : x.icon,
        card ? x.icon : platformIconFor(x, holdings),
      ].filter(Boolean);
      let tx = m;
      for (const src of logos) {
        if (drawLogo(doc, src, tx, y, 7)) tx += 8.5;
      }
      const startY = y;

      font("bold", 11);
      color(INK);
      const title = doc.splitTextToSize(x.name, cw - 48 - (tx - m));
      doc.text(title, tx, y + 4);
      doc.text(money(x.balance), w - m, y + 4, { align: "right" });
      y += title.length * 4.8 + 0.4;

      // Deposits show what went in and what it earned; an NPS, its tiers.
      const base =
        x.autoBalance && x.principal > 0
          ? `${x.type === "rd" ? "invested" : "deposit"} ${money(x.principal)}, ${x.gain >= 0 ? "gain" : "loss"} ${money(Math.abs(x.gain))}`
          : "";
      font("normal", 8.5);
      color(GREY);
      doc.text(
        [
          type.label,
          base,
          x.type === "mf" && x.total ? "total balance (all AMCs)" : "",
          last ? `as on ${dateText(new Date(last.at))}` : "",
          x.included ? "" : "not counted in totals",
        ]
          .filter(Boolean)
          .join("  ·  "),
        tx,
        y + 3,
      );
      y += 6;
      y = Math.max(y, startY + 8);

      for (const p of wrapped) {
        ensure(p.lines.length * 4.3 + 2);
        font("normal", 8.5);
        color(GREY);
        doc.text(p.label, m + 4, y + 3);
        font("normal", 9.5);
        color(INK);
        doc.text(p.lines, m + 58, y + 3);
        y += p.lines.length * 4.3 + 1;
      }
      y += 2;
      doc.setDrawColor(235, 235, 238);
      doc.line(m, y, w - m, y);
      y += 3;
    }
    y += 3;
  }

  // ---- lending ledger
  const open = (people ?? []).filter((p) => p.balance !== 0);
  if (open.length > 0) {
    ensure(24);
    font("bold", 12);
    color(INK);
    doc.text("Money lent and owed (Track P2P Lending)", m, y + 4);
    y += 7;
    rule(3);
    for (const p of open) {
      ensure(8);
      font("normal", 10);
      color(INK);
      doc.text(p.person, m + 4, y + 3);
      font("bold", 10);
      color(p.balance > 0 ? GREEN : RED);
      doc.text(
        `${money(Math.abs(p.balance))}  ${p.balance > 0 ? "owes you" : "you owe"}`,
        w - m,
        y + 3,
        { align: "right" },
      );
      y += 6.5;
    }
  }

  // ---- page numbers
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    font("normal", 8);
    color(GREY);
    doc.text("Money Manager", m, h - 8);
    doc.text(`Page ${i} of ${pages}`, w - m, h - 8, { align: "right" });
  }

  doc.save(`financial-summary-${new Date().toISOString().slice(0, 10)}.pdf`);
}
