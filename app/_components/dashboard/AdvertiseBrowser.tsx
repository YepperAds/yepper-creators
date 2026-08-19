'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/24/solid';
import { categoryAPI } from '@/app/_lib/adsense-api';
import VideoEmbed from '@/app/_components/home/VideoEmbed';
import AdSpacesModal from '@/app/_components/home/AdSpacesModal';
import HotDealsSection from '@/app/_components/home/HotDealsSection';
import WebsiteLogoTile from './WebsiteLogoTile';
import { MOCK_WEBSITES, MOCK_CREATORS } from '@/app/_lib/mock-home-data';
import { getAdSpaceImage, getAdSpaceDescription } from '@/app/_lib/ad-spaces';
import type { PublicWebsite, PublicCreator, HotDeal } from '@/app/_lib/public-home';

interface PricingTier {
  key: string;
  label: string;
  price: number;
  advertiserPrice?: number;
  maxSlots: number;
  dwellSeconds?: number;
}

interface TierAvailability {
  key: string;
  maxSlots: number;
  slotsTaken: number;
}

interface AdSpace {
  _id: string;
  categoryName: string;
  spaceType?: string;
  description?: string;
  price: number;
  advertiserPrice?: number;
  tier?: string;
  isFullyBooked?: boolean;
  pricingTiers?: PricingTier[] | null;
  tierAvailability?: TierAvailability[] | null;
}

