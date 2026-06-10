'use client';
import { getToken } from '@/app/(adsense)/utils/token';
// @ts-nocheck

// AdReports.js
import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Eye, 
  RefreshCw,
  AlertCircle,
  X,
  Search
} from 'lucide-react';
import Navbar from '@/app/(adsense)/components/Navbar';
import { Button, Grid } from '@/app/(adsense)/components/components';
import LoadingSpinner from '@/app/(adsense)/components/LoadingSpinner';
import api from '@/app/_lib/adsense-api';


const AdReports = () => {
  const [pendingAds, setPendingAds] = useState([]);
  const [activeAds, setActiveAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedAd, setSelectedAd] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [walletBalance, setWalletBalance] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredPendingAds, setFilteredPendingAds] = useState([]);
  const [filteredActiveAds, setFilteredActiveAds] = useState([]);

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${getToken()}`,
    'Content-Type': 'application/json'
  });

  useEffect(() => {
    Promise.all([
      fetchAdReports(),
      fetchWalletBalance()
    ]);
  }, []);

  const fetchWalletBalance = async () => {
    try {
      const response = await api.get('/api/ad-categories/wallet', {
        headers: getAuthHeaders()
      });
      setWalletBalance((response.data as any).wallet?.balance || 0);
    } catch {
    }
  };

  const fetchAdReports = async () => {
    try {
      const [pendingResponse, activeResponse] = await Promise.all([
        api.get('/api/ad-categories/pending-rejections', {
          headers: getAuthHeaders()
        }),
        api.get('/api/ad-categories/active-ads', {
          headers: getAuthHeaders()
        })
      ]);

      setPendingAds(pendingResponse.data.pendingAds || []);
      setActiveAds(activeResponse.data.activeAds || []);
      setFilteredPendingAds(pendingResponse.data.pendingAds || []);
      setFilteredActiveAds(activeResponse.data.activeAds || []);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const performSearch = () => {
      const query = searchQuery.toLowerCase().trim();
      
      if (!query) {
        setFilteredPendingAds(pendingAds);
        setFilteredActiveAds(activeAds);
        return;
      }

      const searchInAds = (ads) => ads.filter(ad => {
        const searchFields = [
          ad.businessName?.toLowerCase(),
          ad.adDescription?.toLowerCase(),
          ad.businessLocation?.toLowerCase(),
        ];
        return searchFields.some(field => field?.includes(query));
      });

      setFilteredPendingAds(searchInAds(pendingAds));
      setFilteredActiveAds(searchInAds(activeAds));
    };

    performSearch();
  }, [searchQuery, pendingAds, activeAds]);

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  const openRejectModal = (ad) => {
    const websiteSelection = ad.websiteSelections.find(sel => sel.approved && !sel.isRejected);
    if (!websiteSelection) return;

    const paymentAmount = ad.paymentAmount || 0;
    if (walletBalance < paymentAmount) {
      return;
    }

    setSelectedAd(ad);
    setShowRejectModal(true);
  };

  const handleRejectAd = async () => {
    if (!selectedAd || !rejectionReason.trim()) return;

    setRejecting(selectedAd._id);
    try {
      const websiteSelection = selectedAd.websiteSelections.find(sel => sel.approved && !sel.isRejected);
      
      await api.post(
        `/api/ad-categories/reject/${selectedAd._id}/${websiteSelection.websiteId}/${websiteSelection.categories[0]}`,
        { rejectionReason: rejectionReason.trim() },
        { headers: getAuthHeaders() }
      );

      await Promise.all([
        fetchAdReports(),
        fetchWalletBalance()
      ]);
      
      setShowRejectModal(false);
      setSelectedAd(null);
      setRejectionReason('');
      
    } catch {
      const errorMessage = (error as any).response?.data?.error || 'Failed to reject ad';
      
      if (errorMessage.includes('Insufficient balance')) {
        fetchWalletBalance();
      }
    } finally {
      setRejecting(null);
    }
  };

  const closeRejectModal = () => {
    setShowRejectModal(false);
    setSelectedAd(null);
    setRejectionReason('');
  };

  const getTimeRemaining = (deadline) => {
    const now = new Date();
    const timeLeft = new Date(deadline) - now;
    
    if (timeLeft <= 0) return 'Expired';
    
    const minutes = Math.floor(timeLeft / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
    
    return `${minutes}m ${seconds}s`;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 py-12">

          <div className='flex justify-between items-center gap-4 mb-12'>
            {/* Search Section */}
            <div className="flex justify-start flex-1">
              <div className="relative w-full max-w-md">
                <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" />
                <input 
                  type="text"
                  placeholder="Search ads..."
                  value={searchQuery}
                  onChange={handleSearch}
                  className="w-full pl-10 pr-4 py-3 border border-border bg-surface-1 text-white placeholder-muted focus:outline-none focus:ring-0 transition-all duration-200"
                />
              </div>
            </div>
          </div>

          {/* Pending Rejections Section */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <Clock size={24} className="text-white" />
              Pending Rejections ({filteredPendingAds.length})
            </h2>
            
            {filteredPendingAds.length === 0 ? (
              <div className="flex items-center justify-center min-h-64">
                <div className="text-center">
                  <AlertTriangle size={64} className="mx-auto mb-6 text-white" />
                  <h3 className="text-xl font-semibold mb-4 text-white">
                    {searchQuery ? 'No Pending Ads Found' : 'No Ads Pending Rejection'}
                  </h3>
                </div>
              </div>
            ) : (
              <Grid cols={2} gap={6}>
                {filteredPendingAds.map((ad: any) => {
                  const activeSelection = ad.websiteSelections.find(sel => sel.approved && !sel.isRejected);
                  const timeRemaining = activeSelection?.rejectionDeadline ? 
                    getTimeRemaining(activeSelection.rejectionDeadline) : 'No deadline';
                  
                  return (
                    <div
                      key={ad._id}
                      className="border border-border bg-surface-1 p-6 transition-all duration-200 hover:bg-surface-2"
                    >
                      {/* Header */}
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center">
                          <AlertTriangle size={40} className="mr-3 text-white" />
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-subtle mb-1">Time Left</div>
                          <div className="text-sm font-semibold text-white">{timeRemaining}</div>
                        </div>
                      </div>
                      
                      {/* Business Name */}
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-white">{ad.businessName}</h3>
                        <div className="text-right">
                          <div className="text-xs text-subtle">Payment</div>
                          <div className="text-sm font-semibold text-white">{formatCurrency(ad.paymentAmount)}</div>
                        </div>
                      </div>

                      {/* Ad Description */}
                      <div className="mb-4">
                        <p className="text-subtle text-sm">{ad.adDescription}</p>
                      </div>

                      {/* Business Details */}
                      <div className="mb-6">
                        <p className="text-xs text-subtle mb-1">Business Link:</p>
                        <a 
                          href={ad.businessLink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-subtle hover:text-white text-sm break-all"
                        >
                          {ad.businessLink}
                        </a>
                        <p className="text-xs text-subtle mt-2">Location: {ad.businessLocation}</p>
                      </div>

                      {/* Insufficient Balance Warning */}
                      {walletBalance < (ad.paymentAmount || 0) && (
                        <div className="mb-4 p-3 bg-error/10 border border-error/30 flex items-center gap-2">
                          <AlertCircle size={16} className="text-error" />
                          <span className="text-xs text-error">
                            Insufficient balance. Required: {formatCurrency(ad.paymentAmount)}
                          </span>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => window.open(ad.imageUrl || ad.videoUrl, '_blank')}
                        >
                          <Eye size={16} className="mr-1" />
                          Preview
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          className="flex-1"
                          onClick={() => openRejectModal(ad)}
                          disabled={rejecting === ad._id || walletBalance < (ad.paymentAmount || 0)}
                        >
                          {rejecting === ad._id ? (
                            <RefreshCw size={16} className="mr-1 animate-spin" />
                          ) : (
                            <XCircle size={16} className="mr-1" />
                          )}
                          Reject
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </Grid>
            )}
          </div>

          {/* Active Ads Section */}
          <div>
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <CheckCircle size={24} className="text-white" />
              Active Ads ({filteredActiveAds.length})
            </h2>
            
            {filteredActiveAds.length === 0 ? (
              <div className="flex items-center justify-center min-h-64">
                <div className="text-center">
                  <CheckCircle size={64} className="mx-auto mb-6 text-white" />
                  <h3 className="text-xl font-semibold mb-4 text-white">
                    {searchQuery ? 'No Active Ads Found' : 'No Active Ads'}
                  </h3>
                </div>
              </div>
            ) : (
              <Grid cols={3} gap={6}>
                {filteredActiveAds.map((ad: any) => (
                  <div
                    key={ad._id}
                    className="border border-border bg-surface-1 p-6 transition-all duration-200 hover:bg-surface-2"
                  >
                    {/* Header */}
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center">
                        <CheckCircle size={40} className="mr-3 text-white" />
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-subtle mb-1">Status</div>
                        <div className="text-sm font-semibold text-white">Active</div>
                      </div>
                    </div>
                    
                    {/* Business Name */}
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-white">{ad.businessName}</h3>
                      <div className="text-right">
                        <div className="text-xs text-subtle">Payment</div>
                        <div className="text-sm font-semibold text-white">{formatCurrency(ad.paymentAmount)}</div>
                      </div>
                    </div>

                    {/* Ad Description */}
                    <div className="mb-4">
                      <p className="text-subtle text-sm">{ad.adDescription}</p>
                    </div>

                    {/* Stats */}
                    <div className="mb-6 flex justify-between text-sm">
                      <div>
                        <div className="text-xs text-subtle">Views</div>
                        <div className="font-semibold text-white">{ad.views || 0}</div>
                      </div>
                      <div>
                        <div className="text-xs text-subtle">Clicks</div>
                        <div className="font-semibold text-white">{ad.clicks || 0}</div>
                      </div>
                    </div>

                    {/* Preview Button */}
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => window.open(ad.imageUrl || ad.videoUrl, '_blank')}
                    >
                      <Eye size={16} className="mr-2" />
                      Preview Ad
                    </Button>
                  </div>
                ))}
              </Grid>
            )}
          </div>

          {/* Rejection Modal */}
          {showRejectModal && selectedAd && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-surface-1 border border-border max-w-md w-full p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Reject Advertisement</h3>
                  <button
                    onClick={closeRejectModal}
                    className="text-muted hover:text-white transition-all duration-200"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div className="mb-4">
                  <p className="text-sm text-subtle mb-2">
                    You are about to reject: <strong>{selectedAd.businessName}</strong>
                  </p>
                  <p className="text-sm text-subtle mb-4">
                    Refund amount: <strong>{formatCurrency(selectedAd.paymentAmount)}</strong> 
                    will be transferred to advertiser's wallet
                  </p>
                </div>
                
                <div className="mb-6">
                  <label className="block text-sm font-medium text-white mb-2">
                    Rejection Reason *
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e: any) => setRejectionReason(e.target.value)}
                    className="w-full px-3 py-2 border border-border bg-surface-1 text-white placeholder-muted focus:outline-none focus:ring-0"
                    rows={4}
                    placeholder="Please provide a reason for rejecting this ad..."
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
                  >
                    {rejecting === selectedAd._id ? (
                      <>
                        <RefreshCw size={16} className="mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <XCircle size={16} className="mr-2" />
                        Confirm Rejection
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AdReports;