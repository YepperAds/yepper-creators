import Link from 'next/link';

export default function MarketingPageHero({
  eyebrow,
  title,
  body,
  primaryLabel = 'Get started',
  primaryHref = '/login',
}: {
  eyebrow: string;
  title: string;
  body: string;
  primaryLabel?: string;
  primaryHref?: string;
}) {
  return (
    <section className="border-b border-[#E4E2DC] bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-4xl px-5 text-center sm:px-8">
        {/* Subtle category / reading breadcrumb - Aetherfield style */}
        <p className="text-[12px] font-medium tracking-wide text-[#7A7A80]">
          {eyebrow}
        </p>

        {/* Large, confident editorial headline */}
        <h1 className="mt-4 font-(--font-display) text-4xl font-bold leading-[1.06] tracking-[-0.035em] text-[#0E0E0F] sm:text-6xl lg:text-[4.2rem]">
          {title}
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[#5A5A60] sm:text-lg sm:leading-8">
          {body}
        </p>

        {/* Black pill action buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href={primaryHref} className="mkt-cta-black">
            • {primaryLabel}
          </Link>
          <Link href="/#explore" className="mkt-cta-ghost">
            • Explore the marketplace
          </Link>
        </div>
      </div>
    </section>
  );
}
