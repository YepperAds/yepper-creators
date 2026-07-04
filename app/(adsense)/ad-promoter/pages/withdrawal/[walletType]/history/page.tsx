'use client';
import { getToken } from '@/app/(adsense)/utils/token';
// @ts-nocheck

// WithdrawalHistory.js
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  ArrowLeft,
} from 'lucide-react';
import { Button, Container, Badge } from '@/app/(adsense)/components/components';
import LoadingSpinner from '@/app/(adsense)/components/LoadingSpinner';
import api from '@/app/_lib/adsense-api';


const WithdrawalHistory = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [walletType, setWalletType] = useState('webOwner');
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const getAuthToken = () => {
    return getToken();
  };

  const getAuthHeaders = () => {
    const token = getAuthToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  useEffect(() => {
    const pathSegments = pathname.split('/');
    if (pathSegments.includes('advertiser')) {
      setWalletType('advertiser');
    } else {
      setWalletType('webOwner');
    }
  }, [pathname]);

  useEffect(() => {
    fetchWithdrawals();
  }, [walletType, currentPage]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const fetchWithdrawals = async () => {
    setLoading(true);
    try {
      const response = await api.get(
        `/api/ad-categories/wallet/${walletType}/withdrawal-requests?page=${currentPage}&limit=10`,
        { headers: getAuthHeaders() }
      );

      setWithdrawals((response.data as any).withdrawalRequests || []);
      setPagination({
        totalPages: (response.data as any).totalPages || 1,
        currentPage: (response.data as any).currentPage || 1,
        total: (response.data as any).total || 0
      });
    } catch (error: unknown) {
      if ((error as any).response?.status === 401) {
        router.push('/login');
        return;
      }
      if ((error as any).response?.status !== 404) {
        setError('Failed to load withdrawal history');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancelWithdrawal = async (requestId) => {
    if (!window.confirm('Are you sure you want to cancel this withdrawal request?')) {
      return;
    }

    setCancellingId(requestId);
    setError('');

    try {
      await api.patch(
        `/api/ad-categories/wallet/withdrawal-request/${requestId}/cancel`,
        {},
        { headers: getAuthHeaders() }
      );

      setSuccessMessage('Withdrawal request cancelled successfully');
      fetchWithdrawals();
    } catch (error: unknown) {
      setError((error as any).response?.error || 'Failed to cancel withdrawal request');
    } finally {
      setCancellingId(null);
    }
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
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && withdrawals.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <>
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
              <Badge variant="default">Withdrawal History</Badge>
            </div>
          </Container>
        </header>

      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 py-12">
          
          {/* Error Message */}
          {error && (
            <div className="border border-error bg-surface-1 p-4 mb-6">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          {/* Header with New Request Button */}
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-border">
            <h2 className="text-2xl font-bold text-white">Withdrawal Requests</h2>
            <Button
              variant="primary"
              size="md"
              onClick={() => router.push(`/wallet/${walletType}/withdraw`)}
            >
              New Request
            </Button>
          </div>

          {/* Withdrawal Requests List */}
          {withdrawals.length === 0 ? (
            <div className="flex items-center justify-center min-h-64 border border-border">
              <div className="text-center p-8">
                <h3 className="text-lg font-semibold mb-2 text-white">
                  No Withdrawal Requests
                </h3>
                <p className="text-sm text-subtle mb-6">
                  You haven't made any withdrawal requests yet.
                </p>
                <Button
                  variant="primary"
                  onClick={() => router.push(`/wallet/${walletType}/withdraw`)}
                >
                  Create Request
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {withdrawals.map((withdrawal: any) => (
                <div
                  key={withdrawal._id}
                  className="border border-border bg-surface-1 p-6 hover:bg-surface-2 transition-colors"
                >
                  {/* Header Row */}
                  <div className="flex items-start justify-between mb-6 pb-4 border-b border-border">
                    <div>
                      <div className="text-3xl font-bold text-white mb-1">
                        {formatCurrency(withdrawal.amount)}
                      </div>
                      <div className="text-xs text-subtle">
                        {formatDate(withdrawal.createdAt)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="inline-block px-3 py-1 border border-border text-xs font-medium text-white mb-2">
                        {withdrawal.status.toUpperCase()}
                      </div>
                      {withdrawal.processedAt && (
                        <div className="text-xs text-subtle">
                          Processed {formatDate(withdrawal.processedAt)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Bank Details */}
                    <div>
                      <h4 className="text-xs font-semibold text-white mb-3 uppercase tracking-wide">
                        Bank Details
                      </h4>
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-subtle">Bank Name</p>
                          <p className="text-sm text-white font-medium">{withdrawal.bankDetails.bankName}</p>
                        </div>
                        <div>
                          <p className="text-xs text-subtle">Account Number</p>
                          <p className="text-sm text-white font-mono">
                            ****{withdrawal.bankDetails.accountNumber.slice(-4)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-subtle">Account Name</p>
                          <p className="text-sm text-white">{withdrawal.bankDetails.accountName}</p>
                        </div>
                        <div>
                          <p className="text-xs text-subtle">Country</p>
                          <p className="text-sm text-white">{withdrawal.bankDetails.country}</p>
                        </div>
                      </div>
                    </div>

                    {/* Balance Info */}
                    <div>
                      <h4 className="text-xs font-semibold text-white mb-3 uppercase tracking-wide">
                        Balance Info
                      </h4>
                      <div>
                        <p className="text-xs text-subtle">Balance at Request</p>
                        <p className="text-lg font-semibold text-white">
                          {formatCurrency(withdrawal.walletBalanceAtRequest)}
                        </p>
                      </div>
                    </div>

                    {/* Notes & Actions */}
                    <div>
                      {withdrawal.adminNotes && (
                        <div className="mb-4">
                          <h4 className="text-xs font-semibold text-white mb-2 uppercase tracking-wide">
                            Admin Notes
                          </h4>
                          <p className="text-sm text-white bg-surface-2 p-3 border border-border">
                            {withdrawal.adminNotes}
                          </p>
                        </div>
                      )}

                      {withdrawal.rejectionReason && (
                        <div className="mb-4">
                          <h4 className="text-xs font-semibold text-error mb-2 uppercase tracking-wide">
                            Rejection Reason
                          </h4>
                          <p className="text-sm text-error bg-surface-1 p-3 border border-error">
                            {withdrawal.rejectionReason}
                          </p>
                        </div>
                      )}

                      {withdrawal.status === 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancelWithdrawal(withdrawal._id)}
                          disabled={cancellingId === withdrawal._id}
                          className="w-full"
                        >
                          {cancellingId === withdrawal._id ? 'Cancelling...' : 'Cancel Request'}
                        </Button>
                      )}

                      {withdrawal.status === 'completed' && (
                        <div className="p-3 bg-surface-1 border border-border">
                          <p className="text-xs text-white font-medium">
                            Payment sent to your bank account
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-8 pt-8 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1 || loading}
              >
                Previous
              </Button>
              <span className="text-sm text-white font-medium">
                {currentPage} / {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                disabled={currentPage === pagination.totalPages || loading}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Success Toast */}
      {successMessage && (
        <div className="fixed bottom-6 right-6 border border-border bg-surface-1 p-4 shadow-lg animate-slide-up max-w-sm">
          <p className="text-sm text-white font-medium">{successMessage}</p>
        </div>
      )}
    </>
  );
};

export default WithdrawalHistory;