// admin/pages/AdminUserContent.js
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { adminFetch } from '../utils/adminApi';

/* ── tiny helpers ──────────────────────────────────────────────────────────── */
const fmt  = n => (n ?? 0).toLocaleString();
const date = d => d ? new Date(d).toLocaleDateString() : '—';

const TIER_COLOR = {
  elite:      '#7c3aed',
  premium:    '#2563eb',
  standard:   '#059669',
  basic:      '#d97706',
  starter:    '#ea580c',
  unverified: '#94a3b8',
};

/* ── shared styles ─────────────────────────────────────────────────────────── */
const card = {
  background: '#fff',
  borderRadius: 12,
  boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
  marginBottom: 28,
  overflow: 'hidden',
};

const tableHead = {
  background: '#fafafa',
  borderBottom: '1px solid #f0f0f0',
};

const th = {
  textAlign: 'left',
  padding: '10px 16px',
  fontSize: 11,
  fontWeight: 600,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const td = {
  padding: '12px 16px',
  fontSize: 13,
  borderBottom: '1px solid #f7f7f7',
  verticalAlign: 'middle',
};

const emptyRow = (cols, msg) => (
  <tr>
    <td colSpan={cols} style={{ ...td, textAlign: 'center', color: '#cbd5e1', padding: '28px 16px' }}>
      {msg}
    </td>
  </tr>
);

/* ── AdvertiserWarningModal ────────────────────────────────────────────────── */
function AdvertiserWarningModal({ label, itemName, advertisers, onConfirm, onCancel, busy }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, width: '100%', maxWidth: 480,
        boxShadow: '0 20px 60px rgba(0,0,0,0.22)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca', padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22 }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#991b1b' }}>Active Advertisers Detected</div>
            <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 2 }}>Deleting <strong>"{itemName}"</strong> will affect {advertisers.length} advertiser{advertisers.length !== 1 ? 's' : ''}</div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px' }}>
          <p style={{ fontSize: 13, color: '#475569', margin: '0 0 14px 0', lineHeight: 1.6 }}>
            The following advertiser{advertisers.length !== 1 ? 's have' : ' has'} active ads placed on this {label.toLowerCase()}. Deleting it will remove their placements immediately.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
            {advertisers.map((a, i) => (
              <div key={a.adId || i} style={{
                background: '#fafafa', border: '1px solid #f0f0f0',
                borderRadius: 8, padding: '10px 14px',
              }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{a.businessName}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{a.email}</div>
                {a.spaces && a.spaces.length > 0 && (
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                    📍 {a.spaces.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px 20px 24px', display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid #f0f0f0' }}>
          <button
            onClick={onCancel}
            disabled={busy}
            style={{ fontSize: 13, color: '#475569', border: '1px solid #e2e8f0', background: '#fff', padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 500 }}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            style={{ fontSize: 13, color: '#fff', background: busy ? '#fca5a5' : '#ef4444', border: 'none', padding: '8px 18px', borderRadius: 8, cursor: busy ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
            {busy ? 'Deleting…' : `Yes, Delete ${label}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── SmartDeleteButton ─────────────────────────────────────────────────────── */
function SmartDeleteButton({ onCheck, onDelete, label = 'Delete', itemName = '' }) {
  const [state, setState]           = useState('idle');   // idle | checking | warning | deleting
  const [advertisers, setAdvertisers] = useState([]);

  const handleClick = async () => {
    setState('checking');
    try {
      const result = await onCheck();
      if (result.hasAdvertisers) {
        setAdvertisers(result.advertisers || []);
        setState('warning');
      } else {
        setState('deleting');
        await onDelete();
        setState('idle');
      }
    } catch (e) {
      setState('idle');
    }
  };

  const handleConfirm = async () => {
    setState('deleting');
    try {
      await onDelete();
    } finally {
      setState('idle');
    }
  };

  const handleCancel = () => {
    setState('idle');
    setAdvertisers([]);
  };

  return (
    <>
      {state === 'warning' && (
        <AdvertiserWarningModal
          label={label}
          itemName={itemName}
          advertisers={advertisers}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          busy={false}
        />
      )}
      <button
        onClick={handleClick}
        disabled={state === 'checking' || state === 'deleting'}
        style={{
          fontSize: 12,
          color: state === 'checking' ? '#94a3b8' : '#ef4444',
          border: '1px solid #fecaca',
          background: '#fff5f5',
          padding: '4px 10px',
          borderRadius: 6,
          cursor: state === 'checking' ? 'not-allowed' : 'pointer',
          opacity: state === 'deleting' ? 0.5 : 1,
        }}>
        {state === 'checking' ? '⏳ Checking…' : `🗑 ${label}`}
      </button>
    </>
  );
}

/* ── Tier badge ────────────────────────────────────────────────────────────── */
function TierBadge({ tier }) {
  const color = TIER_COLOR[tier] || TIER_COLOR.unverified;
  return (
    <span style={{ background: color + '18', color, padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>
      {tier || 'unverified'}
    </span>
  );
}

/* ── Main page ─────────────────────────────────────────────────────────────── */
export default function AdminUserContent() {
  const { userId } = useParams();
  const { adminHeaders } = useAdminAuth();
  const [data, setData]       = useState(null);
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast]     = useState(null);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [contentRes, userRes] = await Promise.all([
        adminFetch(`/users/${userId}/content`, {}, adminHeaders),
        adminFetch(`/users/${userId}`, {}, adminHeaders),
      ]);
      setData(contentRes);
      setUser(userRes.user);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [userId, adminHeaders]);

  useEffect(() => { load(); }, [load]);

  /* ── delete handlers ── */
  const checkWebsiteAdvertisers = async (websiteId) => {
    return await adminFetch(`/users/${userId}/websites/${websiteId}/advertiser-check`, {}, adminHeaders);
  };

  const checkAdSpaceAdvertisers = async (spaceId) => {
    return await adminFetch(`/users/${userId}/ad-spaces/${spaceId}/advertiser-check`, {}, adminHeaders);
  };

  const deleteWebsite = async (websiteId, name) => {
    try {
      await adminFetch(`/users/${userId}/websites/${websiteId}`, { method: 'DELETE' }, adminHeaders);
      showToast(`Website "${name}" and its ad spaces deleted.`);
      load();
    } catch (e) {
      showToast(e.message, false);
    }
  };

  const deleteAdSpace = async (spaceId, name) => {
    try {
      await adminFetch(`/users/${userId}/ad-spaces/${spaceId}`, { method: 'DELETE' }, adminHeaders);
      showToast(`Ad space "${name}" deleted.`);
      load();
    } catch (e) {
      showToast(e.message, false);
    }
  };

  const deleteAd = async (adId, name) => {
    try {
      await adminFetch(`/users/${userId}/ads/${adId}`, { method: 'DELETE' }, adminHeaders);
      showToast(`Ad "${name}" deleted.`);
      load();
    } catch (e) {
      showToast(e.message, false);
    }
  };

  /* ── render ── */
  if (loading) return <div style={{ color: '#94a3b8', padding: 40 }}>Loading…</div>;
  if (!data)   return <div style={{ color: '#ef4444', padding: 40 }}>Failed to load content.</div>;

  const { websites, adSpaces, ads } = data;

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 28, zIndex: 9999,
          background: toast.ok ? '#0f172a' : '#ef4444',
          color: '#fff', padding: '12px 20px', borderRadius: 10,
          fontSize: 13, fontWeight: 500, boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        }}>
          {toast.ok ? '✓' : '✗'} {toast.msg}
        </div>
      )}

      {/* Breadcrumb */}
      <div style={{ marginBottom: 20, fontSize: 13, color: '#94a3b8' }}>
        <Link to="/users" style={{ color: '#94a3b8', textDecoration: 'none' }}>← Users</Link>
        {user && (
          <>
            <span style={{ margin: '0 6px' }}>/</span>
            <Link to={`/users/${userId}`} style={{ color: '#94a3b8', textDecoration: 'none' }}>{user.name}</Link>
            <span style={{ margin: '0 6px' }}>/</span>
            <span style={{ color: '#334155' }}>Content</span>
          </>
        )}
      </div>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ margin: '0 0 4px 0', fontSize: 24, fontWeight: 700 }}>User Content</h2>
        {user && <p style={{ margin: 0, color: '#94a3b8', fontSize: 14 }}>{user.name} · {user.email}</p>}
      </div>

      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 28, flexWrap: 'wrap' }}>
        {[
          { label: 'Websites',  value: websites.length,  color: '#2563eb' },
          { label: 'Ad Spaces', value: adSpaces.length,  color: '#7c3aed' },
          { label: 'Ads',       value: ads.length,       color: '#059669' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: '#fff', borderRadius: 10, padding: '14px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color }}>{value}</span>
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* ── WEBSITES ──────────────────────────────────────────────── */}
      <div style={card}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Websites <span style={{ color: '#94a3b8', fontWeight: 400 }}>({websites.length})</span></h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={tableHead}>
            <tr>
              {['Website', 'URL', 'Traffic', 'Tier', 'Verification', 'Created', 'Action'].map(h => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {websites.length === 0
              ? emptyRow(7, 'No websites created yet.')
              : websites.map(w => (
                <tr key={w.id}>
                  <td style={td}>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{w.website_name}</div>
                    {w.image_url && <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>Has image</div>}
                  </td>
                  <td style={td}>
                    <a href={w.website_link} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontSize: 12, textDecoration: 'none' }}>
                      {w.website_link}
                    </a>
                  </td>
                  <td style={{ ...td, color: '#475569' }}>{fmt(w.monthly_traffic)}<span style={{ color: '#94a3b8' }}>/mo</span></td>
                  <td style={td}><TierBadge tier={w.traffic_tier} /></td>
                  <td style={td}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: w.verification_status === 'verified' ? '#059669' : w.verification_status === 'pending' ? '#d97706' : '#94a3b8', textTransform: 'capitalize' }}>
                      {w.verification_status || 'pending'}
                    </span>
                  </td>
                  <td style={{ ...td, color: '#94a3b8', fontSize: 12 }}>{date(w.created_at)}</td>
                  <td style={td}>
                    <SmartDeleteButton
                      label="Website"
                      itemName={w.website_name}
                      onCheck={() => checkWebsiteAdvertisers(w.id)}
                      onDelete={() => deleteWebsite(w.id, w.website_name)}
                    />
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>

      {/* ── AD SPACES ─────────────────────────────────────────────── */}
      <div style={card}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #f0f0f0' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Ad Spaces <span style={{ color: '#94a3b8', fontWeight: 400 }}>({adSpaces.length})</span></h3>
          <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#94a3b8' }}>Ad spaces this user registered on their websites to sell to advertisers.</p>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={tableHead}>
            <tr>
              {['Space Name', 'Type', 'Website', 'Price', 'Tier', 'Language', 'Created', 'Action'].map(h => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {adSpaces.length === 0
              ? emptyRow(8, 'No ad spaces created yet.')
              : adSpaces.map(s => {
                const site = websites.find(w => String(w.id) === String(s.website_id));
                return (
                  <tr key={s.id}>
                    <td style={td}>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{s.category_name}</div>
                      {s.description && <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>{s.description.slice(0, 50)}{s.description.length > 50 ? '…' : ''}</div>}
                    </td>
                    <td style={{ ...td, color: '#475569', fontSize: 12 }}>{s.space_type}</td>
                    <td style={{ ...td, fontSize: 12, color: '#475569' }}>{site?.website_name || <em style={{ color: '#cbd5e1' }}>#{s.website_id}</em>}</td>
                    <td style={{ ...td, fontWeight: 600, color: '#1e293b' }}>${fmt(s.price)}</td>
                    <td style={td}><TierBadge tier={s.tier} /></td>
                    <td style={{ ...td, color: '#64748b', fontSize: 12, textTransform: 'capitalize' }}>{s.default_language}</td>
                    <td style={{ ...td, color: '#94a3b8', fontSize: 12 }}>{date(s.created_at)}</td>
                    <td style={td}>
                      <SmartDeleteButton
                        label="Space"
                        itemName={s.category_name}
                        onCheck={() => checkAdSpaceAdvertisers(s.id)}
                        onDelete={() => deleteAdSpace(s.id, s.category_name)}
                      />
                    </td>
                  </tr>
                );
              })
            }
          </tbody>
        </table>
      </div>

      {/* ── ADS ───────────────────────────────────────────────────── */}
      <div style={card}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #f0f0f0' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Ads (Advertiser) <span style={{ color: '#94a3b8', fontWeight: 400 }}>({ads.length})</span></h3>
          <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#94a3b8' }}>Ads this user created as an advertiser to run on other websites.</p>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={tableHead}>
            <tr>
              {['Business', 'Link', 'Clicks', 'Views', 'Status', 'Created', 'Action'].map(h => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ads.length === 0
              ? emptyRow(7, 'No ads created yet.')
              : ads.map(a => {
                const placements = (a.website_selections || []).filter(Boolean);
                const active = Array.isArray(placements) ? placements.filter(p => {
                  try { const s = typeof p === 'string' ? JSON.parse(p) : p; return s?.status === 'active'; } catch { return false; }
                }).length : 0;
                return (
                  <tr key={a.id}>
                    <td style={td}>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{a.business_name}</div>
                      {a.business_location && <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>{a.business_location}</div>}
                    </td>
                    <td style={{ ...td, fontSize: 12 }}>
                      {a.business_link
                        ? <a href={a.business_link} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>{a.business_link}</a>
                        : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td style={{ ...td, color: '#475569' }}>{fmt(a.clicks)}</td>
                    <td style={{ ...td, color: '#475569' }}>{fmt(a.views)}</td>
                    <td style={td}>
                      <span style={{ background: active > 0 ? '#d1fae5' : '#f1f5f9', color: active > 0 ? '#065f46' : '#64748b', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                        {active > 0 ? `${active} active` : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ ...td, color: '#94a3b8', fontSize: 12 }}>{date(a.created_at)}</td>
                    <td style={td}>
                      <SmartDeleteButton
                        label="Ad"
                        itemName={a.business_name}
                        onCheck={() => Promise.resolve({ hasAdvertisers: false })}
                        onDelete={() => deleteAd(a.id, a.business_name)}
                      />
                    </td>
                  </tr>
                );
              })
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}