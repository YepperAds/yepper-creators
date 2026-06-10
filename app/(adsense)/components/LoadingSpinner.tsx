'use client';

import React from 'react';

const LoadingSpinner = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="spinner-container">
        <div className="twisted-ring"></div>
      </div>

      <style jsx>{`
        .spinner-container {
          perspective: 1000px;
          width: 60px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .twisted-ring {
          width: 40px;
          height: 40px;
          border: 4px solid var(--surface-3);
          border-top: 4px solid var(--text-main);
          border-radius: 50%;
          position: relative;
          animation: spin 1s linear infinite;
        }

        .twisted-ring::before {
          display: none;
        }

        .twisted-ring::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 20px;
          height: 20px;
          background: var(--text-main);
          border-radius: 50%;
          transform: translate(-50%, -50%);
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LoadingSpinner;
