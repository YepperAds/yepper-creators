import type { Metadata } from 'next';
import Sidebar from './_components/Sidebar';
import TopNav from './_components/TopNav';
import ProtectedRoute from '@/app/_components/auth/ProtectedRoute';

export const metadata: Metadata = {
  title: {
    template: "%s | Yepper",
    default: 'Dashboard',
  },
  description: "Yepper advertiser panel.",
};

// ─────────────────────────────────────────────────────────────────────────────
// Advertiser panel layout
// Uses a clean sidebar + top nav dashboard shell
// ─────────────────────────────────────────────────────────────────────────────

export default function AdvertiserLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="flex h-screen w-full bg-(--color-background) text-(--color-white) overflow-hidden">

        {/* ── Left: Persistent Sidebar ── */}
        <Sidebar />

        {/* ── Right: Main Content Area ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Top Navigation */}
          <TopNav />

          {/* Dynamic Page Content */}
          <main className="flex-1 overflow-y-auto bg-(--color-background) p-6">
            {children}
          </main>

        </div>

      </div>
    </ProtectedRoute>
  );
}
