'use client';
import { getToken } from '@/app/(adsense)/utils/token';
// @ts-nocheck

// Wallet.js - Updated version with Withdraw functionality
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  ArrowLeft,
  Search,
  Download,
  History
} from 'lucide-react';
import { Button, Grid, Container, Badge } from '@/app/(adsense)/components/components';
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

const Wallet = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [walletType, setWalletType] = useState('webOwner');
  const [user, setUser] = useState<unknown>(null);
  const [wallet, setWallet] = useState<unknown>(null);
  const [transactions, setTransactions] = useState<Record<string,unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [setPagination] = useState({});
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredTransactions, setFilteredTransactions] = useState<Record<string,unknown>[]>([]);
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
    
    fetchUserInfo();
  }, [pathname]);

  useEffect(() => {
    if (user) {
      fetchWalletData();
    }
  }, [walletType, user]);

  useEffect(() => {
    if (wallet) {
      fetchTransactions(currentPage);
    }
  }, [currentPage, wallet]);

  useEffect(() => {
    const performSearch = () => {
      const query = searchQuery.toLowerCase().trim();
      
      if (!query) {
        setFilteredTransactions(transactions);
        return;
      }

      const searched = transactions.filter(transaction => {
        const searchFields = [
          transaction.description?.toLowerCase(),
          transaction.type?.toLowerCase(),
          formatCurrency(transaction.amount).toLowerCase(),
        ];
        return searchFields.some(field => field?.includes(query));
      });
        
      setFilteredTransactions(searched);
    };

    performSearch();
  }, [searchQuery, transactions]);

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

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  const fetchUserInfo = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await api.get('/api/auth/me', {
        headers: getAuthHeaders()
      });
      setUser((response.data as any).user);
    } catch (err: unknown) {
      if ((error as any).response?.status === 401) {
        router.push('/login');
      }
    }
  };

  const fetchWalletData = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await api.get(`/api/ad-categories/wallet/${walletType}/balance`, {
        headers: getAuthHeaders()
      });

      setWallet((response.data as any).wallet);
    } catch (err: unknown) {
      if ((error as any).response?.status === 401) {
        router.push('/login');
        return;
      }
      if ((error as any).response?.status === 404) {
        setWallet({
          balance: 0,
          totalEarned: 0,
          totalSpent: 0,
          totalRefunded: 0
        });
      } else {
        setError('Failed to load wallet information');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async (page = 1) => {
    setTransactionsLoading(true);
    try {
      const response = await api.get(
        `/api/ad-categories/wallet/${walletType}/transactions?page=${page}&limit=10`, 
        {
          headers: getAuthHeaders()
        }
      );

      setTransactions((response.data as any).transactions || []);
      setFilteredTransactions((response.data as any).transactions || []);
      setPagination({
        totalPages: (response.data as any).totalPages || 1,
        currentPage: (response.data as any).currentPage || 1,
        total: (response.data as any).total || 0
      });
    } catch (err: unknown) {
      if ((error as any).response?.status !== 404) {
        setError('Failed to load transaction history');
      }
    } finally {
      setTransactionsLoading(false);
    }
  };

  const getTransactionTypeDisplay = (transaction) => {
    const typeMap = {
      'refund_credit': 'Refund Received',
      'refund_debit': 'Refund Processed',
      'credit': 'Payment Received',
      'debit': 'Payment Sent'
    };
    return typeMap[transaction.type] || transaction.type;
  };

  const switchWalletType = () => {
    const newType = walletType === 'webOwner' ? 'advertiser' : 'webOwner';
    setWalletType(newType);
    setCurrentPage(1);
    setTransactions([]);
    setFilteredTransactions([]);
    setWallet(null);
    setLoading(true);
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(Math.abs(amount));
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
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
              <Badge variant="default">Wallet</Badge>
            </div>
          </Container>
        </header>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-bold text-error mb-4">Error loading wallet</h2>
            <p className="text-subtle mb-6">{error}</p>
            <Button onClick={() => fetchWalletData()} variant="primary">
              Retry
            </Button>
          </div>
        </div>
      </>
    );
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
            <Badge variant="default">Wallet</Badge>
          </div>
        </Container>
      </header>
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 py-12">

          <div className='flex justify-between items-center gap-4 mb-12'>
            {/* Search Section */}
            <div className="flex justify-start flex-1">
              <div className="relative w-full max-w-md">
                <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" />
                <input 
                  type="text"
                  placeholder="Search transactions..."
                  value={searchQuery}
                  onChange={handleSearch}
                  className="w-full pl-10 pr-4 py-3 border border-border bg-surface-1 rounded-full text-white placeholder-muted focus:outline-none focus:ring-0 transition-all duration-200"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 flex-shrink-0">
              {/* Only show Withdraw button for webOwner */}
              {walletType === 'webOwner' && (
                <>
                  <div className="flex flex-col items-end">
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => router.push(`/wallet/${walletType}/withdraw`)}
                      disabled={!wallet || wallet.balance <= 0 || !!withdrawCountdown}
                      title={withdrawCountdown ? `Next withdrawal available in ${withdrawCountdown}` : undefined}
                    >
                      <Download size={18} className="mr-2" />
                      Withdraw
                    </Button>
                    {withdrawCountdown && (
                      <span className="text-xs text-subtle mt-1">
                        Available in {withdrawCountdown}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => router.push(`/wallet/${walletType}/withdrawals`)}
                  >
                    <History size={18} className="mr-2" />
                    Withdrawal History
                  </Button>
                </>
              )}
              
              <Button
                variant="secondary"
                size="md"
                onClick={switchWalletType}
              >
                Switch to {walletType === 'webOwner' ? 'Advertiser' : 'Publisher'}
              </Button>
            </div>
          </div>

          {/* Wallet Overview Cards */}
          <Grid cols={4} gap={6} className="mb-12">
            <div className="border border-border bg-surface-1 p-6 transition-all duration-200 hover:bg-surface-2">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Available Balance</h3>
              </div>

              <div className="mb-6">
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(wallet?.balance || 0)}
                </p>
              </div>
            </div>

            <div className="border border-border bg-surface-1 p-6 transition-all duration-200 hover:bg-surface-2">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">
                  {walletType === 'webOwner' ? 'Total Earned' : 'Total Spent'}
                </h3>
              </div>

              <div className="mb-6">
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(walletType === 'webOwner' ? (wallet?.totalEarned || 0) : (wallet?.totalSpent || 0))}
                </p>
              </div>
            </div>

            <div className="border border-border bg-surface-1 p-6 transition-all duration-200 hover:bg-surface-2">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Total Refunded</h3>
              </div>

              <div className="mb-6">
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(wallet?.totalRefunded || 0)}
                </p>
              </div>
            </div>

            <div className="border border-border bg-surface-1 p-6 transition-all duration-200 hover:bg-surface-2">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Last Updated</h3>
              </div>

              <div className="mb-6">
                <p className="text-sm text-white">
                  {wallet?.lastUpdated ? formatDate(wallet.lastUpdated) : 'Never'}
                </p>
              </div>
            </div>
          </Grid>

          {/* Transaction History */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                Transaction History
              </h2>
              <Button
                variant="outline"
                onClick={() => fetchTransactions(currentPage)}
                disabled={transactionsLoading}
              >
                Refresh
              </Button>
            </div>

            {transactionsLoading ? (
              <div className="flex items-center justify-center min-h-64">
                <LoadingSpinner />
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="flex items-center justify-center min-h-64">
                <div className="text-center">
                  <h3 className="text-xl font-semibold mb-4 text-subtle">
                    {searchQuery ? 'No Transactions Found' : 'No Transactions Yet'}
                  </h3>
                </div>
              </div>
            ) : (
              <Grid cols={2} gap={6}>
                {filteredTransactions.map((transaction: any) => (
                  <div
                    key={transaction._id}
                    className="border border-border bg-surface-1 p-6 transition-all duration-200 hover:bg-surface-2"
                  >
                    {/* Header */}
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center">
                        <h3 className="text-lg font-semibold text-white">
                          {getTransactionTypeDisplay(transaction)}
                        </h3>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-semibold ${
                          transaction.amount > 0 ? 'text-white' : 'text-subtle'
                        }`}>
                          {transaction.amount > 0 ? '+' : '-'}{formatCurrency(transaction.amount)}
                        </div>
                      </div>
                    </div>
                    
                    {/* Description */}
                    <div className="mb-4">
                      <p className="text-subtle text-sm">{transaction.description}</p>
                    </div>

                    {/* Date */}
                    <div className="mb-6">
                      <p className="text-sm text-subtle">{formatDate(transaction.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </Grid>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Wallet;