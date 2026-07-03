import type { Metadata } from 'next';
import HomeHeader from '@/app/_components/home/HomeHeader';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Yepper Terms of Service.',
};

export default function TermsPage() {
  return (
    <div className="yp-mesh min-h-screen flex flex-col">
      <HomeHeader />

      <div className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="rounded-2xl border border-border bg-surface-1 p-8 sm:p-10 shadow-sm">
          <h1 className="text-3xl font-bold text-white font-(--font-display)">Terms of Service</h1>
          <p className="mt-2 text-sm text-muted">Last updated: {new Date().getFullYear()}</p>

          <div className="mt-8 space-y-6 text-sm leading-relaxed text-subtle">
            <p>
              These Terms of Service are a placeholder. Replace this page with Yepper&apos;s actual
              terms covering account eligibility, publisher and advertiser obligations, payment and
              payout terms, content standards, and termination policy.
            </p>
            <p>
              Until finalized, this page exists so the link in the sign-in flow resolves instead of
              returning a 404.
            </p>
          </div>
        </div>
      </div>

      <footer className="border-t border-border py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs text-white">© {new Date().getFullYear()} Yepper Inc.</p>
        </div>
      </footer>
    </div>
  );
}
