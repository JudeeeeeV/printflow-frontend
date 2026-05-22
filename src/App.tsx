import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthPage } from './pages/AuthPage/AuthPage';
import { NewOrderPage } from './pages/NewOrderPage/NewOrderPage';

export const App: React.FC = () => {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Navigate to="/auth" replace />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/new-order" element={<NewOrderPage />} />
                <Route path="*" element={<Navigate to="/auth" replace />} />
            </Routes>
        </Router>
    );
};

export default App;