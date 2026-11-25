import type { Metadata } from 'next';
import ProtectedRoute from '@/app/_components/auth/ProtectedRoute';
import DemoExperience from './DemoExperience';

export const metadata: Metadata = {
  title: 'Advertiser Demo',
  description: 'Try simulated YouTube and TikTok advertising campaigns on Yepper.',
};

export default function DemoPage() {
  return (
    <ProtectedRoute>
      <DemoExperience />
    </ProtectedRoute>
  );
}
