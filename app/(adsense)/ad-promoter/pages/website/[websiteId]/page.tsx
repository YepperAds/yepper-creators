'use client';
// @ts-nocheck

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
    X,
    AlertCircle,
    Plus,
    Check,
    Palette,
    XCircle,
    RefreshCw,
    Code2,
    Megaphone,
    Settings2,
    Activity,
    Radio,
    CheckCircle,
} from 'lucide-react';
import { MasterIntegration } from '../../../_components/codeDisplay';
import WebsitePagesPanel from '../../../_components/WebsitePagesPanel';
import AddNewCategory from '../../../_components/AddNewCategory';
import { Button, Card, CardContent, Heading, Text, Input, Badge, Grid, Container } from '@/app/(adsense)/components/components';
import LoadingSpinner from '@/app/(adsense)/components/LoadingSpinner';
import { useSession } from '@/app/_hooks/useSession';
import AdModalData from '@/app/(adsense)/ad-promoter/_components/adModalData';
import DeleteCategoryModal from '../../../_components/DeleteCategoryModal';
import AdCustomizationModal from '../../../_components/AdCustomizationModal';
import SendCategoryInviteModal from '../../../_components/SendCategoryInviteModal';
import api from '@/app/_lib/adsense-api';
import TrafficGrantBanner from '../../../_components/TrafficGrantBanner';
import WebsiteAnalyticsPanel from '@/app/(adsense)/ad-promoter/_components/WebsiteAnalyticsPanel';

const TABS = [
    { id: 'spaces',    label: 'Ad Spaces',     icon: Code2 },
    { id: 'ads',       label: 'Ads',           icon: Megaphone },
    { id: 'customize', label: 'Customize Ads', icon: Settings2 },
    { id: 'analytics', label: 'Analytics',     icon: Activity },
];

