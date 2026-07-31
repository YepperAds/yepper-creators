'use client';
// @ts-nocheck
// AdPromoter/components/TrafficGrantBanner.js
// Shows a banner when:
//   (a) user has a pending grant they haven't used yet, OR
//   (b) user just applied a grant and is within the 24-hour display window
// After 24 hours the banner disappears automatically, until the admin grants again.

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/app/_lib/adsense-api';

export default function TrafficGrantBanner({  websiteId  }: any) {
  const router    = useRouter();
  const [grant,     setGrant]     = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    api.get('/api/admin/user-grant-status')
      .then(res => {
        if (!(res.data as any).hasGrant) return;
        const g = (res.data as any);
        // Only show if the grant is for this website or is website-agnostic
        if (!g.websiteId || g.websiteId === websiteId) {
          setGrant(g);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [websiteId]);

  if (loading || !grant || dismissed) return null;

  const isPending     = grant.grantType === 'pending';

  // How many days until the pending grant link expires
  const expiresIn  = grant.expiresAt
    ? Math.ceil((new Date(grant.expiresAt) - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const handleClick = () => {
    if (isPending) router.push(`/ad-promoter/pages/traffic-grant?token=${grant.accessToken}`);
  };

  return (
    <div style={{
      background: isPending
        ? 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 100%)'
        : 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)',
      borderRadius: 12,
      padding: '18px 22px',
      marginBottom: 24,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 14,
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ fontSize: 26, flexShrink: 0 }}>{isPending ? '📊' : '✅'}</div>
        <div>
          {isPending ? (
            <>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: 15, marginBottom: 3 }}>
                You have an analytics boost available!
              </div>
              <div style={{ color: '#aaa', fontSize: 13, lineHeight: 1.5 }}>
                Set your own traffic &amp; views numbers for this website.
                {expiresIn > 0 && (
                  <span style={{ color: '#f6ad55', marginLeft: 6 }}>
                    Expires in {expiresIn} day{expiresIn !== 1 ? 's' : ''}.
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: 15, marginBottom: 3 }}>
                Traffic grant applied: your analytics and tier have been updated
              </div>
              <div style={{ color: '#6ee7b7', fontSize: 13, lineHeight: 1.5 }}>
                {grant.grantedTraffic?.toLocaleString()} visitors · {grant.trafficTier} tier
                <span style={{ color: '#a7f3d0', marginLeft: 8 }}>
                  · Active until your real traffic reaches this tier
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
        {isPending && (
          <button
            onClick={handleClick}
            style={{
              background: '#fff',
              color: '#111',
              border: 'none',
              borderRadius: 8,
              padding: '9px 18px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 13,
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            Set My Numbers →
          </button>
        )}
        <button
          onClick={() => setDismissed(true)}
          style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 18, padding: '4px 6px' }}
          title="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
