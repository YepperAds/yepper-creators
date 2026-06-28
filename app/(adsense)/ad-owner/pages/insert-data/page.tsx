'use client';
import { getToken } from '@/app/(adsense)/utils/token';
// @ts-nocheck

// BusinessForm.js
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { ArrowLeft, Building2, Tag, MapPin, FileText, X } from 'lucide-react';
import { Container, Badge, Input, Button, TextArea } from '@/app/(adsense)/components/components';
import api from '@/app/_lib/adsense-api';


function BusinessForm() {
  const pathname = usePathname();
  const router = useRouter();
  
  const getInitialData = () => {
    if (({})?.file || ({})?.userId) {
      return ({});
    }
    
    const savedData = localStorage.getItem('adFormData');
    if (savedData) {
      const parsed = JSON.parse(savedData);
      return { ...parsed, file: null };
    }
    
    return {};
  };

  const initialData = getInitialData();
  const { file: initialFile, userId: initialUserId } = initialData;
  
  const [file] = useState(initialFile || null);
  const [userId] = useState(initialUserId || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const [businessData, setBusinessData] = useState({
    businessName: initialData.businessName || '',
    businessLink: initialData.businessLink || '',
    businessLocation: initialData.businessLocation || '',
    adDescription: initialData.adDescription || '',
    businessCategories: initialData.businessCategories || [],
    businessCategoryOther: initialData.businessCategoryOther || ''
  });

  const [errors, setErrors] = useState({});
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  useEffect(() => {
    const dataToSave = {
      userId,
      ...businessData
      // Do NOT include file here
    };
    
    try {
      localStorage.setItem('adFormData', JSON.stringify(dataToSave));
    } catch (e) {
      localStorage.removeItem('adFormData');
    }
  }, [businessData, userId]);

//  useEffect(() => {
//     const loadFileFromStorage = () => {
//       const savedData = localStorage.getItem('adFormData');
//       if (savedData) {
//         const parsed = JSON.parse(savedData);
//         if (parsed.file && parsed.file.data && !file) {
//           fetch(parsed.file.data)
//             .then(res => res.blob())
//             .then(blob => {
//               const restoredFile = new File([blob], parsed.file.name, {
//                 type: parsed.file.type
//               });
//               setFile(restoredFile);
//             });
//         }
//       }
//     };
    
//     loadFileFromStorage();
//   }, []);
  
  useEffect(() => {
    if (!file && !({})?.file) {
      router.push('/upload-ad');
    }
  }, [file, ({}), router]);

  const businessCategories = [
    { value: 'technology', label: 'Technology', icon: 'Monitor', description: 'Software, hardware, IT services' },
    { value: 'food-beverage', label: 'Food & Beverage', icon: 'Coffee', description: 'Restaurants, cafes, food services' },
    { value: 'real-estate', label: 'Real Estate', icon: 'Home', description: 'Property sales, rentals, development' },
    { value: 'automotive', label: 'Automotive', icon: 'Car', description: 'Car sales, repairs, services' },
    { value: 'health-wellness', label: 'Health & Wellness', icon: 'Heart', description: 'Healthcare, fitness, beauty' },
    { value: 'entertainment', label: 'Entertainment', icon: 'Gamepad2', description: 'Gaming, events, recreation' },
    { value: 'fashion', label: 'Fashion', icon: 'Shirt', description: 'Clothing, accessories, style' },
    { value: 'education', label: 'Education', icon: 'GraduationCap', description: 'Schools, training, courses' },
    { value: 'business-services', label: 'Business Services', icon: 'Briefcase', description: 'Consulting, legal, finance' },
    { value: 'travel-tourism', label: 'Travel & Tourism', icon: 'Plane', description: 'Hotels, tours, travel agencies' },
    { value: 'arts-culture', label: 'Arts & Culture', icon: 'Palette', description: 'Museums, galleries, creative' },
    { value: 'photography', label: 'Photography', icon: 'Camera', description: 'Photo services, studios' },
    { value: 'gifts-events', label: 'Gifts & Events', icon: 'Gift', description: 'Party planning, gift shops' },
    { value: 'government-public', label: 'Government & Public', icon: 'Users', description: 'Public services, non-profit' },
    { value: 'general-retail', label: 'General Retail', icon: 'ShoppingBag', description: 'Stores, e-commerce, shopping' },
    { value: 'other', label: 'Others', icon: 'Tag', description: "Can't find your category? Describe it yourself" }
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setBusinessData(prev => ({
      ...prev,
      [name]: value
    }));

    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  const handleCategorySelect = (categoryValue) => {
    setBusinessData(prev => {
      const has = prev.businessCategories.includes(categoryValue);
      const businessCategoriesNext = has
        ? prev.businessCategories.filter((c: string) => c !== categoryValue)
        : [...prev.businessCategories, categoryValue];
      return { ...prev, businessCategories: businessCategoriesNext };
    });

    if (errors.businessCategories) {
      setErrors(prev => ({
        ...prev,
        businessCategories: undefined
      }));
    }
  };

  const getSelectedCategoryLabels = () => {
    return businessData.businessCategories
      .map((value: string) => businessCategories.find(cat => cat.value === value)?.label)
      .filter(Boolean)
      .join(', ');
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    const { businessCategories: selectedCategories, businessCategoryOther, ...textFields } = businessData;

    Object.entries(textFields).forEach(([key, value]: [string, any]) => {
      if (!value.trim()) {
        newErrors[key] = 'This field is required';
      }
    });

    if (!selectedCategories.length) {
      newErrors.businessCategories = 'Select at least one business category';
    } else if (selectedCategories.includes('other') && !businessCategoryOther.trim()) {
      newErrors.businessCategoryOther = 'Please describe your "Others" business category';
    }

    if (businessData.businessLink &&
        !/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(businessData.businessLink)) {
      newErrors.businessLink = 'Please enter a valid URL';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isFormValid = () => {
    const { businessCategories: selectedCategories, businessCategoryOther, ...textFields } = businessData;
    return (
      Object.values(textFields).every((value: any) => value.trim()) &&
      selectedCategories.length > 0 &&
      (!selectedCategories.includes('other') || businessCategoryOther.trim()) &&
      (!businessData.businessLink ||
       /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(businessData.businessLink))
    );
  };

  const getAuthToken = () => {
    return getToken();
  };

  const handleSaveAd = async () => {
    try {
      const formData = new FormData();
      if (file) formData.append('file', file);
      formData.append('businessName', businessData.businessName);
      formData.append('businessLink', businessData.businessLink);
      formData.append('businessLocation', businessData.businessLocation);
      formData.append('adDescription', businessData.adDescription);
      formData.append('businessCategories', JSON.stringify(businessData.businessCategories));
      formData.append('businessCategoryOther', businessData.businessCategoryOther || '');

      const token = getAuthToken();
      const response = await api.post('/api/web-advertise', formData, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if ((response.data as any).success) {
        // Clear saved data after successful save
        localStorage.removeItem('adFormData');
        
        router.push('/my-ads', {
          state: { message: 'Ad saved successfully!' }
        });
      }
    } catch (err: unknown) {
      setError('Failed to save ad');
    }
  };

  const handleNext = (e) => {
    e.preventDefault();

    if (validateForm()) {
      setLoading(true);
      try {
        if (e.target.name === 'saveOnly') {
          handleSaveAd();
        } else {
          // Pass file through state, not localStorage
          const dataToPass = {
            file,
            userId,
            ...businessData
          };
          
          router.push('/select-websites', {
            state: dataToPass
          });
        }
      } catch (err: unknown) {
        setError('An error occurred during upload');
      } finally {
        setLoading(false);
      }
    }
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
            <Badge variant="default">Business Details</Badge>
          </div>
        </Container>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="border border-border bg-surface-1 p-8">
          <form onSubmit={handleNext} className="space-y-6">
            {/* First Row - Business Name & Website */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="relative flex gap-1">
                <Input
                  label="Business Name"
                  name="businessName"
                  placeholder="Enter your business name"
                  value={businessData.businessName}
                  onChange={handleInputChange}
                  error={errors.businessName}
                  required
                  className="pl-10"
                />
                <Building2 size={16} className="absolute left-3 top-9 text-muted" />
              </div>

              <div className="relative">
                <Input
                  label="Business Website"
                  name="businessLink"
                  placeholder="https://www.yourbusiness.com"
                  value={businessData.businessLink}
                  onChange={handleInputChange}
                  error={errors.businessLink}
                  required
                  className="pl-10"
                />
                <Link size={16} className="absolute left-3 top-9 text-muted" />
              </div>
            </div>

            {/* Business Category - Custom Selector */}
            <div className="relative">
              <label className="block text-sm font-medium text-subtle mb-2">
                Business Category <span className="text-red-500">*</span>
                <span className="text-muted font-normal"> (select one or more)</span>
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(true)}
                  className={`w-full pl-10 pr-4 py-3 border border-border bg-surface-1 text-left focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition-colors ${
                    errors.businessCategories ? 'border-red-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={businessData.businessCategories.length ? 'text-white' : 'text-muted'}>
                      {getSelectedCategoryLabels() || 'Select your business category'}
                    </span>
                  </div>
                </button>
                <Tag size={16} className="absolute left-3 top-4 text-muted" />
                {errors.businessCategories && (
                  <p className="mt-1 text-sm text-error">{errors.businessCategories}</p>
                )}
              </div>
              {businessData.businessCategories.includes('other') && (
                <div className="relative mt-3">
                  <Input
                    label='Describe your "Others" category'
                    name="businessCategoryOther"
                    placeholder="e.g. Pet grooming services"
                    value={businessData.businessCategoryOther}
                    onChange={handleInputChange}
                    error={errors.businessCategoryOther}
                    required
                    className="pl-10"
                  />
                  <Tag size={16} className="absolute left-3 top-9 text-muted" />
                </div>
              )}
            </div>

            {/* Business Location */}
            <div className="relative">
              <Input
                label="Business Location"
                name="businessLocation"
                placeholder="City, State, or Country"
                value={businessData.businessLocation}
                onChange={handleInputChange}
                error={errors.businessLocation}
                required
                className="pl-10"
              />
              <MapPin size={16} className="absolute left-3 top-9 text-muted" />
            </div>

            {/* Business Description */}
            <div className="relative">
              <TextArea
                label="Business Description"
                name="adDescription"
                placeholder="Tell us about your business in a few compelling words..."
                value={businessData.adDescription}
                onChange={handleInputChange}
                error={errors.adDescription}
                required
                rows={4}
                className="pl-10"
              />
              <FileText size={16} className="absolute left-3 top-9 text-muted" />
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="secondary"
              size="lg"
              disabled={!isFormValid() || loading}
              loading={loading}
              className="w-full"
            >
              {loading ? 'Processing...' : 'Continue to Select Websites'}
            </Button>

            {/* Error Message */}
            {error && (
              <div className="border border-error bg-error/10 p-4 flex items-start">
                <FileText size={20} className="mr-2 text-error flex-shrink-0 mt-0.5" />
                <span className="text-error">{error}</span>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Category Selection Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-surface-1 border border-border max-w-4xl w-full max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="border-b border-border p-6 flex items-center justify-between">
              <div className="flex items-center">
                <h3 className="text-xl font-semibold text-white">Select Business Category</h3>
              </div>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="p-2 hover:bg-surface-3 transition-colors"
              >
                <X size={20} className="text-muted" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {businessCategories.map((category: any) => {
                  const IconComponent = category.icon;
                  const isSelected = businessData.businessCategories.includes(category.value);
                  
                  return (
                    <button
                      key={category.value}
                      onClick={() => handleCategorySelect(category.value)}
                      className={`p-4 border text-left transition-all duration-200 hover:shadow-lg group ${
                        isSelected 
                          ? 'border-border bg-black text-[#fff]' 
                          : 'border-border hover:border-border bg-surface-1'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-lg transition-colors ${
                          isSelected 
                            ? 'bg-surface-1 bg-opacity-20' 
                            : 'bg-surface-3 group-hover:bg-surface-3'
                        }`}>
                          <IconComponent
                            size={24}
                            className={isSelected ? 'text-[#fff]' : 'text-subtle'}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className={`font-medium mb-1 ${
                            isSelected ? 'text-[#fff]' : 'text-white'
                          }`}>
                            {category.label}
                          </h4>
                          <p className={`text-sm ${
                            isSelected ? 'text-[#fff] text-opacity-80' : 'text-subtle'
                          }`}>
                            {category.description}
                          </p>
                        </div>
                      </div>
                      
                      {isSelected && (
                        <div className="mt-3 flex items-center justify-end">
                          <div className="w-5 h-5 bg-surface-1 rounded-full flex items-center justify-center">
                            <div className="w-2 h-2 bg-black rounded-full"></div>
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-border p-6 flex justify-end">
              <Button onClick={() => setShowCategoryModal(false)} variant="secondary">
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BusinessForm;