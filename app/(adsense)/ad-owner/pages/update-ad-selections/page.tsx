'use client';
// @ts-nocheck

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { Button, Container, Badge } from '@/app/(adsense)/components/components';
import LoadingSpinner from '@/app/(adsense)/components/LoadingSpinner';
import api from '@/app/_lib/adsense-api';


const UpdateAdSelections = () => {
    const router = useRouter();
    const pathname = usePathname();
    const { adId } = ({}) || {};

    const [ad, setAd] = useState<unknown>(null);
    const [websites, setWebsites] = useState<Record<string,unknown>[]>([]);
    const [selectedWebsites, setSelectedWebsites] = useState<Record<string,unknown>[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<Record<string,unknown>[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!adId) {
            router.push('/my-ads');
            return;
        }
        fetchData();
    }, [adId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [adRes, websitesRes] = await Promise.all([
                api.get(`/api/web-advertise/ads/${adId}`),
                api.get('/api/ad-promoter/websites-with-categories')
            ]);

            setAd(adRes.data.ad);
            setWebsites(websitesRes.data.websites || []);
        } catch (err: unknown) {
            setError('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleWebsiteToggle = (websiteId) => {
        setSelectedWebsites(prev => {
            if (prev.includes(websiteId)) {
                // Remove website and its categories
                const website = websites.find(w => w._id === websiteId);
                const categoryIds = website?.categories?.map(c => c._id) || [];
                setSelectedCategories(cats => 
                    cats.filter(id => !categoryIds.includes(id))
                );
                return prev.filter(id => id !== websiteId);
            } else {
                return [...prev, websiteId];
            }
        });
    };

    const handleCategoryToggle = (categoryId, websiteId) => {
        if (!selectedWebsites.includes(websiteId)) {
            setSelectedWebsites(prev => [...prev, websiteId]);
        }

        setSelectedCategories(prev => {
            if (prev.includes(categoryId)) {
                const filtered = prev.filter(id => id !== categoryId);
                
                // Check if website has no more selected categories
                const website = websites.find(w => w._id === websiteId);
                const websiteCategoryIds = website?.categories?.map(c => c._id) || [];
                const hasOtherCategories = filtered.some(id => websiteCategoryIds.includes(id));
                
                if (!hasOtherCategories) {
                    setSelectedWebsites(ws => ws.filter(id => id !== websiteId));
                }
                
                return filtered;
            } else {
                return [...prev, categoryId];
            }
        });
    };

    const handleUpdate = async () => {
        if (selectedWebsites.length === 0 || selectedCategories.length === 0) {
            setError('Please select at least one website and category');
            return;
        }

        try {
            setUpdating(true);
            setError('');

            const response = await api.put(
                `/api/web-advertise/ads/${adId}/update-selections`,
                {
                    selectedWebsites,
                    selectedCategories
                }
            );

            if ((response.data as any).success) {
                // Navigate to payment
                router.push('/payment', {
                    state: {
                        adId,
                        paymentSelections: (response.data as any).data.paymentSelections,
                        isUpdate: true
                    }
                });
            }
        } catch (err: unknown) {
            setError((error as any).response?.data?.message || 'Failed to update ad');
        } finally {
            setUpdating(false);
        }
    };

    if (loading) return <LoadingSpinner />;

    const getTotalPrice = () => {
        let total = 0;
        selectedCategories.forEach(categoryId => {
            websites.forEach(website => {
                const category = website.categories?.find(c => c._id === categoryId);
                if (category) {
                    total += category.price;
                }
            });
        });
        return total;
    };

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
                        <Badge variant="default">Update Ad</Badge>
                    </div>
                </Container>
            </header>

            <div className="max-w-6xl mx-auto px-4 py-12">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Add Websites to Your Ad</h1>
                    <p className="text-subtle">
                        Select websites and advertising spaces for: <span className="font-semibold">{ad?.businessName}</span>
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-4 border border-error/30 bg-error/10 flex items-start">
                        <AlertCircle className="text-error mr-2 flex-shrink-0 mt-0.5" size={20} />
                        <p className="text-error text-sm">{error}</p>
                    </div>
                )}

                <div className="space-y-6">
                    {websites.map(website => (
                        <div key={website._id} className="border border-border">
                            <div className="p-4 bg-surface-2 border-b border-border">
                                <label className="flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedWebsites.includes(website._id)}
                                        onChange={() => handleWebsiteToggle(website._id)}
                                        className="mr-3 h-5 w-5"
                                    />
                                    <div>
                                        <h3 className="font-semibold text-lg">{website.websiteName}</h3>
                                        <p className="text-sm text-subtle">{website.websiteLink}</p>
                                    </div>
                                </label>
                            </div>

                            {website.categories && website.categories.length > 0 && (
                                <div className="p-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {website.categories.map(category => (
                                            <label
                                                key={category._id}
                                                className="flex items-start p-3 border border-border cursor-pointer hover:bg-surface-2"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedCategories.includes(category._id)}
                                                    onChange={() => handleCategoryToggle(category._id, website._id)}
                                                    className="mr-3 mt-1 h-4 w-4"
                                                />
                                                <div className="flex-1">
                                                    <div className="font-medium">{category.categoryName}</div>
                                                    <div className="text-sm text-subtle">{category.spaceType}</div>
                                                    <div className="text-sm font-semibold text-white mt-1">
                                                        ${category.price}/month
                                                    </div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Summary */}
                {selectedCategories.length > 0 && (
                    <div className="mt-8 p-6 border border-border bg-surface-2">
                        <h3 className="font-semibold text-lg mb-4">Selection Summary</h3>
                        <div className="space-y-2 mb-4">
                            <div className="flex justify-between">
                                <span>Websites selected:</span>
                                <span className="font-semibold">{selectedWebsites.length}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Ad spaces selected:</span>
                                <span className="font-semibold">{selectedCategories.length}</span>
                            </div>
                            <div className="flex justify-between text-lg pt-2 border-t border-border">
                                <span className="font-semibold">Total:</span>
                                <span className="font-bold">${getTotalPrice()}/month</span>
                            </div>
                        </div>
                        <Button
                            onClick={handleUpdate}
                            disabled={updating}
                            variant="secondary"
                            className="w-full"
                        >
                            {updating ? 'Processing...' : 'Proceed to Payment'}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UpdateAdSelections;