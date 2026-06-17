'use client';
import { useEffect } from 'react';

export default function BackendWarmup() {
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_API_URL;
    if (!url || url.includes('localhost')) return;
    fetch(`${url}/health`, { method: 'GET', cache: 'no-store' }).catch(() => {});
  }, []);
  return null;
}
