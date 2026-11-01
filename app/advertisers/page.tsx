import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRightIcon, GlobeAltIcon, PlayCircleIcon, UserGroupIcon, CheckCircleIcon, SparklesIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import MarketingPageLayout from '@/app/_components/home/MarketingPageLayout';
import MarketingPageHero from '@/app/_components/home/MarketingPageHero';
import Reveal from '@/app/_components/shared/Reveal';

export const metadata: Metadata = {
  title: 'For Advertisers — Yepper',
  description: 'Reach your exact audience through independent websites, YouTube creators, and TikTok stars. Direct. Transparent. No middlemen.',
};

const CHANNELS = [
  {
    title: 'Website placements',
    detail: 'Target readers on independent sites that your audience actually visits. Review traffic tiers, content categories, and every available ad slot before you book.',
    icon: GlobeAltIcon,
    cta: 'Explore website listings',
  },
  {
    title: 'YouTube integrations',
    detail: 'Partner with creators whose subscribers match your ideal customer. Choose from pre-roll, mid-roll, sponsored segments, and more — all with upfront pricing.',
    icon: PlayCircleIcon,
    cta: 'Find YouTube channels',
  },
  {
    title: 'TikTok sponsorships',
    detail: 'Tap into highly engaged TikTok communities. Connect directly with creators for authentic sponsorship integrations that actually convert.',
    icon: UserGroupIcon,
    cta: 'Discover TikTok creators',
  },
];

const STEPS = [
  {
    n: '001',
    title: 'Start with the audience you want',
    text: 'Browse by content niche, platform, or audience size. Filter down to the exact media that fits your campaign goals.',
  },
  {
    n: '002',
    title: 'Review every detail first',
    text: 'Each listing shows available formats, slot positions, pricing, and terms — clearly laid out before you make any decisions.',
  },
  {
    n: '003',
    title: 'Move directly to campaign',
    text: 'Sign in and complete the booking or request flow for that specific listing. No agency approvals, no mysterious timelines.',
  },
];

const WHY_ITEMS = [
  {
    icon: SparklesIcon,
    title: 'Real, vetted media',
    body: "Every listing is from an actual website or creator, not a programmatic slot in a network you've never heard of.",
  },
  {
    icon: CurrencyDollarIcon,
    title: 'Transparent pricing',
    body: 'You see the full price on the listing. No surprise fees added later. What you read is what you pay.',
  },
  {
    icon: CheckCircleIcon,
    title: 'Decision-ready details',
    body: 'We show you everything before you commit — audience demographics, ad format specs, and placement visibility.',
  },
];

export default function AdvertisersPage() {
  return (
    <MarketingPageLayout>
      <MarketingPageHero
        eyebrow="For advertisers"
        title="Reach the people who actually care."
        body="Stop guessing with programmatic. Discover independent websites and creator channels, review every placement detail, and book directly with the media owner."
        primaryLabel="Explore available listings"
        primaryHref="/#explore"
      />

      {/* Why Yepper for advertisers */}
      <section className="border-b border-[#E4E2DC] bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <Reveal>
            <div className="mb-12 max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1090C8]">Why advertisers choose Yepper</p>
              <h2 className="mt-2 font-(--font-display) text-3xl font-bold tracking-tight text-[#0E0E0F] sm:text-4xl">
                Advertising that actually makes sense.
              </h2>
              <p className="mt-4 text-sm leading-6 text-[#5A5A60]">
                You deserve to know where your money goes. Yepper gives you the clarity that programmatic networks never will.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {WHY_ITEMS.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-[#E4E2DC] bg-[#FAFAF8] p-7 transition hover:-translate-y-0.5 hover:shadow-sm"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF4FB] text-[#1090C8]">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 text-base font-bold text-[#0E0E0F]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#5A5A60]">{item.body}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Channels section */}
      <section className="border-b border-[#E4E2DC] bg-[#FAFAF8] py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <Reveal>
            <div className="mb-12 max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1090C8]">Choose your channel</p>
              <h2 className="mt-2 font-(--font-display) text-3xl font-bold tracking-tight text-[#0E0E0F] sm:text-4xl">
                One campaign can start in three different places.
              </h2>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {CHANNELS.map((channel) => (
                <article
                  key={channel.title}
                  className="rounded-2xl border border-[#E4E2DC] bg-white p-7 transition hover:-translate-y-1 hover:shadow-md"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EAF4FB] text-[#1090C8]">
                    <channel.icon className="h-6 w-6" />
                  </span>
                  <h3 className="mt-5 text-lg font-bold text-[#0E0E0F]">{channel.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#5A5A60]">{channel.detail}</p>
                  <Link
                    href="/#explore"
                    className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-[#1090C8] transition hover:gap-2.5"
                  >
                    {channel.cta} <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                </article>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Steps section — numbered Aetherfield list style */}
      <section className="border-b border-[#E4E2DC] bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <Reveal>
            <div className="mb-12 max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1090C8]">A straightforward workflow</p>
              <h2 className="mt-2 font-(--font-display) text-3xl font-bold tracking-tight text-[#0E0E0F] sm:text-4xl">
                From brief to live campaign in three steps.
              </h2>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {STEPS.map((step) => (
                <article
                  key={step.n}
                  className="rounded-2xl border border-[#E4E2DC] bg-[#FAFAF8] p-7"
                >
                  <span className="text-xs font-bold text-[#1090C8] tabular-nums">{step.n}</span>
                  <h3 className="mt-4 text-lg font-bold text-[#0E0E0F]">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#5A5A60]">{step.text}</p>
                </article>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Warm texture CTA */}
      <section className="mkt-warm-noise py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <Reveal>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-(--font-display) text-2xl font-bold text-[#0E0E0F] sm:text-3xl">
                  Ready to find your next placement?
                </h2>
                <p className="mt-2 text-sm text-[#5A5A60]">
                  Explore current listings or create an advertiser account to continue.
                </p>
              </div>
              <Link href="/login" className="mkt-cta-black shrink-0">
                • Get started free
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </MarketingPageLayout>
  );
}
