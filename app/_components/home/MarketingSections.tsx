import Link from 'next/link';
import {
  BoltIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  SparklesIcon,
} from '@heroicons/react/24/solid';
import Reveal from '@/app/_components/shared/Reveal';

const STEPS = [
  {
    number: '01',
    title: 'Find the right audience',
    body: 'Browse websites and YouTube channels by category, traffic tier, and niche: no cold outreach, no guesswork.',
  },
  {
    number: '02',
    title: 'Book ad space directly',
    body: 'Agree on placement and price with the publisher or creator, and lock in your slot in minutes: no agency in between.',
  },
  {
    number: '03',
    title: 'Track real results',
    body: 'Watch clicks, impressions, and spend roll in on your dashboard, and double down on what converts.',
  },
];

// Alternating tint keeps six identical cards from reading as one gray
// wall; coral and blue are Yepper's own two brand colors, used the way
// the reference decks mixed dark/light/tinted cards for rhythm.
const FEATURES = [
  { icon: BoltIcon, title: 'Instant booking', body: 'Reserve ad space in a few clicks: no back-and-forth emails or waiting on approvals.', tint: 'coral' },
  { icon: ChartBarIcon, title: 'Live analytics', body: 'Real-time impressions, clicks, and spend tracking built into your dashboard.', tint: 'blue' },
  { icon: CurrencyDollarIcon, title: 'Transparent pricing', body: 'The listed price is what you pay. No hidden fees, no agency markups.', tint: 'coral' },
  { icon: UserGroupIcon, title: 'Direct relationships', body: 'Work straight with the publisher or creator, campaign after campaign.', tint: 'coral' },
  { icon: SparklesIcon, title: 'Hot deals', body: 'Admin-curated bundles at a fixed price, when a publisher wants to move space fast.', tint: 'blue' },
] as const;

const TINTS = {
  coral: { bg: '#FDEDE9', border: '#F5C7BA', icon: 'text-coral' },
  blue:  { bg: '#E8F4FA', border: '#BFE1F0', icon: 'text-blue' },
};

export default function MarketingSections() {
  return (
    <div className="mt-24 space-y-24">
      {/* ── How it works ─────────────────────────────────────── */}
      <section id="how-it-works" className="yp-full-bleed scroll-mt-24 py-20" style={{ backgroundColor: '#F7F6F3' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="max-w-lg mb-12">
              <h2 className="text-4xl sm:text-5xl font-bold text-[color:var(--mkt-ink)] font-(--font-display) tracking-tight leading-[1.05]">
                From discovery to results, in three steps
              </h2>
              <p className="mt-3 text-base text-[color:var(--mkt-ink-muted)]">
                Yepper strips out the agencies and the guesswork: book real ad space, straight from the source.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[color:var(--mkt-border)] rounded-3xl overflow-hidden">
              {STEPS.map((step) => (
                <div key={step.number} className="bg-white p-6 sm:p-8">
                  <span className="text-xs font-bold text-coral font-(--font-display)">{step.number}</span>
                  <h3 className="mt-3 text-lg font-bold text-[color:var(--mkt-ink)]">{step.title}</h3>
                  <p className="mt-2 text-sm text-[color:var(--mkt-ink-muted)] leading-relaxed">{step.body}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Feature grid ─────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="max-w-lg mb-12">
            <h2 className="text-4xl sm:text-5xl font-bold text-[color:var(--mkt-ink)] font-(--font-display) tracking-tight leading-[1.05]">
              Built for both sides of the deal
            </h2>
            <p className="mt-3 text-base text-[color:var(--mkt-ink-muted)]">
              Whether you&apos;re booking a campaign or listing your audience, the mechanics stay the same.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((feature) => {
              const tint = TINTS[feature.tint];
              return (
                <div
                  key={feature.title}
                  className="rounded-2xl p-6 border"
                  style={{ backgroundColor: tint.bg, borderColor: tint.border }}
                >
                  <feature.icon className={`w-6 h-6 ${tint.icon} mb-4`} />
                  <h3 className="text-base font-bold text-[color:var(--mkt-ink)]">{feature.title}</h3>
                  <p className="mt-2 text-sm text-[color:var(--mkt-ink-muted)] leading-relaxed">{feature.body}</p>
                </div>
              );
            })}
          </div>
        </Reveal>
      </section>

      {/* ── Final CTA ────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] yp-brand-gradient px-6 py-16 sm:px-16 sm:py-24 text-center">
            <h2 className="text-4xl sm:text-6xl font-bold text-white font-(--font-display) tracking-tight leading-[1.05] max-w-2xl mx-auto">
              Put your ad space, or your budget, to work
            </h2>
            <p className="mt-4 text-base sm:text-lg text-white/85 max-w-md mx-auto">
              Book directly with a publisher or creator: no agency, no waiting on quotes.
            </p>
            <div className="mt-9 flex items-center justify-center gap-3 flex-wrap">
              <Link
                href="/login"
                className="inline-flex items-center h-12 px-7 rounded-full bg-white text-[color:var(--mkt-ink)] text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Get started free
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center h-12 px-7 rounded-full border border-white/40 text-white text-sm font-semibold hover:bg-white/10 transition-colors"
              >
                Sign in
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
