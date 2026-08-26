'use client';
import { getToken } from '@/app/(adsense)/utils/token';
// @ts-nocheck

import React, { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import NextLink from 'next/link';
import { useSession } from '@/app/_hooks/useSession';
import { ArrowLeft, Globe, Building2, Link as LinkIcon, MapPin, FileText, Upload, X } from 'lucide-react';
import LoadingSpinner from '@/app/(adsense)/components/LoadingSpinner';
import api, { authAPI } from '@/app/_lib/adsense-api';
import type {} from '@/app/(adsense)/types';
import CategoryCard from '@/app/_components/shared/CategoryCard';
import AdImageFitModal from './AdImageFitModal';

const GLASS_CARD = 'rounded-3xl border border-black/10 bg-[#ffffff] shadow-lg';

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
  const [fitModalFile, setFitModalFile] = useState<File | null>(null);
  const [step, setStep] = useState(1);
  const [adId, setAdId] = useState<string | null>(null);
  const [paymentDone, setPaymentDone] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [selectedTierKey, setSelectedTierKey] = useState<string | null>(null);
  // True when the visitor arrived via one specific tier's own copy-link
  // (?tier=X naming an open tier) — the whole point of that link is selling
  // just that one slot, so showing the other two as alternatives would let
  // someone shown an "Elite" link buy the cheaper "Starter" slot instead.
  const [lockedToTier, setLockedToTier] = useState(false);
  const fileInputRef = useRef(null);

  // "All Pages" ad spaces (categoryInfo.targetPath === null) let the
  // advertiser pick which pages to show on, but only from pages where the
  // site-wide script has actually detected this category's placeholder div
  // (categoryInfo.detectedPages), not the website's self-reported page list.
  // An owner can register 6 pages in their dashboard but only ever have
  // pasted the ad code on 1 of them, this reflects where the ad can really
  // render. Picking 2+ real placements doubles the price.
  const registeredPages = Array.isArray(websiteInfo?.pages) ? websiteInfo.pages : [];
  const detectedPaths: string[] = Array.isArray(categoryInfo?.detectedPages) ? categoryInfo.detectedPages : [];
  const pageOptions = detectedPaths.map((path) => ({
    path,
    label: registeredPages.find((p: any) => p.path === path)?.label || path,
  }));
  const pageSelectionEligible = !categoryInfo?.targetPath && pageOptions.length >= 2;

  // Multi-tier ad spaces ("Shared/Featured/Exclusive"): pick a price from
  // whichever tier is selected instead of the space's flat price. Untiered
  // spaces (the vast majority) are completely unaffected — pricingTiers is
  // absent, so this falls straight back to categoryInfo.advertiserPrice as
  // before. Always advertiserPrice, never price — price is the owner's
  // listed (100%) number; showing that here would display a lower amount
  // than initiatePayment actually charges (which includes Yepper's margin).
  const pricingTiers: Array<{ key: string; label: string; price: number; advertiserPrice: number; maxSlots: number }> =
    Array.isArray(categoryInfo?.pricingTiers) ? categoryInfo.pricingTiers : [];
  const tierAvailability: Array<{ key: string; maxSlots: number; slotsTaken: number }> =
    Array.isArray(categoryInfo?.tierAvailability) ? categoryInfo.tierAvailability : [];
  const isTierFull = (key: string) => {
    const a = tierAvailability.find((t) => t.key === key);
    return !!a && a.slotsTaken >= a.maxSlots;
  };
  const selectedTier = pricingTiers.find((t) => t.key === selectedTierKey) || null;
  const basePrice = pricingTiers.length > 0
    ? (selectedTier?.advertiserPrice || 0)
    : parseFloat(categoryInfo?.advertiserPrice || 0);
  const displayPrice = pageSelectionEligible && selectedPages.length >= 2 ? basePrice * 2 : basePrice;

  useEffect(() => {
    if (pageSelectionEligible) {
      setSelectedPages(pageOptions.map((p) => p.path));
    } else {
      setSelectedPages([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryInfo, websiteInfo]);

  // A direct link to one specific tier (from the web owner's copy-link
  // button) always wins, even if that tier isn't the one showing publicly
  // on the site — that's the whole point of sharing it directly instead of
  // relying on whatever's currently on public display. Falls back to the
  // first tier that still has room if there's no ?tier= in the URL, or it
  // names a tier that's full/doesn't exist on this space.
  useEffect(() => {
    if (pricingTiers.length === 0) { setSelectedTierKey(null); setLockedToTier(false); return; }
    const requestedKey = queryParams.get('tier');
    const requested = requestedKey ? pricingTiers.find((t) => t.key === requestedKey && !isTierFull(t.key)) : null;
    if (requested) { setSelectedTierKey(requested.key); setLockedToTier(true); return; }
    setLockedToTier(false);
    const firstOpen = pricingTiers.find((t) => !isTierFull(t.key));
    setSelectedTierKey(firstOpen ? firstOpen.key : pricingTiers[0].key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryInfo]);

  const togglePage = (path: string) => {
    setSelectedPages((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  const toggleAllPages = () => {
    setSelectedPages((prev) =>
      prev.length === pageOptions.length ? [] : pageOptions.map((p) => p.path)
    );
  };

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
        // Restore the step too, needed so the googleReturn effect below (which
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

  // Must match the tolerance in isImageSizeAcceptable, backend/AdPromoter/utils/adSpaceLayout.js,
  // this is a UX-only pre-check, the backend call in createAdAndProceed() is the authoritative gate.
  const checkImageDimensions = (selectedFile: File): Promise<{ ok: boolean; message?: string }> => {
    return new Promise((resolve) => {
      const expected = categoryInfo?.recommendedSize as { width: number; height: number } | undefined;
      if (!expected) { resolve({ ok: true }); return; }

      const url = URL.createObjectURL(selectedFile);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const { naturalWidth: w, naturalHeight: h } = img;
        if (!w || !h) { resolve({ ok: true }); return; }

        const targetRatio = expected.width / expected.height;
        const actualRatio = w / h;
        const ratioDelta = Math.abs(actualRatio - targetRatio) / targetRatio;
        const tooSmall = w < expected.width * 0.5 || h < expected.height * 0.5;
        const wrongShape = ratioDelta > 0.15;

        if (!tooSmall && !wrongShape) { resolve({ ok: true }); return; }

        resolve({
          ok: false,
          message: wrongShape
            ? `This image is ${w}×${h}, but this ad space needs something close to ${expected.width}×${expected.height} (a ${targetRatio.toFixed(2)}:1 shape). Please upload a differently-sized image.`
            : `This image is only ${w}×${h}, which is too small for this ad space. Please upload something closer to ${expected.width}×${expected.height} or larger.`,
        });
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve({ ok: true }); };
      img.src = url;
    });
  };

  // Actually stores/previews a file that's already known to be acceptable —
  // either it passed checkImageDimensions on the first try, or it's the
  // cropped export from AdImageFitModal (which is built at exactly the
  // required pixel size, so there's nothing left to check).
  const acceptFile = (selectedFile: File) => {
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

  const processFile = async (selectedFile: File | null) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/quicktime', 'application/pdf'];
    const maxSize = 25 * 1024 * 1024; // must match the backend multer limit in WebAdvertiseController.js

    if (!selectedFile) return;

    if (!validTypes.includes(selectedFile.type)) {
      setError('Invalid file type. Please upload an image, video, or PDF.');
      return;
    }

    if (selectedFile.size > maxSize) {
      setError(`File is too large (${(selectedFile.size / (1024 * 1024)).toFixed(1)}MB). Maximum size is 25MB. Please choose a smaller file.`);
      return;
    }

    if (selectedFile.type.startsWith('image/')) {
      const dimCheck = await checkImageDimensions(selectedFile);
      if (!dimCheck.ok) {
        // A GIF can't go through the crop modal below — it exports via
        // <canvas>.toBlob, which only ever captures the single frame the
        // <img> happens to be showing at that instant, so "resizing" a GIF
        // there would silently flatten it into a static PNG. Rather than
        // do that invisibly, ask for a correctly-shaped GIF instead.
        if (selectedFile.type === 'image/gif') {
          setError(
            (dimCheck.message || 'This GIF doesn\'t fit this ad space.') +
            ' GIFs can\'t be auto-resized here without losing their animation — please crop it to size first, or use a static image instead.'
          );
          return;
        }
        // Instead of just rejecting it, let them see it against the actual
        // required size and drag/resize it to fit, Canva/Figma-style.
        setError(null);
        setFitModalFile(selectedFile);
        return;
      }
    }

    acceptFile(selectedFile);
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
      const response = (err as { response?: { message?: string; error?: string } }).response;
      setAuthError(response?.message || response?.error || (err as Error)?.message || 'Failed to create advertisement');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayment = async () => {
    if (pageSelectionEligible && selectedPages.length === 0) {
      setError('Select at least one page for this ad to appear on.');
      return;
    }
    if (pricingTiers.length > 0 && (!selectedTierKey || isTierFull(selectedTierKey))) {
      setError('Pick an available tier for this ad space.');
      return;
    }
    try {
      setIsLoading(true);

      const paymentResponse = await api.post(`/api/web-advertise/payment/initiate`, {
        adId: adId,
        selections: [{
          websiteId: websiteId,
          categoryId: categoryId,
          selectedPages: pageSelectionEligible ? selectedPages : null,
          tierKey: pricingTiers.length > 0 ? selectedTierKey : undefined,
        }]
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
          // Close the modal immediately; it won't close itself
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
    <div className="min-h-screen yp-mesh">
      {fitModalFile && categoryInfo?.recommendedSize && (
        <AdImageFitModal
          file={fitModalFile}
          targetWidth={(categoryInfo.recommendedSize as any).width}
          targetHeight={(categoryInfo.recommendedSize as any).height}
          onCancel={() => setFitModalFile(null)}
          onChangeImage={() => {
            setFitModalFile(null);
            fileInputRef.current?.click();
          }}
          onConfirm={(croppedFile) => {
            setFitModalFile(null);
            acceptFile(croppedFile);
          }}
        />
      )}

      {/* Fixed Alert Messages - Always visible at top */}
      {(error || success || authError || authSuccess) && (
        <div className="fixed top-0 left-0 right-0 z-50 px-6 pt-6">
          <div className="max-w-4xl mx-auto">
            {error && (
              <div className="mb-4 rounded-2xl border border-error bg-error/10 backdrop-blur-2xl p-4 shadow-lg">
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
              <div className="mb-4 rounded-2xl border border-success bg-success/10 backdrop-blur-2xl p-4 shadow-lg">
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
              <div className="mb-4 rounded-2xl border border-error bg-error/10 backdrop-blur-2xl p-4 shadow-lg">
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
              <div className="mb-4 rounded-2xl border border-success bg-success/10 backdrop-blur-2xl p-4 shadow-lg">
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

      <div className="border-b border-border/40 bg-surface-1/25 backdrop-blur-2xl">
        <div className="container mx-auto px-6 py-6">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            {[
              { num: 1, label: 'Ad Details' },
              { num: 2, label: 'Authentication' },
              { num: 3, label: 'Payment' }
            ].map((item: any, index: any) => (
              <React.Fragment key={item.num}>
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${
                    step >= item.num
                      ? 'border-coral bg-coral text-[#fff]'
                      : 'border-border bg-surface-1 text-muted'
                  }`}>
                    <span className="text-sm font-semibold">{item.num}</span>
                  </div>
                  <span className="text-xs mt-2 text-subtle font-medium">{item.label}</span>
                </div>
                {index < 2 && (
                  <div className={`flex-1 h-0.5 mx-4 rounded-full ${
                    step > item.num ? 'bg-coral' : 'bg-border'
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
          <div className={`${GLASS_CARD} p-6 sm:p-8 mb-8`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <div className='flex gap-2 items-center'>
                  {websiteInfo?.imageUrl ? (
                    <img
                      src={websiteInfo?.imageUrl}
                      alt={websiteInfo?.websiteName}
                      className="w-10 h-10 rounded-xl object-contain mr-3"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/global.png';
                      }}
                    />
                  ) : (
                    <Globe size={40} className="mr-3 text-subtle" />
                  )}
                  <p className="text-base font-medium text-black">{websiteInfo?.websiteName}</p>
                </div>
                <div className="mt-4 pt-4 border-t border-border/40 flex gap-2 items-center">
                  <p className="text-xs font-medium text-muted">ACCEPTED CATEGORIES</p>
                  <div className="flex flex-wrap gap-2">
                    {websiteInfo?.businessCategories?.includes('any') ? (
                      <span className="px-2.5 py-1 rounded-full border border-border bg-surface-2 text-subtle text-xs">
                        All Categories
                      </span>
                    ) : (
                      websiteInfo?.businessCategories?.map(cat => (
                        <span key={cat} className="px-2.5 py-1 rounded-full border border-border bg-surface-2 text-subtle text-xs">
                          {businessCategories.find(bc => bc.value === cat)?.label || cat}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3 text-black">Category Details</h3>
                <p className="text-base mb-2 text-black"><span className='font-medium'>{categoryInfo?.categoryName}:</span> {categoryInfo?.description}</p>

                {pricingTiers.length > 0 ? (
                  lockedToTier ? (
                    // Arrived via that tier's own direct link — show just
                    // this one slot, not the other two as alternatives.
                    (() => {
                      const t = pricingTiers.find((p) => p.key === selectedTierKey);
                      if (!t) return null;
                      const avail = tierAvailability.find((a) => a.key === t.key);
                      return (
                        <div className="space-y-2">
                          <span className="text-xs font-medium text-subtle">Tier:</span>
                          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-coral bg-coral/10">
                            <span>
                              <span className="block text-sm font-semibold text-black">{t.label}</span>
                              {t.key === 'custom' && (
                                <span className="block text-[11px] text-subtle">Stays on screen longer</span>
                              )}
                            </span>
                            <span className="text-right shrink-0">
                              <span className="block text-sm font-semibold text-black">RWF {t.advertiserPrice}</span>
                              {avail && (
                                <span className="block text-[11px] text-subtle">{avail.slotsTaken}/{avail.maxSlots} taken</span>
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                  <div className="space-y-2">
                    <span className="text-xs font-medium text-subtle">Choose a tier:</span>
                    <div className="grid grid-cols-1 gap-2">
                      {pricingTiers.map((t) => {
                        const avail = tierAvailability.find((a) => a.key === t.key);
                        const full = !!avail && avail.slotsTaken >= avail.maxSlots;
                        const selected = selectedTierKey === t.key;
                        return (
                          <button
                            key={t.key}
                            type="button"
                            disabled={full}
                            onClick={() => setSelectedTierKey(t.key)}
                            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-left transition-colors ${
                              selected ? 'border-coral bg-coral/10' : 'border-border bg-white hover:border-coral/40'
                            } ${full ? 'opacity-40 cursor-not-allowed' : ''}`}
                          >
                            <span>
                              <span className="block text-sm font-semibold text-black">{t.label}</span>
                              {t.key === 'custom' && (
                                <span className="block text-[11px] text-subtle">Stays on screen longer</span>
                              )}
                            </span>
                            <span className="text-right shrink-0">
                              <span className="block text-sm font-semibold text-black">RWF {t.advertiserPrice}</span>
                              {avail && (
                                <span className="block text-[11px] text-subtle">{avail.slotsTaken}/{avail.maxSlots} taken</span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  )
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2 text-sm">
                      <span className="text-subtle">Price:</span>
                      <span className="font-semibold text-black">RWF {categoryInfo?.advertiserPrice}</span>
                    </div>
                    <div className="flex gap-2 text-sm">
                      <span className="text-subtle">Tier:</span>
                      <span className="font-medium capitalize text-black">{categoryInfo?.tier}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Step 1: Ad Details Form */}
          {step === 1 && (
            <div className={`${GLASS_CARD} p-6 sm:p-8`}>
              <h2 className="text-xl font-semibold mb-6 text-black">Advertisement Details</h2>

              <form onSubmit={handleSubmitBasicInfo} className="space-y-6">
                {/* File Upload */}
                <div>
                  <label className="block text-sm font-medium text-subtle mb-2">
                    Upload Ad Media <span className="text-red-500">*</span>
                  </label>
                  {categoryInfo?.recommendedSize && (
                    <p className="text-xs text-muted mb-2">
                      Recommended size: {(categoryInfo.recommendedSize as any).width}×{(categoryInfo.recommendedSize as any).height}px;
                      images that don't roughly match this shape will be rejected.
                    </p>
                  )}
                  <div
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-2xl border-2 border-dashed border-border bg-surface-2 p-8 text-center cursor-pointer hover:border-coral/50 transition-colors"
                  >
                    {filePreview ? (
                      <div className="space-y-4">
                        {filePreview.type.startsWith('image/') && (
                          <img src={filePreview.url} alt="Preview" className="max-h-48 mx-auto rounded-xl" />
                        )}
                        {filePreview.type.startsWith('video/') && (
                          <video src={filePreview.url} controls className="max-h-48 mx-auto rounded-xl" />
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
                        <p className="text-xs text-muted">Images, Videos, or PDFs (Max 25MB)</p>
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
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-surface-2 focus:outline-none focus:ring-2 focus:ring-white focus:border-white"
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {businessCategories.map(cat => (
                      <CategoryCard
                        key={cat.value}
                        id={cat.value}
                        label={cat.label}
                        selected={businessData.businessCategories.includes(cat.value)}
                        onClick={() => toggleCategory(cat.value)}
                        size="card"
                      />
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
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-surface-2 focus:outline-none focus:ring-2 focus:ring-white focus:border-white"
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
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-surface-2 focus:outline-none focus:ring-2 focus:ring-white focus:border-white"
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
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-surface-2 focus:outline-none focus:ring-2 focus:ring-white focus:border-white"
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
                    className="w-full px-4 py-3 rounded-xl border border-border bg-surface-2 focus:outline-none focus:ring-2 focus:ring-white focus:border-white"
                    required
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full rounded-xl bg-white text-background py-3 font-semibold hover:bg-surface-3 border border-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Processing...' : 'Continue to Authentication'}
                </button>
              </form>
            </div>
          )}

          {/* Step 2: Authentication */}
          {step === 2 && (
            <div className={`${GLASS_CARD} p-6 sm:p-8`}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-black">
                  {isAuthenticated ? 'Review & Create Ad' : 'Sign In to Continue'}
                </h2>
                {!adId && (
                  <button
                    onClick={handleBackToStep1}
                    className="text-subtle hover:text-black transition-colors flex items-center gap-2"
                  >
                    <ArrowLeft size={18} />
                    <span className="text-sm font-medium">Back to Edit</span>
                  </button>
                )}
              </div>

              {!isAuthenticated ? (
                <div className="space-y-6">
                  <p className="text-subtle text-sm">Please sign in or create an account to proceed with your advertisement.</p>

                  {/* Google: primary CTA */}
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={isGoogleLoading || isLoading}
                    className="w-full flex items-center justify-center px-4 py-3.5 rounded-xl border-2 border-border bg-surface-2 hover:bg-surface-3 hover:border-border transition-all duration-200 font-semibold text-subtle text-base shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
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
                  <div className="rounded-xl border border-success bg-success/10 p-4">
                    <span className="text-success text-sm">You're signed in as {user?.email}</span>
                  </div>

                  <button
                    onClick={() => createAdAndProceed()}
                    disabled={isLoading}
                    className="w-full rounded-xl bg-black text-[#ffffff] py-3 font-semibold hover:bg-neutral-800 border border-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Creating Ad...' : 'Create Ad & Proceed to Payment'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Payment */}
          {step === 3 && (
            <div className={`${GLASS_CARD} p-6 sm:p-8`}>
              {paymentDone ? (
                <div className="py-4 text-center space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-success">Your ad is live!</h2>
                    <p className="text-subtle text-sm mt-2">
                      Your advertisement is now showing on{' '}
                      <span className="font-semibold text-black">{websiteInfo?.websiteName}</span>.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                    <a
                      href={websiteInfo?.websiteLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-xl bg-black text-[#ffffff] px-6 py-3 font-semibold hover:bg-neutral-800 transition-colors"
                    >
                      View your ad live →
                    </a>
                    <NextLink
                      href="/?panel=ads"
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-xl bg-transparent text-black border border-black/20 px-6 py-3 font-semibold hover:bg-black/5 transition-colors"
                    >
                      Go to dashboard & monitor traffic →
                    </NextLink>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-semibold mb-6 text-black">Complete Payment</h2>

                  <div className="space-y-6">
                    <div className="rounded-2xl border border-border bg-surface-2 p-6">
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
                        <div className="border-t border-border/40 pt-3 flex justify-between font-semibold text-base">
                          <span>Total:</span>
                          <span>
                            RWF {displayPrice}
                            {pageSelectionEligible && selectedPages.length >= 2 && (
                              <span className="ml-2 text-xs font-normal text-subtle">
                                (doubled: {selectedPages.length} pages)
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {pageSelectionEligible && (
                      <div className="rounded-2xl border border-border bg-surface-2 p-6">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-semibold">Where should this ad appear?</h3>
                          <button
                            type="button"
                            onClick={toggleAllPages}
                            className="text-xs font-medium text-coral hover:underline"
                          >
                            {selectedPages.length === pageOptions.length ? 'Clear all' : 'Select all pages'}
                          </button>
                        </div>
                        <p className="text-xs text-subtle mb-4">
                          This ad space is currently detected on {pageOptions.length} page{pageOptions.length !== 1 ? 's' : ''} of{' '}
                          {websiteInfo?.websiteName}. Choose one page to pay the base price, or 2+ pages
                          (including all of them) to double it.
                        </p>
                        <div className="space-y-2">
                          {pageOptions.map((p) => (
                            <label
                              key={p.path}
                              className="flex items-center gap-3 rounded-xl border border-border/40 bg-surface-1 px-4 py-2.5 cursor-pointer hover:border-border"
                            >
                              <input
                                type="checkbox"
                                checked={selectedPages.includes(p.path)}
                                onChange={() => togglePage(p.path)}
                                className="accent-coral"
                              />
                              <span className="text-sm font-medium">{p.label}</span>
                              <span className="text-xs text-muted font-mono">{p.path}</span>
                            </label>
                          ))}
                        </div>
                        {selectedPages.length === 0 && (
                          <p className="text-xs text-error mt-3">Select at least one page.</p>
                        )}
                      </div>
                    )}

                    <button
                      onClick={handlePayment}
                      disabled={isLoading || (pageSelectionEligible && selectedPages.length === 0)}
                      className="w-full rounded-xl bg-black text-[#ffffff] py-3 font-semibold hover:bg-neutral-800 border border-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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