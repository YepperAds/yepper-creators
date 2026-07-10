 'use client';

import { useEffect, useState } from 'react';
import { api, BASE_URL } from '../../_lib/api';
import PageHeader from '@/app/_components/dashboard/PageHeader';

interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string;
  meta?: any;
  is_read: boolean;
  created_at: string;
}

export default function NotificationsPage({ onBack }: { onBack?: () => void } = {}) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit] = useState<number>(10);
  const [offset, setOffset] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(false);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/proxy/api/notifications?limit=${limit}&offset=${offset}`);
      if (res.ok) {
        const payload: any = res.data; // { success, data: [...], meta: { unread } }
        const rows: Notification[] = Array.isArray(payload) ? payload : payload.data ?? [];
        setNotifications((prev) => (offset === 0 ? rows : [...prev, ...rows]));
        setHasMore(rows.length === limit);
      } else {
        console.error('Failed to load notifications', res.error);
        setNotifications([]);
      }
    } catch (err) {
      console.error('Failed to load notifications', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [offset]);

  // Subscribe to SSE stream to refresh list in realtime
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource(`${BASE_URL}/api/notifications/stream`, { withCredentials: true });
      es.addEventListener('unread', () => {
        // Refresh first page whenever unread count changes
        setOffset(0);
      });

      let pollInterval: any = null;
      const startPolling = () => {
        if (pollInterval) return;
        pollInterval = setInterval(() => fetchNotifications(), 15_000);
      };

      es.onerror = (err) => {
        console.warn('Notifications SSE error, falling back to polling', err);
        startPolling();
      };

    } catch (err) {
      console.error('Failed to open notifications SSE', err);
      const poll = setInterval(() => fetchNotifications(), 15_000);
      return () => clearInterval(poll);
    }

    return () => {
      if (es) es.close();
    };
  }, []);

  const markRead = async (id: string) => {
    try {
      const res = await api.post('/api/proxy/api/notifications/mark-read', { id });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      } else {
        console.error('Failed to mark read', res.error);
      }
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const res = await api.delete(`/api/proxy/api/notifications/${id}`);
      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      } else {
        console.error('Failed to delete notification', res.error);
      }
    } catch (err) {
      console.error('Failed to delete notification', err);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PageHeader title="Campaign Updates & Activity" onBack={onBack} />

      <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-8">
        {loading && <div className="text-sm text-(--color-muted) text-center py-8">Loading...</div>}

        {!loading && notifications.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-16">
            <div className="w-24 h-24 rounded-full bg-(--color-surface-2) flex items-center justify-center">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 22c1.1046 0 2-.8954 2-2H10c0 1.1046.8954 2 2 2z" fill="#9CA3AF"/><path d="M18 8a6 6 0 10-12 0v5l-2 2v1h16v-1l-2-2V8z" fill="#9CA3AF"/></svg>
            </div>
            <div className="text-sm text-(--color-muted)">You're all caught up — no notifications yet.</div>
          </div>
        )}

        {/* Full-bleed divided list, no card wrapper — same density as a
            phone notification feed. */}
        <div className="divide-y divide-(--color-border)">
          {notifications.map((n) => (
            <article key={n.id} className="py-4 flex items-center gap-4">
              {/* Avatar circle */}
              <div className="w-10 h-10 rounded-full bg-(--color-surface-2) flex items-center justify-center shrink-0">
                {n.meta?.icon ? (
                  <span className="text-lg">{n.meta.icon}</span>
                ) : n.meta?.provider ? (
                  <span className="text-[10px] font-bold uppercase text-(--color-muted)">{String(n.meta.provider).slice(0, 3)}</span>
                ) : (
                  <span className={`w-2 h-2 rounded-full ${n.is_read ? 'bg-(--color-muted)' : 'bg-(--color-coral)'}`} />
                )}
              </div>

              {/* Two text lines */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-(--color-white) truncate">{n.title}</h3>
                <p className="text-xs text-(--color-muted) truncate">
                  {n.body || new Date(n.created_at).toLocaleString()}
                </p>
              </div>

              {/* Thumbnail-weight action square — both actions stay available,
                  just grouped into one compact cluster instead of spread
                  across the row. */}
              <div className="flex items-center gap-1 rounded-lg bg-(--color-surface-2) p-1 shrink-0">
                {!n.is_read && (
                  <button onClick={() => markRead(n.id)} title="Mark read" className="w-8 h-8 rounded-md flex items-center justify-center text-(--color-muted) hover:text-(--color-white) hover:bg-(--color-surface-3) transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.415l-7.5 7.5a1 1 0 01-1.415 0l-3.5-3.5a1 1 0 111.415-1.414L8.5 12.086l6.79-6.795a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                  </button>
                )}
                <button onClick={() => deleteNotification(n.id)} title="Delete" className="w-8 h-8 rounded-md flex items-center justify-center text-(--color-muted) hover:text-red-500 hover:bg-(--color-surface-3) transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H3a1 1 0 100 2h14a1 1 0 100-2h-2V3a1 1 0 00-1-1H6zm2 6a1 1 0 00-2 0v6a1 1 0 102 0V8zm4 0a1 1 0 10-2 0v6a1 1 0 102 0V8z" clipRule="evenodd"/></svg>
                </button>
              </div>
            </article>
          ))}
        </div>

        <div className="py-6 flex justify-center">
          {hasMore ? (
            <button onClick={() => { setOffset((o) => o + limit); }} className="px-4 py-2 rounded-full bg-(--color-surface-2) text-(--color-white) text-sm font-medium hover:bg-(--color-surface-3) transition-colors">Load more</button>
          ) : (
            notifications.length > 0 && <div className="text-sm text-(--color-muted)">No more notifications</div>
          )}
        </div>
      </div>
    </div>
  );
}
