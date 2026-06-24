// admin/pages/AdminUsers.js
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { adminFetch } from '../utils/adminApi';
import GrantModal from '../components/GrantModal';

const BADGE = {
  pending:   { bg: '#fffbeb', color: '#92400e', label: 'Grant pending' },
  completed: { bg: '#f0fff4', color: '#276749', label: 'Grant used' },
};

export default function AdminUsers() {
  const { adminHeaders } = useAdminAuth();
  const [users,   setUsers]   = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [page,    setPage]    = useState(1);
  const [grantTarget, setGrantTarget] = useState(null); // {user, website}

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await adminFetch(`/users?search=${encodeURIComponent(search)}&page=${page}&limit=20`, {}, adminHeaders);
      setUsers(d.users);
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
          <h2 style={{ margin: '0 0 4px 0', fontSize: 24, fontWeight: 700 }}>Users</h2>
          <p style={{ margin: 0, color: '#888', fontSize: 14 }}>{total} total users</p>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input
          style={{ ...inputStyle, maxWidth: 340 }}
          placeholder="Search by name or email…"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
        />
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead style={{ background: '#fafafa' }}>
            <tr>
              {['Name','Email','Websites','Status','Verified','Joined','Actions'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '12px 16px', color: '#888', fontWeight: 500, fontSize: 12, borderBottom: '1px solid #f0f0f0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>Loading…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>No users found</td></tr>
            ) : users.map(u => {
              const badge = u.grantStatus ? BADGE[u.grantStatus] : null;
              return (
                <tr key={u._id} style={{ borderBottom: '1px solid #f7f7f7' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                    <Link to={`/users/${u._id}`} style={{ color: '#111', textDecoration: 'none' }}>{u.name}</Link>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#666' }}>{u.email}</td>
                  <td style={{ padding: '12px 16px', color: '#888' }}>{u.websiteCount}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {badge
                      ? <span style={{ background: badge.bg, color: badge.color, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{badge.label}</span>
                      : <span style={{ color: '#ccc', fontSize: 12 }}>—</span>
                    }
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ color: u.isVerified ? '#38a169' : '#e53e3e', fontSize: 12, fontWeight: 500 }}>
                      {u.isVerified ? '✓ Yes' : '✗ No'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#aaa', fontSize: 13 }}>
                    {new Date(u.createdAt).toLocaleDateString()}
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
                      <button
                        onClick={() => setGrantTarget({ user: u })}
                        style={{ fontSize: 12, color: '#fff', background: '#111', border: 'none', padding: '4px 10px', borderRadius: 6, cursor: 'pointer' }}>
                        🎁 Grant
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
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

      {/* Grant modal */}
      {grantTarget && (
        <GrantModal
          user={grantTarget.user}
          onClose={() => setGrantTarget(null)}
          onSuccess={() => { setGrantTarget(null); load(); }}
        />
      )}
    </div>
  );
}

const inputStyle = { display: 'block', border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '9px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' };
const pageBtn = { background: '#f4f5f7', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13 };
