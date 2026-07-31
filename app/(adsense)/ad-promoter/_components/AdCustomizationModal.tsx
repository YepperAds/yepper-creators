'use client';
import { getToken } from '@/app/(adsense)/utils/token';
// @ts-nocheck

// AdCustomizationModal.js
import React, { useState, useEffect } from 'react';
import { X, Save, Monitor, Smartphone, Tablet, RotateCcw } from 'lucide-react';
import CSSEditor from './CSSEditor'
import api from '@/app/_lib/adsense-api';

// Plain white + shadow, no dark-mode auto-adaptation, every ad slot starts
// here unless its own template/colors have been set. Mirrors SYSTEM_DEFAULT
// in backend/AdPromoter/utils/adCustomization.js; keep both in sync.
const SYSTEM_DEFAULT = {
  orientation: 'horizontal',
  width: 600,
  height: 300,
  maxWidth: 100,
  borderRadius: 16,
  padding: 18,
  backgroundColor: '#ffffff',
  borderColor: 'rgba(0, 0, 0, 0.08)',
  borderWidth: 1,
  imagePosition: 'top',
  // Capped by default so an advertiser's uploaded image, whatever its real
  // resolution/aspect ratio, can never blow the card out of proportion.
  // imageHeight applies when imagePosition is 'top', imageWidthPercent when
  // it's 'left'. Must match SYSTEM_DEFAULT in backend/AdPromoter/utils/adCustomization.js.
  imageHeight: 160,
  imageWidthPercent: 40,
  // Width of the image box when imagePosition is 'top', as a percent of the
  // card's width (centered). Defaults to 100 (full-bleed) so slots saved
  // before this setting existed keep rendering exactly as they did.
  topImageWidthPercent: 100,
  showImage: true,
  showDescription: true,
  showCTA: true,
  titleSize: 16,
  descriptionSize: 13,
  ctaSize: 12,
  titleColor: 'rgba(0, 0, 0, 0.88)',
  descriptionColor: 'rgba(0, 0, 0, 0.6)',
  ctaBackground: '#000000',
  ctaColor: '#ffffff',
  glassmorphism: false,
  shadow: 'medium',
  fontFamily: 'system',
  template: undefined,
};

