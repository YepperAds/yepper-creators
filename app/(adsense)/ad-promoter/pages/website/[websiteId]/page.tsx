'use client';
// @ts-nocheck

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
    X,
    AlertCircle,
    ArrowLeft,
    Plus,
    Check,
    Palette,
    XCircle,
    RefreshCw,
    Edit,
    Globe,
    Users,
    Eye,
    Monitor,
    Smartphone,
    Tablet,
    TrendingUp,
    BarChart2,
    MapPin,
    ExternalLink,
    Code2,
    Megaphone,
    Settings2,
    Activity,
    Radio,
    AlertTriangle,
    ShieldCheck,
    ShieldAlert,
    DollarSign,
    Signal,
    Gift,
    CheckCircle,
} from 'lucide-react';
import { MasterIntegration } from '../../../_components/codeDisplay';
import AddNewCategory from '../../../_components/AddNewCategory';
import { Button, Card, CardContent, Heading, Text, Input, Badge, Grid, Container } from '@/app/(adsense)/components/components';
import LoadingSpinner from '@/app/(adsense)/components/LoadingSpinner';
import { useSession } from '@/app/_hooks/useSession';
import AdModalData from '@/app/(adsense)/ad-promoter/_components/adModalData';
import DeleteCategoryModal from '../../../_components/DeleteCategoryModal';
import AdCustomizationModal from '../../../_components/AdCustomizationModal';
import api from '@/app/_lib/adsense-api';
import TrafficGrantBanner from '../../../_components/TrafficGrantBanner';

const TABS = [
    { id: 'spaces',    label: 'Ad Spaces',     icon: Code2 },
    { id: 'ads',       label: 'Ads',           icon: Megaphone },
    { id: 'customize', label: 'Customize Ads', icon: Settings2 },
    { id: 'analytics', label: 'Analytics',     icon: Activity },
];

