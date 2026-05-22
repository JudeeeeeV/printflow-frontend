import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthPage } from './pages/AuthPage/AuthPage';
import { NewOrderPage } from './pages/NewOrderPage/NewOrderPage';
import { CheckoutPage } from './pages/CheckoutPage/CheckoutPage';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { UnauthorizedPage } from './pages/UnauthorizedPage/UnauthorizedPage';

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
                <Route path="*" element={<Navigate to="/auth" replace />} />
            </Routes>
        </Router>
    );
};

export default App;