// Curated background+text bundles, must match TEMPLATES in
// backend/AdPromoter/utils/adCustomization.js (the server is authoritative;
// this is just for the swatch picker + live preview).
const TEMPLATES = [
  { key: 'clean', label: 'Clean White', swatch: '#ffffff', backgroundColor: '#ffffff', titleColor: 'rgba(0,0,0,0.88)', descriptionColor: 'rgba(0,0,0,0.6)', ctaBackground: '#000000', ctaColor: '#ffffff', borderColor: 'rgba(0,0,0,0.08)', shadow: 'medium' },
  { key: 'sunset', label: 'Sunset', swatch: 'linear-gradient(135deg,#ff7e5f,#feb47b)', backgroundColor: 'linear-gradient(135deg,#ff7e5f,#feb47b)', titleColor: '#ffffff', descriptionColor: 'rgba(255,255,255,0.92)', ctaBackground: '#ffffff', ctaColor: '#d9480f', borderColor: 'rgba(255,255,255,0.3)', shadow: 'large' },
  { key: 'ocean', label: 'Ocean Breeze', swatch: 'linear-gradient(135deg,#2193b0,#6dd5ed)', backgroundColor: 'linear-gradient(135deg,#2193b0,#6dd5ed)', titleColor: '#ffffff', descriptionColor: 'rgba(255,255,255,0.92)', ctaBackground: '#ffffff', ctaColor: '#0b6e8f', borderColor: 'rgba(255,255,255,0.3)', shadow: 'large' },
  { key: 'forest', label: 'Forest', swatch: 'linear-gradient(135deg,#134e5e,#71b280)', backgroundColor: 'linear-gradient(135deg,#134e5e,#71b280)', titleColor: '#ffffff', descriptionColor: 'rgba(255,255,255,0.9)', ctaBackground: '#ffffff', ctaColor: '#134e5e', borderColor: 'rgba(255,255,255,0.25)', shadow: 'large' },
  { key: 'royal', label: 'Royal', swatch: 'linear-gradient(135deg,#41295a,#2F0743)', backgroundColor: 'linear-gradient(135deg,#41295a,#2F0743)', titleColor: '#f5d98d', descriptionColor: 'rgba(255,255,255,0.85)', ctaBackground: '#f5d98d', ctaColor: '#2F0743', borderColor: 'rgba(245,217,141,0.4)', shadow: 'large' },
  { key: 'futuristic', label: 'Futuristic', swatch: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)', backgroundColor: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)', titleColor: '#00f5ff', descriptionColor: 'rgba(255,255,255,0.85)', ctaBackground: 'linear-gradient(135deg,#00f5ff,#7b2ff7)', ctaColor: '#0f0c29', borderColor: 'rgba(0,245,255,0.4)', shadow: 'large' },
  { key: 'africanPattern', label: 'African Pattern', swatch: 'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.18) 0, rgba(255,255,255,0.18) 6px, transparent 7px), radial-gradient(circle at 70% 65%, rgba(255,255,255,0.15) 0, rgba(255,255,255,0.15) 5px, transparent 6px), radial-gradient(circle at 45% 85%, rgba(0,0,0,0.12) 0, rgba(0,0,0,0.12) 4px, transparent 5px), linear-gradient(135deg,#d7263d,#f46036,#f7c548,#2e933c)', backgroundColor: 'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.18) 0, rgba(255,255,255,0.18) 6px, transparent 7px), radial-gradient(circle at 70% 65%, rgba(255,255,255,0.15) 0, rgba(255,255,255,0.15) 5px, transparent 6px), radial-gradient(circle at 45% 85%, rgba(0,0,0,0.12) 0, rgba(0,0,0,0.12) 4px, transparent 5px), linear-gradient(135deg,#d7263d,#f46036,#f7c548,#2e933c)', titleColor: '#ffffff', descriptionColor: 'rgba(255,255,255,0.92)', ctaBackground: '#1c1c1c', ctaColor: '#f7c548', borderColor: 'rgba(255,255,255,0.35)', shadow: 'large' },
  { key: 'midnight', label: 'Minimal Dark', swatch: '#1a1a1f', backgroundColor: '#1a1a1f', titleColor: '#ffffff', descriptionColor: 'rgba(255,255,255,0.65)', ctaBackground: '#ffffff', ctaColor: '#1a1a1f', borderColor: 'rgba(255,255,255,0.12)', shadow: 'large' },
];

