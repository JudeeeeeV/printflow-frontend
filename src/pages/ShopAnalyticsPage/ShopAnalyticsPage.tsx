import React, { useEffect, useState, useCallback } from 'react';
import { Calendar, Download, TrendingUp, FileText, Layers, Activity } from 'lucide-react';
import {
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
    PieChart, Pie, Cell,
} from 'recharts';
import { apiClient } from '../../services/apiClient';
import { orderService } from '../../services/orderService';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Loader2 } from 'lucide-react';

// ── Inline Loading Overlay ──
const InlineLoader = () => (
    <div className="absolute inset-0 bg-white/70 z-10 flex items-center justify-center rounded-lg">
        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
    </div>
);

// ── KPI Card ──
const KPICard = ({ icon: Icon, title, value, subtext, subtextColor = 'text-gray-500' }: {
    icon: React.ElementType; title: string; value: string; subtext: string; subtextColor?: string;
}) => (
    <div className="bg-white border border-gray-200 rounded-lg p-5 flex-1 shadow-sm min-w-0">
        <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-gray-100 rounded-md">
                <Icon className="w-4 h-4 text-gray-600" />
            </div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</h3>
        </div>
        <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl font-black text-gray-900">{value}</span>
            <span className={`text-xs font-medium ${subtextColor}`}>{subtext}</span>
        </div>
    </div>
);

// ── Status Badge ──
const StatusBadge = ({ state }: { state: string }) => {
    let label = state;
    let cls = 'bg-gray-100 text-gray-800';
    switch (state) {
        case 'COMPLETED': label = 'Completed'; cls = 'bg-gray-100 text-gray-800'; break;
        case 'PRINTED': label = 'Printed'; cls = 'bg-gray-100 text-gray-800'; break;
        case 'READY_FOR_PICKUP': label = 'Ready'; cls = 'bg-green-100 text-green-800'; break;
        case 'IN_PRODUCTION': label = 'In Production'; cls = 'bg-purple-100 text-purple-800'; break;
        case 'AWAITING_PAYMENT': label = 'Awaiting Pay'; cls = 'bg-red-100 text-red-800'; break;
        case 'AWAITING_PAYMENT_VERIFICATION': label = 'Pay Review'; cls = 'bg-yellow-100 text-yellow-800 border border-yellow-300'; break;
        case 'OPEN_INQUIRY': label = 'Pending'; cls = 'bg-blue-100 text-blue-800'; break;
        case 'PROOF_APPROVED': label = 'Approved'; cls = 'bg-indigo-100 text-indigo-800'; break;
        case 'ESCALATED_DISPUTE': label = 'Disputed'; cls = 'bg-blue-100 text-blue-800 border border-blue-300'; break;
        default: label = state.replace(/_/g, ' ');
    }
    return <span className={`px-2 py-0.5 text-[10px] font-bold rounded-sm ${cls}`}>{label}</span>;
};

// ── Date Presets ──
type DatePreset = 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'ALL' | 'CUSTOM';

const getDateRange = (preset: DatePreset): { startDate?: string; endDate?: string } => {
    const now = new Date();
    const endDate = now.toISOString();

    switch (preset) {
        case 'TODAY': {
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            return { startDate: start.toISOString(), endDate };
        }
        case 'WEEK': {
            const day = now.getDay();
            const diff = day === 0 ? 6 : day - 1; // Monday as start
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
            return { startDate: start.toISOString(), endDate };
        }
        case 'MONTH': {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            return { startDate: start.toISOString(), endDate };
        }
        case 'YEAR': {
            const start = new Date(now.getFullYear(), 0, 1);
            return { startDate: start.toISOString(), endDate };
        }
        case 'ALL':
        default:
            return {};
    }
};

// ── Chart Colors ──
const COLOR_PALETTE = ['#6366f1', '#111827']; // indigo-500 (Color), black (B&W)
const PAPER_PALETTE = ['#64748b', '#a78bfa', '#2dd4bf']; // slate-500 (Short), violet-400 (A4), teal-400 (Long)

// ── Custom Tooltip ──
const ComboTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-sm">
            <p className="font-bold text-gray-900 mb-1">{label}</p>
            {payload.map((entry: any, i: number) => (
                <p key={i} className="text-gray-600">
                    <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: entry.color }} />
                    {entry.name}: {entry.name === 'Revenue' ? `₱${entry.value}` : entry.value}
                </p>
            ))}
        </div>
    );
};

