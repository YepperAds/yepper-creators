'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Info,
  Check,
  X,
  Monitor,
  Smartphone,
  Sidebar as SidebarIcon,
  Layers,
  PanelRight,
  PanelLeft,
  AlignJustify,
  PanelBottom,
  PieChart,
  Layout,
  Maximize,
  Search,
  Play,
  Film,
  Pause,
} from 'lucide-react';
import { Button, Grid, Input, TextArea } from '@/app/(adsense)/components/components';
import PricingTiers from './PricingTiers';
import CategoryInfoModal from './CategoryInfoModal';
import api from '@/app/_lib/adsense-api';
import { useSession } from '@/app/_hooks/useSession';

// ─── Types ───────────────────────────────────────────────────────────────────

interface GscData {
  connected: boolean;
  siteMatched: boolean;
  summary?: { clicks: number };
}

interface GrantDisplay {
  grantedTraffic: number;
  trafficTier: string;
}

interface CategoryDataEntry {
  price?: number;
  tier?: string;
  visitorRange?: { min: number; max: number };
  userCount?: string;
  instructions?: string;
  targetPath?: string | null;
}

// Only these two are truly position-independent (position:fixed, appended
// straight to the page) — every other spaceType already ships as a
// precise-placement iframe the owner pastes exactly where they want it (see
// codeDisplay.tsx). Floating/Modal instead default to a single site-wide
// script that fires on every page, so they're the only types where it's
// worth picking a specific registered page (or "All Pages") — the site-wide
// script matches that page's path against location.pathname itself, no
// snippet to paste on that page at all.
const PAGE_SCOPED_TYPES = ['floating', 'modalpic'];

interface CategoryDetail {
  name: string;
  icon: React.ReactNode;
  infoIcon: React.ReactNode;
  spaceType: string;
  description: string;
  category: string;
  position: string;
  image: string;
}

interface AddNewCategoryProps {
  websiteId?: string;
  onSubmitSuccess: () => void;
  monthlyTraffic?: number | null;
  gscData?: GscData;
  onSuccess?: () => void;
  onCancel?: () => void;
  websitePages?: { label: string; path: string }[];
}

// ─── Image imports ────────────────────────────────────────────────────────────

import AboveTheFold      from '../img/aboveTheFold.png';
import BeneathTitle      from '../img/beneathTitle.png';
import Bottom            from '../img/bottom.png';
import Floating          from '../img/floating.png';
import HeaderPic         from '../img/header.png';
import InFeed            from '../img/inFeed.png';
import InlineContent     from '../img/inlineContent.png';
import LeftRail          from '../img/leftRail.png';
import MobileInterstial  from '../img/mobileInterstitial.png';
import ModalPic          from '../img/modal.png';
import Overlay           from '../img/overlay.png';
import ProFooter         from '../img/proFooter.png';
import RightRail         from '../img/rightRail.png';
import Sidebar           from '../img/sidebar.png';
import StickySidebar     from '../img/stickySidebar.png';
import PrerollPic        from '../img/preroll.png';
import MidrollPic        from '../img/midroll.png';
import PausePic          from '../img/pauseAd.png';

// ─── Component ───────────────────────────────────────────────────────────────

