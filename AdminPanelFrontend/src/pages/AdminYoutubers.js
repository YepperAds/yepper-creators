// admin/pages/AdminYoutubers.js
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { adminFetch } from '../utils/adminApi';

export default function AdminYoutubers() {
  const { adminHeaders } = useAdminAuth();
  const [youtubers, setYoutubers] = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [partnerRequests, setPartnerRequests] = useState([]);
  const [partnerRequestsLoading, setPartnerRequestsLoading] = useState(true);
  const [partnerRequestsError, setPartnerRequestsError] = useState('');
  const [search,  setSearch]  = useState('');
  const [page,    setPage]    = useState(1);
  const [verificationBusy, setVerificationBusy] = useState({});
  const [selectedCreators, setSelectedCreators] = useState([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const d = await adminFetch(`/youtubers?search=${encodeURIComponent(search)}&page=${page}&limit=20`, {}, adminHeaders);
      setYoutubers(d.youtubers);
      setTotal(d.total);
    } catch (e) {
      setError(e.message || 'Could not load connected YouTube channels.');
    } finally {
      setLoading(false);
    }
  }, [search, page, adminHeaders]);

  useEffect(() => { load(); }, [load]);

  const loadPartnerRequests = useCallback(async () => {
    setPartnerRequestsLoading(true);
    setPartnerRequestsError('');
    try {
      const response = await adminFetch('/youtube-channel-requests', {}, adminHeaders);
      setPartnerRequests(response.data || []);
    } catch (e) {
      setPartnerRequestsError(e.message || 'Could not load partner YouTube channel requests.');
    } finally {
      setPartnerRequestsLoading(false);
    }
  }, [adminHeaders]);

  useEffect(() => { loadPartnerRequests(); }, [loadPartnerRequests]);

  // Debounce search
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
      setSelectedCreators([]);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const pages = Math.ceil(total / 20);
  const visibleCreatorIds = youtubers.map(creator => String(creator._id));
  const visibleSelectedCount = visibleCreatorIds.filter(id => selectedCreators.includes(id)).length;
  const allVisibleSelected = visibleCreatorIds.length > 0
    && visibleCreatorIds.every(id => selectedCreators.includes(id));

  const setCreatorVerification = async (creator, nextStatus) => {
    setVerificationBusy(current => ({ ...current, [creator._id]: true }));
    setError('');
    try {
      await adminFetch(`/video-processing/creators/${creator._id}/verification`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus }),
      }, adminHeaders);
      setYoutubers(current => current.map(item => (
        item._id === creator._id
          ? { ...item, videoVerificationStatus: nextStatus }
          : item
      )));
      return true;
    } catch (e) {
      throw new Error(e.message || `Could not update ${creator.channelName || creator.name || 'channel'}.`);
    } finally {
      setVerificationBusy(current => ({ ...current, [creator._id]: false }));
    }
  };

  const toggleSelection = (creatorId) => {
    const id = String(creatorId);
    setSelectedCreators(current => current.includes(id)
      ? current.filter(selected => selected !== id)
      : [...current, id]);
  };

  const toggleVisibleSelection = () => {
    setSelectedCreators(current => allVisibleSelected
      ? current.filter(id => !visibleCreatorIds.includes(id))
      : [...new Set([...current, ...visibleCreatorIds])]);
  };

  const applyBulkVerification = async (nextStatus) => {
    const targets = youtubers.filter(creator => selectedCreators.includes(String(creator._id)));
    if (!targets.length || bulkBusy) return;
    setBulkBusy(true);
    setError('');
    setNotice('');
    const failures = [];
    for (const creator of targets) {
      try {
        await setCreatorVerification(creator, nextStatus);
      } catch (e) {
        failures.push(e.message);
      }
    }
    setSelectedCreators(current => current.filter(id => !targets.some(target => String(target._id) === id)));
    setBulkBusy(false);
    if (failures.length) {
      setError(`${targets.length - failures.length} of ${targets.length} channels updated. ${failures.join(' ')}`);
      return;
    }
    setNotice(`${targets.length} channel${targets.length === 1 ? '' : 's'} ${nextStatus === 'verified' ? 'verified' : 'unverified'} for long-video processing.`);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: 24, fontWeight: 700 }}>Youtubers</h2>
          <p style={{ margin: 0, color: '#888', fontSize: 14 }}>{total} connected YouTube channels. Channel verification only confirms creator eligibility. Each long video still needs separate admin approval.</p>
        </div>
      </div>

      {error && (
        <div role="alert" style={{ background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 8, padding: '10px 14px', color: '#c53030', marginBottom: 14, fontSize: 13 }}>
          {error}
        </div>
      )}
      {notice && (
        <div role="status" style={{ background: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: 8, padding: '10px 14px', color: '#276749', marginBottom: 14, fontSize: 13 }}>
          {notice}
        </div>
      )}

      <section
        aria-label="Bulk channel verification"
        style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16, padding: '12px 14px', background: '#fff', border: '1px solid #e6eaf0', borderRadius: 10 }}
      >
        <strong style={{ color: '#333', fontSize: 13 }}>{visibleSelectedCount} selected on this page</strong>
        <button
          type="button"
          onClick={() => applyBulkVerification('verified')}
          disabled={visibleSelectedCount === 0 || bulkBusy}
          style={{ ...pageBtn, background: '#e8f6ee', borderColor: '#b7dec6', color: '#21633c', fontWeight: 700, opacity: visibleSelectedCount === 0 || bulkBusy ? 0.55 : 1 }}
        >
          {bulkBusy ? 'Updating…' : 'Verify selected'}
        </button>
        <button
          type="button"
          onClick={() => applyBulkVerification('unverified')}
          disabled={visibleSelectedCount === 0 || bulkBusy}
          style={{ ...pageBtn, background: '#fff6e8', borderColor: '#ead6b2', color: '#7b581b', fontWeight: 700, opacity: visibleSelectedCount === 0 || bulkBusy ? 0.55 : 1 }}
        >
          Unverify selected
        </button>
        {visibleSelectedCount > 0 && (
          <button
            type="button"
            onClick={() => setSelectedCreators([])}
            disabled={bulkBusy}
            style={{ ...pageBtn, background: '#fff', color: '#666' }}
          >
            Clear selection
          </button>
        )}
      </section>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input
          style={{ ...inputStyle, maxWidth: 340 }}
          placeholder="Search by name, email, or channel…"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
        />
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead style={{ background: '#fafafa' }}>
            <tr>
              <th style={{ width: 42, textAlign: 'left', padding: '12px 12px', borderBottom: '1px solid #f0f0f0' }}>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleVisibleSelection}
                  aria-label="Select all visible YouTube channels"
                />
              </th>
              {['Name','Email','Channel','Subscribers','Total Views','Connected','Long-video verification','Actions'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '12px 16px', color: '#888', fontWeight: 500, fontSize: 12, borderBottom: '1px solid #f0f0f0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>Loading…</td></tr>
            ) : youtubers.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>No youtubers found</td></tr>
            ) : youtubers.map(u => (
              <tr key={u._id} style={{ borderBottom: '1px solid #f7f7f7' }}>
                <td style={{ padding: '12px' }}>
                  <input
                    type="checkbox"
                    checked={selectedCreators.includes(String(u._id))}
                    onChange={() => toggleSelection(u._id)}
                    aria-label={`Select ${u.channelName || u.name || 'YouTube channel'}`}
                  />
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                  <Link to={`/users/${u._id}`} style={{ color: '#111', textDecoration: 'none' }}>{u.name}</Link>
                </td>
                <td style={{ padding: '12px 16px', color: '#666' }}>{u.email}</td>
                <td style={{ padding: '12px 16px', color: '#888' }}>
                  {u.channelUrl
                    ? <a href={u.channelUrl} target="_blank" rel="noreferrer" style={{ color: '#555' }}>{u.channelName || u.channelUrl}</a>
                    : (u.channelName || '—')}
                </td>
                <td style={{ padding: '12px 16px', color: '#888' }}>{u.subscribers ?? 0}</td>
                <td style={{ padding: '12px 16px', color: '#888' }}>{u.totalViews ?? 0}</td>
                <td style={{ padding: '12px 16px', color: '#aaa', fontSize: 13 }}>
                  {u.connectedAt ? new Date(u.connectedAt).toLocaleDateString() : '—'}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ display: 'block', marginBottom: 7, color: u.videoVerificationStatus === 'verified' ? '#21633c' : '#777', fontSize: 12, fontWeight: 700 }}>
                    {u.videoVerificationStatus === 'verified' ? 'Channel verified' : u.videoVerificationStatus === 'pending' ? 'Pending review' : u.videoVerificationStatus === 'rejected' ? 'Rejected' : 'Channel not verified'}
                  </span>
                  <button
                    type="button"
                    disabled={Boolean(verificationBusy[u._id]) || bulkBusy}
                    onClick={() => {
                      const status = u.videoVerificationStatus === 'verified' ? 'unverified' : 'verified';
                      setCreatorVerification(u, status)
                        .then(() => setNotice(`${u.channelName || u.name || 'YouTube channel'} ${status === 'verified' ? 'verified' : 'unverified'} for creator eligibility. Video approval remains separate.`))
                        .catch(e => setError(e.message));
                    }}
                    style={{
                      ...pageBtn,
                      padding: '5px 9px',
                      background: u.videoVerificationStatus === 'verified' ? '#fff6e8' : '#e8f6ee',
                      borderColor: u.videoVerificationStatus === 'verified' ? '#ead6b2' : '#b7dec6',
                      color: u.videoVerificationStatus === 'verified' ? '#7b581b' : '#21633c',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {verificationBusy[u._id] ? 'Saving…' : u.videoVerificationStatus === 'verified' ? 'Unverify channel' : 'Verify channel'}
                  </button>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Link to={`/users/${u._id}`}
                      style={{ fontSize: 12, color: '#555', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: 6, textDecoration: 'none' }}>
                      Details
                    </Link>
                    <Link to={`/users/${u._id}/content`}
                      style={{ fontSize: 12, color: '#555', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: 6, textDecoration: 'none' }}>
                      📦 Content
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ display: 'flex', gap: 8, padding: '16px', justifyContent: 'center', borderTop: '1px solid #f0f0f0' }}>
            <button onClick={() => { setSelectedCreators([]); setPage(p => Math.max(1, p - 1)); }} disabled={page === 1} style={pageBtn}>← Prev</button>
            <span style={{ padding: '6px 12px', fontSize: 13, color: '#666' }}>{page} / {pages}</span>
            <button onClick={() => { setSelectedCreators([]); setPage(p => Math.min(pages, p + 1)); }} disabled={page === pages} style={pageBtn}>Next →</button>
          </div>
        )}
      </div>

      <h3 style={{ fontSize: 18, fontWeight: 700, margin: '32px 0 12px 0' }}>
        Manually Added Channel Requests ({partnerRequests.length})
      </h3>
      {partnerRequestsError && (
        <div role="alert" style={{ background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 8, padding: '10px 14px', color: '#c53030', marginBottom: 14, fontSize: 13 }}>
          {partnerRequestsError}
        </div>
      )}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead style={{ background: '#fafafa' }}>
            <tr>
              {['YouTube Channel', 'Advertiser', 'Package', 'Price', 'Requested'].map((heading) => (
                <th key={heading} style={{ textAlign: 'left', padding: '12px 16px', color: '#888', fontWeight: 500, fontSize: 12, borderBottom: '1px solid #f0f0f0' }}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {partnerRequestsLoading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: '#aaa' }}>Loading requests…</td></tr>
            ) : partnerRequests.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: '#aaa' }}>No manually added channel requests yet</td></tr>
            ) : partnerRequests.map((request) => (
              <tr key={request.id} style={{ borderBottom: '1px solid #f7f7f7' }}>
                <td style={{ padding: '12px 16px', fontWeight: 500 }}>{request.channel_names}</td>
                <td style={{ padding: '12px 16px' }}>
                  {request.full_name || request.email || '—'}
                  {request.full_name && request.email && <div style={{ color: '#aaa', fontSize: 12 }}>{request.email}</div>}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  {{
                    corner_ad: 'One 60-second Corner ad',
                    daily_30_days: 'Daily Corner ads for 30 days',
                    five_monthly: '5 Corner ads per month',
                    social_video: 'One video + social media promotion',
                    weekly: 'Weekly promotion (5 videos/month)',
                    thirty_days: '30-day promotion',
                  }[request.package_code] || request.package_code}
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>RWF {Number(request.package_price_rwf || 0).toLocaleString('en-US')}</td>
                <td style={{ padding: '12px 16px', color: '#888', fontSize: 13 }}>{new Date(request.updated_at || request.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const inputStyle = { display: 'block', border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '9px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' };
const pageBtn = { background: '#f4f5f7', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13 };