// ── Donut Center Label ──
const renderCenterLabel = (total: number, label: string) => (
    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
        <tspan x="50%" dy="-6" className="text-lg font-black fill-gray-900">{total}</tspan>
        <tspan x="50%" dy="18" className="text-[10px] font-medium fill-gray-500">{label}</tspan>
    </text>
);

export const ShopAnalyticsPage: React.FC = () => {
    const [analyticsData, setAnalyticsData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [datePreset, setDatePreset] = useState<DatePreset>('ALL');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [tablePage, setTablePage] = useState(1);
    const TABLE_PAGE_SIZE = 5;

    const fetchAnalytics = useCallback(async (preset: DatePreset, cStart?: string, cEnd?: string) => {
        setIsLoading(true);
        setError(null);
        try {
            let params = '';
            if (preset === 'CUSTOM' && cStart && cEnd) {
                const startISO = new Date(cStart).toISOString();
                const endISO = new Date(cEnd + 'T23:59:59').toISOString();
                params = `?startDate=${startISO}&endDate=${endISO}`;
            } else if (preset !== 'ALL') {
                const { startDate, endDate } = getDateRange(preset);
                if (startDate && endDate) {
                    params = `?startDate=${startDate}&endDate=${endDate}`;
                }
            }
            const data = await apiClient<any>(`/analytics${params}`, { method: 'GET' });
            setAnalyticsData(data);
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAnalytics('ALL');
    }, [fetchAnalytics]);

    const handlePresetChange = (preset: DatePreset) => {
        setDatePreset(preset);
        if (preset !== 'CUSTOM') {
            fetchAnalytics(preset);
        }
    };

    const handleCustomApply = () => {
        if (customStart && customEnd) {
            fetchAnalytics('CUSTOM', customStart, customEnd);
        }
    };

    const handleExportCSV = async () => {
        setIsExporting(true);
        try {
            const orders = await orderService.getShopOrders();
            const headers = ['Order ID', 'Client ID', 'Status', 'Total', 'Pages', 'Date Created', 'File Name'];
            const rows = orders.map((o: any) => {
                let fileName = 'No File';
                if (o.assets && o.assets.length > 0 && o.assets[0].file_url) {
                    const urlParts = o.assets[0].file_url.split('/');
                    let rawName = decodeURIComponent(urlParts[urlParts.length - 1]);
                    const match = rawName.match(/-\d{13}-(.+)$/);
                    fileName = match ? match[1] : rawName;
                }
                return [o.id, o.client_id || '', o.state, o.total, o.page_count || 0, new Date(o.created_at).toLocaleString(), fileName]
                    .map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
            });
            const csvContent = [headers.join(','), ...rows].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `shop_orders_export_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error("Failed to export CSV", err);
            alert("Failed to export CSV data");
        } finally {
            setIsExporting(false);
        }
    };

    // ── Derived chart data ──
    const colorSplitData = analyticsData ? [
        { name: 'Color', value: analyticsData.colorSplit?.color || 0 },
        { name: 'B&W', value: analyticsData.colorSplit?.bw || 0 },
    ] : [];
    const colorTotal = colorSplitData.reduce((s, d) => s + d.value, 0);

    const paperSplitData = analyticsData ? [
        { name: 'Short', value: analyticsData.paperSplit?.SHORT || 0 },
        { name: 'A4', value: analyticsData.paperSplit?.A4 || 0 },
        { name: 'Long', value: analyticsData.paperSplit?.LONG || 0 },
    ] : [];
    const paperTotal = paperSplitData.reduce((s, d) => s + d.value, 0);

    const presets: { key: DatePreset; label: string }[] = [
        { key: 'TODAY', label: 'Today' },
        { key: 'WEEK', label: 'This Week' },
        { key: 'MONTH', label: 'This Month' },
        { key: 'YEAR', label: 'This Year' },
        { key: 'ALL', label: 'All Time' },
        { key: 'CUSTOM', label: 'Custom' },
    ];

    if (isLoading && !analyticsData) return <LoadingSpinner message="Loading analytics..." />;
    if (error && !analyticsData) return <div className="p-8 font-sans text-red-500">Error: {error}</div>;

    return (
        <div className="flex-1 overflow-y-auto p-6 font-sans">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* ── Date Range Controls ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {presets.map(p => (
                            <button
                                key={p.key}
                                onClick={() => handlePresetChange(p.key)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-sm border transition-colors ${
                                    datePreset === p.key
                                        ? 'bg-gray-900 text-white border-gray-900'
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                        {datePreset === 'CUSTOM' && (
                            <div className="flex items-center gap-2 ml-2">
                                <input
                                    type="date"
                                    value={customStart}
                                    onChange={e => setCustomStart(e.target.value)}
                                    className="text-xs border border-gray-300 rounded-sm px-2 py-1.5 font-medium text-gray-700 focus:ring-black focus:border-black"
                                />
                                <span className="text-xs text-gray-400">to</span>
                                <input
                                    type="date"
                                    value={customEnd}
                                    onChange={e => setCustomEnd(e.target.value)}
                                    className="text-xs border border-gray-300 rounded-sm px-2 py-1.5 font-medium text-gray-700 focus:ring-black focus:border-black"
                                />
                                <button
                                    onClick={handleCustomApply}
                                    disabled={!customStart || !customEnd}
                                    className="px-3 py-1.5 text-xs font-bold bg-gray-900 text-white rounded-sm disabled:opacity-40 hover:bg-gray-800 transition-colors"
                                >
                                    Apply
                                </button>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleExportCSV}
                        disabled={isExporting}
                        className="flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-70 text-white px-4 py-2 rounded-sm text-sm font-bold transition-colors shadow-sm"
                    >
                        <Download className="w-4 h-4" />
                        <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
                    </button>
                </div>

                {/* ── KPI Cards ── */}
                <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {isLoading && analyticsData && <InlineLoader />}
                    <KPICard
                        icon={TrendingUp}
                        title="Total Revenue"
                        value={`₱${Number(analyticsData?.totalRevenue || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}
                        subtext={`₱${Number(analyticsData?.pendingRevenue || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })} pending`}
                        subtextColor="text-gray-500"
                    />
                    <KPICard
                        icon={Layers}
                        title="Avg Order Value"
                        value={`₱${Number(analyticsData?.averageOrderValue || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}
                        subtext="per order"
                    />
                    <KPICard
                        icon={FileText}
                        title="Total Pages Printed"
                        value={`${analyticsData?.totalPagesPrinted || 0}`}
                        subtext="completed"
                        subtextColor="text-gray-500"
                    />
                    <KPICard
                        icon={Activity}
                        title="Active Queue"
                        value={`${analyticsData?.activeQueueCount || 0}`}
                        subtext="orders in progress"
                        subtextColor="text-gray-500"
                    />
                </div>

                {/* ── Main Combo Chart: Revenue (Line) + Pages (Bar) ── */}
                <div className="relative bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                    {isLoading && analyticsData && <InlineLoader />}
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-sm font-bold text-gray-900">Revenue & Print Volume</h3>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-sm bg-gray-400" />
                                <span className="text-xs font-medium text-gray-500">Pages</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-3 h-1 bg-gray-900 rounded-full" />
                                <span className="text-xs font-medium text-gray-500">Revenue</span>
                            </div>
                        </div>
                    </div>
                    <div className="h-80 w-full">
                        {(analyticsData?.printVolumeOverTime?.length || 0) > 0 &&
                         !(analyticsData.printVolumeOverTime.length === 1 && analyticsData.printVolumeOverTime[0].date === 'Today' && analyticsData.printVolumeOverTime[0].pages === 0) ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={analyticsData.printVolumeOverTime} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#374151" stopOpacity={0.9} />
                                            <stop offset="100%" stopColor="#9CA3AF" stopOpacity={0.4} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} dy={10} />
                                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} />
                                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} tickFormatter={(v: number) => `₱${v}`} />
                                    <Tooltip content={<ComboTooltip />} />
                                    <Bar yAxisId="left" dataKey="pages" name="Pages" fill="url(#barGradient)" radius={[4, 4, 0, 0]} barSize={28} />
                                    <Line yAxisId="right" dataKey="revenue" name="Revenue" type="monotone" stroke="#111827" strokeWidth={2.5} dot={{ r: 3, fill: '#111827' }} activeDot={{ r: 5 }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center">
                                <p className="text-gray-400 font-medium text-sm">No data for this period.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Distribution Donut Charts ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Color Mode Split */}
                    <div className="relative bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                        {isLoading && analyticsData && <InlineLoader />}
                        <h3 className="text-sm font-bold text-gray-900 mb-4">Color Mode Distribution</h3>
                        {colorTotal > 0 ? (
                            <div className="h-56 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={colorSplitData}
                                            cx="50%" cy="50%"
                                            innerRadius={55} outerRadius={80}
                                            paddingAngle={4}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {colorSplitData.map((_, i) => (
                                                <Cell key={i} fill={COLOR_PALETTE[i % COLOR_PALETTE.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value: number, name: string) => [`${value} orders`, name]} />
                                        <Legend verticalAlign="bottom" iconType="circle" formatter={(value) => <span className="text-xs font-medium text-gray-600">{value}</span>} />
                                        {renderCenterLabel(colorTotal, 'orders')}
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-56 flex items-center justify-center">
                                <p className="text-gray-400 font-medium text-sm">No order data yet.</p>
                            </div>
                        )}
                    </div>

                    {/* Paper Size Split */}
                    <div className="relative bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                        {isLoading && analyticsData && <InlineLoader />}
                        <h3 className="text-sm font-bold text-gray-900 mb-4">Paper Size Distribution</h3>
                        {paperTotal > 0 ? (
                            <div className="h-56 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={paperSplitData}
                                            cx="50%" cy="50%"
                                            innerRadius={55} outerRadius={80}
                                            paddingAngle={4}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {paperSplitData.map((_, i) => (
                                                <Cell key={i} fill={PAPER_PALETTE[i % PAPER_PALETTE.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value: number, name: string) => [`${value} orders`, name]} />
                                        <Legend verticalAlign="bottom" iconType="circle" formatter={(value) => <span className="text-xs font-medium text-gray-600">{value}</span>} />
                                        {renderCenterLabel(paperTotal, 'orders')}
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-56 flex items-center justify-center">
                                <p className="text-gray-400 font-medium text-sm">No order data yet.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Recent Activity Data Table ── */}
                {(() => {
                    const allRecentOrders = analyticsData?.recentOrders || [];
                    const totalTablePages = Math.max(1, Math.ceil(allRecentOrders.length / TABLE_PAGE_SIZE));
                    const paginatedOrders = allRecentOrders.slice((tablePage - 1) * TABLE_PAGE_SIZE, tablePage * TABLE_PAGE_SIZE);

                    return (
                        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                                <h3 className="text-sm font-bold text-gray-900">Recent Activity</h3>
                                <span className="text-xs font-medium text-gray-500">{allRecentOrders.length} orders</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-200">
                                            <th className="text-left px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Order ID</th>
                                            <th className="text-left px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Client ID</th>
                                            <th className="text-right px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Pages</th>
                                            <th className="text-right px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Total</th>
                                            <th className="text-left px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                            <th className="text-left px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {paginatedOrders.length > 0 ? (
                                            paginatedOrders.map((order: any) => (
                                                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-3 font-bold text-gray-900 whitespace-nowrap">#{order.id.slice(0, 8)}</td>
                                                    <td className="px-6 py-3 text-gray-600 font-medium whitespace-nowrap">{order.clientId?.slice(0, 8) || '—'}</td>
                                                    <td className="px-6 py-3 text-right text-gray-700 font-medium">{order.pageCount}</td>
                                                    <td className="px-6 py-3 text-right font-bold text-gray-900">₱{Number(order.total).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                                                    <td className="px-6 py-3 text-gray-600 font-medium whitespace-nowrap">{new Date(order.createdAt).toLocaleDateString()}</td>
                                                    <td className="px-6 py-3"><StatusBadge state={order.state} /></td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-8 text-center text-gray-400 font-medium">No orders found for this period.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            {/* Pagination Controls */}
                            {totalTablePages > 1 && (
                                <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
                                    <span className="text-xs font-medium text-gray-500">Page {tablePage} of {totalTablePages}</span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setTablePage(p => Math.max(1, p - 1))}
                                            disabled={tablePage === 1}
                                            className="px-3 py-1.5 text-xs font-bold border border-gray-300 rounded-sm bg-white text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            Prev
                                        </button>
                                        {Array.from({ length: totalTablePages }, (_, i) => i + 1).map(page => (
                                            <button
                                                key={page}
                                                onClick={() => setTablePage(page)}
                                                className={`px-3 py-1.5 text-xs font-bold rounded-sm border transition-colors ${
                                                    tablePage === page
                                                        ? 'bg-gray-900 text-white border-gray-900'
                                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                                }`}
                                            >
                                                {page}
                                            </button>
                                        ))}
                                        <button
                                            onClick={() => setTablePage(p => Math.min(totalTablePages, p + 1))}
                                            disabled={tablePage === totalTablePages}
                                            className="px-3 py-1.5 text-xs font-bold border border-gray-300 rounded-sm bg-white text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* Bottom spacer */}
                <div className="h-6" />
            </div>
        </div>
    );
};
