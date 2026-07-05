// admin/components/AdminLayout.js
import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';

const NAV = [
  { to: '/',        label: 'Dashboard', icon: '▦',  exact: true },
  { to: '/users',     label: 'Users',     icon: '👤' },
  { to: '/youtubers', label: 'Youtubers', icon: '▶️' },
  { to: '/grants',    label: 'Grants',    icon: '🎁' },
  { to: '/pricing',label: 'Pricing',   icon: '💲' },
  { to: '/hot-deals', label: 'Hot Deals', icon: '🔥' },
  { to: '/prospect-websites', label: 'Prospect Sites', icon: '🎯' },
];

export default function AdminLayout() {
  const { adminUser, logout } = useAdminAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif', background: '#f4f5f7' }}>
      {/* Sidebar */}
      <aside style={{
        width: sidebarOpen ? 240 : 64,
        background: '#0f0f0f',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s',
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 16px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {sidebarOpen && <span style={{ color: '#fff', fontWeight: 700, fontSize: 18, letterSpacing: -0.5 }}>Yepper Admin</span>}
          <button onClick={() => setSidebarOpen(o => !o)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 18, padding: 4 }}>
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 0' }}>
          {NAV.map(({ to, label, icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 20px',
                color: isActive ? '#fff' : '#888',
                background: isActive ? '#1a1a1a' : 'transparent',
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                borderLeft: isActive ? '3px solid #fff' : '3px solid transparent',
                transition: 'all 0.15s',
              })}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
              {sidebarOpen && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User row */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid #222' }}>
          {sidebarOpen && <div style={{ color: '#666', fontSize: 12, marginBottom: 8 }}>Signed in as <strong style={{ color: '#aaa' }}>{adminUser}</strong></div>}
          <button
            onClick={handleLogout}
            style={{ background: '#1a1a1a', border: '1px solid #333', color: '#aaa', cursor: 'pointer', padding: '8px 14px', borderRadius: 6, fontSize: 13, width: sidebarOpen ? '100%' : 'auto' }}
          >
            {sidebarOpen ? 'Sign out' : '⏻'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>
        <Outlet />
      </main>
    </div>
  );
}
