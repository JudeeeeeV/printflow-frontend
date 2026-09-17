import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { List, ChartBar, Help, HelpDesk, Settings, Logout, Close, UserProfile, Printer } from '@carbon/icons-react';
import { apiClient } from '../../services/apiClient';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';
import printflowLogo from '../../assets/printflowLogo.png';

export const ShopLayout: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [shopName, setShopName] = useState<string>('Print Shop');
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const [isSupportOpen, setIsSupportOpen] = useState(false);
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

    const role = localStorage.getItem('user_role');

    useEffect(() => {
        const fetchShop = async () => {
            try {
                const data = await apiClient<{ name?: string }>('/shops/me', { method: 'GET' });
                if (data && data.name) {
                    setShopName(data.name);
                }
            } catch (err) {
                console.error("Failed to fetch shop name:", err);
            }
        };
        fetchShop();
    }, []);

    if (role !== 'Print Shop') {
        return <Navigate to="/auth" replace />;
    }

    const handleLogout = async () => {
        await apiClient('/auth/logout', { method: 'POST' }).catch(() => undefined);
        localStorage.removeItem('user_role');
        navigate('/auth');
    };

    const navItems = [
        { name: 'Live Queue', path: '/shop-dashboard', icon: List, exact: true },
        { name: 'Analytics', path: '/shop-dashboard/analytics', icon: ChartBar },
        { name: 'Printer Agent', path: '/shop-dashboard/printer-agent', icon: Printer },
        { name: 'Settings', path: '/shop-dashboard/settings', icon: Settings },
    ];

    return (
        <div className="flex h-screen bg-carbon-gray-10 font-sans text-gray-800 overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 bg-[#F8F9FA] border-r border-[#e0e0e0] flex flex-col shrink-0 z-20">
                <div className="shrink-0 px-6 pt-4">
                    <img src={printflowLogo} alt="Printflow Logo" className="mx-auto block h-auto w-48 max-w-full" />
                </div>

                {/* Profile Section */}
                <div className="pl-6 border-b border-[#e0e0e0] flex flex-col justify-center min-h-[80px]">
                    <h2 className="text-lg font-bold text-carbon-gray-100 truncate">{shopName}</h2>
                    <p className="text-sm text-gray-500">Shop Dashboard</p>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    <p className="px-4 text-xs font-semibold text-black uppercase tracking-wider mb-2">Menu</p>
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center px-4 py-2.5 text-sm font-medium transition-colors ${isActive
                                    ? 'bg-blue-100 text-blue-600'
                                    : 'text-black hover:bg-gray-100'
                                    }`}
                            >
                                <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-blue-600' : 'text-black'}`} />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-[#e0e0e0] space-y-2 shrink-0">
                    <button onClick={() => setIsChangePasswordOpen(true)} className="w-full flex items-center px-4 py-2 text-sm font-medium text-black hover:bg-gray-100 transition-colors">
                        <UserProfile className="w-5 h-5 mr-3 text-black" />
                        Account Settings
                    </button>
                    <button onClick={() => setIsHelpOpen(true)} className="w-full flex items-center px-4 py-2 text-sm font-medium text-black hover:bg-gray-100 transition-colors">
                        <Help className="w-5 h-5 mr-3 text-black" />
                        Help
                    </button>
                    <button onClick={() => setIsSupportOpen(true)} className="w-full flex items-center px-4 py-2 text-sm font-medium text-black hover:bg-gray-100 transition-colors">
                        <HelpDesk className="w-5 h-5 mr-3 text-black" />
                        Support
                    </button>
                    <button onClick={handleLogout} className="mt-4 flex w-full items-center justify-center bg-carbon-blue-60 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-carbon-blue-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60">
                        <Logout className="w-5 h-5 mr-2" />
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col overflow-hidden relative bg-white">
                {/* Content */}
                <div className="flex-1 overflow-y-auto bg-carbon-gray-10 flex flex-col relative">
                    <Outlet />
                </div>
            </main>

            {/* Help Modal */}
            {isHelpOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setIsHelpOpen(false)}>
                    <div className="bg-white w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center border-b border-gray-200 pb-4 mb-4">
                            <h3 className="text-lg font-bold text-carbon-gray-100">Help Center</h3>
                            <button onClick={() => setIsHelpOpen(false)} className="text-gray-400 hover:text-carbon-gray-100">
                                <Close className="w-6 h-6" />
                            </button>
                        </div>
                        <p className="text-sm text-gray-600 mb-6">
                            Welcome to the Printflow Shop Dashboard. Here you can manage your live print queue, view analytics, and configure your shop settings.
                        </p>
                        <div className="flex justify-end">
                            <button onClick={() => setIsHelpOpen(false)} className="px-6 py-2 bg-carbon-gray-100 text-white text-sm font-bold hover:bg-black transition-colors">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Support Modal */}
            {isSupportOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setIsSupportOpen(false)}>
                    <div className="bg-white w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center border-b border-gray-200 pb-4 mb-4">
                            <h3 className="text-lg font-bold text-carbon-gray-100">Contact Support</h3>
                            <button onClick={() => setIsSupportOpen(false)} className="text-gray-400 hover:text-carbon-gray-100">
                                <Close className="w-6 h-6" />
                            </button>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">
                            If you're experiencing technical difficulties or have billing inquiries, please reach out to our support team.
                        </p>
                        <div className="bg-gray-50 p-4 border border-gray-200 mb-6">
                            <p className="text-sm font-semibold text-carbon-gray-100">Email: printflow@gmail.com</p>
                            {/* <p className="text-sm font-semibold text-carbon-gray-100 mt-2">Phone: +1 (800) 555-0199</p> */}
                        </div>
                        <div className="flex justify-end">
                            <button onClick={() => setIsSupportOpen(false)} className="px-6 py-2 bg-carbon-gray-100 text-white text-sm font-bold hover:bg-black transition-colors">
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Change Password Modal */}
            {isChangePasswordOpen && (
                <ChangePasswordModal onClose={() => setIsChangePasswordOpen(false)} />
            )}
        </div>
    );
};
