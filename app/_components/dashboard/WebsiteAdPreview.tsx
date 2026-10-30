'use client';

import type { PublicWebsite } from '@/app/_lib/public-home';

/** A compact illustrative website view with three possible ad placements. */
export default function WebsiteAdPreview({ website, className = 'mb-4' }: { website: PublicWebsite; className?: string }) {
  return (
    <div aria-hidden="true" className={`aspect-[2.15/1] overflow-hidden rounded-xl border border-white/10 bg-[#f5f7fa] ${className}`}>
      <div className="flex h-6 items-center gap-1.5 border-b border-black/10 bg-[#e9edf2] px-2">
        <span className="h-1.5 w-1.5 rounded-full bg-[#ff6259]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#f6bd4f]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#42c95a]" />
        <span className="ml-1 min-w-0 flex-1 truncate rounded-full bg-white px-2 py-0.5 text-[9px] leading-none text-slate-500">{website.websiteLink.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</span>
      </div>
      <div className="flex h-6 items-center justify-between border-b border-black/5 bg-white px-2.5">
        <span className="truncate text-[10px] font-bold text-slate-800">{website.websiteName}</span>
        <span className="flex gap-1.5">
          <i className="h-1 w-3 rounded-full bg-slate-300" /><i className="h-1 w-3 rounded-full bg-slate-300" /><i className="h-1 w-3 rounded-full bg-slate-300" />
        </span>
      </div>
      <div className="grid grid-cols-[1fr_0.42fr] grid-rows-[13px_1fr] gap-1.5 p-2">
        <div className="yp-ad-slot-demo yp-ad-slot-step-1 flex items-center gap-1.5 rounded border border-dashed border-[#e8472b]/55 bg-[#e8472b]/[0.05] px-1.5">
          <span className="rounded bg-[#e8472b]/15 px-1 text-[7px] font-bold uppercase tracking-wide text-[#b33b27]">Ad</span>
          <span className="h-1 w-1/3 rounded-full bg-[#b33b27]/25" />
          <span className="ml-auto h-1 w-1/5 rounded-full bg-[#b33b27]/20" />
        </div>
        <div className="row-span-2 flex flex-col items-center justify-center gap-1 rounded border border-dashed border-[#e8472b]/55 bg-[#e8472b]/[0.05]">
          <span className="yp-ad-slot-demo yp-ad-slot-step-2 rounded bg-[#e8472b]/15 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wide text-[#b33b27]">Ad space</span>
          <span className="h-1 w-2/3 rounded-full bg-slate-300" />
          <span className="h-1 w-1/2 rounded-full bg-slate-200" />
        </div>
        <div className="flex flex-col justify-center gap-1">
          <span className="h-1 w-4/5 rounded-full bg-slate-300" />
          <span className="h-1 w-full rounded-full bg-slate-200" />
          <span className="h-1 w-3/4 rounded-full bg-slate-200" />
          <span className="yp-ad-slot-demo yp-ad-slot-step-3 mt-0.5 flex h-2.5 w-2/3 items-center rounded border border-dashed border-[#e8472b]/60 bg-[#e8472b]/[0.06] px-1 text-[6px] font-bold uppercase text-[#b33b27]">Ad</span>
        </div>
      </div>
    </div>
  );
}
