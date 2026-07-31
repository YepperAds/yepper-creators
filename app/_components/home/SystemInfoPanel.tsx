import Reveal from '@/app/_components/shared/Reveal';

// Used to be a 3-tab panel (Overview / Privacy Policy / Terms of Use), now
// that /privacy and /terms are real pages (see LegalDoc.tsx), duplicating
// their content here in miniature just meant two versions of the same
// policy to keep in sync. Overview is the only thing that belongs on the
// landing page itself, so the tab bar went with them.
export default function SystemInfoPanel() {
  return (
    <Reveal>
      <div className="rounded-[2rem] border border-[color:var(--mkt-border)] bg-white p-8 sm:p-12">
        <span className="text-xs font-bold uppercase tracking-wide text-coral">What Yepper is</span>
        <h2 className="mt-1.5 text-3xl sm:text-4xl font-bold text-[color:var(--mkt-ink)] font-(--font-display) tracking-tight">
          One marketplace, no agencies in between
        </h2>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div>
            <h3 className="text-sm font-bold text-coral uppercase tracking-wide mb-2">For publishers</h3>
            <p className="text-sm text-[color:var(--mkt-ink-muted)] leading-relaxed">
              List your website or YouTube channel and we place it in a traffic tier based on your audience
              size. You keep 100% of the listed price. Yepper&apos;s margin is added on top of what advertisers
              pay, never taken out of your payout.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-bold text-blue uppercase tracking-wide mb-2">For advertisers</h3>
            <p className="text-sm text-[color:var(--mkt-ink-muted)] leading-relaxed">
              Browse websites and creators by category and audience size, then book the spaces that
              fit your campaign. Every listing is sorted into a traffic tier, so you know what you&apos;re
              paying for before you commit.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-bold text-coral uppercase tracking-wide mb-2">Traffic tiers</h3>
            <p className="text-sm text-[color:var(--mkt-ink-muted)] leading-relaxed">
              Traffic tiers (Starter through Elite) are reviewed periodically as audiences grow, so pricing
              always reflects real reach.
            </p>
          </div>
        </div>
      </div>
    </Reveal>
  );
}
