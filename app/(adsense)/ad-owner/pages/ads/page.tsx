'use client';
// @ts-nocheck

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Plus, ArrowLeft } from 'lucide-react';
import { useSession } from '@/app/_hooks/useSession';
import { Button, Grid, Badge, Container } from '@/app/(adsense)/components/components';
import LoadingSpinner from '@/app/(adsense)/components/LoadingSpinner';
import api from '@/app/_lib/adsense-api';

interface WebsiteSelection {
    status: string;
    isRejected: boolean;
}

interface Ad {
    _id: string;
    businessName: string;
    adDescription?: string;
    videoUrl?: string;
    imageUrl?: string;
    views?: number;
    clicks?: number;
    websiteSelections?: WebsiteSelection[];
}

interface AdStatusInfo {
    status: 'Incomplete' | 'Active';
    label: string;
    color: string;
    action: string | null;
}

interface ApiResponse {
    success: boolean;
    ads?: Ad[];
}

type FilterType = 'all' | 'incomplete' | 'active';

const Ads: React.FC = () => {
    const { user, isAuthenticated } = useSession();
    const router = useRouter();
    const [ads, setAds] = useState<Ad[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [selectedFilter] = useState<FilterType>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [filteredAds, setFilteredAds] = useState<Ad[]>([]);

    useEffect(() => {
        if (user         if (user && token) {        if (user && token) { isAuthenticated) {
            fetchUserAds();
        }
    }, [user, isAuthenticated]);

    useEffect(() => {
        if (!ads) return;

        const performSearch = (): void => {
            const query = searchQuery.toLowerCase().trim();

            // ONLY show incomplete OR active ads
            let statusFiltered = ads.filter((ad: any) => {
                const isIncomplete = !ad.websiteSelections || ad.websiteSelections.length === 0;
                const hasActive =
                    ad.websiteSelections &&
                    ad.websiteSelections.some((ws: any) => ws.status === 'active' && !ws.isRejected);

                return isIncomplete || hasActive;
            });

            // Apply specific filter
            if (selectedFilter === 'incomplete') {
                statusFiltered = statusFiltered.filter(
                    (ad) => !ad.websiteSelections || ad.websiteSelections.length === 0,
                );
            } else if (selectedFilter === 'active') {
                statusFiltered = statusFiltered.filter(
                    (ad) =>
                        ad.websiteSelections &&
                        ad.websiteSelections.some((ws: any) => ws.status === 'active' && !ws.isRejected),
                );
            }

            // Apply search query
            if (!query) {
                setFilteredAds(statusFiltered);
                return;
            }

            const searched = statusFiltered.filter((ad: any) => {
                const searchFields = [
                    ad.businessName?.toLowerCase(),
                    ad.adDescription?.toLowerCase(),
                ];
                return searchFields.some((field: any) => field?.includes(query));
            });

            setFilteredAds(searched);
        };

        performSearch();
    }, [searchQuery, selectedFilter, ads]);

    const fetchUserAds = async (): Promise<void> => {
        try {
            setLoading(true);
            const response = await api.get<ApiResponse>('/api/web-advertise/my-ads');

            if ((response.data as any).success) {
                const adsData = (response.data as any).ads ?? [];
                setAds(adsData);
                setFilteredAds(adsData);
            } else {
                setAds([]);
                setFilteredAds([]);
            }
        } catch {
            setAds([]);
            setFilteredAds([]);
        } finally {
            setLoading(false);
        }
    };

    const getAdStatus = (ad: Ad): AdStatusInfo | null => {
        // Check if no websites selected (incomplete ad)
        if (!ad.websiteSelections || ad.websiteSelections.length === 0) {
            return {
                status: 'Incomplete',
                label: 'Needs Website Selection',
                color: 'bg-warning/10 text-warning',
                action: 'Complete Setup',
            };
        }

        // Check if has active websites
        const hasActiveSelections = ad.websiteSelections.some(
            (ws) => ws.status === 'active' && !ws.isRejected,
        );

        if (hasActiveSelections) {
            return {
                status: 'Active',
                label: 'Live',
                color: 'bg-green-100 text-success',
                action: null,
            };
        }

        return null; // Hide everything else
    };

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>): void => {
        setSearchQuery(e.target.value);
    };

    const formatNumber = (number: number): string | number => {
        if (number >= 1_000_000) {
            return (number / 1_000_000).toFixed(1) + 'M';
        }
        if (number >= 1_000) {
            return (number / 1_000).toFixed(1) + 'K';
        }
        return number;
    };

    const handleActionButton = (ad: Ad, statusInfo: AdStatusInfo): void => {
        if (statusInfo.status === 'Incomplete') {
            router.push(`/update-ad-selections?adId=${ad._id}&isUpdate=true`); // {
                
            });
        }
    };

    if (loading) {
        return <LoadingSpinner />;
    }

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b border-border bg-background">
                <Container>
                    <div className="h-16 flex items-center justify-between">
                        <Link href="/">
                            <button className="flex items-center text-subtle hover:text-white transition-colors">
                                <ArrowLeft size={18} className="mr-2" />
                                <span className="font-medium">Back</span>
                            </button>
                        </Link>
                        <Badge variant="default">Ad</Badge>
                    </div>
                </Container>
            </header>

            <div className="max-w-6xl mx-auto px-4 py-12">
                <div className="flex justify-between items-center gap-4 mb-8">
                    {/* Search Section */}
                    <div className="flex justify-start flex-1">
                        <div className="relative w-full max-w-md">
                            <Search
                                size={20}
                                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted"
                            />
                            <input
                                type="text"
                                placeholder="Search my campaigns..."
                                value={searchQuery}
                                onChange={handleSearch}
                                className="w-full pl-10 pr-4 py-3 border border-border bg-surface-1 text-white placeholder-muted focus:outline-none focus:ring-0 transition-all duration-200"
                            />
                        </div>
                    </div>

                    {/* Add Button */}
                    <div className="flex-shrink-0">
                        <Button
                            onClick={() => router.push('/upload-ad')}
                            variant="secondary"
                            size="lg"
                            icon={Plus}
                            iconPosition="left"
                        >
                            Add New Ad
                        </Button>
                    </div>

                    <div className="flex-shrink-0">
                        <Button
                            onClick={() => router.push('/upload-ad')}
                            variant="secondary"
                            size="lg"
                            icon={Plus}
                            iconPosition="left"
                        >
                            Add Website
                        </Button>
                    </div>
                </div>

                {/* Campaigns Grid */}
                {filteredAds.length > 0 ? (
                    <Grid cols={3} gap={6}>
                        {filteredAds
                            .slice()
                            .reverse()
                            .map((ad: any, index: any) => {
                                const statusInfo = getAdStatus(ad);

                                if (!statusInfo) return null;

                                return (
                                    <div
                                        key={ad._id || index}
                                        className="border border-border bg-surface-1 transition-all duration-200 hover:bg-surface-2"
                                    >
                                        <div className="h-48 border-b border-border">
                                            {ad.videoUrl ? (
                                                <video
                                                    autoPlay
                                                    loop
                                                    muted
                                                    className="w-full h-full object-cover"
                                                >
                                                    <source src={ad.videoUrl} type="video/mp4" />
                                                </video>
                                            ) : ad.imageUrl ? (
                                                <img
                                                    src={ad.imageUrl}
                                                    alt={ad.businessName}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-surface-3 flex items-center justify-center">
                                                    <span className="text-muted">No Image</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="p-6">
                                            <div className="mb-4">
                                                <h3 className="text-lg font-semibold text-white">
                                                    {ad.businessName}
                                                </h3>
                                            </div>

                                            <div className="border border-border p-3 mb-4">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-subtle">
                                                        Status:
                                                    </span>
                                                    <span
                                                        className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium ${statusInfo.color}`}
                                                    >
                                                        {statusInfo.label}
                                                    </span>
                                                </div>
                                            </div>

                                            {statusInfo.status === 'Active' && (
                                                <div className="flex items-center justify-between mb-4 border border-border p-3">
                                                    <div className="flex items-center">
                                                        <div className="flex justify-center gap-1 items-center">
                                                            <div className="text-xs text-subtle">
                                                                Views
                                                            </div>
                                                            <div className="text-sm font-semibold text-white">
                                                                {formatNumber(ad.views ?? 0)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <div className="flex justify-center gap-1 items-center">
                                                            <div className="text-xs text-subtle">
                                                                Clicks
                                                            </div>
                                                            <div className="text-sm font-semibold text-white">
                                                                {formatNumber(ad.clicks ?? 0)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="space-y-2">
                                                <Link href={`/ad-details/${ad._id}`}>
                                                    <Button
                                                        variant="secondary"
                                                        className="w-full flex items-center justify-center space-x-2"
                                                    >
                                                        <span>View Campaign</span>
                                                    </Button>
                                                </Link>

                                                {statusInfo.action && (
                                                    <Button
                                                        onClick={() =>
                                                            handleActionButton(ad, statusInfo)
                                                        }
                                                        variant="outline"
                                                        className={`w-full flex items-center justify-center space-x-1 text-xs ${
                                                            statusInfo.status === 'Incomplete'
                                                                ? 'bg-warning/10 border-warning/30 text-warning hover:bg-warning/10'
                                                                : 'bg-blue/10 border-blue/30 text-blue hover:bg-blue-100'
                                                        }`}
                                                    >
                                                        <span>{statusInfo.action}</span>
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                    </Grid>
                ) : (
                    <div className="flex items-center justify-center min-h-96">
                        <div className="text-center">
                            <h2 className="text-2xl font-semibold mb-4 text-white">
                                {searchQuery ? 'No Campaigns Found' : 'No Campaigns Yet'}
                            </h2>
                            <p className="text-subtle mb-6">
                                {searchQuery
                                    ? 'Try adjusting your search terms or filters'
                                    : 'Create your first campaign to get started'}
                            </p>
                            <Button
                                onClick={() => router.push('/upload-ad')}
                                variant="secondary"
                                size="lg"
                                icon={Plus}
                                iconPosition="left"
                            >
                                Create Your First Campaign
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Ads;