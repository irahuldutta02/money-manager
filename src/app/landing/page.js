import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ChartColumn,
  Check,
  CirclePlus,
  CloudUpload,
  Landmark,
  LogIn,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Zap,
} from "lucide-react";
import { Brand } from "@/components/Brand";
import { Backdrop } from "@/components/Backdrop";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = {
  title: { absolute: "Money Manager · Know where your money goes" },
  description:
    "A fast, private expense tracker. Log a spend in seconds, see where it all goes, stay on budget, and back up to your own Google Drive.",
};

const FEATURES = [
  {
    Icon: Zap,
    title: "Add in seconds",
    body: "A calculator-style amount pad, your most-used categories first, and your last account preselected. Logging a coffee takes two taps.",
  },
  {
    Icon: Landmark,
    title: "Every account, one view",
    body: "Cash, bank, cards and wallets with live balances. Transfers between accounts keep the maths honest.",
  },
  {
    Icon: Target,
    title: "Budgets that nudge",
    body: "Set monthly limits overall or per category and see what's left per day before you overspend.",
  },
  {
    Icon: ChartColumn,
    title: "Stats you'll read",
    body: "Spending by category, income vs expense, and how this month compares with the last.",
  },
  {
    Icon: CloudUpload,
    title: "Your data, your Drive",
    body: "Back up and restore from your own Google Drive, or a file on your device. Export everything to CSV any time.",
  },
  {
    Icon: ShieldCheck,
    title: "Private by design",
    body: "Optional app lock, a one-tap delete-my-account, and we only read your name and email to sign you in.",
  },
];

const STEP_ICONS = [LogIn, SlidersHorizontal, CirclePlus];
const STEPS = [
  ["Sign in", "One tap with Google. No passwords to remember."],
  [
    "Pick your setup",
    "Choose your currency, and starter categories and a Cash account, or start from scratch.",
  ],
  [
    "Start tracking",
    "Add your first expense and watch the picture build itself.",
  ],
];

const SPEND = [
  ["Food", "bg-cat-orange", "w-[72%]", "₹12,480"],
  ["Transport", "bg-cat-blue", "w-[46%]", "₹7,900"],
  ["Shopping", "bg-cat-pink", "w-[34%]", "₹5,830"],
  ["Bills", "bg-cat-yellow", "w-[58%]", "₹9,950"],
];

function CtaButton({ children = "Get started free", className = "" }) {
  return (
    <Link
      href="/sign-in"
      className={`inline-flex min-h-[3.25rem] items-center justify-center rounded-full bg-accent px-7 text-base font-semibold text-on-accent shadow-fab transition-transform duration-200 hover:scale-[1.03] active:scale-95 ${className}`}
    >
      {children}
      <ArrowRight aria-hidden size={18} className="ml-2" />
    </Link>
  );
}

