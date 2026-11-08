"use client";
import { createAuthClient } from "better-auth/react";

// Same-origin: no baseURL needed.
export const authClient = createAuthClient();

/** Only allow same-site relative redirects after sign-in. */
export function safeNext(value) {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//")
    ? value
    : "/";
}
