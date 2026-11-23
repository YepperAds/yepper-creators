import type { Metadata } from 'next';
import ProtectedRoute from '@/app/_components/auth/ProtectedRoute';
import DemoExperience from './DemoExperience';

export const metadata: Metadata = {
  title: 'Advertiser Demo',
  description: 'Try a simulated YouTube advertising campaign on Yepper.',
};

export default function DemoPage() {
  return (
    <ProtectedRoute>
      <DemoExperience />
    </ProtectedRoute>
  );
}
