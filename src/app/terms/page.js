import { LegalPage } from "@/components/LegalPage";

export const metadata = {
  title: "Terms of Service",
  description: "The terms for using Money Manager.",
};

const SECTIONS = [
  [
    "Acceptance",
    [
      "By signing in or using Money Manager you agree to these terms. If you do not agree, please do not use the app.",
    ],
  ],
  [
    "The service",
    [
      "Money Manager is a personal expense-tracking tool. It is provided free of charge and may change, be interrupted, or be discontinued at any time.",
    ],
  ],
  [
    "Your account",
    [
      "You sign in with Google and are responsible for activity under your account and for keeping your device secure. You must provide accurate information and be at least 13 years old.",
    ],
  ],
  [
    "Your data",
    [
      "You own the data you enter. You grant us only the permission needed to store and process it to operate the app for you. See the Privacy Policy for details.",
      "You are responsible for keeping your own backups. We recommend exporting your data regularly.",
    ],
  ],
  [
    "Acceptable use",
    [
      "Do not misuse the service: no attempts to break, overload or gain unauthorized access to it or other users' data, no unlawful use, and no automated scraping that harms the service.",
    ],
  ],
  [
    "Not financial advice",
    [
      "Money Manager is a record-keeping tool. Balances, budgets and statistics are informational only and are not financial, tax, investment or legal advice.",
    ],
  ],
  [
    "Termination",
    [
      "You can stop using the app and delete your account at any time from More → Delete account. We may suspend or end access for misuse of the service.",
    ],
  ],
  [
    "Disclaimer",
    [
      'The service is provided "as is" and "as available" without warranties of any kind, including accuracy, reliability, availability or fitness for a particular purpose.',
    ],
  ],
  [
    "Limitation of liability",
    [
      "To the fullest extent permitted by law, we are not liable for indirect, incidental or consequential damages, or for loss of data or profits, arising from your use of the app.",
    ],
  ],
  [
    "Changes",
    [
      "We may update these terms. The date above shows the latest revision; continued use after a change means you accept it.",
    ],
  ],
  ["Contact", ["Questions about these terms? Reach out via rahultech.in."]],
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="9 November 2026"
      intro="These terms govern your use of Money Manager. Please read them carefully."
      sections={SECTIONS}
    />
  );
}
