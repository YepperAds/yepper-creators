'use client';
import React from 'react';
import { Sparkles } from 'lucide-react';
import LeftRail from '../img/leftRail.png';

const LeftRailContainer = () => {
  const features = [
    {
      point: "Consistent visibility",
    },
    {
      point: "Complements reading patterns",
    },
    {
      point: "Extended exposure time",
    },
    {
      point: "Multiple ad stack potential",
    },
    {
      point: "Good for desktop viewing",
    },
  ];

  return (
    <div className="min-h-screen bg-black text-[#fff] flex items-center justify-center p-6">
      <div 
        className="max-w-6xl w-full rounded-3xl overflow-hidden border border-[#fff]/10 backdrop-blur-md bg-gradient-to-b from-blue-900/30 to-blue-900/10 transition-all duration-500"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
          {/* Image Section */}
          <div className="relative h-full min-h-[500px] overflow-hidden">
            <img
              src={LeftRail.src}
              alt="Above the Fold Space"
              className="w-full h-full object-cover opacity-80"
            />
            {/* Blue glow effect */}
            <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-blue-500/30 to-transparent"></div>
          </div>

          {/* Content Section */}
          <div className="p-10 flex flex-col justify-between relative">
            <div className="mb-6">
              <div className="flex items-center mb-6">
                <div className="h-px w-12 bg-blue-500 mr-6"></div>
                <span className="text-blue-400 text-sm font-medium uppercase tracking-widest">Placement Type</span>
                <div className="h-px w-12 bg-blue-500 ml-6"></div>
              </div>
              
              <h1 className="text-4xl font-bold mb-6 tracking-tight">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
                  Left Rail
                </span>
              </h1>
              
              <p className="text-[#fff]/70 leading-relaxed mb-8">
                Vertical advertising space along the left side of the webpage, providing consistent visibility throughout the user's scrolling journey while complementing the natural left-to-right reading pattern.
              </p>
            </div>

            <div className="space-y-4 mb-8">
              {features.map((feature: any, index: any) => (
                <div key={index} className="flex items-center text-[#fff]/80">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center mr-3">
                    <Sparkles size={14} className="text-blue-400" />
                  </div>
                  <span>{feature.point}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeftRailContainer;