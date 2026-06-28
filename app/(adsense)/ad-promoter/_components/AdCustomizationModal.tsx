'use client';
import { getToken } from '@/app/(adsense)/utils/token';
// @ts-nocheck

// AdCustomizationModal.js
import React, { useState, useEffect } from 'react';
import { X, Save, Monitor, Smartphone, Tablet } from 'lucide-react';
import CSSEditor from './CSSEditor'
import api from '@/app/_lib/adsense-api';


const AdCustomizationModal = ({  categoryId, onClose, onSave  }: any) => {
  const [settings, setSettings] = useState({
    orientation: 'horizontal',
    width: 600,
    height: 300,
    maxWidth: 100,
    borderRadius: 16,
    padding: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.25)', 
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    imagePosition: 'top',
    showImage: true,
    showDescription: true,
    showCTA: true,
    titleSize: 16,
    descriptionSize: 13,
    ctaSize: 12,
    titleColor: 'rgba(0, 0, 0, 0.9)',
    descriptionColor: 'rgba(0, 0, 0, 0.6)',
    ctaBackground: 'rgba(255, 255, 255, 0.2)',
    ctaColor: 'rgba(0, 0, 0, 0.8)',
    glassmorphism: true,
    shadow: 'medium',
    hoverEffect: true
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('layout');
  const [previewDevice, setPreviewDevice] = useState('desktop');
  const [customCSS, setCustomCSS] = useState('');
  const [cssError, setCssError] = useState('');

  useEffect(() => {
    fetchCategoryCustomization();
  }, [categoryId]);

  const fetchCategoryCustomization = async () => {
    try {
      const token = getToken();
      const response = await api.get(
        `/api/ad-categories/categoriees/${categoryId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if ((response.data as any).customization) {
        setSettings(prev => ({ ...prev, ...(response.data as any).customization }));
        if ((response.data as any).customization.customCSS) {
          setCustomCSS((response.data as any).customization.customCSS);
        } else {
          setCustomCSS(getDefaultCSS());
        }
      } else {
        setCustomCSS(getDefaultCSS());
      }
      setLoading(false);
    } catch (error: unknown) {
      console.error('Error fetching customization:', error);
      setCustomCSS(getDefaultCSS());
      setLoading(false);
    }
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const getDefaultCSS = () => {
    return `.ad-container {
  width: 100%;
  max-width: ${settings.width}px;
  height: ${settings.height}px;
  padding: ${settings.padding}px;
  background: ${settings.backgroundColor};
  border: ${settings.borderWidth}px solid ${settings.borderColor};
  border-radius: ${settings.borderRadius}px;
  box-shadow: ${shadowOptions.find(s => s.value === settings.shadow)?.css || 'none'};
}

.ad-title {
  font-size: ${settings.titleSize}px;
  color: ${settings.titleColor};
  font-weight: 600;
}

.ad-description {
  font-size: ${settings.descriptionSize}px;
  color: ${settings.descriptionColor};
  line-height: 1.5;
}

.ad-cta {
  font-size: ${settings.ctaSize}px;
  background: ${settings.ctaBackground};
  color: ${settings.ctaColor};
  padding: 10px 20px;
  border-radius: 8px;
}

.ad-image {
  width: 100%;
  height: auto;
  object-fit: cover;
  border-radius: 8px;
}`;
  };

  const validateCustomCSS = (css) => {
    const forbiddenPatterns = [
      /display\s*:\s*none\s*!important/i,
      /visibility\s*:\s*hidden\s*!important/i,
      /opacity\s*:\s*0\s*!important/i,
    ];

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(css)) {
        return { 
          valid: false, 
          error: 'Cannot hide essential elements with !important. Use the toggles instead.' 
        };
      }
    }

    const braceCount = (css.match(/{/g) || []).length - (css.match(/}/g) || []).length;
    if (braceCount !== 0) {
      return { 
        valid: false, 
        error: 'Unbalanced curly braces in CSS' 
      };
    }

    return { valid: true };
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = getToken();
      
      if (customCSS.trim()) {
        const validation = validateCustomCSS(customCSS);
        if (!validation.valid) {
          setCssError(validation.error);
          setSaving(false);
          return;
        }
      }
      
      const customizationData = { ...settings, customCSS: customCSS.trim() };
      
      const response = await api.put(
        `/api/ad-categories/categoriees/${categoryId}/customization`,
        { customization: customizationData },
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Cache-Control': 'no-cache'
          } 
        }
      );
      
      if ((response.data as any).success) {
        const event = new CustomEvent('yepperAdRefresh', { 
          detail: { categoryId, timestamp: Date.now() } 
        });
        window.dispatchEvent(event);
        
        if (window.opener) {
          window.opener.postMessage({ 
            type: 'YEPPER_AD_REFRESH', 
            categoryId: categoryId,
            timestamp: Date.now()
          }, '*');
        }
        
        const broadcast = new BroadcastChannel('yepper_ads');
        broadcast.postMessage({ 
          type: 'CUSTOMIZATION_UPDATED', 
          categoryId,
          timestamp: Date.now() 
        });
        broadcast.close();
        
        if (onSave) onSave(customizationData);
        
        const successMsg = document.createElement('div');
        successMsg.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #10b981;
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          font-weight: 600;
          z-index: 10000;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        successMsg.textContent = '✓ Saved! Reload the page to see changes.';
        document.body.appendChild(successMsg);
        
        setTimeout(() => {
          successMsg.remove();
          onClose();
        }, 2000);
      }
      
    } catch (error: unknown) {
      console.error('Error saving:', error);
      alert((error as any).response?.data?.message || 'Failed to save customization');
    } finally {
      setSaving(false);
    }
  };

  const handleCSSChange = (value) => {
    setCustomCSS(value);
    setCssError('');
  };

  const orientationPresets = [
    { name: 'Horizontal Banner', value: 'horizontal', width: 600, height: 300, imagePosition: 'left' },
    { name: 'Vertical Sidebar', value: 'vertical', width: 300, height: 600, imagePosition: 'top' },
    { name: 'Square', value: 'square', width: 400, height: 400, imagePosition: 'top' },
    { name: 'Wide Banner', value: 'wide', width: 728, height: 90, imagePosition: 'left' },
    { name: 'Skyscraper', value: 'skyscraper', width: 160, height: 600, imagePosition: 'top' }
  ];

  const shadowOptions = [
    { label: 'None', value: 'none', css: 'none' },
    { label: 'Small', value: 'small', css: '0 2px 4px rgba(0,0,0,0.1)' },
    { label: 'Medium', value: 'medium', css: '0 8px 32px rgba(31, 38, 135, 0.37)' },
    { label: 'Large', value: 'large', css: '0 20px 50px rgba(0,0,0,0.3)' }
  ];

  const handlePresetSelect = (preset) => {
    setSettings(prev => ({
      ...prev,
      orientation: preset.value,
      width: preset.width,
      height: preset.height,
      imagePosition: preset.imagePosition
    }));
  };

  const generateAdPreview = () => {
    const containerWidth = previewDevice === 'mobile' ? 375 : previewDevice === 'tablet' ? 768 : 1200;
    const scale = Math.min(1, (containerWidth - 40) / settings.width);

    const adStyle = {
      width: `${settings.width}px`,
      height: `${settings.height}px`,
      maxWidth: `${settings.maxWidth}%`,
      borderRadius: `${settings.borderRadius}px`,
      padding: `${settings.padding}px`,
      backgroundColor: settings.backgroundColor,
      border: `${settings.borderWidth}px solid ${settings.borderColor}`,
      boxShadow: shadowOptions.find(s => s.value === settings.shadow)?.css || 'none',
      backdropFilter: settings.glassmorphism ? 'blur(10px)' : 'none',
      WebkitBackdropFilter: settings.glassmorphism ? 'blur(10px)' : 'none',
      transition: 'all 0.3s ease',
      transform: `scale(${scale})`,
      transformOrigin: 'top left',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative'
    };

    return (
      <>
        {customCSS && (
          <style dangerouslySetInnerHTML={{ __html: customCSS }} />
        )}
        <div style={adStyle} className="ad-container">
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            padding: '8px 16px',
            fontSize: '11px',
            fontWeight: '500',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <span style={{ opacity: 0.7 }}>Yepper Ad</span>
            <span style={{
              background: 'rgba(255, 255, 255, 0.2)',
              padding: '3px 8px',
              borderRadius: '12px',
              fontSize: '9px'
            }}>Sponsored</span>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: settings.imagePosition === 'left' ? 'row' : 'column',
            gap: '16px',
            flex: 1,
            padding: '16px'
          }}>
            {settings.showImage && (
              <div style={{
                flex: settings.imagePosition === 'left' ? '0 0 40%' : '0 0 auto',
                borderRadius: '12px',
                overflow: 'hidden',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                minHeight: settings.imagePosition === 'top' ? '150px' : 'auto'
              }} className="ad-image">
                <div style={{
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '12px'
                }}>
                  Ad Image
                </div>
              </div>
            )}

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }} className="ad-content">
              <h3 style={{
                fontSize: `${settings.titleSize}px`,
                fontWeight: '600',
                color: settings.titleColor,
                margin: '0 0 10px 0',
                lineHeight: 1.3
              }} className="ad-title">
                Your Business Name
              </h3>

              {settings.showDescription && (
                <p style={{
                  fontSize: `${settings.descriptionSize}px`,
                  color: settings.descriptionColor,
                  margin: '0 0 16px 0',
                  lineHeight: 1.5
                }} className="ad-description">
                  This is a sample ad description that shows how your ad will appear to visitors.
                </p>
              )}

              {settings.showCTA && (
                <button style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: settings.ctaBackground,
                  color: settings.ctaColor,
                  padding: '10px 18px',
                  borderRadius: '10px',
                  fontSize: `${settings.ctaSize}px`,
                  fontWeight: '500',
                  border: `1px solid ${settings.borderColor}`,
                  cursor: 'pointer',
                  alignSelf: 'flex-start'
                }} className="ad-cta">
                  Learn More →
                </button>
              )}
            </div>
          </div>
        </div>
      </>
    );
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-surface-1 p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-border mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-surface-1 w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Customize Ad Space</h2>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-surface-3 transition-colors"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Controls Panel */}
            <div className="lg:col-span-1">
              {/* Tabs */}
              <div className="flex gap-0 mb-6 border-b border-border">
                {['layout', 'style', 'content', 'code'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                      activeTab === tab 
                        ? 'text-white border-b-2 border-border' 
                        : 'text-subtle hover:text-white'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Layout Tab */}
              {activeTab === 'layout' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-white mb-3">Orientation Presets</label>
                    <div className="grid grid-cols-2 gap-2">
                      {orientationPresets.map(preset => (
                        <button
                          key={preset.value}
                          onClick={() => handlePresetSelect(preset)}
                          className={`p-3 border text-xs font-medium transition-colors ${
                            settings.orientation === preset.value
                              ? 'border-border bg-surface-2 text-white'
                              : 'border-border hover:border-muted text-subtle'
                          }`}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Width: {settings.width}px
                    </label>
                    <input
                      type="range"
                      min="160"
                      max="1200"
                      value={settings.width}
                      onChange={(e: any) => updateSetting('width', parseInt(e.target.value))}
                      className="w-full accent-black"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Height: {settings.height}px
                    </label>
                    <input
                      type="range"
                      min="90"
                      max="800"
                      value={settings.height}
                      onChange={(e: any) => updateSetting('height', parseInt(e.target.value))}
                      className="w-full accent-black"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-3">Image Position</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['top', 'left'].map(pos => (
                        <button
                          key={pos}
                          onClick={() => updateSetting('imagePosition', pos)}
                          className={`p-2 border text-sm capitalize transition-colors ${
                            settings.imagePosition === pos
                              ? 'border-border bg-surface-2 text-white'
                              : 'border-border hover:border-muted text-subtle'
                          }`}
                        >
                          {pos}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Style Tab */}
              {activeTab === 'style' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Border Radius: {settings.borderRadius}px
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="40"
                      value={settings.borderRadius}
                      onChange={(e: any) => updateSetting('borderRadius', parseInt(e.target.value))}
                      className="w-full accent-black"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Padding: {settings.padding}px
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="40"
                      value={settings.padding}
                      onChange={(e: any) => updateSetting('padding', parseInt(e.target.value))}
                      className="w-full accent-black"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Shadow</label>
                    <select
                      value={settings.shadow}
                      onChange={(e: any) => updateSetting('shadow', e.target.value)}
                      className="w-full px-3 py-2 border border-border bg-surface-1 text-sm focus:outline-none focus:ring-1 focus:ring-white focus:border-white"
                    >
                      {shadowOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <label className="text-sm font-medium text-white">Glassmorphism</label>
                    <button
                      onClick={() => updateSetting('glassmorphism', !settings.glassmorphism)}
                      className={`relative w-12 h-6 transition-colors ${
                        settings.glassmorphism ? 'bg-black' : 'bg-gray-300'
                      }`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-surface-1 transition-transform ${
                        settings.glassmorphism ? 'translate-x-7' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>
              )}

              {/* Content Tab */}
              {activeTab === 'content' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between py-2">
                    <label className="text-sm font-medium text-white">Show Image</label>
                    <button
                      onClick={() => updateSetting('showImage', !settings.showImage)}
                      className={`relative w-12 h-6 transition-colors ${
                        settings.showImage ? 'bg-black' : 'bg-gray-300'
                      }`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-surface-1 transition-transform ${
                        settings.showImage ? 'translate-x-7' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <label className="text-sm font-medium text-white">Show Description</label>
                    <button
                      onClick={() => updateSetting('showDescription', !settings.showDescription)}
                      className={`relative w-12 h-6 transition-colors ${
                        settings.showDescription ? 'bg-black' : 'bg-gray-300'
                      }`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-surface-1 transition-transform ${
                        settings.showDescription ? 'translate-x-7' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Title Size: {settings.titleSize}px
                    </label>
                    <input
                      type="range"
                      min="12"
                      max="32"
                      value={settings.titleSize}
                      onChange={(e: any) => updateSetting('titleSize', parseInt(e.target.value))}
                      className="w-full accent-black"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Description Size: {settings.descriptionSize}px
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="20"
                      value={settings.descriptionSize}
                      onChange={(e: any) => updateSetting('descriptionSize', parseInt(e.target.value))}
                      className="w-full accent-black"
                    />
                  </div>
                </div>
              )}

              {/* Code Tab */}
              {activeTab === 'code' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-white">Custom CSS Editor</label>
                  </div>
                  
                  {cssError && (
                    <div className="p-3 bg-error/10 border border-error/30 text-error text-sm rounded">
                      {cssError}
                    </div>
                  )}
                  
                  <CSSEditor 
                    value={customCSS} 
                    onChange={handleCSSChange}
                  />
                </div>
              )}
            </div>

            {/* Preview Panel */}
            <div className="lg:col-span-2">
              {/* Device Selector */}
              <div className="mb-4 flex gap-2">
                {[
                  { name: 'desktop', icon: Monitor },
                  { name: 'tablet', icon: Tablet },
                  { name: 'mobile', icon: Smartphone }
                ].map(device => (
                  <button
                    key={device.name}
                    onClick={() => setPreviewDevice(device.name)}
                    className={`p-2 transition-colors ${
                      previewDevice === device.name 
                        ? 'bg-surface-3 text-white' 
                        : 'text-subtle hover:bg-surface-2'
                    }`}
                    aria-label={`Preview on ${device.name}`}
                  >
                    <device.icon size={20} />
                  </button>
                ))}
              </div>

              {/* Preview Area */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-border p-8 overflow-auto min-h-[400px]">
                {generateAdPreview()}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex gap-3 justify-end">
          <button 
            onClick={onClose} 
            className="px-6 py-2 text-sm font-medium border border-border text-subtle hover:bg-surface-2 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 text-sm font-medium bg-black text-[#fff] hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Save size={16} />
                Save Customization
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdCustomizationModal;