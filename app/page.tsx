
// app/page.tsx  — server component
import { cookies } from 'next/headers';
import HomePage from '@/app/_components/home/HomePage';
import DashboardHome from '@/app/_components/dashboard/DashboardHome';
import ProtectedRoute from '@/app/_components/auth/ProtectedRoute';
import { getPublicWebsites, getPublicCreators, getPublicHotDeals } from '@/app/_lib/public-home';

export default async function RootPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('yepper_session');

  const [websites, creators, hotDeals] = await Promise.all([
    getPublicWebsites(),
    getPublicCreators(),
    getPublicHotDeals(),
  ]);

  if (session?.value) {
    // Cookie presence is just a fast routing heuristic — ProtectedRoute does
    // the real session validation (and bounces to /login if it's stale/forged).
    return (
      <ProtectedRoute>
        <DashboardHome websites={websites} creators={creators} hotDeals={hotDeals} />
      </ProtectedRoute>
    );
  }

  return <HomePage websites={websites} creators={creators} hotDeals={hotDeals} />;
}
