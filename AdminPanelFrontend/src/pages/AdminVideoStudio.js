import React, { useCallback, useEffect, useRef, useState } from 'react';
import { adminFetch } from '../utils/adminApi';
import { useAdminAuth } from '../context/AdminAuthContext';

const panelStyle = {
  background: '#fff',
  border: '1px solid #e8eced',
  borderRadius: 16,
  boxShadow: '0 12px 32px rgba(13, 30, 42, 0.06)',
  padding: 22,
};

const buttonStyle = (background, color = '#fff') => ({
  border: 0,
  borderRadius: 10,
  background,
  color,
  cursor: 'pointer',
  fontWeight: 700,
  padding: '11px 16px',
  transition: 'transform 180ms ease, opacity 180ms ease',
});

const formatDuration = (seconds) => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(total / 3600)}h ${Math.floor((total % 3600) / 60)}m`;
};

const formatSize = (bytes) => `${(Number(bytes || 0) / 1024 ** 3).toFixed(2)} GB`;

function VideoStudioStat({ label, value, detail, accent = '#143a34' }) {
  return (
    <div style={{ ...panelStyle, minWidth: 170, flex: '1 1 190px', padding: '20px 22px' }}>
      <div style={{ color: '#75817f', fontSize: 12, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ color: accent, fontSize: 28, fontWeight: 800, letterSpacing: -0.8, marginTop: 10 }}>{value}</div>
      {detail && <div style={{ color: '#89928f', fontSize: 12, marginTop: 5 }}>{detail}</div>}
    </div>
  );
}

export default function AdminVideoStudio() {
  const { adminHeaders } = useAdminAuth();
  const headersRef = useRef(adminHeaders);
  headersRef.current = adminHeaders;
  const [queue, setQueue] = useState([]);
  const [creators, setCreators] = useState([]);
  const [plans, setPlans] = useState([]);
  const [summary, setSummary] = useState(null);
  const [enabled, setEnabled] = useState(false);
  const [environmentEnabled, setEnvironmentEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [rejectReasons, setRejectReasons] = useState({});
  const [creatorReasons, setCreatorReasons] = useState({});
  const [selectedPlans, setSelectedPlans] = useState({});

  const loadData = useCallback(async () => {
    setError('');
    try {
      const [queueResponse, creatorResponse, plansResponse, summaryResponse, switchResponse] = await Promise.all([
        adminFetch('/video-processing/queue', {}, headersRef.current),
        adminFetch('/video-processing/creators', {}, headersRef.current),
        adminFetch('/video-processing/plans', {}, headersRef.current),
        adminFetch('/video-processing/summary', {}, headersRef.current),
        adminFetch('/video-processing/kill-switch', {}, headersRef.current),
      ]);
      setQueue(queueResponse.data || []);
      setCreators(creatorResponse.data || []);
      setPlans((plansResponse.data || []).filter((plan) => plan.enabled));
      setSummary(summaryResponse.data || null);
      setEnabled(Boolean(switchResponse.data?.enabled));
      setEnvironmentEnabled(Boolean(switchResponse.data?.environmentEnabled));
    } catch (loadError) {
      setError(loadError.message || 'Could not load Video Studio administration.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const runAction = async (key, action, successMessage) => {
    setBusy(key);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(successMessage);
      await loadData();
    } catch (actionError) {
      setError(actionError.message || 'The requested action failed.');
    } finally {
      setBusy('');
    }
  };

  const decideJob = (job, decision) => {
    const reason = rejectReasons[job.id] || '';
    if (decision === 'reject' && !reason.trim()) {
      setError('Add a rejection reason before rejecting a video.');
      return;
    }
    const url = `/video-processing/jobs/${job.id}/${decision}`;
    runAction(`job-${job.id}`, () => adminFetch(url, {
      method: 'POST',
      body: decision === 'reject' ? JSON.stringify({ reason }) : JSON.stringify({}),
    }, adminHeaders), decision === 'approve' ? 'Video approved and processing started.' : 'Video rejected.');
  };

  const setVerification = (creator, status) => runAction(`verify-${creator.id}`, () => adminFetch(
    `/video-processing/creators/${creator.id}/verification`,
    {
      method: 'PUT',
      body: JSON.stringify({ status, reason: creatorReasons[creator.id] || '' }),
    },
    adminHeaders,
  ), `Creator verification updated to ${status}.`);

  const setSubscription = (creator, action) => {
    const planCode = selectedPlans[creator.id] || plans[0]?.code;
    if (action !== 'revoke' && !planCode) {
      setError('No enabled subscription plans are available.');
      return;
    }
    runAction(`plan-${creator.id}`, () => adminFetch(
      `/video-processing/creators/${creator.id}/subscription`,
      {
        method: 'POST',
        body: JSON.stringify({ action, planCode }),
      },
      adminHeaders,
    ), action === 'revoke' ? 'Subscription revoked.' : 'Subscription updated.');
  };

  const toggleProcessing = () => runAction(
    'kill-switch',
    () => adminFetch('/video-processing/kill-switch', {
      method: 'PUT',
      body: JSON.stringify({ enabled: !enabled }),
    }, adminHeaders),
    enabled ? 'New long-video processing is paused.' : 'Long-video processing is enabled.',
  );

  const savePlan = (plan) => runAction(`save-${plan.code}`, () => adminFetch(
    `/video-processing/plans/${plan.code}`,
    {
      method: 'PUT',
      body: JSON.stringify({ priceRwf: Number(plan.priceRwf), hoursIncluded: Number(plan.hoursIncluded) }),
    },
    adminHeaders,
  ), `${plan.name} configuration saved.`);

  const updatePlanField = (code, field, value) => {
    setPlans((current) => current.map((plan) => (plan.code === code ? { ...plan, [field]: value } : plan)));
  };

  if (loading) {
    return <div style={{ ...panelStyle, color: '#62706e' }} role="status">Loading Video Studio operations...</div>;
  }

  return (
    <div style={{ color: '#182b2a', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <header style={{ alignItems: 'flex-end', display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ color: '#aa833f', fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase' }}>Creator operations</div>
          <h1 style={{ fontSize: 32, letterSpacing: -1.2, margin: '7px 0 6px' }}>Video Studio</h1>
          <p style={{ color: '#75817f', margin: 0 }}>Review long-video jobs, protect processing credit, and manage creator access.</p>
        </div>
        <button type="button" onClick={loadData} style={buttonStyle('#eef3f1', '#183a34')}>Refresh data</button>
      </header>

      {error && <div role="alert" style={{ background: '#fff1ef', border: '1px solid #f4c2b9', borderRadius: 12, color: '#9b382c', marginBottom: 16, padding: 14 }}>{error}</div>}
      {notice && <div role="status" style={{ background: '#eff8f2', border: '1px solid #cce8d4', borderRadius: 12, color: '#286541', marginBottom: 16, padding: 14 }}>{notice}</div>}

      <section aria-label="Monthly processing summary" style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
        <VideoStudioStat
          label="Estimated monthly spend"
          value={`$${Number(summary?.spentUsd || 0).toFixed(2)} / $${Number(summary?.capUsd || 0).toFixed(2)}`}
          detail={`$${Number(summary?.reservedUsd || 0).toFixed(2)} reserved, $${Number(summary?.remainingUsd || 0).toFixed(2)} remaining`}
          accent={Number(summary?.remainingUsd || 0) <= 0 ? '#a43b32' : '#143a34'}
        />
        <VideoStudioStat label="Jobs this month" value={summary?.jobsThisMonth ?? 0} detail="Long-video jobs only" />
        <VideoStudioStat label="Hours used" value={`${Number(summary?.hoursUsedThisMonth || 0).toFixed(2)} h`} detail="Completed and reserved" />
        <VideoStudioStat label="Trial videos used" value={summary?.trialCreditsUsed ?? 0} detail="Successful trial jobs" />
        <div style={{ ...panelStyle, alignItems: 'center', display: 'flex', flex: '1 1 220px', justifyContent: 'space-between', minWidth: 220 }}>
          <div>
            <div style={{ color: '#75817f', fontSize: 12, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>Processing kill switch</div>
          <div style={{ color: enabled ? '#256a4c' : '#a43b32', fontSize: 19, fontWeight: 800, marginTop: 9 }}>{enabled ? 'Enabled' : environmentEnabled ? 'Paused' : 'Disabled by environment'}</div>
          </div>
        <button type="button" onClick={toggleProcessing} disabled={busy === 'kill-switch' || !environmentEnabled} style={buttonStyle(enabled ? '#9d3e35' : '#246c4c')}>
            {busy === 'kill-switch' ? 'Saving...' : enabled ? 'Pause jobs' : 'Enable jobs'}
          </button>
        </div>
      </section>

      {summary?.campaignSpend?.length > 0 && (
        <section style={{ ...panelStyle, marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, margin: '0 0 14px' }}>Spend by campaign</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {summary.campaignSpend.map((campaign) => (
              <div key={campaign.campaignId} style={{ background: '#f5f8f6', borderRadius: 10, padding: '12px 15px' }}>
                <strong>Campaign {campaign.campaignId}</strong>
                <div style={{ color: '#697673', fontSize: 13, marginTop: 5 }}>${Number(campaign.spendUsd).toFixed(2)} estimated, {campaign.jobs} jobs</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section style={{ ...panelStyle, marginBottom: 20 }}>
        <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 19, margin: '0 0 5px' }}>Approval queue</h2>
            <p style={{ color: '#7b8784', fontSize: 13, margin: 0 }}>No job is sent to MediaConvert until approved.</p>
          </div>
          <span style={{ background: '#fff5e3', borderRadius: 999, color: '#926819', fontSize: 12, fontWeight: 800, padding: '7px 11px' }}>{queue.length} awaiting review</span>
        </div>
        {queue.length === 0 ? (
          <div style={{ background: '#f6f8f7', borderRadius: 12, color: '#7b8784', padding: 22, textAlign: 'center' }}>The review queue is clear.</div>
        ) : queue.map((job) => (
          <article key={job.id} style={{ border: '1px solid #e8eeeb', borderRadius: 14, marginTop: 12, padding: 18 }}>
            <div style={{ alignItems: 'flex-start', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: 17, margin: '0 0 5px' }}>{job.title}</h3>
                <div style={{ color: '#66736f', fontSize: 13 }}>{job.creatorName} · {job.creatorEmail}</div>
                <div style={{ color: '#8a9592', fontSize: 12, marginTop: 7 }}>
                  {job.provider} · {formatDuration(job.durationSeconds)} · {formatSize(job.fileSizeBytes)} · {new Date(job.createdAt).toLocaleString()}
                </div>
                <div style={{ color: '#52625e', fontSize: 13, marginTop: 9 }}>
                  Estimated cost: <strong>${Number(job.estimatedCostUsd || 0).toFixed(2)} USD</strong>
                  {job.estimatedCostRwf ? ` (${Number(job.estimatedCostRwf).toLocaleString()} RWF)` : ''}
                  {job.verificationRequestUrl && <> · <a href={job.verificationRequestUrl} target="_blank" rel="noreferrer">Creator channel</a></>}
                </div>
              </div>
              <span style={{ background: job.verificationStatus === 'verified' ? '#eaf6ed' : '#fff1ef', borderRadius: 999, color: job.verificationStatus === 'verified' ? '#286541' : '#9b382c', fontSize: 11, fontWeight: 800, padding: '7px 10px' }}>
                Verification: {job.verificationStatus || 'unverified'}
              </span>
            </div>
            <label style={{ color: '#65726e', display: 'block', fontSize: 12, fontWeight: 700, margin: '14px 0 6px' }} htmlFor={`reject-${job.id}`}>Rejection reason, if needed</label>
            <textarea
              id={`reject-${job.id}`}
              value={rejectReasons[job.id] || ''}
              onChange={(event) => setRejectReasons((current) => ({ ...current, [job.id]: event.target.value }))}
              rows={2}
              style={{ border: '1px solid #dce5e1', borderRadius: 9, boxSizing: 'border-box', font: 'inherit', padding: 10, resize: 'vertical', width: '100%' }}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
              <button type="button" disabled={Boolean(busy)} onClick={() => decideJob(job, 'approve')} style={buttonStyle('#216b4b')}>Approve and process</button>
              <button type="button" disabled={Boolean(busy)} onClick={() => decideJob(job, 'reject')} style={buttonStyle('#a23f36')}>Reject video</button>
            </div>
          </article>
        ))}
      </section>

      <section style={{ ...panelStyle, marginBottom: 20 }}>
        <h2 style={{ fontSize: 19, margin: '0 0 15px' }}>Creator verification and plans</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: 900, width: '100%' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e7ece9', color: '#77837f', fontSize: 11, textAlign: 'left', textTransform: 'uppercase' }}>
                {['Creator', 'Verification', 'Trial used', 'Plan', 'Hours left', 'Quick actions'].map((heading) => <th key={heading} style={{ padding: '11px 9px' }}>{heading}</th>)}
              </tr>
            </thead>
            <tbody>
              {creators.map((creator) => (
                <tr key={creator.id} style={{ borderBottom: '1px solid #f0f3f1' }}>
                  <td style={{ padding: '13px 9px' }}>
                    <strong>{creator.full_name || 'Creator'}</strong>
                    <div style={{ color: '#86918e', fontSize: 12, marginTop: 3 }}>{creator.email}</div>
                  </td>
                  <td style={{ padding: '13px 9px' }}>
                    <span style={{ color: creator.video_verification_status === 'verified' ? '#286541' : '#926819', fontWeight: 700 }}>
                      {creator.video_verification_status || 'unverified'}
                    </span>
                  </td>
                  <td style={{ padding: '13px 9px' }}>{Number(creator.trial_used || 0)} / 3</td>
                  <td style={{ padding: '13px 9px' }}>
                    {creator.plan_code || 'No active plan'}
                    {creator.requested_plan && (
                      <div style={{ color: '#926819', fontSize: 11, marginTop: 4 }}>Request: {creator.requested_plan}</div>
                    )}
                  </td>
                  <td style={{ padding: '13px 9px' }}>{creator.hours_left == null ? '-' : Number(creator.hours_left).toFixed(2)}</td>
                  <td style={{ minWidth: 365, padding: '13px 9px' }}>
                    <label htmlFor={`verify-reason-${creator.id}`} style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>Admin note or rejection reason</label>
                    <input
                      id={`verify-reason-${creator.id}`}
                      value={creatorReasons[creator.id] || ''}
                      onChange={(event) => setCreatorReasons((current) => ({ ...current, [creator.id]: event.target.value }))}
                      style={{ border: '1px solid #dce5e1', borderRadius: 7, marginBottom: 7, padding: 8, width: '100%' }}
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <button type="button" disabled={Boolean(busy)} onClick={() => setVerification(creator, 'verified')} style={{ ...buttonStyle('#246c4c'), fontSize: 11, padding: '8px 10px' }}>Verify</button>
                      <button type="button" disabled={Boolean(busy)} onClick={() => setVerification(creator, 'rejected')} style={{ ...buttonStyle('#a23f36'), fontSize: 11, padding: '8px 10px' }}>Reject</button>
                      {plans.length > 0 && (
                        <>
                          <select
                            aria-label={`Plan for ${creator.full_name || creator.email}`}
                            value={selectedPlans[creator.id] || creator.requested_plan || plans[0].code}
                            onChange={(event) => setSelectedPlans((current) => ({ ...current, [creator.id]: event.target.value }))}
                            style={{ border: '1px solid #dce5e1', borderRadius: 7, padding: '7px 8px' }}
                          >
                            {plans.map((plan) => <option key={plan.code} value={plan.code}>{plan.name}</option>)}
                          </select>
                          <button type="button" disabled={Boolean(busy)} onClick={() => setSubscription(creator, 'grant')} style={{ ...buttonStyle('#183a34'), fontSize: 11, padding: '8px 10px' }}>Grant or change</button>
                        </>
                      )}
                      {creator.subscription_status === 'active' && (
                        <button type="button" disabled={Boolean(busy)} onClick={() => setSubscription(creator, 'revoke')} style={{ ...buttonStyle('#eef3f1', '#354642'), fontSize: 11, padding: '8px 10px' }}>Revoke plan</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={panelStyle}>
        <h2 style={{ fontSize: 19, margin: '0 0 14px' }}>Plan configuration</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {plans.map((plan) => (
            <div key={plan.code} style={{ background: '#f6f8f7', borderRadius: 12, flex: '1 1 230px', padding: 16 }}>
              <strong>{plan.name}</strong>
              <label style={{ color: '#687571', display: 'block', fontSize: 12, marginTop: 11 }}>
                Monthly price in RWF
                <input type="number" min="0" value={plan.priceRwf} onChange={(event) => updatePlanField(plan.code, 'priceRwf', event.target.value)} style={{ border: '1px solid #dce5e1', borderRadius: 7, boxSizing: 'border-box', display: 'block', marginTop: 5, padding: 8, width: '100%' }} />
              </label>
              <label style={{ color: '#687571', display: 'block', fontSize: 12, marginTop: 9 }}>
                Included hours
                <input type="number" min="0.01" step="0.25" value={plan.hoursIncluded} onChange={(event) => updatePlanField(plan.code, 'hoursIncluded', event.target.value)} style={{ border: '1px solid #dce5e1', borderRadius: 7, boxSizing: 'border-box', display: 'block', marginTop: 5, padding: 8, width: '100%' }} />
              </label>
              <button type="button" disabled={Boolean(busy)} onClick={() => savePlan(plan)} style={{ ...buttonStyle('#183a34'), marginTop: 12, width: '100%' }}>Save plan</button>
            </div>
          ))}
          {plans.length === 0 && <p style={{ color: '#7b8784' }}>No plans are enabled. Pro is hidden until PLAN_PRO_ENABLED is true.</p>}
        </div>
      </section>
    </div>
  );
}
