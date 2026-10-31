import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import MarketingPageLayout from '@/app/_components/home/MarketingPageLayout';
import MarketingPageHero from '@/app/_components/home/MarketingPageHero';
import Reveal from '@/app/_components/shared/Reveal';

export const metadata: Metadata = {
  title: 'FAQ & Support — Yepper',
  description: 'Answers about using Yepper as an advertiser, website publisher, or creator.',
};

const QUESTIONS = [
  {
    q: 'What is Yepper?',
    a: 'Yepper is a direct marketplace where advertisers discover independent websites and creator channels, and media owners make their advertising inventory easy to buy without middleman agencies.',
  },
  {
    q: 'Which media channels can I explore?',
    a: 'Yepper listings include independent websites, YouTube channels, and TikTok creators. Each listing shows available placements, metrics, and pricing upfront.',
  },
  {
    q: 'Can I browse before creating an account?',
    a: 'Yes. You can explore all public listings without signing in. You only create an account when you decide to book a placement or list your media.',
  },
  {
    q: 'How do I add my website as a publisher?',
    a: 'Create a website listing, select its business categories, and specify the pages and slots where you offer ad placements. Yepper’s tag integration confirms domain ownership and tracks impressions.',
  },
  {
    q: 'How do creators connect their channels?',
    a: 'Creators connect their YouTube or TikTok account via our simple verification step. Once connected, your channel and sponsorship tiers become visible to advertisers.',
  },
  {
    q: 'How does publisher pricing work?',
    a: 'Publishers keep 100% of their listed price. Yepper adds a transparent platform fee on the buyer’s side rather than shaving revenue from your earnings.',
  },
  {
    q: 'How can I contact support?',
    a: 'Reach our team directly at support@yepper.cc. We reply within one business day.',
  },
];

export default function FaqPage() {
  return (
    <MarketingPageLayout>
      <MarketingPageHero
        eyebrow="FAQ & support"
        title="Clear answers before you get started."
        body="Learn how listings, accounts, and campaign flows work on Yepper. If you need help with a specific account or campaign, our support team is here to help."
        primaryLabel="Browse questions"
        primaryHref="/faq#questions"
      />
      <section id="questions" className="scroll-mt-24 border-b border-[#E4E2DC] bg-white py-16 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:px-10">
          <Reveal>
            <div className="max-w-sm">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1090C8]">Common questions</p>
              <h2 className="mt-2 font-(--font-display) text-3xl font-bold tracking-tight text-[#0E0E0F] sm:text-4xl">
                What you need to know.
              </h2>
              <p className="mt-4 text-sm leading-6 text-[#5A5A60]">
                Questions about a payment, a website integration, or a creator campaign? Contact our team directly.
              </p>
              <a href="mailto:support@yepper.cc" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#1090C8] hover:underline">
                support@yepper.cc <ArrowRightIcon className="h-4 w-4" />
              </a>
            </div>
          </Reveal>
          <Reveal>
            <div className="divide-y divide-[#E4E2DC] border-y border-[#E4E2DC]">
              {QUESTIONS.map((item) => (
                <details key={item.q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-left text-[15px] font-bold text-[#0E0E0F] marker:hidden [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span aria-hidden="true" className="text-xl font-light text-[#1090C8] transition-transform duration-200 group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="max-w-2xl pt-3 pr-8 text-sm leading-6 text-[#5A5A60]">{item.a}</p>
                </details>
              ))}
            </div>
          </Reveal>
        </div>
      </section>
      <section className="mkt-warm-noise py-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <p className="text-sm text-[#5A5A60]">For legal and data-use details, see our existing policies.</p>
          <div className="flex gap-6 text-sm font-semibold text-[#0E0E0F]">
            <Link href="/privacy" className="hover:text-[#1090C8]">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-[#1090C8]">Terms of Service</Link>
          </div>
        </div>
      </section>
    </MarketingPageLayout>
  );
}
