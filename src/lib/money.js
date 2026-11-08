// Amounts are integer MINOR units (cents, paise…) everywhere except UI input.

const digitsCache = new Map();
export function currencyDigits(currency) {
  if (!digitsCache.has(currency)) {
    let d = 2;
    try {
      d = new Intl.NumberFormat("en", {
        style: "currency",
        currency,
      }).resolvedOptions().maximumFractionDigits;
    } catch {}
    digitsCache.set(currency, d);
  }
  return digitsCache.get(currency);
}

const fmtCache = new Map();
function formatter(currency, compact) {
  const k = `${currency}|${compact}`;
  if (!fmtCache.has(k)) {
    fmtCache.set(
      k,
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        ...(compact ? { notation: "compact", maximumFractionDigits: 1 } : {}),
      }),
    );
  }
  return fmtCache.get(k);
}

export function toMinor(value, currency) {
  return Math.round(value * 10 ** currencyDigits(currency));
}

export function fromMinor(minor, currency) {
  return minor / 10 ** currencyDigits(currency);
}

export function formatMoney(minor, currency, { compact = false } = {}) {
  return formatter(currency, compact).format(fromMinor(minor, currency));
}

/** "+₹1,200.00" / "−₹300.00" style for list rows. */
export function formatSigned(minor, currency, sign) {
  const body = formatMoney(minor, currency);
  if (sign === "income") return `+${body}`;
  if (sign === "expense") return `−${body}`;
  return body;
}

export function currencySymbol(currency) {
  try {
    return (
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol",
      })
        .formatToParts(0)
        .find((p) => p.type === "currency")?.value ?? currency
    );
  } catch {
    return currency;
  }
}
