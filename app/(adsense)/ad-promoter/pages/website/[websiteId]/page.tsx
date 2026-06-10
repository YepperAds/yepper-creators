'use client';
// @ts-nocheck

// WebsiteDetails.js
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
} from 'lucide-react';
import { MasterIntegration } from '../../../_components/codeDisplay';
import AddNewCategory from '../../../_components/AddNewCategory';
import { Button, Card, CardContent, Heading, Text, Input, Badge, Grid, Container } from '@/app/(adsense)/components/components';
import LoadingSpinner from '@/app/(adsense)/components/LoadingSpinner';
import { useSession } from '@/app/_hooks/useSession';
import AdModalData from '@/app/(adsense)/ad-promoter/_components/adModalData'
import DeleteCategoryModal from '../../../_components/DeleteCategoryModal';
import AdCustomizationModal from '../../../_components/AdCustomizationModal';
import api from '@/app/_lib/adsense-api';

import TrafficGrantBanner from '../../../_components/TrafficGrantBanner';

const WebsiteDetails = () => {
    const router = useRouter();
    const { websiteId } = useParams();
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
    const [customizationModal, setCustomizationModal] = useState({
        isOpen: false,
        categoryId: null
    });

    // Analytics state
    const [analytics, setAnalytics] = useState(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [analyticsRange, setAnalyticsRange] = useState(30);
    const [earningsSummary, setEarningsSummary] = useState(null);
    const mapRef = useRef(null);
    const leafletMapRef = useRef(null);

    // Google Search Console state
    const [gscData, setGscData] = useState(null);
    const [gscLoading, setGscLoading] = useState(false);
    const [gscConnecting, setGscConnecting] = useState(false);
    useEffect(() => {
        fetchWebsiteData();
        if (token) {
            fetchAdsData();
            fetchWalletBalance();
        }
    }, [websiteId, isAuthenticated]);

    // Fetch earnings summary (traffic-based) whenever website or categories change
    useEffect(() => {
        if (!websiteId || !token) return;
        const fetchEarnings = async () => {
            try {
                const res = await api.get(`/api/websites/${websiteId}/earnings-summary`);
                setEarningsSummary((res.data as any));
            } catch (err: unknown) {
                // Non-fatal — earnings just won't show
                setEarningsSummary({ available: false, reason: 'error' });
            }
        };
        fetchEarnings();
    }, [websiteId, isAuthenticated, categories.length]); // re-fetch when categories count changes

    // Fetch GSC data on mount so tier is available when adding spaces
    useEffect(() => {
        if (token) { fetchGscData(); }
    }, [websiteId, isAuthenticated]); // eslint-disable-line

    // Fetch analytics when tab switches to analytics or range changes
    useEffect(() => {
        if (activeTab === 'analytics' && token) {
            fetchAnalytics();
            fetchGscData();
        }
    }, [activeTab, analyticsRange, isAuthenticated]);

    // Handle redirect back from Google OAuth (?gsc=connected)
    useEffect(() => {
        const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
        const gscStatus = params.get('gsc');
        const tab = params.get('tab');
        if (gscStatus && tab === 'analytics') {
            setActiveTab('analytics');
            // Clean the URL
            const url = new URL(window.location.href);
            url.searchParams.delete('gsc');
            url.searchParams.delete('tab');
            window.history.replaceState({}, '', url.toString());
        }
    }, []);

    // Init / re-render Leaflet map whenever analytics data arrives
    useEffect(() => {
        if (activeTab !== 'analytics' || !analytics?.mapPoints?.length) return;

        const init = () => {
            const container = mapRef.current;
            if (!container || !(window as any).L) return;

            // Destroy previous map instance to avoid "already initialized" error
            if (leafletMapRef.current) {
                leafletMapRef.current.remove();
                leafletMapRef.current = null;
            }

            const map = (window as any).L.map(container, { zoomControl: true }).setView([20, 0], 2);
            (window as any).L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18,
            }).addTo(map);

            analytics.mapPoints.forEach(pt => {
                const deviceColor = pt.device === 'mobile' ? '#3b82f6' : pt.device === 'tablet' ? '#8b5cf6' : '#10b981';
                const circle = (window as any).L.circleMarker([pt.lat, pt.lon], {
                    radius: 6,
                    fillColor: deviceColor,
                    color: '#fff',
                    weight: 1,
                    opacity: 0.9,
                    fillOpacity: 0.75,
                });
                circle.bindPopup(`<strong>${pt.city}, ${pt.country}</strong><br/>${pt.device}<br/>${new Date(pt.timestamp).toLocaleString()}`);
                circle.addTo(map);
            });

            leafletMapRef.current = map;
        };

        // Load Leaflet CSS + JS lazily if not already present
        if (!(window as any).L) {
            if (!document.getElementById('leaflet-css')) {
                const link = document.createElement('link');
                link.id = 'leaflet-css';
                link.rel = 'stylesheet';
                link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
                document.head.appendChild(link);
            }
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.onload = init;
            document.head.appendChild(script);
        } else {
            init();
        }

        return () => {
            if (leafletMapRef.current) {
                leafletMapRef.current.remove();
                leafletMapRef.current = null;
            }
        };
    }, [analytics, activeTab]);
    
    const { data: websites } = useQuery({
        queryKey: ['websites', user?._id || user?.id],
        queryFn: async () => {
            try {
                const userId = user?._id || user?.id;
                const response = await api.get(`/api/websites/${userId}`);
                return (response.data as any);
            } catch (err: unknown) {
                throw error;
            }
        },
        enabled: !!(user?._id || user?.id) && !!token,
    });

    const languages = [
        { value: 'english', label: 'English' },
        { value: 'french', label: 'French (Français)' },
        { value: 'kinyarwanda', label: 'Kinyarwanda' },
        { value: 'kiswahili', label: 'Swahili' },
        { value: 'chinese', label: 'Chinese (中文)' },
        { value: 'spanish', label: 'Spanish (Español)' }
    ];

    const fetchWebsiteData = async () => {
        setLoading(true);
        setFetchError(null);

        try {
            const websiteResponse = await api.get(`/api/websites/website/${websiteId}`);
            const categoriesResponse = await api.get(`/api/ad-categories/${websiteId}`);
            setWebsite(websiteResponse.data);
            setCategories(categoriesResponse.data.categories);
            setLoading(false);
        } catch (err: unknown) {
            setFetchError((error as any).message || 'Failed to load website data');
            setLoading(false);
        }
    };

    const fetchAdsData = async () => {
        if (!token) return;
        
        setAdsLoading(true);
        try {
            const [pendingResponse, activeResponse] = await Promise.all([
                api.get('/api/ad-categories/pending-rejections'),
                api.get('/api/ad-categories/active-ads')
            ]);

            setPendingAds(pendingResponse.data.pendingAds || []);
            setActiveAds(activeResponse.data.activeAds || []);
        } catch (err: unknown) {
            setPendingAds([]);
            setActiveAds([]);
        } finally {
            setAdsLoading(false);
        }
    };

    const fetchWalletBalance = async () => {
        if (!token) return;
        
        try {
            const response = await api.get('/api/ad-categories/wallet');
            setWalletBalance((response.data as any).wallet?.balance || 0);
        } catch (err: unknown) {
        }
    };

    const fetchAnalytics = async () => {
        if (!token) return;
        setAnalyticsLoading(true);
        try {
            const response = await api.get(`/api/analytics/${websiteId}?range=${analyticsRange}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setAnalytics((response.data as any));
        } catch (err: unknown) {
            console.error('Failed to fetch analytics', err);
        } finally {
            setAnalyticsLoading(false);
        }
    };

    const fetchGscData = async () => {
        if (!token) return;
        setGscLoading(true);
        try {
            const response = await api.get(`/api/analytics/gsc/data/${websiteId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setGscData((response.data as any));
        } catch (err: unknown) {
            console.error('Failed to fetch GSC data', err);
        } finally {
            setGscLoading(false);
        }
    };

    const handleConnectGsc = async () => {
        if (!token) return;
        setGscConnecting(true);
        try {
            const response = await api.get(`/api/analytics/gsc/connect/${websiteId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            // Redirect the user to Google's OAuth consent screen
            window.location.href = (response.data as any).url;
        } catch (err: unknown) {
            console.error('Failed to start GSC connect', err);
            setGscConnecting(false);
        }
    };

    const handleDisconnectGsc = async () => {
        if (!window.confirm('Disconnect Google Search Console from this website?')) return;
        try {
            await api.delete(`/api/analytics/gsc/disconnect/${websiteId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setGscData(null);
        } catch (err: unknown) {
            console.error('Failed to disconnect GSC', err);
        }
    };

    const getAdsForWebsite = (websiteId) => {
        const pending = pendingAds.filter(ad => 
            ad.websiteSelections?.some(sel => 
                sel.websiteId === websiteId && sel.approved && !sel.isRejected
            )
        );
        
        const active = activeAds.filter(ad => 
            ad.websiteSelections?.some(sel => 
                sel.websiteId === websiteId && sel.approved && !sel.isRejected && sel.status === 'active'
            )
        );
        
        return { pending, active };
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount || 0);
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getTimeRemaining = (deadline) => {
        const now = new Date();
        const timeLeft = new Date(deadline) - now;
        
        if (timeLeft <= 0) return 'Expired';
        
        const minutes = Math.floor(timeLeft / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
        
        return `${minutes}m ${seconds}s`;
    };

    const handleOpenCustomization = (categoryId) => {
        setCustomizationModal({
            isOpen: true,
            categoryId: categoryId
        });
    };

    const handleCloseCustomization = () => {
        setCustomizationModal({
            isOpen: false,
            categoryId: null
        });
    };

    const handleCustomizationSave = (settings) => {
        // Refresh the category data to show updated customization
        fetchWebsiteData();
        alert('Ad customization saved successfully!');
    };

    const handleRejectAd = async () => {
        if (!selectedAd || !rejectionReason.trim()) return;

        setRejecting(selectedAd._id);
        try {
            const websiteSelection = selectedAd.websiteSelections.find(sel => sel.approved && !sel.isRejected);
            
            await api.post(
                `/ad-categories/reject/${selectedAd._id}/${websiteSelection.websiteId}/${websiteSelection.categories[0]}`,
                { rejectionReason: rejectionReason.trim() }
            );

            // Refresh data
            fetchAdsData();
            fetchWalletBalance();
            
            setShowRejectModal(false);
            setSelectedAd(null);
            setRejectionReason('');
            
        } catch (err: unknown) {
        } finally {
            setRejecting(null);
        }
    };

    const closeRejectModal = () => {
        setShowRejectModal(false);
        setSelectedAd(null);
        setRejectionReason('');
    };

    const handleUpdateWebsiteName = async () => {
        if (!tempWebsiteName.trim()) return;

        try {
            const response = await api.patch(`/api/websites/${websiteId}/name`, {
                websiteName: tempWebsiteName.trim()
            });
            
            setWebsite(prevWebsite => ({
                ...prevWebsite,
                websiteName: (response.data as any).websiteName
            }));
            
            setIsEditingWebsiteName(false);
        } catch (err: unknown) {
        }
    };

    const handleStartEditWebsiteName = () => {
        setTempWebsiteName(website.websiteName);
        setIsEditingWebsiteName(true);
    };

    const handleCancelEditWebsiteName = () => {
        setIsEditingWebsiteName(false);
    };

    const handleOpenCategoriesForm = () => {
        setCategoriesForm(true);
        setResult(false);
    };

    const handleCloseCategoriesForm = () => {
        setCategoriesForm(false);
        setResult(true);
        fetchWebsiteData();
    };

    const handleDeleteCategory = (category) => {
        setCategoryToDelete(category);
    };

    const handleDeleteSuccess = () => {
        setCategoryToDelete(null);
        fetchWebsiteData();
    };

    // Called from MasterIntegration when user sets language for all spaces at once
    const handleAllSpacesLanguageChange = async (lang) => {
        try {
            await Promise.all(
                categories.map(cat =>
                    api.patch(`/api/ad-categories/category/${cat._id}/language`, { defaultLanguage: lang })
                )
            );
            setCategories(categories.map(cat => ({ ...cat, defaultLanguage: lang })));
        } catch (err: unknown) {
            // silently ignore — UI already updated optimistically
        }
    };

    const handleSaveLanguage = async () => {
        if (!currentCategory) return;
        
        try {
            setCategories(categories.map(cat => 
                cat._id === currentCategory._id 
                    ? { ...cat, defaultLanguage: selectedLanguage } 
                    : cat
            ));
            
            setIsLanguageModalOpen(false);
            setCurrentCategory(null);
            
        } catch (err: unknown) {
        }
    };

    const openRejectModal = (ad) => {
        const websiteSelection = ad.websiteSelections.find(sel => sel.approved && !sel.isRejected);
        if (!websiteSelection) return;

        const paymentAmount = ad.paymentAmount || 0;
        if (walletBalance < paymentAmount) {
        alert('Insufficient balance in your wallet to process this rejection. Please contact support.');
        return;
        }

        setSelectedAd(ad);
        setShowRejectModal(true);
    };

    const openAdModal = (ad, websiteId) => {
        const currentWebsite = websites?.find(w => (w._id || w.id) === websiteId);
        const websiteSelection = ad.websiteSelections?.find(sel => 
            sel.websiteId === websiteId
        );

        const adData = {
            ...ad,
            currentWebsite,
            websiteSelection,
            status: websiteSelection?.status || 'pending'
        };

        setAdModalData(adData);
        setShowAdModal(true);
    };

    const closeAdModal = () => {
        setShowAdModal(false);
        setAdModalData(null);
    };

    if (loading) {
        return <LoadingSpinner />;
    }

    if (fetchError) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center max-w-md">
                    <AlertCircle className="w-12 h-12 text-error mx-auto mb-4" />
                    <Heading level={2} className="mb-2">Failed to Load Data</Heading>
                    <Text variant="muted" className="mb-6">{fetchError}</Text>
                    <Button onClick={fetchWebsiteData} variant="primary">
                        Try Again
                    </Button>
                </div>
            </div>
        );
    }

    // Get ads for this website
    const { pending, active } = website ? getAdsForWebsite(website.id) : { pending: [], active: [] };

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b border-border bg-background">
                <Container>
                    <div className="h-16 flex items-center justify-between">
                        <button 
                            onClick={() => router.back()} 
                            className="flex items-center text-subtle hover:text-white transition-colors"
                        >
                            <ArrowLeft size={18} className="mr-2" />
                            <span className="font-medium">Back</span>
                        </button>
                        <Badge variant="default">Website Details</Badge>
                    </div>
                </Container>
            </header>

            {result && (
                <Container className="py-12">
                    <div className="text-center mb-12">
                        <div className="mb-8">
                            {isEditingWebsiteName ? (
                                <div className="flex items-center justify-center gap-2 max-w-md mx-auto">
                                    <Input 
                                        type="text"
                                        value={tempWebsiteName}
                                        onChange={(e: any) => setTempWebsiteName(e.target.value)}
                                        className="text-center text-2xl font-bold"
                                        autoFocus
                                        onKeyDown={(e: any) => {
                                            if (e.key === 'Enter') handleUpdateWebsiteName();
                                            if (e.key === 'Escape') handleCancelEditWebsiteName();
                                        }}
                                    />
                                    <button 
                                        onClick={handleUpdateWebsiteName}
                                        className="p-2 text-white hover:bg-surface-2 border border-border"
                                    >
                                        <Check className="w-5 h-5" />
                                    </button>
                                    <button 
                                        onClick={handleCancelEditWebsiteName}
                                        className="p-2 text-white hover:bg-surface-2 border border-border"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            ) : (
                                <div 
                                    className="flex items-center justify-center gap-2 group cursor-pointer"
                                    onClick={handleStartEditWebsiteName}
                                >
                                    <Heading level={1} className="text-center">
                                        {website?.websiteName}
                                    </Heading>
                                    <Edit 
                                        className="w-5 h-5 text-muted opacity-0 group-hover:opacity-100 transition-opacity" 
                                    />
                                </div>
                            )}
                        </div>
                        
                        {website?.websiteLink && (
                            <div className="mb-8">
                                <a 
                                    href={website.websiteLink} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center space-x-2 text-subtle hover:text-white transition-colors"
                                >
                                    <span>{website.websiteLink}</span>
                                </a>
                            </div>
                        )}

                        <TrafficGrantBanner websiteId={websiteId} />

                        {/* Tabs */}
                        <div className="flex justify-center">
                            <div className="border border-border inline-flex">
                                <button
                                    onClick={() => setActiveTab('spaces')}
                                    className={`px-6 py-2 font-medium transition-all ${
                                        activeTab === 'spaces' 
                                            ? 'bg-black text-white' 
                                            : 'bg-surface-1 text-white hover:bg-surface-2'
                                    }`}
                                >
                                    Ad Spaces
                                </button>
                                <button
                                    onClick={() => setActiveTab('ads')}
                                    className={`px-6 py-2 font-medium transition-all border-l border-border ${
                                        activeTab === 'ads' 
                                            ? 'bg-black text-white' 
                                            : 'bg-surface-1 text-white hover:bg-surface-2'
                                    }`}
                                >
                                    Ads
                                </button>
                                <button
                                    onClick={() => setActiveTab('customize')}
                                    className={`px-6 py-2 font-medium transition-all border-l border-border ${
                                        activeTab === 'customize' 
                                            ? 'bg-black text-white' 
                                            : 'bg-surface-1 text-white hover:bg-surface-2'
                                    }`}
                                >
                                    Customize Ads
                                </button>
                                <button
                                    onClick={() => setActiveTab('analytics')}
                                    className={`px-6 py-2 font-medium transition-all border-l border-border ${
                                        activeTab === 'analytics' 
                                            ? 'bg-black text-white' 
                                            : 'bg-surface-1 text-white hover:bg-surface-2'
                                    }`}
                                >
                                    Analytics
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    {activeTab === 'spaces' && (
                        <div>
                            {/* ── Script Installation Gate ── */}
                            {!earningsSummary?.scriptInstalled && (
                                <div className="mb-8 border-2 border-dashed border-yellow-400 bg-warning/10 rounded-xl p-8 text-center">
                                    <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-yellow-100 border-2 border-yellow-400 flex items-center justify-center text-3xl">
                                        📡
                                    </div>
                                    <h3 className="text-xl font-bold text-yellow-900 mb-2">Install Your Yepper Script First</h3>
                                    <p className="text-sm text-warning max-w-xl mx-auto mb-6">
                                        Install the Yepper tracking script on your site to track your real traffic and unlock tier-based pricing.
                                        You can add ad spaces now — they'll run on the Unverified tier (RWF 63,000 total cap) until your script is detected.
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto text-left mb-6">
                                        {[
                                            { step: '1', title: 'Copy the script below', desc: 'Pick your framework and copy the integration code.' },
                                            { step: '2', title: 'Paste it on your site', desc: 'Follow the step-by-step guide for your framework.' },
                                            { step: '3', title: 'Traffic detected → tier upgrade', desc: 'Once visitors are tracked, your tier upgrades and prices update automatically.' },
                                        ].map(({ step, title, desc }) => (
                                            <div key={step} className="flex gap-3 bg-surface-1 border border-warning/30 rounded-lg p-3">
                                                <div className="w-7 h-7 rounded-full bg-yellow-400 text-yellow-900 flex items-center justify-center font-bold text-sm shrink-0">{step}</div>
                                                <div>
                                                    <p className="text-sm font-semibold text-subtle">{title}</p>
                                                    <p className="text-xs text-muted mt-0.5">{desc}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-warning">
                                        ✅ Scroll down to see the integration code for your framework.
                                    </p>
                                </div>
                            )}

                            {/* ── GSC Unverified Warning (shown after script installed but no GSC) ── */}
                            {!earningsSummary?.gscVerified && (
                                <div className={`mb-6 border rounded-xl p-5 ${earningsSummary?.unverifiedSurchargeActive ? 'border-red-300 bg-error/10' : 'border-orange-300 bg-warning/10'}`}>
                                    <div className="flex items-start gap-4">
                                        <div className="text-2xl shrink-0">{earningsSummary?.unverifiedSurchargeActive ? '⚠️' : '🔍'}</div>
                                        <div>
                                            <h4 className={`font-bold mb-1 ${earningsSummary?.unverifiedSurchargeActive ? 'text-error' : 'text-warning'}`}>
                                                {earningsSummary?.unverifiedSurchargeActive
                                                    ? 'Unverified Site — Ad Prices at 4× Rate'
                                                    : 'Connect Google Search Console to Verify Your Site'}
                                            </h4>
                                            <p className={`text-sm ${earningsSummary?.unverifiedSurchargeActive ? 'text-error' : 'text-warning'}`}>
                                                {earningsSummary?.unverifiedSurchargeActive
                                                    ? 'Your site has been running for 7+ days without GSC verification. Ad spaces are currently priced at 4× the standard rate until you verify. Connect Google Search Console in the Analytics tab to restore normal pricing.'
                                                    : 'Connect Google Search Console in the Analytics tab to verify your site and unlock tier-based pricing. Your ad spaces are currently on the Unverified tier (RWF 63,000 total cap split across all spaces).'}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setActiveTab('analytics')}
                                            className="shrink-0 px-4 py-2 bg-black text-white text-xs font-semibold rounded-lg hover:bg-gray-800 transition-colors"
                                        >
                                            Go to Analytics
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ── Verified badge ── */}
                            {earningsSummary?.gscVerified && (
                                <div className="mb-6 border border-green-300 bg-success/10 rounded-xl p-4 flex items-center gap-3">
                                    <span className="text-2xl">✅</span>
                                    <div>
                                        <p className="text-sm font-bold text-success">Site Verified — Standard Pricing Active</p>
                                        <p className="text-xs text-success mt-0.5">Your script is installed and your site is verified in Google Search Console. Your ad spaces use tier-based pricing based on your real traffic.</p>
                                    </div>
                                </div>
                            )}

                            {/* ── Earnings Panel — shown only when real traffic is detected ── */}
                            {earningsSummary?.available ? (
                                <div className="mb-6 border border-green-700 bg-success/10 p-5 rounded-none">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <p className="text-sm font-bold text-success">💰 Your Estimated Monthly Earnings</p>
                                            <p className="text-xs text-success mt-0.5">
                                                Based on {Number(earningsSummary.monthlyTraffic).toLocaleString()} visitors/month detected by your Yepper script
                                                &nbsp;·&nbsp; <span className="capitalize font-semibold">{earningsSummary.trafficTier}</span> tier
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-2xl font-bold text-success">
                                                RWF {Number(earningsSummary.totalOwnerEarnsPerMonth).toLocaleString()}
                                            </p>
                                            <p className="text-xs text-success">total / month across all spaces</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mt-3">
                                        {earningsSummary.categories?.map(c => (
                                            <div key={c.categoryId} className="flex items-center justify-between bg-surface-1 border border-success/30 px-3 py-2 text-xs">
                                                <span className="text-subtle font-medium truncate mr-2">{c.name}</span>
                                                <span className="text-success font-bold whitespace-nowrap">
                                                    RWF {Number(c.ownerEarns).toLocaleString()}/mo
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : earningsSummary?.reason === 'no_traffic' ? (
                                <div className="mb-6 border border-border bg-surface-2 p-5">
                                    <p className="text-sm font-semibold text-subtle mb-1">📡 Install your script to see earnings</p>
                                    <p className="text-xs text-muted">
                                        {earningsSummary.message || 'Add the Yepper script below to your site. Once we detect visitors, your earnings per ad space will appear here — calculated from your real traffic.'}
                                    </p>
                                </div>
                            ) : null}

                            {/* Master Integration Container */}
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

                    {activeTab === 'ads' && (
                        <div>
                            {adsLoading ? (
                                <div className="flex justify-center py-12">
                                    <LoadingSpinner />
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    {pending.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-3 mb-6">
                                                <Heading level={2}>Pending Review</Heading>
                                            </div>
                                            
                                            <Grid cols={2} gap={4}>
                                                {pending.map((ad: any) => {
                                                    const activeSelection = ad.websiteSelections.find(sel => sel.approved && !sel.isRejected);
                                                    const timeRemaining = activeSelection?.rejectionDeadline ? 
                                                        getTimeRemaining(activeSelection.rejectionDeadline) : 'No deadline';
                                                    
                                                    return (
                                                        <Card key={ad._id} className="border-warning/30 bg-warning/10">
                                                            <CardContent className="p-4">
                                                                <div className="flex justify-between items-start mb-3">
                                                                    <div className="flex items-center">
                                                                        {ad.imageUrl && (
                                                                            <img 
                                                                                src={ad.imageUrl} 
                                                                                alt={ad.businessName}
                                                                                className="w-10 h-10 object-cover rounded mr-3"
                                                                            />
                                                                        )}
                                                                        <div>
                                                                            <Heading level={4}>{ad.businessName}</Heading>
                                                                            <Text variant="small" className="text-orange-600">{timeRemaining}</Text>
                                                                        </div>
                                                                    </div>
                                                                    <Badge variant="secondary">{formatCurrency(ad.paymentAmount)}</Badge>
                                                                </div>
                                                                
                                                                <Text className="mb-4 text-subtle">{ad.adDescription}</Text>
                                                                
                                                                <div className="flex gap-2">
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="flex-1"
                                                                        onClick={() => window.open(ad.imageUrl || ad.videoUrl, '_blank')}
                                                                    >
                                                                        View
                                                                    </Button>
                                                                    <Button
                                                                        variant="danger"
                                                                        size="sm"
                                                                        className="flex-1"
                                                                        onClick={() => openRejectModal(ad)}
                                                                        disabled={rejecting === ad._id || walletBalance < (ad.paymentAmount || 0)}
                                                                        icon={rejecting === ad._id ? RefreshCw : XCircle}
                                                                        iconPosition="left"
                                                                    >
                                                                        {rejecting === ad._id ? 'Rejecting...' : 'Reject'}
                                                                    </Button>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    );
                                                })}
                                            </Grid>
                                        </div>
                                    )}

                                    {active.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-3 mb-6">
                                                <Heading level={2}>Active Ads</Heading>
                                            </div>
                                            
                                            <Grid cols={2} gap={6}>
                                                {active.map((ad: any) => (
                                                    <div
                                                        key={ad._id}
                                                        className="border border-border bg-surface-2 overflow-hidden"
                                                    >
                                                        {ad.imageUrl && (
                                                            <div className="relative h-48 w-full bg-surface-3">
                                                                <img 
                                                                    src={ad.imageUrl} 
                                                                    alt={ad.businessName}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                                <Badge variant='info' className="absolute top-4 left-4">
                                                                    Active
                                                                </Badge>
                                                            </div>
                                                        )}
                                                        
                                                        {/* Ad Content */}
                                                        <div className="p-4">
                                                            <div className="flex justify-between items-start mb-3">
                                                                <div className="flex-1">
                                                                    <h4 className="text-lg font-bold text-white mb-1">{ad.businessName}</h4>
                                                                    <p className="text-sm text-subtle mb-3 line-clamp-2">{ad.adDescription}</p>
                                                                </div>
                                                            </div>
                                                        
                                                            <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-surface-1 rounded border">
                                                                <div className="text-center">
                                                                    <div className="text-xl font-bold text-white">{ad.views || 0}</div>
                                                                    <div className="text-xs text-subtle">Views</div>
                                                                </div>
                                                                <div className="text-center">
                                                                    <div className="text-xl font-bold text-white">{ad.clicks || 0}</div>
                                                                    <div className="text-xs text-subtle">Clicks</div>
                                                                </div>
                                                            </div>
                                                        
                                                        <Button
                                                            variant="secondary"
                                                            size="sm"
                                                            className="w-full"
                                                            onClick={() => openAdModal(ad, website.id)}
                                                        >
                                                            View Full Ad
                                                        </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </Grid>
                                        </div>
                                    )}

                                    {pending.length === 0 && active.length === 0 && (
                                        <Card className="p-12 text-center">
                                            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-muted" />
                                            <Heading level={3} className="mb-3">No Ads Yet</Heading>
                                            <Text variant="muted">
                                                This website doesn't have any ads running yet. Ads will appear here once they're approved and active.
                                            </Text>
                                        </Card>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {showAdModal && adModalData && (
                        <AdModalData 
                            adModalData={adModalData} 
                            closeAdModal={closeAdModal}
                            formatCurrency={formatCurrency}
                            formatDate={formatDate}
                            getTimeRemaining={getTimeRemaining}
                        />
                    )}
                    
                    {activeTab === 'customize' && (
                        <div>
                            <div className="mb-8 text-center">
                            <Heading level={2} className="mb-3">Customize Your Ad Spaces</Heading>
                            <Text variant="muted" className="max-w-2xl mx-auto">
                                Design how ads appear on your website. Each ad space can have its own unique styling 
                                to match your site's design perfectly.
                            </Text>
                            </div>

                            {categories.length > 0 ? (
                            <Grid cols={2} gap={6}>
                                {categories.map((category: any) => (
                                <Card key={category._id} className="border-border">
                                    <CardContent className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                        <Badge variant="primary" className="mb-2">
                                            {category.spaceType}
                                        </Badge>
                                        <Heading level={4} className="mb-1">
                                            {category.categoryName}
                                        </Heading>
                                        <Text variant="small" className="text-subtle">
                                            {category.customization ? 'Customized' : 'Default styling'}
                                        </Text>
                                        </div>
                                        <Palette className="text-muted" size={24} />
                                    </div>

                                    {/* Preview of current customization */}
                                    {category.customization && (
                                        <div className="mb-4 p-3 bg-surface-2 rounded-lg">
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                            <Text variant="small" className="text-muted">Size</Text>
                                            <Text variant="small" className="font-medium">
                                                {category.customization.width}×{category.customization.height}px
                                            </Text>
                                            </div>
                                            <div>
                                            <Text variant="small" className="text-muted">Layout</Text>
                                            <Text variant="small" className="font-medium capitalize">
                                                {category.customization.orientation || 'horizontal'}
                                            </Text>
                                            </div>
                                            <div>
                                            <Text variant="small" className="text-muted">Border Radius</Text>
                                            <Text variant="small" className="font-medium">
                                                {category.customization.borderRadius || 16}px
                                            </Text>
                                            </div>
                                            <div>
                                            <Text variant="small" className="text-muted">Effects</Text>
                                            <Text variant="small" className="font-medium">
                                                {category.customization.glassmorphism ? 'Glass' : 'Solid'}
                                            </Text>
                                            </div>
                                        </div>
                                        </div>
                                    )}

                                    <Button
                                        onClick={() => handleOpenCustomization(category._id)}
                                        variant="secondary"
                                        size="sm"
                                        icon={Palette}
                                        iconPosition="left"
                                        className="w-full"
                                    >
                                        {category.customization ? 'Edit Customization' : 'Customize Ad Space'}
                                    </Button>
                                    </CardContent>
                                </Card>
                                ))}
                            </Grid>
                            ) : (
                            <Card className="p-12 text-center">
                                <Palette className="w-16 h-16 mx-auto mb-4 text-muted" />
                                <Heading level={3} className="mb-3">No Ad Spaces to Customize</Heading>
                                <Text variant="muted" className="mb-6">
                                Create an ad space first, then you can customize how ads appear.
                                </Text>
                                <Button
                                onClick={handleOpenCategoriesForm}
                                variant="secondary"
                                icon={Plus}
                                iconPosition="left"
                                >
                                Create Ad Space
                                </Button>
                            </Card>
                            )}
                        </div>
                    )}

                    {activeTab === 'analytics' && (
                        <div className="space-y-8">
                            {/* Header + range selector */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold text-white">Website Analytics</h2>
                                    <p className="text-sm text-muted mt-1">Real visitor data collected by your Yepper script</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {[7, 30, 90].map(d => (
                                        <button key={d}
                                            onClick={() => setAnalyticsRange(d)}
                                            className={`px-4 py-2 text-sm border border-border font-medium transition-colors ${analyticsRange === d ? 'bg-black text-white' : 'bg-surface-1 text-white hover:bg-surface-3'}`}
                                        >
                                            {d}d
                                        </button>
                                    ))}
                                    <button onClick={fetchAnalytics} className="px-4 py-2 text-sm border border-border bg-surface-1 hover:bg-surface-3 flex items-center gap-1">
                                        <RefreshCw size={14} /> Refresh
                                    </button>
                                </div>
                            </div>

                            {analyticsLoading ? (
                                <div className="flex items-center justify-center h-64">
                                    <div className="text-center">
                                        <div className="animate-spin w-8 h-8 border-2 border-border border-t-transparent rounded-full mx-auto mb-3" />
                                        <p className="text-muted text-sm">Loading analytics...</p>
                                    </div>
                                </div>
                            ) : !analytics ? (
                                <div className="border border-border p-12 text-center">
                                    <BarChart2 size={48} className="mx-auto mb-4 text-muted" />
                                    <h3 className="text-lg font-semibold mb-2">No data yet</h3>
                                    <p className="text-muted text-sm max-w-md mx-auto">
                                        Install your Yepper script on your website and visitor data will appear here automatically.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {/* KPI cards */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {[
                                            { label: 'Total Views', value: analytics.totalViews?.toLocaleString() || '0', icon: Eye },
                                            { label: 'Unique Visitors', value: analytics.uniqueVisitors?.toLocaleString() || '0', icon: Users },
                                            { label: 'Monthly Traffic', value: analytics.monthlyTraffic?.toLocaleString() || '0', icon: TrendingUp },
                                            { label: 'Traffic Tier', value: analytics.trafficTier?.charAt(0).toUpperCase() + analytics.trafficTier?.slice(1) || 'Starter', icon: BarChart2 },
                                        ].map(({ label, value, icon: Icon }) => (
                                            <div key={label} className="border border-border p-5 bg-surface-1">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-xs font-medium text-muted uppercase">{label}</span>
                                                    <Icon size={16} className="text-muted" />
                                                </div>
                                                <p className="text-2xl font-bold text-white">{value}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Daily chart (simple SVG bar chart) */}
                                    {analytics.byDay?.length > 0 && (
                                        <div className="border border-border p-6 bg-surface-1">
                                            <h3 className="text-sm font-semibold text-subtle uppercase mb-4">Views per Day</h3>
                                            <div className="flex items-end gap-1 h-32">
                                                {(() => {
                                                    const max = Math.max(...analytics.byDay.map(d => d.count), 1);
                                                    return analytics.byDay.map((d: any, i: any) => (
                                                        <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                                                            <div
                                                                style={{ height: `${(d.count / max) * 100}%` }}
                                                                className="w-full bg-black hover:bg-gray-600 transition-colors min-h-[2px]"
                                                            />
                                                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs bg-black text-white px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-10">{d.count}</span>
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

                                    {/* Map + country breakdown side by side */}
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        {/* Leaflet map */}
                                        <div className="lg:col-span-2 border border-border">
                                            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                                                <MapPin size={14} className="text-muted" />
                                                <span className="text-sm font-semibold">Visitor Locations</span>
                                                <span className="ml-auto text-xs text-muted">{analytics.mapPoints?.length || 0} data points</span>
                                            </div>
                                            <div className="p-2">
                                                <div ref={mapRef} style={{ height: '340px', width: '100%' }} />
                                            </div>
                                            <div className="px-4 py-2 border-t border-border flex gap-4 text-xs text-muted">
                                                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-green-500" /> Desktop</span>
                                                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-blue-500" /> Mobile</span>
                                                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-violet-500" /> Tablet</span>
                                            </div>
                                        </div>

                                        {/* Country breakdown */}
                                        <div className="border border-border">
                                            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                                                <Globe size={14} className="text-muted" />
                                                <span className="text-sm font-semibold">Top Countries</span>
                                            </div>
                                            <div className="divide-y divide-gray-100 max-h-[380px] overflow-y-auto">
                                                {analytics.byCountry?.length > 0 ? analytics.byCountry.map((c: any, i: any) => {
                                                    const pct = analytics.totalViews > 0
                                                        ? Math.round((c.count / analytics.totalViews) * 100)
                                                        : 0;
                                                    return (
                                                        <div key={i} className="px-4 py-3">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="text-sm font-medium text-white">{c.country}</span>
                                                                <span className="text-sm text-muted">{c.count.toLocaleString()}</span>
                                                            </div>
                                                            <div className="w-full bg-surface-3 h-1.5">
                                                                <div className="h-1.5 bg-black" style={{ width: `${pct}%` }} />
                                                            </div>
                                                        </div>
                                                    );
                                                }) : (
                                                    <div className="px-4 py-8 text-center text-sm text-muted">No country data yet</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Device breakdown + top referrers + top pages */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {/* Devices */}
                                        <div className="border border-border">
                                            <div className="px-4 py-3 border-b border-border text-sm font-semibold">Devices</div>
                                            <div className="divide-y divide-gray-100">
                                                {analytics.byDevice?.length > 0 ? analytics.byDevice.map((d: any, i: any) => {
                                                    const Icon = d.device === 'mobile' ? Smartphone : d.device === 'tablet' ? Tablet : Monitor;
                                                    const pct = analytics.totalViews > 0 ? Math.round((d.count / analytics.totalViews) * 100) : 0;
                                                    return (
                                                        <div key={i} className="px-4 py-3 flex items-center gap-3">
                                                            <Icon size={16} className="text-muted shrink-0" />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex justify-between text-sm mb-1">
                                                                    <span className="capitalize">{d.device}</span>
                                                                    <span className="text-muted">{pct}%</span>
                                                                </div>
                                                                <div className="w-full bg-surface-3 h-1.5">
                                                                    <div className="h-1.5 bg-black" style={{ width: `${pct}%` }} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }) : (
                                                    <div className="px-4 py-8 text-center text-sm text-muted">No device data</div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Top referrers */}
                                        <div className="border border-border">
                                            <div className="px-4 py-3 border-b border-border text-sm font-semibold">Top Referrers</div>
                                            <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                                                {analytics.topReferrers?.length > 0 ? analytics.topReferrers.map((r: any, i: any) => (
                                                    <div key={i} className="px-4 py-3 flex items-center justify-between gap-2">
                                                        <span className="text-xs text-white truncate flex-1">{r.referrer || '(direct)'}</span>
                                                        <span className="text-xs text-muted shrink-0">{r.count}</span>
                                                    </div>
                                                )) : (
                                                    <div className="px-4 py-8 text-center text-sm text-muted">No referrer data</div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Top pages */}
                                        <div className="border border-border">
                                            <div className="px-4 py-3 border-b border-border text-sm font-semibold">Top Pages</div>
                                            <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                                                {analytics.topPages?.length > 0 ? analytics.topPages.map((p: any, i: any) => (
                                                    <div key={i} className="px-4 py-3 flex items-center justify-between gap-2">
                                                        <span className="text-xs text-white truncate flex-1">{p.path}</span>
                                                        <span className="text-xs text-muted shrink-0">{p.count}</span>
                                                    </div>
                                                )) : (
                                                    <div className="px-4 py-8 text-center text-sm text-muted">No page data</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* ── Granted Traffic Display Section ── */}
                            {analytics?.grantDisplay && (() => {
                                const gd = analytics.grantDisplay;
                                const TIER_COLORS = {
                                    elite:'#000',premium:'#f97316',standard:'#8b5cf6',
                                    basic:'#10b981',starter:'#3b82f6',unverified:'#f59e0b'
                                };
                                const tierColor = TIER_COLORS[gd.trafficTier] || '#888';
                                const hoursLeft = gd.grantWindowExpiresAt
                                    ? Math.max(0, Math.ceil((new Date(gd.grantWindowExpiresAt) - Date.now()) / (1000*60*60)))
                                    : 0;
                                return (
                                    <div className="mt-10">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                                    <span style={{fontSize:18}}>🎁</span>
                                                    Your Stated Traffic
                                                </h2>
                                                <p className="text-xs text-muted mt-0.5">
                                                    Numbers you provided via your analytics boost — shown separately from script-counted data
                                                    {hoursLeft > 0 && <span className="text-amber-500 ml-2">· Visible for {hoursLeft}h more</span>}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                                            <div className="border border-border p-5 bg-surface-1">
                                                <div className="text-xs font-medium text-muted uppercase mb-2">Monthly Visitors</div>
                                                <p className="text-2xl font-bold text-white">{gd.grantedTraffic?.toLocaleString() ?? '—'}</p>
                                                <div className="text-xs text-muted mt-1">as stated by you</div>
                                            </div>
                                            <div className="border border-border p-5 bg-surface-1">
                                                <div className="text-xs font-medium text-muted uppercase mb-2">Monthly Views</div>
                                                <p className="text-2xl font-bold text-white">{gd.grantedViews?.toLocaleString() ?? '—'}</p>
                                                <div className="text-xs text-muted mt-1">as stated by you</div>
                                            </div>
                                            <div className="border border-border p-5 bg-surface-1">
                                                <div className="text-xs font-medium text-muted uppercase mb-2">Traffic Tier</div>
                                                <p className="text-2xl font-bold capitalize" style={{color: tierColor}}>{gd.trafficTier}</p>
                                                <div className="text-xs text-muted mt-1">applied to your ad spaces</div>
                                            </div>
                                        </div>

                                        <div className="border border-border rounded-lg p-4 bg-surface-2 text-sm text-subtle">
                                            <span className="font-medium text-subtle">Note:</span> These numbers reflect what you reported and are used to set your tier and ad space pricing.
                                            They do not change what the Yepper script has counted from real visitors above, nor what Google Search Console reports below.
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* ── Google Search Console Section ── */}
                            <div className="mt-10">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M21.35 11.1h-9.17v2.73h5.51c-.33 1.81-1.87 3.14-3.77 3.14a5.02 5.02 0 01-5.03-5.02 5.02 5.02 0 015.03-5.02c1.22 0 2.33.44 3.19 1.16l2.02-2.02A8.46 8.46 0 0014.51 4c-4.69 0-8.5 3.8-8.5 8.5s3.81 8.5 8.5 8.5c4.91 0 8.17-3.45 8.17-8.3 0-.56-.06-1.1-.17-1.6h-1.16z" fill="#4285F4"/>
                                            </svg>
                                            Organic Traffic (Search Console)
                                        </h2>
                                        <p className="text-xs text-muted mt-0.5">Real clicks & impressions from Google Search — last 28 days</p>
                                    </div>
                                    {gscData?.connected && (
                                        <button
                                            onClick={handleDisconnectGsc}
                                            className="text-xs text-muted hover:text-red-500 transition-colors underline"
                                        >
                                            Disconnect
                                        </button>
                                    )}
                                </div>

                                {gscLoading ? (
                                    <div className="border border-border p-8 flex items-center justify-center gap-3">
                                        <div className="animate-spin w-5 h-5 border-2 border-border border-t-transparent rounded-full" />
                                        <span className="text-sm text-muted">Loading Search Console data...</span>
                                    </div>
                                ) : !gscData || !gscData.connected ? (
                                    /* Not connected yet */
                                    <div className="border border-dashed border-border p-10 text-center">
                                        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-surface-2 border border-border flex items-center justify-center">
                                            <svg width="28" height="28" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M43.6 20.2H24v7.3H35.2c-.9 4.8-5 8.4-11.2 8.4A13.4 13.4 0 0110.6 24a13.4 13.4 0 0113.4-13.4c3.2 0 6.2 1.2 8.5 3.1l5.4-5.4A22.5 22.5 0 0024 2C11.9 2 2 11.9 2 24s9.9 22 22 22c13.1 0 21.8-9.2 21.8-22.1 0-1.5-.2-2.9-.4-4.3l-1.8.6z" fill="#4285F4"/>
                                            </svg>
                                        </div>
                                        <h3 className="text-base font-semibold text-white mb-2">Connect Google Search Console</h3>
                                        <p className="text-sm text-muted mb-6 max-w-sm mx-auto">
                                            See how many people find your site through Google — total clicks, impressions, CTR, and top search queries.
                                        </p>
                                        <button
                                            onClick={handleConnectGsc}
                                            disabled={gscConnecting}
                                            className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-60"
                                        >
                                            {gscConnecting ? (
                                                <>
                                                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                                                    Connecting...
                                                </>
                                            ) : (
                                                <>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21.35 11.1h-9.17v2.73h5.51c-.33 1.81-1.87 3.14-3.77 3.14a5.02 5.02 0 01-5.03-5.02 5.02 5.02 0 015.03-5.02c1.22 0 2.33.44 3.19 1.16l2.02-2.02A8.46 8.46 0 0014.51 4c-4.69 0-8.5 3.8-8.5 8.5s3.81 8.5 8.5 8.5c4.91 0 8.17-3.45 8.17-8.3 0-.56-.06-1.1-.17-1.6h-1.16z" fill="white"/></svg>
                                                    Connect with Google
                                                </>
                                            )}
                                        </button>
                                        <p className="text-xs text-muted mt-3">Your website must be verified in Google Search Console first.</p>
                                    </div>
                                ) : gscData.connected && !gscData.siteMatched ? (
                                    /* Connected but no matching GSC property found */
                                    <div className="border border-yellow-300 bg-warning/10 p-6 text-center">
                                        <p className="text-sm font-semibold text-warning mb-1">Connected — but no matching property found</p>
                                        <p className="text-xs text-warning mb-4">
                                            Make sure <strong>{website?.websiteLink}</strong> is verified in your Google Search Console account.
                                        </p>
                                        <button onClick={handleConnectGsc} className="text-xs underline text-warning hover:text-yellow-900">
                                            Reconnect
                                        </button>
                                    </div>
                                ) : (
                                    /* Connected + data available */
                                    <div className="space-y-6">
                                        {/* KPI cards */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {[
                                                { label: 'Total Clicks', value: gscData.summary?.clicks?.toLocaleString() ?? '0', sub: 'from Google Search' },
                                                { label: 'Impressions', value: gscData.summary?.impressions?.toLocaleString() ?? '0', sub: 'times shown in results' },
                                                { label: 'Avg. CTR', value: `${gscData.summary?.ctr ?? 0}%`, sub: 'click-through rate' },
                                                { label: 'Avg. Position', value: gscData.summary?.position ?? '—', sub: 'mean ranking position' },
                                            ].map(({ label, value, sub }) => (
                                                <div key={label} className="border border-border p-5 bg-surface-1">
                                                    <p className="text-xs font-medium text-muted uppercase mb-1">{label}</p>
                                                    <p className="text-2xl font-bold text-white">{value}</p>
                                                    <p className="text-xs text-muted mt-1">{sub}</p>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Clicks by day sparkline */}
                                        {gscData.byDay?.length > 0 && (
                                            <div className="border border-border p-6 bg-surface-1">
                                                <h3 className="text-sm font-semibold text-subtle uppercase mb-4">Clicks per Day</h3>
                                                <div className="flex items-end gap-1 h-24">
                                                    {(() => {
                                                        const max = Math.max(...gscData.byDay.map(d => d.clicks), 1);
                                                        return gscData.byDay.map((d: any, i: any) => (
                                                            <div key={i} className="flex-1 flex flex-col items-center group relative">
                                                                <div
                                                                    style={{ height: `${(d.clicks / max) * 100}%` }}
                                                                    className="w-full bg-blue-500 hover:bg-blue-400 transition-colors min-h-[2px]"
                                                                />
                                                                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs bg-black text-white px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-10">{d.clicks}</span>
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

                                        {/* Top queries + Top pages side by side */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Top queries */}
                                            <div className="border border-border">
                                                <div className="px-4 py-3 border-b border-border text-sm font-semibold">Top Search Queries</div>
                                                <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                                                    {gscData.topQueries?.length > 0 ? gscData.topQueries.map((q: any, i: any) => (
                                                        <div key={i} className="px-4 py-3">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="text-xs font-medium text-white truncate flex-1 mr-2">{q.query}</span>
                                                                <span className="text-xs text-muted shrink-0">{q.clicks} clicks</span>
                                                            </div>
                                                            <div className="flex items-center gap-3 text-xs text-muted">
                                                                <span>{q.impressions.toLocaleString()} imp.</span>
                                                                <span>{q.ctr}% CTR</span>
                                                                <span>#{q.position}</span>
                                                            </div>
                                                        </div>
                                                    )) : (
                                                        <div className="px-4 py-8 text-center text-sm text-muted">No query data yet</div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Top pages */}
                                            <div className="border border-border">
                                                <div className="px-4 py-3 border-b border-border text-sm font-semibold">Top Pages (Organic)</div>
                                                <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                                                    {gscData.topPages?.length > 0 ? gscData.topPages.map((p: any, i: any) => (
                                                        <div key={i} className="px-4 py-3">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="text-xs font-medium text-white truncate flex-1 mr-2">{p.page.replace(/^https?:\/\/[^/]+/, '') || '/'}</span>
                                                                <span className="text-xs text-muted shrink-0">{p.clicks} clicks</span>
                                                            </div>
                                                            <div className="flex items-center gap-3 text-xs text-muted">
                                                                <span>{p.impressions.toLocaleString()} imp.</span>
                                                                <span>{p.ctr}% CTR</span>
                                                                <span>#{p.position}</span>
                                                            </div>
                                                        </div>
                                                    )) : (
                                                        <div className="px-4 py-8 text-center text-sm text-muted">No page data yet</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <p className="text-xs text-muted text-right">
                                            Connected to: {gscData.siteUrl} · Data: {gscData.dateRange?.start} → {gscData.dateRange?.end}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </Container>
            )}

            {/* Language Modal */}
            {isLanguageModalOpen && currentCategory && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b border-border">
                            <Heading level={3}>Set Default Language</Heading>
                            <Text variant="muted" className="mt-1">
                                Choose the default language for your ad space.
                            </Text>
                        </div>
                        
                        <div className="p-4 overflow-y-auto flex-1">
                            <div className="grid grid-cols-2 gap-2">
                                {languages.map(lang => (
                                    <div 
                                        key={lang.value}
                                        className={`p-2 text-sm border cursor-pointer transition-all ${
                                            selectedLanguage === lang.value
                                                ? 'border-border bg-surface-2'
                                                : 'border-border hover:border-border'
                                        }`}
                                        onClick={() => setSelectedLanguage(lang.value)}
                                    >
                                        <div className="flex items-center">
                                            {selectedLanguage === lang.value && (
                                                <div className="w-4 h-4 bg-black flex items-center justify-center mr-2">
                                                    <Check size={10} className="text-white" />
                                                </div>
                                            )}
                                            <span>{lang.label}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <div className="p-4 border-t border-border flex justify-end gap-2">
                            <Button
                                onClick={() => setIsLanguageModalOpen(false)}
                                variant="outline"
                                size="sm"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSaveLanguage}
                                variant="primary"
                                size="sm"
                            >
                                Save
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Rejection Modal */}
            {showRejectModal && selectedAd && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-surface-1 border border-border max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-4">
                            <Heading level={3}>Reject Ad</Heading>
                            <button
                                onClick={closeRejectModal}
                                className="text-muted hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="mb-4">
                            <Text className="mb-2">
                                Rejecting: <strong>{selectedAd.businessName}</strong>
                            </Text>
                            <Text className="mb-4">
                                Refund: <strong>{formatCurrency(selectedAd.paymentAmount)}</strong>
                            </Text>
                        </div>
                        
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-white mb-2">
                                Reason for rejection
                            </label>
                            <textarea
                                value={rejectionReason}
                                onChange={(e: any) => setRejectionReason(e.target.value)}
                                className="w-full px-3 py-2 border border-border bg-surface-1 text-white placeholder-muted focus:outline-none focus:ring-0"
                                rows={3}
                                placeholder="Why are you rejecting this ad?"
                                required
                            />
                        </div>
                        
                        <div className="flex justify-end gap-3">
                            <Button
                                variant="outline"
                                onClick={closeRejectModal}
                                disabled={rejecting === selectedAd._id}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="danger"
                                onClick={handleRejectAd}
                                disabled={!rejectionReason.trim() || rejecting === selectedAd._id}
                                icon={rejecting === selectedAd._id ? RefreshCw : null}
                                iconPosition="left"
                            >
                                {rejecting === selectedAd._id ? 'Rejecting...' : 'Reject Ad'}
                            </Button>
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
            
            {/* Category Form Modal */}
            {categoriesForm && (
                <div className="fixed inset-0 z-50">
                    <div className="absolute inset-0 bg-red-500 backdrop-blur-sm" />
                    
                    <div className="relative w-full h-full bg-black overflow-y-auto">
                        <div className="sticky top-0 z-10 bg-black backdrop-blur-xl border-b border-white/10">
                            <div className="max-w-7xl mx-auto">
                                <div className="flex justify-end items-center h-16">
                                    <button
                                        onClick={handleCloseCategoriesForm}
                                        className="p-2 rounded-full bg-surface-1/5 hover:bg-surface-1/10 transition-colors"
                                    >
                                        <X className="w-6 h-6 text-white/80" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="max-w-7xl mx-auto px-6">
                            <AddNewCategory onSubmitSuccess={handleCloseCategoriesForm} monthlyTraffic={analytics?.grantDisplay ? analytics.grantDisplay.grantedTraffic : website?.monthlyTraffic} gscData={analytics?.grantDisplay ? undefined : gscData} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
export default WebsiteDetails;