import { ArrowLeftIcon } from '@heroicons/react/24/outline';

// Quiet, centered page label — not a bold title block, just enough to
// orient you. `shrink-0` so it never compresses when the scrollable body
// below needs the space; same background as the page so it reads as part
// of the page, not a boxed header bar.
export default function PageHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <div className="relative shrink-0 pt-5 pb-2 text-center bg-background">
      {onBack && (
        <button
          onClick={onBack}
          className="absolute left-0 top-4 flex items-center gap-1.5 text-xs font-medium text-subtle hover:text-white transition-colors"
        >
          <ArrowLeftIcon className="w-3.5 h-3.5" /> Back
        </button>
      )}
      <p className="text-base font-semibold text-white">{title}</p>
    </div>
  );
}
