'use client';
// @ts-nocheck

// pendingWebAds.js
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, Loader } from 'lucide-react';
import { useSession } from '@/app/_hooks/useSession';
import { Button, Grid, Badge, Container } from '@/app/(adsense)/components/components';
import LoadingSpinner from '@/app/(adsense)/components/LoadingSpinner';

const PendingAds = () => {
  const { user, isAuthenticated } = useSession();
  const [pendingAds, setPendingAds] = useState<Record<string,unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchPendingAds = async () => {
      const userId = user?.id || user?._id || user?.userId;
      
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/ad-categories/pending/${userId}`, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setPendingAds(data);
      } catch (err: unknown) {
        setError((error as any).message);
      } finally {
        setLoading(false);
      }
    };

    fetchPendingAds();
  }, [user, isAuthenticated]);

  const handleApprove = async (adId, websiteId) => {
    try {
      const response = await fetch(
        `/api/ad-categories/approve/${adId}/website/${websiteId}`, 
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setPendingAds(prevAds => 
        prevAds.map(ad => {
          if (ad._id === adId) {
            return {
              ...ad,
              websiteDetails: ad.websiteDetails.map(wd => ({
                ...wd,
                approved: wd.website._id === websiteId ? true : wd.approved
              }))
            };
          }
          return ad;
        })
      );
    } catch (err: unknown) {
      setError(`Error approving ad: ${(error as any).message}`);
    }
  };

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center">
          <Loader className="animate-spin mr-2" size={24} />
          <span className="text-subtle">Loading user information...</span>
        </div>
      </div>
    );
  }

  if (!user?.id && !user?._id && !user?.userId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-error mb-4">Authentication Error</h2>
          <p className="text-subtle mb-6">Unable to identify user. Please log in again.</p>
          <Button onClick={() => router.push('/login')} variant="primary">
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-error mb-4">Error loading ads</h2>
          <p className="text-subtle mb-6">{error}</p>
          <Button onClick={() => window.location.reload()} variant="primary">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <LoadingSpinner />
    );
  }
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
            <Badge variant="default">Ad Approval Dashboard</Badge>
          </div>
        </Container>
      </header>
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Ads Grid */}
        {pendingAds.length > 0 ? (
          <Grid cols={2} gap={6}>
            {pendingAds.map((ad: any) => (
              <div
                key={ad._id}
                className="border border-border bg-surface-1 p-6 transition-all duration-200 hover:bg-surface-2"
              >
                {/* Ad Media */}
                <div className="mb-6">
                  {ad.videoUrl ? (
                    <video 
                      width="100%" 
                      height="200" 
                      controls
                      className="border border-border"
                    >
                      <source src={ad.videoUrl} type="video/mp4" />
                    </video>
                  ) : (
                    ad.imageUrl && (
                      <img 
                        src={ad.imageUrl} 
                        alt={`${ad.businessName} ad`}
                        className="w-full h-48 object-cover border border-border"
                      />
                    )
                  )}
                </div>

                {/* Ad Info */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white mb-2">{ad.businessName}</h3>
                  <p className="text-subtle text-sm">{ad.adDescription}</p>
                </div>
                
                {/* Website Details */}
                <div className="space-y-4">
                  <h4 className="text-base font-semibold text-white">Selected Websites:</h4>
                  {ad.websiteDetails.map((detail: any) => (
                    <div key={detail.website._id} className="border border-border p-4 bg-surface-2">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-medium text-white">{detail.website.websiteName}</h5>
                        <span className={`text-xs px-2 py-1 border ${detail.approved ? 'bg-black text-[#fff]' : 'border-border bg-surface-3 text-white'}>
                          }`}>
                            {detail.approved ? 'Approved' : 'Pending'}
                        </span>
                      </div>
                      
                      <div className="mb-3">
                        <p className="text-sm text-subtle mb-2">Categories:</p>
                        <div className="flex flex-wrap gap-1">
                          {detail.categories.map(cat => (
                            <span 
                              key={cat._id} 
                              className="inline-block px-2 py-1 text-xs border border-muted bg-surface-1 text-subtle"
                            >
                              {cat.categoryName}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      {!detail.approved && (
                        <Button 
                          onClick={() => handleApprove(ad._id, detail.website._id)}
                          variant="secondary"
                          size="sm"
                          className="w-full"
                        >
                          Approve for {detail.website.websiteName}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </Grid>
        ) : (
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <AlertCircle size={64} className="mx-auto mb-6 text-white" />
              <h2 className="text-2xl font-semibold mb-4 text-white">No Pending Ads</h2>
              <p className="text-subtle mb-6">All advertisements have been reviewed.</p>
              <Button onClick={() => router.push('/')} variant="primary">
                Return to Dashboard
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PendingAds;