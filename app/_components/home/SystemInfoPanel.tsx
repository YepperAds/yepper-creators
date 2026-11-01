import Link from 'next/link';
import { ArrowRightIcon, BuildingStorefrontIcon, MegaphoneIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import Reveal from '@/app/_components/shared/Reveal';

const AUDIENCES = [
  {
    icon: MegaphoneIcon,
    eyebrow: 'For advertisers',
    title: 'Find the right place for your campaign.',
    body: 'Compare websites and creator channels by content, category, audience, and available placements before choosing how to advertise.',
    href: '/advertisers',
    accent: 'text-coral',
    tint: 'bg-[#FDEDE9]',
  },
  {
    icon: BuildingStorefrontIcon,
    eyebrow: 'For publishers & creators',
    title: 'Make your audience easier to discover.',
    body: 'List a website or connect a creator channel, describe your audience, and review advertising opportunities in one place.',
    href: '/publishers',
    accent: 'text-blue',
    tint: 'bg-[#E8F4FA]',
  },
];

export default function SystemInfoPanel() {
  return (
    <Reveal>
      <section className="overflow-hidden rounded-[2rem] border border-[color:var(--mkt-border)] bg-[#FBFAF8]">
        <div className="grid lg:grid-cols-[0.85fr_1.15fr]">
          <div className="p-6 sm:p-10 lg:p-12">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-coral">One marketplace. Both sides.</span>
            <h2 className="mt-3 font-(--font-display) text-3xl font-bold leading-tight tracking-tight sm:text-4xl">A clearer way to work with independent media.</h2>
            <p className="mt-4 max-w-lg text-sm leading-6 text-[color:var(--mkt-ink-muted)]">Yepper brings advertisers, website owners, and creators together around real listings and clear placement details.</p>
            <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-[color:var(--mkt-ink-muted)]">
              <ShieldCheckIcon className="h-4 w-4 text-emerald-700" /> Websites use Yepper’s site integration to confirm ownership and report activity.
            </div>
          </div>
          <div className="grid gap-px bg-[color:var(--mkt-border)] sm:grid-cols-2">
            {AUDIENCES.map((item) => (
              <article key={item.eyebrow} className="flex flex-col bg-white p-6 sm:p-8">
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${item.tint}`}><item.icon className={`h-5 w-5 ${item.accent}`} /></span>
                <p className={`mt-5 text-[10px] font-bold uppercase tracking-[0.14em] ${item.accent}`}>{item.eyebrow}</p>
                <h3 className="mt-2 text-lg font-bold leading-snug">{item.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-[color:var(--mkt-ink-muted)]">{item.body}</p>
                <Link href={item.href} className={`mt-5 inline-flex w-fit items-center gap-1.5 text-xs font-bold ${item.accent} transition hover:gap-2.5`}>
                  Learn more <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
    </Reveal>
  );
}
