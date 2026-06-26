// admin/pages/AdminDashboard.js
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { adminFetch } from '../utils/adminApi';

const StatCard = ({ label, value, sub, color = '#111', link }) => (
  <div style={{ background: '#fff', borderRadius: 12, padding: '24px 28px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', flex: 1, minWidth: 160 }}>
    <div style={{ fontSize: 13, color: '#888', marginBottom: 8, fontWeight: 500 }}>{label}</div>
    <div style={{ fontSize: 36, fontWeight: 700, color, letterSpacing: -1 }}>{value ?? '—'}</div>
    {sub && <div style={{ fontSize: 12, color: '#aaa', marginTop: 6 }}>{sub}</div>}
    {link && <Link to={link} style={{ display: 'inline-block', marginTop: 12, fontSize: 12, color: '#555', textDecoration: 'none', fontWeight: 500 }}>View all →</Link>}
  </div>
);

const RESET_PHRASE = 'RESET EVERYTHING';

export default function AdminDashboard() {
  const { adminHeaders } = useAdminAuth();
  const [stats, setStats]   = useState(null);
  const [error, setError]   = useState('');
  const [grants, setGrants] = useState([]);

  const [resetOpen, setResetOpen]       = useState(false);
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetting, setResetting]       = useState(false);
  const [resetResult, setResetResult]   = useState('');
  const [resetError, setResetError]     = useState('');

  useEffect(() => {
    adminFetch('/stats', {}, adminHeaders).then(d => setStats(d.stats)).catch(e => setError(e.message));
    adminFetch('/grants?limit=5&status=pending', {}, adminHeaders).then(d => setGrants(d.grants || [])).catch(() => {});
  }, []);

  const handleResetDatabase = async () => {
    if (resetConfirm !== RESET_PHRASE) return;
    setResetting(true);
    setResetError('');
    setResetResult('');
    try {
      const data = await adminFetch('/reset-database', { method: 'POST', body: JSON.stringify({ confirm: resetConfirm }) }, adminHeaders);
      setResetResult(data.message || 'Database wiped.');
      setResetOpen(false);
      setResetConfirm('');
    } catch (e) {
      setResetError(e.message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div>
      <h2 style={{ margin: '0 0 6px 0', fontSize: 26, fontWeight: 700, color: '#111' }}>Dashboard</h2>
      <p style={{ margin: '0 0 28px 0', color: '#888', fontSize: 14 }}>Overview of your Yepper platform</p>

      {error && <div style={{ background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 8, padding: '12px 16px', color: '#c53030', marginBottom: 20, fontSize: 14 }}>{error}</div>}

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
        <StatCard label="Total Users"     value={stats?.totalUsers}      sub={`+${stats?.newUsers7d ?? '—'} last 7 days`} link="/users" />
        <StatCard label="Total Websites"  value={stats?.totalWebsites}   link="/users" />
        <StatCard label="Pending Grants"  value={stats?.pendingGrants}   color="#d69e2e" link="/grants" />
        <StatCard label="Completed Grants" value={stats?.completedGrants} color="#38a169" link="/grants" />
      </div>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 32 }}>
        <QuickCard
          title="Grant Traffic/Views"
          desc="Select a user and give them access to set their own analytics numbers."
          icon="🎁"
          action={<Link to="/users" style={btnStyle('#111','#fff')}>Browse Users →</Link>}
        />
        <QuickCard
          title="View All Grants"
          desc="See pending, completed, and revoked grants across all users."
          icon="📋"
          action={<Link to="/grants" style={btnStyle('#f0f0f0','#111')}>View Grants →</Link>}
        />
      </div>

      {/* Recent pending grants */}
      {grants.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, padding: '24px 28px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Pending Grants</h3>
            <Link to="/grants" style={{ fontSize: 13, color: '#555', textDecoration: 'none' }}>View all →</Link>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                {['User','Email','Website','Granted by','Expires'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 0', color: '#888', fontWeight: 500, fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grants.map(g => (
                <tr key={g._id} style={{ borderBottom: '1px solid #fafafa' }}>
                  <td style={{ padding: '10px 0' }}>{g.userId?.name || '—'}</td>
                  <td style={{ padding: '10px 0', color: '#666' }}>{g.userId?.email || '—'}</td>
                  <td style={{ padding: '10px 0', color: '#666' }}>{g.websiteId?.websiteName || <em style={{ color: '#bbb' }}>Any</em>}</td>
                  <td style={{ padding: '10px 0', color: '#888' }}>{g.grantedBy}</td>
                  <td style={{ padding: '10px 0', color: '#888' }}>{new Date(g.expiresAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Danger Zone */}
      <div style={{ background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 12, padding: '24px 28px', marginTop: 32 }}>
        <h3 style={{ margin: '0 0 6px 0', fontSize: 16, fontWeight: 600, color: '#c53030' }}>⚠ Danger Zone</h3>
        <p style={{ margin: '0 0 16px 0', color: '#742a2a', fontSize: 13, lineHeight: 1.6 }}>
          Wipes every row in every table — creators, websites, ad spaces, grants, pricing, everything.
          Irreversible. You will be logged out of every account, including your own creator login.
        </p>

        {resetResult && <div style={{ background: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: 8, padding: '10px 14px', color: '#276749', fontSize: 13, marginBottom: 12 }}>{resetResult}</div>}
        {resetError && <div style={{ background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 8, padding: '10px 14px', color: '#c53030', fontSize: 13, marginBottom: 12 }}>{resetError}</div>}

        {!resetOpen ? (
          <button onClick={() => setResetOpen(true)} style={{ ...btnStyle('#c53030', '#fff'), border: 'none', cursor: 'pointer' }}>
            Reset entire database…
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 420 }}>
            <label style={{ fontSize: 12, color: '#742a2a' }}>
              Type <strong>{RESET_PHRASE}</strong> to confirm:
            </label>
            <input
              value={resetConfirm}
              onChange={e => setResetConfirm(e.target.value)}
              placeholder={RESET_PHRASE}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #feb2b2', fontSize: 14 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleResetDatabase}
                disabled={resetConfirm !== RESET_PHRASE || resetting}
                style={{ ...btnStyle('#c53030', '#fff'), border: 'none', cursor: resetConfirm === RESET_PHRASE ? 'pointer' : 'not-allowed', opacity: resetConfirm === RESET_PHRASE ? 1 : 0.5 }}
              >
                {resetting ? 'Wiping…' : 'Confirm — wipe everything'}
              </button>
              <button
                onClick={() => { setResetOpen(false); setResetConfirm(''); }}
                disabled={resetting}
                style={{ ...btnStyle('#f0f0f0', '#111'), border: 'none', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const QuickCard = ({ title, desc, icon, action }) => (
  <div style={{ background: '#fff', borderRadius: 12, padding: '24px 28px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
    <div style={{ fontSize: 28, marginBottom: 12 }}>{icon}</div>
    <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8, color: '#111' }}>{title}</div>
    <div style={{ color: '#888', fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>{desc}</div>
    {action}
  </div>
);

const btnStyle = (bg, color) => ({
  display: 'inline-block', background: bg, color, padding: '10px 20px',
  borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 13,
});
