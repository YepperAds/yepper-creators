import HomeHeader from '@/app/_components/home/HomeHeader';
import type { LegalSection } from './LegalContent';

// Big editorial legal-document layout shared by /privacy and /terms: a
// short label + huge headline + intro up top, then each section as a
// title/numbered-points row, matching how real legal pages (not fake
// "lorem ipsum" placeholders) are usually laid out.
export default function LegalDoc({
  label,
  headline,
  intro,
  effectiveDate,
  sections,
}: {
  label: string;
  headline: string;
  intro: string[];
  effectiveDate: string;
  sections: LegalSection[];
}) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F2F1EE' }}>
      <HomeHeader />

      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-16 sm:py-24">
        {/* ── Header block ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-4 sm:gap-12">
          <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--mkt-ink-muted)]">{label}</p>
          <div>
            <h1 className="text-4xl sm:text-6xl font-bold uppercase leading-[1.08] text-[color:var(--mkt-ink)] font-(--font-display) max-w-3xl">
              {headline}
            </h1>
            <div className="mt-8 space-y-4 text-base sm:text-lg text-[color:var(--mkt-ink-muted)] max-w-2xl">
              {intro.map((paragraph, i) => <p key={i}>{paragraph}</p>)}
            </div>
            <div className="mt-8">
              <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--mkt-ink-muted)]">Effective date</p>
              <p className="text-sm text-[color:var(--mkt-ink)] mt-1 font-semibold">{effectiveDate}</p>
            </div>
          </div>
        </div>

        {/* ── Sections ─────────────────────────────────────────── */}
        <div className="mt-16 border-t border-[color:var(--mkt-border)]">
          {sections.map((section) => (
            <div
              key={section.title}
              className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-4 sm:gap-12 py-10 border-b border-[color:var(--mkt-border)]"
            >
              <h2 className="text-xl sm:text-2xl font-bold uppercase text-[color:var(--mkt-ink)] font-(--font-display)">
                {section.title}
              </h2>
              <ol className="space-y-4 text-base text-[color:var(--mkt-ink-muted)] leading-relaxed list-decimal list-outside pl-5 marker:font-bold marker:text-[color:var(--mkt-ink)]">
                {section.points.map((point, i) => <li key={i} className="pl-1">{point}</li>)}
              </ol>
            </div>
          ))}
        </div>
      </div>

      <footer className="border-t border-[color:var(--mkt-border)] py-6">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 text-center">
          <p className="text-xs text-[color:var(--mkt-ink-muted)]">© {new Date().getFullYear()} Yepper Inc.</p>
        </div>
      </footer>
    </div>
  );
}
