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
    <div className="min-h-dvh overflow-hidden bg-[#0b0b0b] text-white lg:grid lg:grid-cols-2">
      <section className="relative flex min-h-dvh flex-col overflow-y-auto font-(--font-poppins)">
        <div className="absolute left-7 top-7 z-10 w-32 sm:left-10 sm:top-9 lg:left-12">
          <Image
            src="/logos/yepper-logo.png"
            alt="Yepper"
            width={120}
            height={32}
            className="h-9 w-auto object-contain"
            priority
          />
        </div>
        <div className="flex flex-1 items-center justify-center px-6 pb-20 pt-28 sm:px-10 lg:px-12">
          <div className="w-full max-w-[420px]">
            <AuthGuard>{children}</AuthGuard>
          </div>
        </div>
        <div className="absolute bottom-6 left-7 sm:left-10 lg:left-12">
          <p className="text-[11px] text-white/30">
            © {new Date().getFullYear()} Yepper Inc.
          </p>
        </div>
      </section>
      <aside className="relative hidden min-h-dvh overflow-hidden rounded-l-3xl lg:block" aria-label="Yepper advertising">
        <Image
          src="/banners/billboard-banner.png"
          alt="Yepper double-sided advertising billboard"
          fill
          priority
          sizes="50vw"
          className="object-cover"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-black/20" />
      </aside>
    </div>
  );
}
