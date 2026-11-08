import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Backdrop } from "@/components/Backdrop";

/** Shared shell for public legal pages (privacy, terms). */
export function LegalPage({ title, updated, intro, sections }) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-x-clip">
      <Backdrop />
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-gutter py-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-label-2">Last updated: {updated}</p>
        <p className="mt-6 text-label-2">{intro}</p>

        <div className="mt-8 space-y-4">
          {sections.map(([heading, body], i) => (
            <section key={heading} className="glass-card rounded-card p-6">
              <h2 className="text-lg font-semibold">
                {i + 1}. {heading}
              </h2>
              <div className="mt-2 space-y-2 text-[0.9375rem] text-label-2">
                {body.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
