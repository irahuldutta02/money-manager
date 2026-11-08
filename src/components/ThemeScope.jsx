"use client";
import { useLayoutEffect } from "react";
import { applyTheme, clearTheme, readTheme } from "@/lib/client/theme";

/** Applies the saved theme while the signed-in app is mounted, and only then. */
export function ThemeScope() {
  useLayoutEffect(() => {
    applyTheme(readTheme(), { persist: false });
    return clearTheme;
  }, []);
  return null;
}
