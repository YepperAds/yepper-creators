import Link from 'next/link';
import Reveal from '@/app/_components/shared/Reveal';

export default function MarketingSections() {
  return (
    <section className="mkt-warm-noise border-t border-[#E4E2DC] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        <Reveal>
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="font-(--font-display) text-[3rem] font-bold leading-[1.0] tracking-[-0.03em] text-[#0E0E0F] sm:text-[4.5rem]">
              Find your audience.
              <br />
              <span className="italic font-normal text-[#5A5A60]">Or bring it with you.</span>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-[#5A5A60]">
              Explore the marketplace as an advertiser and discover media that fits your campaign. Or list your website, YouTube channel, or TikTok profile so brands can find you directly.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link href="/login" className="mkt-cta-black">
                • Get started free
              </Link>
              <Link href="/faq" className="mkt-cta-ghost">
                Read the FAQ
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
