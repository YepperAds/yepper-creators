import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheckIcon, BoltIcon, ChartBarIcon } from '@heroicons/react/24/solid';
import { getBusinessCategory } from '@/app/_lib/business-categories';

const FEATURED_CATEGORY = getBusinessCategory('travel-tourism');

export default function Hero() {
  return (
    <section className="relative pt-8 pb-16 sm:pb-20">
      {/* ── Gradient panel ───────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-[2rem] yp-brand-gradient px-6 sm:px-12 py-20 sm:py-28 text-center">
        <div aria-hidden className="yp-dot-grid absolute top-6 right-8 w-28 h-28 opacity-30" />
        <div aria-hidden className="yp-dot-grid absolute bottom-6 left-8 w-28 h-28 opacity-20" />

        <h1 className="relative text-5xl sm:text-8xl font-bold font-(--font-display) tracking-tight leading-[0.98] text-white max-w-4xl mx-auto">
          Real ad space, booked directly.
        </h1>
        <p className="relative mt-6 text-lg sm:text-xl text-white/85 max-w-xl mx-auto">
          Yepper connects website owners and YouTube creators with advertisers — no agencies,
          no middlemen, no guesswork.
        </p>
        <div className="relative mt-9 flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/login"
            className="inline-flex items-center h-12 px-7 rounded-full bg-white text-[color:var(--mkt-ink)] text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Get started free
          </Link>
          <Link
            href="#explore"
            className="inline-flex items-center h-12 px-7 rounded-full border border-white/40 text-white text-sm font-semibold hover:bg-white/10 transition-colors"
          >
            Explore listings
          </Link>
        </div>
      </div>

      {/* ── Floating info cards, overlapping the panel's bottom edge — bold
          solid brand colors on two of the four, not just pale tints. ── */}
      <div className="relative -mt-10 sm:-mt-12 px-3 sm:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl bg-coral p-5 shadow-[0_10px_28px_rgba(232,71,43,0.35)] hover:-translate-y-1 transition-transform duration-200">
            <ShieldCheckIcon className="w-6 h-6 text-white mb-3" />
            <p className="text-sm font-bold text-white leading-snug">Every publisher verified</p>
          </div>

          <div className="relative rounded-2xl overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.12)] hidden sm:block hover:-translate-y-1 transition-transform duration-200">
            <Image src={FEATURED_CATEGORY.image} alt="" fill sizes="220px" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <p className="relative z-10 p-5 pt-16 text-sm font-bold text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.6)]">
              Real audiences, real reach
            </p>
          </div>

          <div className="rounded-2xl bg-blue p-5 shadow-[0_10px_28px_rgba(16,144,200,0.35)] hover:-translate-y-1 transition-transform duration-200">
            <BoltIcon className="w-6 h-6 text-white mb-3" />
            <p className="text-sm font-bold text-white leading-snug">Book directly, no agency</p>
          </div>

          <div className="rounded-2xl bg-[#0B0B0C] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.18)] hover:-translate-y-1 transition-transform duration-200">
            <ChartBarIcon className="w-6 h-6 text-white mb-3" />
            <p className="text-sm font-bold text-white leading-snug">Live campaign analytics</p>
          </div>
        </div>
      </div>
    </section>
  );
}
