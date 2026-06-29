import HomeHeader from './HomeHeader';
import HomeFeed from './HomeFeed';
import HotDealsSection from './HotDealsSection';
import SystemInfoPanel from './SystemInfoPanel';
import { MOCK_WEBSITES, MOCK_CREATORS } from '@/app/_lib/mock-home-data';
import type { PublicWebsite, PublicCreator, HotDeal } from '@/app/_lib/public-home';

// Social links aren't wired yet — no real Yepper account URLs to point to.
// Swap these `href="#"` once the actual accounts exist.
const SOCIALS = ['Facebook', 'YouTube', 'Instagram', 'TikTok', 'Pinterest', 'X', 'LinkedIn'];

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
  // Placeholder content while the network is thin — see app/_lib/mock-home-data.ts
  const displayWebsites = websites.length > 0 ? websites : MOCK_WEBSITES;
  const displayCreators = creators.length > 0 ? creators : MOCK_CREATORS;

  return (
    <div className="yp-mesh min-h-screen">
      <HomeHeader />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="max-w-xl mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold text-white font-(--font-display) tracking-tight leading-[1.05]">
            Your audience, their next ad space
          </h1>
          <p className="mt-4 text-base text-white">
            Yepper connects website owners and YouTube creators with advertisers — book ad space directly,
            no agencies in between.
          </p>
        </div>

        <HotDealsSection deals={hotDeals} initialDealId={dealId} />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
          <HomeFeed websites={displayWebsites} creators={displayCreators} />

          <div className="hidden lg:block sticky top-6">
            <SystemInfoPanel />
          </div>
        </div>
      </div>

      <footer className="border-t border-border py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {SOCIALS.map((name) => (
              <span key={name} title={`${name} (not linked yet)`} className="w-8 h-8 rounded-full bg-surface-3 flex items-center justify-center text-[10px] font-bold text-muted">
                {name[0]}
              </span>
            ))}
          </div>
          <p className="text-xs text-white">© {new Date().getFullYear()} Yepper Inc.</p>
        </div>
      </footer>
    </div>
  );
}
