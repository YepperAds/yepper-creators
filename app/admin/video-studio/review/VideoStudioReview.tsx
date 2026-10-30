'use client';

import { FormEvent, useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://yepper-creators-api.onrender.com';

export default function VideoStudioReview() {
  const [jobId, setJobId] = useState('');
  const [decision, setDecision] = useState<'approve' | 'reject'>('approve');
  const [token, setToken] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setJobId(params.get('jobId') || '');
    setDecision(params.get('decision') === 'reject' ? 'reject' : 'approve');
    setToken(params.get('token') || '');
  }, []);

  const submitDecision = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!jobId || !/^[a-f0-9]{64}$/i.test(token)) {
      setError('This review link is invalid or incomplete.');
      return;
    }
    if (decision === 'reject' && !reason.trim()) {
      setError('Enter a reason before rejecting this video.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/video-processing/decision-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: Number(jobId), decision, token, reason }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'The review action could not be completed.');
      }
      setMessage(result.message || (decision === 'approve' ? 'The video was approved.' : 'The video was rejected.'));
      setToken('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The review action could not be completed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={{
      alignItems: 'center',
      background: 'radial-gradient(circle at 15% 10%, rgba(185, 145, 75, 0.16), transparent 34%), #071a1a',
      boxSizing: 'border-box',
      color: '#edf4ef',
      display: 'flex',
      fontFamily: 'Inter, Arial, sans-serif',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: 24,
    }}>
      <form
        onSubmit={submitDecision}
        style={{
          background: 'linear-gradient(145deg, rgba(20, 45, 41, 0.98), rgba(11, 29, 29, 0.98))',
          border: '1px solid rgba(220, 230, 219, 0.15)',
          borderRadius: 22,
          boxShadow: '0 26px 80px rgba(0, 0, 0, 0.34)',
          maxWidth: 520,
          padding: 32,
          width: '100%',
        }}
      >
        <div style={{ color: '#d4ae69', fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase' }}>Yepper creator operations</div>
        <h1 style={{ fontSize: 30, letterSpacing: -1, margin: '12px 0 8px' }}>Video review</h1>
        <p style={{ color: '#adbfba', fontSize: 14, lineHeight: 1.65, margin: '0 0 24px' }}>
          Confirm the review action for long-video job {jobId || '...'}.
        </p>
        {decision === 'reject' && (
          <label style={{ color: '#d6e0db', display: 'block', fontSize: 13, fontWeight: 700 }}>
            Rejection reason
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={1000}
              required
              rows={4}
              style={{
                background: 'rgba(0, 0, 0, 0.18)',
                border: '1px solid rgba(220, 230, 219, 0.2)',
                borderRadius: 10,
                boxSizing: 'border-box',
                color: '#fff',
                display: 'block',
                font: 'inherit',
                marginTop: 8,
                padding: 12,
                resize: 'vertical',
                width: '100%',
              }}
            />
          </label>
        )}
        {error && <p role="alert" style={{ background: 'rgba(150, 49, 42, 0.2)', border: '1px solid rgba(237, 129, 116, 0.3)', borderRadius: 10, color: '#ffd0ca', padding: 12 }}>{error}</p>}
        {message && <p role="status" style={{ background: 'rgba(42, 118, 79, 0.2)', border: '1px solid rgba(117, 204, 151, 0.3)', borderRadius: 10, color: '#c4f1d2', padding: 12 }}>{message}</p>}
        <button
          type="submit"
          disabled={submitting || !token}
          style={{
            background: decision === 'approve' ? '#c29a55' : '#a7473d',
            border: 0,
            borderRadius: 10,
            color: '#081514',
            cursor: submitting || !token ? 'not-allowed' : 'pointer',
            fontSize: 14,
            fontWeight: 800,
            marginTop: 18,
            opacity: submitting || !token ? 0.65 : 1,
            padding: '13px 18px',
            width: '100%',
          }}
        >
          {submitting ? 'Submitting review...' : decision === 'approve' ? 'Approve and start processing' : 'Reject video'}
        </button>
      </form>
    </main>
  );
}
