// admin/pages/AdminPricing.js
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { adminFetch } from '../utils/adminApi';

const fmt = (n) => (n === '' || n == null || isNaN(n) ? '' : Number(n).toLocaleString('en-US'));

export default function AdminPricing() {
  const { adminHeaders } = useAdminAuth();
  const [tiers, setTiers]           = useState([]);
  const [spaceTypes, setSpaceTypes] = useState([]);
  const [matrix, setMatrix]         = useState({});      // { tier: { space: price } }
  const [margin, setMargin]         = useState(30);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [dirty, setDirty]           = useState({});      // { 'tier|space': true }
  const [applyToExisting, setApply] = useState(true);
  const [showAdv, setShowAdv]       = useState(false);   // show advertiser (with margin) instead of owner base
  const [toast, setToast]           = useState('');

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await adminFetch('/pricing', {}, adminHeaders);
      setTiers(d.tiers); setSpaceTypes(d.spaceTypes); setMatrix(d.matrix);
      setMargin(d.marginPercent); setDirty({});
    } catch (e) { showToast('Error: ' + e.message); }
    finally { setLoading(false); }
  }, [adminHeaders]);

  useEffect(() => { load(); }, [load]);

  const setCell = (tier, space, val) => {
    const clean = val.replace(/[^0-9.]/g, '');
    setMatrix((m) => ({ ...m, [tier]: { ...(m[tier] || {}), [space]: clean === '' ? '' : Number(clean) } }));
    setDirty((d) => ({ ...d, [`${tier}|${space}`]: true }));
  };

  const advPrice = (base) => (base === '' || base == null ? '' : Math.round(Number(base) * (1 + Number(margin) / 100)));

  const dirtyCells = useMemo(() =>
    Object.keys(dirty).map((k) => {
      const [tier, spaceType] = k.split('|');
      return { tier, spaceType, basePrice: Number(matrix[tier]?.[spaceType] || 0) };
    }), [dirty, matrix]);

  const savePrices = async () => {
    if (dirtyCells.length === 0) return showToast('No price changes to save.');
    setSaving(true);
    try {
      const d = await adminFetch('/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prices: dirtyCells, applyToExisting }),
      }, adminHeaders);
      setDirty({});
      showToast(`Saved ${d.saved.length} price${d.saved.length === 1 ? '' : 's'}` +
        (applyToExisting ? ` · re-priced ${d.repricedSpaces} live space${d.repricedSpaces === 1 ? '' : 's'}` : ''));
    } catch (e) { showToast('Error: ' + e.message); }
    finally { setSaving(false); }
  };

  const saveMargin = async () => {
    setSaving(true);
    try {
      await adminFetch('/pricing/margin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marginPercent: Number(margin) }),
      }, adminHeaders);
      showToast(`Margin set to ${margin}% — advertisers now pay base + ${margin}%.`);
    } catch (e) { showToast('Error: ' + e.message); }
    finally { setSaving(false); }
  };

  const applyAll = async () => {
    if (!window.confirm('Re-price every UNPAID ad space on every site to the current prices? Booked/paid spaces are never changed.')) return;
    setSaving(true);
    try {
      const d = await adminFetch('/pricing/apply', { method: 'POST' }, adminHeaders);
      showToast(`Re-priced ${d.repricedSpaces} live space${d.repricedSpaces === 1 ? '' : 's'}.`);
    } catch (e) { showToast('Error: ' + e.message); }
    finally { setSaving(false); }
  };

  const dirtyCount = Object.keys(dirty).length;

  if (loading) return <div style={{ padding: 40, color: '#888' }}>Loading prices…</div>;

  return (
    <div>
      {toast && <div style={S.toast}>{toast}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: 24, fontWeight: 700 }}>Pricing</h2>
          <p style={{ margin: 0, color: '#888', fontSize: 14 }}>
            Edit ad-space prices per tier and the margin you charge. Changes can apply to every unpaid space instantly.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={applyAll} disabled={saving} style={S.btnGhost}>Re-price all unpaid spaces</button>
          <button onClick={savePrices} disabled={saving || dirtyCount === 0} style={{ ...S.btnPrimary, opacity: dirtyCount === 0 ? 0.5 : 1 }}>
            {saving ? 'Saving…' : `Save ${dirtyCount || ''} change${dirtyCount === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>

      {/* Margin card */}
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Margin you charge advertisers</div>
            <div style={{ color: '#888', fontSize: 13 }}>The owner keeps 100% of the price below. Advertisers pay <b>base + this %</b>.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <input type="number" value={margin} min={0} max={1000}
                onChange={(e) => setMargin(e.target.value)}
                style={{ ...S.input, width: 110, paddingRight: 26, fontSize: 18, fontWeight: 700 }} />
              <span style={{ position: 'absolute', right: 10, top: 11, color: '#888' }}>%</span>
            </div>
            <button onClick={saveMargin} disabled={saving} style={S.btnPrimary}>Save margin</button>
          </div>
        </div>
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '20px 0 12px' }}>
        <div style={S.toggleWrap}>
          <button onClick={() => setShowAdv(false)} style={{ ...S.toggle, ...(showAdv ? {} : S.toggleOn) }}>Owner gets (base)</button>
          <button onClick={() => setShowAdv(true)}  style={{ ...S.toggle, ...(showAdv ? S.toggleOn : {}) }}>Advertiser pays (+{margin}%)</button>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#444', cursor: 'pointer' }}>
          <input type="checkbox" checked={applyToExisting} onChange={(e) => setApply(e.target.checked)} />
          Apply saved prices to existing unpaid spaces
        </label>
      </div>

      {showAdv && (
        <div style={{ fontSize: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
          Showing advertiser prices (read-only preview). Switch to “Owner gets (base)” to edit.
        </div>
      )}

      {/* Matrix */}
      <div style={{ overflowX: 'auto', border: '1px solid #eee', borderRadius: 12, background: '#fff' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760 }}>
          <thead>
            <tr>
              <th style={{ ...S.th, textAlign: 'left', position: 'sticky', left: 0, background: '#fafafa', zIndex: 2 }}>Ad space</th>
              {tiers.map((t) => (
                <th key={t.key} style={S.th}>
                  <div style={{ fontWeight: 700 }}>{t.label}</div>
                  <div style={{ fontSize: 10, color: '#999', fontWeight: 400 }}>{t.range}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {spaceTypes.map((space, ri) => (
              <tr key={space} style={{ background: ri % 2 ? '#fcfcfd' : '#fff' }}>
                <td style={{ ...S.tdName, position: 'sticky', left: 0, background: ri % 2 ? '#fcfcfd' : '#fff' }}>{space}</td>
                {tiers.map((t) => {
                  const base = matrix[t.key]?.[space] ?? '';
                  const isDirty = dirty[`${t.key}|${space}`];
                  return (
                    <td key={t.key} style={S.td}>
                      {showAdv ? (
                        <span style={{ fontVariantNumeric: 'tabular-nums', color: '#111', fontWeight: 600 }}>{fmt(advPrice(base))}</span>
                      ) : (
                        <input
                          value={base === '' ? '' : base}
                          onChange={(e) => setCell(t.key, space, e.target.value)}
                          inputMode="numeric"
                          style={{ ...S.cellInput, ...(isDirty ? { borderColor: '#111', background: '#fff7ed' } : {}) }}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ color: '#999', fontSize: 12.5, marginTop: 14, lineHeight: 1.6 }}>
        Prices are RWF / month, per space. Editing a cell changes the price for that space on <b>every website in that tier</b>.
        With “apply to existing” on, your saved change re-prices every <b>unpaid</b> matching space immediately — spaces that already have a paid booking are never touched.
      </p>
    </div>
  );
}

const S = {
  toast: { position: 'fixed', top: 20, right: 20, background: '#111', color: '#fff', padding: '12px 20px', borderRadius: 8, fontSize: 14, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' },
  card: { background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '20px 24px' },
  btnPrimary: { background: '#111', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' },
  btnGhost: { background: '#fff', color: '#333', border: '1px solid #ddd', padding: '10px 16px', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' },
  input: { border: '1px solid #ddd', borderRadius: 8, padding: '8px 12px', fontSize: 14, outline: 'none' },
  toggleWrap: { display: 'inline-flex', background: '#f0f0f2', borderRadius: 8, padding: 3 },
  toggle: { border: 'none', background: 'transparent', padding: '7px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, color: '#666', cursor: 'pointer' },
  toggleOn: { background: '#fff', color: '#111', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' },
  th: { padding: '12px 10px', fontSize: 12, color: '#555', borderBottom: '1px solid #eee', textAlign: 'center', whiteSpace: 'nowrap' },
  tdName: { padding: '8px 12px', fontSize: 13.5, fontWeight: 500, color: '#222', borderBottom: '1px solid #f2f2f2', whiteSpace: 'nowrap' },
  td: { padding: '6px 8px', borderBottom: '1px solid #f2f2f2', textAlign: 'center' },
  cellInput: { width: 92, border: '1px solid #e2e2e2', borderRadius: 6, padding: '7px 8px', fontSize: 13.5, textAlign: 'right', outline: 'none', fontVariantNumeric: 'tabular-nums' },
};
