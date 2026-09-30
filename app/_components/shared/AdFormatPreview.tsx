'use client';

// A small, literal picture of what "Corner Badge" and "L-Bar" actually look
// like on a video, so creators don't have to infer the shape from the name
// alone. Used next to the Ad Type choice in the creator's Social Media panel.
export default function AdFormatPreview({ type }: { type: 'corner' | 'lbar' }) {
  return (
    <div className="relative w-20 h-12 shrink-0 rounded-md overflow-hidden bg-(--color-surface-3) border border-(--color-border)">
      {/* Fake video frame content, just a couple of soft shapes */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-6 h-6 rounded-full bg-white/10" />
      </div>

      {type === 'corner' ? (
        <div className="absolute bottom-1 right-1 w-6 h-3.5 rounded-[3px] bg-emerald-400/80 flex items-center justify-center">
          <span className="text-[5px] font-black text-black leading-none">AD</span>
        </div>
      ) : (
        <>
          {/* Vertical strip down the left edge */}
          <div className="absolute left-0 top-0 bottom-0 w-2 bg-emerald-400/80" />
          {/* Horizontal strip along the bottom */}
          <div className="absolute left-0 right-0 bottom-0 h-2.5 bg-emerald-400/80 flex items-center justify-center">
            <span className="text-[4px] font-black text-black leading-none">AD</span>
          </div>
        </>
      )}
    </div>
  );
}
