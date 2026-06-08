import { useEffect, useMemo, useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Cell } from 'recharts';
import {
  dashboardService,
  DashboardComparisonMode,
  DashboardComparisonSeriesItem,
  DashboardOverview,
  DashboardLatestSale,
  DashboardOverviewParams,
  DashboardPeriod,
} from '@/services/dashboardService';
import { formatCurrency } from '@/services/giftcardService';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Loader2, Settings2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const chartConfig = {
  value: { label: 'Belopp', color: 'hsl(var(--primary))' },
};

const countChartConfig = {
  value: { label: 'Antal', color: 'hsl(var(--primary))' },
};

const barColors = ['#2563eb', '#0ea5e9', '#14b8a6', '#f59e0b', '#ef4444'];

type PeriodOption = DashboardPeriod;
type ComparisonOption = DashboardComparisonMode;
type RowAction = 'resend';
type MultiplesOption = '2' | '3' | '4' | '5';
type DashboardColumnKey =
  | 'recipientName'
  | 'recipientEmail'
  | 'senderName'
  | 'amount'
  | 'status'
  | 'deliveredAt'
  | 'companyName'
  | 'message';
type ChartDataPoint = {
  key: string;
  label: string;
  shortLabel: string;
  range: string;
  value: number;
};

const dashboardColumnOptions: { key: DashboardColumnKey; label: string; defaultVisible: boolean }[] = [
  { key: 'recipientName', label: 'Mottagare', defaultVisible: true },
  { key: 'recipientEmail', label: 'Mottagar-e-post', defaultVisible: true },
  { key: 'senderName', label: 'Avsändare', defaultVisible: true },
  { key: 'amount', label: 'Belopp', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'deliveredAt', label: 'Utskickad', defaultVisible: true },
  { key: 'companyName', label: 'Företag', defaultVisible: true },
  { key: 'message', label: 'Meddelande', defaultVisible: false },
];

const defaultVisibleColumns = dashboardColumnOptions.reduce<Record<DashboardColumnKey, boolean>>((acc, column) => {
  acc[column.key] = column.defaultVisible;
  return acc;
}, {} as Record<DashboardColumnKey, boolean>);

function formatDateTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '-';
  return format(date, 'yyyy-MM-dd HH:mm', { locale: sv });
}

function formatDateOnly(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '-';
  return format(date, 'yyyy-MM-dd', { locale: sv });
}

function formatRange(from?: string, to?: string) {
  const start = formatDateOnly(from);
  const end = formatDateOnly(to);
  if (start === '-' || end === '-') return '-';
  return `${start} - ${end}`;
}

function formatSek(value: number) {
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' }).format(Number(value || 0));
}

function formatScheduledDelivery(value?: string) {
  if (!value) return 'Immediate';
  return formatDateTime(value);
}

function roundToIncrement(value: number, increment: number) {
  if (!increment) return value;
  return Math.round(value / increment) * increment;
}

function getDisplayIncrement(values: number[]) {
  const maxOre = Math.max(0, ...values.map((value) => Math.abs(value || 0)));
  const maxKronor = maxOre / 100;
  const incrementKronor = maxKronor <= 20000 ? 1000 : 5000;
  return incrementKronor * 100;
}

function formatRoundedAmount(value: number, increment: number) {
  const rounded = roundToIncrement(value || 0, increment);
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format((rounded || 0) / 100);
}

function formatCount(value: number) {
  return new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(Number(value || 0)));
}

function getSummaryLabel(period: PeriodOption) {
  if (period === 'month') return 'senaste månaden';
  if (period === 'year') return 'senaste året';
  if (period === 'custom') return 'vald period';
  return 'senaste veckan';
}

function formatDateInputValue(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

function createDefaultDateInputs() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 6);
  const compareFrom = new Date(from);
  compareFrom.setFullYear(compareFrom.getFullYear() - 1);
  const compareTo = new Date(to);
  compareTo.setFullYear(compareTo.getFullYear() - 1);
  return {
    currentFrom: formatDateInputValue(from),
    currentTo: formatDateInputValue(to),
    compareFrom: formatDateInputValue(compareFrom),
    compareTo: formatDateInputValue(compareTo),
  };
}

function buildChartData(
  series: DashboardComparisonSeriesItem[],
  selectValue: (item: DashboardComparisonSeriesItem) => number
): ChartDataPoint[] {
  return (series || []).map((item) => ({
    key: item.key,
    label: item.label,
    shortLabel: item.shortLabel,
    range: formatRange(item.from, item.to),
    value: selectValue(item),
  }));
}

