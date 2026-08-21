// AdminApp.js
import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import AdminLayout from './components/AdminLayout';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminYoutubers from './pages/AdminYoutubers';
import AdminUserDetail from './pages/AdminUserDetail';
import AdminGrants from './pages/AdminGrants';
import AdminUserContent from './pages/AdminUserContent';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import AdminPricing from './pages/AdminPricing';
import AdminHotDeals from './pages/AdminHotDeals';
import AdminHotDealBuilder from './pages/AdminHotDealBuilder';
import AdminProspectWebsites from './pages/AdminProspectWebsites';
import AdminAdSpacePreview from './pages/AdminAdSpacePreview';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});

const ProtectedAdminRoute = ({ children }) => {
  const { isAuthenticated } = useAdminAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminAuthProvider>
        <Routes>
          <Route path="/login" element={<AdminLogin />} />
          <Route path="/" element={
            <ProtectedAdminRoute>
              <AdminLayout />
            </ProtectedAdminRoute>
          }>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="youtubers" element={<AdminYoutubers />} />
            <Route path="users/:userId" element={<AdminUserDetail />} />
            <Route path="users/:userId/content" element={<AdminUserContent />} />
            <Route path="grants" element={<AdminGrants />} />
            <Route path="pricing" element={<AdminPricing />} />
            <Route path="hot-deals" element={<AdminHotDeals />} />
            <Route path="hot-deals/new" element={<AdminHotDealBuilder />} />
            <Route path="hot-deals/:id" element={<AdminHotDealBuilder />} />
            <Route path="prospect-websites" element={<AdminProspectWebsites />} />
            <Route path="ad-space-preview" element={<AdminAdSpacePreview />} />
          </Route>
        </Routes>
      </AdminAuthProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;
