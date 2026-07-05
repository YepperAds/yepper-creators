'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { categoryAPI } from '@/app/_lib/adsense-api';
import VideoEmbed from '@/app/_components/home/VideoEmbed';
import AdSpacesModal from '@/app/_components/home/AdSpacesModal';
import HotDealsSection from '@/app/_components/home/HotDealsSection';
import WebsiteLogoTile from './WebsiteLogoTile';
import { MOCK_WEBSITES, MOCK_CREATORS } from '@/app/_lib/mock-home-data';
import type { PublicWebsite, PublicCreator, HotDeal } from '@/app/_lib/public-home';

interface AdSpace {
  _id: string;
  categoryName: string;
  description?: string;
  price: number;
  tier?: string;
  isFullyBooked?: boolean;
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
      className="w-56 shrink-0 text-left rounded-xl bg-surface-1 dark:bg-coral/8 border border-coral/15 p-3 hover:border-coral/40 transition-colors"
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

function CompactWebsiteCard({ website, onClick }: { website: PublicWebsite; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-28 shrink-0 text-center group">
      <WebsiteLogoTile website={website} className="relative w-28 h-28 group-hover:opacity-90 transition-opacity" />
      <p className="mt-1.5 text-xs font-semibold text-white truncate">{website.websiteName}</p>
    </button>
  );
}

export default function AdvertiseBrowser({ websites, creators, hotDeals, initialDealId }: { websites: PublicWebsite[]; creators: PublicCreator[]; hotDeals: HotDeal[]; initialDealId?: string }) {
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

  const chooseAdSpace = (categoryId: string) => {
    if (!activeWebsite) return;
    router.push(`/ad-owner/pages/direct-ad?websiteId=${activeWebsite.id}&categoryId=${categoryId}`);
  };

  // Step 2 — pick an ad space on the chosen website, then hand off to the
  // real booking + payment flow (/ad-owner/pages/direct-ad).
  if (activeWebsite) {
    return (
      <div>
        <button
          onClick={() => setActiveWebsite(null)}
          className="mb-4 flex items-center gap-1.5 text-sm font-medium text-subtle hover:text-white bg-surface-1 rounded-full px-3 py-1.5 border border-border transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" /> Back to browse
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
              <p className="text-sm font-bold text-emerald-400">Thanks — we've noted your interest.</p>
              <p className="text-xs text-muted mt-1">We'll be in touch once this site is live on Yepper.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                {adSpaces.map((space) => (
                  <label
                    key={space._id}
                    className="w-full flex items-center gap-3 rounded-xl border border-border bg-surface-1 p-4 cursor-pointer hover:border-coral/40 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSpaceIds.includes(space._id)}
                      onChange={() => toggleSpaceSelected(space._id)}
                      className="accent-coral"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white">{space.categoryName}</p>
                      {space.description && <p className="text-xs text-muted mt-0.5">{space.description}</p>}
                    </div>
                  </label>
                ))}
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
          <div className="space-y-2">
            {adSpaces.map((space) => (
              <button
                key={space._id}
                onClick={() => chooseAdSpace(space._id)}
                disabled={space.isFullyBooked}
                className="w-full flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-1 p-4 text-left hover:border-coral/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div>
                  <p className="text-sm font-bold text-white">{space.categoryName}</p>
                  {space.description && <p className="text-xs text-muted mt-0.5">{space.description}</p>}
                  {space.isFullyBooked && <p className="text-xs text-coral-text mt-0.5">Fully booked</p>}
                </div>
                <p className="text-sm font-bold text-coral-text shrink-0">${space.price}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Step 1 — every category shown with its actual content right there:
  // a small video preview row for each creator, logo tiles for websites.
  return (
    <div className="space-y-8">
      <HotDealsSection
        deals={hotDeals}
        initialDealId={initialDealId}
        websites={websites.length > 0 ? websites : MOCK_WEBSITES}
        creators={creators.length > 0 ? creators : MOCK_CREATORS}
      />

      <div>
        <h3 className="text-lg font-bold text-white font-(--font-display) mb-1">Advertise on Yepper</h3>
        <p className="text-sm text-subtle">Browse by category, then pick a website or channel to advertise with.</p>
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
