// admin/pages/AdminGrants.js
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { adminFetch } from '../utils/adminApi';

const STATUS_COLORS = {
  pending:   { bg: '#fffbeb', color: '#92400e' },
  completed: { bg: '#f0fff4', color: '#276749' },
  expired:   { bg: '#f7fafc', color: '#718096' },
  revoked:   { bg: '#fff5f5', color: '#c53030' },
};

export default function AdminGrants() {
  const { adminHeaders } = useAdminAuth();
  const [grants,  setGrants]  = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('');
  const [page,    setPage]    = useState(1);
  const [toast,   setToast]   = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await adminFetch(`/grants?page=${page}&limit=25${filter ? `&status=${filter}` : ''}`, {}, adminHeaders);
      setGrants(d.grants);
      setTotal(d.total);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, filter, adminHeaders]);

  useEffect(() => { load(); }, [load]);

  const handleRevoke = async (grantId) => {
    if (!window.confirm('Revoke this grant?')) return;
    try {
      await adminFetch(`/grants/${grantId}`, { method: 'DELETE' }, adminHeaders);
      showToast('Grant revoked.');
      load();
    } catch (e) { showToast('Error: ' + e.message); }
  };

  const handleResend = async (grantId) => {
    try {
      await adminFetch(`/grants/${grantId}/resend-email`, { method: 'POST' }, adminHeaders);
      showToast('Email resent!');
    } catch (e) { showToast('Error: ' + e.message); }
  };

  const pages = Math.ceil(total / 25);

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: '#111', color: '#fff', padding: '12px 20px', borderRadius: 8, fontSize: 14, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: 24, fontWeight: 700 }}>Grants</h2>
          <p style={{ margin: 0, color: '#888', fontSize: 14 }}>{total} total grants</p>
        </div>
        <Link to="/users" style={{ background: '#111', color: '#fff', padding: '10px 20px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
          + Create Grant
        </Link>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['', 'pending', 'completed', 'expired', 'revoked'].map(s => (
          <button
            key={s}
            onClick={() => { setFilter(s); setPage(1); }}
            style={{
              background: filter === s ? '#111' : '#fff',
              color: filter === s ? '#fff' : '#666',
              border: '1px solid ' + (filter === s ? '#111' : '#e2e8f0'),
              padding: '6px 16px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: filter === s ? 600 : 400,
            }}>
            {s || 'All'}
          </button>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead style={{ background: '#fafafa' }}>
            <tr>
              {['User','Email','Website','Status','Traffic','Views','Email sent','Expires','Actions'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '12px 14px', color: '#888', fontWeight: 500, fontSize: 12, borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>Loading…</td></tr>
            ) : grants.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>No grants found.</td></tr>
            ) : grants.map(g => {
              const sc = STATUS_COLORS[g.status] || STATUS_COLORS.expired;
              return (
                <tr key={g._id} style={{ borderBottom: '1px solid #f7f7f7' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 500 }}>
                    <Link to={`/users/${g.userId?._id}`} style={{ color: '#111', textDecoration: 'none' }}>{g.userId?.name || '—'}</Link>
                  </td>
                  <td style={{ padding: '10px 14px', color: '#666', fontSize: 13 }}>{g.userId?.email || '—'}</td>
                  <td style={{ padding: '10px 14px', color: '#888', fontSize: 13 }}>{g.websiteId?.websiteName || <em style={{ color: '#ccc' }}>Any</em>}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ background: sc.bg, color: sc.color, padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, textTransform: 'capitalize' }}>{g.status}</span>
                  </td>
                  <td style={{ padding: '10px 14px', color: '#666' }}>{g.grantedTraffic?.toLocaleString() ?? '—'}</td>
                  <td style={{ padding: '10px 14px', color: '#666' }}>{g.grantedViews?.toLocaleString() ?? '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ color: g.emailSent ? '#38a169' : '#e53e3e', fontSize: 12, fontWeight: 500 }}>{g.emailSent ? '✓ Sent' : '✗ No'}</span>
                  </td>
                  <td style={{ padding: '10px 14px', color: '#aaa', fontSize: 12 }}>{new Date(g.expiresAt).toLocaleDateString()}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {g.status === 'pending' && (
                        <>
                          <button onClick={() => handleResend(g._id)} style={smallBtn}>📧 Resend</button>
                          <button onClick={() => handleRevoke(g._id)} style={{ ...smallBtn, color: '#e53e3e', borderColor: '#feb2b2' }}>Revoke</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {pages > 1 && (
          <div style={{ display: 'flex', gap: 8, padding: 16, justifyContent: 'center', borderTop: '1px solid #f0f0f0' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pageBtn}>← Prev</button>
            <span style={{ padding: '6px 12px', fontSize: 13, color: '#666' }}>{page} / {pages}</span>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} style={pageBtn}>Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}

const smallBtn = { fontSize: 12, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: '#444', whiteSpace: 'nowrap' };
const pageBtn  = { background: '#f4f5f7', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13 };
