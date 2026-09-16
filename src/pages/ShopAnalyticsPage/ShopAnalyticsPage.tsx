import React, { useEffect, useState, useCallback } from 'react';
import {
  Download,
  ChartLine,
  Document,
  Layers,
  Activity,
} from '@carbon/icons-react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
  type TooltipContentProps,
} from 'recharts';
import { apiClient } from '../../services/apiClient';
import { orderService } from '../../services/orderService';
import { AnalyticsSkeleton } from './AnalyticsSkeleton';
import { Renew } from '@carbon/icons-react';
import { AlertModal } from '../../components/common/AlertModal';

// ── Inline Loading Overlay ──
const InlineLoader = () => (
  <div
    className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-[2px]"
    role="status"
    aria-label="Refreshing analytics data"
  >
    <div className="flex min-h-11 items-center gap-3 border border-gray-300 border-l-4 border-l-carbon-blue-60 bg-white px-4 py-2 shadow-[0_8px_20px_rgba(22,22,22,0.08)]">
      <Renew
        className="h-5 w-5 animate-spin text-carbon-blue-60 motion-reduce:animate-none"
        aria-hidden="true"
      />
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-carbon-gray-100">
        Refreshing data
      </span>
    </div>
  </div>
);

// ── KPI Card ──
const KPICard = ({
  icon: Icon,
  title,
  value,
  subtext,
  subtextColor = 'text-gray-500',
}: {
  icon: React.ElementType;
  title: string;
  value: string;
  subtext: string;
  subtextColor?: string;
}) => (
  <div className="min-w-0 flex-1 border border-gray-300 border-t-4 border-t-carbon-blue-60 bg-white p-5 shadow-[0_8px_20px_rgba(22,22,22,0.05)]">
    <div className="mb-4 flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-carbon-gray-100 text-white">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-gray-600">
        {title}
      </h3>
    </div>
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="text-3xl font-black tracking-tight text-carbon-gray-100 tabular-nums">
        {value}
      </span>
      <span className={`text-xs font-semibold ${subtextColor}`}>{subtext}</span>
    </div>
  </div>
);

// ── Status Badge ──
const StatusBadge = ({ state }: { state: string }) => {
  let label: string;
  let cls = 'border border-gray-300 bg-gray-100 text-gray-800';
  switch (state) {
    case 'COMPLETED':
      label = 'Completed';
      cls = 'border border-gray-300 bg-gray-100 text-gray-700';
      break;
    case 'PRINTED':
      label = 'Printed';
      cls = 'border border-carbon-gray-100 bg-carbon-gray-100 text-white';
      break;
    case 'READY_FOR_PICKUP':
      label = 'Ready';
      cls = 'border border-green-300 bg-green-50 text-green-800';
      break;
    case 'IN_PRODUCTION':
      label = 'In Production';
      cls = 'border border-blue-200 bg-blue-50 text-carbon-blue-70';
      break;
    case 'AWAITING_PAYMENT':
      label = 'Awaiting Pay';
      cls = 'border border-gray-300 bg-gray-100 text-carbon-gray-100';
      break;
    case 'AWAITING_PAYMENT_VERIFICATION':
      label = 'Pay Review';
      cls = 'border border-yellow-300 bg-yellow-50 text-yellow-800';
      break;
    case 'OPEN_INQUIRY':
      label = 'Pending';
      cls = 'border border-blue-200 bg-blue-50 text-carbon-blue-70';
      break;
    case 'PROOF_APPROVED':
      label = 'Approved';
      cls = 'border border-blue-300 bg-blue-100 text-carbon-blue-70';
      break;
    case 'ESCALATED_DISPUTE':
      label = 'Disputed';
      cls = 'border border-gray-500 bg-gray-200 text-carbon-gray-100';
      break;
    default:
      label = state.replace(/_/g, ' ');
  }
  return (
    <span
      className={`inline-flex min-h-6 items-center px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${cls}`}
    >
      {label}
    </span>
  );
};

// ── Date Presets ──
type DatePreset = 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'ALL' | 'CUSTOM';

interface AnalyticsOrder {
  id: string;
  fileName: string;
  state: string;
  total: number;
  pageCount: number;
  clientId: string | null;
  createdAt: string;
}