// Must match FONTS in backend/AdPromoter/utils/adCustomization.js.
const FONT_OPTIONS = [
  { key: 'system', label: 'System Default', stack: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif' },
  { key: 'modern', label: 'Modern Sans', stack: '"Poppins",-apple-system,sans-serif', google: 'Poppins:wght@400;500;600;700' },
  { key: 'elegant', label: 'Elegant Serif', stack: '"Playfair Display",Georgia,serif', google: 'Playfair+Display:wght@500;600;700' },
  { key: 'friendly', label: 'Friendly Round', stack: '"Quicksand",-apple-system,sans-serif', google: 'Quicksand:wght@500;600;700' },
  { key: 'bold', label: 'Bold Display', stack: '"Montserrat",-apple-system,sans-serif', google: 'Montserrat:wght@600;700;800' },
  { key: 'classic', label: 'Classic Slab', stack: '"Roboto Slab",Georgia,serif', google: 'Roboto+Slab:wght@500;600;700' },
];

// Roughly how much vertical room the title/description/CTA/padding need,
// keeps the card height in step with the image height instead of a tiny
// image floating in a huge box, or a big image crammed into a small one.
// Must match TEXT_AREA_RESERVE in backend/AdPromoter/utils/adCustomization.js.
const TEXT_AREA_RESERVE = 140;

function toHexColor(value, fallback) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function hexToRgb(hex) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

// WCAG relative luminance, picks readable text colors for whatever flat
// background color the user dials in manually (gradients from a template
// already ship their own matching text colors, so this only kicks in for
// the plain color picker).
function contrastColorsFor(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance < 0.5
    ? { titleColor: '#ffffff', descriptionColor: 'rgba(255,255,255,0.85)', ctaBackground: '#ffffff', ctaColor: '#111111', borderColor: 'rgba(255,255,255,0.25)' }
    : { titleColor: 'rgba(0,0,0,0.88)', descriptionColor: 'rgba(0,0,0,0.6)', ctaBackground: '#000000', ctaColor: '#ffffff', borderColor: 'rgba(0,0,0,0.08)' };
}

const AdCustomizationModal = ({ categoryId, onClose, onSave }: any) => {
  const [category, setCategory] = useState<any>(null);
  const [activeSlot, setActiveSlot] = useState(0);
  const [settings, setSettings] = useState({ ...SYSTEM_DEFAULT });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('layout');
  const [previewDevice, setPreviewDevice] = useState('desktop');
  const [customCSS, setCustomCSS] = useState('');
  const [cssError, setCssError] = useState('');

  useEffect(() => {
    setActiveSlot(0);
    fetchCategory();
  }, [categoryId]);

  useEffect(() => {
    if (!category) return;
    const raw = category.customization?.slots?.[String(activeSlot)] || {};
    setSettings({ ...SYSTEM_DEFAULT, ...raw });
    setCustomCSS(raw.customCSS || '');
    setCssError('');
  }, [activeSlot, category]);

  // Pull in the selected font for live preview, same Google Fonts URL the
  // live ad's injected <style> imports.
  useEffect(() => {
    const font = FONT_OPTIONS.find((f) => f.key === settings.fontFamily);
    if (!font || !font.google) return;
    const id = 'yepper-preview-font-' + font.key;
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`;
    document.head.appendChild(link);
  }, [settings.fontFamily]);

  const slotCount = Math.max(1, Math.min(20, category?.user_count || 1));

  const fetchCategory = async () => {
    try {
      const token = getToken();
      const response = await api.get(
        `/api/ad-categories/categoriees/${categoryId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCategory(response.data);
      setLoading(false);
    } catch (error: unknown) {
      console.error('Error fetching category:', error);
      setLoading(false);
    }
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  // Any manual color edit means this slot is no longer "using" a named
  // template; it's a custom look from here on.
  const updateColorSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value, template: undefined }));
  };

  const handleBackgroundColorChange = (hex) => {
    const contrast = contrastColorsFor(hex);
    setSettings(prev => ({ ...prev, backgroundColor: hex, template: undefined, ...(contrast || {}) }));
  };

  // The container should "go with" the image instead of leaving it stranded
  // in a mismatched box, shrinking the image shrinks the card, growing it
  // grows the card. Only applies to top-image layout (where the image stacks
  // with the text, so its height directly competes with the card's height);
  // left-image layout is already proportional since it's a width percentage
  // of whatever the card's width already is.
  const handleImageHeightChange = (px) => {
    const clampedHeight = Math.min(800, Math.max(90, px + TEXT_AREA_RESERVE));
    setSettings(prev => ({ ...prev, imageHeight: px, height: clampedHeight }));
  };

  const applyTemplate = (key) => {
    const t = TEMPLATES.find(t => t.key === key);
    if (!t) return;
    setSettings(prev => ({
      ...prev,
      template: key,
      backgroundColor: t.backgroundColor,
      titleColor: t.titleColor,
      descriptionColor: t.descriptionColor,
      ctaBackground: t.ctaBackground,
      ctaColor: t.ctaColor,
      borderColor: t.borderColor,
      shadow: t.shadow,
    }));
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
  width: ${settings.imagePosition === 'left' ? settings.imageWidthPercent + '%' : settings.topImageWidthPercent + '%'};
  height: ${settings.imagePosition === 'left' ? '100%' : settings.imageHeight + 'px'};
  ${settings.imagePosition === 'left' ? '' : 'margin: 0 auto;\n  '}object-fit: cover;
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

  const notifyLiveAdsRefresh = () => {
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
  };

  const showSavedToast = () => {
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
        { slotIndex: activeSlot, customization: customizationData },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Cache-Control': 'no-cache'
          }
        }
      );

      if ((response.data as any).success) {
        setCategory((prev: any) => ({ ...prev, customization: (response.data as any).customization }));
        notifyLiveAdsRefresh();
        if (onSave) onSave(customizationData);
        showSavedToast();
      }
    } catch (error: unknown) {
      console.error('Error saving:', error);
      alert((error as any).response?.data?.message || 'Failed to save customization');
    } finally {
      setSaving(false);
    }
  };

  const handleResetSlot = async () => {
    try {
      setSaving(true);
      const token = getToken();
      const response = await api.put(
        `/api/ad-categories/categoriees/${categoryId}/customization`,
        { slotIndex: activeSlot, reset: true },
        { headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' } }
      );
      if ((response.data as any).success) {
        setCategory((prev: any) => ({ ...prev, customization: (response.data as any).customization }));
        setSettings({ ...SYSTEM_DEFAULT });
        setCustomCSS('');
        notifyLiveAdsRefresh();
      }
    } catch (error: unknown) {
      console.error('Error resetting:', error);
      alert((error as any).response?.data?.message || 'Failed to reset this ad space');
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
    const fontStack = (FONT_OPTIONS.find(f => f.key === settings.fontFamily) || FONT_OPTIONS[0]).stack;

    const adStyle = {
      width: `${settings.width}px`,
      height: `${settings.height}px`,
      maxWidth: `${settings.maxWidth}%`,
      borderRadius: `${settings.borderRadius}px`,
      padding: `${settings.padding}px`,
      background: settings.backgroundColor,
      border: `${settings.borderWidth}px solid ${settings.borderColor}`,
      boxShadow: shadowOptions.find(s => s.value === settings.shadow)?.css || 'none',
      backdropFilter: settings.glassmorphism ? 'blur(10px)' : 'none',
      WebkitBackdropFilter: settings.glassmorphism ? 'blur(10px)' : 'none',
      fontFamily: fontStack,
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
                flex: settings.imagePosition === 'left' ? `0 0 ${settings.imageWidthPercent}%` : `0 0 ${settings.imageHeight}px`,
                width: settings.imagePosition === 'left' ? undefined : `${settings.topImageWidthPercent}%`,
                margin: settings.imagePosition === 'left' ? undefined : '0 auto',
                borderRadius: '12px',
                overflow: 'hidden',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
                  This is a sample ad description, capped at ten words on the live ad.
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

        {/* Ad-space slot selector: each slot's look is independent; picking
            a template/color here only ever touches the slot selected below. */}
        {slotCount > 1 && (
          <div className="px-6 py-3 border-b border-border flex items-center gap-2 flex-wrap">
            <span className="text-xs text-subtle mr-1">Ad Space:</span>
            {Array.from({ length: slotCount }).map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveSlot(i)}
                className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                  activeSlot === i
                    ? 'border-border bg-surface-2 text-white'
                    : 'border-border text-subtle hover:text-white'
                }`}
              >
                Ad Space {i + 1}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Controls Panel */}
            <div className="lg:col-span-1">
              {/* Tabs */}
              <div className="flex gap-0 mb-6 border-b border-border">
                {['layout', 'colors', 'content', 'code'].map(tab => (
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
                    <p className="text-xs text-subtle mt-1">Minimum 160px (enforced server-side too).</p>
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
                    <p className="text-xs text-subtle mt-1">Minimum 90px (enforced server-side too).</p>
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

                  <div>
                    {settings.imagePosition === 'left' ? (
                      <>
                        <label className="block text-sm font-medium text-white mb-2">
                          Image Width: {settings.imageWidthPercent}% of card
                        </label>
                        <input
                          type="range"
                          min="20"
                          max="65"
                          value={settings.imageWidthPercent}
                          onChange={(e: any) => updateSetting('imageWidthPercent', parseInt(e.target.value))}
                          className="w-full accent-black"
                        />
                      </>
                    ) : (
                      <>
                        <label className="block text-sm font-medium text-white mb-2">
                          Image Height: {settings.imageHeight}px tall
                        </label>
                        <input
                          type="range"
                          min="60"
                          max="360"
                          value={settings.imageHeight}
                          onChange={(e: any) => handleImageHeightChange(parseInt(e.target.value))}
                          className="w-full accent-black"
                        />
                        <label className="block text-sm font-medium text-white mb-2 mt-4">
                          Image Width: {settings.topImageWidthPercent}% of card
                        </label>
                        <input
                          type="range"
                          min="40"
                          max="100"
                          value={settings.topImageWidthPercent}
                          onChange={(e: any) => updateSetting('topImageWidthPercent', parseInt(e.target.value))}
                          className="w-full accent-black"
                        />
                      </>
                    )}
                    <p className="text-xs text-subtle mt-1">
                      The full image always shows (never cropped), it's scaled to fit this box, so it can never blow up the card.
                      {settings.imagePosition !== 'left' && ' The ad space height resizes to match.'}
                    </p>
                  </div>

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
                </div>
              )}

              {/* Colors Tab */}
              {activeTab === 'colors' && (
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-white">Color Template</label>
                      <button
                        onClick={handleResetSlot}
                        disabled={saving}
                        className="text-xs text-subtle hover:text-white flex items-center gap-1 disabled:opacity-50"
                      >
                        <RotateCcw size={12} /> Reset this space
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {TEMPLATES.map(t => (
                        <button
                          key={t.key}
                          onClick={() => applyTemplate(t.key)}
                          title={t.label}
                          aria-label={t.label}
                          className={`h-12 border-2 transition-colors ${
                            settings.template === t.key ? 'border-white' : 'border-border hover:border-muted'
                          }`}
                          style={{ background: t.swatch }}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-subtle mt-2">
                      {settings.template
                        ? TEMPLATES.find(t => t.key === settings.template)?.label
                        : 'Custom colors'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-white mb-1">Background</label>
                      <input
                        type="color"
                        value={toHexColor(settings.backgroundColor, '#ffffff')}
                        onChange={(e: any) => handleBackgroundColorChange(e.target.value)}
                        className="w-full h-9 border border-border bg-surface-1 cursor-pointer"
                      />
                      <p className="text-xs text-subtle mt-1">Title/CTA colors auto-adjust for contrast.</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-white mb-1">Title Text</label>
                      <input
                        type="color"
                        value={toHexColor(settings.titleColor, '#000000')}
                        onChange={(e: any) => updateColorSetting('titleColor', e.target.value)}
                        className="w-full h-9 border border-border bg-surface-1 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-white mb-1">CTA Background</label>
                      <input
                        type="color"
                        value={toHexColor(settings.ctaBackground, '#000000')}
                        onChange={(e: any) => updateColorSetting('ctaBackground', e.target.value)}
                        className="w-full h-9 border border-border bg-surface-1 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-white mb-1">CTA Text</label>
                      <input
                        type="color"
                        value={toHexColor(settings.ctaColor, '#ffffff')}
                        onChange={(e: any) => updateColorSetting('ctaColor', e.target.value)}
                        className="w-full h-9 border border-border bg-surface-1 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Font</label>
                    <select
                      value={settings.fontFamily}
                      onChange={(e: any) => updateSetting('fontFamily', e.target.value)}
                      className="w-full px-3 py-2 border border-border bg-surface-1 text-sm focus:outline-none focus:ring-1 focus:ring-white focus:border-white"
                    >
                      {FONT_OPTIONS.map(f => (
                        <option key={f.key} value={f.key}>{f.label}</option>
                      ))}
                    </select>
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
                  <p className="text-xs text-subtle -mt-4">
                    Descriptions are automatically capped at 10 words on the live ad, regardless of what the advertiser submitted.
                  </p>

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
