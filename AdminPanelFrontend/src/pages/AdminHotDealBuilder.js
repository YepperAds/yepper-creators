// admin/pages/AdminHotDealBuilder.js
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { adminFetch, publicFetch } from '../utils/adminApi';
import CategoryChip from '../components/CategoryChip';

const fmt = (n) => Number(n || 0).toLocaleString('en-US');

const SLOT_TYPES = [
  { value: 'intro',  label: 'After intro (5:00)' },
  { value: 'middle', label: 'Middle' },
  { value: 'end',    label: 'Near the end (80%)' },
];
const DURATION_BANDS = ['30 seconds'];
const TIKTOK_PACKAGE_LABELS = {
  brand_visit_video: 'Brand Visit Video',
  creator_location_video: 'Creator-Location Video',
  creator_captured_photo: 'Creator-Captured Photo',
  advertiser_image_post: 'Advertiser-Provided Image Post',
  story: 'Story',
};

const BUSINESS_CATEGORIES = [
  'technology', 'food-beverage', 'real-estate', 'automotive', 'health-wellness',
  'entertainment', 'fashion', 'education', 'business-services', 'travel-tourism',
  'arts-culture', 'photography', 'gifts-events', 'government-public', 'general-retail', 'other',
];

async function fetchAllAdminPages(path, listKey, adminHeaders) {
  const pageSize = 100;
  const first = await adminFetch(`${path}?page=1&limit=${pageSize}`, {}, adminHeaders);
  const rows = first[listKey] || [];
  const pageCount = Math.ceil(Number(first.total || rows.length) / pageSize);
  if (pageCount <= 1) return rows;
  const rest = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) =>
      adminFetch(`${path}?page=${index + 2}&limit=${pageSize}`, {}, adminHeaders),
    ),
  );
  return rows.concat(...rest.map((result) => result[listKey] || []));
}

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
        if (it.itemType === 'tiktok') {
          let creatorLabel = `TikTok creator #${it.creatorId}`;
          try {
            const u = await adminFetch(`/users/${it.creatorId}`, {}, adminHeaders);
            creatorLabel = u?.user?.name || creatorLabel;
          } catch { /* fall back to id */ }
          return {
            ...base, itemType: 'tiktok', creatorId: it.creatorId, creatorLabel,
            packageCode: it.packageCode, tier: it.tier,
          };
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
  const [youtubers, setYoutubers] = useState([]);
  const [youtubersLoading, setYoutubersLoading] = useState(true);
  const [ytPicked, setYtPicked] = useState(null);
  const [ytSlot, setYtSlot] = useState(SLOT_TYPES[0].value);
  const [ytDuration, setYtDuration] = useState(DURATION_BANDS[0]);
  const [ytPreview, setYtPreview] = useState(null);
  const [ytLoading, setYtLoading] = useState(false);
  const [ytError, setYtError] = useState('');
  const [tiktokers, setTiktokers] = useState([]);
  const [tiktokersLoading, setTiktokersLoading] = useState(true);
  const [ttPicked, setTtPicked] = useState(null);
  const [ttPackageCode, setTtPackageCode] = useState('');
  const [ttPreview, setTtPreview] = useState(null);
  const [ttLoading, setTtLoading] = useState(false);
  const [ttError, setTtError] = useState('');

  useEffect(() => {
    let active = true;
    setYoutubersLoading(true);
    fetchAllAdminPages('/youtubers', 'youtubers', adminHeaders)
      .then((rows) => { if (active) setYoutubers(rows); })
      .catch((e) => { if (active) setYtError(`Could not load YouTube channels: ${e.message}`); })
      .finally(() => { if (active) setYoutubersLoading(false); });
    return () => { active = false; };
  }, [adminHeaders]);

  useEffect(() => {
    let active = true;
    setYtPreview(null);
    if (!ytPicked) { setYtLoading(false); return () => { active = false; }; }
    setYtLoading(true);
    setYtError('');
    adminFetch(`/hot-deals/youtube-price-preview?creatorId=${ytPicked._id}&durationBand=${encodeURIComponent(ytDuration)}`, {}, adminHeaders)
      .then((d) => { if (active) setYtPreview(d.data); })
      .catch((e) => { if (active) setYtError(`Could not load YouTube package price: ${e.message}`); })
      .finally(() => { if (active) setYtLoading(false); });
    return () => { active = false; };
  }, [ytPicked, ytDuration, adminHeaders]);

  useEffect(() => {
    let active = true;
    setTiktokersLoading(true);
    fetchAllAdminPages('/tiktoks', 'tiktokers', adminHeaders)
      .then((rows) => { if (active) setTiktokers(rows); })
      .catch((e) => { if (active) setTtError(`Could not load TikTok creators: ${e.message}`); })
      .finally(() => { if (active) setTiktokersLoading(false); });
    return () => { active = false; };
  }, [adminHeaders]);

  useEffect(() => {
    let active = true;
    setTtPreview(null);
    if (!ttPicked || !ttPackageCode) { setTtLoading(false); return () => { active = false; }; }
    setTtLoading(true);
    setTtError('');
    adminFetch(`/hot-deals/tiktok-price-preview?creatorId=${ttPicked._id}&packageCode=${encodeURIComponent(ttPackageCode)}`, {}, adminHeaders)
      .then((d) => { if (active) setTtPreview(d.data); })
      .catch((e) => { if (active) setTtError(`Could not load TikTok package price: ${e.message}`); })
      .finally(() => { if (active) setTtLoading(false); });
    return () => { active = false; };
  }, [ttPicked, ttPackageCode, adminHeaders]);

  const addTikTokItem = () => {
    if (!ttPicked || !ttPackageCode || !ttPreview) return;
    setItems((prev) => [...prev, {
      key: nextKey++, itemType: 'tiktok',
      creatorId: ttPicked._id, creatorLabel: `@${String(ttPicked.channelName || ttPicked.username || '').replace(/^@+/, '')}`,
      packageCode: ttPackageCode, tier: ttPreview.tier,
      systemPrice: ttPreview.systemPrice, dealPrice: ttPreview.systemPrice,
    }]);
    setTtPicked(null); setTtPackageCode(''); setTtPreview(null); setTtError('');
    showToast('TikTok package added. Select another creator to add more.');
  };

  const addYoutubeItem = () => {
    if (!ytPicked || !ytPreview) return;
    setItems((prev) => [...prev, {
      key: nextKey++, itemType: 'youtube',
      creatorId: ytPicked._id, creatorLabel: ytPicked.channelName || ytPicked.name,
      slotType: ytSlot, durationBand: ytDuration, adType: ytPreview.adType, tier: ytPreview.tier,
      systemPrice: ytPreview.systemPrice, dealPrice: ytPreview.systemPrice,
    }]);
    setYtPicked(null); setYtPreview(null); setYtError('');
    showToast('YouTube package added. Select another channel to add more.');
  };

  // ── Website item picker ──────────────────────────────────────────────────
  const [websites, setWebsites] = useState([]);
  const [websitesLoading, setWebsitesLoading] = useState(true);
  const [websiteError, setWebsiteError] = useState('');
  const [websitePicked, setWebsitePicked] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoryPicked, setCategoryPicked] = useState(null);
  const [catLoading, setCatLoading] = useState(false);
  const [categoryError, setCategoryError] = useState('');

  useEffect(() => {
    publicFetch('/api/websites')
      .then((d) => setWebsites(d || []))
      .catch((e) => setWebsiteError(`Could not load websites: ${e.message}`))
      .finally(() => setWebsitesLoading(false));
  }, []);

  useEffect(() => {
    let active = true;
    if (!websitePicked) { setCategories([]); setCategoryError(''); return () => { active = false; }; }
    setCatLoading(true);
    setCategoryError('');
    publicFetch(`/api/ad-categories/${websitePicked.id}/advertiser`)
      .then((d) => { if (active) setCategories(d.categories || []); })
      .catch((e) => {
        if (active) {
          setCategories([]);
          setCategoryError(`Could not load this website's ad spaces: ${e.message}`);
        }
      })
      .finally(() => { if (active) setCatLoading(false); });
    return () => { active = false; };
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
    showToast('Website ad space added. Select another website to add more.');
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
        : it.itemType === 'tiktok'
          ? { itemType: 'tiktok', creatorId: it.creatorId, packageCode: it.packageCode, dealPrice: Number(it.dealPrice) }
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
        <button type="button" onClick={save} disabled={saving || locked} style={{ ...S.btnPrimary, opacity: saving || locked ? 0.5 : 1 }}>
          {saving ? 'Saving…' : 'Save Hot Deal'}
        </button>
      </div>

      {error && <div style={{ color: '#b91c1c', marginBottom: 16, fontSize: 13 }}>Error: {error}</div>}

      <div style={S.card}>
        <div style={{ marginBottom: 14 }}>
          <label style={S.label}>Title</label>
          <input disabled={locked} value={title} onChange={(e) => setTitle(e.target.value)} style={S.input} placeholder="Back-to-school bundle" />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={S.label}>Business category</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {BUSINESS_CATEGORIES.map((c) => (
              <CategoryChip
                key={c}
                id={c}
                selected={businessCategory === c}
                onClick={locked ? undefined : () => setBusinessCategory(c)}
              />
            ))}
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
          <p style={{ color: '#999', fontSize: 13 }}>No items yet — add creator packages or website ad spaces below.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr>{['Type', 'Item', 'System price', 'Deal price', ''].map((h) => <th key={h} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.key}>
                  <td style={S.td}>{it.itemType === 'youtube' ? 'YouTube' : it.itemType === 'tiktok' ? 'TikTok' : 'Website'}</td>
                  <td style={S.td}>
                    {it.itemType === 'youtube'
                      ? `${it.creatorLabel} — ${it.slotType}, ${it.durationBand}, ${it.adType === 'lbar' ? 'L-bar' : 'corner'}`
                    : it.itemType === 'tiktok'
                      ? `${it.creatorLabel} — ${TIKTOK_PACKAGE_LABELS[it.packageCode] || it.packageCode}`
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
                    {!locked && <button type="button" onClick={() => removeItem(it.key)} style={S.btnGhostSmall}>Remove</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ marginTop: 12, textAlign: 'right', fontWeight: 700, fontSize: 15 }}>Total: {fmt(totalPrice)} RWF</div>
      </div>

      {!locked && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 16 }}>
          {/* Add YouTube item */}
          <div style={S.card}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Add YouTube item</div>
            <label style={S.label}>Choose a channel</label>
            <select
              value={ytPicked?._id || ''}
              disabled={youtubersLoading || youtubers.length === 0}
              onChange={(e) => {
                setYtPicked(youtubers.find((creator) => String(creator._id) === e.target.value) || null);
                setYtPreview(null);
              }}
              style={S.input}
            >
              <option value="">{youtubersLoading ? 'Loading channels…' : youtubers.length ? 'Select a YouTube channel…' : 'No YouTube channels available'}</option>
              {youtubers.map((u) => (
                <option
                  key={u._id}
                  value={u._id}
                  disabled={items.some((item) => item.itemType === 'youtube' && String(item.creatorId) === String(u._id))}
                >
                  {u.channelName || u.name} — {Number(u.subscribers || 0).toLocaleString()} subscribers{u.isMock ? ' (mock)' : ''}
                  {items.some((item) => item.itemType === 'youtube' && String(item.creatorId) === String(u._id)) ? ' (already added)' : ''}
                </option>
              ))}
            </select>
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
                {ytError && <p role="alert" style={{ color: '#b91c1c', fontSize: 12 }}>{ytError}</p>}
                <button type="button" onClick={addYoutubeItem} disabled={!ytPreview || ytLoading} style={{ ...S.btnPrimary, opacity: !ytPreview || ytLoading ? 0.5 : 1 }}>
                  {ytLoading ? 'Loading package…' : 'Add channel'}
                </button>
              </div>
            )}
            {ytError && !ytPicked && <p role="alert" style={{ color: '#b91c1c', fontSize: 12 }}>{ytError}</p>}
          </div>

          {/* Add TikTok item */}
          <div style={S.card}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Add TikTok package</div>
            <label style={S.label}>Choose a creator</label>
            <select
              value={ttPicked?._id || ''}
              disabled={tiktokersLoading || tiktokers.length === 0}
              onChange={(e) => {
                const creator = tiktokers.find((entry) => String(entry._id) === e.target.value) || null;
                setTtPicked(creator);
                setTtPackageCode(creator?.enabledPackages?.[0] || '');
                setTtPreview(null);
              }}
              style={S.input}
            >
              <option value="">{tiktokersLoading ? 'Loading creators…' : tiktokers.length ? 'Select a TikTok creator…' : 'No TikTok creators available'}</option>
              {tiktokers.map((u) => (
                <option
                  key={u._id}
                  value={u._id}
                  disabled={items.some((item) => item.itemType === 'tiktok' && String(item.creatorId) === String(u._id))}
                >
                  @{String(u.channelName || u.username || '').replace(/^@+/, '')} — {Number(u.followers || 0).toLocaleString()} followers
                  {items.some((item) => item.itemType === 'tiktok' && String(item.creatorId) === String(u._id)) ? ' (already added)' : ''}
                </option>
              ))}
            </select>
            {ttPicked && (
              <div style={{ marginTop: 10 }}>
                <p style={{ fontSize: 13, marginBottom: 8 }}>
                  Picked: <b>@{String(ttPicked.channelName || ttPicked.username || '').replace(/^@+/, '')}</b>
                </p>
                <select
                  value={ttPackageCode}
                  onChange={(e) => { setTtPackageCode(e.target.value); setTtPreview(null); }}
                  style={S.input}
                >
                  <option value="">Select an enabled package…</option>
                  {(ttPicked.enabledPackages || []).map((code) => (
                    <option key={code} value={code}>{TIKTOK_PACKAGE_LABELS[code] || code}</option>
                  ))}
                </select>
                {ttLoading ? (
                  <p style={{ fontSize: 12, color: '#999' }}>Pricing…</p>
                ) : ttPreview ? (
                  <p style={{ fontSize: 13, marginBottom: 8 }}>
                    Tier <b>{ttPreview.tier}</b> · System price <b>{fmt(ttPreview.systemPrice)} RWF</b>
                  </p>
                ) : (ttPicked.enabledPackages || []).length === 0 ? (
                  <p style={{ fontSize: 12, color: '#b91c1c' }}>This creator has no enabled TikTok packages.</p>
                ) : null}
                {ttError && <p role="alert" style={{ color: '#b91c1c', fontSize: 12 }}>{ttError}</p>}
                <button type="button" onClick={addTikTokItem} disabled={!ttPreview || ttLoading} style={{ ...S.btnPrimary, marginTop: 8, opacity: !ttPreview || ttLoading ? 0.5 : 1 }}>
                  {ttLoading ? 'Loading package…' : 'Add TikTok package'}
                </button>
              </div>
            )}
            {ttError && !ttPicked && <p role="alert" style={{ color: '#b91c1c', fontSize: 12 }}>{ttError}</p>}
          </div>

          {/* Add website item */}
          <div style={S.card}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Add website item</div>
            <label style={S.label}>Choose a website</label>
            <select
              value={websitePicked?.id || ''}
              disabled={websitesLoading || websites.length === 0}
              onChange={(e) => {
                setWebsitePicked(websites.find((w) => w.id === e.target.value) || null);
                setCategoryPicked(null);
                setCategories([]);
              }}
              style={S.input}
            >
              <option value="">{websitesLoading ? 'Loading websites…' : websites.length ? 'Select a website…' : 'No websites available'}</option>
              {websites.map((w) => <option key={w.id} value={w.id}>{w.websiteName}</option>)}
            </select>
            {websiteError && <p role="alert" style={{ color: '#b91c1c', fontSize: 12 }}>{websiteError}</p>}
            {websitePicked && (
              <div style={{ marginTop: 10 }}>
                {catLoading ? (
                  <p style={{ fontSize: 12, color: '#999' }}>Loading categories…</p>
                ) : (
                  <select value={categoryPicked?._id || ''} onChange={(e) => setCategoryPicked(categories.find((c) => c._id === e.target.value) || null)} style={S.input}>
                    <option value="">{categories.length ? 'Select an ad space…' : 'No ad spaces available'}</option>
                    {categories.map((c) => <option key={c._id} value={c._id}>{c.categoryName} — {c.spaceType} ({fmt(c.price)} RWF)</option>)}
                  </select>
                )}
                {categoryError && <p role="alert" style={{ color: '#b91c1c', fontSize: 12 }}>{categoryError}</p>}
                <button type="button" onClick={addWebsiteItem} disabled={!categoryPicked || catLoading} style={{ ...S.btnPrimary, marginTop: 8, opacity: !categoryPicked || catLoading ? 0.5 : 1 }}>
                  Add ad space
                </button>
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