interface AnalyticsData {
  totalRevenue: string;
  pendingRevenue: string;
  totalPagesPrinted: number;
  averageOrderValue: string;
  activeQueueCount: number;
  uniqueCustomers: number;
  completedOrdersCount: number;
  colorSplit: {
    color: number;
    bw: number;
  };
  paperSplit: Record<string, number>;
  printVolumeOverTime: Array<{
    date: string;
    revenue: number;
    pages: number;
  }>;
  recentOrders: AnalyticsOrder[];
}

interface ShopOrderExport {
  id: string;
  client_id?: string | null;
  state: string;
  total: number | string | null;
  page_count?: number | null;
  created_at: string;
  assets?: Array<{ file_url?: string | null }> | null;
}

const getDateRange = (
  preset: DatePreset,
): { startDate?: string; endDate?: string } => {
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
      const start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - diff,
      );
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

const requestAnalytics = async (
  preset: DatePreset,
  customStart?: string,
  customEnd?: string,
): Promise<AnalyticsData> => {
  let params = '';
  if (preset === 'CUSTOM' && customStart && customEnd) {
    const startISO = new Date(customStart).toISOString();
    const endISO = new Date(`${customEnd}T23:59:59`).toISOString();
    params = `?startDate=${startISO}&endDate=${endISO}`;
  } else if (preset !== 'ALL') {
    const { startDate, endDate } = getDateRange(preset);
    if (startDate && endDate) {
      params = `?startDate=${startDate}&endDate=${endDate}`;
    }
  }

  return apiClient<AnalyticsData>(`/analytics${params}`, { method: 'GET' });
};

// ── Chart Colors ──
const COLOR_PALETTE = ['#0f62fe', '#161616']; // Carbon blue (Color), Carbon gray (B&W)
const PAPER_PALETTE = ['#8d8d8d', '#0f62fe', '#161616']; // Gray (Short), blue (A4), black (Long)

// ── Custom Tooltip ──
type ComboTooltipProps = Partial<
  Pick<TooltipContentProps<number, string>, 'active' | 'payload' | 'label'>
>;

const ComboTooltip = ({ active, payload, label }: ComboTooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-gray-300 border-t-4 border-t-carbon-blue-60 bg-white px-4 py-3 text-sm shadow-[0_8px_20px_rgba(22,22,22,0.12)]">
      <p className="mb-2 font-black text-carbon-gray-100">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="flex items-center text-gray-600">
          <span
            className="mr-2 inline-block h-2 w-2"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}:{' '}
          {entry.name === 'Revenue' ? `₱${entry.value}` : entry.value}
        </p>
      ))}
    </div>
  );
};

// ── Donut Center Label ──
const renderCenterLabel = (total: number, label: string) => (
  <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
    <tspan x="50%" dy="-6" className="text-xl font-black fill-carbon-gray-100">
      {total}
    </tspan>
    <tspan
      x="50%"
      dy="18"
      className="text-[10px] font-bold uppercase tracking-wider fill-gray-500"
    >
      {label}
    </tspan>
  </text>
);

