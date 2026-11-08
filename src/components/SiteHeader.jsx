import Link from "next/link";
import { Brand } from "@/components/Brand";

/** Public-site header shared by the landing and legal pages. */
export function SiteHeader({ maxWidth = "max-w-6xl" }) {
  return (
    <header
      className={`mx-auto flex w-full ${maxWidth} items-center justify-between px-gutter pt-safe`}
    >
      <Brand size="sm" href="/" className="min-h-tap py-3" />
      <Link
        href="/sign-in"
        className="glass flex min-h-tap items-center rounded-full px-5 text-sm font-semibold"
      >
        Sign in
      </Link>
    </header>
  );
}
