import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRightIcon, CheckCircleIcon, GlobeAltIcon, PlayCircleIcon, VideoCameraIcon } from '@heroicons/react/24/outline';
import MarketingPageLayout from '@/app/_components/home/MarketingPageLayout';
import MarketingPageHero from '@/app/_components/home/MarketingPageHero';
import Reveal from '@/app/_components/shared/Reveal';

export const metadata: Metadata = {
  title: 'For Publishers & Creators — Yepper',
  description: 'List a website or connect a YouTube or TikTok account to make your audience discoverable to advertisers on Yepper.',
};

const MEDIA = [
  { title: 'Website publishers', detail: 'Register your site, choose relevant categories, and add the pages where you plan to offer ad placements.', icon: GlobeAltIcon },
  { title: 'YouTube creators', detail: 'Connect your channel so brands can discover your content and explore available promotions.', icon: PlayCircleIcon },
  { title: 'TikTok creators', detail: 'Connect your profile and make your sponsorship opportunities easier for advertisers to find.', icon: VideoCameraIcon },
];

const WORKFLOW = [
  { number: '001', title: 'Create your media profile', text: 'Add your website or connect a supported creator account.' },
  { number: '002', title: 'Describe your audience', text: 'Choose categories and provide the listing details brands need.' },
  { number: '003', title: 'Review opportunities', text: 'Keep track of requests, campaigns, and account activity directly in Yepper.' },
];

export default function PublishersPage() {
  return (
    <MarketingPageLayout>
      <MarketingPageHero
        eyebrow="For publishers & creators"
        title="Your audience has value. Make it visible."
        body="Bring your website or creator channel to Yepper. Share what you publish, organize your advertising options, and let brands discover your audience directly."
        primaryLabel="List your media"
        primaryHref="/login"
      />

      <section className="border-b border-[#E4E2DC] bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <Reveal>
            <div className="mb-12 max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1090C8]">Choose your media</p>
              <h2 className="mt-2 font-(--font-display) text-3xl font-bold tracking-tight text-[#0E0E0F] sm:text-4xl">
                One home for your media opportunities.
              </h2>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {MEDIA.map((item) => (
                <article key={item.title} className="rounded-2xl border border-[#E4E2DC] bg-[#FAFAF8] p-7 transition hover:-translate-y-1 hover:shadow-sm">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EAF4FB] text-[#1090C8]">
                    <item.icon className="h-6 w-6" />
                  </span>
                  <h3 className="mt-5 text-lg font-bold text-[#0E0E0F]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#5A5A60]">{item.detail}</p>
                </article>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-b border-[#E4E2DC] bg-[#FAFAF8] py-16 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:px-10">
          <Reveal>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1090C8]">Your workflow</p>
            <h2 className="mt-2 font-(--font-display) text-3xl font-bold leading-tight tracking-tight text-[#0E0E0F] sm:text-4xl">
              Set up once. Keep your options organized.
            </h2>
            <p className="mt-4 text-sm leading-7 text-[#5A5A60]">
              Website owners can add categories and pages, then install Yepper’s site integration to confirm the domain and report activity. Creators can connect supported social accounts and manage channel details effortlessly.
            </p>
          </Reveal>
          <Reveal>
            <div className="space-y-4">
              {WORKFLOW.map((item) => (
                <article key={item.number} className="flex gap-4 rounded-2xl border border-[#E4E2DC] bg-white p-6 shadow-xs">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EAF4FB] text-xs font-bold text-[#1090C8] tabular-nums">
                    {item.number}
                  </span>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-[#0E0E0F]">{item.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-[#5A5A60]">{item.text}</p>
                  </div>
                  <CheckCircleIcon className="h-5 w-5 shrink-0 text-emerald-600" />
                </article>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-b border-[#E4E2DC] bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-4xl rounded-2xl border border-[#E4E2DC] bg-[#FAFAF8] p-8 sm:p-12">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1090C8]">Clear publisher pricing</p>
          <h2 className="mt-2 font-(--font-display) text-2xl font-bold text-[#0E0E0F] sm:text-3xl">
            Keep 100% of the price you list.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5A5A60]">
            For website publisher placements, Yepper’s margin is added to the advertiser price rather than deducted from your listed rate. You keep what you charge.
          </p>
          <Link href="/faq" className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-[#1090C8] transition hover:gap-2.5">
            Read common questions <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="mkt-warm-noise py-16 sm:py-24">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <div>
            <h2 className="font-(--font-display) text-2xl font-bold text-[#0E0E0F] sm:text-3xl">
              Ready to list your audience?
            </h2>
            <p className="mt-2 text-sm text-[#5A5A60]">
              Create an account to add a website or connect your creator profile.
            </p>
          </div>
          <Link href="/login" className="mkt-cta-black shrink-0">
            • Get started free
          </Link>
        </div>
      </section>
    </MarketingPageLayout>
  );
}
