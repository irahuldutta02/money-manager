import { LegalPage } from "@/components/LegalPage";

export const metadata = {
  title: "Privacy Policy",
  description: "How Money Manager collects, uses and protects your data.",
};

const SECTIONS = [
  [
    "What we collect",
    [
      "Account info: when you sign in with Google we receive your name, email address and profile picture. Nothing else is read from your Google account.",
      "Your financial records: the accounts, categories, budgets, transactions, notes and optional receipt photos that you enter into the app.",
      "Session data: a cookie that keeps you signed in, plus basic technical data (such as IP address and browser) stored with your session for security.",
    ],
  ],
  [
    "How we use it",
    [
      "We use your data only to run the app: to sign you in, show your records, calculate balances, budgets and stats, and create exports and backups you ask for.",
      "We do not sell your data, show ads, or use your financial records for advertising or profiling.",
    ],
  ],
  [
    "Google Drive backups",
    [
      "Backups are optional. If you connect Google Drive, the app asks for access limited to its own hidden app-data folder. It cannot see or change your other Drive files.",
      "You can disconnect at any time, and revoke access from your Google Account settings.",
    ],
  ],
  [
    "Storage and security",
    [
      "Your data is stored in a database and transmitted over encrypted connections. Access to every record is restricted to your signed-in account.",
      "The optional app-lock passcode is stored only on your device and never sent to our servers. No system is perfectly secure, so we cannot guarantee absolute security.",
    ],
  ],
  [
    "Cookies and local storage",
    [
      "We use essential cookies for authentication, and your browser's local storage for preferences such as theme and app lock. We do not use advertising or third-party tracking cookies.",
    ],
  ],
  [
    "Sharing",
    [
      "We share data only with the service providers needed to operate the app (hosting, database, and Google for sign-in and optional Drive backup), or when required by law.",
    ],
  ],
  [
    "Your choices",
    [
      "You can export all your data to CSV or a backup file at any time.",
      "You can permanently delete your account from More → Delete account. This removes your account and all your transactions, accounts, categories and budgets. Backups already stored in your own Google Drive remain under your control.",
    ],
  ],
  [
    "Children",
    [
      "Money Manager is not directed to children under 13, and we do not knowingly collect their data.",
    ],
  ],
  [
    "Changes",
    [
      "We may update this policy. The date above shows the latest revision; continued use after a change means you accept it.",
    ],
  ],
  ["Contact", ["Questions about privacy? Reach out via rahultech.in."]],
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="9 November 2026"
      intro="Money Manager is built to keep your financial data yours. This policy explains what we collect, why, and the control you have."
      sections={SECTIONS}
    />
  );
}