function getOverviewParams(
  period: PeriodOption,
  comparison: ComparisonOption,
  multiples: MultiplesOption,
  currentFrom: string,
  currentTo: string,
  compareFrom: string,
  compareTo: string
): DashboardOverviewParams {
  const params: DashboardOverviewParams = {
    period,
    comparison,
    multiples: Number(multiples),
  };
  if (period === 'custom') {
    params.currentFrom = currentFrom;
    params.currentTo = currentTo;
  }
  if (comparison === 'custom') {
    params.compareFrom = compareFrom;
    params.compareTo = compareTo;
  }
  return params;
}

function RangeLegend({ data }: { data: ChartDataPoint[] }) {
  if (!data.length) return null;
  return (
    <div className="mb-3 space-y-1">
      {data.map((item, index) => (
        <div key={item.key} className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: barColors[index % barColors.length] }}
          />
          <span className="font-medium text-foreground/80">{item.label}</span>
          <span>{item.range}</span>
        </div>
      ))}
    </div>
  );
}

function formatPercentage(value: number) {
  return new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function getRowActionKey(sale: DashboardLatestSale) {
  return `${sale.orderId}:${sale.giftCardId}`;
}

function getDeliveryStatusLabel(status?: string) {
  const clean = String(status || '').trim();
  return clean || '-';
}

function isSaleSent(sale: DashboardLatestSale) {
  if (sale.deliveredAtUtc) return true;
  const status = String(sale.deliveryStatus || '').toLowerCase();
  return status.includes('sent') || status.includes('deliver');
}

function isSaleCancelled(sale: DashboardLatestSale) {
  const status = String(sale.deliveryStatus || '').toLowerCase();
  return status.includes('cancel');
}

function canResendSale(sale: DashboardLatestSale) {
  return Boolean(sale.orderId && sale.giftCardId);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getDeliveredDisplay(sale: DashboardLatestSale) {
  if (sale.deliveredAtUtc) {
    return {
      text: formatDateTime(sale.deliveredAtUtc),
      className: 'whitespace-nowrap',
    };
  }

  if (sale.scheduledDeliveryUtc && !isSaleCancelled(sale)) {
    return {
      text: formatDateTime(sale.scheduledDeliveryUtc),
      className: 'whitespace-nowrap font-medium text-amber-600',
    };
  }

  return {
    text: '-',
    className: 'whitespace-nowrap',
  };
}

export default function Dashboard() {
  const defaultDateInputs = useMemo(() => createDefaultDateInputs(), []);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodOption>('week');
  const [comparison, setComparison] = useState<ComparisonOption>('same_period_last_year');
  const [multiples, setMultiples] = useState<MultiplesOption>('2');
  const [currentFrom, setCurrentFrom] = useState(defaultDateInputs.currentFrom);
  const [currentTo, setCurrentTo] = useState(defaultDateInputs.currentTo);
  const [compareFrom, setCompareFrom] = useState(defaultDateInputs.compareFrom);
  const [compareTo, setCompareTo] = useState(defaultDateInputs.compareTo);
  const [rowActions, setRowActions] = useState<Record<string, RowAction | undefined>>({});
  const [visibleColumns, setVisibleColumns] = useState<Record<DashboardColumnKey, boolean>>(defaultVisibleColumns);
  const [resendDialogSale, setResendDialogSale] = useState<DashboardLatestSale | null>(null);
  const [sendToOriginal, setSendToOriginal] = useState(true);
  const [sendToManual, setSendToManual] = useState(false);
  const [manualEmail, setManualEmail] = useState('');
  const { toast } = useToast();

  const overviewParams = useMemo(
    () => getOverviewParams(period, comparison, multiples, currentFrom, currentTo, compareFrom, compareTo),
    [period, comparison, multiples, currentFrom, currentTo, compareFrom, compareTo]
  );

  async function refreshOverviewData() {
    const result = await dashboardService.getOverview(overviewParams);
    if (!result.success || !result.data) return;
    setOverview(result.data);
  }

  function openResendDialog(sale: DashboardLatestSale) {
    setResendDialogSale(sale);
    setSendToOriginal(Boolean(sale.recipientEmail));
    setSendToManual(false);
    setManualEmail('');
  }

  function closeResendDialog() {
    setResendDialogSale(null);
    setSendToManual(false);
    setManualEmail('');
  }

  async function handleResendConfirm() {
    const sale = resendDialogSale;
    if (!sale) return;

    const rowKey = getRowActionKey(sale);
    const cleanedManualEmail = manualEmail.trim();
    const wantsManual = sendToManual && cleanedManualEmail.length > 0;
    const wantsOriginal = sendToOriginal && Boolean(sale.recipientEmail);

    if (!wantsOriginal && !wantsManual) {
      toast({
        title: 'Fel',
        description: 'Välj minst en e-postadress att skicka till.',
        variant: 'destructive',
      });
      return;
    }

    if (wantsManual && !isValidEmail(cleanedManualEmail)) {
      toast({
        title: 'Fel',
        description: 'Ange en giltig e-postadress.',
        variant: 'destructive',
      });
      return;
    }

    setRowActions((prev) => ({ ...prev, [rowKey]: 'resend' }));
    try {
      const result = await dashboardService.resendGiftCard(sale.orderId, sale.giftCardId, {
        sendToOriginal: wantsOriginal,
        manualEmail: wantsManual ? cleanedManualEmail : '',
      });

      if (!result.success) {
        toast({
          title: 'Fel',
          description: result.error || 'Kunde inte skicka om presentkortet',
          variant: 'destructive',
        });
        return;
      }

      const sentTo = result.sentTo || [];
      toast({
        title: 'Uppdaterat',
        description: sentTo.length > 0
          ? `Presentkort ${sale.cardNumber || sale.giftCardId} skickades till ${sentTo.join(', ')}.`
          : `Presentkort ${sale.cardNumber || sale.giftCardId} skickades om.`,
      });
      closeResendDialog();
      await refreshOverviewData();
    } finally {
      setRowActions((prev) => {
        const next = { ...prev };
        delete next[rowKey];
        return next;
      });
    }
  }

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      const result = await dashboardService.getOverview(overviewParams);
      if (cancelled) return;
      if (!result.success || !result.data) {
        setError(result.error || 'Kunde inte hämta översikten');
        setIsLoading(false);
        return;
      }
      setOverview(result.data);
      setIsLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [overviewParams]);

  const comparisonSeries = overview?.stats.comparison?.series || [];

  const depositData = useMemo(
    () => buildChartData(comparisonSeries, (item) => item.depositsAmount),
    [comparisonSeries]
  );

  const purchaseData = useMemo(
    () => buildChartData(comparisonSeries, (item) => item.purchasesAmount),
    [comparisonSeries]
  );

  const depositCountData = useMemo(
    () => buildChartData(comparisonSeries, (item) => item.depositsCount),
    [comparisonSeries]
  );

  const purchaseCountData = useMemo(
    () => buildChartData(comparisonSeries, (item) => item.purchasesCount),
    [comparisonSeries]
  );

  const depositIncrement = useMemo(() => getDisplayIncrement(depositData.map((item) => item.value)), [depositData]);
  const purchaseIncrement = useMemo(() => getDisplayIncrement(purchaseData.map((item) => item.value)), [purchaseData]);

  const latestSales: DashboardLatestSale[] = overview?.latestSales || [];
  const expiredTotal = overview?.stats.expired.total ?? 0;
  const depositsTotal = overview?.stats.deposits.total ?? 0;
  const expiredShare = depositsTotal > 0 ? (expiredTotal / depositsTotal) * 100 : 0;
  const summaryLabel = getSummaryLabel(period);

  const resendRowKey = resendDialogSale ? getRowActionKey(resendDialogSale) : '';
  const resendIsLoading = resendRowKey ? rowActions[resendRowKey] === 'resend' : false;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Översikt</h1>
            <p className="text-muted-foreground">Sammanfattning av {summaryLabel}</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Period</span>
              <Select value={period} onValueChange={(value) => setPeriod(value as PeriodOption)}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Välj period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Senaste veckan</SelectItem>
                  <SelectItem value="month">Senaste månaden</SelectItem>
                  <SelectItem value="year">Senaste året</SelectItem>
                  <SelectItem value="custom">Egna datum</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Jämförelseperiod</span>
              <Select value={comparison} onValueChange={(value) => setComparison(value as ComparisonOption)}>
                <SelectTrigger className="w-[260px]">
                  <SelectValue placeholder="Välj jämförelseperiod" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="previous_week">Veckan före</SelectItem>
                  <SelectItem value="previous_month">Månaden före</SelectItem>
                  <SelectItem value="same_period_last_year">Samma period förra året</SelectItem>
                  <SelectItem value="custom">Egna datum</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Multiplar</span>
              <Select value={multiples} onValueChange={(value) => setMultiples(value as MultiplesOption)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Välj antal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {(period === 'custom' || comparison === 'custom') && (
          <div className="grid gap-3 md:grid-cols-2">
            {period === 'custom' && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Egen period</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="dashboard-current-from">Från</Label>
                    <Input
                      id="dashboard-current-from"
                      type="date"
                      value={currentFrom}
                      onChange={(event) => setCurrentFrom(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="dashboard-current-to">Till</Label>
                    <Input
                      id="dashboard-current-to"
                      type="date"
                      value={currentTo}
                      onChange={(event) => setCurrentTo(event.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
            {comparison === 'custom' && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Egen jämförelseperiod</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="dashboard-compare-from">Från</Label>
                    <Input
                      id="dashboard-compare-from"
                      type="date"
                      value={compareFrom}
                      onChange={(event) => setCompareFrom(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="dashboard-compare-to">Till</Label>
                    <Input
                      id="dashboard-compare-to"
                      type="date"
                      value={compareTo}
                      onChange={(event) => setCompareTo(event.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Hämtar data...</span>
          </div>
        ) : error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Insättningar</CardTitle>
                </CardHeader>
                <CardContent>
                  <RangeLegend data={depositData} />
                  <ChartContainer config={chartConfig} className="h-[190px] w-full">
                    <BarChart data={depositData} margin={{ left: 8, right: 8, top: 8 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="shortLabel" tickLine={false} axisLine={false} />
                      <YAxis
                        tickFormatter={(value) => formatRoundedAmount(Number(value), depositIncrement)}
                        width={90}
                      />
                      <ChartTooltip
                        formatter={(value) => formatRoundedAmount(Number(value), depositIncrement)}
                        labelFormatter={(_label, payload) => String(payload?.[0]?.payload?.label || '')}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {depositData.map((entry, index) => (
                          <Cell key={entry.key} fill={barColors[index % barColors.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Antal insättningar</CardTitle>
                </CardHeader>
                <CardContent>
                  <RangeLegend data={depositCountData} />
                  <ChartContainer config={countChartConfig} className="h-[190px] w-full">
                    <BarChart data={depositCountData} margin={{ left: 8, right: 8, top: 8 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="shortLabel" tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={(value) => formatCount(Number(value))} width={72} />
                      <ChartTooltip
                        formatter={(value) => formatCount(Number(value))}
                        labelFormatter={(_label, payload) => String(payload?.[0]?.payload?.label || '')}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {depositCountData.map((entry, index) => (
                          <Cell key={entry.key} fill={barColors[index % barColors.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Köp</CardTitle>
                </CardHeader>
                <CardContent>
                  <RangeLegend data={purchaseData} />
                  <ChartContainer config={chartConfig} className="h-[190px] w-full">
                    <BarChart data={purchaseData} margin={{ left: 8, right: 8, top: 8 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="shortLabel" tickLine={false} axisLine={false} />
                      <YAxis
                        tickFormatter={(value) => formatRoundedAmount(Number(value), purchaseIncrement)}
                        width={90}
                      />
                      <ChartTooltip
                        formatter={(value) => formatRoundedAmount(Number(value), purchaseIncrement)}
                        labelFormatter={(_label, payload) => String(payload?.[0]?.payload?.label || '')}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {purchaseData.map((entry, index) => (
                          <Cell key={entry.key} fill={barColors[index % barColors.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Antal köp</CardTitle>
                </CardHeader>
                <CardContent>
                  <RangeLegend data={purchaseCountData} />
                  <ChartContainer config={countChartConfig} className="h-[190px] w-full">
                    <BarChart data={purchaseCountData} margin={{ left: 8, right: 8, top: 8 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="shortLabel" tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={(value) => formatCount(Number(value))} width={72} />
                      <ChartTooltip
                        formatter={(value) => formatCount(Number(value))}
                        labelFormatter={(_label, payload) => String(payload?.[0]?.payload?.label || '')}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {purchaseCountData.map((entry, index) => (
                          <Cell key={entry.key} fill={barColors[index % barColors.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="text-sm text-muted-foreground">Utgångna/avslutade kort</div>
              <div className="text-2xl font-semibold">{formatCurrency(expiredTotal)}</div>
              <div className="text-sm text-muted-foreground">
                {formatPercentage(expiredShare)} % av alla insättningar
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Senast sålda presentkort</CardTitle>
              </CardHeader>
              <CardContent>
                {latestSales.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Inga sålda presentkort hittades.</div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-2">
                            <Settings2 className="h-4 w-4" />
                            Kolumner
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>Visa kolumner</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {dashboardColumnOptions.map((column) => (
                            <DropdownMenuCheckboxItem
                              key={column.key}
                              checked={visibleColumns[column.key]}
                              onCheckedChange={(checked) => {
                                setVisibleColumns((prev) => ({
                                  ...prev,
                                  [column.key]: Boolean(checked),
                                }));
                              }}
                            >
                              {column.label}
                            </DropdownMenuCheckboxItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="overflow-x-auto">
                    <Table className="table-fixed text-xs [&_th]:h-9 [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-2">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Datum</TableHead>
                          <TableHead>Kortnummer</TableHead>
                          <TableHead>Mottagare</TableHead>
                          <TableHead>Mottagar-e-post</TableHead>
                          <TableHead>Avsändare</TableHead>
                          <TableHead className="text-right">Belopp</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Schemalagd leverans</TableHead>
                          <TableHead>Utskickad</TableHead>
                          <TableHead>Företag</TableHead>
                          <TableHead>Meddelande</TableHead>
                          <TableHead className="sticky right-0 z-10 bg-card text-right">Åtgärder</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {latestSales.map((sale) => {
                          const rowKey = getRowActionKey(sale);
                          const currentAction = rowActions[rowKey];
                          const rowBusy = Boolean(currentAction);
                          const canResend = canResendSale(sale) && !rowBusy;
                          const canCancel = canCancelSale(sale) && !rowBusy;

                          return (
                            <TableRow key={sale.id}>
                              <TableCell className="text-muted-foreground whitespace-nowrap">
                                {formatDateTime(sale.createdAtUtc)}
                              </TableCell>
                              <TableCell className="font-medium whitespace-nowrap">{sale.cardNumber || '-'}</TableCell>
                              <TableCell className="max-w-[120px] truncate" title={sale.recipientName || ''}>{sale.recipientName || '-'}</TableCell>
                              <TableCell className="max-w-[160px] truncate" title={sale.recipientEmail || ''}>{sale.recipientEmail || '-'}</TableCell>
                              <TableCell className="max-w-[120px] truncate" title={sale.senderName || ''}>{sale.senderName || '-'}</TableCell>
                              <TableCell className="text-right font-semibold whitespace-nowrap">
                                {formatSek(sale.amount)}
                              </TableCell>
                              <TableCell>{getDeliveryStatusLabel(sale.deliveryStatus)}</TableCell>
                              <TableCell className="whitespace-nowrap">{formatScheduledDelivery(sale.scheduledDeliveryUtc)}</TableCell>
                              <TableCell className="whitespace-nowrap">{formatDateTime(sale.deliveredAtUtc)}</TableCell>
                              <TableCell className="max-w-[110px] truncate" title={sale.companyName || ''}>{sale.companyName || '-'}</TableCell>
                              <TableCell className="max-w-[140px] truncate" title={sale.message || ''}>
                                {sale.message || '-'}
                              </TableCell>
                              <TableCell className="sticky right-0 bg-card/95 text-right backdrop-blur-sm">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-[11px]"
                                    disabled={!canResend}
                                    onClick={() => openResendDialog(sale)}
                                  >
                                    {currentAction === 'resend' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Skicka om'}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-7 px-2 text-[11px]"
                                    disabled={!canCancel}
                                    onClick={() => handleCancel(sale)}
                                  >
                                    {currentAction === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Avbryt'}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Dialog open={Boolean(resendDialogSale)} onOpenChange={(open) => { if (!open) closeResendDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skicka om presentkort</DialogTitle>
            <DialogDescription>
              Välj om presentkortet ska skickas till originalmailen och/eller en manuell e-postadress.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="resend-original-email"
                checked={sendToOriginal}
                disabled={!resendDialogSale?.recipientEmail || resendIsLoading}
                onCheckedChange={(checked) => setSendToOriginal(Boolean(checked))}
              />
              <div className="space-y-1">
                <Label htmlFor="resend-original-email">Skicka till originalmail</Label>
                <div className="text-sm text-muted-foreground">
                  {resendDialogSale?.recipientEmail || 'Ingen originalmail finns på kortet'}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="resend-manual-email"
                checked={sendToManual}
                disabled={resendIsLoading}
                onCheckedChange={(checked) => setSendToManual(Boolean(checked))}
              />
              <div className="flex-1 space-y-2">
                <Label htmlFor="resend-manual-email">Skicka till manuell e-postadress</Label>
                <Input
                  type="email"
                  placeholder="namn@domän.se"
                  value={manualEmail}
                  disabled={!sendToManual || resendIsLoading}
                  onChange={(event) => setManualEmail(event.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeResendDialog} disabled={resendIsLoading}>
              Avbryt
            </Button>
            <Button onClick={handleResendConfirm} disabled={resendIsLoading}>
              {resendIsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Skicka om'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
