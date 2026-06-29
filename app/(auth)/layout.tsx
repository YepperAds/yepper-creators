import type { Metadata } from 'next';
import Image from 'next/image';
import AuthGuard from '@/app/_components/auth/AuthGuard';

export const metadata: Metadata = {
  title: {
    template: "%s | Yepper",
    default: 'Campaigns powered by yepper',
  },
  description: "Africa's first Media Observability and Performance Infrastructure.",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="yp-mesh relative flex-1 flex flex-col items-center justify-center px-6 py-16 overflow-hidden">
        {/* The logo's own blue+orange ink can blend into the mesh's blue/orange
            blobs depending on scroll position — a solid backing plate keeps it
            crisp regardless of what's behind it. */}
        <div className="mb-8 rounded-xl bg-surface-1 shadow-sm px-3 py-2">
          <Image
            src="/logos/yepper-logo.png"
            alt="Yepper"
            width={120}
            height={32}
            className="h-9 w-auto object-contain"
            priority
          />
        </div>

        <div className="w-full max-w-[380px] rounded-2xl border border-border bg-surface-1 p-8 shadow-sm">
          <AuthGuard>{children}</AuthGuard>
        </div>

        <p className="mt-8 text-xs text-white">© {new Date().getFullYear()} Yepper Inc.</p>
      </div>
    </div>
  );
}
