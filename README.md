# 💰 Money Manager

**Money Manager** is a mobile-first personal finance tracker built as an installable PWA with Next.js and MongoDB.

It lets you log income and expenses, manage accounts and categories, set monthly budgets, and understand your spending through charts, with backups you control.

---

## 🔗 Live Demo

* [moneymanager.rahultech.in](https://moneymanager.rahultech.in)

---

## 📸 Preview

![Project Preview](./docs/preview.png)

---

## 📖 Overview

Money Manager helps you:

* Record transactions across multiple accounts
* Organize spending with custom categories
* Plan and track monthly budgets
* Track money you lend and get back, separately from your transactions
* See your net worth across bank accounts, wallets, investments, loans and credit cards
* Review trends with per-period stats and charts
* Keep your data safe with local file backups

---

## ✨ Features

* 🔐 Google Sign-In (Better Auth)
* 🔑 Passkey sign-in (Touch ID, Face ID or screen lock)
* 💸 Transactions: add, edit, delete and restore, with receipt attachments
* 🏦 Accounts & Categories Management, with balance rebuild
* 🎯 Monthly Budgets, with copy-from-previous-month
* 🤝 Track Lending: a separate IOU ledger per person
* 📈 Net Worth: balance history per instrument (accounts, investments, loans)
* 📊 Stats & Charts by day, week, month and year
* 🔍 Search, Filters and CSV Export
* ☁️ Backup & Restore via a local file
* 🔒 Optional App Lock with passcode
* 🎨 4 Themes (Liquid Glass, Android, Paper, Midnight), each with accent palettes
* 📱 Installable PWA

---

## 🛠 Tech Stack

### Frontend

* React 19 (Next.js 16 App Router, JavaScript)
* Tailwind CSS 4
* Lucide Icons

### Backend

* Next.js Route Handlers
* MongoDB (official driver)
* Better Auth (Google OAuth and WebAuthn passkeys via `@better-auth/passkey`)

---

## ⚙️ Getting Started

```bash
npm install
cp .env.example .env.local
npm run db:indexes
npm run dev
```

> **Passkeys:** they are tied to your domain, taken from `BETTER_AUTH_URL`. A passkey created on `localhost` will not work on production, so set it to your real URL when deploying. An account must exist first (sign up with Google), then add a passkey from More → Passkeys.

### Environment Variables

| Variable | Description |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string |
| `MONGODB_TRANSACTIONS` | `true` if your MongoDB supports transactions (replica set) |
| `BETTER_AUTH_SECRET` | Secret used to sign sessions |
| `BETTER_AUTH_URL` | Public base URL, e.g. `http://localhost:3000` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |

---

## 👨‍💻 Author

[**Rahul Dutta**](https://www.linkedin.com/in/irahuldutta02)

---