export const ShopAnalyticsPage: React.FC = () => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePreset>('ALL');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [tablePage, setTablePage] = useState(1);
  const TABLE_PAGE_SIZE = 5;

  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    type?: 'info' | 'success' | 'error' | 'warning';
  }>({ isOpen: false, message: '' });
  const showAlert = (
    message: string,
    type: 'info' | 'success' | 'error' | 'warning' = 'info',
    title?: string,
  ) => {
    setAlertState({ isOpen: true, message, type, title });
  };

  const fetchAnalytics = useCallback(
    async (preset: DatePreset, cStart?: string, cEnd?: string) => {
      try {
        const data = await requestAnalytics(preset, cStart, cEnd);
        setAnalyticsData(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    let isCurrent = true;

    void requestAnalytics('ALL')
      .then((data) => {
        if (isCurrent) setAnalyticsData(data);
      })
      .catch((err: unknown) => {
        if (isCurrent) {
          setError(err instanceof Error ? err.message : 'An error occurred');
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset !== 'CUSTOM') {
      setIsLoading(true);
      setError(null);
      void fetchAnalytics(preset);
    }
  };

  const handleCustomApply = () => {
    if (customStart && customEnd) {
      setIsLoading(true);
      setError(null);
      void fetchAnalytics('CUSTOM', customStart, customEnd);
    }
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const orders = (await orderService.getShopOrders()) as ShopOrderExport[];
      const headers = [
        'Order ID',
        'Client ID',
        'Status',
        'Total',
        'Pages',
        'Date Created',
        'File Name',
      ];
      const rows = orders.map((o) => {
        let fileName = 'No File';
        if (o.assets && o.assets.length > 0 && o.assets[0].file_url) {
          const urlParts = o.assets[0].file_url.split('/');
          const rawName = decodeURIComponent(urlParts[urlParts.length - 1]);
          const match = rawName.match(/-\d{13}-(.+)$/);
          fileName = match ? match[1] : rawName;
        }
        return [
          o.id,
          o.client_id || '',
          o.state,
          o.total,
          o.page_count || 0,
          new Date(o.created_at).toLocaleString(),
          fileName,
        ]
          .map((field) => `"${String(field).replace(/"/g, '""')}"`)
          .join(',');
      });
      const csvContent = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `shop_orders_export_${new Date().toISOString().split('T')[0]}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export CSV', err);
      showAlert('Failed to export CSV data', 'error', 'Export Failed');
    } finally {
      setIsExporting(false);
    }
  };

  // ── Derived chart data ──
  const colorSplitData = analyticsData
    ? [
        { name: 'Color', value: analyticsData.colorSplit?.color || 0 },
        { name: 'B&W', value: analyticsData.colorSplit?.bw || 0 },
      ]
    : [];
  const colorTotal = colorSplitData.reduce((s, d) => s + d.value, 0);

  const paperSplitData = analyticsData
    ? [
        { name: 'Short', value: analyticsData.paperSplit?.SHORT || 0 },
        { name: 'A4', value: analyticsData.paperSplit?.A4 || 0 },
        { name: 'Long', value: analyticsData.paperSplit?.LONG || 0 },
      ]
    : [];
  const paperTotal = paperSplitData.reduce((s, d) => s + d.value, 0);
  const printVolumeData = analyticsData?.printVolumeOverTime ?? [];

  const presets: { key: DatePreset; label: string }[] = [
    { key: 'TODAY', label: 'Today' },
    { key: 'WEEK', label: 'This Week' },
    { key: 'MONTH', label: 'This Month' },
    { key: 'YEAR', label: 'This Year' },
    { key: 'ALL', label: 'All Time' },
    { key: 'CUSTOM', label: 'Custom' },
  ];

  if (isLoading && !analyticsData)
    return (
      <div
        className="flex h-full flex-col overflow-y-auto overflow-x-hidden bg-carbon-gray-10 p-4 font-sans sm:p-6 lg:p-8"
        aria-busy="true"
      >
        <AnalyticsSkeleton />
      </div>
    );
  if (error && !analyticsData)
    return (
      <div className="flex min-h-full items-center justify-center bg-carbon-gray-10 p-4 font-sans sm:p-8">
        <div
          className="w-full max-w-xl border border-gray-300 border-t-4 border-t-carbon-blue-60 bg-white p-6 shadow-[0_12px_32px_rgba(22,22,22,0.08)] sm:p-8"
          role="alert"
        >
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-carbon-blue-60">
            Analytics unavailable
          </p>
          <h1 className="text-2xl font-black tracking-tight text-carbon-gray-100">
            Unable to load performance data
          </h1>
          <p className="mt-3 border-l-4 border-gray-300 bg-carbon-gray-10 px-4 py-3 text-sm leading-relaxed text-gray-700">
            {error}
          </p>
        </div>
      </div>
    );

  return (
    <div
      className="relative isolate flex-1 overflow-y-auto overflow-x-hidden bg-carbon-gray-10 font-sans text-carbon-gray-100"
      aria-busy={isLoading}
    >
      <div className="mx-auto w-full max-w-7xl space-y-5 p-4 sm:space-y-6 sm:p-6 lg:p-8">
        {/* ── Page Header ── */}
        <header className="border border-gray-300 bg-white shadow-[0_12px_32px_rgba(22,22,22,0.08)]">
          <div className="border-t-4 border-t-carbon-blue-60 bg-carbon-gray-100 px-4 py-3 text-white sm:px-6 sm:py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-carbon-blue-60">
                  Analytics workspace
                </p>
                <h1 className="text-xl font-black tracking-tight sm:text-2xl">
                  Shop performance
                </h1>
                <p className="mt-1.5 max-w-xl text-[11px] leading-relaxed text-gray-300 sm:text-xs">
                  Track revenue, production volume, order preferences, and
                  recent shop activity from one operational view.
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* ── Date Range Controls ── */}
        <section
          className="border border-gray-300 bg-white p-4 shadow-[0_8px_24px_rgba(22,22,22,0.05)] sm:p-5"
          aria-label="Analytics controls"
        >
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex items-center gap-3">
                <span
                  className="h-6 w-1 bg-carbon-blue-60"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">
                    Reporting range
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-carbon-gray-100">
                    Choose which period to analyze
                  </p>
                </div>
              </div>
              <div
                className="inline-flex w-fit max-w-full flex-wrap border-l border-t border-gray-300 bg-white"
                role="group"
                aria-label="Date range presets"
              >
                {presets.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => handlePresetChange(p.key)}
                    aria-pressed={datePreset === p.key}
                    className={`min-h-11 flex-1 whitespace-nowrap border-b border-r border-gray-300 px-3 py-2 text-xs font-bold transition-colors focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-carbon-blue-60 motion-reduce:transition-none sm:flex-none sm:px-4 ${
                      datePreset === p.key
                        ? 'bg-carbon-blue-60 text-white'
                        : 'bg-white text-gray-700 hover:bg-carbon-gray-10 hover:text-carbon-gray-100'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {datePreset === 'CUSTOM' && (
                <div className="mt-4 grid grid-cols-1 gap-3 border border-gray-300 border-l-4 border-l-carbon-blue-60 bg-carbon-gray-10 p-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] sm:items-end">
                  <label className="min-w-0" htmlFor="analytics-start-date">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-gray-600">
                      Start date
                    </span>
                    <input
                      id="analytics-start-date"
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="min-h-11 w-full border border-gray-500 bg-white px-3 py-2 text-sm font-semibold text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60"
                    />
                  </label>
                  <span className="hidden min-h-11 items-center text-xs font-bold uppercase tracking-wider text-gray-500 sm:flex">
                    to
                  </span>
                  <label className="min-w-0" htmlFor="analytics-end-date">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-gray-600">
                      End date
                    </span>
                    <input
                      id="analytics-end-date"
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="min-h-11 w-full border border-gray-500 bg-white px-3 py-2 text-sm font-semibold text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60"
                    />
                  </label>
                  <button
                    onClick={handleCustomApply}
                    disabled={!customStart || !customEnd}
                    className="min-h-11 bg-carbon-gray-100 px-5 py-2 text-xs font-bold text-white transition-colors hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={handleExportCSV}
              disabled={isExporting}
              aria-busy={isExporting}
              className="flex min-h-12 w-full shrink-0 items-center justify-center gap-2 bg-carbon-blue-60 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-carbon-blue-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none xl:w-auto"
            >
              <Download className="h-5 w-5" aria-hidden="true" />
              <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
            </button>
          </div>
        </section>

        {/* ── KPI Cards ── */}
        <section
          className="relative grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="Key performance indicators"
        >
          {isLoading && analyticsData && <InlineLoader />}
          <KPICard
            icon={ChartLine}
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
            icon={Document}
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
        </section>

        {/* ── Main Combo Chart: Revenue (Line) + Pages (Bar) ── */}
        <section
          className="relative border border-gray-300 bg-white shadow-[0_8px_24px_rgba(22,22,22,0.05)]"
          aria-labelledby="revenue-volume-title"
        >
          {isLoading && analyticsData && <InlineLoader />}
          <div className="flex flex-col gap-4 border-b border-gray-300 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-carbon-blue-60">
                Performance trend
              </p>
              <h2
                id="revenue-volume-title"
                className="mt-1 text-lg font-black tracking-tight text-carbon-gray-100"
              >
                Revenue &amp; Print Volume
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-4 border border-gray-200 bg-carbon-gray-10 px-3 py-2">
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 bg-carbon-blue-60"
                  aria-hidden="true"
                />
                <span className="text-xs font-semibold text-gray-600">
                  Pages
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="h-1 w-4 bg-carbon-gray-100"
                  aria-hidden="true"
                />
                <span className="text-xs font-semibold text-gray-600">
                  Revenue
                </span>
              </div>
            </div>
          </div>
          <div className="h-72 w-full p-3 sm:h-80 sm:p-6">
            {printVolumeData.length > 0 &&
            !(
              printVolumeData.length === 1 &&
              printVolumeData[0].date === 'Today' &&
              printVolumeData[0].pages === 0
            ) ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={printVolumeData}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="barGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#0f62fe"
                        stopOpacity={0.95}
                      />
                      <stop
                        offset="100%"
                        stopColor="#0f62fe"
                        stopOpacity={0.45}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#D1D5DB"
                  />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#6B7280' }}
                    dy={10}
                  />
                  <YAxis
                    yAxisId="left"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#6B7280' }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#6B7280' }}
                    tickFormatter={(v: number) => `₱${v}`}
                  />
                  <Tooltip content={<ComboTooltip />} />
                  <Bar
                    yAxisId="left"
                    dataKey="pages"
                    name="Pages"
                    fill="url(#barGradient)"
                    barSize={28}
                  />
                  <Line
                    yAxisId="right"
                    dataKey="revenue"
                    name="Revenue"
                    type="monotone"
                    stroke="#161616"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#161616' }}
                    activeDot={{ r: 5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center border border-dashed border-gray-300 bg-carbon-gray-10 px-6 text-center">
                <p className="text-sm font-semibold text-gray-500">
                  No data for this period.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* ── Distribution Donut Charts ── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
          {/* Color Mode Split */}
          <section
            className="relative border border-gray-300 bg-white shadow-[0_8px_24px_rgba(22,22,22,0.05)]"
            aria-labelledby="color-distribution-title"
          >
            {isLoading && analyticsData && <InlineLoader />}
            <div className="border-b border-gray-300 px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-carbon-blue-60">
                Order mix
              </p>
              <h2
                id="color-distribution-title"
                className="mt-1 text-lg font-black tracking-tight text-carbon-gray-100"
              >
                Color Mode Distribution
              </h2>
            </div>
            {colorTotal > 0 ? (
              <div className="h-64 w-full p-3 sm:p-5">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={colorSplitData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                    >
                      {colorSplitData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={COLOR_PALETTE[i % COLOR_PALETTE.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [`${value} orders`, name]}
                    />
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      formatter={(value) => (
                        <span className="text-xs font-medium text-gray-600">
                          {value}
                        </span>
                      )}
                    />
                    {renderCenterLabel(colorTotal, 'orders')}
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="m-5 flex h-52 items-center justify-center border border-dashed border-gray-300 bg-carbon-gray-10 px-6 text-center">
                <p className="text-sm font-semibold text-gray-500">
                  No order data yet.
                </p>
              </div>
            )}
          </section>

          {/* Paper Size Split */}
          <section
            className="relative border border-gray-300 bg-white shadow-[0_8px_24px_rgba(22,22,22,0.05)]"
            aria-labelledby="paper-distribution-title"
          >
            {isLoading && analyticsData && <InlineLoader />}
            <div className="border-b border-gray-300 px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-carbon-blue-60">
                Production profile
              </p>
              <h2
                id="paper-distribution-title"
                className="mt-1 text-lg font-black tracking-tight text-carbon-gray-100"
              >
                Paper Size Distribution
              </h2>
            </div>
            {paperTotal > 0 ? (
              <div className="h-64 w-full p-3 sm:p-5">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paperSplitData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                    >
                      {paperSplitData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={PAPER_PALETTE[i % PAPER_PALETTE.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [`${value} orders`, name]}
                    />
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      formatter={(value) => (
                        <span className="text-xs font-medium text-gray-600">
                          {value}
                        </span>
                      )}
                    />
                    {renderCenterLabel(paperTotal, 'orders')}
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="m-5 flex h-52 items-center justify-center border border-dashed border-gray-300 bg-carbon-gray-10 px-6 text-center">
                <p className="text-sm font-semibold text-gray-500">
                  No order data yet.
                </p>
              </div>
            )}
          </section>
        </div>

        {/* ── Recent Activity Data Table ── */}
        {(() => {
          const allRecentOrders = analyticsData?.recentOrders || [];
          const totalTablePages = Math.max(
            1,
            Math.ceil(allRecentOrders.length / TABLE_PAGE_SIZE),
          );
          const paginatedOrders = allRecentOrders.slice(
            (tablePage - 1) * TABLE_PAGE_SIZE,
            tablePage * TABLE_PAGE_SIZE,
          );

          return (
            <section
              className="overflow-hidden border border-gray-300 bg-white shadow-[0_8px_24px_rgba(22,22,22,0.05)]"
              aria-labelledby="recent-activity-title"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-300 px-4 py-4 sm:px-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-carbon-blue-60">
                    Operational record
                  </p>
                  <h2
                    id="recent-activity-title"
                    className="mt-1 text-lg font-black tracking-tight text-carbon-gray-100"
                  >
                    Recent Activity
                  </h2>
                </div>
                <span className="border border-gray-300 bg-carbon-gray-10 px-3 py-1.5 text-xs font-bold tabular-nums text-gray-700">
                  {allRecentOrders.length} orders
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <caption className="sr-only">
                    Recent shop orders for the selected reporting period
                  </caption>
                  <thead>
                    <tr className="border-b border-carbon-gray-100 bg-carbon-gray-100 text-white">
                      <th
                        scope="col"
                        className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-[0.12em]"
                      >
                        Order ID
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-[0.12em]"
                      >
                        Client ID
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3.5 text-right text-xs font-bold uppercase tracking-[0.12em]"
                      >
                        Pages
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3.5 text-right text-xs font-bold uppercase tracking-[0.12em]"
                      >
                        Total
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-[0.12em]"
                      >
                        Date
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-[0.12em]"
                      >
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paginatedOrders.length > 0 ? (
                      paginatedOrders.map((order) => (
                        <tr
                          key={order.id}
                          className="transition-colors hover:bg-blue-50/50 motion-reduce:transition-none"
                        >
                          <td className="whitespace-nowrap border-l-4 border-l-transparent px-6 py-4 font-black text-carbon-gray-100">
                            #{order.id.slice(0, 8)}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-600">
                            {order.clientId?.slice(0, 8) || '—'}
                          </td>
                          <td className="px-6 py-4 text-right font-semibold tabular-nums text-gray-700">
                            {order.pageCount}
                          </td>
                          <td className="px-6 py-4 text-right font-black tabular-nums text-carbon-gray-100">
                            ₱
                            {Number(order.total).toLocaleString('en-PH', {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-600">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4">
                            <StatusBadge state={order.state} />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-12 text-center font-semibold text-gray-500"
                        >
                          No orders found for this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* Pagination Controls */}
              {totalTablePages > 1 && (
                <div className="flex flex-col gap-3 border-t border-gray-300 bg-carbon-gray-10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <span className="text-xs font-bold uppercase tracking-[0.1em] text-gray-600">
                    Page {tablePage} of {totalTablePages}
                  </span>
                  <div
                    className="flex flex-wrap items-center gap-1"
                    aria-label="Recent activity pagination"
                  >
                    <button
                      onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                      disabled={tablePage === 1}
                      className="min-h-11 border border-gray-500 bg-white px-4 py-2 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
                    >
                      Prev
                    </button>
                    {Array.from(
                      { length: totalTablePages },
                      (_, i) => i + 1,
                    ).map((page) => (
                      <button
                        key={page}
                        onClick={() => setTablePage(page)}
                        aria-current={tablePage === page ? 'page' : undefined}
                        className={`min-h-11 min-w-11 border px-3 py-2 text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 motion-reduce:transition-none ${
                          tablePage === page
                            ? 'border-carbon-blue-60 bg-carbon-blue-60 text-white'
                            : 'border-gray-500 bg-white text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() =>
                        setTablePage((p) => Math.min(totalTablePages, p + 1))
                      }
                      disabled={tablePage === totalTablePages}
                      className="min-h-11 border border-gray-500 bg-white px-4 py-2 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </section>
          );
        })()}

        {/* Bottom spacer */}
        <div className="h-2" aria-hidden="true" />
        <AlertModal
          isOpen={alertState.isOpen}
          message={alertState.message}
          title={alertState.title}
          type={alertState.type}
          onClose={() => setAlertState((prev) => ({ ...prev, isOpen: false }))}
        />
      </div>
    </div>
  );
};
