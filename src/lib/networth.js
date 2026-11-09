// Shared by the server (validation) and the client (labels, icons, totals).
// A holding's group is always derived from its type, never sent by the client.

import { formatMoney, toMinor } from "@/lib/money";
import { dayKey } from "@/lib/dates";

export const NW_GROUPS = [
  { id: "bank", label: "Bank & wallets", kind: "asset", color: "blue" },
  { id: "investment", label: "Investments", kind: "asset", color: "green" },
  { id: "liability", label: "Credit & loans", kind: "liability", color: "red" },
];

// [id, label, group, icon]
const TYPE_ROWS = [
  ["savings", "Savings account", "bank", "landmark"],
  ["current", "Current account", "bank", "briefcase"],
  ["wallet", "Wallet", "bank", "wallet"],
  ["cash", "Cash in hand", "bank", "banknote"],

  ["fd", "Fixed deposit", "investment", "piggy-bank"],
  ["rd", "Recurring deposit", "investment", "piggy-bank"],
  ["mf", "Mutual fund", "investment", "trending-up"],
  ["stocks", "Shares / stocks", "investment", "bar-chart"],
  ["nps", "NPS", "investment", "shield"],
  ["ppf", "PPF", "investment", "landmark"],
  ["epf", "EPF", "investment", "briefcase"],
  ["post_office", "Post Office scheme", "investment", "landmark"],
  ["gold", "Gold / SGB", "investment", "gem"],
  ["bonds", "Bonds / debentures", "investment", "percent"],
  ["property", "Property", "investment", "home"],
  ["crypto", "Crypto", "investment", "coins"],
  ["insurance", "Insurance / ULIP", "investment", "heart"],
  ["other_asset", "Other investment", "investment", "tag"],

  ["credit_card", "Credit card", "liability", "credit-card"],
  ["home_loan", "Home loan", "liability", "home"],
  ["car_loan", "Car / bike loan", "liability", "car"],
  ["personal_loan", "Personal loan", "liability", "hand-coins"],
  ["education_loan", "Education loan", "liability", "graduation-cap"],
  ["gold_loan", "Gold loan", "liability", "gem"],
  ["other_loan", "Other loan / due", "liability", "tag"],
];

export const NW_TYPES = TYPE_ROWS.map(([id, label, group, icon]) => ({
  id,
  label,
  group,
  icon,
}));
export const NW_TYPE_IDS = NW_TYPES.map((t) => t.id);
export const nwType = (id) => NW_TYPES.find((t) => t.id === id) ?? NW_TYPES[0];
export const nwGroup = (id) => NW_GROUPS.find((g) => g.id === id);

// ---------------------------------------------------------------- card EMIs
// A card can carry EMIs / loans: {id, name, principal, monthly, tenure, start}
// (minor units; start = date of the first instalment). What is left of them is
// counted against the card's limit and in net worth, on top of its outstanding.

export const MAX_EMIS = 20;
export const MAX_TENURE = 120;

const instalmentDate = (start, k) => {
  const d = new Date(start);
  const day = d.getDate();
  const t = new Date(d.getFullYear(), d.getMonth() + k, 1);
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  return new Date(t.getFullYear(), t.getMonth(), Math.min(day, last));
};

/** The monthly EMI of a no-interest loan: amount ÷ tenure, rounded up. */
export const noInterestEmi = (principal, tenure) =>
  tenure > 0 ? Math.ceil(principal / tenure) : 0;