const AddNewCategory: React.FC<AddNewCategoryProps> = ({
  websiteId: websiteIdProp,
  onSubmitSuccess,
  monthlyTraffic: trafficProp = null,
  gscData,
  onSuccess,
  onCancel,
  websitePages = [],
}) => {
  const params = useParams();
  const router = useRouter();

  // ── Auth ──────────────────────────────────────────────────────────────────
  // Use the shared session hook — no more localStorage.getItem('token')
  const { user, isAuthenticated, token } = useSession();

  // websiteId from prop takes priority; fall back to route param
  const websiteId = (websiteIdProp ?? (params?.websiteId as string) ?? '') as string;

  // ── State ─────────────────────────────────────────────────────────────────

  const [websiteMonthlyTraffic, setWebsiteMonthlyTraffic] = useState<number | null>(trafficProp);
  const [grantDisplay, setGrantDisplay]       = useState<GrantDisplay | null>(null);
  const [selectedCategories, setSelectedCategories]   = useState<Record<string, boolean>>({});
  const [categoryData, setCategoryData]       = useState<Record<string, CategoryDataEntry>>({});
  const [activeCategory, setActiveCategory]   = useState<string | null>(null);
  const [completedCategories, setCompletedCategories] = useState<string[]>([]);
  const [activeInfoModal, setActiveInfoModal] = useState<string | null>(null);
  const [searchTerm, setSearchTerm]           = useState('');
  const [activeFilter, setActiveFilter]       = useState('all');
  const [showFullImage, setShowFullImage]     = useState(false);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const isCategoryDataEmpty = (category: string) => {
    const data = categoryData[category];
    return !data || (!data.price && !data.userCount && !data.instructions);
  };

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!websiteId || !token) return;
    const fetchTrafficAndGrant = async () => {
      try {
        const analyticsRes = await api.get(`/api/analytics/${websiteId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if ((analyticsRes.data as any)?.grantDisplay) {
          const grant: GrantDisplay = (analyticsRes.data as any).grantDisplay;
          setGrantDisplay(grant);
          setWebsiteMonthlyTraffic(grant.grantedTraffic);
        } else if (!websiteMonthlyTraffic) {
          const siteRes = await api.get(`/api/createWebsite/website/${websiteId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if ((siteRes.data as any)?.monthlyTraffic) {
            setWebsiteMonthlyTraffic((siteRes.data as any).monthlyTraffic);
          }
        }
      } catch (err) {
        console.error('Failed to fetch website traffic/grant:', err);
      }
    };
    fetchTrafficAndGrant();
  }, [websiteId, token]); // eslint-disable-line

  useEffect(() => {
    completedCategories.forEach((category) => {
      if (isCategoryDataEmpty(category)) {
        setCompletedCategories((prev) => prev.filter((c) => c !== category));
      }
    });
  }, [categoryData]); // eslint-disable-line

  // ── Category definitions ─────────────────────────────────────────────────

  const categoryDetails = useMemo<Record<string, CategoryDetail>>(() => ({
    aboveTheFold: {
      name: 'Above the Fold', icon: <Layers className="w-6 h-6" />,
      infoIcon: <Info className="w-5 h-5 text-blue cursor-pointer" />,
      spaceType: 'Above The Fold', description: 'Prime visibility area at the top of webpage before scrolling',
      category: 'primary', position: 'top', image: AboveTheFold.src,
    },
    beneathTitle: {
      name: 'Beneath Title', icon: <AlignJustify className="w-6 h-6" />,
      infoIcon: <Info className="w-5 h-5 text-blue cursor-pointer" />,
      spaceType: 'Beneath Title', description: 'Ad space directly below the page title',
      category: 'content', position: 'top', image: BeneathTitle.src,
    },
    bottom: {
      name: 'Bottom', icon: <PanelBottom className="w-6 h-6" />,
      infoIcon: <Info className="w-5 h-5 text-blue cursor-pointer" />,
      spaceType: 'Bottom', description: 'Ad placement at the bottom of the webpage',
      category: 'secondary', position: 'bottom', image: Bottom.src,
    },
    floating: {
      name: 'Floating', icon: <Maximize className="w-6 h-6" />,
      infoIcon: <Info className="w-5 h-5 text-blue cursor-pointer" />,
      spaceType: 'Floating', description: 'Ads that float over page content, follows user scrolling',
      category: 'special', position: 'overlay', image: Floating.src,
    },
    HeaderPic: {
      name: 'Header', icon: <Monitor className="w-6 h-6" />,
      infoIcon: <Info className="w-5 h-5 text-blue cursor-pointer" />,
      spaceType: 'Header', description: 'Banner ad space in the header section of the website',
      category: 'primary', position: 'top', image: HeaderPic.src,
    },
    inFeed: {
      name: 'In Feed', icon: <Layout className="w-6 h-6" />,
      infoIcon: <Info className="w-5 h-5 text-blue cursor-pointer" />,
      spaceType: 'In Feed', description: 'Native ad placement within content feeds',
      category: 'content', position: 'middle', image: InFeed.src,
    },
    inlineContent: {
      name: 'Inline Content', icon: <AlignJustify className="w-6 h-6" />,
      infoIcon: <Info className="w-5 h-5 text-blue cursor-pointer" />,
      spaceType: 'Inline Content', description: 'Ad placement directly within article text',
      category: 'content', position: 'middle', image: InlineContent.src,
    },
    leftRail: {
      name: 'Left Rail', icon: <PanelLeft className="w-6 h-6" />,
      infoIcon: <Info className="w-5 h-5 text-blue cursor-pointer" />,
      spaceType: 'Left Rail', description: 'Ad space along the left side of the webpage',
      category: 'sidebar', position: 'left', image: LeftRail.src,
    },
    mobileInterstial: {
      name: 'Mobile Interstitial', icon: <Smartphone className="w-6 h-6" />,
      infoIcon: <Info className="w-5 h-5 text-blue cursor-pointer" />,
      spaceType: 'Mobile Interstitial', description: 'Full-screen mobile ads that appear between content',
      category: 'mobile', position: 'overlay', image: MobileInterstial.src,
    },
    modalPic: {
      name: 'Modal', icon: <Info className="w-6 h-6" />,
      infoIcon: <Info className="w-5 h-5 text-blue cursor-pointer" />,
      spaceType: 'modalPic', description: 'Pop-up ad that appears in a modal window',
      category: 'special', position: 'overlay', image: ModalPic.src,
    },
    overlay: {
      name: 'Overlay', icon: <Layers className="w-6 h-6" />,
      infoIcon: <Info className="w-5 h-5 text-blue cursor-pointer" />,
      spaceType: 'overlay', description: 'Ad that overlays on top of page content',
      category: 'special', position: 'overlay', image: Overlay.src,
    },
    proFooter: {
      name: 'Pro Footer', icon: <PanelBottom className="w-6 h-6" />,
      infoIcon: <Info className="w-5 h-5 text-blue cursor-pointer" />,
      spaceType: 'proFooter', description: 'Premium ad space in the footer section',
      category: 'secondary', position: 'bottom', image: ProFooter.src,
    },
    rightRail: {
      name: 'Right Rail', icon: <PanelRight className="w-6 h-6" />,
      infoIcon: <Info className="w-5 h-5 text-blue cursor-pointer" />,
      spaceType: 'rightRail', description: 'Ad space along the right side of the webpage',
      category: 'sidebar', position: 'right', image: RightRail.src,
    },
    sidebar: {
      name: 'Sidebar', icon: <SidebarIcon className="w-6 h-6" />,
      infoIcon: <Info className="w-5 h-5 text-blue cursor-pointer" />,
      spaceType: 'sidebar', description: 'Ad placement in the website sidebar',
      category: 'sidebar', position: 'side', image: Sidebar.src,
    },
    stickySidebar: {
      name: 'Sticky Sidebar', icon: <PieChart className="w-6 h-6" />,
      infoIcon: <Info className="w-5 h-5 text-blue cursor-pointer" />,
      spaceType: 'stickySidebar', description: 'Sidebar ad that stays visible as user scrolls',
      category: 'sidebar', position: 'side', image: StickySidebar.src,
    },
    preroll: {
      name: 'Pre-roll', icon: <Play className="w-6 h-6" />,
      infoIcon: <Info className="w-5 h-5 text-blue cursor-pointer" />,
      spaceType: 'Pre-roll', description: 'Video ad that plays before the content starts',
      category: 'video', position: 'video', image: PrerollPic.src,
    },
    midroll: {
      name: 'Mid-roll', icon: <Film className="w-6 h-6" />,
      infoIcon: <Info className="w-5 h-5 text-blue cursor-pointer" />,
      spaceType: 'Mid-roll', description: 'Video ad that plays inside the content (content → ad → content)',
      category: 'video', position: 'video', image: MidrollPic.src,
    },
    pause: {
      name: 'Pause', icon: <Pause className="w-6 h-6" />,
      infoIcon: <Info className="w-5 h-5 text-blue cursor-pointer" />,
      spaceType: 'Pause', description: 'Ad that appears when the viewer pauses the video',
      category: 'video', position: 'video', image: PausePic.src,
    },
  }), []);

  const filteredCategories = useMemo(() => {
    return Object.entries(categoryDetails).filter(([, value]) => {
      const matchesSearch =
        value.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        value.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = activeFilter === 'all' || value.category === activeFilter;
      return matchesSearch && matchesFilter;
    });
  }, [categoryDetails, searchTerm, activeFilter]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleCategorySelect = (category: string) => {
    setActiveCategory(category);
    setShowFullImage(false);
    if (!selectedCategories[category]) {
      setSelectedCategories((prev) => ({ ...prev, [category]: true }));
    }
  };

  const handleCloseModal = () => {
    setActiveCategory(null);
    setShowFullImage(false);
  };

  const updateCategoryData = (category: string, field: string, value: unknown) => {
    if (field === 'price') {
      const v = value as { price: number; tier: string; visitorRange: { min: number; max: number } };
      setCategoryData((prev) => ({
        ...prev,
        [category]: { ...prev[category], price: v.price, tier: v.tier, visitorRange: v.visitorRange },
      }));
    } else {
      setCategoryData((prev) => ({
        ...prev,
        [category]: { ...prev[category], [field]: value },
      }));
    }
  };

  const handleNext = () => {
    if (activeCategory && !isCategoryDataEmpty(activeCategory)) {
      setCompletedCategories((prev) =>
        prev.includes(activeCategory) ? prev : [...prev, activeCategory]
      );
    }
    setActiveCategory(null);
  };

  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError('');

    const categoriesToSubmit = Object.entries(selectedCategories)
      .filter(([category]) => completedCategories.includes(category))
      .map(([category]) => ({
        ownerId: (user as any)?.id || (user as any)?._id,
        websiteId,
        categoryName: category.charAt(0).toUpperCase() + category.slice(1),
        price: categoryData[category]?.price || 0,
        description: categoryDetails[category]?.description || '',
        spaceType: categoryDetails[category]?.spaceType,
        userCount: parseInt(categoryData[category]?.userCount ?? '0') || 0,
        instructions: categoryData[category]?.instructions || '',
        customAttributes: {},
        webOwnerEmail: (user as any)?.email,
        visitorRange: categoryData[category]?.visitorRange || { min: 0, max: 10000 },
        tier: categoryData[category]?.tier || 'starter',
        targetPath: PAGE_SCOPED_TYPES.includes((categoryDetails[category]?.spaceType || '').toLowerCase())
          ? (categoryData[category]?.targetPath || null)
          : undefined,
      }));

    if (categoriesToSubmit.length === 0) {
      setSubmitError('Please configure at least one ad space before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      await Promise.all(
        categoriesToSubmit.map((category) =>
          api.post('/api/ad-categories', category, {
            headers: { Authorization: `Bearer ${token}` },
          })
        )
      );
      onSubmitSuccess?.();
      onSuccess?.();
    } catch (error: unknown) {
      if ((error as any)?.response?.status === 401) {
        router.push('/login');
      } else {
        setSubmitError(
          (error as any)?.response?.data?.message ||
          (error as any)?.response?.data?.error ||
          (error as any)?.message ||
          'Failed to create ad space. Please try again.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Category modal ────────────────────────────────────────────────────────

  const renderCategoryModal = () => {
    if (!activeCategory) return null;
    const details = categoryDetails[activeCategory];

    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
        <div className="bg-surface-1 border border-border rounded-2xl max-w-7xl w-full max-h-[90vh] overflow-y-auto">

          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-surface-3 border border-border rounded-xl text-white">
                {details.icon}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">{details.name}</h2>
                <p className="text-sm text-muted capitalize">{details.category} · {details.position}</p>
              </div>
            </div>
            <button
              onClick={handleCloseModal}
              className="p-2 hover:bg-surface-3 border border-border rounded-lg text-muted hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {showFullImage ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-white">Preview Image</h3>
                  <Button variant="outline" onClick={() => setShowFullImage(false)} size="sm">
                    Back to Details
                  </Button>
                </div>
                <div className="flex justify-center">
                  <img
                    src={details.image}
                    alt={`${details.name} full preview`}
                    className="max-w-full max-h-[70vh] border border-border rounded-xl object-contain"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Left — inputs */}
                <div className="space-y-6">
                  <PricingTiers
                    selectedPrice={categoryData[activeCategory] || {}}
                    onPriceSelect={(price: unknown) => updateCategoryData(activeCategory, 'price', price)}
                    monthlyTraffic={websiteMonthlyTraffic}
                    spaceType={categoryDetails[activeCategory]?.spaceType}
                    gscData={grantDisplay ? undefined : gscData}
                    grantedTier={grantDisplay?.trafficTier || null}
                  />

                  <div className="space-y-5">
                    {PAGE_SCOPED_TYPES.includes((details.spaceType || '').toLowerCase()) && (
                      <div>
                        <label className="block text-sm font-medium text-subtle mb-1.5">
                          Where should this ad appear?
                        </label>
                        {websitePages.length > 0 ? (
                          <select
                            value={categoryData[activeCategory]?.targetPath || ''}
                            onChange={(e) => updateCategoryData(activeCategory, 'targetPath', e.target.value || null)}
                            className="w-full bg-surface-1 border border-border rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-white/40"
                          >
                            <option value="">All Pages — shows on every page</option>
                            {websitePages.map((p) => (
                              <option key={p.path} value={p.path}>{p.label} ({p.path})</option>
                            ))}
                          </select>
                        ) : (
                          <p className="text-xs text-muted rounded-xl border border-dashed border-border bg-surface-1 px-3 py-2.5">
                            Defaults to <strong className="text-subtle">All Pages</strong>. Register your site's pages
                            (in the Website Pages panel above the ad space list) to target this at one specific page instead.
                          </p>
                        )}
                        <p className="text-xs text-muted mt-1.5">
                          You'll still paste a small placeholder div on that page (see Integration Codes after saving) —
                          this just tells the system which page to expect it on, so it can flag it if it ends up elsewhere.
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-subtle mb-1.5">
                        Number of ads for this space
                      </label>
                      <Input
                        type="number"
                        placeholder="Number of ads"
                        value={categoryData[activeCategory]?.userCount || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateCategoryData(activeCategory, 'userCount', e.target.value)
                        }
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-subtle mb-1.5">
                        Additional Requirements
                      </label>
                      <TextArea
                        placeholder="Enter any additional requirements or notes"
                        value={categoryData[activeCategory]?.instructions || ''}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          updateCategoryData(activeCategory, 'instructions', e.target.value)
                        }
                        rows={4}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                {/* Right — preview */}
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-white">Description &amp; Preview</h3>

                  <div
                    className="cursor-pointer group"
                    onClick={() => setShowFullImage(true)}
                  >
                    <img
                      src={details.image}
                      alt={`${details.name} preview`}
                      className="w-full border border-border rounded-xl group-hover:opacity-80 transition-opacity"
                    />
                    <p className="text-xs text-muted mt-1.5 text-center">Click to view full size</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-white mb-2">About this space</h4>
                    <p className="text-subtle text-sm mb-4">{details.description}</p>
                    <div className="space-y-1.5 text-sm text-muted">
                      <div>Position: <span className="text-subtle capitalize">{details.position}</span></div>
                      <div>Category: <span className="text-subtle capitalize">{details.category}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            {!showFullImage && (
              <div className="flex justify-end pt-6 mt-8 border-t border-border">
                <Button
                  variant="secondary"
                  onClick={handleNext}
                  disabled={!categoryData[activeCategory]?.price && !categoryData[activeCategory]?.tier}
                  size="lg"
                >
                  Save &amp; Continue
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const categoryFilters = [
    { id: 'all',       name: 'All Spaces' },
    { id: 'primary',   name: 'Primary'    },
    { id: 'secondary', name: 'Secondary'  },
    { id: 'sidebar',   name: 'Sidebar'    },
    { id: 'content',   name: 'Content'    },
    { id: 'special',   name: 'Special'    },
    { id: 'mobile',    name: 'Mobile'     },
    { id: 'video',     name: 'Video'      },
  ];

  return (
    <div>
      <div className="max-w-6xl mx-auto px-6 py-6">

        {/* Page header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Select Ad Spaces</h1>
          <p className="text-subtle">Choose and configure advertising spaces for your website</p>
        </div>

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="relative flex-1 max-w-md">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search ad spaces…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-border bg-surface-2 text-white placeholder-muted rounded-xl focus:outline-none focus:ring-1 focus:ring-white transition-colors text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {categoryFilters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  activeFilter === filter.id
                    ? 'bg-white text-background border-transparent'
                    : 'bg-transparent text-subtle border-border hover:bg-surface-2 hover:text-white'
                }`}
              >
                {filter.name}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <form onSubmit={handleSubmit}>
          {filteredCategories.length > 0 ? (
            <Grid cols={3} gap={6} className="mb-8">
              {filteredCategories.map(([category, details]) => {
                const isDone = completedCategories.includes(category);
                return (
                  <div
                    key={category}
                    onClick={() => handleCategorySelect(category)}
                    className={`border rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:bg-surface-2 ${
                      isDone ? 'border-border bg-surface-2' : 'border-border bg-surface-1'
                    }`}
                  >
                    {/* Card header */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl border transition-colors ${
                          isDone
                            ? 'bg-white text-background border-transparent'
                            : 'bg-surface-3 text-muted border-border'
                        }`}>
                          {isDone ? <Check size={20} /> : details.icon}
                        </div>
                        <h3 className="text-base font-semibold text-white">{details.name}</h3>
                      </div>
                    </div>

                    {/* Preview image */}
                    <div className="mb-4 overflow-hidden rounded-xl border border-border">
                      <img
                        src={details.image}
                        alt={`${details.name} preview`}
                        className="w-full h-32 object-cover"
                      />
                    </div>

                    {/* Description */}
                    <p className="text-muted text-sm mb-4 leading-relaxed">{details.description}</p>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-4 border-t border-border">
                      <span className="text-xs text-muted uppercase tracking-wide">
                        {details.position}
                      </span>
                      {isDone && (
                        <span className="text-xs text-success font-medium">✓ Added</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </Grid>
          ) : (
            <div className="flex items-center justify-center min-h-96">
              <div className="text-center">
                <Search size={56} className="mx-auto mb-6 text-muted" />
                <h2 className="text-2xl font-semibold mb-3 text-white">No ad spaces found</h2>
                <p className="text-subtle">Try adjusting your search or filter criteria</p>
              </div>
            </div>
          )}

          {/* Submit */}
          {completedCategories.length > 0 && (
            <div className="flex flex-col items-center gap-3 mt-4">
              {submitError && (
                <div className="w-full max-w-lg px-4 py-3 border border-red-400/40 bg-red-400/10 text-sm text-red-300">
                  {submitError}
                </div>
              )}
              <Button type="submit" variant="secondary" size="lg" disabled={submitting}>
                {submitting ? 'Creating…' : `Create ${completedCategories.length} Ad Space${completedCategories.length > 1 ? 's' : ''}`}
              </Button>
            </div>
          )}
        </form>
      </div>

      {/* Modals */}
      {renderCategoryModal()}
      {activeInfoModal && (
        <CategoryInfoModal
          isOpen={!!activeInfoModal}
          onClose={() => setActiveInfoModal(null)}
          category={activeInfoModal}
        />
      )}
    </div>
  );
};

export default AddNewCategory;