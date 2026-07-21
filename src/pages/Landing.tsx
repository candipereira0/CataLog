import { Link } from "react-router-dom";

const STRIPE_PRO_ANNUAL = "https://buy.stripe.com/3cIeVcaDZcrSdVd31O5Vu00";
const STRIPE_LIFETIME = "https://buy.stripe.com/aFa7sKfYjcrS18r31O5Vu01";

function PricingCard({
  name,
  price,
  period,
  features,
  productType,
  cta,
  highlighted = false,
}: {
  name: string;
  price: string;
  period?: string;
  features: string[];
  productType: string;
  cta: string;
  highlighted?: boolean;
}) {
  const href =
    productType === "pro_monthly" || productType === "pro_yearly"
      ? STRIPE_PRO_ANNUAL
      : productType === "lifetime"
      ? STRIPE_LIFETIME
      : null;

  const btnClass = `mt-8 w-full rounded-lg px-4 py-3 text-sm font-semibold transition-colors inline-block text-center ${
    highlighted
      ? "bg-violet-600 text-white hover:bg-violet-500"
      : "bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-700"
  }`;

  return (
    <div
      className={`relative rounded-2xl border p-8 flex flex-col ${
        highlighted
          ? "border-violet-500 bg-violet-950/30 shadow-lg shadow-violet-500/20"
          : "border-gray-800 bg-gray-900"
      }`}
    >
      {highlighted && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-violet-500 px-3 py-1 text-xs font-semibold text-white">
          Most Popular
        </span>
      )}
      <h3 className="text-xl font-bold text-white">{name}</h3>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-4xl font-bold text-white">{price}</span>
        {period && <span className="text-gray-400">/{period}</span>}
      </div>
      <ul className="mt-6 flex-1 space-y-3">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
            <svg
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-violet-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            {f}
          </li>
        ))}
      </ul>
      {href ? (
        <a href={href} className={btnClass}>
          {cta}
        </a>
      ) : (
        <Link to={`/register?plan=${productType}`} className={btnClass}>
          {cta}
        </Link>
      )}
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-dvh bg-gray-950 text-gray-100">
      {/* Nav */}
      <nav className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-800/50">
        <Link to="/" className="text-xl font-bold tracking-tight">
          <span className="text-violet-400">Cata</span>
          <span className="text-white">Log</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            to="/login"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Sign In
          </Link>
          <Link
            to="/register"
            className="rounded-lg bg-violet-600 px-3 py-2 sm:px-4 sm:py-2 text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-4 sm:px-8 pb-16 sm:pb-28 pt-12 sm:pt-24">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-900/20 via-transparent to-transparent pointer-events-none" />
        <div className="relative mx-auto max-w-4xl text-center">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            <span className="text-white">Your music library,</span>{" "}
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              organized by AI
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-gray-400 sm:text-xl">
            CataLog uses AI to automatically tag your tracks with hyper-specific
            metadata — genres, subgenres, BPM, key, mood, and more. Generate
            smart playlists, discover new music, and export to any DJ software.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              to="/register"
              className="rounded-lg bg-violet-600 px-6 sm:px-8 py-3 sm:py-3.5 text-base font-semibold text-white hover:bg-violet-500 transition-colors shadow-lg shadow-violet-600/30 w-full sm:w-auto text-center"
            >
              Get Started Free
            </Link>
            <a
              href="#features"
              className="rounded-lg border border-gray-700 px-6 sm:px-8 py-3 sm:py-3.5 text-base font-medium text-gray-300 hover:bg-gray-800 transition-colors w-full sm:w-auto text-center"
            >
              See Features
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 py-20 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold text-white sm:text-4xl">
            Everything a DJ needs
          </h2>
          <p className="mt-4 text-center text-gray-400">
            Powerful tools to organize, discover, and export — all in one place.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* AI Auto-Tagging */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 hover:border-violet-700/50 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-violet-600/20">
                <svg className="h-6 w-6 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">AI Auto-Tagging</h3>
              <p className="mt-2 text-sm text-gray-400">
                Automatically tag every track with genre, subgenre, BPM, key, mood,
                language, chord progressions, and more — no manual work.
              </p>
            </div>

            {/* Smart Playlists */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 hover:border-violet-700/50 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-600/20">
                <svg className="h-6 w-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">Smart Playlists</h3>
              <p className="mt-2 text-sm text-gray-400">
                Generate playlists from natural-language prompts like
                "deep-tech Bollywood for a 2-hour wedding set" — AI does the rest.
              </p>
            </div>

            {/* Discovery Mode */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 hover:border-violet-700/50 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-600/20">
                <svg className="h-6 w-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">Discovery Mode</h3>
              <p className="mt-2 text-sm text-gray-400">
                Explore similar artists in an interactive map, find tracks by humming
                or describing the sound, and get AI-powered crate-digging suggestions.
              </p>
            </div>

            {/* DJ Software Exports */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 hover:border-violet-700/50 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sky-600/20">
                <svg className="h-6 w-6 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">DJ Software Exports</h3>
              <p className="mt-2 text-sm text-gray-400">
                Export playlists and crates directly to Traktor, Serato, Rekordbox,
                and more — ready to load at your next gig.
              </p>
            </div>

            {/* Cloud Sync */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 hover:border-violet-700/50 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-rose-600/20">
                <svg className="h-6 w-6 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">Cloud Sync</h3>
              <p className="mt-2 text-sm text-gray-400">
                Sync your library across all devices with offline mode. Access your
                collection anywhere, even without a connection.
              </p>
            </div>

            {/* Built-in Player */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 hover:border-violet-700/50 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-600/20">
                <svg className="h-6 w-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">Built-in Player</h3>
              <p className="mt-2 text-sm text-gray-400">
                Waveform visualization, cue points, beatgrid, and BPM-synced looping
                — no need to switch to your DJ software to audition tracks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="px-6 py-20 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold text-white sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-center text-gray-400">
            Start free, upgrade when you're ready. No hidden fees.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            <PricingCard
              name="Free"
              price="$0"
              features={[
                "Up to 500 tracks",
                "Basic auto-tagging",
                "3 AI playlist prompts/month",
                "Standard exports",
                "Community support",
              ]}
              productType="free"
              cta="Get Started"
            />
            <PricingCard
              name="Pro"
              price="$12"
              period="mo"
              features={[
                "Unlimited tracks",
                "Full AI tagging & playlists",
                "Cloud sync & offline mode",
                "All export formats",
                "Priority support",
                "Discovery Mode",
              ]}
              productType="pro_monthly"
              cta="Get Pro"
              highlighted
            />
            <PricingCard
              name="Lifetime"
              price="$299"
              features={[
                "Everything in Pro",
                "One-time payment",
                "Lifetime access",
                "All future updates",
                "Early access to new features",
              ]}
              productType="lifetime"
              cta="Buy Lifetime"
            />
          </div>
          <p className="mt-6 text-center text-sm text-gray-500">
            Pro Yearly also available —{" "}
            <span className="text-violet-400 font-semibold">$99/year</span> (save 31%)
          </p>
        </div>
      </section>

      {/* Social Proof */}
      <section className="border-t border-gray-800/50 px-6 py-16 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-lg text-gray-400 italic">
            "Built for DJs, curators, and serious collectors who demand more than
            what Spotify and Apple Music can offer."
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-20 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Ready to organize your library?
          </h2>
          <p className="mt-4 text-gray-400">
            Join thousands of DJs and curators who trust CataLog to keep their
            music collection perfectly organized.
          </p>
          <Link
            to="/register"
            className="mt-8 inline-block rounded-lg bg-violet-600 px-8 py-3.5 text-base font-semibold text-white hover:bg-violet-500 transition-colors shadow-lg shadow-violet-600/30"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800/50 px-6 py-8">
        <div className="mx-auto max-w-6xl flex flex-col items-center justify-between gap-4 sm:flex-row">
          <Link to="/" className="text-lg font-bold tracking-tight">
            <span className="text-violet-400">Cata</span>
            <span className="text-white">Log</span>
          </Link>
          <p className="text-sm text-gray-600">
            &copy; {new Date().getFullYear()} CataLog. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