/** Monthly interest rate implied by principal, EMI and tenure (0 = no-cost). */
function impliedRate(principal, monthly, n) {
  if (monthly * n <= principal) return 0;
  const pmt = (r) => (principal * r * (1 + r) ** n) / ((1 + r) ** n - 1);
  let lo = 1e-9;
  let hi = 1;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (pmt(mid) > monthly) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Repayment schedule of an EMI, the way banks print it: interest is the
 * monthly rate (annual / 12, found from the amount, EMI and tenure and
 * rounded to 0.01% p.a.) on the amount outstanding at the start of the
 * instalment, rounded to a whole currency unit; the rest of the EMI repays
 * principal. Each row: number, due date, outstanding before it, principal,
 * interest, EMI, and the principal left after it (`closing`).
 */
export function emiSchedule(emi, unit = 100) {
  const n = emi.tenure;
  const exact = emi.noInterest
    ? 0
    : impliedRate(emi.principal, emi.monthly, n) * 12 * 100;
  const annualRate = Math.round(exact * 100) / 100;
  const r = annualRate / 1200;
  const rows = [];
  let out = emi.principal;
  // A schedule typed in from the bank's statement replaces the calculated one.
  if (Array.isArray(emi.custom) && emi.custom.length === n) {
    emi.custom.forEach((c, i) => {
      const closing = Math.max(0, out - c.principal);
      rows.push({
        n: i + 1,
        due: instalmentDate(emi.start, i),
        outstanding: out,
        principal: c.principal,
        interest: c.interest,
        emi: c.principal + c.interest,
        closing: i === n - 1 ? 0 : closing,
      });
      out = closing;
    });
    return {
      rows,
      annualRate,
      totalInterest: rows.reduce((t, x) => t + x.interest, 0),
    };
  }
  for (let k = 1; k <= n; k++) {
    const interest = r === 0 ? 0 : Math.round((out * r) / unit) * unit;
    let principal = Math.min(out, emi.monthly - interest);
    if (r === 0) principal = k === n ? out : Math.min(out, emi.monthly);
    const closing = k === n ? 0 : out - principal;
    rows.push({
      n: k,
      due: instalmentDate(emi.start, k - 1),
      outstanding: out,
      principal,
      interest,
      emi: principal + interest,
      closing,
    });
    out = closing;
  }
  return {
    rows,
    annualRate,
    totalInterest: rows.reduce((t, x) => t + x.interest, 0),
  };
}

/**
 * Progress of one EMI: instalments paid (marked by hand; EMIs from before
 * that was possible count by date), left, and the principal still owed.
 */
export function emiState(emi, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let paid = 0;
  if (Number.isInteger(emi.paidCount)) {
    paid = Math.min(Math.max(0, emi.paidCount), emi.tenure);
  } else {
    while (paid < emi.tenure && instalmentDate(emi.start, paid) <= today)
      paid++;
  }
  const remaining = emi.tenure - paid;
  const rows = emiSchedule(emi).rows;
  const left = rows.slice(paid);
  return {
    paid,
    remaining,
    active: remaining > 0,
    // Principal still owed: what counts against the card's limit.
    remainingPrincipal: paid === 0 ? emi.principal : rows[paid - 1].closing,
    // Everything still to pay, interest included: what counts in net worth.
    payable: left.reduce((n, x) => n + x.emi, 0),
    interestLeft: left.reduce((n, x) => n + x.interest, 0),
    nextAt: remaining > 0 ? instalmentDate(emi.start, paid) : null,
  };
}

/**
 * Why an EMI (amounts in minor units) can't be saved, or "" when it can. The
 * client and the server both use this, so they always agree.
 */
export function emiError(e) {
  const name = String(e.name ?? "").trim();
  if (!name) return "Give the EMI a name.";
  if (name.length > 60) return "The name can be at most 60 characters.";
  if (!Number.isSafeInteger(e.principal) || e.principal <= 0)
    return "Enter the total EMI amount.";
  if (!Number.isSafeInteger(e.monthly) || e.monthly <= 0)
    return "Enter the monthly EMI.";
  if (!Number.isInteger(e.tenure) || e.tenure < 1 || e.tenure > MAX_TENURE)
    return `Tenure must be 1 to ${MAX_TENURE} months.`;
  if (e.monthly > e.principal)
    return "The monthly EMI can't be more than the total amount.";
  if (e.monthly * e.tenure < e.principal)
    return "Monthly EMI × tenure is less than the total amount, so the loan wouldn't be paid off.";
  if (e.noInterest && e.monthly !== Math.ceil(e.principal / e.tenure))
    return "A no-interest EMI is the total amount divided by the tenure.";
  const start = new Date(e.start);
  if (
    Number.isNaN(start.getTime()) ||
    start.getFullYear() < 2000 ||
    start.getFullYear() > 2100
  )
    return "Enter a valid first EMI date.";
  if (
    e.paidCount != null &&
    (!Number.isInteger(e.paidCount) ||
      e.paidCount < 0 ||
      e.paidCount > e.tenure)
  )
    return "Paid instalments are out of range.";
  if (e.custom != null) {
    if (!Array.isArray(e.custom) || e.custom.length !== e.tenure)
      return "The schedule needs one row per month.";
    let sum = 0;
    for (const [i, c] of e.custom.entries()) {
      if (
        !Number.isSafeInteger(c?.principal) ||
        !Number.isSafeInteger(c?.interest) ||
        c.principal < 0 ||
        c.interest < 0
      )
        return `Instalment ${i + 1}: principal and interest must be zero or more.`;
      if (e.noInterest && c.interest !== 0)
        return `Instalment ${i + 1}: a no-interest EMI can't have interest.`;
      if (c.principal + c.interest <= 0)
        return `Instalment ${i + 1}: the EMI can't be zero.`;
      sum += c.principal;
    }
    if (sum > e.principal)
      return "The principal in the schedule adds up to more than the total amount.";
    // A few units of rounding is normal (banks leave it on the last row).
    if (e.principal - sum > e.tenure * 100)
      return "The principal in the schedule adds up to less than the total amount.";
  }
  return "";
}

/** A card's EMIs with progress, plus the monthly total and blocked principal. */
export function cardEmis(h, now = new Date()) {
  const list = (Array.isArray(h.emis) ? h.emis : []).map((e) => ({
    ...e,
    ...emiState(e, now),
  }));
  const live = list.filter((e) => e.active);
  return {
    list,
    monthly: live.reduce((n, e) => n + e.monthly, 0),
    blocked: live.reduce((n, e) => n + e.remainingPrincipal, 0),
    payable: live.reduce((n, e) => n + e.payable, 0),
  };
}

/**
 * What the holding counts for in net worth: balance, plus everything still to
 * pay on a card's open EMIs. (Its credit limit only feels the principal.)
 */
export const holdingValue = (h) =>
  h.balance + (h.type === "credit_card" ? cardEmis(h).payable : 0);

/**
 * Totals in minor units. Liabilities are stored as the outstanding amount
 * (positive = you owe it). Lending is the Track P2P Lending ledger, folded in.
 */
export function netWorthTotals(holdings, lending = { owed: 0, owe: 0 }) {
  let assets = lending.owed;
  let liabilities = lending.owe;
  for (const h of holdings) {
    if (!h.included) continue;
    if (nwType(h.type).group === "liability") liabilities += holdingValue(h);
    else assets += h.balance;
  }
  return { assets, liabilities, net: assets - liabilities };
}

// ------------------------------------------------------------------ details
// Record-keeping fields per instrument type (account numbers, nominee…).
// Per type these are only the *suggested* labels: each instrument stores its
// own free-form list of {label, value} rows, which the user can edit, remove
// and reorder.

export const COMPOUNDING_OPTIONS = [
  "Quarterly",
  "Monthly",
  "Half-yearly",
  "Yearly",
  "Simple (at maturity)",
];
const COMPOUNDING_PER_YEAR = {
  Quarterly: 4,
  Monthly: 12,
  "Half-yearly": 2,
  Yearly: 1,
};

export const MATURITY_OPTIONS = ["Credit to account", "Reinvest"];

const f = (key, label, extra) => ({ key, label, ...extra });
const NOMINEE = [f("nomineeName", "Nominee name")];
const MATURITY = f("maturityDate", "Maturity date", { kind: "date" });

const FIELDS = {
  savings: [
    f("bankName", "Bank name"),
    f("accountNumber", "Account number"),
    f("cif", "Customer ID"),
    f("ifsc", "IFSC"),
    f("branch", "Branch"),
    ...NOMINEE,
  ],
  wallet: [f("mobile", "Registered mobile")],
  cash: [],
  fd: [
    f("bankName", "Bank name"),
    f("accountNumber", "FD number"),
    f("cif", "Customer ID"),
    f("platform", "Platform used", { default: "Bank app" }),
    f("depositAmount", "Deposit amount", { kind: "amount" }),
    f("depositDate", "Date of deposit", { kind: "date", today: true }),
    MATURITY,
    f("rate", "Interest rate", { kind: "rate" }),
    f("compounding", "Interest compounding", {
      kind: "choice",
      options: COMPOUNDING_OPTIONS,
      default: "Quarterly",
    }),
    f("maturityAmount", "Maturity amount", { kind: "amount" }),
    f("maturityInstruction", "Maturity instruction", {
      kind: "choice",
      options: MATURITY_OPTIONS,
      default: "Credit to account",
    }),
    f("creditAccount", "Credit account", { kind: "account" }),
    ...NOMINEE,
  ],
  rd: [
    f("bankName", "Bank name"),
    f("accountNumber", "RD number"),
    f("cif", "Customer ID"),
    MATURITY,
    ...NOMINEE,
  ],
  mf: [
    f("platform", "Platform / AMC"),
    f("accountKind", "Account type", {
      type: "choice",
      options: ["Folio", "Demat"],
    }),
    f("accountNumber", "Account number"),
    ...NOMINEE,
  ],
  stocks: [
    f("platform", "Broker / platform"),
    f("demat", "Demat account number"),
    ...NOMINEE,
  ],
  nps: [
    f("pran", "PRAN number"),
    f("platform", "Platform (CRA / app)"),
    ...NOMINEE,
  ],
  ppf: [
    f("bankName", "Bank / post office"),
    f("accountNumber", "Account number"),
    f("cif", "Customer ID"),
    f("branch", "Branch"),
    ...NOMINEE,
  ],
  epf: [f("uan", "UAN"), f("employer", "Employer / PF office"), ...NOMINEE],
  post_office: [
    f("scheme", "Scheme (NSC, KVP, SSY…)"),
    f("accountNumber", "Certificate / account number"),
    f("cif", "Customer ID"),
    f("branch", "Post office"),
    ...NOMINEE,
  ],
  gold: [
    f("platform", "Platform / custodian"),
    f("reference", "Certificate / folio / reference"),
    ...NOMINEE,
  ],
  bonds: [
    f("platform", "Platform"),
    f("reference", "Demat / ISIN / reference"),
    ...NOMINEE,
  ],
  property: [
    f("address", "Location / address"),
    f("reference", "Registry / document reference"),
    ...NOMINEE,
  ],
  crypto: [
    f("platform", "Exchange / wallet app"),
    f("accountId", "Account / user ID"),
    ...NOMINEE,
  ],
  insurance: [
    f("insurer", "Insurer"),
    f("policyNumber", "Policy number"),
    f("maturityDate", "Maturity / renewal date", { kind: "date" }),
    ...NOMINEE,
  ],
  other_asset: [
    f("platform", "Platform"),
    f("reference", "Reference number"),
    ...NOMINEE,
  ],
  credit_card: [
    f("issuer", "Issuer"),
    f("network", "Card network", { kind: "network" }),
    f("variant", "Card variant"),
    f("cardLast4", "Last 4 digits", { kind: "digits" }),
    f("expiry", "Expiry", { kind: "expiry" }),
    f("limit", "Credit limit", { kind: "amount" }),
    f("sharedWith", "Shares limit with", { kind: "linkcard" }),
    f("backingFds", "Backed by FD", { kind: "fdlink" }),
    f("billingDay", "Billing cycle date", { kind: "day" }),
    f("payDays", "Days to pay bill", { kind: "days" }),
  ],
  other_loan: [f("lender", "Lender"), f("reference", "Reference number")],
};
const LOAN = [
  f("lender", "Lender"),
  f("accountNumber", "Loan account number"),
  f("cif", "Customer ID"),
  f("emi", "EMI & due date"),
];
for (const id of [
  "home_loan",
  "car_loan",
  "personal_loan",
  "education_loan",
  "gold_loan",
]) {
  FIELDS[id] = LOAN;
}

export const nwFields = (type) => FIELDS[type] ?? [];

/** Labels are upper case; the old "CUS ID" is now "CUSTOMER ID". */
export const normLabel = (label) =>
  String(label ?? "")
    .trim()
    .toUpperCase()
    .replace(/^CUS ID$/, "CUSTOMER ID");

export const MAX_DETAIL_ROWS = 20;

// Row kinds: special inputs for a row. Plain rows have no kind.
/**
 * A stored row's input kind. Rows saved before kinds were settled ("variant"
 * was the old name of "network", and some had none) take the kind of the
 * type's default row with the same label.
 */
export function rowKind(type, r) {
  const label = String(r?.label ?? "").toUpperCase();
  let kind = r?.kind === "variant" ? "network" : r?.kind;
  if (!DETAIL_KINDS.includes(kind)) {
    kind = nwFields(type).find((f) => f.label.toUpperCase() === label)?.kind;
  }
  return DETAIL_KINDS.includes(kind) ? { kind } : {};
}

export const DETAIL_KINDS = [
  "network",
  "digits",
  "expiry",
  "amount",
  "day",
  "days",
  "linkcard",
  "date",
  "rate",
  "choice",
  "account",
  "fdlink",
];

// Card networks offered by the "network" row; picking one also sets the icon.
export const CARD_NETWORKS = [
  "Visa",
  "Mastercard",
  "RuPay",
  "American Express",
  "Diners Club",
  "Discover",
];

/** Suggested empty rows for a type. */
export const defaultDetailRows = (type) =>
  nwFields(type).map((fld) => ({
    label: fld.label.toUpperCase(),
    value: fld.default ?? (fld.today ? dayKey(new Date()) : ""),
    ...(fld.kind && { kind: fld.kind }),
  }));

/** The choices of a "choice" row, from the type's default row of that label. */
export const rowOptions = (type, row) =>
  nwFields(type).find((x) => x.label.toUpperCase() === row.label)?.options ??
  [];

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * How a row's value reads in the details list. `ctx` ({ currency, holdings })
 * lets amounts show as money and linked accounts by name.
 */
export function formatDetailValue(row, ctx = {}) {
  const v = String(row.value ?? "");
  if (!v) return v;
  if (row.kind === "digits") return `•••• ${v}`;
  if (row.kind === "days") return `${v} days`;
  if (row.kind === "rate") return `${v}% p.a.`;
  if (row.kind === "date" && ISO_DAY.test(v))
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(`${v}T00:00:00`));
  if (row.kind === "amount" && ctx.currency && Number.isFinite(Number(v)))
    return formatMoney(toMinor(Number(v), ctx.currency), ctx.currency);
  if (row.kind === "account")
    return ctx.holdings?.find((h) => h.id === v)?.name ?? "";
  if (row.kind === "fdlink")
    return v
      .split(",")
      .map((id) => ctx.holdings?.find((h) => h.id === id)?.name)
      .filter(Boolean)
      .join(", ");
  return v;
}

