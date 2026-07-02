 'use client';

import { useEffect, useState } from 'react';
import { api, BASE_URL } from '../../_lib/api';

interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string;
  meta?: any;
  is_read: boolean;
  created_at: string;
}

export default function NotificationsPage() {
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
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="text-sm text-(--color-muted)">All system and account activity will appear here in real time.</p>
      </div>

      {loading && <div className="text-sm text-(--color-muted)">Loading...</div>}

      {!loading && notifications.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-16">
          <div className="w-24 h-24 rounded-full bg-(--color-surface-2) flex items-center justify-center">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 22c1.1046 0 2-.8954 2-2H10c0 1.1046.8954 2 2 2z" fill="#9CA3AF"/><path d="M18 8a6 6 0 10-12 0v5l-2 2v1h16v-1l-2-2V8z" fill="#9CA3AF"/></svg>
          </div>
          <div className="text-sm text-(--color-muted)">You're all caught up — no notifications yet.</div>
        </div>
      )}

      <div className="space-y-4">
        {notifications.map((n) => (
          <article key={n.id} className={`p-4 rounded-xl border flex items-start justify-between ${n.is_read ? 'bg-(--color-surface-2) border-transparent' : 'bg-(--color-surface-1) border-(--color-border)'} `}>
            <div className="flex items-start gap-4">
              <div className={`w-3 h-3 rounded-full mt-1 ${n.is_read ? 'bg-(--color-muted)' : 'bg-amber-400'}`} />
              <div>
                <div className="flex items-center gap-2">
                  {n.meta?.icon ? (
                    <span className="text-lg">{n.meta.icon}</span>
                  ) : n.meta?.provider ? (
                    <span className="text-sm font-semibold uppercase text-(--color-muted)">{String(n.meta.provider).slice(0,3)}</span>
                  ) : null}
                  <h3 className="text-sm font-semibold">{n.title}</h3>
                </div>
                {n.body && <p className="mt-1 text-sm text-(--color-muted)">{n.body}</p>}
                <div className="mt-2 text-[11px] text-(--color-muted)">{new Date(n.created_at).toLocaleString()}</div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              {!n.is_read ? (
                <button onClick={() => markRead(n.id)} className="px-3 py-1 rounded bg-emerald-500 text-white text-sm">Mark read</button>
              ) : (
                <div className="text-sm text-(--color-muted)">Read</div>
              )}
              <button onClick={() => deleteNotification(n.id)} title="Delete" className="text-(--color-muted) hover:text-red-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H3a1 1 0 100 2h14a1 1 0 100-2h-2V3a1 1 0 00-1-1H6zm2 6a1 1 0 00-2 0v6a1 1 0 102 0V8zm4 0a1 1 0 10-2 0v6a1 1 0 102 0V8z" clipRule="evenodd"/></svg>
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-6 flex justify-center">
        {hasMore ? (
          <button onClick={() => { setOffset((o) => o + limit); }} className="px-4 py-2 rounded bg-(--color-surface-2)">Load more</button>
        ) : (
          notifications.length > 0 && <div className="text-sm text-(--color-muted)">No more notifications</div>
        )}
      </div>
    </div>
  );
}
