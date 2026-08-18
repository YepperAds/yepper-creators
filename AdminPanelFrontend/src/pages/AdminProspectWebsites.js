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

const ALLOWED_ICON_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'];

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
  const [selectedSpaces, setSelectedSpaces] = useState([]);
  const [iconPreview, setIconPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Send-invite modal — opened from a specific Advertiser Interests row, since
  // that's the proof ("someone actually wants to advertise here") worth
  // emailing the real site owner about.
  const [inviteModal, setInviteModal] = useState(null); // { websiteId, websiteName }
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSent, setInviteSent] = useState(false);

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

  const toggleSpace = (type) => {
    setSelectedSpaces((prev) => (prev.includes(type) ? prev.filter((s) => s !== type) : [...prev, type]));
  };

  const handleIconChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_ICON_TYPES.includes(file.type)) return setFormError('Only JPEG, PNG, GIF, SVG, or WebP images are allowed.');
    if (file.size > 5 * 1024 * 1024) return setFormError('Image must be smaller than 5MB.');
    setFormError('');
    const reader = new FileReader();
    reader.onloadend = () => setIconPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!websiteName.trim() || !websiteLink.trim()) return setFormError('Website name and URL are required.');
    if (selectedSpaces.length === 0) return setFormError('Select at least one ad space.');

    setSaving(true);
    try {
      await adminFetch('/prospect-websites', {
        method: 'POST',
        body: JSON.stringify({
          websiteName: websiteName.trim(),
          websiteLink: websiteLink.trim(),
          imageUrl: iconPreview || '',
          spaceTypes: selectedSpaces,
        }),
      }, adminHeaders);
      setWebsiteName('');
      setWebsiteLink('');
      setSelectedSpaces([]);
      setIconPreview('');
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

  const openInvite = (websiteId, websiteName) => {
    setInviteModal({ websiteId, websiteName });
    setInviteEmail('');
    setInviteError('');
    setInviteSent(false);
  };
  const closeInvite = () => setInviteModal(null);

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return setInviteError('Enter a recipient email.');
    setInviteSending(true);
    setInviteError('');
    try {
      await adminFetch(`/prospect-websites/${inviteModal.websiteId}/send-invite`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail.trim() }),
      }, adminHeaders);
      setInviteSent(true);
    } catch (e) {
      setInviteError(e.message);
    } finally {
      setInviteSending(false);
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

        <label style={label}>Website logo (optional)</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          {iconPreview && (
            <img src={iconPreview} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'contain', border: '1px solid #e2e8f0', background: '#fff' }} />
          )}
          <input type="file" accept="image/jpeg,image/png,image/gif,image/svg+xml,image/webp" onChange={handleIconChange} style={{ fontSize: 13 }} />
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
              {['Advertiser', 'Website', 'Ad Space', 'Requested', ''].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '12px 16px', color: '#888', fontWeight: 500, fontSize: 12, borderBottom: '1px solid #f0f0f0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>Loading…</td></tr>
            ) : interests.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>No interest yet</td></tr>
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
                <td style={{ padding: '12px 16px' }}>
                  <button
                    onClick={() => openInvite(i.website_id, i.website_name)}
                    style={{ fontSize: 12, color: '#1d4ed8', border: '1px solid #bfdbfe', background: '#fff', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                  >
                    Send Invite
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {inviteModal && (
        <div
          onClick={closeInvite}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.15)', padding: 24, width: 380, maxWidth: '90vw' }}
          >
            {inviteSent ? (
              <>
                <h3 style={{ margin: '0 0 8px 0', fontSize: 17, fontWeight: 700 }}>Invite sent</h3>
                <p style={{ margin: '0 0 20px 0', color: '#666', fontSize: 14 }}>
                  {inviteModal.websiteName} — the claim link was emailed to {inviteEmail}.
                </p>
                <button type="button" onClick={closeInvite} style={{ ...btnPrimary, width: '100%' }}>Done</button>
              </>
            ) : (
              <>
                <h3 style={{ margin: '0 0 4px 0', fontSize: 17, fontWeight: 700 }}>Send claim invite</h3>
                <p style={{ margin: '0 0 16px 0', color: '#888', fontSize: 13 }}>
                  Emails the real owner of <strong>{inviteModal.websiteName}</strong> a link to claim this listing — the ad spaces and advertiser interest already recorded come along with it.
                </p>
                <label style={label}>Recipient email</label>
                <input
                  type="email"
                  autoFocus
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="owner@realsite.com"
                  style={{ ...input, marginBottom: 12 }}
                  onKeyDown={(e) => { if (e.key === 'Enter') sendInvite(); }}
                />
                {inviteError && <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 12 }}>{inviteError}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={closeInvite}
                    style={{ flex: 1, border: '1.5px solid #e2e8f0', background: '#fff', color: '#333', padding: '10px 0', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={sendInvite}
                    disabled={inviteSending}
                    style={{ ...btnPrimary, flex: 1, opacity: inviteSending ? 0.6 : 1 }}
                  >
                    {inviteSending ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const btnPrimary = { background: '#111', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'inline-block' };
const label = { display: 'block', fontSize: 12, color: '#888', fontWeight: 600, margin: '0 0 6px 0' };
const input = { display: 'block', width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '9px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
