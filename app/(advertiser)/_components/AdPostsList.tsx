'use client';

import { useCallback, useEffect, useState } from 'react';
import { FilmIcon } from '@heroicons/react/24/outline';

interface AdPost {
  id: number;
  provider: string;
  tracking_code: string;
  video_url: string | null;
  title: string;
  thumbnail_url: string | null;
  status: string;
  views: number;
  likes: number;
  comments: number;
  posted_at: string;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// The logged-in creator's own posted ad videos — same data source as the
// counts shown on connect-accounts/page.tsx (GET /api/social/ad-posts).
export default function AdPostsList() {
  const [posts, setPosts]     = useState<AdPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const sessRes  = await fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' });
      const sessJson = await sessRes.json().catch(() => ({}));
      const userId   = sessJson?.data?.user?.id ?? sessJson?.data?.user?._id;
      if (!userId) { setPosts([]); return; }

      const res  = await fetch(`/api/social/ad-posts?user_uuid=${userId}`, { credentials: 'include', cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      setPosts(Array.isArray(json?.data) ? json.data : []);
    } catch {
      setError('Failed to load your ad posts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-(--color-white)">Your YouTube ads</h1>
        <p className="mt-1 text-sm text-(--color-muted)">Ad videos you've posted through Yepper.</p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-2xl bg-(--color-surface-1) border border-(--color-border) animate-pulse" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-(--color-border) rounded-2xl">
          <FilmIcon className="w-12 h-12 text-(--color-muted) mb-4" />
          <p className="text-base font-semibold text-(--color-white) mb-1">No ad videos posted yet</p>
          <p className="text-sm text-(--color-muted) max-w-xs">Use "Add ad" to post your first ad video to YouTube.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.id} className="bg-(--color-surface-1) border border-(--color-border) rounded-2xl p-4 flex gap-4">
              <div className="w-28 h-16 rounded-lg bg-(--color-surface-2) overflow-hidden shrink-0">
                {post.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.thumbnail_url} alt={post.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-(--color-muted)"><FilmIcon className="w-5 h-5" /></div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-(--color-white) truncate">{post.title}</p>
                <p className="text-xs text-(--color-muted) mt-0.5 font-mono">{post.tracking_code}</p>
                <p className="text-xs text-(--color-muted) mt-1">
                  {formatCount(post.views)} views · {formatCount(post.likes)} likes
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
