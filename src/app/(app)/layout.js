import { AppShell } from "@/components/AppShell";
import { ThemeScope } from "@/components/ThemeScope";
import { THEME_BOOT_SCRIPT } from "@/lib/client/theme";

// Static shell: no request data is read here. Auth is enforced by proxy.js
// (optimistic) and by every API route (authoritative).
// The app is client-driven (data loads from authenticated /api routes), so
// there is no server-rendered content to validate for instant navigation.
export const instant = false;

export default function AppLayout({ children }) {
  return (
    <>
      {/* Runs before the app paints so there is no flash of the default theme. */}
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      <ThemeScope />
      <AppShell>{children}</AppShell>
    </>
  );
}
