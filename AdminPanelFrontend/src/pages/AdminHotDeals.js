// admin/pages/AdminHotDeals.js
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { adminFetch } from '../utils/adminApi';

const fmt = (n) => Number(n || 0).toLocaleString('en-US');

const STATUS_STYLE = {
  draft:    { bg: '#f1f1f3', color: '#666' },
  active:   { bg: '#dcfce7', color: '#166534' },
  archived: { bg: '#f1f1f3', color: '#999' },
};

export default function AdminHotDeals() {
  const { adminHeaders } = useAdminAuth();
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [emailTarget, setEmailTarget] = useState(null); // deal currently in the "send email" modal

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await adminFetch('/hot-deals', {}, adminHeaders);
      setDeals(d.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [adminHeaders]);

  useEffect(() => { load(); }, [load]);

  const remove = async (deal) => {
    if (!window.confirm(`Delete "${deal.title}"? This can't be undone.`)) return;
    try {
      await adminFetch(`/hot-deals/${deal.id}`, { method: 'DELETE' }, adminHeaders);
      load();
    } catch (e) {
      window.alert(e.message);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: 24, fontWeight: 700 }}>Hot Deals</h2>
          <p style={{ margin: 0, color: '#888', fontSize: 14 }}>
            Bundle YouTube channels and websites into one fixed-price package, shown to every visitor as trending.
          </p>
        </div>
        <Link to="/hot-deals/new" style={{ ...btnPrimary, textDecoration: 'none' }}>+ New Hot Deal</Link>
      </div>

      {error && <div style={{ color: '#b91c1c', marginBottom: 16, fontSize: 13 }}>Error: {error}</div>}

      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead style={{ background: '#fafafa' }}>
            <tr>
              {['Title', 'Category', 'Items', 'Total Price', 'Status', 'Sold', 'Actions'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '12px 16px', color: '#888', fontWeight: 500, fontSize: 12, borderBottom: '1px solid #f0f0f0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>Loading…</td></tr>
            ) : deals.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>No Hot Deals yet</td></tr>
            ) : deals.map((d) => {
              const style = STATUS_STYLE[d.status] || STATUS_STYLE.draft;
              return (
                <tr key={d.id} style={{ borderBottom: '1px solid #f7f7f7' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                    <Link to={`/hot-deals/${d.id}`} style={{ color: '#111', textDecoration: 'none' }}>{d.title}</Link>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#666' }}>{d.businessCategory}</td>
                  <td style={{ padding: '12px 16px', color: '#888' }}>{d.itemCount}</td>
                  <td style={{ padding: '12px 16px', color: '#111', fontWeight: 600 }}>{fmt(d.totalPrice)} RWF</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: style.bg, color: style.color, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>{d.status}</span>
                  </td>
                  <td style={{ padding: '12px 16px', color: d.soldAt ? '#166534' : '#aaa', fontSize: 13 }}>
                    {d.soldAt ? new Date(d.soldAt).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Link to={`/hot-deals/${d.id}`} style={{ fontSize: 12, color: '#555', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: 6, textDecoration: 'none' }}>
                        {d.soldAt ? 'View' : 'Edit'}
                      </Link>
                      {!d.soldAt && (
                        <button onClick={() => setEmailTarget(d)} style={{ fontSize: 12, color: '#1d4ed8', border: '1px solid #bfdbfe', background: '#fff', padding: '4px 10px', borderRadius: 6, cursor: 'pointer' }}>
                          Send Email
                        </button>
                      )}
                      {!d.soldAt && (
                        <button onClick={() => remove(d)} style={{ fontSize: 12, color: '#b91c1c', border: '1px solid #fecaca', background: '#fff', padding: '4px 10px', borderRadius: 6, cursor: 'pointer' }}>
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {emailTarget && (
        <SendDealEmailModal deal={emailTarget} adminHeaders={adminHeaders} onClose={() => setEmailTarget(null)} />
      )}
    </div>
  );
}

// Lets an admin email one specific person a direct link into this deal —
// clicking it (see hotDealsController.js adminSendDealEmail) takes them
// straight to claiming it, logging in first if needed.
function SendDealEmailModal({ deal, adminHeaders, onClose }) {
  const [email, setEmail] = useState('');
  const [title, setTitle] = useState(deal.title);
  const [description, setDescription] = useState(deal.description || '');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const send = async () => {
    if (!email.trim() || !title.trim()) {
      setError('Email and title are required.');
      return;
    }
    setSending(true);
    setError('');
    try {
      await adminFetch(
        `/hot-deals/${deal.id}/send-email`,
        { method: 'POST', body: JSON.stringify({ email: email.trim(), title: title.trim(), description: description.trim() }) },
        adminHeaders,
      );
      setSent(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={overlay}>
      <div style={modalCard}>
        {sent ? (
          <>
            <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 700 }}>Email sent</h3>
            <p style={{ margin: '0 0 20px 0', color: '#666', fontSize: 14 }}>
              {email} now has a link straight into "{deal.title}".
            </p>
            <button onClick={onClose} style={{ ...btnPrimary, width: '100%' }}>Done</button>
          </>
        ) : (
          <>
            <h3 style={{ margin: '0 0 4px 0', fontSize: 18, fontWeight: 700 }}>Send "{deal.title}" by email</h3>
            <p style={{ margin: '0 0 18px 0', color: '#888', fontSize: 13 }}>
              The email includes a button that takes the recipient straight to this deal — they log in (or sign up) and land right back here to claim it.
            </p>

            {error && <div style={{ color: '#b91c1c', marginBottom: 12, fontSize: 13 }}>{error}</div>}

            <label style={label}>Recipient email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="someone@example.com" style={input} />

            <label style={label}>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={input} />

            <label style={label}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ ...input, resize: 'vertical' }} />

            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={onClose} disabled={sending} style={{ ...btnSecondary, flex: 1 }}>Cancel</button>
              <button onClick={send} disabled={sending} style={{ ...btnPrimary, flex: 1, opacity: sending ? 0.6 : 1 }}>
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const btnPrimary = { background: '#111', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'inline-block' };
const btnSecondary = { background: '#fff', color: '#555', border: '1px solid #e2e8f0', padding: '10px 18px', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' };
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 };
const modalCard = { background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' };
const label = { display: 'block', fontSize: 12, color: '#888', fontWeight: 600, margin: '14px 0 4px 0' };
const input = { display: 'block', width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '9px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
