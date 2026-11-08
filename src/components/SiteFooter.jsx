import Link from "next/link";

/** Public-site footer shared by the landing and legal pages. */
export function SiteFooter({ featuresHref = "/#features" }) {
  return (
    <footer className="relative mt-10 w-full overflow-hidden border-t border-separator">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-gutter pt-12 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xs space-y-2 text-sm text-label-2">
          <p>Built with care for people who like to know where it all went.</p>
          <p>
            © Money Manager · Made by{" "}
            <a
              href="https://rahultech.in"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-label underline-offset-4 hover:text-accent hover:underline"
            >
              rahultech.in
            </a>
          </p>
        </div>
        <nav
          aria-label="Footer"
          className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold"
        >
          <Link href="/sign-in" className="hover:text-accent">
            Sign in
          </Link>
          <Link href={featuresHref} className="hover:text-accent">
            Features
          </Link>
          <Link href="/privacy" className="hover:text-accent">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-accent">
            Terms
          </Link>
        </nav>
      </div>
      <p
        aria-hidden
        className="lp-footer-word pointer-events-none mt-6 pb-[0.12em] text-center leading-[0.95] font-black tracking-tighter whitespace-nowrap select-none"
      >
        Money Manager
      </p>
    </footer>
  );
}
