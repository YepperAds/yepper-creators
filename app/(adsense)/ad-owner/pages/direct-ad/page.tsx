'use client';
import { getToken } from '@/app/(adsense)/utils/token';
// @ts-nocheck

import React, { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import NextLink from 'next/link';
import { useSession } from '@/app/_hooks/useSession';
import { ArrowLeft, Globe, Building2, Link as LinkIcon, MapPin, FileText, Upload, X, CheckCircle2 } from 'lucide-react';
import LoadingSpinner from '@/app/(adsense)/components/LoadingSpinner';
import api, { authAPI } from '@/app/_lib/adsense-api';
import type {} from '@/app/(adsense)/types';

const GoogleIcon = () => (
  <svg className="w-5 h-5 mr-3 flex-shrink-0" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);


function DirectAdvertise() {
  const { user, isAuthenticated } = useSession();
  const pathname = usePathname();
  const queryParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  
  const websiteId = queryParams.get('websiteId');
  const categoryId = queryParams.get('categoryId');
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [websiteInfo, setWebsiteInfo] = useState<Record<string, unknown> | null>(null);
  const [categoryInfo, setCategoryInfo] = useState<Record<string, unknown> | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<{ url: string | ArrayBuffer | null; type: string } | null>(null);
  const [step, setStep] = useState(1);
  const [adId, setAdId] = useState<string | null>(null);
  const [paymentDone, setPaymentDone] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const fileInputRef = useRef(null);

  const [businessData, setBusinessData] = useState({
    businessName: '',
    businessLink: '',
    businessLocation: '',
    adDescription: '',
    businessCategories: [],
    businessCategoryOther: ''
  });

  const businessCategories = [
    { value: 'technology', label: 'Technology' },
    { value: 'food-beverage', label: 'Food & Beverage' },
    { value: 'real-estate', label: 'Real Estate' },
    { value: 'automotive', label: 'Automotive' },
    { value: 'health-wellness', label: 'Health & Wellness' },
    { value: 'entertainment', label: 'Entertainment' },
    { value: 'fashion', label: 'Fashion' },
    { value: 'education', label: 'Education' },
    { value: 'business-services', label: 'Business Services' },
    { value: 'travel-tourism', label: 'Travel & Tourism' },
    { value: 'arts-culture', label: 'Arts & Culture' },
    { value: 'photography', label: 'Photography' },
    { value: 'gifts-events', label: 'Gifts & Events' },
    { value: 'government-public', label: 'Government & Public' },
    { value: 'general-retail', label: 'General Retail' },
    { value: 'other', label: 'Others' }
  ];

  const [, setFileLoaded] = useState(false);
  
  // Only resume saved progress when actually returning from the Google OAuth
  // round trip. A plain click on the ad space (no googleReturn param) should
  // always start the ad form from scratch, never pick up a stale draft from a
  // previous, unrelated visit.
  const isGoogleReturn = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('googleReturn') === 'true';

  useEffect(() => {
    if (!isGoogleReturn) {
      deleteFileFromIndexedDB(FILE_STORAGE_KEY).catch(() => {});
      setFileLoaded(true);
      return;
    }
    const loadSavedFile = async () => {
      try {
        const savedFile = await getFileFromIndexedDB(FILE_STORAGE_KEY);
        if (savedFile) {
          setFile(savedFile);
          const reader = new FileReader();
          reader.onloadend = () => {
            setFilePreview({
              url: reader.result,
              type: savedFile.type
            });
          };
          reader.readAsDataURL(savedFile);
        }
      } catch (err: unknown) {
      } finally {
        setFileLoaded(true);
      }
    };

    loadSavedFile();
  }, []);

  useEffect(() => {
    if (!isGoogleReturn) {
      localStorage.removeItem('directAdvertise_formData');
      return;
    }
    const savedData = localStorage.getItem('directAdvertise_formData');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setBusinessData(parsed.businessData || {});
        // Restore the step too — needed so the googleReturn effect below (which
        // only fires when step === 2) still sees step 2 after the OAuth round
        // trip remounts this page fresh with step defaulted back to 1.
        if (parsed.step) setStep(parsed.step);
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'emailVerified' && e.newValue === 'true') {
        localStorage.removeItem('emailVerified');
        window.location.reload();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!websiteId || !categoryId) {
        setIsLoading(false);
        return;
      }

      try {
        const [websiteResponse, categoryResponse] = await Promise.all([
          api.get(`/api/createWebsite/website/${websiteId}`),
          api.get(`/api/ad-categories/category/${categoryId}`)
        ]);
        
        setWebsiteInfo(websiteResponse.data);
        setCategoryInfo(categoryResponse.data);
        setIsLoading(false);
      } catch (err: unknown) {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [websiteId, categoryId]);

  const processFile = async (selectedFile: File | null) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/quicktime', 'application/pdf'];
    const maxSize = 50 * 1024 * 1024;

    if (!selectedFile) return;
    
    if (!validTypes.includes(selectedFile.type)) {
      setError('Invalid file type. Please upload an image, video, or PDF.');
      return;
    }
    
    if (selectedFile.size > maxSize) {
      setError('File is too large. Maximum size is 50MB.');
      return;
    }

    setFile(null);
    setFilePreview(null);
    
    setTimeout(async () => {
      setFile(selectedFile);
      setError(null);

      try {
        await saveFileToIndexedDB(FILE_STORAGE_KEY, selectedFile);
      } catch (dbError) {
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview({
          url: reader.result,
          type: selectedFile.type
        });
      };
      reader.readAsDataURL(selectedFile);
    }, 50);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    processFile(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFile(e.target.files[0]);
    e.target.value = '';
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setBusinessData(prev => ({ ...prev, [name]: value }));
    setError(null);
  };

  const toggleCategory = (value: string) => {
    setBusinessData(prev => {
      const has = prev.businessCategories.includes(value);
      const next = has
        ? prev.businessCategories.filter((c: string) => c !== value)
        : [...prev.businessCategories, value];
      return { ...prev, businessCategories: next };
    });
    setError(null);
  };

  const validateForm = () => {
    if (!businessData.businessName) {
      setError('Business name is required');
      return false;
    }
    if (!businessData.businessLink) {
      setError('Business link is required');
      return false;
    }
    if (!businessData.businessLocation) {
      setError('Business location is required');
      return false;
    }
    if (!businessData.adDescription) {
      setError('Advertisement description is required');
      return false;
    }
    if (!businessData.businessCategories.length) {
      setError('Select at least one business category');
      return false;
    }
    if (businessData.businessCategories.includes('other') && !businessData.businessCategoryOther.trim()) {
      setError('Please describe your "Others" business category');
      return false;
    }
    if (!file) {
      setError('Please upload an image, video, or PDF for your advertisement');
      return false;
    }
    return true;
  };

  const checkCategoryMatch = () => {
    if (!businessData.businessCategories.length) {
      setError('Please select your business category');
      return false;
    }

    const allowedCategories = websiteInfo?.businessCategories || [];

    const hasMatch = allowedCategories.includes('any')
      || businessData.businessCategories.some((cat: string) => allowedCategories.includes(cat));

    if (!hasMatch) {
      setError(`Sorry, this website only accepts ads from: ${allowedCategories.map(cat =>
        businessCategories.find(bc => bc.value === cat)?.label || cat
      ).join(', ')}`);
      return false;
    }

    return true;
  };

  const handleSubmitBasicInfo = async (e: any) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    if (!checkCategoryMatch()) return;

    try {
      localStorage.setItem('directAdvertise_formData', JSON.stringify({
        businessData,
        hasFile: !!file,
        fileName: file?.name,
        fileType: file?.type,
        step: 2,
        websiteId,
        categoryId
      }));
    } catch (storageError) {
    }

    setSuccess('Ad details saved! Category verified.');
    setTimeout(() => {
      setStep(2);
      setSuccess(null);
    }, 1000);
  };

  const createAdAndProceed = async (overrideEmail) => {
    try {
      setIsLoading(true);
      
      let fileToUpload = file;
      if (!fileToUpload) {
        try {
          fileToUpload = await getFileFromIndexedDB(FILE_STORAGE_KEY);
          if (fileToUpload) {
            setFile(fileToUpload);
          }
        } catch (dbError) {
        }
      }
      
      const formData = new FormData();
      // overrideEmail is passed directly after login() so we don't rely on stale React state
      formData.append('adOwnerEmail', overrideEmail || user?.email || '');
      if (fileToUpload) {
        formData.append('file', fileToUpload);
      }
      formData.append('businessName', businessData.businessName);
      formData.append('businessLink', businessData.businessLink);
      formData.append('businessLocation', businessData.businessLocation);
      formData.append('adDescription', businessData.adDescription);
      formData.append('businessCategories', JSON.stringify(businessData.businessCategories));
      formData.append('businessCategoryOther', businessData.businessCategoryOther || '');
      formData.append('selectedWebsites', JSON.stringify([websiteId]));
      formData.append('selectedCategories', JSON.stringify([categoryId]));

      const response = await api.post(`/api/web-advertise`, formData, {
        headers: { 'Authorization': `Bearer ${getToken() || ''}` },
      });

      if ((response.data as any).success) {
        setAdId((response.data as any).data.adId || (response.data as any).data._id);
        
        localStorage.removeItem('directAdvertise_formData');
        
        try {
          await deleteFileFromIndexedDB(FILE_STORAGE_KEY);
        } catch (clearError) {
        }
        
        setStep(3);
      }
      
    } catch (err: unknown) {
      setAuthError((err as { response?: { message?: string; error?: string } }).response?.message || (err as Error)?.message || 'Failed to create advertisement');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayment = async () => {
    try {
      setIsLoading(true);

      const paymentResponse = await api.post(`/api/web-advertise/payment/initiate`, {
        adId: adId,
        selections: [{ websiteId: websiteId, categoryId: categoryId }]
      }, {
        headers: { 'Authorization': `Bearer ${getToken() || ''}` }
      });

      if (!paymentResponse.data.success) {
        throw new Error(paymentResponse.data.error || 'Failed to initiate payment');
      }

      const { tx_ref, totalAmount } = paymentResponse.data;

      // Load Flutterwave inline SDK if not already loaded
      await new Promise((resolve, reject) => {
        if ((window as any).FlutterwaveCheckout) { resolve(); return; }
        const script = document.createElement('script');
        script.src = 'https://checkout.flutterwave.com/v3.js';
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
      });

      setIsLoading(false);

      const flwModal = (window as any).FlutterwaveCheckout({
        public_key: process.env.NEXT_PUBLIC_FLW_PUBLIC_KEY,
        tx_ref,
        amount: totalAmount,
        currency: 'RWF',
        payment_options: 'card, mobilemoney',
        customer: {
          email: user?.email || '',
          name: user?.name || businessData.businessName,
        },
        customizations: {
          title: 'Yepper Ads',
          description: `Ad placement on ${websiteInfo?.websiteName}`,
          logo: '',
        },
        callback: async (data) => {
          // Close the modal immediately — it won't close itself
          if (flwModal && typeof flwModal.close === 'function') flwModal.close();

          if (data.status === 'successful' || data.status === 'completed') {
            try {
              setIsLoading(true);
              const verifyRes = await api.post('/api/web-advertise/payment/verify', {
                transaction_id: String(data.transaction_id),
                tx_ref: data.tx_ref,
              }, {
                headers: { 'Authorization': `Bearer ${getToken() || ''}` }
              });
              if (verifyRes.data.success) {
                setPaymentDone(true);
              } else {
                setError(verifyRes.data.message || 'Payment verification failed.');
              }
            } catch (err: unknown) {
              setError((err as { response?: { error?: string } }).response?.error || (err as Error)?.message || 'Payment verification failed.');
            } finally {
              setIsLoading(false);
            }
          } else {
            setError('Payment was not completed. Please try again.');
          }
        },
        onclose: () => {
          setIsLoading(false);
        },
      });

    } catch (err: unknown) {
      setError((err as { response?: { message?: string; error?: string } }).response?.error || (err as Error).message || 'Failed to initiate payment');
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setIsGoogleLoading(true);
    // Persist form data so it survives the Google redirect round trip
    try {
      localStorage.setItem('directAdvertise_formData', JSON.stringify({
        businessData,
        hasFile: !!file,
        fileName: file?.name,
        fileType: file?.type,
        step: 2,
        websiteId,
        categoryId
      }));
    } catch (_) {}
    const from = `/ad-owner/pages/direct-ad?websiteId=${websiteId}&categoryId=${categoryId}&googleReturn=true`;
    window.location.href = `${authAPI.googleRedirect()}?from=${encodeURIComponent(from)}`;
  };

  // After Google OAuth returns the user here with googleReturn=true, fire createAdAndProceed
  useEffect(() => {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    if (params.get('googleReturn') === 'true' && isAuthenticated && user?.email && step === 2) {
      // Clean the URL so we don't re-trigger
      window.history.replaceState({}, '', `/ad-owner/pages/direct-ad?websiteId=${websiteId}&categoryId=${categoryId}`);
      createAdAndProceed(user.email);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user]);

  const handleBackToStep1 = () => {
    setStep(1);
    setError(null);
    setSuccess(null);
    setAuthError(null);
    setAuthSuccess(null);
  };

  if (isLoading && !websiteInfo) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed Alert Messages - Always visible at top */}
      {(error || success || authError || authSuccess) && (
        <div className="fixed top-0 left-0 right-0 z-50 px-6 pt-6">
          <div className="max-w-4xl mx-auto">
            {error && (
              <div className="mb-4 border-2 border-error bg-error/10 p-4 shadow-lg">
                <div className="flex items-start justify-between">
                  <p className="text-error text-sm flex-1">{error}</p>
                  <button
                    onClick={() => setError(null)}
                    className="ml-4 text-error hover:text-red-900"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            )}

            {success && (
              <div className="mb-4 border-2 border-success bg-success/10 p-4 shadow-lg">
                <div className="flex items-start justify-between">
                  <p className="text-success text-sm flex-1">{success}</p>
                  <button
                    onClick={() => setSuccess(null)}
                    className="ml-4 text-success hover:text-green-900"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            )}

            {authError && (
              <div className="mb-4 border-2 border-error bg-error/10 p-4 shadow-lg">
                <div className="flex items-start justify-between">
                  <p className="text-error text-sm flex-1">{authError}</p>
                  <button
                    onClick={() => setAuthError(null)}
                    className="ml-4 text-error hover:text-red-900"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            )}

            {authSuccess && (
              <div className="mb-4 border-2 border-success bg-success/10 p-4 shadow-lg">
                <div className="flex items-start justify-between">
                  <p className="text-success text-sm flex-1">{authSuccess}</p>
                  <button
                    onClick={() => setAuthSuccess(null)}
                    className="ml-4 text-success hover:text-green-900"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="border-b border-border bg-surface-2">
        <div className="container mx-auto px-6 py-6">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            {[
              { num: 1, label: 'Ad Details' },
              { num: 2, label: 'Authentication' },
              { num: 3, label: 'Payment' }
            ].map((item: any, index: any) => (
              <React.Fragment key={item.num}>
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 border-2 flex items-center justify-center transition-all ${
                    step >= item.num 
                      ? 'border-border bg-black text-[#fff]' 
                      : 'border-border bg-surface-1 text-muted'
                  }`}>
                    <span className="text-sm font-semibold">{item.num}</span>
                  </div>
                  <span className="text-xs mt-2 text-subtle font-medium">{item.label}</span>
                </div>
                {index < 2 && (
                  <div className={`flex-1 h-0.5 mx-4 ${
                    step > item.num ? 'bg-black' : 'bg-gray-300'
                  } transition-all`}></div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="border border-border bg-surface-1 p-8 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <div className='flex gap-2 items-center'>
                  {websiteInfo?.imageUrl ? (
                    <img 
                      src={websiteInfo?.imageUrl} 
                      alt={websiteInfo?.websiteName}
                      className="w-10 h-10 object-contain mr-3"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/global.png';
                      }}
                    />
                  ) : (
                    <Globe size={40} className="mr-3 text-white" />
                  )}
                  <p className="text-base font-medium">{websiteInfo?.websiteName}</p>
                </div>
                <div className="mt-4 pt-4 border-t border-border flex gap-2 items-center">
                  <p className="text-xs font-medium text-muted">ACCEPTED CATEGORIES</p>
                  <div className="flex flex-wrap gap-2">
                    {websiteInfo?.businessCategories?.includes('any') ? (
                      <span className="px-2 py-1 border border-border bg-surface-2 text-subtle text-xs">
                        All Categories
                      </span>
                    ) : (
                      websiteInfo?.businessCategories?.map(cat => (
                        <span key={cat} className="px-2 py-1 border border-border bg-surface-2 text-subtle text-xs">
                          {businessCategories.find(bc => bc.value === cat)?.label || cat}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-3">Category Details</h3>
                <p className="text-base mb-2"><span className='font-medium'>{categoryInfo?.categoryName}:</span> {categoryInfo?.description}</p>
                <div className="space-y-2">
                  <div className="flex gap-2 text-sm">
                    <span className="text-subtle">Price:</span>
                    <span className="font-semibold">${categoryInfo?.price}</span>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <span className="text-subtle">Tier:</span>
                    <span className="font-medium capitalize">{categoryInfo?.tier}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 1: Ad Details Form */}
          {step === 1 && (
            <div className="border border-border bg-surface-1 p-8">
              <h2 className="text-xl font-semibold mb-6">Advertisement Details</h2>
              
              <form onSubmit={handleSubmitBasicInfo} className="space-y-6">
                {/* File Upload */}
                <div>
                  <label className="block text-sm font-medium text-subtle mb-2">
                    Upload Ad Media <span className="text-red-500">*</span>
                  </label>
                  <div
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-border bg-surface-2 p-8 text-center cursor-pointer hover:border-muted transition-colors"
                  >
                    {filePreview ? (
                      <div className="space-y-4">
                        {filePreview.type.startsWith('image/') && (
                          <img src={filePreview.url} alt="Preview" className="max-h-48 mx-auto" />
                        )}
                        {filePreview.type.startsWith('video/') && (
                          <video src={filePreview.url} controls className="max-h-48 mx-auto" />
                        )}
                        <div className="flex items-center justify-center gap-2">
                          <p className="text-sm text-subtle">{file?.name}</p>
                          <button
                            type="button"
                            onClick={(e: any) => {
                              e.stopPropagation();
                              setFile(null);
                              setFilePreview(null);
                              deleteFileFromIndexedDB(FILE_STORAGE_KEY);
                            }}
                            className="text-muted hover:text-subtle"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <Upload size={32} className="mx-auto mb-3 text-muted" />
                        <p className="text-subtle mb-1">Drop your file here or click to browse</p>
                        <p className="text-xs text-muted">Images, Videos, or PDFs (Max 50MB)</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileChange}
                    accept="image/*,video/*,.pdf"
                    className="hidden"
                  />
                </div>

                {/* Business Name */}
                <div>
                  <label className="block text-sm font-medium text-subtle mb-2">
                    Business Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="businessName"
                      placeholder="Your Business Name"
                      value={businessData.businessName}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-3 border border-border focus:outline-none focus:ring-2 focus:ring-white focus:border-white"
                      required
                    />
                    <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  </div>
                </div>

                {/* Business Category */}
                <div>
                  <label className="block text-sm font-medium text-subtle mb-2">
                    Business Category <span className="text-red-500">*</span>
                    <span className="text-muted font-normal"> (select one or more)</span>
                  </label>
                  <div className="border border-border bg-surface-1 p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {businessCategories.map(cat => (
                      <label key={cat.value} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={businessData.businessCategories.includes(cat.value)}
                          onChange={() => toggleCategory(cat.value)}
                          className="accent-white"
                        />
                        {cat.label}
                      </label>
                    ))}
                  </div>
                  {businessData.businessCategories.includes('other') && (
                    <div className="relative mt-3">
                      <input
                        type="text"
                        name="businessCategoryOther"
                        placeholder="Describe your business category"
                        value={businessData.businessCategoryOther}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-3 border border-border focus:outline-none focus:ring-2 focus:ring-white focus:border-white"
                        required
                      />
                      <FileText size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    </div>
                  )}
                </div>

                {/* Business Link */}
                <div>
                  <label className="block text-sm font-medium text-subtle mb-2">
                    Business Website <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="url"
                      name="businessLink"
                      value={businessData.businessLink}
                      onChange={handleInputChange}
                      placeholder="https://www.yourbusiness.com"
                      className="w-full pl-10 pr-4 py-3 border border-border focus:outline-none focus:ring-2 focus:ring-white focus:border-white"
                      required
                    />
                    <LinkIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  </div>
                </div>

                {/* Business Location */}
                <div>
                  <label className="block text-sm font-medium text-subtle mb-2">
                    Business Location <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="businessLocation"
                      value={businessData.businessLocation}
                      onChange={handleInputChange}
                      placeholder="City, State, or Country"
                      className="w-full pl-10 pr-4 py-3 border border-border focus:outline-none focus:ring-2 focus:ring-white focus:border-white"
                      required
                    />
                    <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  </div>
                </div>

                {/* Ad Description */}
                <div>
                  <label className="block text-sm font-medium text-subtle mb-2">
                    Advertisement Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="adDescription"
                    value={businessData.adDescription}
                    onChange={handleInputChange}
                    rows="4"
                    placeholder="Tell us about your business in a few compelling words..."
                    className="w-full px-4 py-3 border border-border focus:outline-none focus:ring-2 focus:ring-white focus:border-white"
                    required
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-black text-[#fff] py-3 font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Processing...' : 'Continue to Authentication'}
                </button>
              </form>
            </div>
          )}

          {/* Step 2: Authentication */}
          {step === 2 && (
            <div className="border border-border bg-surface-1 p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">
                  {isAuthenticated ? 'Review & Create Ad' : 'Sign In to Continue'}
                </h2>
                {!adId && (
                  <button
                    onClick={handleBackToStep1}
                    className="text-subtle hover:text-white transition-colors flex items-center gap-2"
                  >
                    <ArrowLeft size={18} />
                    <span className="text-sm font-medium">Back to Edit</span>
                  </button>
                )}
              </div>
              
              {!isAuthenticated ? (
                <div className="space-y-6">
                  <p className="text-subtle text-sm">Please sign in or create an account to proceed with your advertisement.</p>
                  
                  {/* Google — primary CTA */}
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={isGoogleLoading || isLoading}
                    className="w-full flex items-center justify-center px-4 py-3.5 border-2 border-border bg-surface-1 hover:bg-surface-2 hover:border-border transition-all duration-200 font-semibold text-subtle text-base shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isGoogleLoading ? (
                      <svg className="animate-spin w-5 h-5 mr-3 text-muted" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    ) : (
                      <GoogleIcon />
                    )}
                    {isGoogleLoading ? 'Redirecting...' : 'Continue with Google'}
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="border border-success bg-success/10 p-4">
                    <span className="text-success text-sm">You're signed in as {user?.email}</span>
                  </div>
                  
                  <button
                    onClick={() => createAdAndProceed()}
                    disabled={isLoading}
                    className="w-full bg-black text-[#fff] py-3 font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Creating Ad...' : 'Create Ad & Proceed to Payment'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Payment */}
          {step === 3 && (
            <div className="border border-border bg-surface-1 p-8">
              {paymentDone ? (
                <div className="py-4 text-center space-y-6">
                  <div className="w-16 h-16 mx-auto rounded-full bg-success/10 border-2 border-success flex items-center justify-center">
                    <CheckCircle2 size={32} className="text-success" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Your ad is live! 🎉</h2>
                    <p className="text-subtle text-sm mt-2">
                      Your advertisement is now showing on{' '}
                      <span className="font-semibold text-white">{websiteInfo?.websiteName}</span>.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                    <a
                      href={websiteInfo?.websiteLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-white text-black px-6 py-3 font-semibold hover:bg-gray-100 transition-colors"
                    >
                      View your ad live →
                    </a>
                    <NextLink
                      href="/analytics"
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-black text-[#fff] border border-border px-6 py-3 font-semibold hover:bg-gray-800 transition-colors"
                    >
                      Go to dashboard & monitor traffic →
                    </NextLink>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-semibold mb-6">Complete Payment</h2>

                  <div className="space-y-6">
                    <div className="border border-border bg-surface-2 p-6">
                      <h3 className="font-semibold mb-4">Order Summary</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-subtle">Website:</span>
                          <span className="font-medium">{websiteInfo?.websiteName}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-subtle">Category:</span>
                          <span className="font-medium">{categoryInfo?.categoryName}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-subtle">Business:</span>
                          <span className="font-medium">{businessData.businessName}</span>
                        </div>
                        <div className="border-t border-border pt-3 flex justify-between font-semibold text-base">
                          <span>Total:</span>
                          <span>${categoryInfo?.price}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handlePayment}
                      disabled={isLoading}
                      className="w-full bg-black text-[#fff] py-3 font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? 'Processing...' : 'Proceed to Payment'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// IndexedDB helper functions for file storage
const FILE_STORAGE_KEY = 'directAdvertise_uploadedFile';
const DB_NAME = 'DirectAdvertiseDB';
const STORE_NAME = 'files';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as FileReader).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function saveFileToIndexedDB(key, file) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(file, key);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

async function getFileFromIndexedDB(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function deleteFileFromIndexedDB(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(key);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export default DirectAdvertise;