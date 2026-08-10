'use client';
import { getToken } from '@/app/(adsense)/utils/token';
// @ts-nocheck

// SelectCategoriesForExistingAd.js
import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Check,
  ArrowLeft,
  Eye,
  Wallet,
} from 'lucide-react';
import { Button, Text, Heading, Container, Badge } from '@/app/(adsense)/components/components';
import LoadingSpinner from '@/app/(adsense)/components/LoadingSpinner';

import api from '@/app/_lib/adsense-api';


const SelectCategoriesForExistingAd = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { adId, selectedWebsites, ad, isReassignment } = ({}) || {};
  
  const [categoriesByWebsite, setCategoriesByWebsite] = useState<Array<{ websiteId: string; websiteName: string; websiteLink: string; categories: Array<{ _id: string; categoryName: string; description: string; price: number; tier: string; isFullyBooked?: boolean }> }>>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [loading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPaymentSummary, setShowPaymentSummary] = useState(false);
  const [paymentSelections, setPaymentSelections] = useState<Array<{ websiteId: string; categoryId: string; price: number; categoryName: string; websiteName: string }>>([]);
  const [, setWalletInfo] = useState<{ balance: number; hasWallet: boolean }>({ balance: 0, hasWallet: false });
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [error, setError] = useState<string | boolean>(false);
  const [, setTotalCost] = useState<number>(0);
  
  const [paymentBreakdown, setPaymentBreakdown] = useState({
    totalCost: 0,
    walletBalance: 0,
    availableRefunds: 0,
    paidFromWallet: 0,
    paidFromRefunds: 0,
    needsExternalPayment: 0,
    canAffordAll: false,
    isReassignment: false,
    paymentRestrictions: ''
  });

  // Map category names to their corresponding images
  const getAdSpaceImage = (categoryName) => {
    const normalizedName = categoryName.toLowerCase().replace(/\s+/g, '');
    
    const imageMap = {
      'abovethefold': '/ad-spaces/above-the-fold.png',
      'beneathtitle': '/ad-spaces/beneath-title.png',
      'floating': '/ad-spaces/floating.png',
      'header': '/ad-spaces/header.png',
      'inlinecontent': '/ad-spaces/inline-content.png',
      'leftrail': '/ad-spaces/left-rail.png',
      'modal': '/ad-spaces/modal.png',
      'profooter': '/ad-spaces/pro-footer.png',
      'sidebar': '/ad-spaces/sidebar.png',
      'stickysidebar': '/ad-spaces/sticky-sidebar.png'
    };

    return imageMap[normalizedName] || null;
  };

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
    if (!adId || !selectedWebsites || !ad) {
      router.push('/my-ads');
      return;
    }
    fetchCategories();
    fetchWalletInfo();
  }, [adId, selectedWebsites]);

  useEffect(() => {
    if (showPaymentSummary && paymentSelections.length > 0) {
      calculatePaymentBreakdown();
    }
  }, [showPaymentSummary, paymentSelections]);

  // Calculate total cost when categories are selected
  useEffect(() => {
    const calculateTotal = () => {
      let total = 0;
      selectedCategories.forEach(categoryId => {
        categoriesByWebsite.forEach(website => {
          const category = website.categories.find(cat => cat._id === categoryId);
          if (category) {
            total += category.price;
          }
        });
      });
      setTotalCost(total);
    };

    calculateTotal();
  }, [selectedCategories, categoriesByWebsite]);

  const fetchWalletInfo = async () => {
    try {
      const response = await api.get(
        '/api/web-advertise/payment/wallet-balance',
        { headers: getAuthHeaders() }
      );
      
      if ((response.data as any).success) {
        setWalletInfo({
          balance: (response.data as any).walletBalance || 0,
          hasWallet: (response.data as any).hasWallet || false
        });
      }
    } catch (err: unknown) {
      setWalletInfo({ balance: 0, hasWallet: false });
    }
  };

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const promises = selectedWebsites.map(async (websiteId) => {
        const websiteResponse = await api.get(`/api/createWebsite/website/${websiteId}`);
        const websiteData = websiteResponse.data;
        
        const categoriesResponse = await api.get(
          `/api/ad-categories/${websiteId}/advertiser`,
          { headers: getAuthHeaders() }
        );
        
        if (!categoriesResponse.status === 200) {
          throw new Error(`HTTP error! status: ${categoriesResponse.status}`);
        }
        
        const categoriesData = categoriesResponse.data;

        return {
          websiteId: websiteId,
          websiteName: websiteData.websiteName || 'Unknown Website',
          websiteLink: websiteData.websiteLink || '#',
          categories: categoriesData.categories || [],
        };
      });
      
      const result = await Promise.all(promises);
      setCategoriesByWebsite(result.filter(Boolean));
      
    } catch (err: unknown) {
      setError('Failed to load categories. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const calculatePaymentBreakdown = async () => {
    try {
      const selections = paymentSelections.map(selection => ({
        adId: adId,
        websiteId: selection.websiteId,
        categoryId: selection.categoryId
      }));

      const response = await api.post(
        '/api/web-advertise/payment/calculate-breakdown',
        { 
          selections,
          isReassignment: isReassignment || false
        },
        { headers: getAuthHeaders() }
      );

      if ((response.data as any).success) {
        setPaymentBreakdown((response.data as any).summary);
        
        if (isReassignment && (response.data as any).summary.paidFromRefunds > 0) {
          setError('Error: Refunds cannot be used for reassignment. Please contact support.');
          return;
        }
      }
    } catch (err: unknown) {
      if ((err as { response?: { data?: { code?: string; error?: string; message?: string } } }).response?.data?.code === 'REFUND_NOT_ALLOWED_FOR_REASSIGNMENT') {
        setError('Refunds cannot be used for ad reassignment. Only wallet balance and card payments are allowed.');
      }
    }
  };

  const buildPaymentSelections = () => {
    const selections = [];
    
    selectedCategories.forEach(categoryId => {
      for (const website of categoriesByWebsite) {
        const category = website.categories.find(cat => cat._id === categoryId);
        
        if (category) {
          const selection = {
            websiteId: website.websiteId,
            categoryId: categoryId,
            price: parseFloat(category.price) || 0,
            categoryName: category.categoryName || 'Unknown Category',
            websiteName: website.websiteName || 'Unknown Website'
          };
          
          selections.push(selection);
          break;
        }
      }
    });
    
    return selections;
  };

  const handleCategorySelection = (categoryId) => {
    setSelectedCategories((prevSelected) =>
      prevSelected.includes(categoryId) 
        ? prevSelected.filter((id: any) => id !== categoryId) 
        : [...prevSelected, categoryId]
    );
    setError(false);
  };

  const toggleCategoryExpansion = (categoryId) => {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId);
  };

  const handleProceedToPayment = async () => {
    if (selectedCategories.length === 0) {
      setError(true);
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const builtSelections = buildPaymentSelections();
      
      if (builtSelections.length === 0) {
        setError('No valid categories found. Please refresh and try again.');
        setIsSubmitting(false);
        return;
      }

      const response = await api.post(
        `/api/web-advertise/${adId}/add-selections`,
        {
          selectedWebsites: JSON.stringify(selectedWebsites),
          selectedCategories: JSON.stringify(selectedCategories),
          isReassignment: isReassignment || false
        },
        { headers: getAuthHeaders() }
      );

      if ((response.data as any).success) {
        setPaymentSelections(builtSelections);
        setShowPaymentSummary(true);
      }
    } catch (err: unknown) {
      if ((err as { response?: { data?: { code?: string; error?: string; message?: string } } }).response?.data?.code === 'REFUND_NOT_ALLOWED_FOR_REASSIGNMENT') {
        setError('Error: Refunds cannot be used for ad reassignment. Only wallet balance and card payments are allowed.');
      } else {
        setError('Error adding website selections: ' + ((err as { response?: { data?: { code?: string; error?: string; message?: string } } }).response?.data?.error || 'Unknown error'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayAllCategories = async () => {
    try {
      setIsSubmitting(true);
      
      const selections = paymentSelections.map(selection => ({
        adId: adId,
        websiteId: selection.websiteId,
        categoryId: selection.categoryId
      }));

      if (isReassignment && paymentBreakdown.paidFromRefunds > 0) {
        setError('Error: Refunds cannot be used for reassignment payments. Please contact support.');
        setIsSubmitting(false);
        return;
      }

      const response = await api.post(
        '/api/web-advertise/payment/process-wallet',
        { 
          selections,
          isReassignment: isReassignment || false
        },
        { headers: getAuthHeaders() }
      );

      if ((response.data as any).success) {
        if (isReassignment && (response.data as any).summary?.refundUsed > 0) {
          setError('Error: Server attempted to apply refunds to reassignment. Please contact support.');
          setIsSubmitting(false);
          return;
        }

        if ((response.data as any).allPaid) {
          router.push('/my-ads');
        } else {
          
          if ((response.data as any).paymentUrl) {
            window.location.href = (response.data as any).paymentUrl;
          } else {
            throw new Error('Payment URL not provided');
          }
        }
      } else {
        throw new Error((response.data as any).error || 'Payment failed');
      }
    } catch (err: unknown) {
      let errorMessage = 'Payment failed';
      const errData = (err as any).response?.data;
      if (errData) {
        if (errData.code === 'REFUND_NOT_ALLOWED_FOR_REASSIGNMENT') {
          errorMessage = 'Refunds cannot be used for ad reassignment. Only wallet balance and card payments are allowed.';
        } else {
          errorMessage = errData.error || errData.message || 'Server error occurred';
        }
      } else if ((err as any).message) {
        errorMessage = (err as any).message;
      }
      
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPaymentButtonText = () => {
    const { paidFromWallet, paidFromRefunds, needsExternalPayment, isReassignment } = paymentBreakdown;
    
    const actualRefundAmount = isReassignment ? 0 : paidFromRefunds;
    
    if (needsExternalPayment === 0) {
      let text = 'Complete All Payments';
      let parts = [];
      
      if (paidFromWallet > 0) {
        parts.push(`RWF ${paidFromWallet.toFixed(2)} from wallet`);
      }
      
      if (actualRefundAmount > 0 && !isReassignment) {
        parts.push(`RWF ${actualRefundAmount.toFixed(2)} from refunds`);
      }
      
      if (parts.length > 0) {
        text += ` (${parts.join(', ')})`;
      }
      
      if (isReassignment) {
        text += ' - Reassignment';
      }
      
      return text;
    } else {
      let parts = [];
      
      if (paidFromWallet > 0) {
        parts.push(`RWF ${paidFromWallet.toFixed(2)} from wallet`);
      }
      
      if (actualRefundAmount > 0 && !isReassignment) {
        parts.push(`RWF ${actualRefundAmount.toFixed(2)} from refunds`);
      }
      
      let text = `Pay RWF ${needsExternalPayment.toFixed(2)} with Card`;
      if (parts.length > 0) {
        text += ` (${parts.join(', ')} applied)`;
      }
      
      if (isReassignment) {
        text += ' - Reassignment';
      }
      
      return text;
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  // Payment Summary Modal
  if (showPaymentSummary) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-background">
          <Container>
            <div className="h-16 flex items-center justify-between">
              <button 
                onClick={() => setShowPaymentSummary(false)} 
                className="flex items-center text-subtle hover:text-white transition-colors"
              >
                <ArrowLeft size={18} className="mr-2" />
                <span className="font-medium">Back to Selection</span>
              </button>
              <Badge variant="default">
                {isReassignment ? 'Complete Reassignment Payment' : 'Complete Your Payment'}
              </Badge>
            </div>
          </Container>
        </header>

        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <Heading level={2} className="mb-2">
              {isReassignment ? 'Ad Reassignment Ready' : 'Categories Selected Successfully'}
            </Heading>
            <Text variant="muted">
              Complete payment for each ad placement to publish your ad
            </Text>
          </div>

          {/* Ad Summary */}
          <div className="bg-surface-2 border border-border p-6 mb-8">
            <Heading level={3} className="mb-4">Ad Summary</Heading>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Text className="font-medium">Business:</Text>
                <Text>{ad?.businessName}</Text>
              </div>
              <div>
                <Text className="font-medium">Location:</Text>
                <Text>{ad?.businessLocation}</Text>
              </div>
            </div>
          </div>

          {/* Payment Breakdown */}
          <div className="border border-border p-6 mb-8">
            <Heading level={3} className="mb-4">Payment Breakdown</Heading>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Text>Total Cost:</Text>
                <Text className="text-lg font-semibold">RWF {paymentBreakdown.totalCost?.toFixed(2)}</Text>
              </div>
              
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Wallet size={16} className="text-white" />
                  <Text>Your Wallet Balance:</Text>
                </div>
                <Text className="text-white font-medium">RWF {paymentBreakdown.walletBalance?.toFixed(2)}</Text>
              </div>
              
              <div className="border-t pt-3">
                {paymentBreakdown.paidFromWallet > 0 && (
                  <div className="flex justify-between items-center text-white">
                    <Text>Paid from Wallet:</Text>
                    <Text className="font-medium">-RWF {paymentBreakdown.paidFromWallet?.toFixed(2)}</Text>
                  </div>
                )}
                
                <div className="flex justify-between items-center font-bold text-lg pt-3 border-t">
                  <Text>
                    {paymentBreakdown.needsExternalPayment > 0 ? 'Remaining to Pay:' : 'Total Paid:'}
                  </Text>
                  <div className="flex items-center gap-2">
                    <Text>
                      {paymentBreakdown.needsExternalPayment > 0 
                        ? `RWF ${paymentBreakdown.needsExternalPayment?.toFixed(2)}`
                        : `RWF ${paymentBreakdown.totalCost?.toFixed(2)}`
                      }
                    </Text>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Selected Categories */}
          <div className="space-y-4 mb-8">
            {paymentSelections.map((selection: any, index: any) => (
              <div key={index} className="border border-border bg-surface-1 p-6">
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <Heading level={4} className="mb-1">{selection.websiteName}</Heading>
                    <Text variant="muted" className="mb-2">{selection.categoryName}</Text>
                    <div className="flex items-center gap-2">
                      <Text className="text-lg font-semibold">RWF {selection.price.toFixed(2)}</Text>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Action Button */}
          <div className="text-center">
            <Button
              onClick={handlePayAllCategories}
              disabled={isSubmitting}
              variant="secondary"
              size="lg"
            >
              {isSubmitting ? 'Processing...' : getPaymentButtonText()}
            </Button>
          </div>
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
              onClick={() => router.push('/my-ads')} 
              className="flex items-center text-subtle hover:text-white transition-colors"
            >
              <ArrowLeft size={18} className="mr-2" />
              <span className="font-medium">Back</span>
            </button>
            <Badge variant="default">
              {isReassignment ? 'Reassign Ad Placements' : 'Add New Ad Placements'}
            </Badge>
          </div>
        </Container>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Info Banner */}
        <div className="py-6">
          <div className="flex items-start gap-3">
            <div>
              <p className="text-subtle max-w-2xl mb-4">
                Select where your ad will appear on each website. Each spot shows exactly where visitors will see it. If you already have funds in your Yepper wallet, you can use them for reassignment. If the cost is higher, just pay the difference.
              </p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="border border-error bg-error/10 p-4 mb-8">
            <div className="flex items-center gap-3">
              <Text variant="error">
                {typeof error === 'string' ? error : 'Please select at least one ad placement to proceed'}
              </Text>
            </div>
          </div>
        )}

        {/* Categories Grid */}
        {categoriesByWebsite.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            {categoriesByWebsite.map((website: any) => (
              <div key={website.websiteName} className="border border-border bg-surface-1">
                {/* Website Header */}
                <div className="p-6 border-b border-border">
                  <div className="flex justify-between items-center">
                    <div>
                      <Heading level={3} className="mb-1">{website.websiteName}</Heading>
                      <Text variant="muted">Available ad placements on this website</Text>
                    </div>
                    <a 
                      href={website.websiteLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        iconPosition="left"
                      >
                        Visit Site
                      </Button>
                    </a>
                  </div>
                </div>
                
                {/* Categories */}
                {website.categories.length > 0 ? (
                  <div className="p-6 space-y-6">
                    {website.categories.map((category: any) => {
                      const adImage = getAdSpaceImage(category.categoryName);
                      const isExpanded = expandedCategory === category._id;
                      const isSelected = selectedCategories.includes(category._id);
                      
                      return (
                        <div
                          key={category._id}
                          className={`border transition-all duration-200 bg-surface-1 relative ${
                            isSelected ? 'border-border shadow-md' : 'border-border'
                          } ${category.isFullyBooked ? 'opacity-60' : ''}`}
                        >
                          {category.isFullyBooked && (
                            <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 text-xs font-medium z-10">
                              FULLY BOOKED
                            </div>
                          )}
                          
                          {/* Main Content */}
                          <div
                            onClick={() => !category.isFullyBooked && handleCategorySelection(category._id)}
                            className={`p-6 ${category.isFullyBooked ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-surface-2'}`}
                          >
                            <div className={`grid gap-6 items-center ${adImage ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-4'}`}>
                              {/* Ad Preview Image */}
                              {adImage && (
                                <div className="w-full h-32 border border-border bg-surface-2 overflow-hidden">
                                  <img 
                                    src={adImage} 
                                    alt={`${category.categoryName} placement preview`}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              
                              {/* Category Info */}
                              <div className={adImage ? 'md:col-span-2' : 'md:col-span-3'}>
                                <div className="flex items-center gap-3 mb-3">
                                  <Heading level={4}>{category.categoryName}</Heading>
                                </div>
                                
                                <Text className="mb-4">
                                  {category.description.length > 80 
                                    ? `${category.description.substring(0, 80)}...`
                                    : category.description
                                  }
                                </Text>

                                <div className="flex items-center gap-6">
                                  <div className="flex items-center justify-center gap-2">
                                    <span className="text-lg font-semibold text-white">
                                      RWF {category.price}
                                    </span>
                                  </div>
                                  
                                  {category.description.length > 80 && (
                                    <Button 
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e: any) => {
                                        e.stopPropagation();
                                        toggleCategoryExpansion(category._id);
                                      }}
                                      icon={Eye}
                                      iconPosition="left"
                                    >
                                      {isExpanded ? 'Show Less' : 'Read More'}
                                    </Button>
                                  )}
                                </div>
                              </div>
                              
                              {/* Selection Indicator */}
                              <div className="text-center">
                                <div className={`w-10 h-10 border-2 flex items-center justify-center mx-auto mb-2 transition-colors ${
                                  isSelected ? 'bg-black border-border' : 'border-border'
                                }`}>
                                  {isSelected && <Check size={20} className="text-[#fff]" />}
                                </div>
                                <Text 
                                  variant="small" 
                                  className={`font-medium ${isSelected ? 'text-white' : 'text-muted'}`}
                                >
                                  {isSelected ? 'SELECTED' : 'SELECT'}
                                </Text>
                              </div>
                            </div>
                          </div>

                          {/* Expanded Description */}
                          {isExpanded && (
                            <div className="px-6 pb-6 border-t border-border">
                              <Text className="pt-4">{category.description}</Text>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <Heading level={4} className="mb-2">No Ad Spaces Available</Heading>
                    <Text variant="muted">
                      This website doesn't have any available ad placements right now. Check back later!
                    </Text>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <Heading level={2} className="mb-4">No Ad Spaces Found</Heading>
            <Text variant="muted" className="mb-8">
              The selected websites don't have any available ad placements. 
              Please try selecting different websites.
            </Text>
          </div>
        )}
        
        {/* Footer Actions */}
        <div className="border-t border-border pt-8 text-center">
          <Button 
            onClick={handleProceedToPayment}
            disabled={selectedCategories.length === 0 || isSubmitting}
            loading={isSubmitting}
            variant="secondary"
            size="lg"
          >
            {isSubmitting ? 'Processing...' : selectedCategories.length > 0 ? 
              `${isReassignment ? 'Continue to Payment' : 'Continue to Payment'}` : 
              'Select Ad Spaces to Continue'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SelectCategoriesForExistingAd;