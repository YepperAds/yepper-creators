// admin/components/GrantModal.js
import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { adminFetch } from '../utils/adminApi';

export default function GrantModal({ user, websites: propWebsites, onClose, onSuccess }) {
  const { adminHeaders } = useAdminAuth();
  const [websites,  setWebsites]  = useState(propWebsites || []);
  const [websiteId, setWebsiteId] = useState('');
  const [expiryDays, setExpiryDays] = useState(7);
  const [notes,     setNotes]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState(null);  // success state
  const [error,     setError]     = useState('');

  // Load websites for this user if not already passed in
  useEffect(() => {
    if (!propWebsites) {
      adminFetch(`/users/${user._id}`, {}, adminHeaders)
        .then(d => setWebsites(d.websites || []))
        .catch(() => {});
    }
  }, [user._id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const body = JSON.stringify({
        userId: user._id,
        websiteId: websiteId || undefined,
        notes,
        expiryDays: parseInt(expiryDays),
      });
      const d = await adminFetch('/grants', { method: 'POST', body }, adminHeaders);
      setResult(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>🎁 Grant Traffic/Views</h3>
            <p style={{ margin: '4px 0 0 0', color: '#888', fontSize: 13 }}>for <strong>{user.name}</strong> ({user.email})</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#aaa' }}>✕</button>
        </div>

        {result ? (
          /* Success state */
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>{result.emailSent ? '✉️' : '✓'}</div>
            <h4 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 600 }}>Grant Created!</h4>
            <p style={{ color: '#666', fontSize: 14, lineHeight: 1.6, margin: '0 0 24px 0' }}>
              {result.emailSent
                ? `An email has been sent to ${user.email} with a personalized link to set their analytics numbers.`
                : `Grant created. Note: email could not be sent — you can resend from the Grants page.`
              }
            </p>
            <p style={{ color: '#888', fontSize: 12, margin: '0 0 24px 0' }}>
              The user will also see a "Set Analytics" button on their website dashboard.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={onSuccess} style={btn('#111', '#fff')}>Done</button>
              <button onClick={() => { setResult(null); setWebsiteId(''); setNotes(''); }} style={btn('#f4f5f7', '#333')}>Create another</button>
            </div>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit}>
            {/* Website selector */}
            <div style={{ marginBottom: 18 }}>
              <label style={label}>Website (optional)</label>
              <select
                value={websiteId}
                onChange={e => setWebsiteId(e.target.value)}
                style={select}
              >
                <option value="">— Any of their websites —</option>
                {websites.map(w => (
                  <option key={w._id} value={w._id}>{w.websiteName} ({w.websiteLink})</option>
                ))}
              </select>
              <p style={{ color: '#aaa', fontSize: 12, margin: '6px 0 0 0' }}>
                If blank, the user can set numbers for any of their websites.
              </p>
            </div>

            {/* Expiry */}
            <div style={{ marginBottom: 18 }}>
              <label style={label}>Link expires in</label>
              <select value={expiryDays} onChange={e => setExpiryDays(e.target.value)} style={select}>
                <option value={3}>3 days</option>
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
              </select>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 22 }}>
              <label style={label}>Internal notes (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="e.g. Promised during onboarding call"
                style={{ ...select, resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            {/* Info box */}
            <div style={{ background: '#fffbeb', borderRadius: 8, padding: '12px 16px', marginBottom: 22, fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>
              <strong>What this does:</strong> Creates a one-time secure link that only this user can use.
              They'll receive an email and see a button on their dashboard. When they click it, they'll be
              able to enter their desired traffic &amp; views numbers — which will show in their analytics.
              The link is tied to their account and cannot be shared or reused.
            </div>

            {error && <p style={{ color: '#e53e3e', fontSize: 13, marginBottom: 16 }}>{error}</p>}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={onClose} style={btn('#f4f5f7', '#333')}>Cancel</button>
              <button type="submit" disabled={loading} style={{ ...btn('#111', '#fff'), opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Creating…' : '✉️ Create & Send Email'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
};
const modal = {
  background: '#fff', borderRadius: 14, padding: 32, width: '100%', maxWidth: 520,
  boxShadow: '0 20px 60px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto',
};
const label  = { display: 'block', fontSize: 13, fontWeight: 500, color: '#444', marginBottom: 6 };
const select = { display: 'block', width: '100%', boxSizing: 'border-box', border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '9px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff' };
const btn    = (bg, color) => ({ background: bg, color, border: 'none', borderRadius: 8, padding: '10px 22px', cursor: 'pointer', fontWeight: 600, fontSize: 14, fontFamily: 'inherit' });
