import { useState, useEffect, useMemo } from 'react';
import GiftCardDetailsDialog from '@/components/giftcard/GiftCardDetailsDialog';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DateInput } from '@/components/ui/date-input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Download, FileSpreadsheet, Loader2, Search, ChevronLeft, ChevronRight, ExternalLink, ChevronDown } from 'lucide-react';
import { SortableTableHeaderButton } from '@/components/ui/sortable-table-header-button';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { formatCurrency } from '@/services/giftcardService';
import { downloadXlsx } from '@/services/exportService';
import {
  reportService,
  exportToXlsx,
  type ReportFilters,
  type TransactionReportRow,
  type BalanceReportRow,
  type BalanceByRetailstoreRow,
} from '@/services/reportService';

const DEFAULT_FILTERS: ReportFilters = {
  dateRegions: [
    { value: 'today', label: 'Idag' },
    { value: 'yesterday', label: 'Igår' },
    { value: 'week', label: 'Denna vecka' },
    { value: 'last week', label: 'Förra veckan' },
    { value: 'month', label: 'Denna månad' },
    { value: 'last month', label: 'Förra månaden' },
    { value: 'year', label: 'I år' },
    { value: 'last year', label: 'Förra året' },
  ],
  transactionTypes: [
    { value: 'all', label: 'Alla' },
    { value: 'purchase', label: 'Köp' },
    { value: 'deposit', label: 'Insättning' },
    { value: 'buyback', label: 'Återköp' },
    { value: 'clearing', label: 'Avräkning' },
  ],
  retailstores: [{ value: 'all', label: 'Alla' }],
  presentcardAccounts: [{ value: 'all', label: 'Alla' }],
  balanceRetailstores: [{ value: 'all', label: 'Alla' }],
};

