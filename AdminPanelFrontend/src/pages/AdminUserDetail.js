// admin/pages/AdminUserDetail.js
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { adminFetch } from '../utils/adminApi';
import GrantModal from '../components/GrantModal';

const STATUS_COLORS = {
  pending:   { bg: '#fffbeb', color: '#92400e' },
  completed: { bg: '#f0fff4', color: '#276749' },
  expired:   { bg: '#f7fafc', color: '#718096' },
  revoked:   { bg: '#fff5f5', color: '#c53030' },
};

export default function AdminUserDetail() {
  const { userId } = useParams();
  const { adminHeaders } = useAdminAuth();
  const navigate = useNavigate();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [grantTarget, setGrantTarget] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const d = await adminFetch(`/users/${userId}`, {}, adminHeaders);
      setData(d);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [userId]);

  if (loading) return <div style={{ color: '#888', padding: 40 }}>Loading…</div>;
  if (!data)   return <div style={{ color: '#e53e3e', padding: 40 }}>Failed to load user.</div>;

  const { user, websites, grants } = data;

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 20, fontSize: 13 }}>
        <Link to="/users" style={{ color: '#888', textDecoration: 'none' }}>← Users</Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: 24, fontWeight: 700 }}>{user.name}</h2>
          <p style={{ margin: 0, color: '#888', fontSize: 14 }}>{user.email} · Joined {new Date(user.createdAt).toLocaleDateString()}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => navigate(`/users/${userId}/content`)}
            style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0', padding: '10px 22px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            📦 View Content
          </button>
          <button
            onClick={() => setGrantTarget({ user })}
            style={{ background: '#111', color: '#fff', border: 'none', padding: '10px 22px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            🎁 Grant Traffic/Views
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* User info card */}
        <Section title="Account Info">
          <Row label="Verified" value={user.isVerified ? '✓ Yes' : '✗ No'} color={user.isVerified ? '#38a169' : '#e53e3e'} />
          <Row label="Google ID" value={user.googleId ? 'Connected' : 'Not connected'} />
          <Row label="Updated" value={new Date(user.updatedAt).toLocaleString()} />
        </Section>

        {/* Websites */}
        <Section title={`Websites (${websites.length})`}>
          {websites.length === 0
            ? <p style={{ color: '#aaa', margin: 0, fontSize: 13 }}>No websites yet.</p>
            : websites.map(w => (
              <div key={w._id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #f5f5f5' }}>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{w.websiteName}</div>
                <div style={{ color: '#888', fontSize: 12 }}>{w.websiteLink}</div>
                <div style={{ marginTop: 4, display: 'flex', gap: 10, fontSize: 12, color: '#aaa' }}>
                  <span>Traffic: <strong style={{ color: '#555' }}>{(w.monthlyTraffic || 0).toLocaleString()}/mo</strong></span>
                  <span>Tier: <strong style={{ color: '#555', textTransform: 'capitalize' }}>{w.trafficTier}</strong></span>
                </div>
              </div>
            ))
          }
        </Section>
      </div>

      {/* Grants history */}
      <Section title={`Grant History (${grants.length})`}>
        {grants.length === 0
          ? <p style={{ color: '#aaa', margin: 0, fontSize: 13 }}>No grants have been created for this user.</p>
          : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                  {['Website','Status','Traffic Set','Views Set','Granted by','Created','Expires'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 0', color: '#aaa', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grants.map(g => {
                  const sc = STATUS_COLORS[g.status] || STATUS_COLORS.expired;
                  return (
                    <tr key={g._id} style={{ borderBottom: '1px solid #fafafa' }}>
                      <td style={{ padding: '10px 0' }}>{g.websiteId?.websiteName || <em style={{ color: '#ccc' }}>Any</em>}</td>
                      <td style={{ padding: '10px 0' }}>
                        <span style={{ background: sc.bg, color: sc.color, padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, textTransform: 'capitalize' }}>{g.status}</span>
                      </td>
                      <td style={{ padding: '10px 0', color: '#666' }}>{g.grantedTraffic?.toLocaleString() || '—'}</td>
                      <td style={{ padding: '10px 0', color: '#666' }}>{g.grantedViews?.toLocaleString() || '—'}</td>
                      <td style={{ padding: '10px 0', color: '#888' }}>{g.grantedBy}</td>
                      <td style={{ padding: '10px 0', color: '#aaa' }}>{new Date(g.createdAt).toLocaleDateString()}</td>
                      <td style={{ padding: '10px 0', color: '#aaa' }}>{new Date(g.expiresAt).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        }
      </Section>

      {grantTarget && (
        <GrantModal
          user={user}
          websites={websites}
          onClose={() => setGrantTarget(null)}
          onSuccess={() => { setGrantTarget(null); load(); }}
        />
      )}
    </div>
  );
}

const Section = ({ title, children }) => (
  <div style={{ background: '#fff', borderRadius: 12, padding: '22px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 20 }}>
    <h3 style={{ margin: '0 0 16px 0', fontSize: 15, fontWeight: 600, color: '#111' }}>{title}</h3>
    {children}
  </div>
);

const Row = ({ label, value, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f7f7f7', fontSize: 13 }}>
    <span style={{ color: '#888' }}>{label}</span>
    <span style={{ color: color || '#333', fontWeight: 500 }}>{value ?? '—'}</span>
  </div>
);
