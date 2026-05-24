import React, { useEffect, useState } from 'react';
import { Calendar, Download, CheckCircle, Clock } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { apiClient } from '../../services/apiClient';
import { orderService } from '../../services/orderService';

const KPICard = ({ title, value, subtext, subtextColor = 'text-gray-500' }: { title: string, value: string, subtext: string, subtextColor?: string }) => (
    <div className="bg-white border border-gray-200 rounded-lg p-5 flex-1 shadow-sm">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{title}</h3>
        <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-gray-900">{value}</span>
            <span className={`text-xs font-medium ${subtextColor}`}>{subtext}</span>
        </div>
    </div>
);

export const ShopAnalyticsPage: React.FC = () => {
    const [analyticsData, setAnalyticsData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const data = await apiClient<any>('/analytics', { method: 'GET' });
                setAnalyticsData(data);
            } catch (err: any) {
                setError(err.message || 'An error occurred');
            } finally {
                setIsLoading(false);
            }
        };

        fetchAnalytics();
    }, []);

    const handleExportCSV = async () => {
        setIsExporting(true);
        try {
            // Fetch the raw orders ledger
            const orders = await orderService.getShopOrders();
            
            const headers = ['Order ID', 'Client ID', 'Status', 'Total', 'Date Created', 'File Name'];
            const rows = orders.map((o: any) => {
                let fileName = 'No File';
                if (o.assets && o.assets.length > 0 && o.assets[0].file_url) {
                    const urlParts = o.assets[0].file_url.split('/');
                    let rawName = decodeURIComponent(urlParts[urlParts.length - 1]);
                    const match = rawName.match(/-\d{13}-(.+)$/);
                    fileName = match ? match[1] : rawName;
                }

                return [
                    o.id,
                    o.client_id || '',
                    o.state,
                    o.total,
                    new Date(o.created_at).toLocaleString(),
                    fileName
                ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
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

    if (isLoading) return <div className="p-8 font-sans">Loading analytics...</div>;
    if (error) return <div className="p-8 font-sans text-red-500">Error: {error}</div>;

    return (
        <div className="flex-1 overflow-y-auto p-6 font-sans">
            <div className="max-w-7xl mx-auto space-y-6">
                
                {/* Header Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center space-x-2 bg-white border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 font-medium shadow-sm w-fit">
                        <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                        <span>All Time Overview</span>
                    </div>

                    <button 
                        onClick={handleExportCSV}
                        disabled={isExporting}
                        className="flex items-center justify-center space-x-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-70 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm"
                    >
                        <Download className="w-4 h-4" />
                        <span>{isExporting ? 'Exporting...' : 'Export Data (CSV)'}</span>
                    </button>
                </div>

                {/* KPI Cards */}
                <div className="flex flex-col md:flex-row gap-4">
                    <KPICard 
                        title="Total Revenue" 
                        value={`₱${analyticsData?.totalRevenue || '0.00'}`} 
                        subtext="All Time" 
                        subtextColor="text-green-500"
                    />
                    <KPICard 
                        title="Total Customers" 
                        value={`${analyticsData?.uniqueCustomers || 0} clients`} 
                        subtext="Unique Users" 
                    />
                    <KPICard 
                        title="Completed Orders" 
                        value={`${analyticsData?.completedOrdersCount || 0} orders`} 
                        subtext={`Active Now: ${analyticsData?.activeOrdersCount || 0}`} 
                    />
                </div>

                {/* Print Volume Chart */}
                <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-sm font-bold text-gray-900">Orders Over Time</h3>
                        <div className="flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-gray-900"></span>
                            <span className="text-xs font-medium text-gray-500">Orders</span>
                        </div>
                    </div>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={analyticsData?.printVolumeOverTime || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#111827" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#111827" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis 
                                    dataKey="date" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fontSize: 10, fill: '#6B7280' }} 
                                    dy={10} 
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fontSize: 10, fill: '#6B7280' }}
                                />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="volume" 
                                    stroke="#111827" 
                                    strokeWidth={3}
                                    fillOpacity={1} 
                                    fill="url(#colorVolume)" 
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Bottom Row */}
                <div className="grid grid-cols-1 gap-6 pb-6">
                    {/* Recent Print Jobs */}
                    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                        <h3 className="text-sm font-bold text-gray-900 mb-4">Recent Orders</h3>
                        <div className="space-y-4">
                            {analyticsData?.recentOrders?.length > 0 ? (
                                analyticsData.recentOrders.map((order: any) => (
                                    <div key={order.id} className="flex items-center justify-between pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                                        <span className="text-sm font-medium text-gray-700 truncate max-w-[60%]">{order.fileName}</span>
                                        <div className="flex items-center text-xs text-gray-500 space-x-2">
                                            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                            {order.state === 'PRINTED' ? (
                                                <span className="flex items-center text-gray-900 font-medium"><CheckCircle className="w-3 h-3 text-green-500 mr-1"/> Printed</span>
                                            ) : (
                                                <span className="flex items-center text-orange-600 font-medium"><Clock className="w-3 h-3 mr-1"/> {order.state.replace(/_/g, ' ')}</span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-sm text-gray-500 text-center py-4">No recent orders found.</div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
