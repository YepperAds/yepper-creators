'use client';
import { getToken } from '@/app/(adsense)/utils/token';
// @ts-nocheck

// WebsiteCreation.js - Modified version
import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, ArrowLeft, AlertTriangle } from 'lucide-react';
import { Button, Input, Alert, Container, Badge } from '@/app/(adsense)/components/components';
import api from '@/app/_lib/adsense-api';


function WebsiteCreation() {
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [formState, setFormState] = useState({
    websiteName: '',
    websiteUrl: '',
    imageUrl: null
  });

  const [uiState, setUiState] = useState({
    filePreview: null,
    error: null,
    isSubmitting: false
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormState(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateFile = (file) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type)) {
      setUiState(prev => ({
        ...prev,
        error: 'Only JPEG, PNG, and GIF images are allowed.'
      }));
      return false;
    }

    if (file.size > maxSize) {
      setUiState(prev => ({
        ...prev,
        error: 'Image must be smaller than 5MB.'
      }));
      return false;
    }

    return true;
  };

  const processFile = (file) => {
    if (!file) return;

    if (!validateFile(file)) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormState(prev => ({
        ...prev,
        imageUrl: file
      }));
      setUiState(prev => ({
        ...prev,
        filePreview: reader.result,
        error: null
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    processFile(selectedFile);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const selectedFile = e.dataTransfer.files[0];
    processFile(selectedFile);
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setUiState(prev => ({ ...prev, isSubmitting: true }));

    try {
      const formData = new FormData();
      formData.append('websiteName', formState.websiteName);
      formData.append('websiteLink', formState.websiteUrl);
      if (formState.imageUrl) {
        formData.append('file', formState.imageUrl);
      }

      const token = getToken();
      const response = await api.post(
        '/api/websites/prepareWebsite',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.status === 200) {
        // Store website data in sessionStorage to persist across page refreshes
        const websiteData = {
          tempId: (response.data as any).tempId,
          name: formState.websiteName,
          url: formState.websiteUrl,
          imageUrl: (response.data as any).imageUrl,
          ownerId: (response.data as any).ownerId
        };
        
        sessionStorage.setItem('pendingWebsite', JSON.stringify(websiteData));
        
        // Navigate to business categories
        router.push(`/business-categories/${(response.data as any).tempId}`, {
          state: {
            websiteDetails: websiteData
          }
        });
      }
      
    } catch (err: unknown) {
      setUiState(prev => ({
        ...prev,
        error: (error as any).response?.data?.message || 'Failed to prepare website'
      }));
    } finally {
      setUiState(prev => ({ ...prev, isSubmitting: false }));
    }
  };

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
            <Badge variant="default">Add Website Details</Badge>
          </div>
        </Container>
      </header>
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Form Container */}
        <div className="max-w-2xl mx-auto">
          <div className="border border-border bg-surface-1 p-8">
            
            <form onSubmit={handleSubmit} className="space-y-8">
              
              {/* Website Name Input */}
              <Input
                label="Website Name"
                name="websiteName"
                placeholder="Enter your website name"
                value={formState.websiteName}
                onChange={handleInputChange}
                required
                className="border-border focus:ring-0 focus:border-white"
              />
              
              {/* Website URL Input */}
              <Input
                label="Website URL"
                name="websiteUrl"
                placeholder="https://yourwebsite.com"
                value={formState.websiteUrl}
                onChange={handleInputChange}
                required
                className="border-border focus:ring-0 focus:border-white"
              />
              
              {/* Logo Upload Area */}
              <div>
                <label className="block text-sm font-medium text-subtle mb-2">
                  Logo Upload
                </label>
                <div 
                  className="border-2 border-dashed border-border bg-surface-1 p-8 cursor-pointer hover:bg-surface-2 transition-all duration-200 flex flex-col items-center justify-center"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={triggerFileInput}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Upload className="text-white mb-3" size={32} />
                  <p className="text-white font-medium mb-1">Click to upload logo</p>
                  <p className="text-sm text-subtle">
                    JPEG, PNG, GIF (max 5MB)
                  </p>
                </div>
              </div>
              
              {/* Error Message */}
              {uiState.error && (
                <Alert variant="error" className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{uiState.error}</span>
                </Alert>
              )}
              
              {/* Image Preview */}
              {uiState.filePreview && (
                <div className="border border-border bg-surface-1 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-white">Logo Preview</span>
                  </div>
                  <div className="flex justify-center">
                    <img 
                      src={uiState.filePreview} 
                      alt="Logo Preview" 
                      className="max-h-32 object-contain" 
                    />
                  </div>
                </div>
              )}
              
              {/* Submit Button */}
              <Button
                type="submit"
                variant="secondary"
                size="lg"
                className="w-full"
                disabled={uiState.isSubmitting}
                loading={uiState.isSubmitting}
              >
                {uiState.isSubmitting ? 'Preparing...' : 'Continue to Categories'}
              </Button>
              
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WebsiteCreation;