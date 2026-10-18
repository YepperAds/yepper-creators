'use client';

import { useEffect, useState } from 'react';
import { getToken } from '@/app/(adsense)/utils/token';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

interface TikTokSponsorship {
  id: number;
  brandName: string;
  campaignBrief: string;
  creativeImageUrl: string;
  destinationUrl: string;
  trackingUrl: string;
  amount: number;
  status: 'pending_post' | 'submitted';
  videoUrl: string | null;
  views: number;
  likes: number;
  comments: number;
  clicks: number;
}

export default function TikTokSponsoredPosts({ onClose }: { onClose: () => void }) {
  const [posts, setPosts] = useState<TikTokSponsorship[]>([]);
  const [videoLinks, setVideoLinks] = useState<Record<number, string>>({});
  const [linkAdded, setLinkAdded] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const authedFetch = (url: string, init: RequestInit = {}) => {
    const token = getToken();
    return fetch(url, {
      ...init,
      credentials: 'include',
      headers: { ...(init.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  };

  const loadPosts = async () => {
    try {
      const response = await authedFetch(`${BACKEND_URL}/api/social/tiktok/sponsorships/pending`);
      const json = await response.json();
      if (!response.ok || !json?.success) throw new Error(json?.message || 'Could not load sponsored posts');
      setPosts(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load sponsored posts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const token = getToken();
        const response = await fetch(`${BACKEND_URL}/api/social/tiktok/sponsorships/pending`, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: 'no-store',
        });
        const json = await response.json();
        if (!response.ok || !json?.success) throw new Error(json?.message || 'Could not load sponsored posts');
        if (!cancelled) setPosts(json.data || []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load sponsored posts');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const submitPost = async (post: TikTokSponsorship) => {
    setSubmitting(post.id);
    setError('');
    setNotice('');
    try {
      const response = await authedFetch(`${BACKEND_URL}/api/social/tiktok/sponsorships/${post.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: videoLinks[post.id], linkAdded: linkAdded[post.id] === true }),
      });
      const json = await response.json();
      if (!response.ok || !json?.success) throw new Error(json?.message || 'Could not verify the TikTok post');
      setNotice(`${post.brandName} post submitted. Video views will refresh from TikTok.`);
      await loadPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit the TikTok post');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-(--color-border) bg-(--color-surface-1) p-5 sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-(--color-white)">TikTok sponsored posts</h2>
            <p className="mt-1 text-xs text-(--color-muted)">Add each campaign link to your TikTok bio while the promotion is active, then submit your published video.</p>
          </div>
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-(--color-muted) hover:bg-(--color-surface-2) hover:text-(--color-white)">Close</button>
        </div>

        {error && <p role="alert" className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-300">{error}</p>}
        {notice && <p role="status" className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-300">{notice}</p>}

        {loading ? <p className="text-sm text-(--color-muted)">Loading sponsored posts…</p> : posts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-(--color-border) p-6 text-center text-sm text-(--color-muted)">No paid TikTok sponsorships yet.</p>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <article key={post.id} className="rounded-xl border border-(--color-border) bg-(--color-surface-2) p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-(--color-white)">{post.brandName}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-(--color-muted)">{post.campaignBrief}</p>
                  </div>
                  <span className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase ${post.status === 'submitted' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-200'}`}>
                    {post.status === 'submitted' ? 'Submitted' : 'Awaiting post'}
                  </span>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={post.creativeImageUrl} alt={`${post.brandName} ad creative`} className="mt-3 max-h-56 w-full rounded-lg border border-(--color-border) bg-(--color-surface-1) object-contain" />
                <a href={post.destinationUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block break-all text-xs font-semibold text-emerald-300 underline underline-offset-2">
                  Campaign destination: {new URL(post.destinationUrl).hostname}
                </a>

                <div className="mt-4">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-(--color-muted)">Campaign link for your TikTok bio</p>
                  <div className="flex gap-2">
                    <input readOnly value={post.trackingUrl} className="min-w-0 flex-1 rounded-lg border border-(--color-border) bg-(--color-surface-1) px-3 py-2 text-xs text-(--color-white)" />
                    <button type="button" onClick={() => navigator.clipboard?.writeText(post.trackingUrl)} className="rounded-lg border border-(--color-border) px-3 text-xs font-semibold text-(--color-white)">Copy</button>
                  </div>
                  <p className="mt-1 text-[10px] text-(--color-muted)">Clicks are tracked when people open this URL. Keep it in your bio while this campaign is active.</p>
                </div>

                {post.status === 'pending_post' ? (
                  <div className="mt-4 space-y-3 border-t border-(--color-border) pt-4">
                    <label className="flex items-start gap-2 text-xs text-(--color-white)">
                      <input type="checkbox" checked={linkAdded[post.id] === true} onChange={(event) => setLinkAdded((current) => ({ ...current, [post.id]: event.target.checked }))} className="mt-0.5 accent-emerald-500" />
                      I added this campaign link to my TikTok bio.
                    </label>
                    <label className="block text-xs font-semibold text-(--color-white)">
                      Published TikTok video link
                      <input value={videoLinks[post.id] || ''} onChange={(event) => setVideoLinks((current) => ({ ...current, [post.id]: event.target.value }))} placeholder="https://www.tiktok.com/@you/video/..." className="mt-1.5 w-full rounded-lg border border-(--color-border) bg-(--color-surface-1) px-3 py-2.5 text-xs font-normal text-(--color-white) placeholder:text-(--color-muted)" />
                    </label>
                    <button type="button" onClick={() => submitPost(post)} disabled={submitting === post.id || !linkAdded[post.id] || !videoLinks[post.id]?.trim()} className="rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
                      {submitting === post.id ? 'Verifying…' : 'Submit published post'}
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-(--color-border) pt-3 text-xs">
                    <a href={post.videoUrl || undefined} target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-300 underline">View post</a>
                    <span className="text-(--color-muted)">{post.views.toLocaleString()} video views</span>
                    <span className="text-(--color-muted)">{post.clicks.toLocaleString()} link clicks</span>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}