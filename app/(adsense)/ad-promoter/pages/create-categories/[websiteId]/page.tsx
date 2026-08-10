'use client';
import { getToken } from '@/app/(adsense)/utils/token';
// @ts-nocheck

// categoryCreation.js
import React, { useState, useMemo, useEffect } from 'react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import { 
    Info,
    Check,
    X,
    ArrowLeft,
    Monitor,
    Sidebar as SidebarIcon,
    Layers,
    PanelLeft,
    AlignJustify,
    PanelBottom,
    PieChart,
    Maximize,
    Search,
    Play,
    Film,
    Pause
} from 'lucide-react';
import { Button, Grid, Input, TextArea, Badge, Container } from '@/app/(adsense)/components/components';
import PricingTiers from '../../../_components/PricingTiers';
import CategoryInfoModal from '../../../_components/CategoryInfoModal';

import api from '@/app/_lib/adsense-api';
import { getAdSpaceImage } from '@/app/_lib/ad-spaces';


function CategoryModal({ activeCategory, details, categoryData, updateCategoryData, monthlyTraffic, grantedTier, onClose, onSave }) {
  const [showFullImage, setShowFullImage] = useState(false);
  if (!details) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-surface-1 border border-border max-w-7xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-black text-[#fff]">{details.icon}</div>
            <div>
              <h2 className="text-xl font-semibold text-white">{details.name}</h2>
              <p className="text-sm text-subtle">{details.category} • {details.position}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-3 border border-border">
            <X size={16} />
          </button>
        </div>
        <div className="p-6">
          {showFullImage ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white">Preview Image</h3>
                <Button variant="outline" onClick={() => setShowFullImage(false)} size="sm">
                  Back to Details
                </Button>
              </div>
              <div className="flex justify-center">
                <img src={details.image} alt={`${details.name} full preview`} className="max-w-full max-h-[70vh] border border-border object-contain" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <PricingTiers
                  selectedPrice={categoryData[activeCategory] || {}}
                  onPriceSelect={(price) => updateCategoryData(activeCategory, 'price', price)}
                  monthlyTraffic={monthlyTraffic}
                  spaceType={details.spaceType}
                  grantedTier={grantedTier}
                />
                <div className="space-y-6">
                  <div className="w-full">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-medium text-subtle">Number of ads for this space</span>
                    </div>
                    <Input
                      type="number"
                      placeholder="Number of ads"
                      value={categoryData[activeCategory]?.userCount || ''}
                      onChange={(e) => updateCategoryData(activeCategory, 'userCount', e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <div className="w-full">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-medium text-subtle">Additional Requirements</span>
                    </div>
                    <TextArea
                      placeholder="Enter any additional requirements or notes"
                      value={categoryData[activeCategory]?.instructions || ''}
                      onChange={(e) => updateCategoryData(activeCategory, 'instructions', e.target.value)}
                      rows={4}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Description & Preview</h3>
                  <div className="space-y-4">
                    <div className="cursor-pointer group" onClick={() => setShowFullImage(true)}>
                      <img src={details.image} alt={`${details.name} preview`} className="w-full border border-border group-hover:opacity-80 transition-opacity" />
                      <p className="text-xs text-muted mt-1 text-center">Click to view full size</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-white mb-2">About this category</h4>
                      <p className="text-subtle mb-4">{details.description}</p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">Position: {details.position}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">Category: {details.category}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {!showFullImage && (
            <div className="flex justify-end pt-6 mt-8 border-t border-border">
              <Button variant="secondary" onClick={onSave} disabled={!categoryData[activeCategory]?.price} size="lg">
                Save & Continue
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const CategoryCreation = () => {
  const [, setUser] = useState<Record<string,unknown> | null>(null); // NEW: Custom user state
  const [, setLoading] = useState<boolean>(true); // NEW: Loading state for auth check
  const { websiteId } = useParams();
  // state is not available via usePathname in Next.js, use searchParams instead
  const router = useRouter();
  const [websiteDetails] = useState<Record<string,unknown> | null>(null);
  const [websiteMonthlyTraffic, setWebsiteMonthlyTraffic] = useState<number | null>(null);
  // Grant display: if admin granted traffic, use that tier for pricing
  const [grantDisplay, setGrantDisplay] = useState(null);
  const [selectedCategories, setSelectedCategories] = useState({});
  const [categoryData, setCategoryData] = useState({});
  const [activeCategory, setActiveCategory] = useState(null);
  const [completedCategories, setCompletedCategories] = useState([]);
  const [activeInfoModal, setActiveInfoModal] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = getToken(); // Get token from localStorage

        // Verify token and get user data
        const response = await api.get('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        setUser((response.data as any).user); // Set user data from your API
        setLoading(false);
      } catch {
      }
    };

    checkAuth();
  }, [router]);

  useEffect(() => {
    if (!websiteId) {
        router.push('/create-website');
        return;
    }

    const fetchWebsiteDetails = async () => {
        try {
            const token = getToken();
            // Fetch analytics first, includes grantDisplay if a grant is active
            try {
              const analyticsRes = await api.get(`/api/analytics/${websiteId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (analyticsRes.data?.grantDisplay) {
                setGrantDisplay(analyticsRes.data.grantDisplay);
                setWebsiteMonthlyTraffic(analyticsRes.data.grantDisplay.grantedTraffic);
                return; // pricing resolved from grant, no need to fetch raw traffic
              }
            } catch (_) { /* analytics fetch failed, fall through to website fetch */ }

            if (!websiteDetails) {
              const response = await api.get(`/api/websites/website/${websiteId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if ((response.data as any)?.monthlyTraffic) {
                setWebsiteMonthlyTraffic((response.data as any).monthlyTraffic);
              }
            }
        } catch {
            router.push('/create-website');
        }
    };
    fetchWebsiteDetails();
  }, [websiteId, websiteDetails, router]);

  const isCategoryDataEmpty = (category) => {
      const data = categoryData[category];
      return !data || 
             (!data.price && !data.userCount && !data.instructions);
  };

  useEffect(() => {
      completedCategories.forEach(category => {
          if (isCategoryDataEmpty(category)) {
              setCompletedCategories(prev => 
                  prev.filter(cat => cat !== category)
              );
          }
      });
  }, [categoryData, completedCategories]);

  const categoryDetails = useMemo(() => ({
      aboveTheFold: {
          name: 'Above the Fold',
          icon: <Layers className="w-6 h-6" />,
          infoIcon: <Info className="w-5 h-5 text-blue-500 hover:text-blue cursor-pointer" />,
          spaceType: "Above The Fold",
          description: "Prime visibility area at the top of webpage before scrolling",
          visualization: "/api/placeholder/300/120",
          category: "primary",
          position: "top",
          image: getAdSpaceImage('Above The Fold')
      },
      beneathTitle: {
          name: 'Beneath Title',
          icon: <AlignJustify className="w-6 h-6" />,
          infoIcon: <Info className="w-5 h-5 text-blue-500 hover:text-blue cursor-pointer" />,
          spaceType: "Beneath Title",
          description: "Ad space directly below the page title",
          visualization: "/api/placeholder/300/120",
          category: "content",
          position: "top",
          image: getAdSpaceImage('Beneath Title')

      },
      floating: {
          name: 'Floating',
          icon: <Maximize className="w-6 h-6" />,
          infoIcon: <Info className="w-5 h-5 text-blue-500 hover:text-blue cursor-pointer" />,
          spaceType: "Floating",
          description: "Ads that float over page content, follows user scrolling",
          visualization: "/api/placeholder/300/120",
          category: "special",
          position: "overlay",
          image: getAdSpaceImage('Floating')
      },
      HeaderPic: {
          name: 'Header',
          icon: <Monitor className="w-6 h-6" />,
          infoIcon: <Info className="w-5 h-5 text-blue-500 hover:text-blue cursor-pointer" />,
          spaceType: "Header",
          description: "Banner ad space in the header section of the website",
          visualization: "/api/placeholder/300/120",
          category: "primary",
          position: "top",
          image: getAdSpaceImage('Header')
      },
      inlineContent: {
          name: 'Inline Content',
          icon: <AlignJustify className="w-6 h-6" />,
          infoIcon: <Info className="w-5 h-5 text-blue-500 hover:text-blue cursor-pointer" />,
          spaceType: "Inline Content",
          description: "Ad placement directly within article text",
          visualization: "/api/placeholder/300/120",
          category: "content",
          position: "middle",
          image: getAdSpaceImage('Inline Content')
      },
      leftRail: {
          name: 'Left Rail',
          icon: <PanelLeft className="w-6 h-6" />,
          infoIcon: <Info className="w-5 h-5 text-blue-500 hover:text-blue cursor-pointer" />,
          spaceType: "Left Rail",
          description: "Ad space along the left side of the webpage",
          visualization: "/api/placeholder/300/120",
          category: "sidebar",
          position: "left",
          image: getAdSpaceImage('Left Rail')
      },
      modalPic: {
          name: 'Modal',
          icon: <Info className="w-6 h-6" />,
          infoIcon: <Info className="w-5 h-5 text-blue-500 hover:text-blue cursor-pointer" />,
          spaceType: "modalPic",
          description: "Pop-up ad that appears in a modal window",
          visualization: "/api/placeholder/300/120",
          category: "special",
          position: "overlay",
          image: getAdSpaceImage('Modal')
      },
      proFooter: {
          name: 'Pro Footer',
          icon: <PanelBottom className="w-6 h-6" />,
          infoIcon: <Info className="w-5 h-5 text-blue-500 hover:text-blue cursor-pointer" />,
          spaceType: "proFooter",
          description: "Premium ad space in the footer section",
          visualization: "/api/placeholder/300/120",
          category: "secondary",
          position: "bottom",
          image: getAdSpaceImage('Pro Footer')
      },
      sidebar: {
          name: 'Sidebar',
          icon: <SidebarIcon className="w-6 h-6" />,
          infoIcon: <Info className="w-5 h-5 text-blue-500 hover:text-blue cursor-pointer" />,
          spaceType: "sidebar",
          description: "Ad placement in the website sidebar",
          visualization: "/api/placeholder/300/120",
          category: "sidebar",
          position: "side",
          image: getAdSpaceImage('Sidebar')
      },
      stickySidebar: {
          name: 'Sticky Sidebar',
          icon: <PieChart className="w-6 h-6" />,
          infoIcon: <Info className="w-5 h-5 text-blue-500 hover:text-blue cursor-pointer" />,
          spaceType: "stickySidebar",
          description: "Sidebar ad that stays visible as user scrolls",
          visualization: "/api/placeholder/300/120",
          category: "sidebar",
          position: "side",
          image: getAdSpaceImage('Sticky Sidebar')
      },
      preroll: {
          name: 'Pre-roll',
          icon: <Play className="w-6 h-6" />,
          infoIcon: <Info className="w-5 h-5 text-blue-500 hover:text-blue cursor-pointer" />,
          spaceType: "Pre-roll",
          description: "Video ad that plays before the content starts",
          visualization: "/api/placeholder/300/120",
          category: "video",
          position: "video",
          image: getAdSpaceImage('Pre-roll')
      },
      midroll: {
          name: 'Mid-roll',
          icon: <Film className="w-6 h-6" />,
          infoIcon: <Info className="w-5 h-5 text-blue-500 hover:text-blue cursor-pointer" />,
          spaceType: "Mid-roll",
          description: "Video ad that plays inside the content (content → ad → content)",
          visualization: "/api/placeholder/300/120",
          category: "video",
          position: "video",
          image: getAdSpaceImage('Mid-roll')
      },
      pause: {
          name: 'Pause',
          icon: <Pause className="w-6 h-6" />,
          infoIcon: <Info className="w-5 h-5 text-blue-500 hover:text-blue cursor-pointer" />,
          spaceType: "Pause",
          description: "Ad that appears when the viewer pauses the video",
          visualization: "/api/placeholder/300/120",
          category: "video",
          position: "video",
          image: getAdSpaceImage('Pause')
      },
  }), []);

  const filteredCategories = useMemo(() => {
      return Object.entries(categoryDetails).filter(([key, value]) => {
          const matchesSearch = value.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  value.description.toLowerCase().includes(searchTerm.toLowerCase());
          const matchesFilter = activeFilter === 'all' || value.category === activeFilter;
          return matchesSearch && matchesFilter;
      });
  }, [categoryDetails, searchTerm, activeFilter]);

  const handleCategorySelect = (category) => {
      setActiveCategory(category);
      if (!selectedCategories[category]) {
          setSelectedCategories(prev => ({
              ...prev,
              [category]: true
          }));
      }
  };

  const handleCloseModal = () => {
      setActiveCategory(null);
  };

  const updateCategoryData = (category, field, value) => {
      if (field === 'price') {
          // value will now be an object containing price, tier, and visitorRange
          setCategoryData(prev => ({
              ...prev,
              [category]: {
                  ...prev[category],
                  price: value.price,
                  tier: value.tier,
                  visitorRange: value.visitorRange
              }
          }));
          } else {
              // Handle other fields normally
              setCategoryData(prev => ({
                  ...prev,
                  [category]: {
                      ...prev[category],
                      [field]: value
                  }
          }));
      }
  };

  const handleNext = () => {
      if (activeCategory && !isCategoryDataEmpty(activeCategory)) {
          setCompletedCategories(prev => 
              prev.includes(activeCategory) 
                  ? prev 
                  : [...prev, activeCategory]
          );
      }
      setActiveCategory(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');

    const categoriesToSubmit = Object.entries(selectedCategories)
      .filter(([category]) => completedCategories.includes(category))
      .map(([category]) => {
        const data = categoryData[category] || {};
        const details = categoryDetails[category] || {};
        return {
          websiteId,
          categoryName: category.charAt(0).toUpperCase() + category.slice(1),
          description: details.description || '',
          price: Number(data.price) || 0,
          spaceType: details.spaceType || 'banner',
          userCount: Number(data.userCount) || 0,
          instructions: data.instructions || '',
          customAttributes: data.customAttributes || {},
          visitorRange: {
            min: Number(data.visitorRange?.min) || 0,
            max: Number(data.visitorRange?.max) || 10000,
          },
          tier: data.tier || 'bronze',
        };
      });

    if (categoriesToSubmit.length === 0) {
      setSubmitError('Please configure at least one ad space before creating.');
      return;
    }

    setSubmitting(true);
    try {
      await Promise.all(
        categoriesToSubmit.map((category) =>
          api.post('/api/ad-categories', category)
        )
      );
      router.push(`/ad-promoter/pages/website/${websiteId}`);
    } catch (err: unknown) {
      const status = (err as any).response?.status;
      if (status === 401) {
        router.push('/login');
      } else {
        setSubmitError(
          (err as any).response?.data?.message ||
          (err as any).response?.data?.error ||
          (err as any).message ||
          'Failed to create ad spaces. Please try again.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const categoryFilters = [
    { id: 'all', name: 'All Spaces' },
    { id: 'primary', name: 'Primary' },
    { id: 'secondary', name: 'Secondary' },
    { id: 'sidebar', name: 'Sidebar' },
    { id: 'content', name: 'Content' },
    { id: 'special', name: 'Special' },
    { id: 'video', name: 'Video' },
  ];

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
            <Badge variant="default">Choose Ad Spaces</Badge>
          </div>
        </Container>
      </header>
      <div className="max-w-6xl mx-auto px-4 py-12">
        
        {/* Header */}
        <div className="mb-12">
          <p className="text-subtle">Choose and configure advertising spaces for your website</p>
        </div>

        {/* Search and Filters */}
        <div className="flex justify-between items-center gap-4 mb-8">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" />
              <input 
                type="text"
                placeholder="Search ad spaces..."
                value={searchTerm}
                onChange={(e: any) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-border bg-surface-1 text-white placeholder-muted focus:outline-none focus:ring-0"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            {categoryFilters.map(filter => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={`px-4 py-2 text-sm border border-border transition-colors ${
                  activeFilter === filter.id
                    ? 'bg-black text-[#fff]'
                    : 'bg-surface-1 text-white hover:bg-surface-3'
                }`}
              >
                {filter.name}
              </button>
            ))}
          </div>
        </div>

        {/* Categories Grid */}
        <form onSubmit={handleSubmit}>
          {filteredCategories.length > 0 ? (
            <Grid cols={3} gap={6} className="mb-8">
              {filteredCategories.map(([category, details]) => (
                <div
                  key={category}
                  className={`border p-6 cursor-pointer transition-all duration-200 hover:bg-surface-2 ${
                    completedCategories.includes(category)
                      ? 'border-border bg-surface-2'
                      : 'border-border'
                  }`}
                  onClick={() => handleCategorySelect(category)}
                >
                  {/* Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 ${
                        completedCategories.includes(category) 
                          ? 'bg-black text-[#fff]' 
                          : 'bg-surface-1 border-border'
                      } text-white`}>
                        {completedCategories.includes(category) ? (
                          <Check size={20} />
                        ) : (
                          details.icon
                        )}
                      </div>
                      <div>
                        {/* <div className="text-xs font-medium text-muted uppercase">
                          {details.category}
                        </div> */}
                        <h3 className="text-lg font-semibold text-white">{details.name}</h3>
                      </div>
                    </div>
                  </div>

                  {/* Preview Image */}
                  <div className="mb-4">
                    <img 
                      src={details.image} 
                      alt={`${details.name} preview`}
                      className="w-full h-32 object-cover border border-border"
                    />
                  </div>

                  {/* Description */}
                  <p className="text-subtle text-sm mb-4">
                    {details.description}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <span className="text-xs text-muted uppercase">
                      {details.position}
                    </span>
                    {completedCategories.includes(category) && categoryData[category]?.price && (
                      <span className="text-sm font-bold text-white">
                        RWF {categoryData[category].price}/mo
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </Grid>
          ) : (
            <div className="flex items-center justify-center min-h-96">
              <div className="text-center">
                <Search size={64} className="mx-auto mb-6 text-muted" />
                <h2 className="text-2xl font-semibold mb-4 text-white">
                  No ad spaces found
                </h2>
                <p className="text-subtle">Try adjusting your search or filter criteria</p>
              </div>
            </div>
          )}

          {/* Submit */}
          {completedCategories.length > 0 && (
            <div className="flex flex-col items-center gap-4 mt-8">
              {submitError && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-4 py-3 w-full text-center">
                  {submitError}
                </p>
              )}
              <Button
                type="submit"
                variant="secondary"
                size="lg"
                disabled={submitting}
              >
                {submitting
                  ? 'Creating…'
                  : `Create ${completedCategories.length} Ad Space${completedCategories.length > 1 ? 's' : ''}`}
              </Button>
            </div>
          )}
        </form>
      </div>

      {/* Modals */}
      {activeCategory && (
        <CategoryModal
          key={activeCategory}
          activeCategory={activeCategory}
          details={categoryDetails[activeCategory]}
          categoryData={categoryData}
          updateCategoryData={updateCategoryData}
          monthlyTraffic={websiteMonthlyTraffic}
          grantedTier={grantDisplay?.trafficTier || null}
          onClose={handleCloseModal}
          onSave={handleNext}
        />
      )}
      {activeInfoModal && (
        <CategoryInfoModal 
          isOpen={!!activeInfoModal}
          onClose={() => setActiveInfoModal(null)}
          category={activeInfoModal}
        />
      )}
    </div>
  );
};

export default CategoryCreation;