'use client';

import { useEffect, useRef } from 'react';

export interface MapPoint {
  lat: number;
  lon: number;
  device?: string;
  city?: string;
  country?: string;
  timestamp?: string;
}

// Shared dark-themed Leaflet map for "where did the audience come from" —
// used both by the full per-website Analytics panel and the compact
// audience snapshot embedded in an individual ad's expanded card. Loads
// Leaflet from a CDN on first use; CARTO's free dark basemap needs no API
// key and reads as part of the dashboard's dark UI instead of a bright OSM
// tile punched into it.
export default function AudienceMap({ points, height = 360 }: { points: MapPoint[]; height?: number }) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<any>(null);

  useEffect(() => {
    if (!points.length) return;
    const init = () => {
      const container = mapRef.current;
      if (!container || !(window as any).L) return;
      if (leafletMapRef.current) { leafletMapRef.current.remove(); leafletMapRef.current = null; }
      const map = (window as any).L.map(container, { zoomControl: true }).setView([20, 0], 2);
      (window as any).L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);
      points.forEach((pt) => {
        const c = pt.device === 'mobile' ? '#60a5fa' : pt.device === 'tablet' ? '#c084fc' : '#34d399';
        (window as any).L.circleMarker([pt.lat, pt.lon], { radius: 6, fillColor: c, color: '#0b0f14', weight: 1.5, opacity: 1, fillOpacity: 0.9 })
          .bindPopup(`<strong>${pt.city ?? 'Unknown'}, ${pt.country ?? ''}</strong><br/>${pt.device ?? ''}${pt.timestamp ? `<br/>${new Date(pt.timestamp).toLocaleString()}` : ''}`).addTo(map);
      });
      leafletMapRef.current = map;
      requestAnimationFrame(() => map.invalidateSize());
    };
    if (!(window as any).L) {
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css'; link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.onload = init;
      document.head.appendChild(s);
    } else {
      init();
    }
    return () => { if (leafletMapRef.current) { leafletMapRef.current.remove(); leafletMapRef.current = null; } };
  }, [points]);

  return (
    <>
      <div ref={mapRef} style={{ height, width: '100%' }} />
      <style jsx global>{`
        .leaflet-container {
          background: #0b0f14;
          font-family: inherit;
        }
        .leaflet-control-zoom a {
          background: #171b22 !important;
          color: #e5e7eb !important;
          border-color: #2a303c !important;
        }
        .leaflet-control-zoom a:hover {
          background: #2a303c !important;
        }
        .leaflet-control-attribution {
          background: rgba(11, 15, 20, 0.75) !important;
          color: #9aa3af !important;
        }
        .leaflet-control-attribution a {
          color: #cbd5e1 !important;
        }
        .leaflet-popup-content-wrapper {
          background: #171b22;
          color: #e5e7eb;
          border-radius: 10px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        }
        .leaflet-popup-tip {
          background: #171b22;
        }
        .leaflet-popup-content {
          font-size: 12px;
          line-height: 1.5;
        }
      `}</style>
    </>
  );
}
