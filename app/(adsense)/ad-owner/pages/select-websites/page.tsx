'use client';
// @ts-nocheck

// WebsiteSelection.js
import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Globe, Check, Search, ArrowLeft } from 'lucide-react';
import { Button, Grid, Badge, Container } from '@/app/(adsense)/components/components';
import LoadingSpinner from '@/app/(adsense)/components/LoadingSpinner';

function WebsiteSelection() {
  const pathname = usePathname();
  const router = useRouter();
  
  // Get data from ({}) or localStorage
  const getInitialData = () => {
    if (({}) && Object.keys(({})).length > 0) {
      return ({});
    }
    
    const savedData = localStorage.getItem('adFormData');
    if (savedData) {
      return JSON.parse(savedData);
    }
    
    return {};
  };

  const initialData = getInitialData();
  const {
    file,
    userId,
    businessName,
    businessLink,
    businessLocation,
    adDescription,
    businessCategories: selectedBusinessCategories = [],
    businessCategoryOther
  } = initialData;

  const [websites, setWebsites] = useState<Record<string,unknown>[]>([]);
  const [filteredWebsites, setFilteredWebsites] = useState<Record<string,unknown>[]>([]);
  const [selectedWebsites, setSelectedWebsites] = useState(
    initialData.selectedWebsites || []
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [fileObject, setFileObject] = useState<unknown>(null);

  useEffect(() => {
    const loadFileFromStorage = async () => {
      if (file && file.data && !fileObject) {
        try {
          const response = await fetch(file.data);
          const blob = await response.blob();
          const restoredFile = new File([blob], file.name, {
            type: file.type
          });
          setFileObject(restoredFile);
        } catch (err: unknown) {
        }
      } else if (file instanceof File) {
        setFileObject(file);
      }
    };
    
    loadFileFromStorage();
  }, [file]);

  useEffect(() => {
    if (businessName) {
      const dataToSave = {
        ...initialData,
        selectedWebsites
      };
      localStorage.setItem('adFormData', JSON.stringify(dataToSave));
    }
  }, [selectedWebsites, businessName]);

  useEffect(() => {
    if (!businessName) {
      router.push('/insert-data');
    }
  }, [businessName, router]);

  useEffect(() => {
    const fetchWebsites = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/createWebsite');
        const data = await response.json();
        
        const relevantWebsites = data.filter(website => {
          const categories = website.businessCategories;
          if (!categories || !Array.isArray(categories)) {
            return false;
          }

          if (categories.includes('any')) {
            return true;
          }

          if (selectedBusinessCategories.length && selectedBusinessCategories.some((cat: string) => categories.includes(cat))) {
            return true;
          }

          return false;
        });

        setWebsites(relevantWebsites);
        setFilteredWebsites(relevantWebsites);
        setLoading(false);
      } catch (err: unknown) {
        setError('Failed to fetch websites. Please try again.');
        setLoading(false);
      }
    };

    fetchWebsites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBusinessCategories.join(',')]);

  useEffect(() => {
    let result = websites;
    
    if (searchTerm) {
      result = result.filter(site => 
        site.websiteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        site.websiteLink.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredWebsites(result);
  }, [searchTerm, websites]);

  const handleSelect = (websiteId) => {
    setSelectedWebsites(prev => 
      prev.includes(websiteId) 
        ? prev.filter(id => id !== websiteId)
        : [...prev, websiteId]
    );
  };

  const handleNext = () => {
    if (selectedWebsites.length === 0) return;

    const dataToPass = {
      file: fileObject || file, // Use actual File object
      userId,
      businessName,
      businessLink,
      businessLocation,
      adDescription,
      businessCategories: selectedBusinessCategories,
      businessCategoryOther,
      selectedWebsites,
    };

    router.push('/select-categories', {
      state: dataToPass
    });
  };

  const formatCategoryForDisplay = (categories) => {
    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return 'No Categories';
    }

    if (categories.includes('any')) {
      return 'All Categories';
    }
    
    const categoryLabels = {
      'technology': 'Technology',
      'food-beverage': 'Food & Beverage',
      'real-estate': 'Real Estate',
      'automotive': 'Automotive',
      'health-wellness': 'Health & Wellness',
      'entertainment': 'Entertainment',
      'fashion': 'Fashion',
      'education': 'Education',
      'business-services': 'Business Services',
      'travel-tourism': 'Travel & Tourism',
      'arts-culture': 'Arts & Culture',
      'photography': 'Photography',
      'gifts-events': 'Gifts & Events',
      'government-public': 'Government & Public',
      'general-retail': 'General Retail',
      'other': 'Others'
    };
    
    return categories.map(cat => categoryLabels[cat] || cat).join(', ');
  };

  if (loading) return (
    <LoadingSpinner />
  );

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
            <Badge variant="default">Choose Websites to Advertise on</Badge>
          </div>
        </Container>
      </header>
      
      <div className="max-w-6xl mx-auto px-4 py-12">
        {error && (
          <div className="mb-8 border border-red-300 bg-error/10 p-4 text-error text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-between items-center gap-4 mb-8">
          <div className="relative flex-1 max-w-md">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" />
            <input 
              type="text"
              placeholder="Search websites..."
              value={searchTerm}
              onChange={(e: any) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-border bg-surface-1 text-white placeholder-muted focus:outline-none focus:ring-0 transition-all duration-200"
            />
          </div>
        </div>

        {filteredWebsites.length === 0 ? (
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-4 text-white">No websites available</h2>
              <p className="text-subtle">Please check back later</p>
            </div>
          </div>
        ) : (
          <Grid cols={3} gap={6}>
            {filteredWebsites.map((website: any) => (
              <div 
                key={website._id} 
                onClick={() => handleSelect(website._id)}
                className={`border p-6 cursor-pointer transition-all duration-200 hover:bg-surface-2 ${
                  selectedWebsites.includes(website._id) 
                    ? 'border-border bg-surface-2' 
                    : 'border-border'
                }`}
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center">
                    {website.imageUrl ? (
                      <img 
                        src={website.imageUrl} 
                        alt={website.websiteName}
                        className="w-10 h-10 object-contain mr-3"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = '/global.png';
                        }}
                      />
                    ) : (
                      <Globe size={40} className="mr-3 text-white" />
                    )}
                    <div>
                      <h3 className="text-lg font-semibold text-white">{website.websiteName}</h3>
                      <p className="text-sm text-subtle break-all">{website.websiteLink}</p>
                    </div>
                  </div>
                  
                  <div className={`w-6 h-6 border flex items-center justify-center ${
                    selectedWebsites.includes(website._id) 
                      ? 'border-border bg-black text-white' 
                      : 'border-border'
                  }`}>
                    {selectedWebsites.includes(website._id) && <Check size={14} />}
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <Badge variant="default" className="text-xs px-2 py-1 bg-black text-white">
                    {formatCategoryForDisplay(website.businessCategories)}
                  </Badge>
                  
                  {website.businessCategories &&
                   Array.isArray(website.businessCategories) &&
                   selectedBusinessCategories.some((cat: string) => website.businessCategories.includes(cat)) &&
                   !website.businessCategories.includes('any') && (
                    <Badge variant="primary" className="text-xs">
                      Perfect Match
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </Grid>
        )}

        <div className="flex justify-end items-center mt-12 gap-4">
          <Button
            onClick={handleNext} 
            disabled={selectedWebsites.length === 0}
            variant={selectedWebsites.length === 0 ? "outline" : "secondary"}
            size="lg"
          >
            {loading ? 'Processing...' : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default WebsiteSelection;