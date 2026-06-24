// context/AdminAuthContext.js
import React, { createContext, useContext, useState } from 'react';

const AdminAuthContext = createContext();
export const useAdminAuth = () => useContext(AdminAuthContext);

// Obfuscated storage key — looks like an internal framework artifact
const _K = '__xnk_d';

const _read = () => {
  try { return JSON.parse(localStorage.getItem(_K)) || {}; } catch { return {}; }
};

export const AdminAuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!_read().t);
  const [adminSecret,     setAdminSecret]     = useState(() => _read().t || '');
  const [adminUser,       setAdminUser]       = useState(() => _read().r || '');

  const login = (secret, user) => {
    localStorage.setItem(_K, JSON.stringify({ t: secret, r: user }));
    setAdminSecret(secret);
    setAdminUser(user);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem(_K);
    setAdminSecret('');
    setAdminUser('');
    setIsAuthenticated(false);
  };

  // Headers sent on every protected admin API call — non-obvious names
  const adminHeaders = {
    'x-node-key':   adminSecret,
    'x-node-ref':   adminUser,
    'Content-Type': 'application/json',
  };

  return (
    <AdminAuthContext.Provider value={{ isAuthenticated, adminSecret, adminUser, login, logout, adminHeaders }}>
      {children}
    </AdminAuthContext.Provider>
  );
};