const WebsiteDetails = ({ websiteId: websiteIdProp, onBack, embedded }: { websiteId?: string; onBack?: () => void; embedded?: boolean } = {}) => {
    const router = useRouter();
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
    const [isEditingWebsiteName, setIsEditingWebsiteName] = useState(false);
    const [tempWebsiteName, setTempWebsiteName] = useState('');
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

    const [analytics, setAnalytics] = useState(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [analyticsRange, setAnalyticsRange] = useState(30);
    const [earningsSummary, setEarningsSummary] = useState(null);
    const mapRef = useRef(null);
    const leafletMapRef = useRef(null);

    const [gscData, setGscData] = useState(null);
    const [gscLoading, setGscLoading] = useState(false);
    const [gscConnecting, setGscConnecting] = useState(false);

    useEffect(() => {
        fetchWebsiteData();
        fetchAdsData();
        fetchWalletBalance();
    }, [websiteId, isAuthenticated]);

    useEffect(() => {
        if (!websiteId) return;
        api.get(`/api/websites/${websiteId}/earnings-summary`)
            .then(res => setEarningsSummary(res.data as any))
            .catch(() => setEarningsSummary({ available: false, reason: 'error' }));
    }, [websiteId, isAuthenticated, categories.length]);

    useEffect(() => {
        if (activeTab === 'analytics') { fetchAnalytics(); fetchGscData(); }
    }, [activeTab, analyticsRange, isAuthenticated]);

    useEffect(() => {
        const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
        if (params.get('gsc') && params.get('tab') === 'analytics') {
            setActiveTab('analytics');
            const url = new URL(window.location.href);
            url.searchParams.delete('gsc'); url.searchParams.delete('tab');
            window.history.replaceState({}, '', url.toString());
        }
    }, []);

    useEffect(() => {
        if (activeTab !== 'analytics' || !analytics?.mapPoints?.length) return;
        const init = () => {
            const container = mapRef.current;
            if (!container || !(window as any).L) return;
            if (leafletMapRef.current) { leafletMapRef.current.remove(); leafletMapRef.current = null; }
            const map = (window as any).L.map(container, { zoomControl: true }).setView([20, 0], 2);
            (window as any).L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors', maxZoom: 18,
            }).addTo(map);
            analytics.mapPoints.forEach(pt => {
                const c = pt.device === 'mobile' ? '#3b82f6' : pt.device === 'tablet' ? '#8b5cf6' : '#10b981';
                (window as any).L.circleMarker([pt.lat, pt.lon], { radius: 6, fillColor: c, color: '#fff', weight: 1, opacity: 0.9, fillOpacity: 0.75 })
                    .bindPopup(`<strong>${pt.city}, ${pt.country}</strong><br/>${pt.device}<br/>${new Date(pt.timestamp).toLocaleString()}`).addTo(map);
            });
            leafletMapRef.current = map;
        };
        if (!(window as any).L) {
            if (!document.getElementById('leaflet-css')) {
                const link = document.createElement('link');
                link.id = 'leaflet-css'; link.rel = 'stylesheet';
                link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
                document.head.appendChild(link);
            }
            const s = document.createElement('script');
            s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            s.onload = init;
            document.head.appendChild(s);
        } else { init(); }
        return () => { if (leafletMapRef.current) { leafletMapRef.current.remove(); leafletMapRef.current = null; } };
    }, [analytics, activeTab]);

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
        setAnalyticsLoading(true);
        try {
            const r = await api.get(`/api/analytics/${websiteId}?range=${analyticsRange}`);
            setAnalytics(r.data as any);
        } catch (err) { console.error('Failed to fetch analytics', err); }
        finally { setAnalyticsLoading(false); }
    };

    const fetchGscData = async () => {
        setGscLoading(true);
        try {
            const r = await api.get(`/api/analytics/gsc/data/${websiteId}`);
            setGscData(r.data as any);
        } catch (err) { console.error('Failed to fetch GSC data', err); }
        finally { setGscLoading(false); }
    };

    const handleConnectGsc = async () => {
        setGscConnecting(true);
        try {
            const r = await api.get(`/api/analytics/gsc/connect/${websiteId}`);
            window.location.href = (r.data as any).url;
        } catch { setGscConnecting(false); }
    };

    const handleDisconnectGsc = async () => {
        if (!window.confirm('Disconnect Google Search Console from this website?')) return;
        try { await api.delete(`/api/analytics/gsc/disconnect/${websiteId}`); setGscData(null); } catch {}
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

    const handleUpdateWebsiteName = async () => {
        if (!tempWebsiteName.trim()) return;
        try {
            const r = await api.patch(`/api/websites/${websiteId}/name`, { websiteName: tempWebsiteName.trim() });
            setWebsite(prev => ({ ...prev, websiteName: (r.data as any).websiteName }));
            setIsEditingWebsiteName(false);
        } catch {}
    };

    const handleOpenCategoriesForm = () => { setCategoriesForm(true); setResult(false); };
    const handleCloseCategoriesForm = () => { setCategoriesForm(false); setResult(true); fetchWebsiteData(); };
    const handleDeleteCategory = (cat) => setCategoryToDelete(cat);
    const handleDeleteSuccess = () => { setCategoryToDelete(null); fetchWebsiteData(); };

    const handleAllSpacesLanguageChange = async (lang) => {
        try {
            await Promise.all(categories.map(c => api.patch(`/api/ad-categories/category/${c._id}/language`, { defaultLanguage: lang })));
            setCategories(categories.map(c => ({ ...c, defaultLanguage: lang })));
        } catch {}
    };

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
                <div className="max-w-6xl mx-auto px-6">

                    {/* Top bar */}
                    <div className="h-14 flex items-center gap-3">
                        <button
                            onClick={() => (onBack ? onBack() : router.back())}
                            className="flex items-center gap-1.5 text-muted hover:text-white transition-colors text-sm shrink-0"
                        >
                            <ArrowLeft size={15} /> Back
                        </button>

                        <div className="w-px h-4 bg-border shrink-0" />

                        {/* Website icon */}
                        {website?.imageUrl ? (
                            <img src={website.imageUrl as string} alt="icon" className="w-6 h-6 rounded object-cover border border-border shrink-0" />
                        ) : (
                            <div className="w-6 h-6 rounded border border-border bg-surface-2 flex items-center justify-center shrink-0">
                                <Globe size={12} className="text-muted" />
                            </div>
                        )}

                        {/* Website name — inline editable */}
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                            {isEditingWebsiteName ? (
                                <div className="flex items-center gap-1.5">
                                    <input
                                        value={tempWebsiteName}
                                        onChange={(e: any) => setTempWebsiteName(e.target.value)}
                                        className="bg-surface-2 border border-border text-white text-sm px-2 py-1 focus:outline-none focus:border-white/40 w-40"
                                        autoFocus
                                        onKeyDown={(e: any) => {
                                            if (e.key === 'Enter') handleUpdateWebsiteName();
                                            if (e.key === 'Escape') setIsEditingWebsiteName(false);
                                        }}
                                    />
                                    <button onClick={handleUpdateWebsiteName} className="p-1 bg-white text-black hover:bg-zinc-200 transition-colors"><Check size={12} /></button>
                                    <button onClick={() => setIsEditingWebsiteName(false)} className="p-1 bg-surface-2 text-white border border-border hover:bg-surface-3 transition-colors"><X size={12} /></button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => { setTempWebsiteName(website?.websiteName as string); setIsEditingWebsiteName(true); }}
                                    className="group flex items-center gap-1.5 text-white font-semibold text-sm truncate max-w-[180px] sm:max-w-xs hover:text-zinc-300 transition-colors"
                                >
                                    <span className="truncate">{website?.websiteName}</span>
                                    <Edit size={11} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                </button>
                            )}
                            {website?.websiteLink && (
                                <a
                                    href={website.websiteLink as string}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hidden sm:flex items-center gap-1 text-xs text-muted hover:text-white transition-colors truncate max-w-[200px]"
                                >
                                    <ExternalLink size={10} />
                                    {(website.websiteLink as string).replace(/^https?:\/\//, '')}
                                </a>
                            )}
                        </div>

                        {/* Status pills */}
                        <div className="hidden md:flex items-center gap-2 shrink-0">
                            {earningsSummary?.gscVerified ? (
                                <span className="flex items-center gap-1 text-xs font-medium text-emerald-400 border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 rounded-sm">
                                    <Check size={9} /> Verified
                                </span>
                            ) : (
                                <span className="text-xs font-medium text-amber-400 border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 rounded-sm">
                                    Unverified
                                </span>
                            )}
                            {earningsSummary?.trafficTier && (
                                <span className="text-xs font-medium text-subtle border border-border bg-surface-1 px-2 py-0.5 rounded-sm capitalize">
                                    {earningsSummary.trafficTier}
                                </span>
                            )}
                        </div>
                    </div>

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
                <div className="max-w-6xl mx-auto px-6 py-8">

                    {/* Traffic grant banner */}
                    <div className="mb-6">
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

                            {/* GSC / verification status */}
                            {!earningsSummary?.gscVerified && (
                                <div className={`border p-4 flex items-start gap-3 ${earningsSummary?.unverifiedSurchargeActive ? 'border-red-400/40 bg-red-400/5' : 'border-amber-400/30 bg-amber-400/5'}`}>
                                    <div className="shrink-0 mt-0.5">
                                        {earningsSummary?.unverifiedSurchargeActive
                                            ? <AlertTriangle size={16} className="text-red-400" />
                                            : <ShieldAlert size={16} className="text-amber-400" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-semibold mb-0.5 ${earningsSummary?.unverifiedSurchargeActive ? 'text-red-300' : 'text-amber-300'}`}>
                                            {earningsSummary?.unverifiedSurchargeActive
                                                ? 'Unverified Site — Ad Prices at 4× Rate'
                                                : 'Connect Google Search Console to Verify Your Site'}
                                        </p>
                                        <p className={`text-xs ${earningsSummary?.unverifiedSurchargeActive ? 'text-red-400/80' : 'text-amber-400/70'}`}>
                                            {earningsSummary?.unverifiedSurchargeActive
                                                ? 'Running 7+ days without GSC verification. Connect in the Analytics tab to restore normal pricing.'
                                                : 'Connect GSC in the Analytics tab to verify your site and unlock tier-based pricing.'}
                                        </p>
                                    </div>
                                    <button onClick={() => setActiveTab('analytics')} className="shrink-0 px-3 py-1.5 bg-black text-white text-xs font-semibold border border-border hover:bg-surface-2 transition-colors whitespace-nowrap">
                                        Go to Analytics
                                    </button>
                                </div>
                            )}

                            {earningsSummary?.gscVerified && (
                                <div className="border border-emerald-400/30 bg-emerald-400/5 p-4 flex items-center gap-3">
                                    <ShieldCheck size={18} className="text-emerald-400 shrink-0" />
                                    <div>
                                        <p className="text-sm font-bold text-emerald-300">Site Verified — Standard Pricing Active</p>
                                        <p className="text-xs text-emerald-400/70 mt-0.5">Your script is installed and your site is verified. Ad spaces use tier-based pricing from your real traffic.</p>
                                    </div>
                                </div>
                            )}

                            {/* Earnings panel */}
                            {earningsSummary?.available ? (
                                <div className="border border-emerald-700/40 bg-emerald-900/10 p-5">
                                    <div className="flex items-start justify-between gap-4 mb-4">
                                        <div>
                                            <p className="text-sm font-bold text-emerald-300 flex items-center gap-1.5">
                                                <DollarSign size={14} className="text-emerald-400" />
                                                Estimated Monthly Earnings
                                            </p>
                                            <p className="text-xs text-emerald-400/70 mt-0.5">
                                                {Number(earningsSummary.monthlyTraffic).toLocaleString()} visitors/mo · <span className="capitalize font-semibold">{earningsSummary.trafficTier}</span> tier
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-2xl font-bold text-emerald-300">RWF {Number(earningsSummary.totalOwnerEarnsPerMonth).toLocaleString()}</p>
                                            <p className="text-xs text-emerald-400/70">total / month</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {earningsSummary.categories?.map((c: any) => (
                                            <div key={c.categoryId} className="flex items-center justify-between bg-surface-1 border border-emerald-700/30 px-3 py-2 text-xs gap-2">
                                                <span className="text-subtle font-medium truncate">{c.name}</span>
                                                <span className="text-emerald-300 font-bold whitespace-nowrap shrink-0">RWF {Number(c.ownerEarns).toLocaleString()}/mo</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : earningsSummary?.reason === 'no_traffic' ? (
                                <div className="border border-border bg-surface-1 p-4 flex items-center gap-3">
                                    <Signal size={18} className="text-muted shrink-0" />
                                    <div>
                                        <p className="text-sm font-semibold text-subtle">Install your script to see earnings</p>
                                        <p className="text-xs text-muted mt-0.5">{earningsSummary.message || 'Add the Yepper script to your site. Once visitors are detected, earnings per ad space will appear here.'}</p>
                                    </div>
                                </div>
                            ) : null}

                            {/* Scripts + ad space list */}
                            <MasterIntegration
                                website={website}
                                categories={categories}
                                onAddSpace={handleOpenCategoriesForm}
                                onLanguageChange={handleAllSpacesLanguageChange}
                                onDeleteCategory={handleDeleteCategory}
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
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                                        className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors"
                                    >
                                        <Plus size={13} /> Create Ad Space
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ══════════════════════════ ANALYTICS TAB ══ */}
                    {activeTab === 'analytics' && (
                        <div className="space-y-8">
                            <div className="flex items-center justify-between gap-4 flex-wrap">
                                <div>
                                    <h2 className="text-xl font-bold text-white">Website Analytics</h2>
                                    <p className="text-sm text-muted mt-1">Real visitor data collected by your Yepper script</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {[7, 30, 90].map(d => (
                                        <button key={d} onClick={() => setAnalyticsRange(d)}
                                            className={`px-4 py-2 text-sm border border-border font-medium transition-colors ${analyticsRange === d ? 'bg-white text-black' : 'bg-surface-1 text-white hover:bg-surface-2'}`}>
                                            {d}d
                                        </button>
                                    ))}
                                    <button onClick={fetchAnalytics} className="px-4 py-2 text-sm border border-border bg-surface-1 hover:bg-surface-2 text-white flex items-center gap-1.5 transition-colors">
                                        <RefreshCw size={12} /> Refresh
                                    </button>
                                </div>
                            </div>

                            {analyticsLoading ? (
                                <div className="flex items-center justify-center h-60">
                                    <div className="text-center">
                                        <div className="animate-spin w-7 h-7 border-2 border-border border-t-white rounded-full mx-auto mb-3" />
                                        <p className="text-muted text-sm">Loading analytics…</p>
                                    </div>
                                </div>
                            ) : !analytics ? (
                                <div className="border border-dashed border-border p-16 text-center">
                                    <BarChart2 size={40} className="mx-auto mb-4 text-muted" />
                                    <p className="text-base font-semibold text-white mb-2">No data yet</p>
                                    <p className="text-sm text-muted max-w-sm mx-auto">Install your Yepper script on your website and visitor data will appear here automatically.</p>
                                </div>
                            ) : (
                                <>
                                    {/* KPIs */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {[
                                            { label: 'Total Views', value: analytics.totalViews?.toLocaleString() || '0', icon: Eye },
                                            { label: 'Unique Visitors', value: analytics.uniqueVisitors?.toLocaleString() || '0', icon: Users },
                                            { label: 'Monthly Traffic', value: analytics.monthlyTraffic?.toLocaleString() || '0', icon: TrendingUp },
                                            { label: 'Traffic Tier', value: analytics.trafficTier ? analytics.trafficTier.charAt(0).toUpperCase() + analytics.trafficTier.slice(1) : 'Starter', icon: BarChart2 },
                                        ].map(({ label, value, icon: Icon }) => (
                                            <div key={label} className="border border-border p-5 bg-surface-1">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-xs font-medium text-muted uppercase tracking-wide">{label}</span>
                                                    <Icon size={14} className="text-muted" />
                                                </div>
                                                <p className="text-2xl font-bold text-white">{value}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Daily chart */}
                                    {analytics.byDay?.length > 0 && (
                                        <div className="border border-border p-6 bg-surface-1">
                                            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-4">Views per Day</p>
                                            <div className="flex items-end gap-1 h-28">
                                                {(() => {
                                                    const max = Math.max(...analytics.byDay.map(d => d.count), 1);
                                                    return analytics.byDay.map((d: any, i: any) => (
                                                        <div key={i} className="flex-1 group relative">
                                                            <div style={{ height: `${(d.count / max) * 100}%` }} className="w-full bg-white hover:bg-zinc-400 transition-colors min-h-[2px]" />
                                                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs bg-black text-white px-1 py-0.5 opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-10">{d.count}</span>
                                                        </div>
                                                    ));
                                                })()}
                                            </div>
                                            <div className="flex justify-between mt-2 text-xs text-muted">
                                                <span>{analytics.byDay[0]?.date}</span>
                                                <span>{analytics.byDay[analytics.byDay.length - 1]?.date}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Map + countries */}
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                                        <div className="lg:col-span-2 border border-border">
                                            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                                                <MapPin size={12} className="text-muted" />
                                                <span className="text-sm font-semibold text-white">Visitor Locations</span>
                                                <span className="ml-auto text-xs text-muted">{analytics.mapPoints?.length || 0} points</span>
                                            </div>
                                            <div className="p-2"><div ref={mapRef} style={{ height: '300px', width: '100%' }} /></div>
                                            <div className="px-4 py-2 border-t border-border flex gap-4 text-xs text-muted">
                                                {[['#10b981','Desktop'],['#3b82f6','Mobile'],['#8b5cf6','Tablet']].map(([c,l]) => (
                                                    <span key={l} className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full inline-block" style={{background:c}} />{l}</span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="border border-border">
                                            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                                                <Globe size={12} className="text-muted" />
                                                <span className="text-sm font-semibold text-white">Top Countries</span>
                                            </div>
                                            <div className="max-h-[350px] overflow-y-auto divide-y divide-border">
                                                {analytics.byCountry?.length > 0 ? analytics.byCountry.map((c: any, i: any) => {
                                                    const pct = analytics.totalViews > 0 ? Math.round((c.count / analytics.totalViews) * 100) : 0;
                                                    return (
                                                        <div key={i} className="px-4 py-3">
                                                            <div className="flex items-center justify-between mb-1 text-xs">
                                                                <span className="text-white font-medium">{c.country}</span>
                                                                <span className="text-muted">{c.count.toLocaleString()}</span>
                                                            </div>
                                                            <div className="w-full bg-surface-3 h-1"><div className="h-1 bg-white" style={{ width: `${pct}%` }} /></div>
                                                        </div>
                                                    );
                                                }) : <div className="px-4 py-8 text-center text-sm text-muted">No country data yet</div>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Devices + referrers + pages */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                        {[
                                            {
                                                title: 'Devices',
                                                content: analytics.byDevice?.length > 0
                                                    ? analytics.byDevice.map((d: any, i: any) => {
                                                        const Icon = d.device === 'mobile' ? Smartphone : d.device === 'tablet' ? Tablet : Monitor;
                                                        const pct = analytics.totalViews > 0 ? Math.round((d.count / analytics.totalViews) * 100) : 0;
                                                        return (
                                                            <div key={i} className="px-4 py-3 flex items-center gap-3">
                                                                <Icon size={14} className="text-muted shrink-0" />
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex justify-between text-xs mb-1">
                                                                        <span className="capitalize text-white">{d.device}</span>
                                                                        <span className="text-muted">{pct}%</span>
                                                                    </div>
                                                                    <div className="w-full bg-surface-3 h-1"><div className="h-1 bg-white" style={{ width: `${pct}%` }} /></div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                    : null,
                                            },
                                        ].map(({ title, content }) => (
                                            <div key={title} className="border border-border">
                                                <div className="px-4 py-3 border-b border-border text-sm font-semibold text-white">{title}</div>
                                                <div className="divide-y divide-border">
                                                    {content || <div className="px-4 py-8 text-center text-sm text-muted">No device data</div>}
                                                </div>
                                            </div>
                                        ))}
                                        <div className="border border-border">
                                            <div className="px-4 py-3 border-b border-border text-sm font-semibold text-white">Top Referrers</div>
                                            <div className="divide-y divide-border max-h-56 overflow-y-auto">
                                                {analytics.topReferrers?.length > 0 ? analytics.topReferrers.map((r: any, i: any) => (
                                                    <div key={i} className="px-4 py-3 flex items-center justify-between gap-2">
                                                        <span className="text-xs text-white truncate flex-1">{r.referrer || '(direct)'}</span>
                                                        <span className="text-xs text-muted shrink-0">{r.count}</span>
                                                    </div>
                                                )) : <div className="px-4 py-8 text-center text-sm text-muted">No referrer data</div>}
                                            </div>
                                        </div>
                                        <div className="border border-border">
                                            <div className="px-4 py-3 border-b border-border text-sm font-semibold text-white">Top Pages</div>
                                            <div className="divide-y divide-border max-h-56 overflow-y-auto">
                                                {analytics.topPages?.length > 0 ? analytics.topPages.map((p: any, i: any) => (
                                                    <div key={i} className="px-4 py-3 flex items-center justify-between gap-2">
                                                        <span className="text-xs text-white truncate flex-1">{p.path}</span>
                                                        <span className="text-xs text-muted shrink-0">{p.count}</span>
                                                    </div>
                                                )) : <div className="px-4 py-8 text-center text-sm text-muted">No page data</div>}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Granted Traffic section */}
                            {analytics?.grantDisplay && (() => {
                                const gd = analytics.grantDisplay;
                                const TIER_COLORS = { elite:'#fff', premium:'#f97316', standard:'#8b5cf6', basic:'#10b981', starter:'#3b82f6', unverified:'#f59e0b' };
                                const tierColor = TIER_COLORS[gd.trafficTier] || '#888';
                                const hoursLeft = gd.grantWindowExpiresAt
                                    ? Math.max(0, Math.ceil((new Date(gd.grantWindowExpiresAt) - Date.now()) / (1000*60*60)))
                                    : 0;
                                return (
                                    <div>
                                        <div className="mb-4">
                                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                            <Gift size={16} className="text-white" />
                                            Your Stated Traffic
                                        </h2>
                                            <p className="text-xs text-muted mt-0.5">
                                                Numbers you provided via your analytics boost — shown separately from script-counted data
                                                {hoursLeft > 0 && <span className="text-amber-400 ml-2">· Visible for {hoursLeft}h more</span>}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                                            {[
                                                { label: 'Monthly Visitors', value: gd.grantedTraffic?.toLocaleString() ?? '—', sub: 'as stated by you' },
                                                { label: 'Monthly Views', value: gd.grantedViews?.toLocaleString() ?? '—', sub: 'as stated by you' },
                                                { label: 'Traffic Tier', value: gd.trafficTier, sub: 'applied to your ad spaces', color: tierColor, cap: true },
                                            ].map(({ label, value, sub, color, cap }) => (
                                                <div key={label} className="border border-border p-5 bg-surface-1">
                                                    <p className="text-xs font-medium text-muted uppercase mb-2">{label}</p>
                                                    <p className={`text-2xl font-bold ${cap ? 'capitalize' : ''}`} style={color ? { color } : {}}>{value}</p>
                                                    <p className="text-xs text-muted mt-1">{sub}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-xs text-muted border border-border bg-surface-1 p-3">
                                            <span className="font-medium text-subtle">Note:</span> These numbers reflect what you reported and are used to set your tier. They do not change what the Yepper script counted from real visitors, nor what Google Search Console reports.
                                        </p>
                                    </div>
                                );
                            })()}

                            {/* Google Search Console */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21.35 11.1h-9.17v2.73h5.51c-.33 1.81-1.87 3.14-3.77 3.14a5.02 5.02 0 01-5.03-5.02 5.02 5.02 0 015.03-5.02c1.22 0 2.33.44 3.19 1.16l2.02-2.02A8.46 8.46 0 0014.51 4c-4.69 0-8.5 3.8-8.5 8.5s3.81 8.5 8.5 8.5c4.91 0 8.17-3.45 8.17-8.3 0-.56-.06-1.1-.17-1.6h-1.16z" fill="#4285F4"/></svg>
                                            Organic Traffic (Search Console)
                                        </h2>
                                        <p className="text-xs text-muted mt-0.5">Real clicks & impressions from Google Search — last 28 days</p>
                                    </div>
                                    {gscData?.connected && (
                                        <button onClick={handleDisconnectGsc} className="text-xs text-muted hover:text-red-400 transition-colors underline">Disconnect</button>
                                    )}
                                </div>

                                {gscLoading ? (
                                    <div className="border border-border p-8 flex items-center justify-center gap-3">
                                        <div className="animate-spin w-5 h-5 border-2 border-border border-t-white rounded-full" />
                                        <span className="text-sm text-muted">Loading Search Console data…</span>
                                    </div>
                                ) : !gscData?.connected ? (
                                    <div className="border border-dashed border-border p-12 text-center">
                                        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-surface-2 border border-border flex items-center justify-center">
                                            <svg width="22" height="22" viewBox="0 0 48 48" fill="none"><path d="M43.6 20.2H24v7.3H35.2c-.9 4.8-5 8.4-11.2 8.4A13.4 13.4 0 0110.6 24a13.4 13.4 0 0113.4-13.4c3.2 0 6.2 1.2 8.5 3.1l5.4-5.4A22.5 22.5 0 0024 2C11.9 2 2 11.9 2 24s9.9 22 22 22c13.1 0 21.8-9.2 21.8-22.1 0-1.5-.2-2.9-.4-4.3l-1.8.6z" fill="#4285F4"/></svg>
                                        </div>
                                        <h3 className="text-base font-semibold text-white mb-2">Connect Google Search Console</h3>
                                        <p className="text-sm text-muted mb-6 max-w-sm mx-auto">See how many people find your site through Google — clicks, impressions, CTR, and top queries.</p>
                                        <button
                                            onClick={handleConnectGsc}
                                            disabled={gscConnecting}
                                            className="inline-flex items-center gap-2 px-6 py-2.5 bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-colors disabled:opacity-60"
                                        >
                                            {gscConnecting
                                                ? <><div className="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full" />Connecting…</>
                                                : 'Connect with Google'}
                                        </button>
                                        <p className="text-xs text-muted mt-3">Your website must be verified in Google Search Console first.</p>
                                    </div>
                                ) : gscData.connected && !gscData.siteMatched ? (
                                    <div className="border border-amber-400/30 bg-amber-400/5 p-6 text-center">
                                        <p className="text-sm font-semibold text-amber-300 mb-1">Connected — but no matching property found</p>
                                        <p className="text-xs text-amber-400/80 mb-4">Make sure <strong>{website?.websiteLink}</strong> is verified in your Google Search Console account.</p>
                                        <button onClick={handleConnectGsc} className="text-xs underline text-amber-400 hover:text-amber-300">Reconnect</button>
                                    </div>
                                ) : (
                                    <div className="space-y-5">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {[
                                                { label: 'Total Clicks', value: gscData.summary?.clicks?.toLocaleString() ?? '0', sub: 'from Google Search' },
                                                { label: 'Impressions', value: gscData.summary?.impressions?.toLocaleString() ?? '0', sub: 'times shown' },
                                                { label: 'Avg. CTR', value: `${gscData.summary?.ctr ?? 0}%`, sub: 'click-through rate' },
                                                { label: 'Avg. Position', value: gscData.summary?.position ?? '—', sub: 'mean ranking' },
                                            ].map(({ label, value, sub }) => (
                                                <div key={label} className="border border-border p-5 bg-surface-1">
                                                    <p className="text-xs font-medium text-muted uppercase mb-1">{label}</p>
                                                    <p className="text-2xl font-bold text-white">{value}</p>
                                                    <p className="text-xs text-muted mt-1">{sub}</p>
                                                </div>
                                            ))}
                                        </div>
                                        {gscData.byDay?.length > 0 && (
                                            <div className="border border-border p-6 bg-surface-1">
                                                <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-4">Clicks per Day</p>
                                                <div className="flex items-end gap-1 h-24">
                                                    {(() => {
                                                        const max = Math.max(...gscData.byDay.map(d => d.clicks), 1);
                                                        return gscData.byDay.map((d: any, i: any) => (
                                                            <div key={i} className="flex-1 group relative">
                                                                <div style={{ height: `${(d.clicks / max) * 100}%` }} className="w-full bg-blue-500 hover:bg-blue-400 transition-colors min-h-[2px]" />
                                                                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs bg-black text-white px-1 py-0.5 opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-10">{d.clicks}</span>
                                                            </div>
                                                        ));
                                                    })()}
                                                </div>
                                                <div className="flex justify-between mt-2 text-xs text-muted">
                                                    <span>{gscData.byDay[0]?.date}</span>
                                                    <span>{gscData.byDay[gscData.byDay.length - 1]?.date}</span>
                                                </div>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div className="border border-border">
                                                <div className="px-4 py-3 border-b border-border text-sm font-semibold text-white">Top Search Queries</div>
                                                <div className="divide-y divide-border max-h-64 overflow-y-auto">
                                                    {gscData.topQueries?.length > 0 ? gscData.topQueries.map((q: any, i: any) => (
                                                        <div key={i} className="px-4 py-3">
                                                            <div className="flex items-center justify-between mb-0.5">
                                                                <span className="text-xs font-medium text-white truncate flex-1 mr-2">{q.query}</span>
                                                                <span className="text-xs text-muted shrink-0">{q.clicks} clicks</span>
                                                            </div>
                                                            <div className="flex items-center gap-3 text-xs text-muted">
                                                                <span>{q.impressions.toLocaleString()} imp.</span>
                                                                <span>{q.ctr}% CTR</span>
                                                                <span>#{q.position}</span>
                                                            </div>
                                                        </div>
                                                    )) : <div className="px-4 py-8 text-center text-sm text-muted">No query data yet</div>}
                                                </div>
                                            </div>
                                            <div className="border border-border">
                                                <div className="px-4 py-3 border-b border-border text-sm font-semibold text-white">Top Pages (Organic)</div>
                                                <div className="divide-y divide-border max-h-64 overflow-y-auto">
                                                    {gscData.topPages?.length > 0 ? gscData.topPages.map((p: any, i: any) => (
                                                        <div key={i} className="px-4 py-3">
                                                            <div className="flex items-center justify-between mb-0.5">
                                                                <span className="text-xs font-medium text-white truncate flex-1 mr-2">{p.page.replace(/^https?:\/\/[^/]+/, '') || '/'}</span>
                                                                <span className="text-xs text-muted shrink-0">{p.clicks} clicks</span>
                                                            </div>
                                                            <div className="flex items-center gap-3 text-xs text-muted">
                                                                <span>{p.impressions.toLocaleString()} imp.</span>
                                                                <span>{p.ctr}% CTR</span>
                                                                <span>#{p.position}</span>
                                                            </div>
                                                        </div>
                                                    )) : <div className="px-4 py-8 text-center text-sm text-muted">No page data yet</div>}
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted text-right">
                                            Connected to: {gscData.siteUrl} · {gscData.dateRange?.start} → {gscData.dateRange?.end}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
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
                            <button onClick={handleSaveLanguage} className="px-4 py-2 text-sm bg-white text-black font-medium hover:bg-zinc-200 transition-colors">Save</button>
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

            {/* Add ad space — full-screen overlay */}
            {categoriesForm && (
                <div className="fixed inset-0 z-50 bg-black overflow-y-auto">
                    <div className="sticky top-0 z-10 bg-black border-b border-border">
                        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
                            <p className="text-sm font-semibold text-white">Add New Ad Space</p>
                            <button onClick={handleCloseCategoriesForm} className="p-1.5 hover:bg-surface-2 border border-border transition-colors">
                                <X size={15} className="text-white" />
                            </button>
                        </div>
                    </div>
                    <div className="max-w-6xl mx-auto px-6 py-8">
                        <AddNewCategory
                            onSubmitSuccess={handleCloseCategoriesForm}
                            monthlyTraffic={analytics?.grantDisplay ? analytics.grantDisplay.grantedTraffic : website?.monthlyTraffic}
                            gscData={analytics?.grantDisplay ? undefined : gscData}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default WebsiteDetails;
