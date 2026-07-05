// admin/pages/AdminProspectWebsites.js
//
// Lets the admin manually add a website that isn't onboarded yet (no Yepper
// script installed) so it shows up in the normal advertiser Explore/Advertise
// feed. Advertisers can pick ad spaces on it and "express interest" — no
// payment, no live booking — which lands in the Interests table below so the
// admin knows exactly who wants what before going to sign the site owner.
import React, { useEffect, useState, useCallback } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { adminFetch } from '../utils/adminApi';
import CategoryChip from '../components/CategoryChip';
import { BUSINESS_CATEGORIES } from '../utils/businessCategoryStyles';

const fmt = (n) => Number(n || 0).toLocaleString('en-US');

export default function AdminProspectWebsites() {
  const { adminHeaders } = useAdminAuth();
  const [spaceTypes, setSpaceTypes] = useState([]);
  const [websites, setWebsites] = useState([]);
  const [interests, setInterests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [websiteName, setWebsiteName] = useState('');
  const [websiteLink, setWebsiteLink] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedSpaces, setSelectedSpaces] = useState([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meta, sites, ints] = await Promise.all([
        adminFetch('/prospect-websites/meta', {}, adminHeaders),
        adminFetch('/prospect-websites', {}, adminHeaders),
        adminFetch('/prospect-interests', {}, adminHeaders),
      ]);
      setSpaceTypes(meta.data?.spaceTypes || []);
      setWebsites(sites.data || []);
      setInterests(ints.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [adminHeaders]);

  useEffect(() => { load(); }, [load]);

  const toggleCategory = (id) => {
    setSelectedCategories((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };
  const toggleSpace = (type) => {
    setSelectedSpaces((prev) => (prev.includes(type) ? prev.filter((s) => s !== type) : [...prev, type]));
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!websiteName.trim() || !websiteLink.trim()) return setFormError('Website name and URL are required.');
    if (selectedCategories.length === 0) return setFormError('Select at least one business category.');
    if (selectedSpaces.length === 0) return setFormError('Select at least one ad space.');

    setSaving(true);
    try {
      await adminFetch('/prospect-websites', {
        method: 'POST',
        body: JSON.stringify({
          websiteName: websiteName.trim(),
          websiteLink: websiteLink.trim(),
          businessCategories: selectedCategories,
          spaceTypes: selectedSpaces,
        }),
      }, adminHeaders);
      setWebsiteName('');
      setWebsiteLink('');
      setSelectedCategories([]);
      setSelectedSpaces([]);
      load();
    } catch (e2) {
      setFormError(e2.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (site) => {
    if (!window.confirm(`Delete "${site.website_name}"? This can't be undone.`)) return;
    try {
      await adminFetch(`/prospect-websites/${site.id}`, { method: 'DELETE' }, adminHeaders);
      load();
    } catch (e) {
      window.alert(e.message);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 4px 0', fontSize: 24, fontWeight: 700 }}>Prospect Websites</h2>
        <p style={{ margin: 0, color: '#888', fontSize: 14 }}>
          Add a website you're pitching but haven't onboarded yet — it shows up in the advertiser feed like any other site. Advertisers can express interest in an ad space (no payment); check the Interests table below to see who wants what before you go sign the site.
        </p>
      </div>

      {error && <div style={{ color: '#b91c1c', marginBottom: 16, fontSize: 13 }}>Error: {error}</div>}

      <form onSubmit={submit} style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: 24, marginBottom: 32 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={label}>Website name</label>
            <input value={websiteName} onChange={(e) => setWebsiteName(e.target.value)} placeholder="Palanomic" style={input} />
          </div>
          <div>
            <label style={label}>Website URL</label>
            <input value={websiteLink} onChange={(e) => setWebsiteLink(e.target.value)} placeholder="https://palanomic.com" style={input} />
          </div>
        </div>

        <label style={label}>Business categories</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {BUSINESS_CATEGORIES.filter((c) => c.id !== 'other').map((c) => (
            <CategoryChip key={c.id} id={c.id} selected={selectedCategories.includes(c.id)} onClick={() => toggleCategory(c.id)} />
          ))}
        </div>

        <label style={label}>Ad spaces</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {spaceTypes.map((type) => {
            const selected = selectedSpaces.includes(type);
            return (
              <button
                type="button"
                key={type}
                onClick={() => toggleSpace(type)}
                style={{
                  padding: '6px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: selected ? '1.5px solid #111' : '1.5px solid #e2e8f0',
                  background: selected ? '#111' : '#fff',
                  color: selected ? '#fff' : '#555',
                }}
              >
                {type}
              </button>
            );
          })}
        </div>

        {formError && <div style={{ color: '#b91c1c', marginBottom: 12, fontSize: 13 }}>{formError}</div>}
        <button type="submit" disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Adding…' : '+ Add Prospect Website'}
        </button>
      </form>

      <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px 0' }}>Prospect Websites ({websites.length})</h3>
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden', marginBottom: 32 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead style={{ background: '#fafafa' }}>
            <tr>
              {['Website', 'URL', 'Ad Spaces', 'Interests', 'Added', ''].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '12px 16px', color: '#888', fontWeight: 500, fontSize: 12, borderBottom: '1px solid #f0f0f0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>Loading…</td></tr>
            ) : websites.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>No prospect websites yet</td></tr>
            ) : websites.map((w) => (
              <tr key={w.id} style={{ borderBottom: '1px solid #f7f7f7' }}>
                <td style={{ padding: '12px 16px', fontWeight: 500 }}>{w.website_name}</td>
                <td style={{ padding: '12px 16px', color: '#888' }}>
                  <a href={w.website_link} target="_blank" rel="noreferrer" style={{ color: '#1d4ed8' }}>{w.website_link}</a>
                </td>
                <td style={{ padding: '12px 16px', color: '#555' }}>{(w.spaces || []).map((s) => s.spaceType).join(', ')}</td>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: w.interest_count > 0 ? '#166534' : '#aaa' }}>{w.interest_count}</td>
                <td style={{ padding: '12px 16px', color: '#888', fontSize: 13 }}>{new Date(w.created_at).toLocaleDateString()}</td>
                <td style={{ padding: '12px 16px' }}>
                  <button onClick={() => remove(w)} style={{ fontSize: 12, color: '#b91c1c', border: '1px solid #fecaca', background: '#fff', padding: '4px 10px', borderRadius: 6, cursor: 'pointer' }}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px 0' }}>Advertiser Interests ({interests.length})</h3>
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead style={{ background: '#fafafa' }}>
            <tr>
              {['Advertiser', 'Website', 'Ad Space', 'Requested'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '12px 16px', color: '#888', fontWeight: 500, fontSize: 12, borderBottom: '1px solid #f0f0f0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>Loading…</td></tr>
            ) : interests.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>No interest yet</td></tr>
            ) : interests.map((i) => (
              <tr key={i.id} style={{ borderBottom: '1px solid #f7f7f7' }}>
                <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                  {i.full_name || i.username || '—'}
                  {i.email && <div style={{ color: '#aaa', fontSize: 12 }}>{i.email}</div>}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <a href={i.website_link} target="_blank" rel="noreferrer" style={{ color: '#1d4ed8' }}>{i.website_name}</a>
                </td>
                <td style={{ padding: '12px 16px', color: '#555' }}>{i.space_type || i.category_name || '—'}</td>
                <td style={{ padding: '12px 16px', color: '#888', fontSize: 13 }}>{new Date(i.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const btnPrimary = { background: '#111', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'inline-block' };
const label = { display: 'block', fontSize: 12, color: '#888', fontWeight: 600, margin: '0 0 6px 0' };
const input = { display: 'block', width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '9px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
