import Link from 'next/link';
import HomeHeader from './HomeHeader';
import Hero from './Hero';
import WebsiteRow from './WebsiteRow';
import HotDealsSection from './HotDealsSection';
import SectionIntro from './SectionIntro';
import SystemInfoPanel from './SystemInfoPanel';
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
  // Placeholder content while the network is thin, see app/_lib/mock-home-data.ts
  const displayWebsites = websites.length > 0 ? websites : MOCK_WEBSITES;
  const displayCreators = creators.length > 0 ? creators : MOCK_CREATORS;

  return (
    <div className="bg-[color:var(--mkt-bg)] min-h-screen">
      <HomeHeader />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Hero />
      </div>

      <div id="explore" className="scroll-mt-24">
        {/* Full-bleed color bands: no border, no inset card, just a
            confident wall of brand color behind each real-content row. */}
        {hotDeals.length > 0 && (
          <section className="yp-full-bleed py-16 sm:py-20" style={{ backgroundColor: '#FDEDE9' }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <Reveal>
                <SectionIntro
                  eyebrow="Fastest way in"
                  title="Skip the search. Start with a Hot Deal."
                  body="Every Hot Deal bundles YouTube slots and website ad spaces an admin has already vetted and priced together, at a discount. Instead of piecing together your own media plan from scratch, grab a ready-made bundle and launch today."
                  accent="coral"
                />
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

        <section className="yp-full-bleed py-16 sm:py-20" style={{ backgroundColor: '#E8F4FA' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <SectionIntro
                eyebrow="Pick it yourself"
                title="Browse websites directly"
                body="Prefer to choose your own placement? Every listed website is sorted into a real traffic tier, so you know exactly what audience you're reaching before you book. No cold outreach, no guessing."
                accent="blue"
              />
              <WebsiteRow websites={displayWebsites} />
            </Reveal>
          </div>
        </section>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20">
        <SystemInfoPanel />
        <MarketingSections />
      </div>

      <footer className="border-t border-[color:var(--mkt-border)] py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[color:var(--mkt-ink-muted)]">© {new Date().getFullYear()} Yepper Inc.</p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-xs text-[color:var(--mkt-ink-muted)] hover:text-[color:var(--mkt-ink)] transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-xs text-[color:var(--mkt-ink-muted)] hover:text-[color:var(--mkt-ink)] transition-colors">Terms of Use</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
