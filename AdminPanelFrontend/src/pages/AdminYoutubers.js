// admin/pages/AdminYoutubers.js
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { adminFetch } from '../utils/adminApi';

export default function AdminYoutubers() {
  const { adminHeaders } = useAdminAuth();
  const [youtubers, setYoutubers] = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [page,    setPage]    = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await adminFetch(`/youtubers?search=${encodeURIComponent(search)}&page=${page}&limit=20`, {}, adminHeaders);
      setYoutubers(d.youtubers);
      setTotal(d.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, page, adminHeaders]);

  useEffect(() => { load(); }, [load]);

  // Debounce search
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const pages = Math.ceil(total / 20);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: 24, fontWeight: 700 }}>Youtubers</h2>
          <p style={{ margin: 0, color: '#888', fontSize: 14 }}>{total} connected YouTube channels</p>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input
          style={{ ...inputStyle, maxWidth: 340 }}
          placeholder="Search by name, email, or channel…"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
        />
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead style={{ background: '#fafafa' }}>
            <tr>
              {['Name','Email','Channel','Subscribers','Total Views','Connected','Actions'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '12px 16px', color: '#888', fontWeight: 500, fontSize: 12, borderBottom: '1px solid #f0f0f0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>Loading…</td></tr>
            ) : youtubers.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>No youtubers found</td></tr>
            ) : youtubers.map(u => (
              <tr key={u._id} style={{ borderBottom: '1px solid #f7f7f7' }}>
                <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                  <Link to={`/users/${u._id}`} style={{ color: '#111', textDecoration: 'none' }}>{u.name}</Link>
                </td>
                <td style={{ padding: '12px 16px', color: '#666' }}>{u.email}</td>
                <td style={{ padding: '12px 16px', color: '#888' }}>
                  {u.channelUrl
                    ? <a href={u.channelUrl} target="_blank" rel="noreferrer" style={{ color: '#555' }}>{u.channelName || u.channelUrl}</a>
                    : (u.channelName || '—')}
                </td>
                <td style={{ padding: '12px 16px', color: '#888' }}>{u.subscribers ?? 0}</td>
                <td style={{ padding: '12px 16px', color: '#888' }}>{u.totalViews ?? 0}</td>
                <td style={{ padding: '12px 16px', color: '#aaa', fontSize: 13 }}>
                  {u.connectedAt ? new Date(u.connectedAt).toLocaleDateString() : '—'}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Link to={`/users/${u._id}`}
                      style={{ fontSize: 12, color: '#555', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: 6, textDecoration: 'none' }}>
                      Details
                    </Link>
                    <Link to={`/users/${u._id}/content`}
                      style={{ fontSize: 12, color: '#555', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: 6, textDecoration: 'none' }}>
                      📦 Content
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ display: 'flex', gap: 8, padding: '16px', justifyContent: 'center', borderTop: '1px solid #f0f0f0' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pageBtn}>← Prev</button>
            <span style={{ padding: '6px 12px', fontSize: 13, color: '#666' }}>{page} / {pages}</span>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} style={pageBtn}>Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle = { display: 'block', border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '9px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' };
const pageBtn = { background: '#f4f5f7', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13 };
