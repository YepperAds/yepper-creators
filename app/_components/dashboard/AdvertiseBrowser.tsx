'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeftIcon, ArrowRightIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/24/solid';
import { categoryAPI } from '@/app/_lib/adsense-api';
import AdSpacesModal from '@/app/_components/home/AdSpacesModal';
import HotDealsSection from '@/app/_components/home/HotDealsSection';
import WebsiteAdPreview from './WebsiteAdPreview';
import { MOCK_WEBSITES, MOCK_CREATORS } from '@/app/_lib/mock-home-data';
import { getAdSpaceImage, getAdSpaceDescription } from '@/app/_lib/ad-spaces';
import type { PublicWebsite, PublicCreator, HotDeal } from '@/app/_lib/public-home';
import PlatformCreatorCard from './PlatformCreatorCard';

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

// No name caption here: WebsiteLogoTile already shows it once, beside the
// logo inside its own header bar.
function CompactWebsiteCard({ website, onClick }: { website: PublicWebsite; onClick: () => void }) {
  const [logoBroken, setLogoBroken] = useState(false);
  return (
    <button onClick={onClick} className="group w-full min-w-0 rounded-xl border border-white/10 bg-[#171717] p-3 text-left transition hover:border-white/25 hover:bg-[#1b1b1b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral">
      <span className="mb-3 flex min-w-0 items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white text-slate-500">
          {website.imageUrl && !logoBroken ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={website.imageUrl} alt="" className="h-full w-full object-contain" onError={() => setLogoBroken(true)} />
          ) : <GlobeAltIcon className="h-5 w-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-white">{website.websiteName}</span>
          <span className="mt-0.5 block truncate text-[11px] text-white/50">{website.websiteLink.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</span>
        </span>
      </span>
      <WebsiteAdPreview website={website} className="mb-3" />
      <span className="flex items-center justify-between gap-2 text-xs font-semibold text-white/75">
        <span>Browse ad spaces</span><ArrowRightIcon className="h-4 w-4 text-white/50 transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

export default function AdvertiseBrowser({ websites, creators, hotDeals, initialDealId, onBackToFeed }: { websites: PublicWebsite[]; creators: PublicCreator[]; hotDeals: HotDeal[]; initialDealId?: string; onBackToFeed: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const websiteList = websites.length > 0 ? websites : MOCK_WEBSITES;
  const creatorList = creators.length > 0 ? creators : MOCK_CREATORS;

  const [activeWebsite, setActiveWebsite] = useState<PublicWebsite | null>(null);
  const [adSpaces, setAdSpaces] = useState<AdSpace[]>([]);
  const [loadingSpaces, setLoadingSpaces] = useState(false);
  const [spacesError, setSpacesError] = useState('');
  const [collaborateWith, setCollaborateWith] = useState<PublicCreator | null>(null);
  const [returnToFeedAfterDeepLink, setReturnToFeedAfterDeepLink] = useState(false);
  const [selectedSpaceIds, setSelectedSpaceIds] = useState<string[]>([]);
  const [submittingInterest, setSubmittingInterest] = useState(false);
  const [interestError, setInterestError] = useState('');
  const [interestSubmitted, setInterestSubmitted] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<'all' | 'websites' | 'youtube' | 'tiktok'>('all');

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
      const creator = creatorList.find((c) => String(c.id) === creatorId);
      if (creator) {
        setCollaborateWith(creator);
        setReturnToFeedAfterDeepLink(true);
      }
    } else if (websiteId) {
      const website = websiteList.find((w) => String(w.id) === websiteId);
      if (website) {
        setReturnToFeedAfterDeepLink(true);
        openWebsite(website);
      }
    }
    if (creatorId || websiteId) router.replace('/?panel=advertise', { scroll: false });
    // Only resolve the deep-link target once, right after the redirect lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeCreatorModal = () => {
    setCollaborateWith(null);
    if (returnToFeedAfterDeepLink) {
      setReturnToFeedAfterDeepLink(false);
      onBackToFeed();
    }
  };

  const backFromWebsite = () => {
    if (returnToFeedAfterDeepLink) {
      setReturnToFeedAfterDeepLink(false);
      onBackToFeed();
      return;
    }
    setActiveWebsite(null);
  };

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
          onClick={backFromWebsite}
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
                  return (
                    <button
                      key={`${space._id}:${tier.key}`}
                      onClick={() => chooseAdSpace(space._id, tier.key)}
                      disabled={full}
                      className="flex flex-col rounded-2xl border-2 border-border overflow-hidden text-left bg-surface-1 hover:border-coral/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border"
                    >
                      <div className="relative aspect-[4/3] w-full bg-white">
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img} alt={`${space.categoryName} — ${tier.label} ad placement preview`} className="w-full h-full object-contain" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted text-xs">No preview</div>
                        )}
                        {full && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                            <p className="text-xs font-bold text-white uppercase tracking-wide">Fully booked</p>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-3 p-4">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white">{space.categoryName} — {tier.label}</p>
                          <p className="text-xs text-muted mt-0.5">{tierDescription(tier)}</p>
                        </div>
                        <p className="text-sm font-bold text-coral-text shrink-0">RWF {tier.advertiserPrice ?? tier.price}</p>
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

  // Step 1: show inventory in responsive grids so choosing a placement does
  // not require horizontal scrolling or leave a card clipped off-screen.
  const websiteCreators = creatorList.filter((creator) => creator.provider !== 'tiktok');
  const tiktokCreators = creatorList.filter((creator) => creator.provider === 'tiktok');
  const showWebsites = platformFilter === 'all' || platformFilter === 'websites';
  const showYoutube = platformFilter === 'all' || platformFilter === 'youtube';
  const showTiktok = platformFilter === 'all' || platformFilter === 'tiktok';
  const platformFilters = [
    { id: 'all' as const, label: 'All', count: websiteList.length + creatorList.length },
    { id: 'websites' as const, label: 'Websites', count: websiteList.length },
    { id: 'youtube' as const, label: 'YouTube', count: websiteCreators.length },
    { id: 'tiktok' as const, label: 'TikTok', count: tiktokCreators.length },
  ];

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-7 pb-8">
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

      <header className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#191919] to-[#111] p-5 sm:p-7">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-coral-text">Advertise on Yepper</p>
          <h3 className="mt-2 text-2xl font-bold tracking-tight text-white font-(--font-display) sm:text-3xl">Choose where your ad appears</h3>
          <p className="mt-2 text-sm leading-6 text-white/60">Reach audiences on registered websites and creator channels. Select a placement to see its available options.</p>
        </div>
        <div className="mt-5 flex max-w-full gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filter advertising platforms">
          {platformFilters.map((filter) => (
            <button key={filter.id} type="button" role="tab" aria-selected={platformFilter === filter.id} onClick={() => setPlatformFilter(filter.id)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${platformFilter === filter.id ? 'border-white bg-white text-black' : 'border-white/10 bg-white/[0.04] text-white/65 hover:border-white/25 hover:text-white'}`}>
              {filter.label}<span className={`ml-2 text-xs ${platformFilter === filter.id ? 'text-black/55' : 'text-white/40'}`}>{filter.count}</span>
            </button>
          ))}
        </div>
      </header>

      <div className="space-y-8">
        {showWebsites && websiteList.length > 0 && (
          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div><h4 className="text-base font-bold text-white">Registered websites</h4><p className="mt-1 text-xs text-white/50">Choose a site to browse its ad placements.</p></div>
              <span className="text-xs text-white/40">{websiteList.length} {websiteList.length === 1 ? 'site' : 'sites'}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {websiteList.map((w) => <CompactWebsiteCard key={w.id} website={w} onClick={() => openWebsite(w)} />)}
            </div>
          </section>
        )}

        {showYoutube && websiteCreators.length > 0 && (
          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div><h4 className="text-base font-bold text-white">YouTube channels</h4><p className="mt-1 text-xs text-white/50">Promote your brand through creator videos and audiences.</p></div>
              <span className="text-xs text-white/40">{websiteCreators.length} {websiteCreators.length === 1 ? 'channel' : 'channels'}</span>
            </div>
            <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {websiteCreators.map((creator) => <PlatformCreatorCard key={`youtube-${creator.id}`} creator={creator} onClick={() => setCollaborateWith(creator)} className="w-full min-w-0" />)}
            </div>
          </section>
        )}

        {showTiktok && tiktokCreators.length > 0 && (
          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div><h4 className="text-base font-bold text-white">TikTok creators</h4><p className="mt-1 text-xs text-white/50">Connect with audiences through short-form video.</p></div>
              <span className="text-xs text-white/40">{tiktokCreators.length} {tiktokCreators.length === 1 ? 'creator' : 'creators'}</span>
            </div>
            <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {tiktokCreators.map((creator) => <PlatformCreatorCard key={`tiktok-${creator.id}`} creator={creator} onClick={() => setCollaborateWith(creator)} className="w-full min-w-0" />)}
            </div>
          </section>
        )}

        {((platformFilter === 'websites' && websiteList.length === 0) || (platformFilter === 'youtube' && websiteCreators.length === 0) || (platformFilter === 'tiktok' && tiktokCreators.length === 0) || (platformFilter === 'all' && websiteList.length + creatorList.length === 0)) && (
          <div className="rounded-2xl border border-dashed border-white/15 px-5 py-12 text-center">
            <p className="font-semibold text-white">No placements available yet</p>
            <p className="mt-1 text-sm text-white/50">Check back soon as more websites and creator channels join Yepper.</p>
          </div>
        )}
      </div>

      <AdSpacesModal creator={collaborateWith} open={!!collaborateWith} onClose={closeCreatorModal} />
    </div>
  );
}
