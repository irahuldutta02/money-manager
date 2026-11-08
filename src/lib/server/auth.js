import "server-only";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { passkey } from "@better-auth/passkey";
import { nextCookies } from "better-auth/next-js";
import { TRANSACTIONS_ENABLED, client, getDb } from "./mongodb";

// Google only, with basic scopes (openid, email, profile).
export const auth = betterAuth({
  database: mongodbAdapter(getDb(), {
    client,
    transaction: TRANSACTIONS_ENABLED,
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: { enabled: false },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
  },
  // Must be the last plugin: lets server code set auth cookies.
  plugins: [passkey({ rpName: "Money Manager" }), nextCookies()],
});
