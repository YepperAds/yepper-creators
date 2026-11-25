'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChartBarIcon,
  CheckCircleIcon,
  CreditCardIcon,
  EyeIcon,
  FilmIcon,
  MapPinIcon,
  UsersIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import PlatformCreatorCard from '@/app/_components/dashboard/PlatformCreatorCard';
import type { PublicCreator } from '@/app/_lib/public-home';
import { getToken } from '@/app/(adsense)/utils/token';
import {
  clearDemoSession,
  ensureDemoSession,
  startDemoSession,
  writeDemoSession,
  type DemoCampaign,
  type DemoSession,
  type DemoViewer,
} from '@/app/_lib/demo-session';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

interface TikTokPackageQuote {
  code: string;
  name: string;
  description: string;
  amount: number;
  monthlyPrice: number;
  commitmentMonths: number;
  tier: string;
}

interface TikTokQuote {
  packages: TikTokPackageQuote[];
  remainingCapacity: number;
}

const PACKAGE_OPTIONS = [
  { code: 'corner_ad', name: 'One Corner ad', summary: 'One ad placement in a creator video.' },
  { code: 'daily_30_days', name: 'Daily Corner ads for 30 days', summary: 'A daily placement for 30 days.' },
  { code: 'five_monthly', name: '5 Corner ads per month', summary: 'Five placements during one month.' },
] as const;

const VIEWER_SAMPLES: Omit<DemoViewer, 'viewedAt'>[] = [
  { id: 'viewer-001', city: 'Kigali', country: 'Rwanda', device: 'Mobile · Android', watchTime: '42 sec' },
  { id: 'viewer-002', city: 'Nairobi', country: 'Kenya', device: 'Desktop · Chrome', watchTime: '58 sec' },
  { id: 'viewer-003', city: 'Kampala', country: 'Uganda', device: 'Mobile · iOS', watchTime: '31 sec' },
  { id: 'viewer-004', city: 'Kigali', country: 'Rwanda', device: 'Tablet · Android', watchTime: '47 sec' },
  { id: 'viewer-005', city: 'Dar es Salaam', country: 'Tanzania', device: 'Mobile · Android', watchTime: '36 sec' },
  { id: 'viewer-006', city: 'Kigali', country: 'Rwanda', device: 'Desktop · Firefox', watchTime: '64 sec' },
];

type View = 'channels' | 'create' | 'payment' | 'ads' | 'report';
type PaymentMethod = 'mobile_money' | 'card';

function formatRwf(amount: number): string {
  return `RWF ${amount.toLocaleString('en-US')}`;
}

function getPackagePrice(subscribers: number, code: (typeof PACKAGE_OPTIONS)[number]['code']): number {
  const tier = subscribers < 1_000
    ? { corner: 10_000, daily: 2_061, five: 30_000 }
    : subscribers < 5_000
      ? { corner: 200_000, daily: 1_717, five: 30_000 }
      : subscribers < 20_000
        ? { corner: 200_000, daily: 2_747, five: 30_000 }
        : subscribers < 50_000
          ? { corner: 200_000, daily: 5_152, five: 30_000 }
          : subscribers < 150_000
            ? { corner: 200_000, daily: 7_899, five: 30_000 }
            : { corner: 1_000_000, daily: 11_000, five: 80_000 };

  if (code === 'corner_ad') return tier.corner;
  if (code === 'daily_30_days') return tier.daily * 30;
  return tier.five * 5;
}

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Could not read the selected image.'));
    };
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
  });
}

function makeViewers(): DemoViewer[] {
  return VIEWER_SAMPLES.map((viewer, index) => ({
    ...viewer,
    viewedAt: new Date(Date.now() - index * 47 * 60_000).toISOString(),
  }));
}

function createCampaignId(): string {
  return `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function StepPill({ active, complete, children }: { active: boolean; complete?: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
      active ? 'border-coral/60 bg-coral/10 text-white' : complete ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-white/10 text-white/45'
    }`}>
      {complete && <CheckCircleIcon className="h-4 w-4" />}
      {children}
    </span>
  );
}

function creatorName(creator: PublicCreator): string {
  if (creator.provider === 'tiktok' && creator.username) return `@${creator.username.replace(/^@+/, '')}`;
  return creator.channelName || creator.name;
}

function creatorAudience(creator: PublicCreator): number {
  return creator.provider === 'tiktok' ? creator.followers ?? creator.subscribers : creator.subscribers;
}

function creatorVideoTitle(creator: PublicCreator): string {
  return creator.videos?.[0]?.title || (creator.provider === 'tiktok' ? 'Featured TikTok post' : 'Featured YouTube video');
}

