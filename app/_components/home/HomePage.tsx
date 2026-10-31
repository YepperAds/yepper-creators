import Link from 'next/link';
import HomeHeader from './HomeHeader';
import MarketingFooter from './MarketingFooter';
import Hero from './Hero';
import ExploreDirectory from './ExploreDirectory';
import HotDealsSection from './HotDealsSection';
import MarketingShowcase from './MarketingShowcase';
import MarketingSections from './MarketingSections';
import Reveal from '@/app/_components/shared/Reveal';
import { MOCK_WEBSITES, MOCK_CREATORS } from '@/app/_lib/mock-home-data';
import type { PublicWebsite, PublicCreator, HotDeal } from '@/app/_lib/public-home';

export default function HomePage({
  websites,
  creators,
  hotDeals,
  dealId,
}: {
  websites: PublicWebsite[];
  creators: PublicCreator[];
  hotDeals: HotDeal[];
  dealId?: string;
}) {
  const displayWebsites = websites.length > 0 ? websites : MOCK_WEBSITES;
  const displayCreators = creators.length > 0 ? creators : MOCK_CREATORS;
  const usesSampleWebsites = websites.length === 0;
  const usesSampleCreators = creators.length === 0;

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#0E0E0F]">
      <div data-yepper-space="f997d5cb-85c4-47ea-adc8-214bc2fbc293" />
      <HomeHeader />
      <main>
        {/* ── Hero ──────────────────────────────────────────────────── */}
        <Hero />

        {/* ── Three-pillar trust bar ──────────────────────────────── */}
        <section className="border-y border-[#E4E2DC] bg-white">
          <div className="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-[#E4E2DC] px-5 py-2 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-8 lg:px-10">
            {[
              { title: 'One place to discover', text: 'Websites, YouTube channels, and TikTok creators in a single marketplace.' },
              { title: 'See it all before you commit', text: 'Every listing shows full placement details, pricing, and terms upfront.' },
              { title: 'Built for both sides', text: 'Whether you buy ad space or sell it, Yepper has a clear path for you.' },
            ].map((item) => (
              <div key={item.title} className="px-5 py-5 sm:px-8">
                <p className="text-sm font-bold text-[#0E0E0F]">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-[#5A5A60]">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Feature showcase ────────────────────────────────────── */}
        <MarketingShowcase />

        {/* ── Hot Deals ───────────────────────────────────────────── */}
        {hotDeals.length > 0 && (
          <section className="border-t border-[#E4E2DC] bg-white py-16 sm:py-24">
            <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
              <Reveal>
                <div className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
                  <div className="max-w-2xl">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1090C8]">Curated campaigns</p>
                    <h2 className="mt-2 font-(--font-display) text-3xl font-bold leading-tight tracking-tight text-[#0E0E0F] sm:text-4xl">
                      Ready-made media bundles
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-[#5A5A60]">
                      Hot Deals bundle website placements and creator channels into one curated offer — priced and ready to run.
                    </p>
                  </div>
                  <Link
                    href="/how-it-works"
                    className="inline-flex w-fit items-center rounded-full border border-[#C8C5BE] px-4 py-2 text-xs font-semibold text-[#0E0E0F] transition hover:border-[#9A9A9F]"
                  >
                    See how it works
                  </Link>
                </div>
                <HotDealsSection
                  deals={hotDeals}
                  initialDealId={dealId}
                  requireLogin
                  websites={displayWebsites}
                  creators={displayCreators}
                  variant="light"
                  horizontal
                />
              </Reveal>
            </div>
          </section>
        )}

        {/* ── Explore Directory (Overhauled Grid & Filters) ────────── */}
        <section
          id="explore"
          className="scroll-mt-24 border-t border-[#E4E2DC] bg-[#FAFAF8] py-16 sm:py-24"
        >
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <Reveal>
              <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div className="max-w-2xl">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1090C8]">Explore directory</p>
                  <h2 className="mt-2 font-(--font-display) text-3xl font-bold leading-tight tracking-tight text-[#0E0E0F] sm:text-5xl">
                    Find the audience that fits.
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-[#5A5A60] sm:text-base">
                    Browse verified website placements and creator channels. Click any listing to review ad formats, audience demographics, and direct booking options.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <Link href="/advertisers" className="text-xs font-semibold text-[#1090C8] hover:underline">
                    Advertiser guide →
                  </Link>
                  <span className="text-[#C8C5BE]">·</span>
                  <Link href="/publishers" className="text-xs font-semibold text-[#1090C8] hover:underline">
                    Creator monetization →
                  </Link>
                </div>
              </div>

              {/* Responsive 3-column Directory */}
              <ExploreDirectory
                websites={displayWebsites}
                creators={displayCreators}
                usesSampleWebsites={usesSampleWebsites}
                usesSampleCreators={usesSampleCreators}
              />
            </Reveal>
          </div>
        </section>

        {/* ── Final CTA ───────────────────────────────────────────── */}
        <MarketingSections />
      </main>
      <MarketingFooter />
    </div>
  );
}
