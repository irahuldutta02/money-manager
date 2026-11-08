// Shared by the server (validation) and the client (labels, icons, totals).
// A holding's group is always derived from its type, never sent by the client.

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

/**
 * Totals in minor units. Liabilities are stored as the outstanding amount
 * (positive = you owe it). Lending is the Track Lending ledger, folded in.
 */
export function netWorthTotals(holdings, lending = { owed: 0, owe: 0 }) {
  let assets = lending.owed;
  let liabilities = lending.owe;
  for (const h of holdings) {
    if (!h.included) continue;
    if (nwType(h.type).group === "liability") liabilities += h.balance;
    else assets += h.balance;
  }
  return { assets, liabilities, net: assets - liabilities };
}

// ------------------------------------------------------------------ details
// Record-keeping fields per instrument type (account numbers, nominee…).
// Kept to the important few; the server only stores keys listed here.

const f = (key, label, extra) => ({ key, label, ...extra });
const NOMINEE = [f("nomineeName", "Nominee name")];
const MATURITY = f("maturityDate", "Maturity date", { type: "date" });

const FIELDS = {
  savings: [
    f("bankName", "Bank name"),
    f("accountNumber", "Account number"),
    f("cif", "CIF number"),
    f("ifsc", "IFSC"),
    f("branch", "Branch"),
    ...NOMINEE,
  ],
  wallet: [f("platform", "Wallet / app"), f("mobile", "Registered mobile")],
  cash: [],
  fd: [
    f("bankName", "Bank name"),
    f("accountNumber", "FD number"),
    f("cif", "CIF number"),
    MATURITY,
    ...NOMINEE,
  ],
  rd: [
    f("bankName", "Bank name"),
    f("accountNumber", "RD number"),
    f("cif", "CIF number"),
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
    f("cif", "CIF number"),
    f("branch", "Branch"),
    ...NOMINEE,
  ],
  epf: [f("uan", "UAN"), f("employer", "Employer / PF office"), ...NOMINEE],
  post_office: [
    f("scheme", "Scheme (NSC, KVP, SSY…)"),
    f("accountNumber", "Certificate / account number"),
    f("cif", "CIF number"),
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
    f("maturityDate", "Maturity / renewal date", { type: "date" }),
    ...NOMINEE,
  ],
  other_asset: [
    f("platform", "Platform"),
    f("reference", "Reference number"),
    ...NOMINEE,
  ],
  credit_card: [
    f("issuer", "Issuer bank"),
    f("cardLast4", "Card last 4 digits"),
  ],
  other_loan: [f("lender", "Lender"), f("reference", "Reference number")],
};
const LOAN = [
  f("lender", "Lender"),
  f("accountNumber", "Loan account number"),
  f("cif", "CIF number"),
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
