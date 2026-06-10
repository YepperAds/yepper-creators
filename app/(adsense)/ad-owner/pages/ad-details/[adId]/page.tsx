'use client';
// @ts-nocheck

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Volume2, VolumeX, Play, ArrowLeft } from 'lucide-react';
import { Button, Badge, Text, Heading, Container } from '@/app/(adsense)/components/components';
import LoadingSpinner from '@/app/(adsense)/components/LoadingSpinner';
import api from '@/app/_lib/adsense-api';

interface Ad {
    businessName: string;
    adDescription?: string;
    businessLocation?: string;
    businessLink?: string;
    videoUrl?: string;
    imageUrl?: string;
    views?: number;
    clicks?: number;
}

interface AdDetailsParams extends Record<string, string | undefined> {
    adId: string;
}

function AdDetails(): React.ReactElement {
    const { adId } = useParams<AdDetailsParams>();
    const router = useRouter();
    const [ad, setAd] = useState<Ad | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [muted, setMuted] = useState<boolean>(true);
    const [isPaused, setIsPaused] = useState<boolean>(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const fetchAdDetails = async (): Promise<void> => {
            try {
                setLoading(true);
                setError(null);
                const adResponse = await api.get<Ad>(`/api/web-advertise/ad-details/${adId}`);
                setAd(adResponse.data);
            } catch (err: unknown) {
                const message =
                    err instanceof Error
                        ? (err as any).message
                        : (err as { response?: { data?: { message?: string } } })?.response?.data
                              ?.message ?? 'Failed to load ad details';
                setError(message);
            } finally {
                setLoading(false);
            }
        };

        if (adId) {
            fetchAdDetails();
        }
    }, [adId]);

    const toggleMute = (e: React.MouseEvent<HTMLButtonElement>): void => {
        e.stopPropagation();
        setMuted((prev) => !prev);
    };

    const togglePause = (): void => {
        if (videoRef.current) {
            if (isPaused) {
                videoRef.current.play();
            } else {
                videoRef.current.pause();
            }
            setIsPaused((prev) => !prev);
        }
    };

    if (loading) {
        return <LoadingSpinner />;
    }

    if (error) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <Heading level={2} className="text-error mb-4">
                        Error loading ad
                    </Heading>
                    <Text className="mb-6">{error}</Text>
                    <Button onClick={() => window.location.reload()} variant="primary">
                        Retry
                    </Button>
                </div>
            </div>
        );
    }

    if (!ad) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <Heading level={2} className="mb-4">
                        No ad data found
                    </Heading>
                    <Button onClick={() => router.back()} variant="primary">
                        Go Back
                    </Button>
                </div>
            </div>
        );
    }

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
                        <Badge variant="default">Ad Details</Badge>
                    </div>
                </Container>
            </header>

            <div className="max-w-6xl mx-auto px-4 py-12">
                <div className="border border-border bg-surface-1 mb-6">
                    {ad.videoUrl ? (
                        <div className="relative">
                            <video
                                ref={videoRef}
                                src={ad.videoUrl}
                                autoPlay
                                loop
                                muted={muted}
                                className="w-full aspect-video"
                                onClick={togglePause}
                            />
                            {isPaused && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Play size={48} className="text-white opacity-75" />
                                </div>
                            )}
                            <div className="absolute top-4 right-4">
                                <button
                                    onClick={toggleMute}
                                    className="bg-black/50 text-white p-2 border border-white"
                                >
                                    {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                                </button>
                            </div>
                        </div>
                    ) : ad.imageUrl ? (
                        <img
                            src={ad.imageUrl}
                            alt={ad.businessName}
                            className="w-full aspect-video object-cover"
                        />
                    ) : (
                        <div className="w-full aspect-video bg-surface-3 flex items-center justify-center">
                            <Text>No media available</Text>
                        </div>
                    )}
                </div>

                <div className="border border-border bg-surface-1 p-6 mb-6">
                    <div className="border-b border-border pb-6 mb-6">
                        <Heading level={2} className="mb-4">
                            {ad.businessName}
                        </Heading>
                        <div className="flex items-center space-x-6">
                            <div className="flex items-center">
                                <Text>{(ad.views ?? 0).toLocaleString()} Views</Text>
                            </div>
                            <div className="flex items-center">
                                <Text>{(ad.clicks ?? 0).toLocaleString()} Clicks</Text>
                            </div>
                        </div>
                    </div>

                    <div className="mb-6">
                        <Heading level={4} className="mb-3">
                            Description
                        </Heading>
                        <Text>{ad.adDescription}</Text>
                    </div>

                    <div className="mb-6">
                        <div className="flex items-center mb-3">
                            <Heading level={4}>Location</Heading>
                        </div>
                        <Text>{ad.businessLocation ?? 'Location not specified'}</Text>
                    </div>

                    {ad.businessLink && (
                        <div>
                            <div className="flex items-center mb-3">
                                <Heading level={4}>Business Link</Heading>
                            </div>
                            <a
                                href={ad.businessLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-subtle hover:text-white break-all"
                            >
                                {ad.businessLink}
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default AdDetails;