function PhoneMock() {
  return (
    <div className="lp-float relative mx-auto w-[17.5rem] sm:w-[19rem]">
      <div className="glass-strong rounded-[2.6rem] p-3">
        <div className="rounded-[2rem] bg-surface p-4">
          <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-fill" />
          <p className="text-xs font-medium tracking-wide text-label-2 uppercase">
            This month
          </p>
          <p className="tabular mt-0.5 text-3xl font-bold tracking-tight">
            ₹48,250
          </p>
          <p className="text-xs text-label-2">left of ₹80,000 income</p>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-fill p-2.5">
              <p className="text-label-2">Income</p>
              <p className="tabular font-semibold text-income">₹80,000</p>
            </div>
            <div className="rounded-xl bg-fill p-2.5">
              <p className="text-label-2">Spent</p>
              <p className="tabular font-semibold text-expense">₹31,750</p>
            </div>
          </div>

          <div className="mt-4 space-y-2.5">
            {SPEND.map(([name, color, width, amt], i) => (
              <div key={name}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium">{name}</span>
                  <span className="tabular text-label-2">{amt}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-fill">
                  <div
                    className={`lp-bar h-full rounded-full ${color} ${width}`}
                    style={{ "--d": `${0.7 + i * 0.12}s` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 divide-y divide-separator rounded-xl bg-fill/60 text-xs">
            {[
              ["Swiggy", "Food", "−₹420"],
              ["Metro card", "Transport", "−₹300"],
              ["Salary", "Income", "+₹80,000"],
            ].map(([n, c, a]) => (
              <div
                key={n}
                className="flex items-center justify-between px-3 py-2"
              >
                <div>
                  <p className="font-medium">{n}</p>
                  <p className="text-label-2">{c}</p>
                </div>
                <p
                  className={`tabular font-semibold ${a.startsWith("+") ? "text-income" : ""}`}
                >
                  {a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div
        aria-hidden
        className="glass-card absolute -right-6 -bottom-4 flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold sm:-right-14"
      >
        <Check aria-hidden size={16} strokeWidth={3} className="text-income" />
        ₹420 added
      </div>
      <div
        aria-hidden
        className="glass-card absolute top-[58%] -left-6 flex items-center gap-1.5 rounded-2xl px-3.5 py-2.5 text-xs font-semibold sm:-left-14"
      >
        <Target
          aria-hidden
          size={14}
          strokeWidth={2.6}
          className="text-accent"
        />
        ₹1,240/day left
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="relative isolate overflow-x-clip">
      <Backdrop />

      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-gutter pt-10 pb-20 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
          <div className="text-center lg:text-left">
            <p className="lp-rise glass mx-auto mb-5 inline-block rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide text-accent uppercase lg:mx-0">
              Free · Private · Installable
            </p>
            <h1
              className="lp-rise text-[2.6rem] leading-[1.05] font-bold tracking-tight sm:text-6xl lg:text-7xl"
              style={{ "--d": "0.08s" }}
            >
              Know exactly{" "}
              <span className="lp-gradient-text">where your money goes.</span>
            </h1>
            <p
              className="lp-rise mx-auto mt-5 max-w-xl text-lg text-label-2 lg:mx-0"
              style={{ "--d": "0.16s" }}
            >
              Log a spend in two taps, see the whole picture across every
              account, and stay on budget, without handing your data to anyone.
            </p>
            <div
              className="lp-rise mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start"
              style={{ "--d": "0.24s" }}
            >
              <CtaButton>Get started free</CtaButton>
              <a
                href="#features"
                className="inline-flex min-h-tap items-center gap-1.5 px-4 py-3 text-sm font-semibold text-label-2 hover:text-label"
              >
                See what&apos;s inside
                <ArrowDown aria-hidden size={16} />
              </a>
            </div>
            <p
              className="lp-rise mt-4 text-xs text-label-2"
              style={{ "--d": "0.32s" }}
            >
              Sign in with Google · ₹ INR, $ USD and 18 more currencies
            </p>
          </div>

          <div className="lp-rise py-6" style={{ "--d": "0.2s" }}>
            <PhoneMock />
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          className="mx-auto max-w-6xl scroll-mt-6 px-gutter py-16"
        >
          <div className="lp-reveal mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
              Everything you need. Nothing you don&apos;t.
            </h2>
            <p className="mt-4 text-label-2">
              Built to be opened ten times a day and closed in five seconds.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <article
                key={f.title}
                className="lp-reveal glass-card rounded-card p-6 transition-transform duration-300 hover:-translate-y-1"
              >
                <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-accent-soft">
                  <f.Icon
                    aria-hidden
                    size={24}
                    strokeWidth={2.2}
                    className="text-accent"
                  />
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-[0.9375rem] text-label-2">{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Steps */}
        <section className="mx-auto max-w-5xl px-gutter py-16">
          <h2 className="lp-reveal text-center text-3xl font-bold tracking-tight sm:text-5xl">
            Up and running in a minute
          </h2>
          <ol className="mt-12 grid gap-4 md:grid-cols-3">
            {STEPS.map(([t, b], i) => (
              <li key={t} className="lp-reveal glass-card rounded-card p-6">
                <div className="flex items-center justify-between">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-accent text-on-accent">
                    {(() => {
                      const Icon = STEP_ICONS[i];
                      return <Icon aria-hidden size={24} strokeWidth={2.2} />;
                    })()}
                  </span>
                  <span className="tabular text-5xl font-bold text-fill">
                    {i + 1}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{t}</h3>
                <p className="mt-1.5 text-[0.9375rem] text-label-2">{b}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-4xl px-gutter py-20">
          <div className="lp-reveal glass-strong relative overflow-hidden rounded-sheet px-6 py-14 text-center sm:px-12">
            <div
              aria-hidden
              className="lp-drift absolute -top-24 right-0 -z-10 size-72 rounded-full bg-accent/25 blur-[90px]"
            />
            <Brand size="md" className="mx-auto mb-6 justify-center" />
            <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
              Take control of your money today.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-label-2">
              It&apos;s free, it takes a minute, and it works on your phone like
              a real app.
            </p>
            <CtaButton className="mt-8">Get started free</CtaButton>
          </div>
        </section>
      </main>

      <SiteFooter featuresHref="#features" />
    </div>
  );
}
