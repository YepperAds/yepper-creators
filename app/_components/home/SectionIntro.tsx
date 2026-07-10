// Short "why this, why now" blurb shown before a listing row — the whole
// point is telling a first-time visitor why they'd use a ready-made
// listing instead of going and finding media space themselves, before
// they see the listing itself.
export default function SectionIntro({
  eyebrow,
  title,
  body,
  accent,
}: {
  eyebrow: string;
  title: string;
  body: string;
  accent: 'coral' | 'blue';
}) {
  const accentClass = accent === 'coral' ? 'text-coral' : 'text-blue';
  return (
    <div className="max-w-2xl mb-8">
      <span className={`text-xs font-bold uppercase tracking-wide ${accentClass}`}>{eyebrow}</span>
      <h2 className="mt-2 text-4xl sm:text-5xl font-bold text-[color:var(--mkt-ink)] font-(--font-display) tracking-tight leading-[1.05]">
        {title}
      </h2>
      <p className="mt-3 text-base sm:text-lg text-[color:var(--mkt-ink-muted)] leading-relaxed">{body}</p>
    </div>
  );
}
