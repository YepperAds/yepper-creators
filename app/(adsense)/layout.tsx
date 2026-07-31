import type { Metadata } from 'next';
import Providers from './providers';
import ProtectedRoute from '@/app/_components/auth/ProtectedRoute';

export const metadata: Metadata = {
  title: {
    template: '%s | Yepper Adsense',
    default: 'Yepper Adsense',
  },
  description: 'Yepper Adsense: Advertise and monetize with Yepper.',
};

export default function AdsenseLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <Providers>{children}</Providers>
    </ProtectedRoute>
  );
}