interface CategoryBucket {
  key: string;
  label: string;
  websites: PublicWebsite[];
  creators: PublicCreator[];
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function titleCase(s: string): string {
  return s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Tiers within the same ad space share one physical placement, so what
// actually differs between them is real, data-backed: how long the ad stays
// on screen before rotating (dwellSeconds) — not invented marketing copy.
function tierDescription(tier: PricingTier): string {
  return tier.dwellSeconds
    ? `Stays on screen for ${tier.dwellSeconds}s per rotation.`
    : 'A dedicated slot in this ad space.';
}

// Same rank-by-real-price convention the live on-site widget already uses
// (see AdDisplayController's tierFillerHtml / SiteScriptController's
// data-tier-rank CSS) — ranked by what the tier actually costs, not by
// which named slot it is, so the escalation stays honest no matter what an
// owner types into the "Custom" slot. 0 = plain, 1 = featured, 2 = premium.
function tierRank(tiers: PricingTier[], key: string): number {
  const sorted = [...tiers].sort((a, b) => a.price - b.price);
  return Math.min(sorted.findIndex((t) => t.key === key), 2);
}

const TIER_RANK_STYLE = [
  {
    border: 'border-border',
    ring: '',
    badge: null as string | null,
    cta: 'bg-black text-white',
  },
  {
    border: 'border-[#f5c451]',
    ring: 'shadow-[0_8px_28px_rgba(245,196,81,0.25)]',
    badge: 'Featured spot',
    cta: 'bg-[#f5c451] text-[#3d2b00]',
  },
  {
    border: 'border-[#E8472B]',
    ring: 'shadow-[0_10px_34px_rgba(232,71,43,0.3)]',
    badge: '★ Premium spot',
    cta: 'bg-gradient-to-br from-[#E8472B] to-[#c2321a] text-white',
  },
];

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function buildCategories(websites: PublicWebsite[], creators: PublicCreator[]): CategoryBucket[] {
  const map = new Map<string, CategoryBucket>();

  for (const w of websites) {
    for (const cat of w.businessCategories || []) {
      const key = normalize(cat);
      if (!key) continue;
      if (!map.has(key)) map.set(key, { key, label: titleCase(cat), websites: [], creators: [] });
      map.get(key)!.websites.push(w);
    }
  }

  for (const c of creators) {
    const cat = c.whatTheyDo;
    if (!cat) continue;
    const key = normalize(cat);
    if (!map.has(key)) map.set(key, { key, label: titleCase(cat), websites: [], creators: [] });
    map.get(key)!.creators.push(c);
  }

  return Array.from(map.values());
}

function CompactCreatorCard({ creator, onCollaborate }: { creator: PublicCreator; onCollaborate: (creator: PublicCreator) => void }) {
  const videos = (creator.videos || []).slice(0, 3);
  return (
    <button
      onClick={() => onCollaborate(creator)}
      className="w-56 shrink-0 text-left rounded-xl bg-coral/8 border border-coral/15 p-3 hover:border-coral/40 transition-colors"
    >
      <div className="flex items-center gap-2 mb-2">
        {creator.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={creator.avatar} alt={creator.name} className="h-7 w-7 rounded-lg object-cover" />
        ) : (
          <div className="h-7 w-7 rounded-lg bg-surface-1 border border-border" />
        )}
        <div className="min-w-0">
          <p className="text-xs font-bold text-white truncate">{creator.name}</p>
          <p className="text-[10px] text-muted truncate">{formatCount(creator.subscribers)} subscribers</p>
        </div>
      </div>
      {videos.length > 0 && (
        <div className="flex gap-1.5">
          {videos.map((v, i) => (
            <div key={i} className="flex-1 aspect-video rounded-md overflow-hidden">
              <VideoEmbed url={v.url} thumbnail={v.thumbnail} title={v.title} />
            </div>
          ))}
        </div>
      )}
    </button>
  );
}

// No name caption here: WebsiteLogoTile already shows it once, beside the
// logo inside its own header bar.
function CompactWebsiteCard({ website, onClick }: { website: PublicWebsite; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-36 shrink-0 text-center group">
      <WebsiteLogoTile website={website} className="relative w-36 h-36 rounded-lg overflow-hidden border border-border group-hover:opacity-90 transition-opacity" />
    </button>
  );
}

export default function AdvertiseBrowser({ websites, creators, hotDeals, initialDealId, onBackToFeed }: { websites: PublicWebsite[]; creators: PublicCreator[]; hotDeals: HotDeal[]; initialDealId?: string; onBackToFeed: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categories = buildCategories(websites, creators);

  const [activeWebsite, setActiveWebsite] = useState<PublicWebsite | null>(null);
  const [adSpaces, setAdSpaces] = useState<AdSpace[]>([]);
  const [loadingSpaces, setLoadingSpaces] = useState(false);
  const [spacesError, setSpacesError] = useState('');
  const [collaborateWith, setCollaborateWith] = useState<PublicCreator | null>(null);
  const [selectedSpaceIds, setSelectedSpaceIds] = useState<string[]>([]);
  const [submittingInterest, setSubmittingInterest] = useState(false);
  const [interestError, setInterestError] = useState('');
  const [interestSubmitted, setInterestSubmitted] = useState(false);

  const openWebsite = async (website: PublicWebsite) => {
    setActiveWebsite(website);
    setAdSpaces([]);
    setSpacesError('');
    setLoadingSpaces(true);
    setSelectedSpaceIds([]);
    setInterestError('');
    setInterestSubmitted(false);
    try {
      const res = await categoryAPI.getByWebsiteAdvertiser(String(website.id));
      const cats = (res.data as { categories?: AdSpace[] })?.categories ?? [];
      setAdSpaces(cats);
    } catch {
      setSpacesError('Could not load ad spaces for this website.');
    } finally {
      setLoadingSpaces(false);
    }
  };

  const toggleSpaceSelected = (categoryId: string) => {
    setSelectedSpaceIds((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId],
    );
  };

  const submitInterest = async () => {
    if (!activeWebsite || selectedSpaceIds.length === 0) return;
    setSubmittingInterest(true);
    setInterestError('');
    try {
      await categoryAPI.expressInterest(String(activeWebsite.id), selectedSpaceIds);
      setInterestSubmitted(true);
    } catch {
      setInterestError('Could not submit your interest. Please try again.');
    } finally {
      setSubmittingInterest(false);
    }
  };

  // Coming from a "Collaborate"/"Advertise on" click on the logged-out home
  // page: the login redirect carries the target's id back here so the user
  // lands directly in the same place they clicked from, instead of the bare
  // browse list.
  useEffect(() => {
    const creatorId = searchParams.get('creatorId');
    const websiteId = searchParams.get('websiteId');
    if (creatorId) {
      const creator = creators.find((c) => String(c.id) === creatorId);
      if (creator) setCollaborateWith(creator);
    } else if (websiteId) {
      const website = websites.find((w) => String(w.id) === websiteId);
      if (website) openWebsite(website);
    }
    if (creatorId || websiteId) router.replace('/?panel=advertise', { scroll: false });
    // Only resolve the deep-link target once, right after the redirect lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chooseAdSpace = (categoryId: string, tierKey?: string) => {
    if (!activeWebsite) return;
    const tierParam = tierKey ? `&tier=${encodeURIComponent(tierKey)}` : '';
    router.push(`/ad-owner/pages/direct-ad?websiteId=${activeWebsite.id}&categoryId=${categoryId}${tierParam}`);
  };

  // Step 2: pick an ad space on the chosen website, then hand off to the
  // real booking + payment flow (/ad-owner/pages/direct-ad).
  if (activeWebsite) {
    return (
      <div>
        <button
          onClick={() => setActiveWebsite(null)}
          className="mb-4 flex items-center gap-1.5 text-sm font-medium text-subtle hover:text-white bg-surface-1 rounded-full px-3 py-1.5 border border-border transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" /> Back
        </button>
        <h3 className="text-lg font-bold text-white font-(--font-display) mb-1">{activeWebsite.websiteName}</h3>
        <p className="text-sm text-subtle mb-5">
          {activeWebsite.isProspect ? 'Select the ad space(s) you\'re interested in.' : 'Choose the ad space you want to book.'}
        </p>

        {loadingSpaces ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-surface-3 animate-pulse" />)}
          </div>
        ) : spacesError ? (
          <p className="text-sm text-coral-text">{spacesError}</p>
        ) : adSpaces.length === 0 ? (
          <p className="text-sm text-muted">No ad spaces available on this website yet.</p>
        ) : activeWebsite.isProspect ? (
          interestSubmitted ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="text-sm font-bold text-emerald-400">Thanks, we've noted your interest.</p>
              <p className="text-xs text-muted mt-1">We'll be in touch once this site is live on Yepper.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {adSpaces.map((space) => {
                  const img = getAdSpaceImage(space.spaceType, space.categoryName);
                  const description = space.description || getAdSpaceDescription(space.spaceType, space.categoryName);
                  const selected = selectedSpaceIds.includes(space._id);
                  return (
                    <label
                      key={space._id}
                      className={`group flex flex-col rounded-2xl border-2 overflow-hidden cursor-pointer bg-surface-1 transition-colors ${selected ? 'border-coral' : 'border-border hover:border-coral/40'}`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSpaceSelected(space._id)}
                        className="sr-only"
                      />
                      <div className="aspect-[4/3] w-full bg-white">
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img} alt={`${space.categoryName} ad placement preview`} className="w-full h-full object-contain" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted text-xs">No preview</div>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-3 p-4">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white">{space.categoryName}</p>
                          {description && <p className="text-xs text-muted mt-0.5">{description}</p>}
                        </div>
                        <div className={`shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${selected ? 'bg-coral border-coral' : 'border-border group-hover:border-coral/60'}`}>
                          {selected && <CheckIcon className="w-4 h-4 text-white" />}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
              {interestError && <p className="text-sm text-coral-text">{interestError}</p>}
              <button
                onClick={submitInterest}
                disabled={selectedSpaceIds.length === 0 || submittingInterest}
                className="w-full py-3 rounded-xl bg-coral text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submittingInterest ? 'Submitting…' : 'Request selected ad space(s)'}
              </button>
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {adSpaces.flatMap((space) => {
              const img = getAdSpaceImage(space.spaceType, space.categoryName);
              const tiers = space.pricingTiers;

              // Tiered ad space (Custom/Elite/Current-style slots): the site
              // only has the one physical placement, but it's sold as several
              // separate slots at different prices — show each slot as its
              // own full card (own title, own description, own price)
              // instead of nesting them inside one ambiguous card, so the
              // choice made here is the exact one direct-ad locks onto next
              // (see its ?tier= handling).
              if (Array.isArray(tiers) && tiers.length > 0) {
                const availabilityByKey = new Map((space.tierAvailability || []).map((t) => [t.key, t]));
                return tiers.map((tier) => {
                  const avail = availabilityByKey.get(tier.key);
                  const full = !!avail && avail.slotsTaken >= avail.maxSlots;
                  const rank = tierRank(tiers, tier.key);
                  const style = TIER_RANK_STYLE[rank];
                  return (
                    <button
                      key={`${space._id}:${tier.key}`}
                      onClick={() => chooseAdSpace(space._id, tier.key)}
                      disabled={full}
                      className={`relative flex flex-col rounded-2xl border-2 overflow-hidden text-left bg-surface-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${style.border} ${style.ring} ${rank === 2 ? 'sm:col-span-2' : ''}`}
                    >
                      <div className="relative aspect-[4/3] w-full bg-white">
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img} alt={`${space.categoryName} — ${tier.label} ad placement preview`} className="w-full h-full object-contain" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted text-xs">No preview</div>
                        )}
                        {style.badge && (
                          <span className={`absolute top-2 left-2 z-[1] inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide shadow ${style.cta}`}>
                            {style.badge}
                          </span>
                        )}
                        {full && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                            <p className="text-xs font-bold text-white uppercase tracking-wide">Fully booked</p>
                          </div>
                        )}
                      </div>
                      <div className={`flex items-center justify-between gap-3 ${rank === 2 ? 'p-5' : 'p-4'}`}>
                        <div className="min-w-0">
                          <p className={`font-bold text-white ${rank === 2 ? 'text-base' : 'text-sm'}`}>{space.categoryName} — {tier.label}</p>
                          <p className="text-xs text-muted mt-0.5">{tierDescription(tier)}</p>
                          <p className="text-xs font-semibold text-coral-text mt-1">RWF {tier.advertiserPrice ?? tier.price}</p>
                        </div>
                        <span className={`shrink-0 inline-flex items-center rounded-lg font-semibold ${rank === 2 ? 'text-sm px-5 py-2.5' : 'text-xs px-4 py-2'} ${style.cta}`}>
                          Continue
                        </span>
                      </div>
                    </button>
                  );
                });
              }

              const description = space.description || getAdSpaceDescription(space.spaceType, space.categoryName);
              return [(
                <button
                  key={space._id}
                  onClick={() => chooseAdSpace(space._id)}
                  disabled={space.isFullyBooked}
                  className="flex flex-col rounded-2xl border-2 border-border overflow-hidden text-left bg-surface-1 hover:border-coral/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border"
                >
                  <div className="relative aspect-[4/3] w-full bg-white">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={`${space.categoryName} ad placement preview`} className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted text-xs">No preview</div>
                    )}
                    {space.isFullyBooked && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                        <p className="text-xs font-bold text-white uppercase tracking-wide">Fully booked</p>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-bold text-white">{space.categoryName}</p>
                    {description && <p className="text-xs text-muted mt-0.5">{description}</p>}
                  </div>
                </button>
              )];
            })}
          </div>
        )}
      </div>
    );
  }

  // Step 1: every category shown with its actual content right there:
  // a small video preview row for each creator, logo tiles for websites.
  return (
    <div className="space-y-8">
      <button
        onClick={onBackToFeed}
        className="flex items-center gap-1.5 text-sm font-medium text-subtle hover:text-white bg-surface-1 rounded-full px-3 py-1.5 border border-border transition-colors"
      >
        <ArrowLeftIcon className="w-4 h-4" /> Back
      </button>

      <HotDealsSection
        deals={hotDeals}
        initialDealId={initialDealId}
        websites={websites.length > 0 ? websites : MOCK_WEBSITES}
        creators={creators.length > 0 ? creators : MOCK_CREATORS}
      />

      <div>
        <h3 className="text-lg font-bold text-white font-(--font-display) mb-1">Choose Platforms</h3>
      </div>

      {categories.length === 0 ? (
        <p className="text-sm text-muted">No categories available yet.</p>
      ) : (
        categories.map((cat) => (
          <section key={cat.key}>
            <p className="text-xs font-bold uppercase tracking-wide text-coral-text mb-3">{cat.label}</p>

            {cat.creators.length > 0 && (
              <div className="flex gap-3 overflow-x-auto pb-1 mb-3 -mx-1 px-1">
                {cat.creators.map((c) => <CompactCreatorCard key={c.id} creator={c} onCollaborate={setCollaborateWith} />)}
              </div>
            )}

            {cat.websites.length > 0 && (
              <div className="flex gap-4 overflow-x-auto pb-1 -mx-1 px-1">
                {cat.websites.map((w) => <CompactWebsiteCard key={w.id} website={w} onClick={() => openWebsite(w)} />)}
              </div>
            )}
          </section>
        ))
      )}

      <AdSpacesModal creator={collaborateWith} open={!!collaborateWith} onClose={() => setCollaborateWith(null)} />
    </div>
  );
}
