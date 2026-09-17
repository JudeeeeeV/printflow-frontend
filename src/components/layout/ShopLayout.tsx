import React, { useEffect, useRef, useState } from 'react';
import { Navigate, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { List, ChartBar, Help, HelpDesk, Settings, Logout, Close, UserProfile, Printer, Menu } from '@carbon/icons-react';
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
    const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
    const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
    const [drawerRoute, setDrawerRoute] = useState<string | null>(null);
    const [tooltip, setTooltip] = useState<{ label: string; top: number } | null>(null);
    const hamburgerRef = useRef<HTMLButtonElement>(null);
    const sidebarRef = useRef<HTMLElement>(null);
    const mainRef = useRef<HTMLElement>(null);
    const modalTriggerRef = useRef<HTMLElement | null>(null);
    const isDrawerOpen = !isDesktop && drawerRoute === location.key;
    const collapsed = isDesktop && isDesktopCollapsed;
    const isAccountModalOpen = isHelpOpen || isSupportOpen || isChangePasswordOpen;

    // A history navigation must not reopen an old drawer when returning to this route.
    if (drawerRoute !== null && drawerRoute !== location.key) setDrawerRoute(null);

    useEffect(() => {
        const media = window.matchMedia('(min-width: 1024px)');
        const onChange = () => {
            setIsDesktop(media.matches);
            setDrawerRoute(null);
            setTooltip(null);
            if (sidebarRef.current?.contains(document.activeElement)) hamburgerRef.current?.focus();
        };
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
    }, []);

    useEffect(() => {
        if (!isDrawerOpen) return;
        const sidebar = sidebarRef.current;
        const focusFrame = requestAnimationFrame(() => sidebar?.querySelector<HTMLButtonElement>('button')?.focus());
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                setDrawerRoute(null);
                requestAnimationFrame(() => hamburgerRef.current?.focus());
            }
            if (event.key !== 'Tab' || !sidebar) return;
            const controls = Array.from(sidebar.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && (document.activeElement === first || !sidebar.contains(document.activeElement))) {
                event.preventDefault();
                last?.focus();
            } else if (!event.shiftKey && (document.activeElement === last || !sidebar.contains(document.activeElement))) {
                event.preventDefault();
                first?.focus();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            cancelAnimationFrame(focusFrame);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isDrawerOpen]);

    // Transfer focus from navigation to the account dialog without a competing drawer trap.
    useEffect(() => {
        if (!isAccountModalOpen) return;
        const hamburger = hamburgerRef.current;
        const modalTrigger = modalTriggerRef.current;
        const dialog = document.querySelector<HTMLElement>('[data-shop-account-dialog], [aria-labelledby="change-password-title"]');
        const controls = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href]') || []).filter(el => el.getClientRects().length > 0);
        controls()[0]?.focus();
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsHelpOpen(false);
                setIsSupportOpen(false);
                setIsChangePasswordOpen(false);
            }
            if (event.key !== 'Tab') return;
            const items = controls();
            const first = items[0];
            const last = items[items.length - 1];
            if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) {
                event.preventDefault();
                last?.focus();
            } else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) {
                event.preventDefault();
                first?.focus();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            requestAnimationFrame(() => {
                const trigger = modalTrigger;
                if (trigger?.getClientRects().length && !trigger.closest('[inert]')) trigger.focus();
                else hamburger?.focus();
            });
        };
    }, [isAccountModalOpen]);

    const token = localStorage.getItem('jwt_token');
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

    if (!token || role !== 'Print Shop') {
        return <Navigate to="/auth" replace />;
    }

    const handleLogout = () => {
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('user_role');
        navigate('/auth');
    };

    const navItems = [
        { name: 'Live Queue', path: '/shop-dashboard', icon: List, exact: true },
        { name: 'Analytics', path: '/shop-dashboard/analytics', icon: ChartBar },
        { name: 'Printer Agent', path: '/shop-dashboard/printer-agent', icon: Printer },
        { name: 'Settings', path: '/shop-dashboard/settings', icon: Settings },
    ];

    const closeDrawer = () => {
        setDrawerRoute(null);
        requestAnimationFrame(() => hamburgerRef.current?.focus());
    };
    const openAccountModal = (event: React.MouseEvent<HTMLButtonElement>, open: () => void) => {
        modalTriggerRef.current = isDesktop ? event.currentTarget : hamburgerRef.current;
        setDrawerRoute(null);
        setTooltip(null);
        open();
    };
    const showTooltip = (event: React.FocusEvent<HTMLElement> | React.MouseEvent<HTMLElement>) => {
        if (!collapsed) return;
        const target = (event.target as HTMLElement).closest<HTMLElement>('[data-nav-label]');
        if (target) setTooltip({ label: target.dataset.navLabel || '', top: target.getBoundingClientRect().top });
    };
    const controlClass = `flex min-h-11 w-full items-center text-sm font-medium transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-carbon-blue-60 ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'}`;
    const labelClass = `whitespace-nowrap overflow-hidden transition-[opacity] duration-200 ease-out motion-reduce:transition-none ${collapsed ? 'w-0 opacity-0' : 'opacity-100'}`;

    return (
        <div className="flex h-screen supports-[height:100dvh]:h-dvh flex-col overflow-hidden bg-carbon-gray-10 font-sans text-gray-800">
            <a href="#shop-main-content" onClick={() => mainRef.current?.focus()} className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[110] focus:bg-carbon-blue-60 focus:px-4 focus:py-3 focus:text-white">Skip to content</a>
            <header inert={isDrawerOpen || isAccountModalOpen} className="z-20 flex h-16 shrink-0 items-center gap-2 border-b border-[#e0e0e0] bg-[#F8F9FA] px-3 sm:px-4">
                <button ref={hamburgerRef} type="button" onClick={() => {
                    setTooltip(null);
                    if (isDesktop) setIsDesktopCollapsed(value => !value);
                    else setDrawerRoute(location.key);
                }} aria-label={isDesktop ? (collapsed ? 'Expand navigation' : 'Collapse navigation') : 'Open navigation'} aria-expanded={isDesktop ? !collapsed : isDrawerOpen} aria-controls="shop-navigation" className="flex h-11 w-11 shrink-0 items-center justify-center text-black transition-colors hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-carbon-blue-60 motion-reduce:transition-none">
                    <Menu className="h-6 w-6" aria-hidden="true" />
                </button>
                <img src={printflowLogo} alt="PrintFlow" width={1669} height={560} className="block h-auto w-40 sm:w-44" />
            </header>
            <div className="flex min-h-0 min-w-0 flex-1">
            <div aria-hidden="true" onClick={closeDrawer} className={`fixed inset-0 z-30 bg-black/50 transition-opacity duration-[250ms] ease-out motion-reduce:transition-none lg:hidden ${isDrawerOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`} />
            {/* Sidebar */}
            <aside ref={sidebarRef} id="shop-navigation" role={isDesktop ? undefined : 'dialog'} aria-modal={isDrawerOpen || undefined} aria-label="Shop navigation" inert={(!isDesktop && !isDrawerOpen) || isAccountModalOpen} onFocusCapture={showTooltip} onMouseOver={showTooltip} onBlurCapture={() => setTooltip(null)} onMouseLeave={() => setTooltip(null)} onScroll={() => setTooltip(null)} className={`fixed inset-y-0 left-0 z-40 flex max-w-[85vw] shrink-0 flex-col overflow-y-auto overscroll-contain border-r border-[#e0e0e0] bg-[#F8F9FA] transition-[transform,opacity] duration-[250ms] ease-out motion-reduce:transition-none lg:static lg:translate-x-0 lg:pointer-events-auto lg:opacity-100 lg:transition-[width] lg:duration-[250ms] lg:ease-out ${collapsed ? 'w-[72px]' : 'w-64'} ${isDrawerOpen ? 'translate-x-0 opacity-100' : 'pointer-events-none -translate-x-full opacity-0'}`}>
                <div className="flex h-16 shrink-0 items-center gap-2 border-b border-[#e0e0e0] px-3 lg:hidden">
                    <button type="button" onClick={closeDrawer} aria-label="Close navigation" className="flex h-11 w-11 shrink-0 items-center justify-center hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-carbon-blue-60"><Close className="h-6 w-6" aria-hidden="true" /></button>
                    <img src={printflowLogo} alt="PrintFlow" width={1669} height={560} className="h-auto w-40 min-w-0" />
                </div>

                {/* Profile Section */}
                <div className={`shrink-0 border-b border-[#e0e0e0] overflow-hidden transition-[max-height,opacity,padding] duration-[250ms] ease-out motion-reduce:transition-none ${collapsed ? 'max-h-0 opacity-0 py-0' : 'max-h-24 opacity-100 px-6 py-3'}`}>
                    <h2 className="text-lg font-bold text-carbon-gray-100 truncate">{shopName}</h2>
                    <p className="text-sm text-gray-500">Shop Dashboard</p>
                </div>

                <nav aria-label="Shop pages" className={`flex-1 space-y-1 py-4 ${collapsed ? 'px-2' : 'px-4'}`}>
                    <p className={`overflow-hidden transition-[max-height,opacity] duration-[250ms] ease-out motion-reduce:transition-none ${collapsed ? 'max-h-0 opacity-0' : 'max-h-8 opacity-100 mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-black'}`}>Menu</p>
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                aria-current={isActive ? 'page' : undefined}
                                data-nav-label={item.name}
                                onClick={() => {
                                    setDrawerRoute(null);
                                    setTooltip(null);
                                    if (!isDesktop) requestAnimationFrame(() => mainRef.current?.focus());
                                }}
                                className={`${controlClass} py-2.5 ${isActive
                                    ? 'bg-blue-100 text-blue-600'
                                    : 'text-black hover:bg-gray-100'
                                    }`}
                            >
                                <Icon aria-hidden="true" className={`h-5 w-5 shrink-0 ${isActive ? 'text-blue-600' : 'text-black'}`} />
                                <span className={labelClass}>{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className={`shrink-0 space-y-2 border-t border-[#e0e0e0] py-4 ${collapsed ? 'px-2' : 'px-4'}`}>
                    <button data-nav-label="Account Settings" onClick={event => openAccountModal(event, () => setIsChangePasswordOpen(true))} className={`${controlClass} py-2 text-black hover:bg-gray-100`}>
                        <UserProfile aria-hidden="true" className="h-5 w-5 shrink-0 text-black" />
                        <span className={labelClass}>Account Settings</span>
                    </button>
                    <button data-nav-label="Help" onClick={event => openAccountModal(event, () => setIsHelpOpen(true))} className={`${controlClass} py-2 text-black hover:bg-gray-100`}>
                        <Help aria-hidden="true" className="h-5 w-5 shrink-0 text-black" />
                        <span className={labelClass}>Help</span>
                    </button>
                    <button data-nav-label="Support" onClick={event => openAccountModal(event, () => setIsSupportOpen(true))} className={`${controlClass} py-2 text-black hover:bg-gray-100`}>
                        <HelpDesk aria-hidden="true" className="h-5 w-5 shrink-0 text-black" />
                        <span className={labelClass}>Support</span>
                    </button>
                    <button data-nav-label="Logout" onClick={handleLogout} className={`${controlClass} mt-4 justify-center bg-carbon-blue-60 py-2.5 font-bold text-white hover:bg-carbon-blue-70`}>
                        <Logout aria-hidden="true" className="h-5 w-5 shrink-0" />
                        <span className={labelClass}>Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main ref={mainRef} id="shop-main-content" tabIndex={-1} inert={isDrawerOpen || isAccountModalOpen} className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white focus:outline-none">
                {/* Content */}
                <div data-shop-scroll className={`relative min-h-0 min-w-0 flex-1 overflow-x-hidden bg-carbon-gray-10 ${isDrawerOpen || isAccountModalOpen ? 'overflow-y-hidden' : 'overflow-y-auto'}`}>
                    <Outlet />
                </div>
            </main>
            </div>
            {collapsed && tooltip && <div role="tooltip" className="pointer-events-none fixed left-[76px] z-50 bg-carbon-gray-100 px-3 py-2 text-sm text-white shadow-lg" style={{ top: tooltip.top }}>{tooltip.label}</div>}

            {/* Help Modal */}
            {isHelpOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setIsHelpOpen(false)}>
                    <div data-shop-account-dialog role="dialog" aria-modal="true" aria-label={isHelpOpen ? "Help Center" : "Contact Support"} className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center border-b border-gray-200 pb-4 mb-4">
                            <h3 className="text-lg font-bold text-carbon-gray-100">Help Center</h3>
                            <button aria-label="Close help" onClick={() => setIsHelpOpen(false)} className="flex h-11 w-11 items-center justify-center text-gray-500 hover:text-carbon-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60">
                                <Close className="w-6 h-6" />
                            </button>
                        </div>
                        <p className="text-sm text-gray-600 mb-6">
                            Welcome to the Printflow Shop Dashboard. Here you can manage your live print queue, view analytics, and configure your shop settings.
                        </p>
                        <div className="flex justify-end">
                            <button onClick={() => setIsHelpOpen(false)} className="min-h-11 px-6 py-2 bg-carbon-gray-100 text-white text-sm font-bold hover:bg-black transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Support Modal */}
            {isSupportOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setIsSupportOpen(false)}>
                    <div data-shop-account-dialog role="dialog" aria-modal="true" aria-label={isHelpOpen ? "Help Center" : "Contact Support"} className="max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center border-b border-gray-200 pb-4 mb-4">
                            <h3 className="text-lg font-bold text-carbon-gray-100">Contact Support</h3>
                            <button aria-label="Close support" onClick={() => setIsSupportOpen(false)} className="flex h-11 w-11 items-center justify-center text-gray-500 hover:text-carbon-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60">
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
                            <button onClick={() => setIsSupportOpen(false)} className="min-h-11 px-6 py-2 bg-carbon-gray-100 text-white text-sm font-bold hover:bg-black transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60">
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
