import type { Metadata } from 'next';
import Image from 'next/image';
import AuthGuard from '@/app/_components/auth/AuthGuard';
import CampaignMosaic from '@/app/_components/auth/CampaignMosaic';

export const metadata: Metadata = {
  title: {
    template: "%s | Yepper",
    default: 'Campaigns powered by yepper',
  },
  description: "Africa's first Media Observability and Performance Infrastructure.",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen overflow-hidden flex bg-black">

      {/* LEFT: auth panel */}
      <div className="relative flex flex-col w-full lg:w-[65%] h-screen overflow-y-auto">

        {/* Logo */}
        <div className="absolute top-8 left-8 xl:left-12 z-10 w-32">
          <Image
            src="/logos/yepper-logo.png"
            alt="Yepper"
            width={120}
            height={32}
            className="h-9 w-auto object-contain"
            priority
          />
        </div>

        <div className="flex flex-1 items-center justify-center px-8 py-24">
          <div className="w-full max-w-[380px]">
            <AuthGuard>{children}</AuthGuard>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-6 left-8 xl:left-12">
          <p className="text-[11px]" style={{ color: '#333' }}>
            © {new Date().getFullYear()} Yepper Inc.
          </p>
        </div>
      </div>

      {/* RIGHT: scrolling campaign mosaic */}
      <CampaignMosaic />

    </div>
  );
}
