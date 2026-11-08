// All range math happens in the browser's local time zone; the server only
// ever sees absolute instants (ISO strings).

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function startOfWeek(d) {
  const day = startOfDay(d);
  const offset = (day.getDay() + 6) % 7; // Monday = 0
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - offset);
}

export function rangeFor(period, anchor) {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const d = anchor.getDate();
  switch (period) {
    case "day":
      return { from: new Date(y, m, d), to: new Date(y, m, d + 1) };
    case "week": {
      const s = startOfWeek(anchor);
      return {
        from: s,
        to: new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7),
      };
    }
    case "year":
      return { from: new Date(y, 0, 1), to: new Date(y + 1, 0, 1) };
    default:
      return { from: new Date(y, m, 1), to: new Date(y, m + 1, 1) };
  }
}

export function shift(period, anchor, dir) {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const d = anchor.getDate();
  switch (period) {
    case "day":
      return new Date(y, m, d + dir);
    case "week":
      return new Date(y, m, d + 7 * dir);
    case "year":
      return new Date(y + dir, 0, 1);
    default:
      return new Date(y, m + dir, 1);
  }
}

const f = (opts) => new Intl.DateTimeFormat(undefined, opts);

export function labelFor(period, anchor) {
  if (period === "day") {
    return f({
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(anchor);
  }
  if (period === "week") {
    const { from, to } = rangeFor("week", anchor);
    const end = new Date(to.getFullYear(), to.getMonth(), to.getDate() - 1);
    const s = f({ day: "numeric", month: "short" }).format(from);
    const e = f({ day: "numeric", month: "short", year: "numeric" }).format(
      end,
    );
    return `${s} – ${e}`;
  }
  if (period === "year") return String(anchor.getFullYear());
  return f({ month: "long", year: "numeric" }).format(anchor);
}

export const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Value for <input type="date"> in local time. */
export const toDateInput = dayKey;

/**
 * Turns a <input type="date"> value into an instant. Today keeps the current
 * time; other days use local noon so they never slip across a day boundary.
 * If the date is unchanged from `original`, the original instant is kept.
 */
export function fromDateInput(value, original) {
  if (original && dayKey(original) === value) return original;
  const [y, m, d] = value.split("-").map(Number);
  const now = new Date();
  if (dayKey(now) === value) return now;
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function dayHeading(key) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return f({ weekday: "long", day: "numeric", month: "short" }).format(date);
}

export const monthKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export const monthStart = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

export const daysInMonth = (d) =>
  new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

/** Query-string fragment for a [from, to) range. */
export const rangeQuery = ({ from, to }) =>
  `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
