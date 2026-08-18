'use client';
// @ts-nocheck

// Public "claim your website" landing page — the destination of the
// "click here to integrate" link in the prospect-invite email
// (backend/controllers/prospectController.js sendProspectInvite). Reachable
// signed out (listed in ProtectedRoute's PUBLIC_PATHS): the real owner isn't
// authenticated yet when they click the link from their inbox. Mirrors
// ad-owner/pages/direct-ad's inline Google-auth-then-resume pattern.

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, ArrowRight, Loader } from 'lucide-react';
import LoadingSpinner from '@/app/(adsense)/components/LoadingSpinner';
import { websiteAPI, authAPI } from '@/app/_lib/adsense-api';
import { useSession } from '@/app/_hooks/useSession';

const GoogleIcon = () => (
  <svg className="w-5 h-5 mr-3 flex-shrink-0" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export default function ClaimProspectPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { user, isAuthenticated, isLoading: sessionLoading } = useSession();

  const [site, setSite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    websiteAPI.getProspect(id)
      .then((res: any) => setSite(res.data?.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const handleGoogleLogin = () => {
    setIsGoogleLoading(true);
    const from = `/ad-promoter/pages/claim-prospect/${id}?googleReturn=true`;
    window.location.href = `${authAPI.googleRedirect()}?from=${encodeURIComponent(from)}`;
  };

  const handleClaim = async () => {
    if (isClaiming) return;
    setIsClaiming(true);
    setError('');
    try {
      const res: any = await websiteAPI.claimProspect(id);
      const claimedId = res.data?.data?.id ?? id;
      router.push(`/ad-promoter/pages/website/${claimedId}`);
    } catch (err: any) {
      setError(err.response?.message || err.message || 'Failed to claim website');
      setIsClaiming(false);
    }
  };

  // After the Google OAuth round trip lands back here, finish the claim
  // automatically instead of making them find and click the button again.
  useEffect(() => {
    const isGoogleReturn = typeof window !== 'undefined'
      && new URLSearchParams(window.location.search).get('googleReturn') === 'true';
    if (isGoogleReturn && isAuthenticated && site && !isClaiming) {
      window.history.replaceState({}, '', `/ad-promoter/pages/claim-prospect/${id}`);
      handleClaim();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, site]);

  if (loading || sessionLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  if (notFound || !site) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <AlertTriangle className="mx-auto mb-4 text-subtle" size={32} />
          <h1 className="text-xl font-semibold text-white mb-2">This listing isn't available</h1>
          <p className="text-subtle text-sm">It may have already been claimed, or the link is no longer valid.</p>
        </div>
      </div>
    );
  }

  const siteUrl = site.websiteLink && !/^https?:\/\//i.test(site.websiteLink)
    ? `https://${site.websiteLink}`
    : site.websiteLink;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="border border-border bg-surface-1 p-8 space-y-8">
          <div className="flex items-center gap-4">
            {site.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={site.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-subtle font-semibold mb-1">Your website is set up on Yepper</p>
              <h1 className="text-2xl font-bold text-white truncate">{site.websiteName}</h1>
              {siteUrl && (
                <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-subtle hover:text-white underline underline-offset-2 break-all">
                  {site.websiteLink}
                </a>
              )}
            </div>
          </div>

          {site.interestCount > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
              <strong>{site.interestCount}</strong> advertiser{site.interestCount === 1 ? ' has' : 's have'} already shown interest in advertising on {site.websiteName}.
            </div>
          )}

          <div>
            <h2 className="text-sm font-semibold text-subtle mb-3">Ad spaces ready for you</h2>
            <div className="space-y-2">
              {(site.spaces || []).map((s: any) => (
                <div key={s.id} className="flex items-center justify-between border border-border px-4 py-3">
                  <span className="text-white text-sm font-medium">{s.categoryName}</span>
                  <span className="text-subtle text-sm">RWF {Number(s.price || 0).toLocaleString()}/month</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-subtle text-sm leading-relaxed">
            Claiming makes this listing yours — advertisers browsing Yepper can already see it. Sign in to take ownership, then install one script on your site to start collecting real payments.
          </p>

          {error && (
            <div className="flex items-center gap-2 bg-error/10 border border-red-300 text-error px-4 py-3 text-sm">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {!isAuthenticated ? (
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading}
              className="w-full flex items-center justify-center px-4 py-3.5 rounded-xl border-2 border-border bg-surface-2 hover:bg-surface-3 transition-all duration-200 font-semibold text-white text-base shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isGoogleLoading ? (
                <svg className="animate-spin w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : (
                <GoogleIcon />
              )}
              {isGoogleLoading ? 'Redirecting…' : 'Continue with Google to claim'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleClaim}
              disabled={isClaiming}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-black text-white py-3.5 font-semibold hover:bg-neutral-800 border border-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isClaiming ? (
                <><Loader size={16} className="animate-spin" /> Claiming…</>
              ) : (
                <>Claim this website <ArrowRight size={16} /></>
              )}
            </button>
          )}

          {isAuthenticated && user?.email && (
            <p className="text-center text-xs text-subtle">Signed in as {user.email}</p>
          )}
        </div>
      </div>
    </div>
  );
}
