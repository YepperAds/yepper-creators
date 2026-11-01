import type { ReactNode } from 'react';
import HomeHeader from './HomeHeader';
import MarketingFooter from './MarketingFooter';

export default function MarketingPageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#0E0E0F]">
      <HomeHeader />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
}
