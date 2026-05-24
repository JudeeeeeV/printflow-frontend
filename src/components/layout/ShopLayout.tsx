import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { ListTodo, BarChart3, HelpCircle, LifeBuoy, Settings, LogOut } from 'lucide-react';
import { apiClient } from '../../services/apiClient';

export const ShopLayout: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [shopName, setShopName] = useState<string>('Print Shop');
    
    const token = localStorage.getItem('jwt_token');
    const role = localStorage.getItem('user_role');

    useEffect(() => {
        const fetchShop = async () => {
            try {
                const data = await apiClient<any>('/shops/me', { method: 'GET' });
                if (data && data.name) {
                    setShopName(data.name);
                }
            } catch (err) {
                console.error("Failed to fetch shop name:", err);
            }
        };
        fetchShop();
    }, []);

    if (!token || role !== 'Print Shop') {
        return <Navigate to="/auth" replace />;
    }

    const handleLogout = () => {
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('user_role');
        navigate('/auth');
    };

    const navItems = [
        { name: 'Live Queue', path: '/shop-dashboard', icon: ListTodo, exact: true },
        { name: 'Analytics', path: '/shop-dashboard/analytics', icon: BarChart3 },
        { name: 'Settings', path: '/shop-dashboard/settings', icon: Settings },
    ];

    return (
        <div className="flex h-screen bg-gray-50 font-sans text-gray-800 overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 bg-[#F8F9FA] border-r border-gray-200 flex flex-col shrink-0 z-20">
                {/* Profile Section */}
                <div className="p-6 border-b border-gray-200 flex flex-col justify-center min-h-[80px]">
                    <h2 className="text-sm font-bold text-gray-900 truncate">{shopName}</h2>
                    <p className="text-xs text-gray-500">Shop Dashboard</p>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Menu</p>
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
                                    isActive
                                        ? 'bg-blue-50 text-blue-600'
                                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                }`}
                            >
                                <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-gray-200 space-y-1 shrink-0">
                    <Link to="#" className="flex items-center px-4 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-100 transition-colors">
                        <HelpCircle className="w-5 h-5 mr-3 text-gray-400" />
                        Help
                    </Link>
                    <Link to="#" className="flex items-center px-4 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-100 transition-colors">
                        <LifeBuoy className="w-5 h-5 mr-3 text-gray-400" />
                        Support
                    </Link>
                    <button onClick={handleLogout} className="w-full flex items-center px-4 py-2 text-sm font-medium text-red-600 rounded-md hover:bg-red-50 transition-colors mt-2">
                        <LogOut className="w-5 h-5 mr-3 text-red-500" />
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col overflow-hidden relative bg-white">
                {/* Content */}
                <div className="flex-1 overflow-y-auto bg-gray-50 flex flex-col relative">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};
