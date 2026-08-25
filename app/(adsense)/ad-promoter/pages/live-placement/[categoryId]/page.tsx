'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { categoryAPI } from '@/app/_lib/adsense-api';

// "Check live placement" — a full page instead of a modal (the owner wanted
// somewhere they could land on directly, not a popup on top of the panel).
// liveUrl/label arrive via the query string from codeDisplay.tsx, which
// already has the website+category objects in hand; this page only needs
// categoryId to fetch the actual screenshot (see ScreenshotController.js —
// a real iframe of the owner's live site isn't possible, most sites refuse
// to be framed by another origin, so the backend renders it headlessly and
// ships back a PNG instead).
export default function LivePlacementPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const categoryId = params?.categoryId as string;
  const liveUrl = searchParams.get('liveUrl');
  const label = searchParams.get('label') || 'Ad space';

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const blob = await categoryAPI.getLiveScreenshot(categoryId);
        objectUrl = URL.createObjectURL(blob as Blob);
        if (!cancelled) setImageUrl(objectUrl);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Could not load the live page.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [categoryId]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-5 gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white shrink-0"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="text-sm font-semibold truncate">Live placement — {label}</h1>
          {liveUrl ? (
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener"
              className="text-xs text-orange-400 hover:text-orange-300 underline whitespace-nowrap shrink-0"
            >
              Open in new tab
            </a>
          ) : <span className="w-16 shrink-0" />}
        </div>

        {loading && (
          <div className="flex items-center justify-center h-96 text-zinc-400 text-sm border border-zinc-800 rounded-xl">
            Loading your live page…
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center h-96 text-center gap-3 px-6 border border-zinc-800 rounded-xl">
            <p className="text-sm text-red-400">{error}</p>
            {liveUrl && (
              <a
                href={liveUrl}
                target="_blank"
                rel="noopener"
                className="text-xs text-orange-400 hover:text-orange-300 underline"
              >
                Try opening it directly instead
              </a>
            )}
          </div>
        )}

        {imageUrl && !loading && (
          <img src={imageUrl} alt="Live ad placement" className="w-full h-auto rounded-xl border border-zinc-800" />
        )}
      </div>
    </div>
  );
}
