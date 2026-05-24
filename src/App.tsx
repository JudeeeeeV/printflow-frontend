import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthPage } from './pages/AuthPage/AuthPage';
import { NewOrderPage } from './pages/NewOrderPage/NewOrderPage';
import { CheckoutPage } from './pages/CheckoutPage/CheckoutPage';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { UnauthorizedPage } from './pages/UnauthorizedPage/UnauthorizedPage';
import { ShopDashboard } from './pages/ShopDashboard/ShopDashboard';
import { ShopLayout } from './components/layout/ShopLayout';
import { ShopAnalyticsPage } from './pages/ShopAnalyticsPage/ShopAnalyticsPage';
import { ShopOverviewPage } from './pages/ShopOverviewPage/ShopOverviewPage';
import { ShopArchivedPage } from './pages/ShopArchivedPage/ShopArchivedPage';
import { ShopOrdersPage } from './pages/ShopOrdersPage/ShopOrdersPage';
import { ShopInventoryPage } from './pages/ShopInventoryPage/ShopInventoryPage';
import { ShopSettingsPage } from './pages/ShopSettingsPage/ShopSettingsPage';

export const App: React.FC = () => {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Navigate to="/auth" replace />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/unauthorized" element={<UnauthorizedPage />} />
                <Route path="/new-order" element={
                    <ProtectedRoute allowedRoles={['Student']}>
                        <NewOrderPage />
                    </ProtectedRoute>
                } />
                <Route path="/checkout/:orderId" element={
                    <ProtectedRoute allowedRoles={['Student']}>
                        <CheckoutPage />
                    </ProtectedRoute>
                } />
                <Route path="/shop-dashboard" element={
                    <ProtectedRoute allowedRoles={['Print Shop']}>
                        <ShopLayout />
                    </ProtectedRoute>
                }>
                    <Route index element={<ShopDashboard />} />
                    <Route path="overview" element={<ShopOverviewPage />} />
                    <Route path="archived" element={<ShopArchivedPage />} />
                    <Route path="analytics" element={<ShopAnalyticsPage />} />
                    <Route path="orders" element={<ShopOrdersPage />} />
                    <Route path="inventory" element={<ShopInventoryPage />} />
                    <Route path="settings" element={<ShopSettingsPage />} />
                </Route>
                <Route path="*" element={<Navigate to="/auth" replace />} />
            </Routes>
        </Router>
    );
};

export default App;