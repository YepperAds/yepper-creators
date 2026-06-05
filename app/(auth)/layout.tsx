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

// ─────────────────────────────────────────────────────────────────────────────
// Campaign showcase data — 12 images, 3 columns of 4
// All URLs are verified Unsplash CDN direct links.
//
// TO ADD YOUR OWN: drop images in /public/campaigns/ and replace the URL with
// e.g. '/campaigns/billboard-01.jpg'
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Campaign showcase data — 8 real assets duplicated to 16
// ─────────────────────────────────────────────────────────────────────────────

type MediaType = 'image' | 'gif' | 'video';

const BASE: { src: string; alt: string; type: MediaType }[] = [
  { src: '/campaigns/images/ad-1.png', alt: 'Ad campaign 1', type: 'image' },
  { src: '/campaigns/images/ad-2.png', alt: 'Ad campaign 2', type: 'image' },
  { src: '/campaigns/images/ad-3.gif', alt: 'Ad campaign 3', type: 'gif' },
  { src: '/campaigns/images/ad-4.png', alt: 'Ad campaign 4', type: 'image' },
  { src: '/campaigns/images/ad-5.png', alt: 'Ad campaign 5', type: 'image' },
  { src: '/campaigns/images/ad-6.png', alt: 'Ad campaign 6', type: 'image' },
  { src: '/campaigns/videos/ad-7.mp4', alt: 'Ad campaign 7', type: 'video' },
  { src: '/campaigns/videos/ad-8.mp4', alt: 'Ad campaign 8', type: 'video' },
];

// Duplicate to 16 for a fuller mosaic
const CAMPAIGNS = [
  ...BASE.map((c, i) => ({ ...c, id: i + 1 })),
  ...BASE.map((c, i) => ({ ...c, id: i + 9 })),
];

// ─────────────────────────────────────────────────────────────────────────────
// Single campaign tile — small, clean image only, no overlays
// ─────────────────────────────────────────────────────────────────────────────

function CampaignTile({ src, alt, type }: { src: string; alt: string; type: MediaType }) {
  return (
    <div
      className="relative w-full flex-shrink-0 overflow-hidden rounded-[5px] bg-[#111]"
      style={{ aspectRatio: '4/3' }}
    >
      {type === 'video' ? (
        <video
          src={src}
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover"
        />
      ) : type === 'gif' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="12vw"
          className="object-cover"
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Scrolling column — duplicated list for seamless infinite loop
// ─────────────────────────────────────────────────────────────────────────────

function ScrollColumn({ items, speed, offsetTop = 0 }: {
  items: typeof CAMPAIGNS;
  speed: number;
  offsetTop?: number;
}) {
  const doubled = [...items, ...items];

  return (
    <div className="flex-1 overflow-hidden">
      <div
        style={{
          marginTop: `-${offsetTop}px`,
          animation: `scroll-up ${speed}s linear infinite`,
        }}
      >
        <div className="flex flex-col gap-2">
          {doubled.map((c, i) => (
            <CampaignTile key={`${c.id}-${i}`} src={c.src} alt={c.alt} type={c.type} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth layout — Framer-style split
// ─────────────────────────────────────────────────────────────────────────────

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // Split 12 items across 3 columns
  const colA = CAMPAIGNS.filter((_, i) => i % 3 === 0); // 1, 4, 7, 10
  const colB = CAMPAIGNS.filter((_, i) => i % 3 === 1); // 2, 5, 8, 11
  const colC = CAMPAIGNS.filter((_, i) => i % 3 === 2); // 3, 6, 9, 12

  return (
    <div className="h-screen overflow-hidden flex bg-black dark">

      {/* ══ LEFT — form panel ══════════════════════════════════════ */}
      <div className="relative flex flex-col w-full lg:w-[65%] h-screen overflow-y-auto">

        {/* Logo */}
        <div className="absolute top-8 left-8 xl:left-12 z-10 w-32">
          {/*
          <Image
            src="/logos/black-theme-removebg.png"
            alt="Yepper"
            width={120}
            height={32}
            className="h-8 w-auto"
            priority
          />
          */}
          <Image
            src="/logos/yepper-logo.png"
            alt="Yepper"
            width={120}
            height={32}
            className="h-10 w-auto object-contain"
            priority
          />
        </div>

        {/* Form — centered both axes */}
        <div className="flex flex-1 items-center justify-center px-8 py-24">
          <div className="w-full max-w-[360px]">
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

      {/* ══ RIGHT — 3-column image mosaic ═══════════════════════════ */}
      <div
        className="hidden lg:flex flex-1 relative h-screen overflow-hidden"
        style={{ background: '#0C0C0C' }}
        aria-hidden="true"
      >
        {/* "Campaigns powered by Yepper" label */}
        <div className="absolute top-5 inset-x-0 z-20 flex justify-center pointer-events-none">
          <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: '#333' }}>
            Campaigns powered by Yepper
          </span>
        </div>

        {/* 3-column mosaic */}
        <div className="flex gap-2 w-full h-full px-3 pt-10">
          <ScrollColumn items={colA} speed={25} />
          <ScrollColumn items={colB} speed={32} offsetTop={80} />
          <ScrollColumn items={colC} speed={28} offsetTop={40} />
        </div>
      </div>

    </div>
  );
}