/**
 * What an FD is worth (minor units) at `to`, from the amount put in at `from`,
 * the rate and how interest compounds (quarterly is the usual for banks).
 */
function fdGrowth({ principal, rate, from, to, compounding = "Quarterly" }) {
  const r = Number(rate);
  if (!(principal > 0) || !(r >= 0) || !ISO_DAY.test(from ?? "")) return null;
  if (!ISO_DAY.test(to ?? "")) return null;
  const days =
    (new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 864e5;
  if (!(days > 0)) return null;
  const years = days / 365;
  const n = COMPOUNDING_PER_YEAR[compounding];
  if (!n) return Math.round(principal * (1 + (r * years) / 100));
  return Math.round(principal * (1 + r / (100 * n)) ** (n * years));
}

/** An FD's maturity value, from the amount, rate, the two dates and compounding. */
export const fdMaturity = ({
  principal,
  rate,
  deposit,
  maturity,
  compounding,
}) => fdGrowth({ principal, rate, from: deposit, to: maturity, compounding });

/**
 * An FD's value today (minor units), worked out instead of typed in: the
 * deposit grown to today, or to maturity once that has passed. Null while the
 * deposit amount, rate or deposit date are missing.
 */
/** The amount put into an FD (minor units), or null when not filled in. */
export function fdPrincipal(h, currency) {
  if (h.type !== "fd") return null;
  const v = Number(
    detailRows(h.type, h.details).find((r) => /deposit amount/i.test(r.label))
      ?.value,
  );
  return v > 0 ? toMinor(v, currency) : null;
}

export function fdValueNow(h, currency, now = new Date()) {
  if (h.type !== "fd") return null;
  const rows = detailRows(h.type, h.details);
  const get = (re, kind) =>
    rows.find((r) => (kind ? r.kind === kind : re.test(r.label)))?.value ?? "";
  const amount = Number(get(/deposit amount/i));
  const deposit = get(/date of deposit|deposit date/i);
  const rate = get(null, "rate");
  if (!(amount > 0) || rate === "" || !ISO_DAY.test(deposit)) return null;
  const principal = toMinor(amount, currency);
  const today = dayKey(now);
  if (today <= deposit) return principal;
  const maturity = get(/maturity date/i);
  const end = ISO_DAY.test(maturity) && maturity < today ? maturity : today;
  return (
    fdGrowth({
      principal,
      rate,
      from: deposit,
      to: end,
      compounding: get(/compounding/i) || "Quarterly",
    }) ?? principal
  );
}

/**
 * Stored details -> [{label, value}]. Older instruments stored an object keyed
 * by the type's field keys; those become the type's default rows with values.
 */
export function detailRows(type, raw) {
  if (Array.isArray(raw)) {
    return raw.map((r) => ({
      label: normLabel(r?.label),
      value: String(r?.value ?? ""),
      ...rowKind(type, r),
    }));
  }
  if (raw && typeof raw === "object") {
    return nwFields(type).map((fld) => ({
      label: fld.label.toUpperCase(),
      value: raw[fld.key] ? String(raw[fld.key]) : "",
      ...(fld.kind && { kind: fld.kind }),
    }));
  }
  return [];
}

// ------------------------------------------------------------- credit cards

/** Next date (today or later) falling on `day` of a month, clamped to month end. */
function nextOnDay(day, from) {
  const at = (y, m) => {
    const last = new Date(y, m + 1, 0).getDate();
    return new Date(y, m, Math.min(day, last));
  };
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const d = at(today.getFullYear(), today.getMonth());
  return d >= today ? d : at(today.getFullYear(), today.getMonth() + 1);
}

/** Most recent date (today or earlier) falling on `day` of a month. */
function lastOnDay(day, from) {
  const at = (y, m) => {
    const last = new Date(y, m + 1, 0).getDate();
    return new Date(y, m, Math.min(day, last));
  };
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const d = at(today.getFullYear(), today.getMonth());
  return d <= today ? d : at(today.getFullYear(), today.getMonth() - 1);
}

const addDays = (d, n) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/**
 * Credit-card summary from its detail rows: limit (major units, as typed),
 * next statement date, and the next payment due date, which is the statement
 * date plus "days to pay bill". The latest statement counts while its due date
 * hasn't passed; after that, the next statement's. Null when none is filled in.
 */
/** A card's own typed limit and the ids it lists under "shares limit with". */
function cardOwn(h) {
  const rows = detailRows(h.type, h.details);
  const limit = Number(
    rows.find((r) => r.value && /limit/i.test(r.label) && r.kind !== "linkcard")
      ?.value,
  );
  const links = (rows.find((r) => r.kind === "linkcard")?.value ?? "")
    .split(",")
    .filter(Boolean);
  return {
    limit: Number.isFinite(limit) && limit > 0 ? limit : null,
    links,
  };
}

/** A card's issuer, normalised for comparing (case and spacing ignored). */
export function cardIssuer(h) {
  const v = detailRows(h.type, h.details).find(
    (r) => r.kind !== "linkcard" && /issuer/i.test(r.label),
  )?.value;
  return (v ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

/** A card's network (Visa, RuPay…), from its "network" detail row. */
export function cardNetwork(h) {
  return (
    h.details?.find((r) => r.kind === "network" && r.value.trim())?.value ?? ""
  );
}

/** A card's issuer logo, or one set on another card from the same issuer. */
export function issuerIconFor(h, cards) {
  if (h.type !== "credit_card") return "";
  if (h.issuerIcon) return h.issuerIcon;
  const issuer = cardIssuer(h);
  if (!issuer) return "";
  return (
    cards.find(
      (c) =>
        c.type === "credit_card" && c.issuerIcon && cardIssuer(c) === issuer,
    )?.issuerIcon ?? ""
  );
}

/** Ids of the FDs a card is secured against. */
export function cardBackingFds(card) {
  const v = detailRows(card.type, card.details).find(
    (r) => r.kind === "fdlink",
  )?.value;
  return (v ?? "").split(",").filter(Boolean);
}

/** The credit cards an FD backs (an FD can't be deleted while it does). */
export const fdBackers = (fdId, holdings) =>
  holdings.filter(
    (c) => c.type === "credit_card" && cardBackingFds(c).includes(fdId),
  );

/** The platform an FD was booked on, normalised for comparing. */
const platformOf = (h) =>
  (
    detailRows(h.type, h.details).find(
      (r) => r.kind !== "linkcard" && /platform/i.test(r.label),
    )?.value ?? ""
  )
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

/** An FD's platform logo, or one set on another FD from the same platform. */
export function platformIconFor(h, all) {
  if (h.type !== "fd") return "";
  if (h.platformIcon) return h.platformIcon;
  const p = platformOf(h);
  if (!p) return "";
  return (
    all.find((c) => c.type === "fd" && c.platformIcon && platformOf(c) === p)
      ?.platformIcon ?? ""
  );
}

/** The small badge on an instrument's icon: issuer (cards) or platform (FDs). */
export const badgeIconFor = (h, all) =>
  h.type === "credit_card" ? issuerIconFor(h, all) : platformIconFor(h, all);

/** Ids linked to a card from either side (it lists them, or they list it). */
export function cardNeighbors(h, cards) {
  const own = cardOwn(h).links;
  return cards
    .filter(
      (c) =>
        c.id !== h.id &&
        (own.includes(c.id) || cardOwn(c).links.includes(h.id)),
    )
    .map((c) => c.id);
}

/** Every card on the same shared limit: links count in both directions. */
function cardGroup(h, cards) {
  const seen = new Set([h.id]);
  const queue = [h];
  while (queue.length) {
    const cur = queue.pop();
    for (const id of cardNeighbors(cur, cards)) {
      if (seen.has(id)) continue;
      seen.add(id);
      queue.push(cards.find((c) => c.id === id));
    }
  }
  return cards.filter((c) => seen.has(c.id));
}

/** Ids of every other card on the same shared limit (links chain together). */
export function cardGroupIds(h, cards) {
  return cardGroup(h, cards)
    .filter((c) => c.id !== h.id)
    .map((c) => c.id);
}

/** Detail rows with "shares limit with" filled with the whole shared group. */
export function withLinkedCards(h, cards) {
  const ids = cardGroupIds(h, cards).join(",");
  return detailRows(h.type, h.details).map((r) =>
    r.kind === "linkcard" ? { ...r, value: ids } : r,
  );
}

export function cardInfo(holding, all = [], now = new Date()) {
  if (holding.type !== "credit_card") return null;
  const rows = detailRows(holding.type, holding.details);
  const cards = all.filter((c) => c.type === "credit_card");
  const group = cardGroup(holding, cards);
  const shared = group.length > 1;
  const isDays = (r) => r.kind === "days" || /days/i.test(r.label);
  const val = (re, pick = (r) => !isDays(r)) =>
    rows.find(
      (r) => r.value && pick(r) && r.kind !== "linkcard" && re.test(r.label),
    )?.value;
  const num = (v, max) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 1 && n <= max ? n : null;
  };
  // On a shared limit, the biggest limit typed on any card in the group.
  const limit = shared
    ? Math.max(0, ...group.map((c) => cardOwn(c).limit ?? 0))
    : Number(val(/limit/i));
  const billDay = num(val(/bill|cycle|statement/i), 31);
  const payDays = num(val(/./, isDays), 120);
  // Older cards stored a fixed due day of the month instead.
  const dueDay = payDays ? null : num(val(/due/i), 31);
  const hasLimit = Number.isFinite(limit) && limit > 0;
  if (!hasLimit && !billDay && !dueDay) return null;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let dueAt = null;
  // Whether that due date belongs to a statement already generated. If the
  // next bill is still to come, the due date is for it, and nothing is payable
  // yet.
  let dueBilled = true;
  if (billDay && payDays) {
    dueAt = addDays(lastOnDay(billDay, now), payDays);
    if (dueAt < today) {
      dueAt = addDays(nextOnDay(billDay, now), payDays);
      dueBilled = false;
    }
  } else if (dueDay) {
    dueAt = nextOnDay(dueDay, now);
  }
  const billAt = billDay ? nextOnDay(billDay, now) : null;
  return {
    limit: hasLimit ? limit : null, // major units
    shared: shared
      ? group.filter((c) => c.id !== holding.id).map((c) => c.name)
      : [],
    // Net owed across every card on the shared limit (minor units); an
    // overpaid card (negative balance) frees up credit.
    groupUsed: group.reduce((n, c) => n + c.balance + cardEmis(c).blocked, 0),
    billAt,
    dueBilled,
    billInDays: billAt ? Math.round((billAt - today) / 864e5) : null,
    dueAt,
    dueInDays: dueAt ? Math.round((dueAt - today) / 864e5) : null,
  };
}
