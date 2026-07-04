'use client';
import { getToken } from '@/app/(adsense)/utils/token';
// @ts-nocheck

// WithdrawalRequest.js
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button, Container, Badge } from '@/app/(adsense)/components/components';
import LoadingSpinner from '@/app/(adsense)/components/LoadingSpinner';
import api from '@/app/_lib/adsense-api';


const formatRemainingTime = (ms: number) => {
  const totalMinutes = Math.ceil(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const WithdrawalRequest = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [walletType, setWalletType] = useState('webOwner');
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState({
    amount: '',
    bankName: '',
    accountNumber: '',
    accountName: '',
    country: '',
    routingNumber: '',
    swiftCode: ''
  });

  const [formErrors, setFormErrors] = useState({});
  const [withdrawCountdown, setWithdrawCountdown] = useState('');

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
    
    fetchWalletData();
  }, [pathname]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    const nextWithdrawalAt = (wallet as any)?.nextWithdrawalAt;
    if (!nextWithdrawalAt) {
      setWithdrawCountdown('');
      return;
    }

    const update = () => {
      const remainingMs = new Date(nextWithdrawalAt).getTime() - Date.now();
      setWithdrawCountdown(remainingMs > 0 ? formatRemainingTime(remainingMs) : '');
    };

    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [wallet]);

  const fetchWalletData = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await api.get(
        `/api/ad-categories/wallet/${walletType}/balance`,
        { headers: getAuthHeaders() }
      );

      setWallet((response.data as any).wallet);
    } catch (error: unknown) {
      if ((error as any).response?.status === 401) {
        router.push('/login');
        return;
      }
      setError('Failed to load wallet information');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      errors.amount = 'Please enter a valid amount';
    } else if (parseFloat(formData.amount) > wallet?.balance) {
      errors.amount = 'Amount exceeds available balance';
    }

    if (!formData.bankName.trim()) {
      errors.bankName = 'Bank name is required';
    }

    if (!formData.accountNumber.trim()) {
      errors.accountNumber = 'Account number is required';
    }

    if (!formData.accountName.trim()) {
      errors.accountName = 'Account name is required';
    }

    if (!formData.country.trim()) {
      errors.country = 'Country is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      setSuccess('Withdrawal request submitted successfully! You will be notified once it is processed.');
      
      // Reset form
      setFormData({
        amount: '',
        bankName: '',
        accountNumber: '',
        accountName: '',
        country: '',
        routingNumber: '',
        swiftCode: ''
      });

      // Navigate to withdrawal history after 2 seconds
      setTimeout(() => {
        router.push(`/wallet/${walletType}/withdrawals`);
      }, 2000);

    } catch (error: unknown) {
      setError((error as any).response?.data?.error || 'Failed to submit withdrawal request');
    } finally {
      setSubmitting(false);
    }
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
            <Badge variant="default">Request to Withdraw</Badge>
          </div>
        </Container>
      </header>

      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-12">
          
          {/* Balance Card */}
          <div className="border border-border bg-surface-1 p-6 mb-8">
            <h3 className="text-sm font-semibold text-white mb-2 uppercase tracking-wide">Available Balance</h3>
            <p className="text-3xl font-bold text-white">{formatCurrency(wallet?.balance)}</p>
            {withdrawCountdown && (
              <p className="text-sm text-error mt-2">
                Next withdrawal available in {withdrawCountdown}
              </p>
            )}
          </div>

          {/* Withdrawal Form */}
          <form onSubmit={handleSubmit} className="border border-border bg-surface-1 p-8">
            <h2 className="text-2xl font-bold text-white mb-6">Request Withdrawal</h2>

            {/* Amount */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-white mb-2">
                Withdrawal Amount *
              </label>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleInputChange}
                step="0.01"
                min="0"
                max={wallet?.balance || 0}
                placeholder="0.00"
                className={`w-full px-4 py-3 border ${formErrors.amount ? 'border-error' : 'border-border'} bg-surface-1 text-white placeholder-muted focus:outline-none focus:ring-0`}
              />
              {formErrors.amount && (
                <p className="text-error text-sm mt-1">{formErrors.amount}</p>
              )}
            </div>

            {/* Bank Name */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-white mb-2">
                Bank Name *
              </label>
              <input
                type="text"
                name="bankName"
                value={formData.bankName}
                onChange={handleInputChange}
                placeholder="Enter bank name"
                className={`w-full px-4 py-3 border ${formErrors.bankName ? 'border-error' : 'border-border'} bg-surface-1 text-white placeholder-muted focus:outline-none focus:ring-0`}
              />
              {formErrors.bankName && (
                <p className="text-error text-sm mt-1">{formErrors.bankName}</p>
              )}
            </div>

            {/* Account Number */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-white mb-2">
                Account Number *
              </label>
              <input
                type="text"
                name="accountNumber"
                value={formData.accountNumber}
                onChange={handleInputChange}
                placeholder="Enter account number"
                className={`w-full px-4 py-3 border ${formErrors.accountNumber ? 'border-error' : 'border-border'} bg-surface-1 text-white placeholder-muted focus:outline-none focus:ring-0`}
              />
              {formErrors.accountNumber && (
                <p className="text-error text-sm mt-1">{formErrors.accountNumber}</p>
              )}
            </div>

            {/* Account Name */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-white mb-2">
                Account Name *
              </label>
              <input
                type="text"
                name="accountName"
                value={formData.accountName}
                onChange={handleInputChange}
                placeholder="Enter account holder name"
                className={`w-full px-4 py-3 border ${formErrors.accountName ? 'border-error' : 'border-border'} bg-surface-1 text-white placeholder-muted focus:outline-none focus:ring-0`}
              />
              {formErrors.accountName && (
                <p className="text-error text-sm mt-1">{formErrors.accountName}</p>
              )}
            </div>

            {/* Country */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-white mb-2">
                Country *
              </label>
              <input
                type="text"
                name="country"
                value={formData.country}
                onChange={handleInputChange}
                placeholder="Enter country"
                className={`w-full px-4 py-3 border ${formErrors.country ? 'border-error' : 'border-border'} bg-surface-1 text-white placeholder-muted focus:outline-none focus:ring-0`}
              />
              {formErrors.country && (
                <p className="text-error text-sm mt-1">{formErrors.country}</p>
              )}
            </div>

            {/* Routing Number */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-white mb-2">
                Routing Number (Optional)
              </label>
              <input
                type="text"
                name="routingNumber"
                value={formData.routingNumber}
                onChange={handleInputChange}
                placeholder="Enter routing number"
                className="w-full px-4 py-3 border border-border bg-surface-1 text-white placeholder-muted focus:outline-none focus:ring-0"
              />
            </div>

            {/* SWIFT Code */}
            <div className="mb-8">
              <label className="block text-sm font-semibold text-white mb-2">
                SWIFT Code (Optional)
              </label>
              <input
                type="text"
                name="swiftCode"
                value={formData.swiftCode}
                onChange={handleInputChange}
                placeholder="Enter SWIFT code"
                className="w-full px-4 py-3 border border-border bg-surface-1 text-white placeholder-muted focus:outline-none focus:ring-0"
              />
            </div>

            {/* Submit Button */}
            <div className="flex gap-4">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={submitting || !!withdrawCountdown}
                className="flex-1"
              >
                {submitting
                  ? 'Submitting...'
                  : withdrawCountdown
                  ? `Available in ${withdrawCountdown}`
                  : 'Submit Withdrawal Request'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => router.back()}
                disabled={submitting}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Success Toast */}
      {success && (
        <div className="fixed bottom-6 right-6 border border-border bg-surface-1 p-4 shadow-lg animate-slide-up max-w-sm z-50">
          <p className="text-sm text-white font-medium">{success}</p>
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-6 right-6 border border-error bg-surface-1 p-4 shadow-lg animate-slide-up max-w-sm z-50">
          <p className="text-sm text-error font-medium">{error}</p>
        </div>
      )}
    </>
  );
};

export default WithdrawalRequest;