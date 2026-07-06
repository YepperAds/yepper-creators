import Link from 'next/link';
import {
  MagnifyingGlassIcon,
  HandRaisedIcon,
  ArrowTrendingUpIcon,
  BoltIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  SparklesIcon,
} from '@heroicons/react/24/solid';

const STEPS = [
  {
    label: 'Discover',
    title: 'Find the right audience',
    body: 'Browse verified websites and YouTube channels by category, traffic, and niche — no cold outreach, no guesswork.',
    image: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=900&q=80&auto=format&fit=crop',
  },
  {
    label: 'Connect',
    title: 'Book ad space directly',
    body: 'Message creators and publishers, agree on placement and price, and lock in your slot in minutes — no agency middlemen.',
    image: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=900&q=80&auto=format&fit=crop',
  },
  {
    label: 'Grow',
    title: 'Track real results',
    body: 'Watch clicks, impressions, and performance roll in on a live dashboard, and double down on what converts.',
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=900&q=80&auto=format&fit=crop',
  },
];

const FEATURES = [
  { icon: BoltIcon, title: 'Instant booking', body: 'Reserve ad space in a few clicks — no back-and-forth emails or waiting on approvals.' },
  { icon: ShieldCheckIcon, title: 'Verified partners', body: 'Every website and channel is reviewed, so you always know exactly where your ad runs.' },
  { icon: ChartBarIcon, title: 'Live analytics', body: 'Real-time impressions, clicks, and spend tracking built right into your dashboard.' },
  { icon: CurrencyDollarIcon, title: 'Transparent pricing', body: 'See the price upfront. No hidden fees, no agency markups, no surprises.' },
  { icon: UserGroupIcon, title: 'Direct relationships', body: 'Work straight with the publisher or creator — build partnerships that last beyond one campaign.' },
  { icon: SparklesIcon, title: 'Hot deals', body: 'Grab limited-time discounted placements from top-performing creators and sites.' },
];

const STATS = [
  { value: '2,400+', label: 'Publishers & creators' },
  { value: '18K+', label: 'Campaigns booked' },
  { value: '40+', label: 'Countries reached' },
  { value: '98%', label: 'Would book again' },
];

const TESTIMONIALS = [
  {
    quote: 'We booked our first sponsorship in under ten minutes. No calls, no agency fees — just a direct deal with the creator.',
    name: 'Amara Chen',
    role: 'Growth Lead, Fluro',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80&auto=format&fit=crop&crop=faces',
  },
  {
    quote: "Yepper turned my blog's spare ad space into steady monthly income. I set my price, advertisers book it, done.",
    name: 'Marcus Webb',
    role: 'Publisher, dailygearreview.com',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80&auto=format&fit=crop&crop=faces',
  },
  {
    quote: 'The analytics dashboard alone is worth it — I finally see exactly what each placement is doing for my funnel.',
    name: 'Priya Nair',
    role: 'Founder, Loopwear',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80&auto=format&fit=crop&crop=faces',
  },
];

export default function MarketingSections() {
  return (
    <div className="mt-24 space-y-24">
      {/* ── How it works ─────────────────────────────────────── */}
      <section>
        <div className="max-w-xl mx-auto text-center mb-12">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-2 border border-border text-xs font-semibold text-coral">
            <MagnifyingGlassIcon className="w-3.5 h-3.5" /> How it works
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-bold text-white font-(--font-display) tracking-tight">
            From discovery to results, in three steps
          </h2>
          <p className="mt-3 text-sm text-subtle">
            Yepper strips out the agencies and the guesswork — book real ad space, straight from the source.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {STEPS.map((step, i) => (
            <div
              key={step.label}
              className="group rounded-3xl overflow-hidden bg-surface-1 border border-border hover:-translate-y-1 transition-transform duration-200"
            >
              <div className="relative h-40 overflow-hidden">
                <img
                  src={step.image}
                  alt={step.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <span className="absolute top-3 left-3 w-7 h-7 rounded-full bg-coral text-white text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
              </div>
              <div className="p-5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-coral">{step.label}</span>
                <h3 className="mt-1 text-lg font-bold text-white">{step.title}</h3>
                <p className="mt-2 text-sm text-subtle leading-relaxed">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────── */}
      <section className="rounded-3xl border border-border bg-surface-1 px-6 py-10 sm:px-12">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {STATS.map((stat) => (
            <div key={stat.label}>
              <p className="text-3xl sm:text-4xl font-extrabold font-(--font-display) bg-gradient-to-r from-coral to-blue bg-clip-text text-transparent">
                {stat.value}
              </p>
              <p className="mt-1 text-xs sm:text-sm text-subtle">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Feature grid ─────────────────────────────────────── */}
      <section>
        <div className="max-w-xl mx-auto text-center mb-12">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-2 border border-border text-xs font-semibold text-blue">
            <BoltIcon className="w-3.5 h-3.5" /> Why Yepper
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-bold text-white font-(--font-display) tracking-tight">
            Everything you need, nothing you don&apos;t
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl bg-surface-1 border border-border p-6 hover:border-coral/40 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-surface-3 flex items-center justify-center mb-4">
                <feature.icon className="w-5 h-5 text-coral" />
              </div>
              <h3 className="text-base font-bold text-white">{feature.title}</h3>
              <p className="mt-2 text-sm text-subtle leading-relaxed">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────── */}
      <section>
        <div className="max-w-xl mx-auto text-center mb-12">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-2 border border-border text-xs font-semibold text-coral">
            <ArrowTrendingUpIcon className="w-3.5 h-3.5" /> Loved by both sides of the deal
          </span>
          <h2 className="mt-4 text-3xl sm:text-4xl font-bold text-white font-(--font-display) tracking-tight">
            Publishers, creators, and advertisers agree
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="rounded-2xl bg-surface-1 border border-border p-6 flex flex-col">
              <p className="text-sm text-subtle leading-relaxed flex-1">&ldquo;{t.quote}&rdquo;</p>
              <div className="mt-5 flex items-center gap-3">
                <img
                  src={t.avatar}
                  alt={t.name}
                  loading="lazy"
                  className="w-10 h-10 rounded-full object-cover border border-border"
                />
                <div>
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="text-xs text-muted">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────── */}
      <section className="yp-mesh rounded-3xl border border-border px-6 py-14 sm:px-16 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white font-(--font-display) tracking-tight max-w-xl mx-auto">
          Ready to put your ad space — or your budget — to work?
        </h2>
        <p className="mt-3 text-sm sm:text-base text-white/85 max-w-md mx-auto">
          Join thousands of publishers, creators, and advertisers already trading ad space directly on Yepper.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/login"
            className="inline-flex items-center h-11 px-7 rounded-full bg-white text-[#0b0b0c] text-sm font-semibold hover:opacity-85 transition-opacity"
          >
            Get started free
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center h-11 px-7 rounded-full border border-white/30 text-white text-sm font-semibold hover:bg-white/10 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </section>
    </div>
  );
}
