'use client';
// @ts-nocheck

import React from 'react';
import Link from 'next/link';

const AdsCard = ({ filteredAds, searchQuery, compact = false }: any) => {
  const height    = compact ? 'h-[200px]' : 'h-[280px]';
  const cardSize  = compact ? 'w-14 h-12' : 'w-20 h-16';
  const imageHeight = compact ? 'h-4' : 'h-6';

  const gradients = [
    'from-coral to-coral-dark',
    'from-blue to-blue-dark',
    'from-success/80 to-success',
    'from-warning/80 to-warning',
  ];

  return (
    <div className="w-full">
      {filteredAds.length > 0 ? (
        <Link href="/ads">
          <div className="relative cursor-pointer group">
            <div className={`relative bg-surface-1 border border-border p-4 ${height} flex flex-col rounded-2xl overflow-hidden`}>

              {/* Preview canvas */}
              <div className={`relative flex-1 overflow-hidden bg-surface-2 border border-border rounded-xl`}>
                {/* Top bar accent */}
                <div className="absolute top-0 left-0 right-0 h-5 bg-coral/20 border-b border-border" />

                <div className={`absolute inset-0 ${compact ? 'top-5' : 'top-5'}`}>
                  {filteredAds.slice(0, 4).map((ad: any, index: any) => {
                    const positions = [
                      { x: 12, y: 15, rotate: -5,  scale: 1    },
                      { x: 52, y: 20, rotate: 8,   scale: 0.95 },
                      { x: 20, y: 52, rotate: -10, scale: 0.9  },
                      { x: 60, y: 15, rotate: 4,   scale: 0.88 },
                    ];
                    const pos = positions[index];

                    return (
                      <div
                        key={ad._id || index}
                        className="absolute transition-all duration-500 group-hover:scale-105"
                        style={{
                          width:     compact ? '3.5rem' : '5rem',
                          height:    compact ? '3rem'   : '4rem',
                          left:      `${pos.x}%`,
                          top:       `${pos.y}%`,
                          transform: `rotate(${pos.rotate}deg) scale(${pos.scale})`,
                          zIndex:    4 - index,
                        }}
                      >
                        <div className="relative bg-surface-1 rounded-lg overflow-hidden shadow-lg border border-border/50 group-hover:shadow-xl transition-all duration-500 w-full h-full">
                          <div className={`${compact ? 'h-1.5' : 'h-2'} bg-gradient-to-r ${gradients[index]}`} />
                          <div className={`${compact ? 'p-1' : 'p-1.5'} h-full flex flex-col`}>
                            <div className={`w-full ${imageHeight} overflow-hidden rounded-sm bg-surface-3 mb-1`}>
                              {ad.videoUrl ? (
                                <video muted className="w-full h-full object-cover">
                                  <source src={ad.videoUrl} type="video/mp4" />
                                </video>
                              ) : (
                                <img src={ad.imageUrl} alt={ad.businessName} className="w-full h-full object-cover" />
                              )}
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className={`${compact ? 'h-0.5' : 'h-1'} bg-border rounded-full w-3/4`} />
                              <div className="h-0.5 bg-border/50 rounded-full w-1/2" />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CTA */}
              <div className={`relative ${compact ? 'mt-2' : 'mt-4'} flex items-center justify-center`}>
                <div className="bg-surface-2 border border-border px-3 py-1.5 rounded-lg">
                  <span className={`${compact ? 'text-[10px]' : 'text-xs'} font-semibold text-white uppercase tracking-wide`}>
                    Click to see your Ads
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Link>
      ) : (
        <div className={`text-center py-8 border border-border bg-surface-1 rounded-2xl ${height} flex flex-col items-center justify-center`}>
          <h3 className={`${compact ? 'text-base' : 'text-lg'} font-bold text-white mb-1`}>
            {searchQuery ? 'No Campaigns Found' : 'No Active Campaigns Yet'}
          </h3>
          <p className={`${compact ? 'text-xs' : 'text-sm'} text-muted`}>
            {searchQuery
              ? 'No campaigns match your current search criteria.'
              : 'Start creating your first campaign.'
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default AdsCard;
