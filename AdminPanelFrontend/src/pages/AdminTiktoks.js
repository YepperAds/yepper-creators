import React, { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '../utils/adminApi';
import { useAdminAuth } from '../context/AdminAuthContext';

const EMPTY_FORM = {
  channelName: '',
  username: '',
  followers: '0',
  avatarUrl: '',
  featuredVideoUrl: '',
  videoThumbnailUrl: '',
};

const inputStyle = {
  width: '100%',
  padding: '9px 11px',
  border: '1px solid #d5d9e0',
  borderRadius: 6,
  fontSize: 13,
  marginTop: 5,
  boxSizing: 'border-box',
};

const labelStyle = { display: 'block', color: '#555', fontSize: 12, fontWeight: 600 };

export default function AdminTiktoks() {
  const { adminHeaders } = useAdminAuth();
  const [tiktoks, setTiktoks] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async (searchTerm = search, pageNumber = page) => {
    setLoading(true);
    setError('');
    try {
      const response = await adminFetch(
        `/tiktoks?search=${encodeURIComponent(searchTerm)}&page=${pageNumber}&limit=20`,
        {},
        adminHeaders,
      );
      setTiktoks(response.tiktokers || []);
      setTotal(response.total || 0);
    } catch (loadError) {
      setError(loadError.message || 'Could not load TikTok profiles.');
    } finally {
      setLoading(false);
    }
  }, [adminHeaders, page, search]);

  useEffect(() => { load(); }, [load]);

  const addMockTiktok = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await adminFetch('/tiktoks/mocks', {
        method: 'POST',
        body: JSON.stringify(form),
      }, adminHeaders);
      setForm(EMPTY_FORM);
      setFormOpen(false);
      setNotice('Test TikTok enabled. It is now listed in the public TikTok marketplace and uses the follower count you entered for pricing.');
      setPage(1);
      setSearch('');
      await load('', 1);
    } catch (saveError) {
      setError(saveError.message || 'Could not enable the test TikTok.');
    } finally {
      setSaving(false);
    }
  };

  const removeMockTiktok = async (creator) => {
    const name = creator.channelName || creator.name || 'this test profile';
    if (!window.confirm(`Disable and permanently remove "${name}" from the TikTok marketplace?`)) return;
    setDeleting(current => ({ ...current, [creator._id]: true }));
    setError('');
    setNotice('');
    try {
      await adminFetch(`/tiktoks/mocks/${encodeURIComponent(creator._id)}`, {
        method: 'DELETE',
      }, adminHeaders);
      setNotice(`Test TikTok "${name}" has been removed from the marketplace.`);
      await load();
    } catch (deleteError) {
      setError(deleteError.message || `Could not remove "${name}".`);
    } finally {
      setDeleting(current => ({ ...current, [creator._id]: false }));
    }
  };

  const pages = Math.ceil(total / 20);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700 }}>TikToks</h2>
          <p style={{ margin: 0, color: '#888', fontSize: 14 }}>
            {total} connected TikTok profiles. Add test profiles with custom follower counts to check marketplace pricing and booking.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen(open => !open)}
          style={{ padding: '9px 14px', border: '1px solid #111', borderRadius: 6, background: '#111', color: '#fff', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          {formOpen ? 'Cancel' : '+ Enable test TikTok'}
        </button>
      </div>

      {error && <div role="alert" style={{ background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 8, padding: '10px 14px', color: '#c53030', marginBottom: 14, fontSize: 13 }}>{error}</div>}
      {notice && <div role="status" style={{ background: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: 8, padding: '10px 14px', color: '#276749', marginBottom: 14, fontSize: 13 }}>{notice}</div>}

      {formOpen && (
        <form onSubmit={addMockTiktok} style={{ background: '#fff', border: '1px solid #e6eaf0', borderRadius: 10, padding: 18, marginBottom: 18 }}>
          <h3 style={{ margin: '0 0 5px', fontSize: 16 }}>Enable a test TikTok profile</h3>
          <p style={{ margin: '0 0 14px', color: '#888', fontSize: 12 }}>
            Test profiles appear in the same TikTok marketplace as connected creators. Sponsorship packages are enabled for testing.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
            <label style={labelStyle}>Display name
              <input required maxLength={255} value={form.channelName} onChange={event => setForm(current => ({ ...current, channelName: event.target.value }))} style={inputStyle} placeholder="Creator display name" />
            </label>
            <label style={labelStyle}>TikTok username
              <input required maxLength={25} value={form.username} onChange={event => setForm(current => ({ ...current, username: event.target.value }))} style={inputStyle} placeholder="@creator" />
            </label>
            <label style={labelStyle}>Followers
              <input type="number" min="0" max="2147483647" step="1" value={form.followers} onChange={event => setForm(current => ({ ...current, followers: event.target.value }))} style={inputStyle} />
            </label>
            <label style={labelStyle}>Profile image URL (optional)
              <input type="url" value={form.avatarUrl} onChange={event => setForm(current => ({ ...current, avatarUrl: event.target.value }))} style={inputStyle} placeholder="https://…" />
            </label>
            <label style={labelStyle}>Recent TikTok video URL (optional)
              <input type="url" value={form.featuredVideoUrl} onChange={event => setForm(current => ({ ...current, featuredVideoUrl: event.target.value }))} style={inputStyle} placeholder="https://www.tiktok.com/@creator/video/…" />
            </label>
            <label style={labelStyle}>Video thumbnail URL (optional)
              <input type="url" value={form.videoThumbnailUrl} onChange={event => setForm(current => ({ ...current, videoThumbnailUrl: event.target.value }))} style={inputStyle} placeholder="https://…" />
            </label>
          </div>
          <button type="submit" disabled={saving} style={{ marginTop: 14, padding: '9px 14px', border: '1px solid #111', borderRadius: 6, background: '#111', color: '#fff', fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Enabling…' : 'Enable test TikTok'}
          </button>
        </form>
      )}

      <div style={{ marginBottom: 16 }}>
        <input
          style={{ ...inputStyle, maxWidth: 340, marginTop: 0 }}
          placeholder="Search by name, email, or TikTok username…"
          value={search}
          onChange={event => { setSearch(event.target.value); setPage(1); }}
        />
      </div>

      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead style={{ background: '#fafafa' }}>
            <tr>
              {['Name', 'TikTok profile', 'Followers', 'Type', 'Connected', 'Actions'].map(heading => (
                <th key={heading} style={{ textAlign: 'left', padding: '12px 16px', color: '#888', fontWeight: 500, fontSize: 12, borderBottom: '1px solid #f0f0f0' }}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>Loading…</td></tr>
            ) : tiktoks.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>No TikTok profiles found</td></tr>
            ) : tiktoks.map(creator => (
              <tr key={creator._id} style={{ borderBottom: '1px solid #f7f7f7' }}>
                <td style={{ padding: '12px 16px', fontWeight: 500 }}>{creator.name}</td>
                <td style={{ padding: '12px 16px' }}>
                  {creator.channelUrl
                    ? <a href={creator.channelUrl} target="_blank" rel="noreferrer" style={{ color: '#555' }}>@{creator.channelName}</a>
                    : `@${creator.channelName || '—'}`}
                </td>
                <td style={{ padding: '12px 16px', color: '#666' }}>{Number(creator.followers || 0).toLocaleString()}</td>
                <td style={{ padding: '12px 16px' }}>
                  {creator.isMock
                    ? <span style={{ padding: '2px 6px', borderRadius: 999, background: '#fff4d6', color: '#8a5a00', fontSize: 10, fontWeight: 700 }}>TEST</span>
                    : <span style={{ color: '#777' }}>Connected</span>}
                </td>
                <td style={{ padding: '12px 16px', color: '#aaa', fontSize: 13 }}>
                  {creator.connectedAt ? new Date(creator.connectedAt).toLocaleDateString() : '—'}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  {creator.isMock
                    ? <button type="button" onClick={() => removeMockTiktok(creator)} disabled={Boolean(deleting[creator._id])} style={{ padding: '5px 9px', border: '1px solid #f3c7c4', borderRadius: 6, background: '#fff', color: '#b42318', cursor: deleting[creator._id] ? 'wait' : 'pointer' }}>
                      {deleting[creator._id] ? 'Removing…' : 'Disable test profile'}
                    </button>
                    : <span style={{ color: '#aaa' }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pages > 1 && (
          <div style={{ display: 'flex', gap: 8, padding: 16, justifyContent: 'center', borderTop: '1px solid #f0f0f0' }}>
            <button type="button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1}>← Prev</button>
            <span style={{ padding: '6px 12px', fontSize: 13, color: '#666' }}>{page} / {pages}</span>
            <button type="button" onClick={() => setPage(current => Math.min(pages, current + 1))} disabled={page === pages}>Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}
