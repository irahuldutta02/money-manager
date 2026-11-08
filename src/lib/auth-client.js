"use client";
import { createAuthClient } from "better-auth/react";
import { passkeyClient } from "@better-auth/passkey/client";

// Same-origin: no baseURL needed.
export const authClient = createAuthClient({
  plugins: [passkeyClient()],
});

/** Only allow same-site relative redirects after sign-in. */
export function safeNext(value) {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//")
    ? value
    : "/";
}