const WebsiteDetails = ({ websiteId: websiteIdProp, embedded }: { websiteId?: string; onBack?: () => void; embedded?: boolean } = {}) => {
    const params = useParams();
    const websiteId = websiteIdProp ?? (params?.websiteId as string);
    const { user, isAuthenticated, token } = useSession();
    const [result, setResult] = useState(true);
    const [website, setWebsite] = useState<Record<string,unknown> | null>(null);
    const [categories, setCategories] = useState<Record<string,unknown>[]>([]);
    const [categoriesForm, setCategoriesForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [categoryToDelete, setCategoryToDelete] = useState(null);
    const [categoryToInvite, setCategoryToInvite] = useState(null);
    const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
    const [currentCategory, setCurrentCategory] = useState(null);
    const [selectedLanguage, setSelectedLanguage] = useState('english');
    const [activeTab, setActiveTab] = useState('spaces');
    const [pendingAds, setPendingAds] = useState<Record<string,unknown>[]>([]);
    const [activeAds, setActiveAds] = useState<Record<string,unknown>[]>([]);
    const [showAdModal, setShowAdModal] = useState(false);
    const [adModalData, setAdModalData] = useState(null);
    const [adsLoading, setAdsLoading] = useState(false);
    const [rejecting, setRejecting] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [selectedAd, setSelectedAd] = useState(null);
    const [walletBalance, setWalletBalance] = useState(0);
    const [customizationModal, setCustomizationModal] = useState({ isOpen: false, categoryId: null });

    // Still fetched (just no longer displayed here), AddNewCategory below
    // uses `analytics.grantDisplay` (or plain monthlyTraffic) to price a new
    // ad space by real traffic. The full visual breakdown now lives in the
    // dashboard's main Analytics page (see WebsiteAnalyticsPanel).
    const [analytics, setAnalytics] = useState(null);
    const [earningsSummary, setEarningsSummary] = useState(null);

    useEffect(() => {
        fetchWebsiteData();
        fetchAdsData();
        fetchWalletBalance();
        fetchAnalytics();
    }, [websiteId, isAuthenticated]);

    useEffect(() => {
        if (!websiteId) return;
        api.get(`/api/websites/${websiteId}/earnings-summary`)
            .then(res => setEarningsSummary(res.data as any))
            .catch(() => setEarningsSummary({ available: false, reason: 'error' }));
    }, [websiteId, isAuthenticated, categories.length]);

    const { data: websites } = useQuery({
        queryKey: ['websites', user?._id || user?.id],
        queryFn: async () => {
            const response = await api.get(`/api/websites/${user?._id || user?.id}`);
            return (response.data as any);
        },
        enabled: !!(user?._id || user?.id),
    });

    const languages = [
        { value: 'english', label: 'English' },
        { value: 'french', label: 'French (Français)' },
        { value: 'kinyarwanda', label: 'Kinyarwanda' },
        { value: 'kiswahili', label: 'Swahili' },
        { value: 'chinese', label: 'Chinese (中文)' },
        { value: 'spanish', label: 'Spanish (Español)' },
    ];

    const fetchWebsiteData = async () => {
        setLoading(true); setFetchError(null);
        try {
            const [wr, cr] = await Promise.all([
                api.get(`/api/websites/website/${websiteId}`),
                api.get(`/api/ad-categories/${websiteId}`),
            ]);
            setWebsite(wr.data);
            setCategories(cr.data.categories);
        } catch (err: unknown) {
            setFetchError((err as any).message || 'Failed to load website data');
        } finally { setLoading(false); }
    };

    const fetchAdsData = async () => {
        setAdsLoading(true);
        try {
            const [pr, ar] = await Promise.all([
                api.get('/api/ad-categories/pending-rejections'),
                api.get('/api/ad-categories/active-ads'),
            ]);
            setPendingAds(pr.data.pendingAds || []);
            setActiveAds(ar.data.activeAds || []);
        } catch { setPendingAds([]); setActiveAds([]); }
        finally { setAdsLoading(false); }
    };

    const fetchWalletBalance = async () => {
        try {
            const r = await api.get('/api/ad-categories/wallet');
            setWalletBalance((r.data as any).wallet?.balance || 0);
        } catch {}
    };

    const fetchAnalytics = async () => {
        try {
            const r = await api.get(`/api/analytics/${websiteId}?range=30`);
            setAnalytics(r.data as any);
        } catch (err) { console.error('Failed to fetch analytics', err); }
    };

    const getAdsForWebsite = (wId) => ({
        pending: pendingAds.filter(ad => ad.websiteSelections?.some(s => s.websiteId === wId && s.approved && !s.isRejected)),
        active: activeAds.filter(ad => ad.websiteSelections?.some(s => s.websiteId === wId && s.approved && !s.isRejected && s.status === 'active')),
    });

    const formatCurrency = (amount) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
    const formatDate = (d) =>
        new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const getTimeRemaining = (deadline) => {
        const t = new Date(deadline) - (new Date() as any);
        if (t <= 0) return 'Expired';
        return `${Math.floor(t / 60000)}m ${Math.floor((t % 60000) / 1000)}s`;
    };

    const handleOpenCustomization = (id) => setCustomizationModal({ isOpen: true, categoryId: id });
    const handleCloseCustomization = () => setCustomizationModal({ isOpen: false, categoryId: null });
    const handleCustomizationSave = () => { fetchWebsiteData(); alert('Ad customization saved successfully!'); };

    const handleRejectAd = async () => {
        if (!selectedAd || !rejectionReason.trim()) return;
        setRejecting(selectedAd._id);
        try {
            const s = selectedAd.websiteSelections.find(x => x.approved && !x.isRejected);
            await api.post(`/ad-categories/reject/${selectedAd._id}/${s.websiteId}/${s.categories[0]}`, { rejectionReason: rejectionReason.trim() });
            fetchAdsData(); fetchWalletBalance();
            setShowRejectModal(false); setSelectedAd(null); setRejectionReason('');
        } catch {}
        finally { setRejecting(null); }
    };

    const closeRejectModal = () => { setShowRejectModal(false); setSelectedAd(null); setRejectionReason(''); };

    const handleOpenCategoriesForm = () => { setCategoriesForm(true); setResult(false); };
    const handleCloseCategoriesForm = () => { setCategoriesForm(false); setResult(true); fetchWebsiteData(); };
    const handleDeleteCategory = (cat) => setCategoryToDelete(cat);
    const handleDeleteSuccess = () => { setCategoryToDelete(null); fetchWebsiteData(); };
    const handleSendInvite = (cat) => setCategoryToInvite(cat);

    const handleSaveLanguage = () => {
        if (!currentCategory) return;
        setCategories(categories.map(c => c._id === currentCategory._id ? { ...c, defaultLanguage: selectedLanguage } : c));
        setIsLanguageModalOpen(false); setCurrentCategory(null);
    };

    const openRejectModal = (ad) => {
        const s = ad.websiteSelections.find(x => x.approved && !x.isRejected);
        if (!s) return;
        if (walletBalance < (ad.paymentAmount || 0)) { alert('Insufficient balance to process this rejection.'); return; }
        setSelectedAd(ad); setShowRejectModal(true);
    };

    const openAdModal = (ad, wId) => {
        const cw = websites?.find(w => (w._id || w.id) === wId);
        const ws = ad.websiteSelections?.find(s => s.websiteId === wId);
        setAdModalData({ ...ad, currentWebsite: cw, websiteSelection: ws, status: ws?.status || 'pending' });
        setShowAdModal(true);
    };

    if (loading) return <LoadingSpinner />;

    if (fetchError) return (
        <div className={embedded ? 'bg-background flex items-center justify-center py-16' : 'min-h-screen bg-background flex items-center justify-center'}>
            <div className="text-center max-w-md">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <Heading level={2} className="mb-2">Failed to Load</Heading>
                <Text variant="muted" className="mb-6">{fetchError}</Text>
                <Button onClick={fetchWebsiteData} variant="primary">Try Again</Button>
            </div>
        </div>
    );

    const { pending, active } = website ? getAdsForWebsite(website.id) : { pending: [], active: [] };
    const pendingCount = pending.length;

    return (
        <div className={embedded ? 'bg-background' : 'min-h-screen bg-background'}>

            {/* ── Sticky Page Header + Tabs ── */}
            <div className={embedded ? 'border-b border-border bg-background' : 'border-b border-border bg-background sticky top-0 z-20'}>
                <div className="max-w-7xl mx-auto px-8">

                    {/* Tab bar */}
                    <div className="flex items-center border-t border-border -mb-px">
                        {TABS.map(({ id, label, icon: Icon }) => {
                            const isActive = activeTab === id;
                            return (
                                <button
                                    key={id}
                                    onClick={() => setActiveTab(id)}
                                    className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 ${
                                        isActive
                                            ? 'text-white border-white'
                                            : 'text-muted border-transparent hover:text-subtle hover:border-border'
                                    }`}
                                >
                                    <Icon size={13} />
                                    {label}
                                    {id === 'ads' && pendingCount > 0 && (
                                        <span className="flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-black text-[9px] font-bold leading-none">
                                            {pendingCount}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── Page Body ── */}
            {result && (
                <div className="max-w-7xl mx-auto px-8 pt-4 pb-10">

                    {/* Traffic grant banner */}
                    <div className="mb-3">
                        <TrafficGrantBanner websiteId={websiteId} />
                    </div>

                    {/* ══════════════════════ AD SPACES TAB ══ */}
                    {activeTab === 'spaces' && (
                        <div className="space-y-5">

                            {/* Script install reminder */}
                            {!earningsSummary?.scriptInstalled && (
                                <div className="border border-dashed border-amber-400/40 bg-amber-400/5 p-5">
                                    <div className="flex items-start gap-4">
                                        <div className="w-9 h-9 rounded-full bg-amber-400/20 border border-amber-400/30 flex items-center justify-center shrink-0">
                                            <Radio size={16} className="text-amber-400" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold text-amber-300 text-sm mb-1">Install Your Yepper Script First</p>
                                            <p className="text-xs text-amber-400/70 mb-4 max-w-2xl">
                                                Install the tracking script below to unlock tier-based pricing. Ad spaces will run on the Unverified tier until your script is detected.
                                            </p>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                {[
                                                    { n: '1', t: 'Copy the script below', d: 'Pick your framework.' },
                                                    { n: '2', t: 'Paste it on your site', d: 'Follow the step-by-step guide.' },
                                                    { n: '3', t: 'Tier upgrades automatically', d: 'Once visitors are tracked, prices update.' },
                                                ].map(({ n, t, d }) => (
                                                    <div key={n} className="flex gap-2.5 bg-surface-1 border border-amber-400/20 p-3">
                                                        <div className="w-5 h-5 rounded-full bg-amber-400 text-black flex items-center justify-center font-bold text-xs shrink-0">{n}</div>
                                                        <div>
                                                            <p className="text-xs font-semibold text-white">{t}</p>
                                                            <p className="text-xs text-muted mt-0.5">{d}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Registered pages: lets ad spaces target a specific one */}
                            <WebsitePagesPanel
                                website={website}
                                onPagesChange={(pages) => setWebsite({ ...website, pages })}
                            />

                            {/* Scripts + ad space list */}
                            <MasterIntegration
                                website={website}
                                categories={categories}
                                onAddSpace={handleOpenCategoriesForm}
                                onDeleteCategory={handleDeleteCategory}
                                onSendInvite={handleSendInvite}
                                onTargetPathChange={(categoryId, targetPath) =>
                                    setCategories(categories.map(c => c._id === categoryId ? { ...c, targetPath } : c))
                                }
                                onDuplicated={fetchWebsiteData}
                                earningsSummary={earningsSummary}
                                scriptInstalled={!!earningsSummary?.scriptInstalled}
                            />
                        </div>
                    )}

                    {/* ══════════════════════════ ADS TAB ══ */}
                    {activeTab === 'ads' && (
                        <div>
                            {adsLoading ? (
                                <div className="flex justify-center py-20"><LoadingSpinner /></div>
                            ) : pending.length === 0 && active.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border text-center">
                                    <Megaphone size={38} className="text-muted mb-4" />
                                    <p className="text-base font-semibold text-white mb-1">No Ads Yet</p>
                                    <p className="text-sm text-muted max-w-xs">Ads will appear here once advertisers place them in your ad spaces and they're approved.</p>
                                </div>
                            ) : (
                                <div className="space-y-10">

                                    {/* Pending review */}
                                    {pending.length > 0 && (
                                        <section>
                                            <div className="flex items-center gap-2 mb-4">
                                                <h2 className="text-base font-bold text-white">Pending Review</h2>
                                                <span className="px-2 py-0.5 text-xs font-bold bg-amber-500 text-black">{pending.length}</span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {pending.map((ad: any) => {
                                                    const sel = ad.websiteSelections.find(s => s.approved && !s.isRejected);
                                                    return (
                                                        <div key={ad._id} className="border border-amber-400/30 bg-amber-400/5">
                                                            <div className="p-4 flex items-start gap-3 border-b border-amber-400/20">
                                                                {ad.imageUrl && <img src={ad.imageUrl} alt={ad.businessName} className="w-9 h-9 object-cover rounded shrink-0" />}
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="font-bold text-white text-sm truncate">{ad.businessName}</p>
                                                                    <p className="text-xs text-muted mt-0.5 line-clamp-2">{ad.adDescription}</p>
                                                                </div>
                                                                <span className="text-xs font-bold text-amber-300 shrink-0">{formatCurrency(ad.paymentAmount)}</span>
                                                            </div>
                                                            <div className="px-4 py-2.5 flex items-center justify-between">
                                                                <span className="text-xs text-muted">{sel?.rejectionDeadline ? getTimeRemaining(sel.rejectionDeadline) : 'No deadline'} remaining</span>
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={() => window.open(ad.imageUrl || ad.videoUrl, '_blank')}
                                                                        className="px-3 py-1.5 border border-border text-white hover:bg-surface-2 transition-colors text-xs font-medium"
                                                                    >View</button>
                                                                    <button
                                                                        onClick={() => openRejectModal(ad)}
                                                                        disabled={rejecting === ad._id || walletBalance < (ad.paymentAmount || 0)}
                                                                        className="px-3 py-1.5 bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 transition-colors text-xs font-medium flex items-center gap-1"
                                                                    >
                                                                        {rejecting === ad._id ? <><RefreshCw size={10} className="animate-spin" />Rejecting…</> : 'Reject'}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </section>
                                    )}

                                    {/* Active ads */}
                                    {active.length > 0 && (
                                        <section>
                                            <div className="flex items-center gap-2 mb-4">
                                                <h2 className="text-base font-bold text-white">Active Ads</h2>
                                                <span className="px-2 py-0.5 text-xs font-bold bg-emerald-500 text-black">{active.length}</span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {active.map((ad: any) => (
                                                    <div key={ad._id} className="border border-border bg-surface-1 overflow-hidden">
                                                        {ad.imageUrl && (
                                                            <div className="relative h-40 bg-surface-2">
                                                                <img src={ad.imageUrl} alt={ad.businessName} className="w-full h-full object-cover" />
                                                                <span className="absolute top-3 left-3 text-xs font-bold bg-emerald-500 text-black px-2 py-0.5">Active</span>
                                                            </div>
                                                        )}
                                                        <div className="p-4">
                                                            <p className="font-bold text-white mb-1 text-sm">{ad.businessName}</p>
                                                            <p className="text-xs text-subtle mb-3 line-clamp-2">{ad.adDescription}</p>
                                                            <div className="grid grid-cols-2 gap-2 mb-3">
                                                                <div className="bg-surface-2 border border-border p-2.5 text-center">
                                                                    <p className="text-lg font-bold text-white">{ad.views || 0}</p>
                                                                    <p className="text-xs text-muted">Views</p>
                                                                </div>
                                                                <div className="bg-surface-2 border border-border p-2.5 text-center">
                                                                    <p className="text-lg font-bold text-white">{ad.clicks || 0}</p>
                                                                    <p className="text-xs text-muted">Clicks</p>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => openAdModal(ad, website.id)}
                                                                className="w-full py-2 text-xs font-medium border border-border text-white hover:bg-surface-2 transition-colors"
                                                            >View Full Ad</button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ══════════════════════ CUSTOMIZE ADS TAB ══ */}
                    {activeTab === 'customize' && (
                        <div>
                            <div className="mb-6">
                                <h2 className="text-xl font-bold text-white">Customize Your Ad Spaces</h2>
                                <p className="text-sm text-muted mt-1">Design how ads appear on your website. Each space can have its own unique styling.</p>
                            </div>
                            {categories.length > 0 ? (
                                <div className={`grid grid-cols-1 ${embedded ? '' : 'sm:grid-cols-2 lg:grid-cols-3'} gap-4`}>
                                    {categories.map((category: any) => (
                                        <div key={category._id} className="border border-border bg-surface-1 flex flex-col">
                                            <div className="p-4 border-b border-border flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <span className="inline-block text-xs font-bold text-white bg-surface-2 border border-border px-2 py-0.5 mb-2 capitalize">{category.spaceType}</span>
                                                    <p className="font-semibold text-white text-sm truncate">{category.categoryName}</p>
                                                    <p className="text-xs text-muted mt-0.5">{category.customization ? 'Custom styling applied' : 'Default styling'}</p>
                                                </div>
                                                <Palette size={16} className="text-muted shrink-0 mt-1" />
                                            </div>
                                            {category.customization && (
                                                <div className="px-4 py-3 bg-surface-2/50 border-b border-border grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                                    <div className="flex justify-between gap-1">
                                                        <span className="text-muted">Size</span>
                                                        <span className="text-white font-medium">{category.customization.width}×{category.customization.height}px</span>
                                                    </div>
                                                    <div className="flex justify-between gap-1">
                                                        <span className="text-muted">Layout</span>
                                                        <span className="text-white font-medium capitalize">{category.customization.orientation || 'horizontal'}</span>
                                                    </div>
                                                    <div className="flex justify-between gap-1">
                                                        <span className="text-muted">Radius</span>
                                                        <span className="text-white font-medium">{category.customization.borderRadius || 16}px</span>
                                                    </div>
                                                    <div className="flex justify-between gap-1">
                                                        <span className="text-muted">Effect</span>
                                                        <span className="text-white font-medium">{category.customization.glassmorphism ? 'Glass' : 'Solid'}</span>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="p-4 mt-auto">
                                                <button
                                                    onClick={() => handleOpenCustomization(category._id)}
                                                    className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium border border-border text-white hover:bg-surface-2 transition-colors"
                                                >
                                                    <Palette size={13} />
                                                    {category.customization ? 'Edit Customization' : 'Customize Ad Space'}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border text-center">
                                    <Palette size={38} className="text-muted mb-4" />
                                    <p className="text-base font-semibold text-white mb-1">No Ad Spaces to Customize</p>
                                    <p className="text-sm text-muted mb-6 max-w-xs">Create an ad space first, then customize how ads appear.</p>
                                    <button
                                        onClick={() => { setActiveTab('spaces'); handleOpenCategoriesForm(); }}
                                        className="flex items-center gap-2 px-4 py-2 bg-white text-background text-sm font-semibold hover:opacity-90 transition-colors"
                                    >
                                        <Plus size={13} /> Create Ad Space
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ══════════════════════════ ANALYTICS TAB ══ */}
                    {activeTab === 'analytics' && (
                        <WebsiteAnalyticsPanel websiteId={websiteId} />
                    )}

                </div>
            )}

            {/* ════════ MODALS ════════ */}

            {showAdModal && adModalData && (
                <AdModalData
                    adModalData={adModalData}
                    closeAdModal={() => { setShowAdModal(false); setAdModalData(null); }}
                    formatCurrency={formatCurrency}
                    formatDate={formatDate}
                    getTimeRemaining={getTimeRemaining}
                />
            )}

            {isLanguageModalOpen && currentCategory && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-surface-1 border border-border w-full max-w-sm">
                        <div className="p-4 border-b border-border flex items-center justify-between">
                            <p className="font-semibold text-white text-sm">Set Default Language</p>
                            <button onClick={() => setIsLanguageModalOpen(false)}><X size={16} className="text-muted" /></button>
                        </div>
                        <div className="p-4 grid grid-cols-2 gap-2">
                            {languages.map(lang => (
                                <button
                                    key={lang.value}
                                    onClick={() => setSelectedLanguage(lang.value)}
                                    className={`flex items-center gap-2 p-2.5 text-sm border transition-all ${selectedLanguage === lang.value ? 'border-white bg-surface-2 text-white' : 'border-border text-subtle hover:border-white/30'}`}
                                >
                                    {selectedLanguage === lang.value && <Check size={11} />}
                                    {lang.label}
                                </button>
                            ))}
                        </div>
                        <div className="p-4 border-t border-border flex justify-end gap-2">
                            <button onClick={() => setIsLanguageModalOpen(false)} className="px-4 py-2 text-sm border border-border text-white hover:bg-surface-2 transition-colors">Cancel</button>
                            <button onClick={handleSaveLanguage} className="px-4 py-2 text-sm bg-white text-background font-medium hover:opacity-90 transition-colors">Save</button>
                        </div>
                    </div>
                </div>
            )}

            {showRejectModal && selectedAd && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
                    <div className="bg-surface-1 border border-border max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-5">
                            <p className="font-bold text-white">Reject Ad</p>
                            <button onClick={closeRejectModal}><X size={16} className="text-muted" /></button>
                        </div>
                        <p className="text-sm text-subtle mb-1">Rejecting: <strong className="text-white">{selectedAd.businessName}</strong></p>
                        <p className="text-sm text-subtle mb-4">Refund: <strong className="text-white">{formatCurrency(selectedAd.paymentAmount)}</strong></p>
                        <label className="block text-xs font-medium text-white mb-2 uppercase tracking-wide">Reason for rejection</label>
                        <textarea
                            value={rejectionReason}
                            onChange={(e: any) => setRejectionReason(e.target.value)}
                            className="w-full px-3 py-2 border border-border bg-surface-2 text-white placeholder-muted focus:outline-none text-sm resize-none"
                            rows={3}
                            placeholder="Why are you rejecting this ad?"
                        />
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={closeRejectModal} disabled={rejecting === selectedAd._id} className="px-4 py-2 text-sm border border-border text-white hover:bg-surface-2 transition-colors">Cancel</button>
                            <button
                                onClick={handleRejectAd}
                                disabled={!rejectionReason.trim() || rejecting === selectedAd._id}
                                className="px-4 py-2 text-sm bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-40 transition-colors flex items-center gap-2"
                            >
                                {rejecting === selectedAd._id ? <><RefreshCw size={11} className="animate-spin" />Rejecting…</> : 'Reject Ad'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {customizationModal.isOpen && (
                <AdCustomizationModal
                    categoryId={customizationModal.categoryId}
                    onClose={handleCloseCustomization}
                    onSave={handleCustomizationSave}
                />
            )}

            {categoryToDelete && (
                <DeleteCategoryModal
                    categoryId={categoryToDelete._id}
                    category={categoryToDelete}
                    onDeleteSuccess={handleDeleteSuccess}
                    onCancel={() => setCategoryToDelete(null)}
                />
            )}

            {categoryToInvite && (
                <SendCategoryInviteModal
                    category={categoryToInvite}
                    onClose={() => setCategoryToInvite(null)}
                />
            )}

            {/* Add ad space: centered dialog, portaled to <body> so it's never
                constrained by an ancestor inside the embedded dashboard layout */}
            {categoriesForm && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-surface-1 border border-border rounded-2xl w-full max-w-6xl max-h-[85vh] flex flex-col overflow-hidden">
                        <div className="shrink-0 flex items-center justify-between px-6 h-14 border-b border-border">
                            <p className="text-sm font-semibold text-white">Add New Ad Space</p>
                            <button onClick={handleCloseCategoriesForm} className="p-1.5 rounded-lg hover:bg-surface-3 border border-border transition-colors">
                                <X size={15} className="text-white" />
                            </button>
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto">
                            <AddNewCategory
                                websiteId={websiteId}
                                onSubmitSuccess={handleCloseCategoriesForm}
                                monthlyTraffic={analytics?.grantDisplay ? analytics.grantDisplay.grantedTraffic : website?.monthlyTraffic}
                                websitePages={website?.pages || []}
                            />
                        </div>
                    </div>
                </div>,
                document.body,
            )}
        </div>
    );
};

export default WebsiteDetails;
