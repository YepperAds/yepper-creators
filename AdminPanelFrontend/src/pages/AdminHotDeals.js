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
    </div>
  );
}

const btnPrimary = { background: '#111', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'inline-block' };
