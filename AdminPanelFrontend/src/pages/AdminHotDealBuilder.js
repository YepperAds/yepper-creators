// admin/pages/AdminHotDealBuilder.js
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { adminFetch, publicFetch } from '../utils/adminApi';

const fmt = (n) => Number(n || 0).toLocaleString('en-US');

const SLOT_TYPES = [
  { value: 'intro',  label: 'After intro (5:00)' },
  { value: 'middle', label: 'Middle' },
  { value: 'end',    label: 'Near the end (80%)' },
];
const DURATION_BANDS = ['5–15s', '15–30s'];

const BUSINESS_CATEGORIES = [
  'technology', 'food-beverage', 'real-estate', 'automotive', 'health-wellness',
  'entertainment', 'fashion', 'education', 'business-services', 'travel-tourism',
  'arts-culture', 'photography', 'gifts-events', 'government-public', 'general-retail', 'other',
];

let nextKey = 1;

export default function AdminHotDealBuilder() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { adminHeaders } = useAdminAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [businessCategory, setBusinessCategory] = useState(BUSINESS_CATEGORIES[0]);
  const [status, setStatus] = useState('draft');
  const [soldAt, setSoldAt] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  // ── load existing deal ──────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      const d = await adminFetch(`/hot-deals/${id}`, {}, adminHeaders);
      const deal = d.data;
      setTitle(deal.title);
      setDescription(deal.description || '');
      setBusinessCategory(deal.businessCategory);
      setStatus(deal.status);
      setSoldAt(deal.soldAt);

      const enriched = await Promise.all(deal.items.map(async (it) => {
        const base = { key: nextKey++, dealPrice: it.dealPrice, systemPrice: it.systemPrice };
        if (it.itemType === 'youtube') {
          let creatorLabel = `Creator #${it.creatorId}`;
          try {
            const u = await adminFetch(`/users/${it.creatorId}`, {}, adminHeaders);
            creatorLabel = u?.user?.name || creatorLabel;
          } catch { /* fall back to id */ }
          return { ...base, itemType: 'youtube', creatorId: it.creatorId, creatorLabel, slotType: it.slotType, durationBand: it.durationBand, adType: it.adType, tier: it.tier };
        }
        let websiteLabel = `Website ${it.websiteId}`;
        let categoryLabel = `Category ${it.categoryId}`;
        try {
          const sites = await publicFetch('/api/websites');
          const site = (sites || []).find((s) => s.id === it.websiteId);
          if (site) websiteLabel = site.websiteName;
        } catch { /* fall back to id */ }
        try {
          const cat = await publicFetch(`/api/ad-categories/category/${it.categoryId}`);
          if (cat?.categoryName) categoryLabel = cat.categoryName;
        } catch { /* fall back to id */ }
        return { ...base, itemType: 'website', websiteId: it.websiteId, websiteLabel, categoryId: it.categoryId, categoryLabel };
      }));
      setItems(enriched);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id, isNew, adminHeaders]);

  useEffect(() => { load(); }, [load]);

  const totalPrice = useMemo(() => items.reduce((s, it) => s + Number(it.dealPrice || 0), 0), [items]);
  const locked = !isNew && !!soldAt;

  const updateItem = (key, fields) => setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...fields } : it)));
  const removeItem = (key) => setItems((prev) => prev.filter((it) => it.key !== key));

  // ── YouTube item picker ──────────────────────────────────────────────────
  const [ytSearch, setYtSearch] = useState('');
  const [ytResults, setYtResults] = useState([]);
  const [ytPicked, setYtPicked] = useState(null);
  const [ytSlot, setYtSlot] = useState(SLOT_TYPES[0].value);
  const [ytDuration, setYtDuration] = useState(DURATION_BANDS[0]);
  const [ytPreview, setYtPreview] = useState(null);
  const [ytLoading, setYtLoading] = useState(false);

  useEffect(() => {
    if (!ytSearch.trim()) { setYtResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const d = await adminFetch(`/youtubers?search=${encodeURIComponent(ytSearch)}&limit=10`, {}, adminHeaders);
        setYtResults(d.youtubers || []);
      } catch { /* ignore */ }
    }, 350);
    return () => clearTimeout(t);
  }, [ytSearch, adminHeaders]);

  useEffect(() => {
    if (!ytPicked) { setYtPreview(null); return; }
    setYtLoading(true);
    adminFetch(`/hot-deals/youtube-price-preview?creatorId=${ytPicked._id}&durationBand=${encodeURIComponent(ytDuration)}`, {}, adminHeaders)
      .then((d) => setYtPreview(d.data))
      .catch(() => setYtPreview(null))
      .finally(() => setYtLoading(false));
  }, [ytPicked, ytDuration, adminHeaders]);

  const addYoutubeItem = () => {
    if (!ytPicked || !ytPreview) return;
    setItems((prev) => [...prev, {
      key: nextKey++, itemType: 'youtube',
      creatorId: ytPicked._id, creatorLabel: ytPicked.channelName || ytPicked.name,
      slotType: ytSlot, durationBand: ytDuration, adType: ytPreview.adType, tier: ytPreview.tier,
      systemPrice: ytPreview.systemPrice, dealPrice: ytPreview.systemPrice,
    }]);
    setYtPicked(null); setYtSearch(''); setYtResults([]); setYtPreview(null);
  };

  // ── Website item picker ──────────────────────────────────────────────────
  const [websites, setWebsites] = useState([]);
  const [websitePicked, setWebsitePicked] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoryPicked, setCategoryPicked] = useState(null);
  const [catLoading, setCatLoading] = useState(false);

  useEffect(() => { publicFetch('/api/websites').then((d) => setWebsites(d || [])).catch(() => setWebsites([])); }, []);

  useEffect(() => {
    if (!websitePicked) { setCategories([]); return; }
    setCatLoading(true);
    publicFetch(`/api/ad-categories/${websitePicked.id}/advertiser`)
      .then((d) => setCategories(d.categories || []))
      .catch(() => setCategories([]))
      .finally(() => setCatLoading(false));
  }, [websitePicked]);

  const addWebsiteItem = () => {
    if (!websitePicked || !categoryPicked) return;
    setItems((prev) => [...prev, {
      key: nextKey++, itemType: 'website',
      websiteId: websitePicked.id, websiteLabel: websitePicked.websiteName,
      categoryId: categoryPicked._id, categoryLabel: `${categoryPicked.categoryName} (${categoryPicked.spaceType})`,
      systemPrice: Number(categoryPicked.price), dealPrice: Number(categoryPicked.price),
    }]);
    setWebsitePicked(null); setCategoryPicked(null); setCategories([]);
  };

  // ── save ──────────────────────────────────────────────────────────────────
  const save = async () => {
    if (!title.trim()) return showToast('Title is required.');
    if (items.length === 0) return showToast('Add at least one item.');
    setSaving(true);
    setError('');
    const payload = {
      title: title.trim(), description: description.trim() || null, businessCategory, status,
      items: items.map((it) => it.itemType === 'youtube'
        ? { itemType: 'youtube', creatorId: it.creatorId, slotType: it.slotType, durationBand: it.durationBand, dealPrice: Number(it.dealPrice) }
        : { itemType: 'website', categoryId: it.categoryId, dealPrice: Number(it.dealPrice) }),
    };
    try {
      if (isNew) {
        const d = await adminFetch('/hot-deals', { method: 'POST', body: JSON.stringify(payload) }, adminHeaders);
        showToast('Hot Deal created.');
        navigate(`/hot-deals/${d.data.id}`);
      } else {
        await adminFetch(`/hot-deals/${id}`, { method: 'PUT', body: JSON.stringify(payload) }, adminHeaders);
        showToast('Hot Deal saved.');
        load();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 40, color: '#888' }}>Loading…</div>;

  return (
    <div>
      {toast && <div style={S.toast}>{toast}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: 24, fontWeight: 700 }}>{isNew ? 'New Hot Deal' : title}</h2>
          <p style={{ margin: 0, color: '#888', fontSize: 14 }}>
            {locked ? 'This deal has been sold and can no longer be edited.' : 'Bundle items, override their price, and save.'}
          </p>
        </div>
        <button onClick={save} disabled={saving || locked} style={{ ...S.btnPrimary, opacity: saving || locked ? 0.5 : 1 }}>
          {saving ? 'Saving…' : 'Save Hot Deal'}
        </button>
      </div>

      {error && <div style={{ color: '#b91c1c', marginBottom: 16, fontSize: 13 }}>Error: {error}</div>}

      <div style={S.card}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
          <div>
            <label style={S.label}>Title</label>
            <input disabled={locked} value={title} onChange={(e) => setTitle(e.target.value)} style={S.input} placeholder="Back-to-school bundle" />
          </div>
          <div>
            <label style={S.label}>Business category</label>
            <select disabled={locked} value={businessCategory} onChange={(e) => setBusinessCategory(e.target.value)} style={S.input}>
              {BUSINESS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={S.label}>Description</label>
          <textarea disabled={locked} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ ...S.input, resize: 'vertical' }} />
        </div>
        <div>
          <label style={S.label}>Status</label>
          <select disabled={locked} value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...S.input, width: 200 }}>
            <option value="draft">draft (hidden from visitors)</option>
            <option value="active">active (shown on the homepage)</option>
            <option value="archived">archived</option>
          </select>
        </div>
      </div>

      {/* Items */}
      <div style={{ ...S.card, marginTop: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Bundled items</div>
        {items.length === 0 ? (
          <p style={{ color: '#999', fontSize: 13 }}>No items yet — add a YouTube slot or website space below.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr>{['Type', 'Item', 'System price', 'Deal price', ''].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.key}>
                  <td style={S.td}>{it.itemType === 'youtube' ? 'YouTube' : 'Website'}</td>
                  <td style={S.td}>
                    {it.itemType === 'youtube'
                      ? `${it.creatorLabel} — ${it.slotType}, ${it.durationBand}, ${it.adType === 'lbar' ? 'L-bar' : 'corner'}`
                      : `${it.websiteLabel} — ${it.categoryLabel}`}
                  </td>
                  <td style={{ ...S.td, color: '#999' }}>{fmt(it.systemPrice)} RWF</td>
                  <td style={S.td}>
                    <input
                      disabled={locked}
                      value={it.dealPrice}
                      onChange={(e) => updateItem(it.key, { dealPrice: e.target.value.replace(/[^0-9.]/g, '') })}
                      style={{ ...S.cellInput, color: Number(it.dealPrice) !== Number(it.systemPrice) ? '#b45309' : '#111' }}
                    />
                  </td>
                  <td style={S.td}>
                    {!locked && <button onClick={() => removeItem(it.key)} style={S.btnGhostSmall}>Remove</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ marginTop: 12, textAlign: 'right', fontWeight: 700, fontSize: 15 }}>Total: {fmt(totalPrice)} RWF</div>
      </div>

      {!locked && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          {/* Add YouTube item */}
          <div style={S.card}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Add YouTube item</div>
            <input
              placeholder="Search creators by name, email, channel…"
              value={ytSearch}
              onChange={(e) => { setYtSearch(e.target.value); setYtPicked(null); }}
              style={S.input}
            />
            {ytResults.length > 0 && !ytPicked && (
              <div style={{ border: '1px solid #eee', borderRadius: 8, marginTop: 6, maxHeight: 160, overflowY: 'auto' }}>
                {ytResults.map((u) => (
                  <div key={u._id} onClick={() => { setYtPicked(u); setYtResults([]); }} style={{ padding: '8px 10px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f5f5f5' }}>
                    <b>{u.name}</b> — {u.channelName || u.email} ({u.subscribers ?? 0} subs)
                  </div>
                ))}
              </div>
            )}
            {ytPicked && (
              <div style={{ marginTop: 10 }}>
                <p style={{ fontSize: 13, marginBottom: 8 }}>Picked: <b>{ytPicked.channelName || ytPicked.name}</b></p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <select value={ytSlot} onChange={(e) => setYtSlot(e.target.value)} style={{ ...S.input, flex: 1 }}>
                    {SLOT_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <select value={ytDuration} onChange={(e) => setYtDuration(e.target.value)} style={{ ...S.input, flex: 1 }}>
                    {DURATION_BANDS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                {ytLoading ? (
                  <p style={{ fontSize: 12, color: '#999' }}>Pricing…</p>
                ) : ytPreview ? (
                  <p style={{ fontSize: 13, marginBottom: 8 }}>
                    Tier <b>{ytPreview.tier}</b> · System price <b>{fmt(ytPreview.systemPrice)} RWF</b> · Format <b>{ytPreview.adType}</b>
                  </p>
                ) : null}
                <button onClick={addYoutubeItem} disabled={!ytPreview} style={S.btnPrimary}>Add item</button>
              </div>
            )}
          </div>

          {/* Add website item */}
          <div style={S.card}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Add website item</div>
            <select
              value={websitePicked?.id || ''}
              onChange={(e) => { setWebsitePicked(websites.find((w) => w.id === e.target.value) || null); setCategoryPicked(null); }}
              style={S.input}
            >
              <option value="">Select a website…</option>
              {websites.map((w) => <option key={w.id} value={w.id}>{w.websiteName}</option>)}
            </select>
            {websitePicked && (
              <div style={{ marginTop: 10 }}>
                {catLoading ? (
                  <p style={{ fontSize: 12, color: '#999' }}>Loading categories…</p>
                ) : (
                  <select value={categoryPicked?._id || ''} onChange={(e) => setCategoryPicked(categories.find((c) => c._id === e.target.value) || null)} style={S.input}>
                    <option value="">Select an ad space…</option>
                    {categories.map((c) => <option key={c._id} value={c._id}>{c.categoryName} — {c.spaceType} ({fmt(c.price)} RWF)</option>)}
                  </select>
                )}
                <button onClick={addWebsiteItem} disabled={!categoryPicked} style={{ ...S.btnPrimary, marginTop: 8 }}>Add item</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  toast: { position: 'fixed', top: 20, right: 20, background: '#111', color: '#fff', padding: '12px 20px', borderRadius: 8, fontSize: 14, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' },
  card: { background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '20px 24px' },
  label: { display: 'block', fontSize: 12, color: '#888', marginBottom: 4, fontWeight: 600 },
  input: { display: 'block', border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '9px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' },
  btnPrimary: { background: '#111', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  btnGhostSmall: { background: '#fff', color: '#b91c1c', border: '1px solid #fecaca', padding: '5px 10px', borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: 'pointer' },
  th: { padding: '8px 10px', fontSize: 11, color: '#888', borderBottom: '1px solid #eee', textAlign: 'left' },
  td: { padding: '8px 10px', borderBottom: '1px solid #f5f5f5' },
  cellInput: { width: 110, border: '1px solid #e2e2e2', borderRadius: 6, padding: '6px 8px', fontSize: 13, textAlign: 'right', outline: 'none' },
};
