import Image from 'next/image';
import Link from 'next/link';
import LaptopShowcase from './LaptopShowcase';

const CHANNELS = [
  { label: 'Websites', icon: '/socials-icon/www-icon.png' },
  { label: 'YouTube', icon: '/socials-icon/youtube-icon.png' },
  { label: 'TikTok', icon: '/socials-icon/tiktok-icon.png' },
];

export default function Hero() {
  return (
    <section className="relative px-4 py-6 sm:px-6 sm:py-10 lg:px-8 lg:py-12 bg-[#FAFAF8]">
      <div className="mx-auto max-w-7xl">
        {/* ── Signature Floating Gradient Banner Card ─────────────────── */}
        <div
          className="relative isolate overflow-hidden rounded-[2rem] sm:rounded-[2.8rem] px-6 py-12 sm:px-12 sm:py-16 lg:px-16 lg:py-20 text-white shadow-[0_28px_80px_rgba(232,71,43,0.20)] border border-white/25"
          style={{
            background: 'linear-gradient(135deg, #E8472B 0%, #D43845 28%, #A83676 60%, #1090C8 100%)',
          }}
        >
          {/* Subtle dot grid texture accent */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.25]"
            style={{
              backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.35) 1.5px, transparent 1.5px)',
              backgroundSize: '20px 20px',
            }}
          />

          {/* Soft ambient light accents inside the card */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/15 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-20 -bottom-20 h-80 w-80 rounded-full bg-black/10 blur-3xl"
          />

          <div className="relative grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
            {/* ── Left Content Block ─────────────────────────────────── */}
            <div className="max-w-xl">
              {/* Pill badge */}
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-3.5 py-1 text-xs font-semibold backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                Direct Media Marketplace
              </div>

              {/* Bold headline — exactly matching the reference card */}
              <h1 className="font-(--font-display) text-[2.8rem] font-bold leading-[1.02] tracking-[-0.035em] text-white sm:text-[3.8rem] lg:text-[4.5rem]">
                Real ad space,
                <br />
                booked directly.
              </h1>

              {/* Subtitle */}
              <p className="mt-5 text-base sm:text-lg leading-relaxed text-white/90">
                Yepper connects website owners, YouTube creators, and TikTok channels with advertisers. No agencies, no middlemen, no guesswork.
              </p>

              {/* Action Buttons */}
              <div className="mt-8 flex flex-wrap items-center gap-3.5">
                <Link
                  href="/login"
                  className="inline-flex h-12 items-center justify-center rounded-full bg-white px-7 text-sm font-bold text-[#0E0E0F] shadow-sm transition hover:bg-white/90 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Get started free
                </Link>
                <Link
                  href="#explore"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-white/40 bg-white/10 px-7 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 active:scale-[0.98]"
                >
                  Explore listings
                </Link>
              </div>

              {/* Channel indicators */}
              <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/20 pt-5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
                  Available across
                </span>
                {CHANNELS.map((ch) => (
                  <span
                    key={ch.label}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/90"
                  >
                    <Image
                      src={ch.icon}
                      alt=""
                      width={16}
                      height={16}
                      className="h-4 w-4 object-contain brightness-0 invert"
                    />
                    {ch.label}
                  </span>
                ))}
              </div>
            </div>

            {/* ── Right: Floating Laptop Showcase ─────────────────────── */}
            <div className="relative mx-auto w-full max-w-[540px] lg:max-w-none">
              <LaptopShowcase />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