const PAGE_SIZE_OPTIONS = [
  { value: '25', label: '25' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
];

const BALANCE_COLUMN_OPTIONS = [
  { key: 'expires', label: 'Utgångsdatum' },
  { key: 'accountName', label: 'Konto' },
  { key: 'accountId', label: 'Kortkonto' },
  { key: 'latestTransaction', label: 'Senaste transaktion' },
] as const;
const BALANCE_PAGE_SIZE = 100;
const RETAILSTORE_BALANCE_TRANSACTION_OPTIONS = [
  { value: 'all', label: 'Alla' },
  { value: 'Insättning', label: 'Insättning' },
  { value: 'Köp', label: 'Köp' },
  { value: 'Avslut', label: 'Avslut' },
  { value: 'Återköp', label: 'Återköp' },
];

function formatDateOnly(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '-';
  return format(date, 'yyyy-MM-dd', { locale: sv });
}

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatLatestTransactionText(date?: string, title?: string) {
  const datePart = formatDateOnly(date);
  const titlePart = (title || '').trim();

  if (datePart !== '-' && titlePart) return `${datePart} ${titlePart}`;
  if (datePart !== '-') return datePart;
  if (titlePart) return titlePart;
  return '-';
}

function toggleMultiSelectValue(currentValues: string[], nextValue: string) {
  if (nextValue === 'all') return ['all'];

  const current = currentValues.includes('all') ? [] : currentValues;
  const next = current.includes(nextValue)
    ? current.filter((value) => value !== nextValue)
    : [...current, nextValue];

  return next.length > 0 ? next : ['all'];
}

function getMultiSelectSummary(options: Array<{ value: string; label: string }>, selectedValues: string[]) {
  if (selectedValues.length === 0 || selectedValues.includes('all')) return 'Alla';

  const selectedLabels = options
    .filter((option) => option.value !== 'all' && selectedValues.includes(option.value))
    .map((option) => option.label);

  if (selectedLabels.length === 0) return 'Alla';
  if (selectedLabels.length === 1) return selectedLabels[0];
  return `${selectedLabels.length} valda`;
}

function MultiSelectFilter({
  options,
  selectedValues,
  onChange,
  placeholder,
}: {
  options: Array<{ value: string; label: string }>;
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between font-normal">
          <span className="truncate">{getMultiSelectSummary(options, selectedValues) || placeholder}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[280px] p-3">
        <div className="space-y-2">
          {options.map((option) => {
            const checked = option.value === 'all'
              ? selectedValues.includes('all') || selectedValues.length === 0
              : selectedValues.includes(option.value);

            return (
              <label key={option.value} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => onChange(toggleMultiSelectValue(selectedValues, option.value))}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function TransactionReport() {
  const { toast } = useToast();
  const [selectedCardNumber, setSelectedCardNumber] = useState<string | null>(null);
  const [loadingReceiptId, setLoadingReceiptId] = useState<string | null>(null);
  const [filters, setFilters] = useState<ReportFilters>(DEFAULT_FILTERS);
  const [selectedDateRegion, setSelectedDateRegion] = useState<string>('week');
  const [selectedTxType, setSelectedTxType] = useState<string>('all');
  const [selectedRetailstore, setSelectedRetailstore] = useState<string>('all');
  const [transactions, setTransactions] = useState<TransactionReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);
  const [pageSize, setPageSize] = useState<string>('50');
  const [currentPage, setCurrentPage] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [balanceRows, setBalanceRows] = useState<BalanceReportRow[]>([]);
  const [balanceTotal, setBalanceTotal] = useState(0);
  const [balanceTotalCount, setBalanceTotalCount] = useState(0);
  const [balanceHasSearched, setBalanceHasSearched] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceDate, setBalanceDate] = useState(getTodayDateString());
  const [balanceExpiryStatus, setBalanceExpiryStatus] = useState<'all' | 'expired' | 'active'>('all');
  const [balanceIncludeZero, setBalanceIncludeZero] = useState(true);
  const [balanceViewMode, setBalanceViewMode] = useState<'per-card' | 'summary'>('per-card');
  const [balancePage, setBalancePage] = useState(1);
  const [balanceParams, setBalanceParams] = useState<{
    asOfDate?: string;
    expiryStatus: 'all' | 'expired' | 'active';
    viewMode: 'summary' | 'per-card';
    includeZeroBalance: boolean;
    includeLatestTransaction: boolean;
  } | null>(null);
  const [balanceColumns, setBalanceColumns] = useState({
    expires: true,
    accountName: true,
    accountId: true,
    latestTransaction: false,
  });
  const [balanceByRetailstoreRows, setBalanceByRetailstoreRows] = useState<BalanceByRetailstoreRow[]>([]);
  const [balanceByRetailstoreTotal, setBalanceByRetailstoreTotal] = useState(0);
  const [balanceByRetailstoreCount, setBalanceByRetailstoreCount] = useState(0);
  const [balanceByRetailstoreHasSearched, setBalanceByRetailstoreHasSearched] = useState(false);
  const [balanceByRetailstoreLoading, setBalanceByRetailstoreLoading] = useState(false);
  const [balanceByRetailstoreDate, setBalanceByRetailstoreDate] = useState(getTodayDateString());
  const [balanceByRetailstoreRetailstores, setBalanceByRetailstoreRetailstores] = useState<string[]>(['all']);
  const [balanceByRetailstorePresentcardAccounts, setBalanceByRetailstorePresentcardAccounts] = useState<string[]>(['all']);
  const [balanceByRetailstoreTransactionTitles, setBalanceByRetailstoreTransactionTitles] = useState<string[]>(['all']);

  const pageSizeNum = parseInt(pageSize, 10);
  const totalPages = pageSizeNum > 0 ? Math.ceil(transactions.length / pageSizeNum) : 1;

  const sortedTransactions = useMemo(() => {
    if (!sortKey) return transactions;

    const parseDateValue = (value: string) => {
      if (!value) return 0;
      const normalized = value.includes('T') ? value : value.replace(' ', 'T');
      const date = new Date(normalized);
      return Number.isNaN(date.valueOf()) ? 0 : date.valueOf();
    };

    const parseAmountValue = (value: string) => {
      if (!value) return 0;
      const cleaned = value
        .replace(/\s/g, '')
        .replace(/[^\d,.-]/g, '')
        .replace(',', '.');
      const num = parseFloat(cleaned);
      return Number.isNaN(num) ? 0 : num;
    };

    const getSortValue = (row: TransactionReportRow, key: string) => {
      const raw = row[key] ?? '';
      if (key === 'Datum') return parseDateValue(String(raw));
      if (key === 'Belopp') return parseAmountValue(String(raw));
      return String(raw);
    };

    const direction = sortDirection === 'asc' ? 1 : -1;
    return [...transactions].sort((a, b) => {
      const aVal = getSortValue(a, sortKey);
      const bVal = getSortValue(b, sortKey);
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * direction;
      }
      return String(aVal).localeCompare(String(bVal), 'sv-SE', { numeric: true, sensitivity: 'base' }) * direction;
    });
  }, [transactions, sortKey, sortDirection]);

  const paginatedTransactions = useMemo(() => {
    const start = currentPage * pageSizeNum;
    return sortedTransactions.slice(start, start + pageSizeNum);
  }, [sortedTransactions, currentPage, pageSizeNum]);

  useEffect(() => {
    loadFilters();
  }, []);

  useEffect(() => {
    setCurrentPage(0);
  }, [pageSize]);

  async function loadFilters() {
    setIsLoadingFilters(true);
    const result = await reportService.getFilters();
    if (result.success && result.filterOptions) {
      setFilters({
        dateRegions: result.filterOptions.dateRegions.length > 0 ? result.filterOptions.dateRegions : DEFAULT_FILTERS.dateRegions,
        transactionTypes: result.filterOptions.transactionTypes.length > 0 ? result.filterOptions.transactionTypes : DEFAULT_FILTERS.transactionTypes,
        retailstores: result.filterOptions.retailstores && result.filterOptions.retailstores.length > 0
          ? result.filterOptions.retailstores
          : DEFAULT_FILTERS.retailstores,
        presentcardAccounts: result.filterOptions.presentcardAccounts && result.filterOptions.presentcardAccounts.length > 0
          ? result.filterOptions.presentcardAccounts
          : DEFAULT_FILTERS.presentcardAccounts,
        balanceRetailstores: result.filterOptions.balanceRetailstores && result.filterOptions.balanceRetailstores.length > 0
          ? result.filterOptions.balanceRetailstores
          : DEFAULT_FILTERS.balanceRetailstores,
      });
    }
    setIsLoadingFilters(false);
  }

  async function handleSearch() {
    setIsLoading(true);
    setHasSearched(true);
    setCurrentPage(0);

    const dateRegion = filters.dateRegions.find(d => d.value === selectedDateRegion);
    const txType = filters.transactionTypes.find(t => t.value === selectedTxType);

    const result = await reportService.generateReport({
      dateRegion,
      transactionType: txType,
      retailstoreId: selectedRetailstore,
    });

    if (result.success && result.transactions) {
      setTransactions(result.transactions);
      if (result.transactions.length === 0) {
        toast({ title: 'Inga transaktioner', description: 'Inga transaktioner hittades för vald period.' });
      }
    } else {
      toast({ title: 'Fel', description: result.error || 'Kunde inte hämta rapport', variant: 'destructive' });
    }

    setIsLoading(false);
  }

  function handleSort(header: string) {
    setCurrentPage(0);
    setSortKey((prev) => {
      if (prev === header) {
        setSortDirection((dir) => (dir === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDirection(header === 'Datum' || header === 'Belopp' ? 'desc' : 'asc');
      return header;
    });
  }

  async function handleExport() {
    if (transactions.length === 0) return;
    const dateLabel = filters.dateRegions.find(d => d.value === selectedDateRegion)?.label || selectedDateRegion;
    await exportToXlsx(transactions, `transaktionsrapport_${dateLabel}_${new Date().toISOString().slice(0, 10)}`);
    toast({ title: 'Exporterad', description: 'Rapporten har laddats ner som Excel-fil.' });
  }

  async function handleBalanceSearch(overrides?: { includeLatestTransaction?: boolean; includeZeroBalance?: boolean }) {
    setBalanceLoading(true);
    setBalanceHasSearched(true);
    setBalancePage(1);

    const includeLatestRequested = overrides?.includeLatestTransaction ?? balanceColumns.latestTransaction;
    const includeLatestTransaction = balanceViewMode === 'per-card' && includeLatestRequested;
    const includeZeroBalance = overrides?.includeZeroBalance ?? balanceIncludeZero;
    const nextParams = {
      asOfDate: balanceDate || undefined,
      expiryStatus: balanceExpiryStatus,
      viewMode: balanceViewMode,
      includeZeroBalance,
      includeLatestTransaction,
    };
    setBalanceParams(nextParams);

    const result = await reportService.generateBalanceReport({
      ...nextParams,
      page: 1,
      pageSize: BALANCE_PAGE_SIZE,
    });

    if (result.success) {
      setBalanceRows(result.rows || []);
      setBalanceTotal(result.totalBalance || 0);
      const nextTotalCount = typeof result.totalCount === 'number'
        ? result.totalCount
        : (result.rows || []).length;
      setBalanceTotalCount(nextTotalCount);
      if (balanceViewMode === 'per-card' && (result.rows || []).length === 0) {
        toast({ title: 'Inga kort', description: 'Inga kort hittades f??r valda filter.' });
      }
    } else {
      toast({ title: 'Fel', description: result.error || 'Kunde inte h??mta saldo-rapport', variant: 'destructive' });
    }

    setBalanceLoading(false);
  }

  async function handleBalancePageChange(nextPage: number) {
    if (!balanceParams || balanceViewMode !== 'per-card') return;
    const totalPages = Math.max(1, Math.ceil((balanceTotalCount || 0) / BALANCE_PAGE_SIZE));
    const safePage = Math.min(Math.max(nextPage, 1), totalPages);
    if (safePage === balancePage) return;

    setBalanceLoading(true);
    setBalancePage(safePage);

    const result = await reportService.generateBalanceReport({
      ...balanceParams,
      page: safePage,
      pageSize: BALANCE_PAGE_SIZE,
    });

    if (result.success) {
      setBalanceRows(result.rows || []);
      setBalanceTotal(result.totalBalance || 0);
      const nextTotalCount = typeof result.totalCount === 'number'
        ? result.totalCount
        : (result.rows || []).length;
      setBalanceTotalCount(nextTotalCount);
    } else {
      toast({ title: 'Fel', description: result.error || 'Kunde inte h??mta saldo-rapport', variant: 'destructive' });
    }

    setBalanceLoading(false);
  }

  async function handleBalanceExport(rows: Array<Record<string, string>>) {
    if (rows.length === 0) return;
    const dateSuffix = balanceDate ? balanceDate : new Date().toISOString().slice(0, 10);
    await downloadXlsx(rows, `saldo_rapport_${dateSuffix}`, Object.keys(rows[0]), 'Saldo');
    toast({ title: 'Exporterad', description: 'Saldo-rapporten har laddats ner som Excel-fil.' });
  }

  async function handleBalanceByRetailstoreSearch() {
    setBalanceByRetailstoreLoading(true);
    setBalanceByRetailstoreHasSearched(true);

    const result = await reportService.generateBalanceByRetailstoreReport({
      asOfDate: balanceByRetailstoreDate || undefined,
      retailstores: balanceByRetailstoreRetailstores,
      presentcardAccounts: balanceByRetailstorePresentcardAccounts,
      transactionTitles: balanceByRetailstoreTransactionTitles,
    });

    if (result.success) {
      const rows = result.rows || [];
      setBalanceByRetailstoreRows(rows);
      setBalanceByRetailstoreTotal(result.totalBalance || 0);
      setBalanceByRetailstoreCount(typeof result.totalCount === 'number' ? result.totalCount : rows.length);
      if (rows.length === 0) {
        toast({ title: 'Inga säljställen', description: 'Inga saldon hittades för valda filter.' });
      }
    } else {
      toast({ title: 'Fel', description: result.error || 'Kunde inte hämta saldo-rapport per säljställe', variant: 'destructive' });
    }

    setBalanceByRetailstoreLoading(false);
  }

  async function handleBalanceByRetailstoreExport(rows: Array<Record<string, string>>) {
    if (rows.length === 0) return;
    const dateSuffix = balanceByRetailstoreDate ? balanceByRetailstoreDate : new Date().toISOString().slice(0, 10);
    await downloadXlsx(rows, `saldo_rapport_per_saljstalle_${dateSuffix}`, Object.keys(rows[0]), 'Saldo per säljställe');
    toast({ title: 'Exporterad', description: 'Saldo-rapporten per säljställe har laddats ner som Excel-fil.' });
  }

  const headers = transactions.length > 0 ? Object.keys(transactions[0]).filter(h => !h.startsWith('__')) : [];
  const RECEIPT_BASE_URL = 'https://www.dittkort.se/receipt/?guid=';

  const balanceHeaders = useMemo(() => {
    const columns = ['Kortnummer', 'Saldo'];
    if (balanceColumns.expires) columns.push('Utgångsdatum');
    if (balanceColumns.accountName) columns.push('Konto');
    if (balanceColumns.accountId) columns.push('Kortkonto');
    if (balanceColumns.latestTransaction) columns.push('Senaste transaktion');
    return columns;
  }, [balanceColumns]);

  const balanceTableRows = useMemo(() => {
    return balanceRows.map((row) => {
      const data: Record<string, string> = {
        Kortnummer: row.cardNumber || '-',
        Saldo: formatCurrency(row.balance || 0),
      };
      if (balanceColumns.expires) data['Utgångsdatum'] = formatDateOnly(row.expires);
      if (balanceColumns.accountName) data['Konto'] = row.accountName || '-';
      if (balanceColumns.accountId) data['Kortkonto'] = row.accountId || '-';
      if (balanceColumns.latestTransaction) {
        const latestDate = formatDateOnly(row.lastTransactionDate);
        const latestType = row.lastTransactionTitle || '';
        let latestLabel = '-';
        if (latestDate !== '-' && latestType) {
          latestLabel = `${latestDate} - ${latestType}`;
        } else if (latestDate !== '-') {
          latestLabel = latestDate;
        } else if (latestType) {
          latestLabel = latestType;
        }
        data['Senaste transaktion'] = latestLabel;
      }
      return data;
    });
  }, [balanceRows, balanceColumns]);

  const balanceTotalLabel = formatCurrency(balanceTotal || 0);
  const balanceTotalPages = Math.max(1, Math.ceil((balanceTotalCount || 0) / BALANCE_PAGE_SIZE));
  const showBalancePagination = balanceViewMode === 'per-card' && balanceTotalCount > BALANCE_PAGE_SIZE;
  const balanceByRetailstoreHeaders = useMemo(() => {
    const hasTransactionTitle = balanceByRetailstoreRows.some((row) => Boolean(row.transactionTitle));
    return hasTransactionTitle
      ? ['Säljställe', 'Transaktionstyp', 'Saldo', 'Senast utförda transaktion']
      : ['Säljställe', 'Saldo', 'Senast utförda transaktion'];
  }, [balanceByRetailstoreRows]);
  const balanceByRetailstoreTableRows = useMemo(() => {
    return balanceByRetailstoreRows.map((row) => {
      const data: Record<string, string> = {
        'Säljställe': row.retailstoreName || '-',
        'Saldo': formatCurrency(row.balance || 0),
        'Senast utförda transaktion': formatLatestTransactionText(row.lastTransactionDate, row.lastTransactionTitle),
      };

      if (row.transactionTitle) {
        data['Transaktionstyp'] = row.transactionTitle;
      }

      return data;
    });
  }, [balanceByRetailstoreRows]);
  const balanceByRetailstoreTotalLabel = formatCurrency(balanceByRetailstoreTotal || 0);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Rapporter</h1>
            <p className="text-muted-foreground">Skapa och exportera rapporter</p>
          </div>
        </div>

        <Tabs defaultValue="transactions" className="space-y-6">
          <TabsList>
            <TabsTrigger value="transactions">Transaktioner</TabsTrigger>
            <TabsTrigger value="balances">Saldo</TabsTrigger>
            <TabsTrigger value="balances-by-retailstore">Saldo per säljställe</TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Transaktionsrapport</h2>
                <p className="text-muted-foreground">Sök och exportera transaktioner</p>
              </div>
              {transactions.length > 0 && (
                <Button onClick={handleExport} variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Exportera till Excel
                </Button>
              )}
            </div>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Filter
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Period</label>
                    <Select value={selectedDateRegion} onValueChange={setSelectedDateRegion} disabled={isLoadingFilters}>
                      <SelectTrigger>
                        <SelectValue placeholder="Välj period" />
                      </SelectTrigger>
                      <SelectContent>
                        {filters.dateRegions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Säljställe</label>
                    <Select value={selectedRetailstore} onValueChange={setSelectedRetailstore} disabled={isLoadingFilters}>
                      <SelectTrigger>
                        <SelectValue placeholder="Välj säljställe" />
                      </SelectTrigger>
                      <SelectContent>
                        {filters.retailstores.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Transaktionstyp</label>
                    <Select value={selectedTxType} onValueChange={setSelectedTxType} disabled={isLoadingFilters}>
                      <SelectTrigger>
                        <SelectValue placeholder="Välj typ" />
                      </SelectTrigger>
                      <SelectContent>
                        {filters.transactionTypes.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <Button onClick={handleSearch} disabled={isLoading} className="gap-2">
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Sök
                  </Button>
                  {hasSearched && (
                    <Badge variant="secondary">
                      {transactions.length} transaktioner
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {hasSearched && (
              <Card>
                <CardContent className="p-0">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : transactions.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      Inga transaktioner hittades för vald period.
                    </div>
                  ) : (
                    <>
                      <div className="overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {headers.map(header => (
                                <TableHead key={header} className="whitespace-nowrap">
                                  <SortableTableHeaderButton
                                    label={header}
                                    active={sortKey === header}
                                    direction={sortDirection}
                                    onClick={() => handleSort(header)}
                                  />
                                </TableHead>
                              ))}
                              <TableHead className="whitespace-nowrap w-10">Kvitto</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginatedTransactions.map((row, index) => (
                              <TableRow
                                key={index}
                                className={row['Kortnummer'] ? 'cursor-pointer hover:bg-accent/70 hover:shadow-[inset_0_0_0_1px_hsl(var(--ring)/0.18)]' : undefined}
                                onClick={() => {
                                  if (row['Kortnummer']) {
                                    setSelectedCardNumber(row['Kortnummer']);
                                  }
                                }}
                              >
                                {headers.map(header => (
                                  <TableCell key={header} className="whitespace-nowrap">
                                    {header === 'Kortnummer' && row[header] ? (
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setSelectedCardNumber(row[header]);
                                        }}
                                        className="font-mono font-semibold text-foreground transition-colors hover:text-foreground/80"
                                      >
                                        {row[header]}
                                      </button>
                                    ) : (
                                      row[header]
                                    )}
                                  </TableCell>
                                ))}
                                <TableCell className="whitespace-nowrap">
                                  {row['__hasReceipt'] === 'true' && row['__transactionId'] ? (
                                    <button
                                      type="button"
                                      disabled={loadingReceiptId === row['__transactionId']}
                                      onClick={async (event) => {
                                        event.stopPropagation();
                                        const txId = row['__transactionId'];
                                        setLoadingReceiptId(txId);
                                        try {
                                          const result = await reportService.getReceiptGuid(txId, filters.dateRegions.find(d => d.value === selectedDateRegion));
                                          if (result.success && result.guid) {
                                            window.open(`${RECEIPT_BASE_URL}${result.guid}`, '_blank');
                                          } else {
                                            toast({ title: 'Fel', description: result.error || 'Kunde inte hämta kvitto', variant: 'destructive' });
                                          }
                                        } finally {
                                          setLoadingReceiptId(null);
                                        }
                                      }}
                                      className="text-primary hover:text-primary/80 transition-colors"
                                      title="Visa kvitto"
                                    >
                                      {loadingReceiptId === row['__transactionId'] ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <ExternalLink className="h-4 w-4" />
                                      )}
                                    </button>
                                  ) : null}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      <div className="flex items-center justify-between border-t px-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>Visa</span>
                          <Select value={pageSize} onValueChange={setPageSize}>
                            <SelectTrigger className="w-[80px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PAGE_SIZE_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span>per sida</span>
                        </div>

                        {totalPages > 1 && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              Sida {currentPage + 1} av {totalPages}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              disabled={currentPage === 0}
                              onClick={() => setCurrentPage(p => p - 1)}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              disabled={currentPage >= totalPages - 1}
                              onClick={() => setCurrentPage(p => p + 1)}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="balances" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Saldo-rapport</h2>
                <p className="text-muted-foreground">Visa saldo för alla kort vid valt datum</p>
              </div>
              {balanceViewMode === 'per-card' && balanceTableRows.length > 0 && (
                <Button
                  onClick={() => handleBalanceExport(balanceTableRows)}
                  variant="outline"
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Exportera till Excel
                </Button>
              )}
            </div>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Filter
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Saldodatum</label>
                    <DateInput
                      value={balanceDate}
                      onChange={(event) => setBalanceDate(event.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Utgångsstatus</label>
                    <Select value={balanceExpiryStatus} onValueChange={(value) => setBalanceExpiryStatus(value as 'all' | 'expired' | 'active')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Välj status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alla</SelectItem>
                        <SelectItem value="expired">Utgångna</SelectItem>
                        <SelectItem value="active">Ej utgångna</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Saldo</label>
                    <Select
                      value={balanceIncludeZero ? 'include' : 'exclude'}
                      onValueChange={(value) => setBalanceIncludeZero(value === 'include')}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Välj saldo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="include">Visa kort utan saldo</SelectItem>
                        <SelectItem value="exclude">Dölj kort utan saldo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Visa</label>
                    <Select value={balanceViewMode} onValueChange={(value) => setBalanceViewMode(value as 'per-card' | 'summary')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Välj visning" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="per-card">Per kort</SelectItem>
                        <SelectItem value="summary">Sammanlagd summa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <div className="text-sm font-medium text-muted-foreground">Kolumner</div>
                  {BALANCE_COLUMN_OPTIONS.map((column) => (
                    <label key={column.key} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={balanceColumns[column.key]}
                        onCheckedChange={(checked) => {
                          const nextChecked = Boolean(checked);
                          setBalanceColumns((prev) => ({ ...prev, [column.key]: nextChecked }));
                          if (column.key === 'latestTransaction') {
                            if (nextChecked && balanceHasSearched && !balanceLoading) {
                              handleBalanceSearch({ includeLatestTransaction: true });
                            } else if (!nextChecked && balanceParams?.includeLatestTransaction) {
                              setBalanceParams((prev) => (prev ? { ...prev, includeLatestTransaction: false } : prev));
                            }
                          }
                        }}
                      />
                      {column.label}
                    </label>
                  ))}
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <Button onClick={handleBalanceSearch} disabled={balanceLoading} className="gap-2">
                    {balanceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Ta fram saldo
                  </Button>
                </div>
              </CardContent>
            </Card>

            {balanceHasSearched && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Sammanlagt saldo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">{balanceTotalLabel}</div>
                  <div className="text-sm text-muted-foreground">Antal kort: {balanceTotalCount || 0}</div>
                </CardContent>
              </Card>
            )}

            {balanceHasSearched && balanceViewMode === 'per-card' && (
              <Card>
                <CardContent className="p-0">
                  {balanceLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : balanceTableRows.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      Inga kort hittades för valda filter.
                    </div>
                  ) : (
                    <>
                      <div className="overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {balanceHeaders.map(header => (
                                <TableHead key={header} className="whitespace-nowrap">{header}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {balanceTableRows.map((row, index) => (
                              <TableRow key={index}>
                                {balanceHeaders.map(header => (
                                  <TableCell key={header} className="whitespace-nowrap">
                                    {row[header]}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
                        <div className="text-sm text-muted-foreground">
                          Antal kort: {balanceTotalCount || balanceTableRows.length}
                        </div>
                        {showBalancePagination && (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              Sida {balancePage} av {balanceTotalPages}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={balancePage <= 1}
                              onClick={() => handleBalancePageChange(1)}
                            >
                              Första
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={balancePage <= 1}
                              onClick={() => handleBalancePageChange(Math.max(1, balancePage - 10))}
                            >
                              -10
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={balancePage <= 1}
                              onClick={() => handleBalancePageChange(balancePage - 1)}
                            >
                              Föregående
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={balancePage >= balanceTotalPages}
                              onClick={() => handleBalancePageChange(balancePage + 1)}
                            >
                              Nästa
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={balancePage >= balanceTotalPages}
                              onClick={() => handleBalancePageChange(Math.min(balanceTotalPages, balancePage + 10))}
                            >
                              +10
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={balancePage >= balanceTotalPages}
                              onClick={() => handleBalancePageChange(balanceTotalPages)}
                            >
                              Sista
                            </Button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="balances-by-retailstore" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Saldorapport per säljställe</h2>
                <p className="text-muted-foreground">Visa summerat saldo per säljställe vid valt datum</p>
              </div>
              {balanceByRetailstoreTableRows.length > 0 && (
                <Button
                  onClick={() => handleBalanceByRetailstoreExport(balanceByRetailstoreTableRows)}
                  variant="outline"
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Exportera till Excel
                </Button>
              )}
            </div>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Filter
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Saldodatum</label>
                    <DateInput
                      value={balanceByRetailstoreDate}
                      onChange={(event) => setBalanceByRetailstoreDate(event.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Säljställe</label>
                    <MultiSelectFilter
                      options={filters.balanceRetailstores || DEFAULT_FILTERS.balanceRetailstores || [{ value: 'all', label: 'Alla' }]}
                      selectedValues={balanceByRetailstoreRetailstores}
                      onChange={setBalanceByRetailstoreRetailstores}
                      placeholder="Välj säljställe"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Presentkortskonto</label>
                    <MultiSelectFilter
                      options={filters.presentcardAccounts || DEFAULT_FILTERS.presentcardAccounts}
                      selectedValues={balanceByRetailstorePresentcardAccounts}
                      onChange={setBalanceByRetailstorePresentcardAccounts}
                      placeholder="Välj presentkortskonto"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Transaktionstyp</label>
                    <MultiSelectFilter
                      options={RETAILSTORE_BALANCE_TRANSACTION_OPTIONS}
                      selectedValues={balanceByRetailstoreTransactionTitles}
                      onChange={setBalanceByRetailstoreTransactionTitles}
                      placeholder="Välj transaktionstyp"
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button onClick={handleBalanceByRetailstoreSearch} disabled={balanceByRetailstoreLoading} className="gap-2">
                    {balanceByRetailstoreLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Ta fram saldo
                  </Button>
                </div>
              </CardContent>
            </Card>

            {balanceByRetailstoreHasSearched && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Sammanlagt saldo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">{balanceByRetailstoreTotalLabel}</div>
                  <div className="text-sm text-muted-foreground">Antal rader: {balanceByRetailstoreCount || 0}</div>
                </CardContent>
              </Card>
            )}

            {balanceByRetailstoreHasSearched && (
              <Card>
                <CardContent className="p-0">
                  {balanceByRetailstoreLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : balanceByRetailstoreTableRows.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      Inga säljställen hittades för valda filter.
                    </div>
                  ) : (
                    <div className="overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {balanceByRetailstoreHeaders.map((header) => (
                              <TableHead key={header} className="whitespace-nowrap">{header}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {balanceByRetailstoreTableRows.map((row, index) => (
                            <TableRow key={index}>
                              {balanceByRetailstoreHeaders.map((header) => (
                                <TableCell key={header} className="whitespace-nowrap">
                                  {row[header] || '-'}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <GiftCardDetailsDialog
        cardNumber={selectedCardNumber}
        open={!!selectedCardNumber}
        onOpenChange={(open) => { if (!open) setSelectedCardNumber(null); }}
      />
    </MainLayout>
  );
}
