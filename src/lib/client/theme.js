// Device-local UI theme. Stored in localStorage and applied as
// <html data-theme="…">; tokens live in app/globals.css.
export const THEME_KEY = "mm.theme.v1";
export const DEFAULT_THEME = "glass";

export const THEMES = [
  {
    id: "glass",
    name: "Liquid Glass",
    note: "Translucent, iOS-style",
    swatch: ["#04594a", "#f2f2f7", "#ffffff"],
  },
  {
    id: "android",
    name: "Android",
    note: "Material 3, tonal & Roboto",
    swatch: ["#6750a4", "#fef7ff", "#f3edf7"],
  },
  {
    id: "paper",
    name: "Paper",
    note: "Warm, flat, serif",
    swatch: ["#9a3412", "#f6f1e7", "#fffdf8"],
  },
  {
    id: "midnight",
    name: "Midnight",
    note: "Always-dark AMOLED black",
    swatch: ["#7c8cff", "#000000", "#0d0d12"],
  },
];

const IDS = new Set(THEMES.map((t) => t.id));

// Accent variants layered on top of any theme (<html data-palette="…">). Each
// theme remembers its own pick; "default" keeps the theme's own accent.
// light/dark hexes mirror the CSS in app/globals.css (used for swatches only).
export const PALETTE_KEY = "mm.palette.v1";
export const DEFAULT_PALETTE = "default";
export const PALETTES = [
  { id: "default", name: "Classic" },
  { id: "ocean", name: "Ocean", light: "#0b5fa5", dark: "#7cc4ff" },
  { id: "forest", name: "Forest", light: "#2f6b1f", dark: "#9bdc7f" },
  { id: "amber", name: "Amber", light: "#8f5200", dark: "#ffc46b" },
  { id: "rose", name: "Rose", light: "#b4234f", dark: "#ff9db8" },
  { id: "violet", name: "Violet", light: "#6d3fc4", dark: "#c9b3ff" },
  { id: "graphite", name: "Graphite", light: "#3f4b5c", dark: "#b6c2d4" },
];
const PALETTE_IDS = new Set(PALETTES.map((p) => p.id));

function readPaletteMap() {
  try {
    const m = JSON.parse(localStorage.getItem(PALETTE_KEY));
    return m && typeof m === "object" ? m : {};
  } catch {
    return {};
  }
}

export function readPalette(theme) {
  const v = readPaletteMap()[theme];
  return PALETTE_IDS.has(v) ? v : DEFAULT_PALETTE;
}

function setPaletteAttr(id) {
  if (id === DEFAULT_PALETTE) delete document.documentElement.dataset.palette;
  else document.documentElement.dataset.palette = id;
}

/** Sets (and stores) the palette for one theme. */
export function applyPalette(theme, id) {
  const palette = PALETTE_IDS.has(id) ? id : DEFAULT_PALETTE;
  setPaletteAttr(palette);
  try {
    localStorage.setItem(
      PALETTE_KEY,
      JSON.stringify({ ...readPaletteMap(), [theme]: palette }),
    );
  } catch {}
  return palette;
}

export function readTheme() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return IDS.has(v) ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

const metas = () => document.querySelectorAll('meta[name="theme-color"]');
let originalColors = null;

/** Sets the theme on <html>. Only the signed-in app does this (ThemeScope). */
export function applyTheme(id, { persist = true } = {}) {
  const theme = IDS.has(id) ? id : DEFAULT_THEME;
  document.documentElement.dataset.theme = theme;
  setPaletteAttr(readPalette(theme));
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {}
  }
  // Keep the browser/status bar in step with the page background.
  requestAnimationFrame(() => {
    originalColors ??= [...metas()].map((m) => m.getAttribute("content"));
    const bg = getComputedStyle(document.documentElement)
      .getPropertyValue("--bg")
      .trim();
    metas().forEach((m) => m.setAttribute("content", bg));
  });
  return theme;
}

/** Back to the stock look (landing and sign-in never use a custom theme). */
export function clearTheme() {
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.palette;
  if (originalColors)
    metas().forEach((m, i) => m.setAttribute("content", originalColors[i]));
}

/** Inline script run before first paint to avoid a flash of the wrong theme. */
export const THEME_BOOT_SCRIPT = `try{var d=document.documentElement,t=localStorage.getItem(${JSON.stringify(
  THEME_KEY,
)});if(t&&${JSON.stringify([...IDS])}.indexOf(t)>-1){d.dataset.theme=t;var p=(JSON.parse(localStorage.getItem(${JSON.stringify(
  PALETTE_KEY,
)}))||{})[t];if(p&&${JSON.stringify(
  PALETTES.map((x) => x.id).filter((x) => x !== DEFAULT_PALETTE),
)}.indexOf(p)>-1)d.dataset.palette=p}}catch(e){}`;
