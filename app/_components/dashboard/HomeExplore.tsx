'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRightIcon, CheckIcon, GlobeAltIcon, MegaphoneIcon, PlusCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import HotDealsSection from '@/app/_components/home/HotDealsSection';
import DashboardFeed from './DashboardFeed';
import AdsSamplePanel from './AdsSamplePanel';
import AdSpacesModal from '@/app/_components/home/AdSpacesModal';
import { MOCK_WEBSITES, MOCK_CREATORS } from '@/app/_lib/mock-home-data';
import type { PublicWebsite, PublicCreator, HotDeal } from '@/app/_lib/public-home';

type Tab = 'all' | 'deals' | 'websites' | 'youtube' | 'tiktok';

const TABS: { id: Tab; label: string }[] = [
  { id: 'all',      label: 'All' },
  { id: 'deals',    label: 'Ads' },
  { id: 'websites', label: 'Websites' },
  { id: 'youtube',  label: 'YouTube' },
  { id: 'tiktok',   label: 'TikTok' },
];

function TabPill({ active, onClick, children }: { active: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
        active
          ? 'bg-surface-3 text-white'
          : onClick
          ? 'text-white opacity-70 hover:opacity-100 hover:bg-surface-2'
          : 'text-muted cursor-default'
      }`}
    >
      {children}
    </button>
  );
}

export default function HomeExplore({
  websites,
  creators,
  hotDeals,
  dealId,
}: {
  websites: PublicWebsite[];
  creators: PublicCreator[];
  hotDeals: HotDeal[];
  dealId?: string;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [tab, setTab] = useState<Tab>('all');
  const [selectedCreator, setSelectedCreator] = useState<PublicCreator | null>(null);
  const [websiteIntroOpen, setWebsiteIntroOpen] = useState(false);
  const displayWebsites = websites.length > 0 ? websites : MOCK_WEBSITES;
  const displayCreators = creators.length > 0 ? creators : MOCK_CREATORS;
  const filteredCreators = tab === 'tiktok'
    ? displayCreators.filter((creator) => creator.provider === 'tiktok')
    : displayCreators.filter((creator) => creator.provider !== 'tiktok');

  useEffect(() => {
    if (!websiteIntroOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setWebsiteIntroOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [websiteIntroOpen]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 flex flex-nowrap items-center justify-start sm:justify-center gap-1 overflow-x-auto pb-4 pt-2">
        {TABS.map((t) => (
          <TabPill key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </TabPill>
        ))}
      </div>

      <div className="shrink-0 flex flex-wrap items-center justify-center sm:justify-between gap-2 pb-4 px-2">
        <Link
          href="/?panel=advertise"
          className="flex items-center gap-1.5 rounded-full bg-white px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-background hover:opacity-90 transition-colors"
        >
          <MegaphoneIcon className="w-4 h-4" />
          Advertise
        </Link>

        <button
          type="button"
          onClick={() => setWebsiteIntroOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={websiteIntroOpen}
          className="flex items-center gap-1.5 rounded-full bg-white px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-background hover:opacity-90 transition-colors"
        >
          <PlusCircleIcon className="w-4 h-4" />
          Add Your Website
        </button>
      </div>

      {/* px-2: the hot-deal card's pulsing glow (box-shadow, see .hotdeal-glow
          in globals.css) needs a few pixels of clearance before it hits
          <main>'s own overflow-hidden edge (DashboardHome.tsx), otherwise the
          glow gets visibly clipped on whichever side sits flush against it. */}
      <div key={tab} className="flex-1 overflow-y-auto px-2">
        {tab === 'all' ? (
          <>
            <HotDealsSection
              deals={hotDeals}
              initialDealId={dealId}
              websites={displayWebsites}
              creators={displayCreators}
            />
            <div className="rounded-3xl border border-border bg-surface-2 p-4 sm:p-6">
              <p className="text-xs font-bold uppercase tracking-wide text-muted mb-4">Platforms</p>
              <DashboardFeed websites={displayWebsites} creators={displayCreators} onCreatorClick={setSelectedCreator} />
            </div>
          </>
        ) : tab === 'deals' ? (
          <AdsSamplePanel />
        ) : tab === 'websites' ? (
          <div className="rounded-3xl border border-border bg-surface-2 p-4 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-wide text-muted mb-4">Platforms</p>
            <DashboardFeed websites={displayWebsites} />
          </div>
        ) : (
          <div className="rounded-3xl border border-border bg-surface-2 p-4 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-wide text-muted mb-4">
              {tab === 'tiktok' ? 'TikTok creators' : 'YouTube creators'}
            </p>
            <DashboardFeed websites={[]} creators={filteredCreators} onCreatorClick={setSelectedCreator} />
          </div>
        )}
      </div>
      <AdSpacesModal
        creator={selectedCreator}
        open={!!selectedCreator}
        onClose={() => setSelectedCreator(null)}
      />

      <AnimatePresence>
        {websiteIntroOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onMouseDown={(event) => { if (event.target === event.currentTarget) setWebsiteIntroOpen(false); }}
          >
            <motion.section
              role="dialog" aria-modal="true" aria-labelledby="website-intro-title"
              initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-[#111] p-6 text-white shadow-2xl shadow-black/60 sm:p-8"
            >
              <button type="button" onClick={() => setWebsiteIntroOpen(false)} aria-label="Close dialog" className="absolute right-4 top-4 rounded-full p-2 text-white/55 transition hover:bg-white/10 hover:text-white">
                <XMarkIcon className="h-4 w-4" />
              </button>

              <div className="relative mx-auto mb-5 h-32 w-full max-w-xs" aria-hidden="true">
                <div className="absolute left-[15%] right-[15%] top-[45px] h-px bg-gradient-to-r from-cyan-300/50 via-white/25 to-coral/60" />
                <span className="absolute left-[23%] top-0 -translate-x-1/2 text-[9px] font-semibold uppercase tracking-wide text-white/45">Connect</span>
                <span className="absolute left-[76%] top-0 -translate-x-1/2 text-[9px] font-semibold uppercase tracking-wide text-white/45">Ad delivery</span>

                <div className="absolute left-[1%] top-5 flex w-[28%] flex-col items-center gap-1.5">
                  <span className="relative flex h-[58px] w-[82px] items-center justify-center overflow-hidden rounded-lg border border-white/15 bg-[#1b1b1b]">
                    <span className="absolute inset-x-0 top-0 flex h-2.5 items-center gap-0.5 border-b border-white/10 bg-white/5 px-1"><i className="h-1 w-1 rounded-full bg-white/35" /><i className="h-1 w-1 rounded-full bg-white/35" /><i className="h-1 w-1 rounded-full bg-white/35" /></span>
                    <motion.span
                      className="mt-2 flex h-6 w-[58px] items-center justify-center rounded border border-dashed text-[8px] font-extrabold tracking-wide"
                      animate={reduceMotion
                        ? { opacity: 1, color: '#b33b27', backgroundColor: 'rgba(232,71,43,0.12)', borderColor: 'rgba(232,71,43,0.7)' }
                        : {
                            opacity: [0.55, 0.55, 1, 1, 0.55],
                            color: ['rgba(255,255,255,0.45)', 'rgba(255,255,255,0.45)', '#b33b27', '#b33b27', 'rgba(255,255,255,0.45)'],
                            backgroundColor: ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.04)', 'rgba(232,71,43,0.16)', 'rgba(232,71,43,0.16)', 'rgba(255,255,255,0.04)'],
                            borderColor: ['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.25)', 'rgba(232,71,43,0.8)', 'rgba(232,71,43,0.8)', 'rgba(255,255,255,0.25)'],
                          }}
                      transition={{ duration: 4.5, repeat: Infinity, times: [0, 0.64, 0.7, 0.9, 1] }}
                    >AD ON WEB</motion.span>
                    <motion.span
                      className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#111] bg-emerald-400 text-[#062b1a] shadow-lg shadow-emerald-400/30"
                      animate={reduceMotion ? { opacity: 1, scale: 1 } : { opacity: [0, 0, 0, 1, 1, 0], scale: [0.5, 0.5, 0.5, 1, 1, 0.5] }}
                      transition={{ duration: 4.5, repeat: Infinity, times: [0, 0.52, 0.67, 0.75, 0.9, 1] }}
                    ><span className="text-base font-black leading-none">$</span></motion.span>
                  </span>
                  <span className="text-[10px] font-bold tracking-wider text-white/80">WWW</span>
                </div>
                <div className="absolute right-[1%] top-4 flex w-[28%] flex-col items-center gap-1.5">
                  <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-[#191919] p-2 shadow-lg shadow-black/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logos/yepper-logo.png" alt="" className="h-full w-full object-contain" />
                    <motion.span
                      className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#111] bg-emerald-400 text-[#062b1a]"
                      animate={reduceMotion ? { opacity: 1 } : { opacity: [0, 0, 1, 1, 0] }}
                      transition={{ duration: 4.5, repeat: Infinity, times: [0, 0.2, 0.27, 0.48, 0.58] }}
                    ><CheckIcon className="h-3 w-3" strokeWidth={3} /></motion.span>
                  </span>
                  <span className="text-[10px] font-bold text-white/80">Yepper</span>
                </div>

                <motion.span
                  className="absolute top-[39px] z-20 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border border-cyan-200/60 bg-[#17272b] text-cyan-200 shadow-[0_0_12px_rgba(103,232,249,0.35)]"
                  animate={reduceMotion ? { opacity: 0 } : { left: ['15%', '85%', '85%', '85%'], opacity: [0, 1, 0, 0] }}
                  transition={{ duration: 4.5, repeat: Infinity, times: [0, 0.2, 0.29, 1], ease: 'easeInOut' }}
                ><GlobeAltIcon className="h-3 w-3" /></motion.span>
                <motion.span
                  className="absolute top-[39px] z-20 flex h-5 w-7 -translate-x-1/2 items-center justify-center rounded border border-coral/60 bg-[#2b1917] text-[7px] font-extrabold tracking-wide text-coral-text shadow-[0_0_12px_rgba(232,71,43,0.28)]"
                  animate={reduceMotion ? { opacity: 0 } : { left: ['85%', '85%', '15%', '15%', '85%'], opacity: [0, 0, 1, 0, 0] }}
                  transition={{ duration: 4.5, repeat: Infinity, times: [0, 0.4, 0.68, 0.78, 1], ease: 'easeInOut' }}
                >AD</motion.span>
              </div>

              <div className="text-center">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-300">For website owners</p>
                <h2 id="website-intro-title" className="text-xl font-bold sm:text-2xl">Bring your website to Yepper</h2>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-white/60">Register your site so advertisers can discover it and explore its ad opportunities.</p>
              </div>

              <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.035] p-4">
                <ol className="space-y-3 text-sm text-white/75">
                  <li className="flex gap-3"><span className="text-cyan-300">01</span><span>Add your website name and URL.</span></li>
                  <li className="flex gap-3"><span className="text-cyan-300">02</span><span>Choose the categories that describe your site.</span></li>
                  <li className="flex gap-3"><span className="text-cyan-300">03</span><span>Optionally list pages where you plan to offer ad placements.</span></li>
                </ol>
              </div>

              <button
                type="button"
                onClick={() => { setWebsiteIntroOpen(false); router.push('/?panel=add-website'); }}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-white/90"
              >
                Continue to website setup <ArrowRightIcon className="h-4 w-4" />
              </button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-white/40"><CheckIcon className="h-3.5 w-3.5" />You can review everything before submitting.</p>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}




// 'use client';

// import { useState } from 'react';
// import Link from 'next/link';
// import { FireIcon } from '@heroicons/react/24/solid';
// import { MegaphoneIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
// import HotDealsSection from '@/app/_components/home/HotDealsSection';
// import DashboardFeed from './DashboardFeed';
// import PageHeader from './PageHeader';
// import { MOCK_WEBSITES, MOCK_CREATORS } from '@/app/_lib/mock-home-data';
// import type { PublicWebsite, PublicCreator, HotDeal } from '@/app/_lib/public-home';

// type Tab = 'all' | 'deals' | 'websites';

// const TABS: { id: Tab; label: string }[] = [
//   { id: 'all',      label: 'All' },
//   { id: 'deals',    label: 'Hot Deals' },
//   { id: 'websites', label: 'Websites' },
// ];

// function TabPill({ active, onClick, children }: { active: boolean; onClick?: () => void; children: React.ReactNode }) {
//   return (
//     <button
//       onClick={onClick}
//       disabled={!onClick}
//       className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
//         active
//           ? 'bg-surface-3 text-white'
//           : onClick
//           ? 'text-white opacity-70 hover:opacity-100 hover:bg-surface-2'
//           : 'text-muted cursor-default'
//       }`}
//     >
//       {children}
//     </button>
//   );
// }

