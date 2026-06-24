// pages/AdminLogin.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';

const BASE = process.env.REACT_APP_API_URL || 'https://yepper-creators-api.onrender.com';

export default function AdminLogin() {
  const { login }       = useAdminAuth();
  const navigate        = useNavigate();
  const [ref,    setRef]    = useState('');
  const [cipher, setCipher] = useState('');
  const [error,  setError]  = useState('');
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  // Blinking cursor / animated dots
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 500);
    return () => clearInterval(id);
  }, []);
  const dots = '.'.repeat(tick % 4);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/admin/init`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ref: ref.trim(), token: cipher }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.code || 'REJECTED');
      login(cipher, ref.trim());
      navigate('/');
    } catch (err) {
      setError(`ERR_${err.message || 'NODE_AUTH'} — Authentication parameters rejected.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      {/* Subtle grid overlay */}
      <div style={styles.grid} />

      {/* Scanline overlay */}
      <div style={styles.scanlines} />

      <div style={styles.card}>
        {/* Top status bar */}
        <div style={styles.statusBar}>
          <span style={styles.statusDot} />
          <span style={{ color: 'rgba(74,222,128,0.5)', fontSize: 10, letterSpacing: 2 }}>
            SYS:DIAG // v2.4.1
          </span>
          <span style={{ marginLeft: 'auto', color: '#1e3a2a', fontSize: 10 }}>
            {new Date().toISOString().slice(0, 19).replace('T', ' ')}
          </span>
        </div>

        <div style={styles.header}>
          <div style={styles.title}>Node Configuration</div>
          <div style={styles.subtitle}>
            Restricted diagnostic interface{dots}
          </div>
        </div>

        <div style={styles.divider} />

        <form onSubmit={handleSubmit} autoComplete="off">
          {/* Node ref ID */}
          <div style={{ marginBottom: 20 }}>
            <label style={styles.label}>Node ref ID</label>
            <div style={styles.inputWrapper}>
              <span style={styles.inputPrefix}>›</span>
              <input
                value={ref}
                onChange={e => setRef(e.target.value)}
                placeholder="ref_xxxxxxxx"
                required
                autoComplete="off"
                spellCheck={false}
                style={styles.input}
              />
            </div>
          </div>

          {/* Auth cipher (the secret key) */}
          <div style={{ marginBottom: 24 }}>
            <label style={styles.label}>
              Auth cipher
              <span style={{ marginLeft: 8, color: '#1e3a2a', fontSize: 9, letterSpacing: 1 }}>
                [ENCRYPTED]
              </span>
            </label>
            <div style={styles.inputWrapper}>
              <span style={styles.inputPrefix}>›</span>
              <input
                type="password"
                value={cipher}
                onChange={e => setCipher(e.target.value)}
                placeholder="••••••••••••••••••••"
                required
                autoFocus
                autoComplete="new-password"
                style={styles.input}
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={styles.errorBox}>
              <span style={{ color: '#f87171', marginRight: 8 }}>✕</span>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.btn,
              ...(loading ? styles.btnDisabled : styles.btnActive),
            }}
          >
            {loading
              ? `> Authenticating${dots}`
              : '> Initialize Session _'}
          </button>
        </form>

        {/* Footer */}
        <div style={styles.footer}>
          <span>INTERNAL USE ONLY</span>
          <span>·</span>
          <span>UNAUTHORIZED ACCESS PROHIBITED</span>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const MONO = '"SF Mono","Fira Code","Cascadia Code",Menlo,Consolas,monospace';
const GREEN = 'rgba(74,222,128,';

const styles = {
  page: {
    minHeight: '100vh',
    background: '#050a06',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: MONO,
    position: 'relative',
    overflow: 'hidden',
  },
  grid: {
    position: 'fixed',
    inset: 0,
    backgroundImage:
      `linear-gradient(${GREEN}0.04) 1px,transparent 1px),` +
      `linear-gradient(90deg,${GREEN}0.04) 1px,transparent 1px)`,
    backgroundSize: '36px 36px',
    pointerEvents: 'none',
  },
  scanlines: {
    position: 'fixed',
    inset: 0,
    backgroundImage:
      'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.15) 2px,rgba(0,0,0,0.15) 4px)',
    pointerEvents: 'none',
  },
  card: {
    width: 420,
    border: `1px solid ${GREEN}0.18)`,
    borderRadius: 4,
    background: 'rgba(5,12,7,0.97)',
    padding: '28px 32px 24px',
    boxShadow: `0 0 60px ${GREEN}0.04), 0 0 0 1px ${GREEN}0.06)`,
    position: 'relative',
    zIndex: 1,
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    paddingBottom: 12,
    borderBottom: `1px solid ${GREEN}0.06)`,
  },
  statusDot: {
    display: 'inline-block',
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: GREEN + '0.7)',
    boxShadow: `0 0 8px ${GREEN}0.5)`,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    color: '#dcfce7',
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    color: '#1e4a2e',
    fontSize: 12,
    letterSpacing: 0.5,
    minHeight: 16,
  },
  divider: {
    height: 1,
    background: `linear-gradient(90deg,${GREEN}0.2),transparent)`,
    marginBottom: 24,
  },
  label: {
    display: 'block',
    color: '#166534',
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
    fontFamily: MONO,
  },
  inputWrapper: {
    display: 'flex',
    alignItems: 'center',
    border: `1px solid ${GREEN}0.12)`,
    borderRadius: 3,
    background: 'rgba(0,0,0,0.4)',
    transition: 'border-color 0.2s',
  },
  inputPrefix: {
    color: GREEN + '0.5)',
    fontSize: 16,
    paddingLeft: 12,
    paddingRight: 4,
    userSelect: 'none',
  },
  input: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    padding: '10px 12px 10px 4px',
    fontSize: 13,
    color: '#86efac',
    fontFamily: MONO,
    letterSpacing: 0.8,
  },
  errorBox: {
    color: '#fca5a5',
    fontSize: 11,
    letterSpacing: 0.3,
    marginBottom: 18,
    padding: '9px 12px',
    background: 'rgba(239,68,68,0.06)',
    border: '1px solid rgba(239,68,68,0.15)',
    borderRadius: 3,
    fontFamily: MONO,
    lineHeight: 1.5,
  },
  btn: {
    width: '100%',
    border: 'none',
    borderRadius: 3,
    padding: '12px 0',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 2,
    cursor: 'pointer',
    fontFamily: MONO,
    transition: 'all 0.2s',
  },
  btnActive: {
    background: GREEN + '0.12)',
    color: GREEN + '0.95)',
    border: `1px solid ${GREEN}0.3)`,
    boxShadow: `0 0 20px ${GREEN}0.08)`,
  },
  btnDisabled: {
    background: 'transparent',
    color: '#1e3a2a',
    border: '1px solid rgba(255,255,255,0.04)',
    cursor: 'not-allowed',
  },
  footer: {
    marginTop: 22,
    paddingTop: 14,
    borderTop: `1px solid ${GREEN}0.04)`,
    color: '#0d2116',
    fontSize: 9,
    letterSpacing: 1.5,
    display: 'flex',
    gap: 8,
    justifyContent: 'center',
  },
};
