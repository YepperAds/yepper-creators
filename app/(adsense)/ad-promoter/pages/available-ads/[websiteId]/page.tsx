'use client';
import { getToken } from '@/app/(adsense)/utils/token';
// @ts-nocheck

// AvailableAdsForWebOwners.js - Page for web owners to find rejected/available ads
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Search, Eye, Plus, Clock, CheckCircle, XCircle } from 'lucide-react';
import api from '@/app/_lib/adsense-api';


function AvailableAdsForWebOwners() {
  const { websiteId } = useParams();
  const [availableAds, setAvailableAds] = useState<Record<string,unknown>[]>([]);
  const [filteredAds, setFilteredAds] = useState<Record<string,unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBy, setFilterBy] = useState('all');
  const [categories, setCategories] = useState<Record<string,unknown>[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedAd, setSelectedAd] = useState<unknown>(null);

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
    fetchAvailableAds();
    fetchCategories();
  }, [websiteId]);

  useEffect(() => {
    filterAds();
  }, [searchTerm, filterBy, availableAds]);

  const fetchAvailableAds = async () => {
    try {
      setLoading(true);
      const response = await api.get(
        `/api/web-advertise/available/${websiteId}`,
        { headers: getAuthHeaders() }
      );
      
      if ((response.data as any).success) {
        setAvailableAds((response.data as any).data);
      }
    } catch (err: unknown) {
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.get(
        `/api/ad-categories/${websiteId}/advertiser`,
        { headers: getAuthHeaders() }
      );
      
      if ((response.data as any).success) {
        setCategories((response.data as any).categories);
      }
    } catch (err: unknown) {
    }
  };

  const filterAds = () => {
    let filtered = availableAds;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(ad =>
        ad.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ad.adDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ad.businessLocation.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (filterBy !== 'all') {
      filtered = filtered.filter(ad => {
        if (filterBy === 'rejected') {
          return ad.availableForReassignment === true;
        }
        if (filterBy === 'never_selected') {
          return ad.websiteSelections.length === 0;
        }
        return true;
      });
    }

    setFilteredAds(filtered);
  };

  const handleSelectAd = (ad) => {
    setSelectedAd(ad);
    setShowModal(true);
  };

  const handleConfirmSelection = async () => {
    if (!selectedAd || !selectedCategory) return;

    try {
      const response = await api.post(
        '/api/web-advertise/select-for-website',
        {
          adId: selectedAd._id,
          websiteId: websiteId,
          categoryId: selectedCategory
        },
        { headers: getAuthHeaders() }
      );

      if ((response.data as any).success) {
        setShowModal(false);
        fetchAvailableAds(); // Refresh the list
      }
    } catch (err: unknown) {
      return;
    }
  };

  const getAdStatus = (ad) => {
    if (ad.availableForReassignment) {
      return { status: 'Rejected', color: 'text-error', icon: XCircle };
    }
    if (ad.websiteSelections.length === 0) {
      return { status: 'Available', color: 'text-success', icon: CheckCircle };
    }
    return { status: 'Pending', color: 'text-yellow-600', icon: Clock };
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Available Advertisements</h1>
        <p className="text-subtle">Find ads that are available for your website</p>
      </div>

      {/* Search and Filter Section */}
      <div className="bg-surface-1 rounded-lg shadow-md p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted" />
            <input
              type="text"
              placeholder="Search ads by business name, description, or location..."
              value={searchTerm}
              onChange={(e: any) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex gap-2">
            <select
              value={filterBy}
              onChange={(e: any) => setFilterBy(e.target.value)}
              className="px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Ads</option>
              <option value="rejected">Rejected Ads</option>
              <option value="never_selected">Never Selected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Ads Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAds.map((ad: any) => {
          const statusInfo = getAdStatus(ad);
          const StatusIcon = statusInfo.icon;
          
          return (
            <div key={ad._id} className="bg-surface-1 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              {/* Ad Image */}
              <div className="h-48 bg-surface-3 relative">
                {ad.imageUrl ? (
                  <img
                    src={ad.imageUrl}
                    alt={ad.businessName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted">
                    <Eye size={48} />
                  </div>
                )}
                
                {/* Status Badge */}
                <div className={`absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium bg-surface-1 ${statusInfo.color} flex items-center gap-1`}>
                  <StatusIcon size={12} />
                  {statusInfo.status}
                </div>
              </div>

              {/* Ad Details */}
              <div className="p-4">
                <h3 className="text-lg font-semibold text-white mb-2">{ad.businessName}</h3>
                <p className="text-subtle text-sm mb-2 line-clamp-2">{ad.adDescription}</p>
                <p className="text-muted text-xs mb-3">📍 {ad.businessLocation}</p>
                
                {/* Ad Stats */}
                <div className="flex justify-between text-xs text-muted mb-4">
                  <span>Views: {ad.views}</span>
                  <span>Clicks: {ad.clicks}</span>
                  <span>Created: {new Date(ad.createdAt).toLocaleDateString()}</span>
                </div>

                {/* Action Button */}
                <button
                  onClick={() => handleSelectAd(ad)}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={16} />
                  Select for My Website
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredAds.length === 0 && (
        <div className="text-center py-12">
          <Eye size={48} className="mx-auto text-muted mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No ads available</h3>
          <p className="text-muted">There are currently no available ads for your website.</p>
        </div>
      )}

      {/* Selection Modal */}
      {showModal && selectedAd && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-surface-1 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Select Ad Category</h3>
            <p className="text-subtle mb-4">
              Choose which category you want to place "{selectedAd.businessName}" in:
            </p>
            
            <select
              value={selectedCategory}
              onChange={(e: any) => setSelectedCategory(e.target.value)}
              className="w-full p-3 border border-border rounded-lg mb-4"
            >
              <option value="">Select a category...</option>
              {categories.map((category: any) => (
                <option key={category._id} value={category._id}>
                  {category.categoryName} - ${category.price}
                </option>
              ))}
            </select>

            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-surface-2"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSelection}
                disabled={!selectedCategory}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                Confirm Selection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AvailableAdsForWebOwners;