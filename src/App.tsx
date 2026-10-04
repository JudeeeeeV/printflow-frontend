import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthPage } from './pages/AuthPage/AuthPage';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { UnauthorizedPage } from './pages/UnauthorizedPage/UnauthorizedPage';
import { LoadingSpinner } from './components/common/LoadingSpinner';
import { shopService } from './services/shopService';

// Keep the sign-in page small; load each workspace only when it is visited.
const MicrosoftCallbackPage = lazy(() => import('./pages/AuthPage/MicrosoftCallbackPage').then(m => ({ default: m.MicrosoftCallbackPage })));
const NewOrderPage = lazy(() => {
 // Fetch the directory while the order-page chunk downloads, instead of after it mounts.
 void shopService.getShops().catch(() => undefined);
 return import('./pages/NewOrderPage/NewOrderPage').then(m => ({ default: m.NewOrderPage }));
});
const CheckoutPage = lazy(() => import('./pages/CheckoutPage/CheckoutPage').then(m => ({ default: m.CheckoutPage })));
const ShopDashboard = lazy(() => import('./pages/ShopDashboard/ShopDashboard').then(m => ({ default: m.ShopDashboard })));
const ShopLayout = lazy(() => import('./components/layout/ShopLayout').then(m => ({ default: m.ShopLayout })));
const ShopAnalyticsPage = lazy(() => import('./pages/ShopAnalyticsPage/ShopAnalyticsPage').then(m => ({ default: m.ShopAnalyticsPage })));
const ShopOverviewPage = lazy(() => import('./pages/ShopOverviewPage/ShopOverviewPage').then(m => ({ default: m.ShopOverviewPage })));
const ShopArchivedPage = lazy(() => import('./pages/ShopArchivedPage/ShopArchivedPage').then(m => ({ default: m.ShopArchivedPage })));
const ShopOrdersPage = lazy(() => import('./pages/ShopOrdersPage/ShopOrdersPage').then(m => ({ default: m.ShopOrdersPage })));
const ShopInventoryPage = lazy(() => import('./pages/ShopInventoryPage/ShopInventoryPage').then(m => ({ default: m.ShopInventoryPage })));
const ShopSettingsPage = lazy(() => import('./pages/ShopSettingsPage/ShopSettingsPage').then(m => ({ default: m.ShopSettingsPage })));
const ShopPrinterAgentPage = lazy(() => import('./pages/ShopPrinterAgentPage/ShopPrinterAgentPage').then(m => ({ default: m.ShopPrinterAgentPage })));

export const App: React.FC = () => {
 return (
 <Router>
 <Suspense fallback={<LoadingSpinner message="Loading page..." />}>
 <Routes>
 <Route path="/" element={<Navigate to="/auth" replace />} />
 <Route path="/auth" element={<AuthPage />} />
 <Route path="/auth/microsoft/callback" element={<MicrosoftCallbackPage />} />
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
 <Route path="printer-agent" element={<ShopPrinterAgentPage />} />
 <Route path="orders" element={<ShopOrdersPage />} />
 <Route path="inventory" element={<ShopInventoryPage />} />
 <Route path="settings" element={<ShopSettingsPage />} />
 </Route>
 <Route path="*" element={<Navigate to="/auth" replace />} />
 </Routes>
 </Suspense>
 </Router>
 );
};

export default App;
