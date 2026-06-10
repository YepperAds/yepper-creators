'use client';
// @ts-nocheck

// WebsiteCard.js
import React from 'react';
import Link from 'next/link';

const WebsiteCard = ({ filteredWebsites, searchQuery, compact = false }: any) => {
  const height = compact ? 'h-[200px]' : 'h-[280px]';
  const titleSize = compact ? 'text-[8px]' : 'text-[9px]';
  const cardSize = compact ? 'w-16 h-14' : 'w-24 h-20';
  const imageHeight = compact ? 'h-6' : 'h-8';
  
  return (
    <div className="w-full">
      {filteredWebsites.length > 0 ? (
        <Link href="/websites">
          <div className="relative cursor-pointer group">
            <div className={`relative bg-surface-1 border-2 border-border p-4 ${height} flex flex-col`}>
              
              <div className="relative flex-1 overflow-hidden bg-gradient-to-br from-green-50 via-white to-teal-50 border border-border">
                
                <div className={`absolute top-0 left-0 right-0 ${compact ? 'h-4' : 'h-6'} bg-blue-300 border-b border-border flex items-center px-2`}>
                  <div className="flex space-x-1.5">
                    <div className={`${compact ? 'w-1.5 h-1.5' : 'w-2 h-2'} bg-black rounded-full`}></div>
                    <div className={`${compact ? 'w-1.5 h-1.5' : 'w-2 h-2'} bg-black rounded-full`}></div>
                    <div className={`${compact ? 'w-1.5 h-1.5' : 'w-2 h-2'} bg-black rounded-full`}></div>
                  </div>
                </div>
                
                <div className={`absolute inset-0 ${compact ? 'top-4' : 'top-6'}`}>
                  {filteredWebsites.slice(0, 4).map((website: any, index: any) => {
                    const positions = [
                      { x: 10, y: 15, rotate: -3, scale: 1 },
                      { x: 55, y: 12, rotate: 4, scale: 0.95 },
                      { x: 12, y: 55, rotate: -2, scale: 0.9 },
                      { x: 58, y: 52, rotate: 3, scale: 0.88 }
                    ];
                    
                    const pos = positions[index];
                    
                    const gradients = [
                      'from-green-500 to-emerald-500',
                      'from-teal-500 to-cyan-500', 
                      'from-emerald-500 to-green-600',
                      'from-cyan-500 to-teal-600'
                    ];

                    return (
                      <div
                        key={website._id || index}
                        className={`absolute ${cardSize} transition-all duration-500 group-hover:scale-105`}
                        style={{
                          left: `${pos.x}%`,
                          top: `${pos.y}%`,
                          transform: `rotate(${pos.rotate}deg) scale(${pos.scale})`,
                          zIndex: 4 - index,
                        }}
                      >
                        <div className={`relative bg-surface-1 rounded-lg overflow-hidden shadow-lg border border-white/20 group-hover:shadow-xl transition-all duration-500`}>
                          
                          <div className={`${compact ? 'h-1.5' : 'h-2'} bg-gradient-to-r ${gradients[index]} flex items-center px-1`}>
                            <div className={`${compact ? 'w-0.5 h-0.5' : 'w-1 h-1'} bg-surface-1/60 rounded-full`}></div>
                          </div>
                          
                          <div className={`${compact ? 'p-1.5' : 'p-2'} h-full flex flex-col bg-surface-1`}>
                            <div className={`w-full ${imageHeight} overflow-hidden rounded-sm bg-gradient-to-br from-slate-100 to-slate-200 relative ${compact ? 'mb-1' : 'mb-2'}`}>
                              {website.imageUrl ? (
                                <img 
                                  src={website.imageUrl} 
                                  alt={website.websiteName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <>
                                </>
                              )}
                              <div className={`absolute top-1 right-1 ${compact ? 'w-1.5 h-1.5' : 'w-2 h-2'} bg-gradient-to-r ${gradients[index]} rounded-full animate-pulse`}></div>
                            </div>
                            
                            <div className="flex-1 flex flex-col justify-center">
                              <div className={`${titleSize} font-semibold text-subtle text-center leading-tight truncate px-1`}>
                                {website.websiteName || 'Unnamed Website'}
                              </div>
                              <div className={`${compact ? 'h-0.5' : 'h-0.5'} bg-slate-300 rounded-full w-3/4 mx-auto mt-1`}></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className={`relative ${compact ? 'mt-2' : 'mt-4'} flex items-center justify-center`}>
                <div className="bg-surface-1 border-2 border-border px-3 py-1.5">
                  <span className={`${compact ? 'text-[10px]' : 'text-xs'} font-bold text-white uppercase tracking-wide`}>
                    Click to see your Websites
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Link>
      ) : (
        <div className={`text-center py-8 border-2 border-border bg-surface-1 ${height} flex flex-col items-center justify-center`}>
          <h3 className={`${compact ? 'text-base' : 'text-lg'} font-bold text-white mb-1`}>
            {searchQuery ? 'No Websites Found' : 'No Websites Yet'}
          </h3>
          <p className={`${compact ? 'text-xs' : 'text-sm'} text-subtle`}>
            {searchQuery 
              ? 'No websites match your search criteria.'
              : 'Start adding your first website.'
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default WebsiteCard;