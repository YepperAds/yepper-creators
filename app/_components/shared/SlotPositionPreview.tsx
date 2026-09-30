'use client';

// Shows exactly where on a video's timeline a given slot percentage sits,
// instead of leaving the creator to picture "45%" in their head. A tiny
// filmstrip bar with a marker dropped at that position.
export default function SlotPositionPreview({
  percent,
  size = 'md',
}: {
  percent: number;
  size?: 'sm' | 'md';
}) {
  const height = size === 'sm' ? 'h-9' : 'h-11';
  return (
    <div className={`relative w-full ${height} rounded-md overflow-hidden bg-(--color-surface-3) border border-(--color-border)`}>
      {/* Filmstrip sprocket dots along the top, purely decorative context that this is "a video" */}
      <div className="absolute top-0.5 left-0 right-0 flex justify-between px-1">
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} className="w-0.5 h-0.5 rounded-full bg-white/15" />
        ))}
      </div>

      {/* The timeline track */}
      <div className="absolute left-1.5 right-1.5 bottom-2 h-1 rounded-full bg-white/15">
        <div
          className="absolute -top-1.5 -translate-x-1/2 w-2 h-2 rounded-full bg-emerald-400 border-2 border-(--color-surface-3)"
          style={{ left: `${percent}%` }}
        />
      </div>

      <span className="absolute bottom-0.5 left-1.5 text-[8px] font-bold text-white/40">start</span>
      <span className="absolute bottom-0.5 right-1.5 text-[8px] font-bold text-white/40">end</span>
    </div>
  );
}