function VideoPlacementPreview({ creativeImage, channelName, videoTitle, provider = 'youtube' }: { creativeImage: string; channelName: string; videoTitle: string; provider?: 'youtube' | 'tiktok' }) {
  return (
    <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-[#151515]">
      {provider === 'youtube' ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/youtube-ad-preview/creator.png" alt="Illustrated mock creator video" className="absolute inset-0 h-full w-full object-contain opacity-90" />
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#1b1018] via-[#111] to-[#092126]">
          <div className="relative h-[88%] aspect-[9/16] overflow-hidden rounded-2xl border border-white/15 bg-black">
            <div className="absolute inset-0 flex items-center justify-center text-4xl font-bold text-white/20">♪</div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-3 pb-3 pt-10">
              <p className="truncate text-[10px] font-bold text-white">{channelName}</p>
              <p className="mt-1 line-clamp-2 text-[9px] text-white/70">{videoTitle}</p>
            </div>
          </div>
        </div>
      )}
      <div className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold text-white/80">
        {provider === 'tiktok' ? 'DEMO POST' : 'DEMO VIDEO'} · {channelName}
      </div>
      {provider === 'youtube' && (
        <div className="absolute bottom-[13%] right-[4%] w-[32%] overflow-hidden rounded border border-white bg-white shadow-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={creativeImage} alt="Your ad placement preview" className="block h-auto w-full" />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-black/65 px-3 py-2 text-[10px] text-white/75">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-coral" />
        <span className="truncate">{videoTitle} · Demo ad placement</span>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof EyeIcon }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-xs text-white/55"><Icon className="h-4 w-4" />{label}</div>
      <p className="mt-2 text-xl font-bold text-white">{value}</p>
    </div>
  );
}

export default function DemoExperience() {
  const router = useRouter();
  const [session, setSession] = useState<DemoSession | null>(null);
  const [channels, setChannels] = useState<PublicCreator[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [view, setView] = useState<View>('channels');
  const [platformFilter, setPlatformFilter] = useState<'all' | 'youtube' | 'tiktok'>('all');
  const [selectedChannel, setSelectedChannel] = useState<PublicCreator | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<(typeof PACKAGE_OPTIONS)[number]['code']>('corner_ad');
  const [tiktokQuote, setTiktokQuote] = useState<TikTokQuote | null>(null);
  const [tiktokQuoteError, setTiktokQuoteError] = useState('');
  const [tiktokPackageCode, setTiktokPackageCode] = useState('');
  const [tiktokCommitmentMonths, setTiktokCommitmentMonths] = useState(1);
  const [tiktokCreative, setTiktokCreative] = useState<File | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mobile_money');
  const [brandName, setBrandName] = useState('');
  const [headline, setHeadline] = useState('');
  const [description, setDescription] = useState('');
  const [destinationUrl, setDestinationUrl] = useState('');
  const [creativeImage, setCreativeImage] = useState('/youtube-ad-preview/ad.png');
  const [creativeName, setCreativeName] = useState('');
  const [selectedReport, setSelectedReport] = useState<DemoCampaign | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setSession(ensureDemoSession());
      } catch (sessionError) {
        setError(sessionError instanceof Error ? sessionError.message : 'Could not load the demo session.');
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const loadDemoCreators = async () => {
      try {
        const response = await fetch('/api/proxy/api/creators/public', { cache: 'no-store', credentials: 'include' });
        const json = await response.json().catch(() => ({}));
        const creators = Array.isArray(json?.data) ? json.data : [];
        const demoCreators = creators.filter((creator: PublicCreator) =>
          creator.provider === 'tiktok' ||
          (creator.provider === 'youtube' && creator.isPartnerChannel === true)
        );
        setChannels(demoCreators);
      } catch {
        setChannels([]);
      } finally {
        setChannelsLoading(false);
      }
    };
    void loadDemoCreators();
  }, []);

  const selectedPackageOption = PACKAGE_OPTIONS.find((option) => option.code === selectedPackage)!;
  const selectedTikTokPackage = tiktokQuote?.packages.find((item) => item.code === tiktokPackageCode) ?? null;
  const selectedChannelName = selectedChannel ? creatorName(selectedChannel) : '';
  const selectedChannelAudience = selectedChannel ? creatorAudience(selectedChannel) : 0;
  const selectedVideoTitle = selectedChannel ? creatorVideoTitle(selectedChannel) : '';
  const selectedPackageName = selectedChannel?.provider === 'tiktok'
    ? selectedTikTokPackage?.name || 'TikTok sponsored post'
    : selectedPackageOption.name;
  const amount = selectedChannel?.provider === 'tiktok'
    ? selectedTikTokPackage?.amount ?? 0
    : selectedChannel ? getPackagePrice(selectedChannelAudience, selectedPackage) : 0;

  const chooseChannel = (channel: PublicCreator) => {
    setSelectedChannel(channel);
    setSelectedPackage('corner_ad');
    setTiktokQuote(null);
    setTiktokQuoteError('');
    setTiktokPackageCode('');
    setTiktokCommitmentMonths(1);
    setTiktokCreative(null);
    setBrandName('');
    setHeadline('');
    setDescription('');
    setDestinationUrl('');
    setCreativeImage('/youtube-ad-preview/ad.png');
    setCreativeName('');
    setError('');
    setView('create');
  };

  useEffect(() => {
    if (view !== 'create' || selectedChannel?.provider !== 'tiktok') return;
    let cancelled = false;
    const loadQuote = async () => {
      setTiktokQuote(null);
      setTiktokQuoteError('');
      try {
        const token = getToken();
        const response = await fetch(
          `${BACKEND_URL}/api/social/tiktok/sponsorships/${selectedChannel.id}/quote?commitmentMonths=${tiktokCommitmentMonths}`,
          {
            credentials: 'include',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            cache: 'no-store',
          },
        );
        const json = await response.json().catch(() => ({}));
        if (!response.ok || !json?.success || !Array.isArray(json?.data?.packages)) {
          throw new Error(json?.message || 'Could not load TikTok package prices.');
        }
        if (cancelled) return;
        setTiktokQuote({ ...json.data, remainingCapacity: Math.max(Number(json.data.remainingCapacity) || 0, 1) });
        setTiktokPackageCode((current) => (
          json.data.packages.some((item: TikTokPackageQuote) => item.code === current)
            ? current
            : json.data.packageCode || json.data.packages[0]?.code || ''
        ));
      } catch (quoteError) {
        if (!cancelled) setTiktokQuoteError(quoteError instanceof Error ? quoteError.message : 'Could not load TikTok package prices.');
      }
    };
    void loadQuote();
    return () => { cancelled = true; };
  }, [selectedChannel, tiktokCommitmentMonths, view]);

  const handleCreativeChange = async (file: File | undefined) => {
    setError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file for the ad creative.');
      return;
    }
    if (file.size > 700 * 1024) {
      setError('For temporary browser storage, the demo image must be 700 KB or smaller.');
      return;
    }
    try {
      setCreativeImage(await readImage(file));
      setCreativeName(file.name);
    } catch (imageError) {
      setError(imageError instanceof Error ? imageError.message : 'Could not load the selected image.');
    }
  };

  const handleTikTokCreativeChange = (file: File | undefined) => {
    setError('');
    setTiktokCreative(null);
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file for the TikTok post.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('The TikTok image must be 5 MB or smaller.');
      return;
    }
    setTiktokCreative(file);
  };

  const continueToPayment = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedChannel) {
      setError('Choose a creator first.');
      setView('channels');
      return;
    }
    if (selectedChannel.provider === 'tiktok' && (
      !brandName.trim() ||
      !selectedTikTokPackage ||
      !tiktokQuote ||
      (tiktokPackageCode === 'advertiser_image_post' && !tiktokCreative)
    )) {
      setError('Complete the required TikTok booking details before continuing.');
      return;
    }
    setError('');
    setView('payment');
  };

  const completeDemoPayment = async () => {
    if (!selectedChannel || busy || !session) return;
    setBusy(true);
    setError('');
    try {
      const campaign: DemoCampaign = {
        id: createCampaignId(),
        creatorId: String(selectedChannel.id),
        provider: selectedChannel.provider === 'tiktok' ? 'tiktok' : 'youtube',
        channelName: selectedChannelName,
        channelSubscribers: selectedChannelAudience,
        videoTitle: selectedVideoTitle,
        packageName: selectedPackageName,
        commitmentMonths: selectedChannel.provider === 'tiktok' ? tiktokCommitmentMonths : undefined,
        paymentMethod,
        amount,
        brandName: brandName.trim(),
        headline: selectedChannel.provider === 'tiktok' ? brandName.trim() : headline.trim(),
        description: description.trim(),
        destinationUrl: destinationUrl.trim(),
        creativeImage: selectedChannel.provider === 'tiktok' ? '/youtube-ad-preview/ad.png' : creativeImage,
        creativeName: selectedChannel.provider === 'tiktok' ? tiktokCreative?.name : creativeName,
        creatorAvatar: selectedChannel.avatar,
        createdAt: new Date().toISOString(),
        views: 2_840,
        likes: 184,
        comments: 22,
        clicks: 116,
        viewers: makeViewers(),
      };
      const updatedSession = { ...session, campaigns: [campaign, ...session.campaigns] };
      writeDemoSession(updatedSession);
      setSession(updatedSession);
      setSelectedReport(campaign);
      setView('report');
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : 'Could not save this demo campaign in the browser.');
    } finally {
      setBusy(false);
    }
  };

  const exitDemo = () => {
    try {
      clearDemoSession();
      router.replace('/?panel=settings');
    } catch (exitError) {
      setError(exitError instanceof Error ? exitError.message : 'Could not exit the demo.');
    }
  };

  const restartDemo = () => {
    try {
      setSession(startDemoSession());
      setSelectedChannel(null);
      setSelectedReport(null);
      setError('');
      setView('channels');
    } catch (restartError) {
      setError(restartError instanceof Error ? restartError.message : 'Could not restart the demo.');
    }
  };

  const openReport = (campaign: DemoCampaign) => {
    setSelectedReport(campaign);
    setView('report');
  };

  if (!session && !error) {
    return <div className="flex min-h-screen items-center justify-center bg-[#0b0b0b] text-sm text-white/55">Opening your private demo…</div>;
  }

  return (
    <main className="min-h-screen bg-[#0b0b0b] text-white">
      <div className="min-h-screen lg:flex">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-white/10 bg-[#101010] p-4 lg:flex">
          <div className="mb-8 flex items-center gap-3 px-2 pt-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-coral/15 text-coral-text"><FilmIcon className="h-5 w-5" /></div>
            <div><p className="text-sm font-bold">Yepper</p><p className="text-[10px] font-semibold uppercase tracking-wide text-amber-300">Demo workspace</p></div>
          </div>
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">Advertiser</p>
          <nav className="space-y-1">
            {[
              { id: 'channels' as const, label: 'Marketplace' },
              { id: 'ads' as const, label: `My ads${session?.campaigns.length ? ` · ${session.campaigns.length}` : ''}` },
            ].map((item) => (
              <button key={item.id} type="button" onClick={() => { setView(item.id); setError(''); }} className={`w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${view === item.id || (item.id === 'ads' && view === 'report') ? 'bg-white/10 text-white' : 'text-white/55 hover:bg-white/5 hover:text-white'}`}>
                {item.label}
              </button>
            ))}
          </nav>
          <div className="mt-auto rounded-xl border border-amber-400/15 bg-amber-400/[0.05] p-3 text-[10px] leading-5 text-amber-100/70">
            Demo only. No real bookings, payments, or campaign results are created.
          </div>
          <button type="button" onClick={exitDemo} className="mt-3 rounded-lg px-3 py-2 text-left text-xs font-semibold text-white/45 hover:bg-white/5 hover:text-white">Exit demo</button>
        </aside>

        <div className="min-w-0 flex-1 px-4 py-5 sm:px-7 sm:py-7">
        <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-coral/15 text-coral-text"><FilmIcon className="h-5 w-5" /></div>
            <div>
              <p className="text-sm font-bold">Yepper <span className="ml-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">Demo</span></p>
              <p className="mt-0.5 text-[11px] text-white/45">Advertiser dashboard · simulated</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => { setView('ads'); setError(''); }} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/5">
              My ads <span className="ml-1 text-white/45">{session?.campaigns.length ?? 0}</span>
            </button>
            <button type="button" onClick={exitDemo} className="rounded-lg px-3 py-2 text-xs font-semibold text-white/55 transition hover:bg-white/5 hover:text-white">
              Exit demo
            </button>
          </div>
        </header>

        <div className="mb-6 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-xs leading-5 text-amber-100/80">
          Demo mode: creator listings come from the marketplace. Checkout and campaign results are simulated and stored only in this browser tab. No real booking or payment is made.
        </div>

        {error && (
          <div role="alert" className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            <span>{error}</span>
            {error.includes('saved demo session is invalid') && <button type="button" onClick={restartDemo} className="shrink-0 underline">Restart demo</button>}
          </div>
        )}

        {view === 'channels' && (
          <section>
            <div className="mb-5 rounded-2xl border border-white/10 bg-gradient-to-br from-[#191919] to-[#111] p-5 sm:p-7">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-coral-text">Advertise on Yepper</p>
              <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Choose a creator</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">Explore YouTube and TikTok listings, review their booking options, and try a simulated checkout.</p>
              <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Filter demo creators by platform">
                {([
                  ['all', 'All creators'],
                  ['youtube', 'YouTube'],
                  ['tiktok', 'TikTok'],
                ] as const).map(([platform, label]) => {
                  const count = platform === 'all' ? channels.length : channels.filter((creator) => creator.provider === platform).length;
                  return (
                    <button key={platform} type="button" role="tab" aria-selected={platformFilter === platform} onClick={() => setPlatformFilter(platform)} className={`rounded-full border px-4 py-2 text-xs font-semibold ${platformFilter === platform ? 'border-white bg-white text-black' : 'border-white/10 bg-white/[0.04] text-white/65 hover:border-white/25'}`}>
                      {label}<span className={`ml-2 ${platformFilter === platform ? 'text-black/55' : 'text-white/40'}`}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {channelsLoading ? (
              <div className="rounded-2xl border border-white/10 px-5 py-12 text-center text-sm text-white/45">Loading demo marketplace…</div>
            ) : channels.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 px-5 py-12 text-center">
                <p className="text-sm font-semibold">No creator listings are available for the demo</p>
                <p className="mt-1 text-xs text-white/45">Add demo YouTube or TikTok listings in the admin panel, then reload this page.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {channels.filter((creator) => platformFilter === 'all' || creator.provider === platformFilter).map((creator) => (
                  <PlatformCreatorCard
                    key={`${creator.provider}-${creator.id}`}
                    creator={creator}
                    onClick={() => chooseChannel(creator)}
                    actionText={`Advertise on ${creator.provider === 'tiktok' ? 'TikTok' : 'YouTube'}`}
                    enablePartnerSelection={creator.isPartnerChannel === true}
                    className="w-full"
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {view === 'create' && selectedChannel?.provider !== 'tiktok' && selectedChannel && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0b0b0b] px-4 py-5 text-white sm:px-7 sm:py-7" role="dialog" aria-modal="true" aria-label="YouTube campaign setup">
            <div className="mx-auto max-w-6xl">
              <header className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
                <div><p className="text-sm font-bold">Yepper <span className="ml-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">Demo</span></p><p className="mt-1 text-[11px] text-white/45">YouTube advertiser experience</p></div>
                <button type="button" onClick={() => setView('channels')} aria-label="Close demo booking" className="rounded-full p-2 text-white/55 hover:bg-white/10 hover:text-white"><XMarkIcon className="h-5 w-5" /></button>
              </header>
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <StepPill active={false} complete>1 · Choose a channel</StepPill><ArrowRightIcon className="h-3 w-3 text-white/25" /><StepPill active>2 · Add your ad</StepPill><ArrowRightIcon className="h-3 w-3 text-white/25" /><StepPill active={false}>3 · Test payment</StepPill><ArrowRightIcon className="h-3 w-3 text-white/25" /><StepPill active={false}>4 · View results</StepPill>
              </div>
          <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <form onSubmit={continueToPayment} className="space-y-5 rounded-2xl border border-white/10 bg-[#141414] p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-coral-text">Campaign setup</p>
                  <h1 className="mt-1 text-xl font-bold">Advertise with {selectedChannelName}</h1>
                  <p className="mt-1 text-xs text-white/50">{selectedChannelAudience.toLocaleString()} subscribers · demo channel</p>
                </div>
                <button type="button" onClick={() => setView('channels')} className="shrink-0 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/65 hover:bg-white/5">Change channel</button>
              </div>

              <fieldset>
                <legend className="mb-2 text-xs font-bold text-white/80">Choose an advertising package</legend>
                <div className="space-y-2">
                  {PACKAGE_OPTIONS.map((option) => (
                    <label key={option.code} className={`flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-3 transition ${selectedPackage === option.code ? 'border-coral bg-coral/10' : 'border-white/10 hover:border-white/25'}`}>
                      <span className="flex gap-2.5">
                        <input type="radio" name="demo-package" checked={selectedPackage === option.code} onChange={() => setSelectedPackage(option.code)} className="mt-0.5 accent-[#e8472b]" />
                        <span><span className="block text-xs font-bold">{option.name}</span><span className="mt-1 block text-[11px] text-white/45">{option.summary}</span></span>
                      </span>
                      <span className="shrink-0 text-xs font-bold text-coral-text">{formatRwf(getPackagePrice(selectedChannelAudience, option.code))}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-semibold text-white/80">
                  Brand name
                  <input required maxLength={100} value={brandName} onChange={(event) => setBrandName(event.target.value)} placeholder="Your business" className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm font-normal text-white placeholder:text-white/30" />
                </label>
                <label className="text-xs font-semibold text-white/80">
                  Ad headline
                  <input required maxLength={120} value={headline} onChange={(event) => setHeadline(event.target.value)} placeholder="A short message for viewers" className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm font-normal text-white placeholder:text-white/30" />
                </label>
              </div>
              <label className="block text-xs font-semibold text-white/80">
                Ad description
                <textarea required maxLength={500} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Tell viewers what you are promoting" className="mt-1.5 w-full resize-y rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm font-normal text-white placeholder:text-white/30" />
              </label>
              <label className="block text-xs font-semibold text-white/80">
                Destination URL
                <input required type="url" pattern="https?://.+" value={destinationUrl} onChange={(event) => setDestinationUrl(event.target.value)} placeholder="https://example.com" className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm font-normal text-white placeholder:text-white/30" />
              </label>
              <label className="block text-xs font-semibold text-white/80">
                Ad creative image
                <input type="file" accept="image/*" onChange={(event) => void handleCreativeChange(event.target.files?.[0])} className="mt-1.5 block w-full cursor-pointer rounded-lg border border-white/10 bg-black/25 text-xs text-white/55 file:mr-3 file:border-0 file:bg-white/10 file:px-3 file:py-2.5 file:text-xs file:font-semibold file:text-white" />
                <span className="mt-1 block text-[10px] font-normal text-white/40">{creativeName || 'Choose an image up to 700 KB. Or use the sample creative.'}</span>
              </label>
              {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                <span className="text-sm font-bold">Total <span className="ml-2 text-coral-text">{formatRwf(amount)}</span></span>
                <button type="submit" className="rounded-lg bg-coral px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90">Continue to test payment</button>
              </div>
            </form>

            <aside className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-[#141414] p-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-white/50">Placement preview</p>
                <VideoPlacementPreview creativeImage={creativeImage} channelName={selectedChannelName} videoTitle={selectedVideoTitle} />
                <p className="mt-3 text-sm font-bold">{headline || 'Your ad headline'}</p>
                <p className="mt-1 text-xs leading-5 text-white/50">{description || 'Your ad description will appear here.'}</p>
              </div>
              <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04] p-4 text-xs leading-5 text-emerald-100/70">
                This preview uses a mock video. Your image and campaign details remain in this tab and are never uploaded.
              </div>
            </aside>
          </section>
            </div>
          </div>
        )}

        {view === 'create' && selectedChannel?.provider === 'tiktok' && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0b0b0b] px-4 py-5 text-white sm:px-7 sm:py-7" role="dialog" aria-modal="true" aria-label="TikTok campaign setup">
            <div className="mx-auto max-w-6xl">
              <header className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
                <div><p className="text-sm font-bold">Yepper <span className="ml-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">Demo</span></p><p className="mt-1 text-[11px] text-white/45">TikTok advertiser experience</p></div>
                <button type="button" onClick={() => setView('channels')} aria-label="Close demo booking" className="rounded-full p-2 text-white/55 hover:bg-white/10 hover:text-white"><XMarkIcon className="h-5 w-5" /></button>
              </header>
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <StepPill active={false} complete>1 · Choose a creator</StepPill><ArrowRightIcon className="h-3 w-3 text-white/25" /><StepPill active>2 · Book a sponsored post</StepPill><ArrowRightIcon className="h-3 w-3 text-white/25" /><StepPill active={false}>3 · Test payment</StepPill><ArrowRightIcon className="h-3 w-3 text-white/25" /><StepPill active={false}>4 · View results</StepPill>
              </div>
              <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
                <form onSubmit={continueToPayment} className="space-y-5 rounded-2xl border border-white/10 bg-[#141414] p-5 sm:p-6">
                  <div className="flex items-start gap-3">
                    {selectedChannel.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selectedChannel.avatar} alt="" className="h-12 w-12 rounded-full border border-white/15 object-cover" />
                    ) : <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#25F4EE]/15 font-bold">{selectedChannelName.replace(/^@/, '').slice(0, 1).toUpperCase() || 'T'}</div>}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase tracking-wide text-coral-text">TikTok creator</p>
                      <h1 className="mt-1 truncate text-xl font-bold">{selectedChannelName}</h1>
                      <p className="mt-1 text-xs text-white/50">{selectedChannelAudience.toLocaleString()} followers · {selectedChannel.totalViews.toLocaleString()} total views</p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-white/45">Typical publishing pace</p><p className="mt-2 text-lg font-bold">{selectedChannel.tiktokProfile?.postsPerWeek ?? '—'} <span className="text-xs font-medium text-white/50">posts / week</span></p></div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-white/45">Sponsored capacity</p><p className="mt-2 text-lg font-bold">{selectedChannel.tiktokProfile?.sponsoredPostsPerMonth ?? '—'} <span className="text-xs font-medium text-white/50">posts / month</span></p></div>
                  </div>
                  <p className="text-[11px] leading-5 text-white/45">Audience and creator details match the marketplace. A demo slot is always available; booking and payment are simulated and will not contact the creator.</p>

                  <label className="block text-xs font-semibold text-white/80">
                    Commitment period
                    <select value={tiktokCommitmentMonths} onChange={(event) => { setTiktokQuote(null); setTiktokQuoteError(''); setTiktokCommitmentMonths(Number(event.target.value)); }} className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm font-normal text-white">
                      <option value={1}>1 month · no discount</option>
                      <option value={3}>3 months · 5% off</option>
                      <option value={6}>6 months · 10% off</option>
                    </select>
                  </label>

                  <fieldset className="space-y-2">
                    <legend className="text-xs font-semibold text-white/80">Available packages</legend>
                    {!tiktokQuote ? (
                      <p className="rounded-lg border border-white/10 px-3 py-4 text-xs text-white/50">{tiktokQuoteError || 'Calculating package prices…'}</p>
                    ) : tiktokQuote.packages.map((item) => (
                      <label key={item.code} className={`flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-3 transition-colors ${tiktokPackageCode === item.code ? 'border-emerald-400 bg-emerald-400/5' : 'border-white/10 bg-white/[0.02]'}`}>
                        <span className="flex min-w-0 items-start gap-2">
                          <input type="radio" name={`demo-tiktok-package-${selectedChannel.id}`} checked={tiktokPackageCode === item.code} onChange={() => { setTiktokPackageCode(item.code); if (item.code !== 'advertiser_image_post') setTiktokCreative(null); }} className="mt-0.5 accent-emerald-500" />
                          <span className="min-w-0"><span className="block text-xs font-semibold">{item.name}</span><span className="mt-1 block text-[10px] text-white/45">{item.description}</span></span>
                        </span>
                        <span className="shrink-0 text-right text-xs font-bold text-emerald-300">{formatRwf(item.amount)}<span className="mt-0.5 block text-[10px] font-normal text-white/45">{formatRwf(item.monthlyPrice)} / month</span></span>
                      </label>
                    ))}
                    {tiktokQuoteError && <p role="alert" className="text-xs text-rose-300">{tiktokQuoteError}</p>}
                  </fieldset>

                  <label className="block text-xs font-semibold text-white/80">
                    Brand name
                    <input required maxLength={160} value={brandName} onChange={(event) => setBrandName(event.target.value)} placeholder="Your brand" className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm font-normal text-white placeholder:text-white/30" />
                  </label>
                  <label className="block text-xs font-semibold text-white/80">
                    Creator brief <span className="font-normal text-white/45">(optional)</span>
                    <textarea maxLength={2000} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Key message, required mention, or product details" className="mt-1.5 w-full resize-y rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm font-normal text-white placeholder:text-white/30" />
                  </label>
                  {tiktokPackageCode === 'advertiser_image_post' && (
                    <label className="block text-xs font-semibold text-white/80">
                      Image to publish
                      <input required type="file" accept="image/*" onChange={(event) => handleTikTokCreativeChange(event.target.files?.[0])} className="mt-1.5 block w-full cursor-pointer rounded-lg border border-white/10 bg-black/25 text-xs text-white/55 file:mr-3 file:border-0 file:bg-white/10 file:px-3 file:py-2.5 file:text-xs file:font-semibold file:text-white" />
                      <span className="mt-1 block text-[10px] font-normal text-white/40">{tiktokCreative ? `${tiktokCreative.name} · ${(tiktokCreative.size / 1024 / 1024).toFixed(1)} MB` : 'Required for this package. Image limit: 5 MB.'}</span>
                    </label>
                  )}
                  <label className="block text-xs font-semibold text-white/80">
                    Destination URL <span className="font-normal text-white/45">(optional)</span>
                    <input type="url" value={destinationUrl} onChange={(event) => setDestinationUrl(event.target.value)} placeholder="https://brand.example/product" className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm font-normal text-white placeholder:text-white/30" />
                  </label>
                  {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                    <span className="text-sm font-bold">Total <span className="ml-2 text-emerald-300">{selectedTikTokPackage ? formatRwf(selectedTikTokPackage.amount) : '—'}</span></span>
                    <button type="submit" disabled={!selectedTikTokPackage || !tiktokQuote || !tiktokQuote.remainingCapacity} className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Continue to test payment</button>
                  </div>
                </form>

                <aside className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-[#141414] p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-white/50">Your TikTok campaigns</p>
                    <p className="mt-1 text-[11px] text-white/40">Demo bookings appear here after simulated checkout.</p>
                    <div className="mt-4 space-y-2">
                      {(session?.campaigns.filter((campaign) => campaign.provider === 'tiktok' && campaign.creatorId === String(selectedChannel.id)) ?? []).map((campaign) => (
                        <div key={campaign.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                          <div className="flex items-start justify-between gap-2"><p className="text-xs font-bold">{campaign.brandName}</p><span className="text-[10px] text-emerald-300">Demo</span></div>
                          <p className="mt-1 text-[10px] text-white/50">{campaign.commitmentMonths} month{campaign.commitmentMonths === 1 ? '' : 's'} · {formatRwf(campaign.amount)}</p>
                          <div className="mt-2 flex gap-3 text-[10px] text-white/45"><span>{campaign.views.toLocaleString()} views</span><span>{campaign.clicks.toLocaleString()} clicks</span></div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.05] p-4 text-xs leading-5 text-amber-100/70">
                    You will not be charged. Demo checkout creates only a sample campaign in this browser session.
                  </div>
                </aside>
              </div>
            </div>
          </div>
        )}

        {view === 'payment' && selectedChannel && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0b0b0b] px-4 py-5 text-white sm:px-7 sm:py-7" role="dialog" aria-modal="true" aria-label="Demo checkout">
          <div className="mx-auto max-w-6xl">
            <header className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
              <div><p className="text-sm font-bold">Yepper <span className="ml-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">Demo</span></p><p className="mt-1 text-[11px] text-white/45">Test checkout</p></div>
              <button type="button" onClick={() => setView('channels')} aria-label="Close demo checkout" className="rounded-full p-2 text-white/55 hover:bg-white/10 hover:text-white"><XMarkIcon className="h-5 w-5" /></button>
            </header>
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <StepPill active={false} complete>1 · Choose a creator</StepPill><ArrowRightIcon className="h-3 w-3 text-white/25" /><StepPill active={false} complete>2 · Add your ad</StepPill><ArrowRightIcon className="h-3 w-3 text-white/25" /><StepPill active>3 · Test payment</StepPill><ArrowRightIcon className="h-3 w-3 text-white/25" /><StepPill active={false}>4 · View results</StepPill>
            </div>
          <section className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-[1fr_0.85fr]">
            <div className="rounded-2xl border border-white/10 bg-[#141414] p-5 sm:p-6">
              <p className="text-xs font-bold uppercase tracking-wide text-coral-text">Test checkout</p>
              <h1 className="mt-1 text-xl font-bold">Review your campaign</h1>
              <div className="mt-5 space-y-3 rounded-xl border border-white/10 bg-black/20 p-4 text-sm">
                <div className="flex justify-between gap-3"><span className="text-white/50">Channel</span><span className="text-right font-semibold">{selectedChannelName}</span></div>
                <div className="flex justify-between gap-3"><span className="text-white/50">Campaign</span><span className="text-right font-semibold">{selectedChannel.provider === 'tiktok' ? brandName : `${brandName}: ${headline}`}</span></div>
                <div className="flex justify-between gap-3"><span className="text-white/50">Package</span><span className="text-right font-semibold">{selectedPackageName}</span></div>
                <div className="flex justify-between gap-3 border-t border-white/10 pt-3"><span className="font-bold">Total (demo)</span><span className="font-bold text-coral-text">{formatRwf(amount)}</span></div>
              </div>

              <fieldset className="mt-5">
                <legend className="mb-2 text-xs font-bold text-white/80">Choose a test payment method</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {([
                    ['mobile_money', 'Mobile money (test)'],
                    ['card', 'Card (test)'],
                  ] as const).map(([method, label]) => (
                    <label key={method} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-xs font-semibold ${paymentMethod === method ? 'border-coral bg-coral/10' : 'border-white/10'}`}>
                      <input type="radio" name="demo-payment" checked={paymentMethod === method} onChange={() => setPaymentMethod(method)} className="accent-[#e8472b]" />
                      <CreditCardIcon className="h-4 w-4 text-white/55" />{label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="mt-5 rounded-xl border border-amber-400/15 bg-amber-400/[0.05] p-3 text-xs leading-5 text-amber-100/70">
                This is a safe simulation. Do not enter card numbers, PINs, or mobile money details. Clicking below records a demo-only successful payment in this tab.
              </div>
              {error && <p role="alert" className="mt-3 text-xs text-rose-300">{error}</p>}
              <div className="mt-5 flex flex-wrap justify-between gap-3">
                <button type="button" onClick={() => setView('create')} className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/5">Back to ad</button>
                <button type="button" disabled={busy || !session} onClick={() => void completeDemoPayment()} className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">
                  {busy ? 'Completing…' : `Simulate successful payment · ${formatRwf(amount)}`}
                </button>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#141414] p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-white/50">You are paying for</p>
              <div className="mt-4"><VideoPlacementPreview creativeImage={creativeImage} channelName={selectedChannelName} videoTitle={selectedVideoTitle} provider={selectedChannel.provider === 'tiktok' ? 'tiktok' : 'youtube'} /></div>
              <p className="mt-3 text-sm font-bold">{selectedChannel.provider === 'tiktok' ? brandName : `${brandName} · ${headline}`}</p>
              <p className="mt-1 text-xs text-white/45">{selectedVideoTitle}</p>
              <div className="mt-4 flex items-center gap-2 text-xs text-emerald-300"><CheckCircleIcon className="h-4 w-4" />No real payment processor is connected</div>
            </div>
          </section>
          </div>
          </div>
        )}

        {view === 'ads' && (
          <section>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-coral-text">Demo campaigns</p><h1 className="mt-2 text-2xl font-bold">My ads</h1><p className="mt-1 text-sm text-white/50">Campaigns and performance reports from this tab only.</p></div>
              <button type="button" onClick={() => setView('channels')} className="rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-black hover:bg-white/90">Create a demo ad</button>
            </div>
            {!session?.campaigns.length ? (
              <div className="rounded-2xl border border-dashed border-white/15 px-5 py-14 text-center">
                <FilmIcon className="mx-auto h-8 w-8 text-white/30" />
                <p className="mt-3 text-sm font-semibold">No demo campaigns yet</p>
                <p className="mt-1 text-xs text-white/45">Choose a YouTube channel or TikTok creator to create your first campaign.</p>
                <button type="button" onClick={() => setView('channels')} className="mt-4 rounded-lg bg-white px-4 py-2 text-xs font-bold text-black">Browse channels</button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {session.campaigns.map((campaign) => (
                  <article key={campaign.id} className="overflow-hidden rounded-2xl border border-white/10 bg-[#141414]">
                    <div className="relative aspect-video bg-black">
                      {campaign.provider === 'tiktok' ? (
                        <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-[#1b1018] via-[#111] to-[#092126]">
                          <span className="text-2xl font-bold text-white">♪</span>
                          <span className="mt-2 text-[10px] font-bold uppercase tracking-wider text-white/60">TikTok campaign</span>
                        </div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={campaign.creativeImage} alt={`${campaign.brandName} ad creative`} className="h-full w-full object-cover" />
                      )}
                      <span className="absolute left-3 top-3 rounded-full bg-amber-400/90 px-2 py-1 text-[9px] font-bold uppercase text-black">Demo</span>
                    </div>
                    <div className="p-4">
                      <p className="text-xs text-white/45">{campaign.provider === 'tiktok' ? 'TikTok' : 'YouTube'} · {campaign.channelName} · {campaign.packageName}</p>
                      <h2 className="mt-1 truncate text-sm font-bold">{campaign.headline}</h2>
                      <div className="mt-3 flex items-center gap-4 text-xs text-white/60"><span className="inline-flex items-center gap-1"><EyeIcon className="h-3.5 w-3.5" />{campaign.views.toLocaleString()}</span><span>{formatRwf(campaign.amount)}</span></div>
                      <p className="mt-2 text-[10px] text-emerald-300/75">Simulated {campaign.paymentMethod === 'mobile_money' ? 'mobile money' : 'card'} payment · Demo</p>
                      <button type="button" onClick={() => openReport(campaign)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2.5 text-xs font-bold hover:bg-white/5">View full report <ArrowRightIcon className="h-3.5 w-3.5" /></button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {view === 'report' && selectedReport && (
          <section>
            <button type="button" onClick={() => setView('ads')} className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/65 hover:bg-white/5"><ArrowLeftIcon className="h-3.5 w-3.5" />Back to My ads</button>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-coral-text">Simulated campaign report</p><h1 className="mt-2 text-2xl font-bold">{selectedReport.headline}</h1><p className="mt-1 text-sm text-white/50">{selectedReport.provider === 'tiktok' ? 'TikTok' : 'YouTube'} · {selectedReport.brandName} · {selectedReport.channelName} · {selectedReport.packageName}{selectedReport.commitmentMonths ? ` · ${selectedReport.commitmentMonths} month${selectedReport.commitmentMonths === 1 ? '' : 's'}` : ''}</p></div>
              <span className="rounded-full bg-amber-400/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">Demo results</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label={selectedReport.provider === 'tiktok' ? 'TikTok views' : 'Video views'} value={selectedReport.views.toLocaleString()} icon={EyeIcon} />
              <MetricCard label="Likes" value={selectedReport.likes.toLocaleString()} icon={CheckCircleIcon} />
              <MetricCard label="Comments" value={selectedReport.comments.toLocaleString()} icon={ChartBarIcon} />
              <MetricCard label="Ad clicks" value={selectedReport.clicks.toLocaleString()} icon={ArrowRightIcon} />
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-5">
                <div className="rounded-2xl border border-white/10 bg-[#141414] p-4 sm:p-5">
                  <h2 className="mb-3 text-sm font-bold">{selectedReport.provider === 'tiktok' ? 'Sponsored TikTok post' : 'Ad in the demo video'}</h2>
                  <VideoPlacementPreview creativeImage={selectedReport.creativeImage} channelName={selectedReport.channelName} videoTitle={selectedReport.videoTitle} provider={selectedReport.provider === 'tiktok' ? 'tiktok' : 'youtube'} />
                  <p className="mt-3 text-sm font-semibold">{selectedReport.brandName}{selectedReport.provider === 'tiktok' ? '' : ` · ${selectedReport.headline}`}</p>
                  <p className="mt-1 text-xs leading-5 text-white/50">{selectedReport.description}</p>
                  {selectedReport.destinationUrl && <p className="mt-3 text-xs text-white/40">Destination: {selectedReport.destinationUrl}</p>}
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#141414] p-4 sm:p-5">
                  <h2 className="flex items-center gap-2 text-sm font-bold"><ChartBarIcon className="h-4 w-4 text-coral-text" />Views over the last 7 days</h2>
                  <div className="mt-5 flex h-28 items-end gap-2">
                    {[36, 52, 44, 71, 58, 84, 100].map((height, index) => (
                      <div key={index} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                        <div className="w-full max-w-10 rounded-t bg-gradient-to-t from-coral to-orange-300" style={{ height: `${height}%` }} />
                        <span className="text-[9px] text-white/40">{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] text-white/35">Illustrative trend; not live traffic.</p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-2xl border border-white/10 bg-[#141414] p-4 sm:p-5">
                  <h2 className="text-sm font-bold">Audience overview</h2>
                  <p className="mt-1 text-xs text-white/45">Sample audience breakdown for this fictional campaign.</p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white/[0.04] p-3"><div className="flex items-center gap-1.5 text-[10px] text-white/45"><UsersIcon className="h-3.5 w-3.5" />Unique viewers</div><p className="mt-1 text-lg font-bold">2,316</p></div>
                    <div className="rounded-xl bg-white/[0.04] p-3"><div className="flex items-center gap-1.5 text-[10px] text-white/45"><MapPinIcon className="h-3.5 w-3.5" />Top location</div><p className="mt-1 text-lg font-bold">Rwanda</p></div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {[['Rwanda', 52], ['Kenya', 21], ['Uganda', 15], ['Tanzania', 12]].map(([country, share]) => (
                      <div key={country} className="grid grid-cols-[78px_1fr_34px] items-center gap-2 text-[10px]">
                        <span className="text-white/65">{country}</span><span className="h-1.5 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-sky-400" style={{ width: `${share}%` }} /></span><span className="text-right text-white/40">{share}%</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 border-t border-white/10 pt-3 text-xs text-white/50">
                    <p className="mb-2 font-semibold text-white/70">Devices</p>
                    <div className="flex justify-between"><span>Mobile</span><span>68%</span></div>
                    <div className="mt-1 flex justify-between"><span>Desktop</span><span>24%</span></div>
                    <div className="mt-1 flex justify-between"><span>Tablet</span><span>8%</span></div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#141414]">
                  <div className="border-b border-white/10 px-4 py-3">
                    <h2 className="text-sm font-bold">Sample viewer sessions</h2>
                    <p className="mt-1 text-[10px] text-white/45">Showing {selectedReport.viewers.length} anonymous examples from {selectedReport.views.toLocaleString()} simulated views.</p>
                  </div>
                  <div className="max-h-72 overflow-auto">
                    <table className="w-full text-left text-[10px]">
                      <thead className="sticky top-0 bg-[#181818] text-white/40"><tr><th className="px-3 py-2 font-semibold">Viewer</th><th className="px-3 py-2 font-semibold">Location</th><th className="px-3 py-2 font-semibold">Device</th><th className="px-3 py-2 font-semibold">Watched</th><th className="px-3 py-2 font-semibold">Viewed at</th></tr></thead>
                      <tbody>
                        {selectedReport.viewers.map((viewer) => (
                          <tr key={viewer.id} className="border-t border-white/5 text-white/65">
                            <td className="px-3 py-2.5 font-mono">{viewer.id}</td>
                            <td className="px-3 py-2.5">{viewer.city}, {viewer.country}</td>
                            <td className="px-3 py-2.5">{viewer.device}</td>
                            <td className="px-3 py-2.5">{viewer.watchTime}</td>
                            <td className="whitespace-nowrap px-3 py-2.5">{new Date(viewer.viewedAt).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-2 rounded-xl border border-amber-400/15 bg-amber-400/[0.05] px-4 py-3 text-xs leading-5 text-amber-100/70">
              <XMarkIcon className="h-4 w-4 shrink-0" />
              All views, engagement, audience breakdowns, and viewer sessions above are generated examples. No real people watched this ad.
            </div>
          </section>
        )}

        {view === 'report' && !selectedReport && (
          <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center">
            <p className="text-sm text-white/55">Select a campaign from My ads to view its report.</p>
            <button type="button" onClick={() => setView('ads')} className="mt-3 text-xs font-bold text-coral-text">Open My ads</button>
          </div>
        )}

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-[10px] text-white/35">
          <span>Private demo · browser-session storage only · no real bookings or payments</span>
          {view !== 'ads' && view !== 'report' && <button type="button" onClick={() => setView('ads')} className="font-semibold text-white/55 hover:text-white">Go to My ads</button>}
        </footer>
      </div>
        </div>
      </div>
    </main>
  );
}
