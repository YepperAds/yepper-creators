import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRightIcon, BuildingStorefrontIcon, MegaphoneIcon } from '@heroicons/react/24/outline';
import MarketingPageLayout from '@/app/_components/home/MarketingPageLayout';
import MarketingPageHero from '@/app/_components/home/MarketingPageHero';
import Reveal from '@/app/_components/shared/Reveal';

export const metadata: Metadata = {
  title: 'How Yepper Works',
  description: 'See how advertisers discover media placements and how publishers and creators list their audiences on Yepper.',
};

const BUYER_STEPS = [
  ['Discover', 'Browse website, YouTube, and TikTok listings by category and audience.'],
  ['Compare', 'Review available ad formats, listing details, and terms before proceeding.'],
  ['Continue', 'Sign in to follow the booking or request steps for that specific listing.'],
];

const OWNER_STEPS = [
  ['Create your listing', 'Add your website or connect a supported creator channel.'],
  ['Describe your media', 'Choose categories and complete the audience and placement details.'],
  ['Manage activity', 'Review requests and campaigns directly from your Yepper account.'],
];

function Journey({ title, description, steps, icon: Icon }: { title: string; description: string; steps: string[][]; icon: typeof MegaphoneIcon }) {
  return (
    <article className="rounded-2xl border border-[#E4E2DC] bg-white p-7 sm:p-9 shadow-xs">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EAF4FB] text-[#1090C8]">
        <Icon className="h-6 w-6" />
      </span>
      <h2 className="mt-5 font-(--font-display) text-2xl font-bold text-[#0E0E0F]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#5A5A60]">{description}</p>
      <div className="mt-8 space-y-4">
        {steps.map(([label, body], index) => (
          <div key={label} className="flex gap-4 border-t border-[#E4E2DC] pt-4">
            <span className="text-xs font-bold text-[#1090C8] tabular-nums">00{index + 1}</span>
            <div>
              <h3 className="text-sm font-bold text-[#0E0E0F]">{label}</h3>
              <p className="mt-1 text-xs leading-5 text-[#5A5A60]">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

export default function HowItWorksPage() {
  return (
    <MarketingPageLayout>
      <MarketingPageHero
        eyebrow="How it works"
        title="A marketplace built around clear next steps."
        body="Yepper gives advertisers and independent media owners one place to discover each other, understand the available placements, and move into the right campaign flow."
        primaryLabel="Explore listings"
        primaryHref="/#explore"
      />
      <section className="border-b border-[#E4E2DC] bg-[#FAFAF8] py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <Reveal>
            <div className="mb-12 max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1090C8]">Two sides, one exchange</p>
              <h2 className="mt-2 font-(--font-display) text-3xl font-bold tracking-tight text-[#0E0E0F] sm:text-4xl">
                Start where you are.
              </h2>
            </div>
            <div className="grid gap-8 lg:grid-cols-2">
              <Journey title="Advertisers" description="Find a media placement that suits the audience and campaign you have in mind." steps={BUYER_STEPS} icon={MegaphoneIcon} />
              <Journey title="Publishers & creators" description="Make your website or creator channel visible to brands looking for independent media." steps={OWNER_STEPS} icon={BuildingStorefrontIcon} />
            </div>
          </Reveal>
        </div>
      </section>
      <section className="mkt-warm-noise py-16 sm:py-20">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <div>
            <h2 className="font-(--font-display) text-2xl font-bold text-[#0E0E0F]">Need a little more detail?</h2>
            <p className="mt-1 text-sm text-[#5A5A60]">Find answers about accounts, listings, and campaign flows.</p>
          </div>
          <Link href="/faq" className="mkt-cta-black shrink-0">
            • Visit the FAQ <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </MarketingPageLayout>
  );
}
