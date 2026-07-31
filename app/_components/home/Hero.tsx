import Link from 'next/link';

export default function Hero() {
  return (
    <section className="relative pt-8 pb-4">
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
    </section>
  );
}
