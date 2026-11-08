import "./globals.css";

export const metadata = {
  title: { default: "Money Manager", template: "%s · Money Manager" },
  description: "Track expenses, accounts and budgets.",
  applicationName: "Money Manager",
  appleWebApp: {
    capable: true,
    title: "Money Manager",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
