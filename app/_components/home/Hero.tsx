import Link from 'next/link';
import LaptopShowcase from './LaptopShowcase';

export default function Hero() {
  return (
    <section className="relative pt-8 pb-4">
      {/* Gradient panel: headline + CTAs beside the live laptop demo so
          a visitor sees what Yepper is *and* what an ad looks like in one
          screen, no scrolling required. Stacks on small screens, splits
          side-by-side from lg: up. */}
      <div className="relative overflow-hidden rounded-[2rem] yp-brand-gradient px-6 sm:px-10 lg:px-14 py-12 sm:py-16 lg:py-14">
        <div aria-hidden className="yp-dot-grid absolute top-6 right-8 w-28 h-28 opacity-30" />
        <div aria-hidden className="yp-dot-grid absolute bottom-6 left-8 w-28 h-28 opacity-20" />

        <div className="relative grid lg:grid-cols-2 gap-10 lg:gap-8 items-center">
          <div className="text-center lg:text-left">
            <h1 className="text-4xl sm:text-6xl lg:text-5xl xl:text-6xl font-bold font-(--font-display) tracking-tight leading-[1.02] text-white">
              Real ad space, booked directly.
            </h1>
            <p className="mt-5 text-base sm:text-xl text-white/85 max-w-xl mx-auto lg:mx-0">
              Yepper connects website owners and YouTube creators with advertisers.
              No agencies, no middlemen, no guesswork.
            </p>
            <div className="mt-8 flex items-center justify-center lg:justify-start gap-3 flex-wrap">
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

          <div className="flex justify-center">
            <LaptopShowcase />
          </div>
        </div>
      </div>
    </section>
  );
}
