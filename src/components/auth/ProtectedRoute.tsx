import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
    const token = localStorage.getItem('jwt_token');
    const role = localStorage.getItem('user_role'); // e.g. 'Print Shop' or 'Student'
    const location = useLocation();

    if (!token) {
        // Redirect them to the /auth page, but save the current location they were
        // trying to go to if you want to implement redirect-after-login later.
        return <Navigate to="/auth" state={{ from: location }} replace />;
    }

    if (allowedRoles && (!role || !allowedRoles.includes(role))) {
        // User is logged in but doesn't have the required role
        return <Navigate to="/unauthorized" replace />;
    }

    return <>{children}</>;
};