// export default function HomeExplore({
//   websites,
//   creators,
//   hotDeals,
//   dealId,
// }: {
//   websites: PublicWebsite[];
//   creators: PublicCreator[];
//   hotDeals: HotDeal[];
//   dealId?: string;
// }) {
//   const [tab, setTab] = useState<Tab>('all');
//   const displayWebsites = websites.length > 0 ? websites : MOCK_WEBSITES;
//   const displayCreators = creators.length > 0 ? creators : MOCK_CREATORS;

//   return (
//     <div className="h-full flex flex-col overflow-hidden">
//       <PageHeader title="Explore Hot Deals, Websites & Broadcast Media" />

//       <div className="shrink-0 flex items-center justify-center gap-2 pb-4 pt-2">
//         {TABS.map((t) => (
//           <TabPill key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
//             {t.label}
//           </TabPill>
//         ))}
//       </div>

//       <div className="shrink-0 flex items-center justify-between gap-2 pb-4 px-2">
//         <Link
//           href="/?panel=advertise"
//           className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-background hover:opacity-90 transition-colors"
//         >
//           <MegaphoneIcon className="w-4 h-4" />
//           Advertise
//         </Link>

//         <Link
//           href="/?panel=add-website"
//           className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-background hover:opacity-90 transition-colors"
//         >
//           <PlusCircleIcon className="w-4 h-4" />
//           Add Your Website
//         </Link>
//       </div>

