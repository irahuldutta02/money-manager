// Tiny calculator behind the number pad. No eval: a hand-written tokenizer
// and precedence parser (× ÷ before + −).

export const OPS = ["+", "−", "×", "÷"];
const MAX_INT_DIGITS = 10;

const isOp = (c) => OPS.includes(c);
const lastNumber = (expr) => expr.split(/[+−×÷]/).pop();

/** Applies one key press to the expression string. */
export function press(expr, key, decimals) {
  if (key === "C") return "";
  if (key === "⌫") return expr.slice(0, -1);

  if (isOp(key)) {
    if (expr === "") return expr; // no leading operator
    const last = expr.at(-1);
    return isOp(last) ? expr.slice(0, -1) + key : expr + key;
  }

  const num = lastNumber(expr);
  if (key === ".") {
    if (decimals === 0 || num.includes(".")) return expr;
    return num === "" ? `${expr}0.` : `${expr}.`;
  }

  // digit
  const [int, frac] = num.split(".");
  if (frac !== undefined && frac.length >= decimals) return expr;
  if (frac === undefined && int.length >= MAX_INT_DIGITS) return expr;
  if (num === "0" && key !== "0") return expr.slice(0, -1) + key; // no leading zeros
  if (num === "0" && key === "0") return expr;
  return expr + key;
}

/** Evaluates the expression; null if incomplete/invalid. Trailing op is ignored. */
export function evaluate(expr) {
  let s = expr;
  while (s && isOp(s.at(-1))) s = s.slice(0, -1);
  if (!s) return null;

  const tokens = s.match(/\d+\.?\d*|\.\d+|[+−×÷]/g);
  if (!tokens) return null;

  // First pass: × and ÷
  const stack = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "×" || t === "÷") {
      const a = stack.pop();
      const b = parseFloat(tokens[++i]);
      if (typeof a !== "number" || Number.isNaN(b)) return null;
      if (t === "÷" && b === 0) return null;
      stack.push(t === "×" ? a * b : a / b);
    } else if (t === "+" || t === "−") {
      stack.push(t);
    } else {
      stack.push(parseFloat(t));
    }
  }
  // Second pass: + and −
  let total = stack[0];
  if (typeof total !== "number") return null;
  for (let i = 1; i < stack.length; i += 2) {
    const op = stack[i];
    const v = stack[i + 1];
    if (typeof v !== "number") return null;
    total = op === "+" ? total + v : total - v;
  }
  return Number.isFinite(total) ? total : null;
}

/** Number -> expression string with at most `decimals` places, trimmed. */
export function toExpr(value, decimals) {
  if (value == null) return "";
  return String(Number(value.toFixed(decimals)));
}
