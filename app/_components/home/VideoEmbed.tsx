'use client';

import { useEffect, useRef, useState } from 'react';
import { PlayIcon } from '@heroicons/react/24/solid';
import { getYouTubeVideoId } from '@/app/_lib/youtube';

// Loops the first ~6s of the video, muted, while the card is on screen.
// Only mounts the actual iframe once in view — with dozens of these in a
// continuously-growing feed, autoplaying every embed at once would be a
// real bandwidth/CPU hit, so off-screen cards just show a static thumbnail.
const LOOP_SECONDS = 6;

export default function VideoEmbed({ url, thumbnail, title }: { url: string | null; thumbnail: string | null; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const videoId = getYouTubeVideoId(url);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!videoId) {
    return (
      <div ref={ref} className="relative w-full h-full bg-background flex items-center justify-center text-muted text-[10px]">
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnail} alt={title} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          'No preview'
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative w-full h-full bg-background">
      {inView ? (
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&start=0&end=${LOOP_SECONDS}&loop=1&playlist=${videoId}&playsinline=1&modestbranding=1&rel=0`}
          title={title}
          className="absolute inset-0 w-full h-full"
          allow="autoplay; encrypted-media"
          frameBorder="0"
        />
      ) : thumbnail ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumbnail} alt={title} className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <PlayIcon className="w-8 h-8 text-[#fff]/90" />
          </div>
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-muted text-[10px]">No preview</div>
      )}
    </div>
  );
}