//       {/* px-2: the hot-deal card's pulsing glow (box-shadow, see .hotdeal-glow
//           in globals.css) needs a few pixels of clearance before it hits
//           <main>'s own overflow-hidden edge (DashboardHome.tsx), otherwise the
//           glow gets visibly clipped on whichever side sits flush against it. */}
//       <div key={tab} className="flex-1 overflow-y-auto px-2">
//         {tab === 'all' ? (
//           <>
//             <HotDealsSection
//               deals={hotDeals}
//               initialDealId={dealId}
//               websites={displayWebsites}
//               creators={displayCreators}
//             />
//             <div className="rounded-3xl border border-border bg-surface-2 p-4 sm:p-6">
//               <p className="text-xs font-bold uppercase tracking-wide text-muted mb-4">Platforms</p>
//               <DashboardFeed websites={displayWebsites} />
//             </div>
//           </>
//         ) : tab === 'deals' ? (
//           hotDeals.length > 0 ? (
//             <HotDealsSection
//               deals={hotDeals}
//               initialDealId={dealId}
//               websites={displayWebsites}
//               creators={displayCreators}
//             />
//           ) : (
//             <div className="flex flex-col items-center justify-center text-center px-6 py-16">
//               <FireIcon className="w-10 h-10 text-(--color-coral) mb-3" />
//               <h1 className="text-xl font-bold text-(--color-white)">No Hot Deals right now</h1>
//               <p className="text-sm text-(--color-muted) mt-1.5 max-w-sm">
//                 Admin-curated bundles of YouTube slots and website ad spaces show up here, with a fixed package price, as soon as one goes live.
//               </p>
//             </div>
//           )
//         ) : (
//           <div className="rounded-3xl border border-border bg-surface-2 p-4 sm:p-6">
//             <p className="text-xs font-bold uppercase tracking-wide text-muted mb-4">Platforms</p>
//             <DashboardFeed websites={displayWebsites} />
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }
