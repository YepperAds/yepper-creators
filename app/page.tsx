
// app/page.tsx: server component
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import HomePage from '@/app/_components/home/HomePage';
import DashboardHome from '@/app/_components/dashboard/DashboardHome';
import ProtectedRoute from '@/app/_components/auth/ProtectedRoute';
import { getPublicWebsites, getPublicCreators, getPublicHotDeals } from '@/app/_lib/public-home';

export const metadata: Metadata = {
  title: 'A direct advertising marketplace',
  description: 'Discover website and creator ad placements, or make your audience visible to brands with Yepper.',
};

export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<{ dealId?: string }>;
}) {
  const cookieStore = await cookies();
  const session = cookieStore.get('yepper_session');
  const { dealId } = await searchParams;

  const [websites, creators, hotDeals] = await Promise.all([
    getPublicWebsites(),
    getPublicCreators(),
    getPublicHotDeals(),
  ]);

  if (session?.value) {
    // Cookie presence is just a fast routing heuristic; ProtectedRoute does
    // the real session validation (and bounces to /login if it's stale/forged).
    return (
      <ProtectedRoute>
        <DashboardHome websites={websites} creators={creators} hotDeals={hotDeals} />
      </ProtectedRoute>
    );
  }

  return <HomePage websites={websites} creators={creators} hotDeals={hotDeals} dealId={dealId} />;
}
