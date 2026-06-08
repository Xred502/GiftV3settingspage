import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileSpreadsheet, FileText, Loader2, Search, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { DateInput } from '@/components/ui/date-input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SortableTableHeaderButton } from '@/components/ui/sortable-table-header-button';
import { giftcardService } from '@/services/giftcardService';
import { useToast } from '@/hooks/use-toast';
import GiftCardDetailsDialog from '@/components/giftcard/GiftCardDetailsDialog';
import AssignExistingCardDialog from '@/components/giftcard/AssignExistingCardDialog';
import { downloadXlsx } from '@/services/exportService';

type SortKey =
  | 'name'
  | 'email'
  | 'cardNo'
  | 'phone'
  | 'balance'
  | 'expiry'
  | 'status'
  | 'firstTransactionDate'
  | 'firstTransactionRetailstore'
  | 'lastTransactionDate'
  | 'lastTransactionRetailstore';

type SortDir = 'asc' | 'desc';

type ColumnKey = Exclude<SortKey, 'name' | 'cardNo'>;
type CardholderRow = Record<string, string>;
const PDF_EXPORT_MAX_ROWS = 2000;

const COLUMN_OPTIONS: Array<{ key: ColumnKey; label: string }> = [
  { key: 'email', label: 'E-post' },
  { key: 'phone', label: 'Telefon' },
  { key: 'balance', label: 'Saldo' },
  { key: 'expiry', label: 'Utgångsdatum' },
  { key: 'status', label: 'Status' },
  { key: 'firstTransactionDate', label: 'Inköpsdatum' },
  { key: 'firstTransactionRetailstore', label: 'Inköpt på' },
  { key: 'lastTransactionDate', label: 'Senaste transaktion' },
  { key: 'lastTransactionRetailstore', label: 'Säljställe för senaste transaktionen' },
];

function normalizeSortKey(value: string | null): SortKey | null {
  if (!value) return null;
  const accepted: SortKey[] = [
    'name',
    'email',
    'cardNo',
    'phone',
    'balance',
    'expiry',
    'status',
    'firstTransactionDate',
    'firstTransactionRetailstore',
    'lastTransactionDate',
    'lastTransactionRetailstore',
  ];
  return accepted.includes(value as SortKey) ? (value as SortKey) : null;
}

function cleanText(value?: string) {
  if (!value || value === '&nbsp;' || value === '\u00a0') return '';
  return value;
}

function firstNonEmpty(values: Array<string | undefined>) {
  for (const value of values) {
    const cleaned = cleanText(value);
    if (cleaned) return cleaned;
  }
  return '';
}

function formatDateTime(dateStr: string | undefined): string {
  const value = cleanText(dateStr);
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function CardholderSearch() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchKey = searchParams.toString();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'min1kr'>('all');
  const [expiryFilter, setExpiryFilter] = useState<'all' | 'expired' | 'active'>('all');
  const [purchaseDateFilter, setPurchaseDateFilter] = useState<'all' | 'today' | 'thisWeek' | 'thisMonth' | 'custom'>('all');
  const [purchaseDateFrom, setPurchaseDateFrom] = useState('');
  const [purchaseDateTo, setPurchaseDateTo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<CardholderRow[] | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [lastParams, setLastParams] = useState<Record<string, string> | null>(null);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedCardNumber, setSelectedCardNumber] = useState<string | null>(null);
  const [selectedCardholderForAssignment, setSelectedCardholderForAssignment] = useState<CardholderRow | null>(null);
  const [isAssigningCard, setIsAssigningCard] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnKey, boolean>>({
    email: true,
    phone: false,
    balance: true,
    expiry: true,
    status: true,
    firstTransactionDate: true,
    firstTransactionRetailstore: false,
    lastTransactionDate: true,
    lastTransactionRetailstore: false,
  });

  const canSearch = firstName.trim() || lastName.trim() || email.trim() || cardNumber.trim();

  const getCardholderName = (row: CardholderRow) => {
    const first = firstNonEmpty([
      row['Förnamn'],
      row['FÃ¶rnamn'],
      row['FÃƒÂ¶rnamn'],
      row['Firstname'],
      row['First name'],
    ]);
    const last = firstNonEmpty([row['Efternamn'], row['Familyname'], row['Last name']]);
    return [first, last].filter(Boolean).join(' ').trim();
  };

  const getEmail = (row: CardholderRow) =>
    firstNonEmpty([row['E-post'], row['Email'], row['E-mail']]);

  const getCardNo = (row: CardholderRow) =>
    firstNonEmpty([row['Kortnr'], row['Kortnummer'], row['Card number'], row['Cardno']]);

  const getPhone = (row: CardholderRow) =>
    firstNonEmpty([row['Telefon'], row['Mobilnummer'], row['Mobile']]);

  const getBalance = (row: CardholderRow) => firstNonEmpty([row['Saldo']]);

  const getExpiry = (row: CardholderRow) =>
    firstNonEmpty([row['Utgångsdatum'], row['UtgÃ¥ngsdatum'], row['UtgÃƒÂ¥ngsdatum']]);

  const getStatusLabel = (row: CardholderRow) => firstNonEmpty([row['Status']]);

  const getStatusKey = (row: CardholderRow) => {
    const rawStatus = cleanText(row['__status']).toLowerCase();
    if (rawStatus) return rawStatus;
    const label = getStatusLabel(row).toLowerCase();
    if (label.includes('aktiv')) return 'active';
    if (label.includes('utgång')) return 'expired';
    if (label.includes('spärr')) return 'blocked';
    return '';
  };

  const getPurchaseDate = (row: CardholderRow) => firstNonEmpty([row['Inköpsdatum']]);
  const getPurchaseLocation = (row: CardholderRow) =>
    firstNonEmpty([row['Inköpt på'], row['__firstTransactionRetailstore']]);

  const getLatestTransactionType = (row: CardholderRow) =>
    firstNonEmpty([row['__lastTransactionTitle'], row['__lastTransactionType']]);

  const getLatestTransactionDate = (row: CardholderRow) =>
    formatDateTime(firstNonEmpty([row['__lastTransactionDate']]));

  const getLatestTransactionLocation = (row: CardholderRow) =>
    firstNonEmpty([row['Senaste transaktion plats'], row['__lastTransactionRetailstore']]);

  const getStatusClasses = (statusKey: string) => {
    if (statusKey === 'active') {
      return 'border border-emerald-200 bg-emerald-50 text-emerald-700';
    }
    if (statusKey === 'expired') {
      return 'border border-red-200 bg-red-50 text-red-700';
    }
    if (statusKey === 'blocked') {
      return 'border border-amber-200 bg-amber-50 text-amber-700';
    }
    return 'border border-border bg-muted text-muted-foreground';
  };

  const formatDate = (dateStr: string | undefined): string => {
    const value = cleanText(dateStr);
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) return value;
    return date.toLocaleDateString('sv-SE');
  };

  const formatBalance = (balanceStr: string | undefined): string => {
    const value = cleanText(balanceStr);
    if (!value) return '-';
    const ore = parseInt(value, 10);
    if (Number.isNaN(ore)) return '-';
    const kronor = Math.trunc(ore / 100);
    return `${new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 }).format(kronor)} kr`;
  };

  const doSearch = useCallback(async (
    params: Record<string, string>,
    pageOverride?: number,
    sortOverride?: { key: SortKey; dir: SortDir }
  ) => {
    setIsLoading(true);
    setResults(null);
    const nextPage = pageOverride || 1;
    setPage(nextPage);
    setLastParams(params);

    const nextSortKey = sortOverride?.key ?? sortKey;
    const nextSortDir = sortOverride?.dir ?? sortDir;
    if (sortOverride) {
      setSortKey(nextSortKey);
      setSortDir(nextSortDir);
    }

    const result = await giftcardService.searchCardholders({
      ...params,
      page: nextPage,
      pageSize,
      minBalanceOre: params.balance === 'min1kr' ? 100 : undefined,
      expiryFilter: (params.expiry === 'expired' || params.expiry === 'active') ? params.expiry : undefined,
      purchaseDateFilter: (
        params.purchaseDate === 'today'
        || params.purchaseDate === 'thisWeek'
        || params.purchaseDate === 'thisMonth'
        || params.purchaseDate === 'custom'
      ) ? params.purchaseDate : undefined,
      purchaseDateFrom: params.purchaseDateFrom || undefined,
      purchaseDateTo: params.purchaseDateTo || undefined,
      ...(nextSortKey ? { sortBy: nextSortKey, sortDir: nextSortDir } : {}),
    });

    if (result.success) {
      const data = result.data;
      setResults(data?.cardholders || []);
      setTotalCount(data?.totalCount ?? null);
      if ((data?.cardholders || []).length === 0) {
        toast({ title: 'Inga resultat', description: 'Inga kort eller kortinnehavare hittades.' });
      }
    } else {
      toast({ title: 'Fel', description: result.error || 'Sökning misslyckades', variant: 'destructive' });
      setResults([]);
      setTotalCount(null);
    }

    setIsLoading(false);
  }, [pageSize, sortDir, sortKey, toast]);

  const buildUrlParams = (options?: { forceShowAll?: boolean; page?: number }) => {
    const params = new URLSearchParams();
    const hasSearchValues = Boolean(firstName.trim() || lastName.trim() || email.trim() || cardNumber.trim());

    if (firstName.trim()) params.set('firstName', firstName.trim());
    if (lastName.trim()) params.set('lastName', lastName.trim());
    if (email.trim()) params.set('email', email.trim());
    if (cardNumber.trim()) params.set('cardNumber', cardNumber.trim());
    if (options?.forceShowAll || !hasSearchValues) params.set('showAll', 'true');
    params.set('page', String(options?.page || 1));
    params.set('pageSize', String(pageSize));
    params.set('balance', balanceFilter);
    params.set('expiry', expiryFilter);
    params.set('purchaseDate', purchaseDateFilter);
    if (purchaseDateFilter === 'custom') {
      if (purchaseDateFrom) params.set('purchaseDateFrom', purchaseDateFrom);
      if (purchaseDateTo) params.set('purchaseDateTo', purchaseDateTo);
    }
    if (sortKey) params.set('sortBy', sortKey);
    params.set('sortDir', sortDir);

    return params;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSearch) return;
    setSearchParams(buildUrlParams({ page: 1 }));
  };

  const handleShowAll = async () => {
    setSearchParams(buildUrlParams({ forceShowAll: true, page: 1 }));
  };

  const handleApplyFilters = () => {
    setSearchParams(buildUrlParams({ page: 1 }));
  };

  const handleClearSearchFields = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setCardNumber('');
    const params = new URLSearchParams();
    params.set('showAll', 'true');
    params.set('page', '1');
    params.set('pageSize', String(pageSize));
    params.set('balance', balanceFilter);
    params.set('expiry', expiryFilter);
    params.set('purchaseDate', purchaseDateFilter);
    if (purchaseDateFilter === 'custom') {
      if (purchaseDateFrom) params.set('purchaseDateFrom', purchaseDateFrom);
      if (purchaseDateTo) params.set('purchaseDateTo', purchaseDateTo);
    }
    if (sortKey) params.set('sortBy', sortKey);
    params.set('sortDir', sortDir);
    setSearchParams(params);
  };

  const handleClearFilters = () => {
    setBalanceFilter('all');
    setExpiryFilter('all');
    setPurchaseDateFilter('all');
    setPurchaseDateFrom('');
    setPurchaseDateTo('');
    const params = new URLSearchParams();
    if (firstName.trim()) params.set('firstName', firstName.trim());
    if (lastName.trim()) params.set('lastName', lastName.trim());
    if (email.trim()) params.set('email', email.trim());
    if (cardNumber.trim()) params.set('cardNumber', cardNumber.trim());
    if (!firstName.trim() && !lastName.trim() && !email.trim() && !cardNumber.trim()) {
      params.set('showAll', 'true');
    }
    params.set('page', '1');
    params.set('pageSize', String(pageSize));
    params.set('balance', 'all');
    params.set('expiry', 'all');
    params.set('purchaseDate', 'all');
    if (sortKey) params.set('sortBy', sortKey);
    params.set('sortDir', sortDir);
    setSearchParams(params);
  };

  const handleAssignCardClick = (row: CardholderRow) => {
    setSelectedCardholderForAssignment(row);
  };

  const handleAssignExistingCard = async (cardNumber: string) => {
    if (!selectedCardholderForAssignment) return;

    const accountId = selectedCardholderForAssignment['__accountId'] || '';
    const customerId = selectedCardholderForAssignment['__customerId'] || '';

    if (!accountId || !customerId) {
      toast({ title: 'Fel', description: 'Kunde inte hitta konto eller kund för raden.', variant: 'destructive' });
      return;
    }

    setIsAssigningCard(true);
    const result = await giftcardService.assignExistingCardToCardholder({
      customerId,
      accountId,
      cardNumber,
    });
    setIsAssigningCard(false);

    if (!result.success) {
      toast({ title: 'Fel', description: result.error || 'Kunde inte koppla kortet', variant: 'destructive' });
      return;
    }

    const assignedCardNumber = result.data?.cardNumber || cardNumber;
    toast({ title: 'Kort kopplat', description: `Kort ${assignedCardNumber} kopplades till kortinnehavaren.` });
    setSelectedCardholderForAssignment(null);

    if (lastParams) {
      await doSearch(
        lastParams,
        page,
        sortKey ? { key: sortKey, dir: sortDir } : undefined
      );
    }

    setSelectedCardNumber(assignedCardNumber);
  };

  const handleSort = (key: SortKey) => {
    const params = new URLSearchParams(searchKey);
    const hasSearchState = params.get('showAll') || params.get('firstName') || params.get('lastName') || params.get('email') || params.get('cardNumber');
    if (!hasSearchState) return;
    const nextDir: SortDir = sortKey === key ? (sortDir === 'desc' ? 'asc' : 'desc') : 'desc';
    params.set('sortBy', key);
    params.set('sortDir', nextDir);
    params.set('page', '1');
    if (!params.get('pageSize')) params.set('pageSize', String(pageSize));
    if (!params.get('balance')) params.set('balance', balanceFilter);
    if (!params.get('expiry')) params.set('expiry', expiryFilter);
    if (!params.get('purchaseDate')) params.set('purchaseDate', purchaseDateFilter);
    if (purchaseDateFilter === 'custom') {
      if (!params.get('purchaseDateFrom') && purchaseDateFrom) params.set('purchaseDateFrom', purchaseDateFrom);
      if (!params.get('purchaseDateTo') && purchaseDateTo) params.set('purchaseDateTo', purchaseDateTo);
    }
    setSearchParams(params);
  };

  const updatePage = (nextPage: number) => {
    const params = new URLSearchParams(searchKey);
    const hasSearchState = params.get('showAll') || params.get('firstName') || params.get('lastName') || params.get('email') || params.get('cardNumber');
    if (!hasSearchState) return;
    params.set('page', String(nextPage));
    params.set('pageSize', String(pageSize));
    if (sortKey) params.set('sortBy', sortKey);
    params.set('sortDir', sortDir);
    params.set('balance', balanceFilter);
    params.set('expiry', expiryFilter);
    params.set('purchaseDate', purchaseDateFilter);
    if (purchaseDateFilter === 'custom') {
      if (purchaseDateFrom) params.set('purchaseDateFrom', purchaseDateFrom);
      if (purchaseDateTo) params.set('purchaseDateTo', purchaseDateTo);
    } else {
      params.delete('purchaseDateFrom');
      params.delete('purchaseDateTo');
    }
    setSearchParams(params);
  };

  const getExportRows = (source?: CardholderRow[] | null) => {
    const data = source ?? results;
    if (!data) return [];
    return data.map((row) => ({
      Namn: getCardholderName(row) || '-',
      'E-post': getEmail(row) || '',
      Kortnummer: getCardNo(row) || '',
      Telefon: getPhone(row) || '',
      Saldo: formatBalance(getBalance(row)),
      'Utgångsdatum': formatDate(getExpiry(row)),
      Status: getStatusLabel(row) || '-',
      Inköpsdatum: formatDate(getPurchaseDate(row)),
      'Inköpt på': getPurchaseLocation(row) || '-',
      'Senaste transaktion': (() => {
        const datePart = getLatestTransactionDate(row);
        const typePart = getLatestTransactionType(row);
        if (datePart && typePart) return `${datePart} ${typePart}`;
        return datePart || typePart || '-';
      })(),
      'Säljställe för senaste transaktionen': getLatestTransactionLocation(row) || '-',
    }));
  };

  const fetchAllRowsForExport = async () => {
    if (!lastParams) return results || [];
    if (results && typeof totalCount === 'number' && results.length >= totalCount) {
      return results;
    }

    const exportParams = { ...lastParams };
    const sortParams = sortKey ? { sortBy: sortKey, sortDir } : {};

    const response = await giftcardService.searchCardholders({
      ...exportParams,
      ...sortParams,
      exportAll: true,
      minBalanceOre: exportParams.balance === 'min1kr' ? 100 : undefined,
      expiryFilter: (exportParams.expiry === 'expired' || exportParams.expiry === 'active') ? exportParams.expiry : undefined,
      purchaseDateFilter: (
        exportParams.purchaseDate === 'today'
        || exportParams.purchaseDate === 'thisWeek'
        || exportParams.purchaseDate === 'thisMonth'
        || exportParams.purchaseDate === 'custom'
      ) ? exportParams.purchaseDate : undefined,
      purchaseDateFrom: exportParams.purchaseDateFrom || undefined,
      purchaseDateTo: exportParams.purchaseDateTo || undefined,
    });

    if (!response.success) {
      throw new Error(response.error || 'Sökning misslyckades');
    }

    return response.data?.cardholders || [];
  };

  const exportToExcel = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const allRows = await fetchAllRowsForExport();
      const rows = getExportRows(allRows);
      if (!rows.length) {
        toast({ title: 'Inga rader', description: 'Det finns inget att exportera.' });
        return;
      }
      await downloadXlsx(rows, `kort_och_kortinnehavare_${new Date().toISOString().slice(0, 10)}`);
    } catch (error) {
      toast({ title: 'Fel', description: (error as Error).message || 'Exporten misslyckades', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const exportToPdf = async () => {
    if (isExporting) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: 'Fel',
        description: 'Kunde inte \u00f6ppna PDF-f\u00f6nster. Till\u00e5t popup-f\u00f6nster f\u00f6r localhost.',
        variant: 'destructive',
      });
      return;
    }

    setIsExporting(true);
    try {
      printWindow.document.open();
      printWindow.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>F\u00f6rbereder PDF...</title></head><body style="font-family:Arial,sans-serif;margin:20px">F\u00f6rbereder PDF...</body></html>');
      printWindow.document.close();

      const shouldUseCurrentPageOnly = typeof totalCount === 'number' && totalCount > PDF_EXPORT_MAX_ROWS;
      const sourceRows = shouldUseCurrentPageOnly ? (results || []) : await fetchAllRowsForExport();
      const exportRows = getExportRows(sourceRows);
      if (!exportRows.length) {
        printWindow.close();
        toast({ title: 'Inga rader', description: 'Det finns inget att exportera.' });
        return;
      }

      const rows = exportRows.slice(0, PDF_EXPORT_MAX_ROWS);
      if (shouldUseCurrentPageOnly) {
        toast({
          title: 'PDF begr\u00e4nsad',
          description: 'PDF-exporten inneh\u00e5ller aktuell sida. Anv\u00e4nd Excel f\u00f6r full export.',
        });
      } else if (exportRows.length > PDF_EXPORT_MAX_ROWS) {
        toast({
          title: 'PDF begr\u00e4nsad',
          description: `PDF-exporten begr\u00e4nsades till ${PDF_EXPORT_MAX_ROWS} rader f\u00f6r att undvika timeout.`,
        });
      }

      const headers = Object.keys(rows[0]);
      const escapeHtml = (value: string) => value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Kort och kortinnehavare</title>
        <style>body{font-family:Arial,sans-serif;margin:20px}table{border-collapse:collapse;width:100%}
        th,td{border:1px solid #ccc;padding:6px 10px;text-align:left;font-size:12px;vertical-align:top}
        th{background:#f0f0f0;font-weight:600}h1{font-size:16px;margin-bottom:8px}
        p{font-size:12px;margin:0 0 10px}td{word-break:break-word}</style></head><body>
        <h1>Kort och kortinnehavare \u2013 ${new Date().toLocaleDateString('sv-SE')}</h1>
        <p>Antal rader: ${rows.length}${exportRows.length > rows.length ? ` av ${exportRows.length}` : ''}</p>
        <table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((row) => `<tr>${headers.map((header) => `<td>${escapeHtml(String(row[header as keyof typeof row] || ''))}</td>`).join('')}</tr>`).join('')}</tbody></table>
        <script>
          window.addEventListener('load', function () {
            setTimeout(function () {
              window.focus();
              window.print();
            }, 150);
          });
          window.addEventListener('afterprint', function () {
            window.close();
          });
        </script>
        </body></html>`;

      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (error) {
      printWindow.close();
      toast({ title: 'Fel', description: (error as Error).message || 'Exporten misslyckades', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(searchKey);
    const hasAnyParams = Array.from(params.keys()).length > 0;
    if (!hasAnyParams) {
      const defaults = new URLSearchParams();
      defaults.set('showAll', 'true');
      defaults.set('page', '1');
      defaults.set('pageSize', '25');
      defaults.set('balance', 'all');
      defaults.set('expiry', 'all');
      defaults.set('purchaseDate', 'all');
      defaults.set('sortDir', 'desc');
      setSearchParams(defaults, { replace: true });
    }
  }, [searchKey, setSearchParams]);

  useEffect(() => {
    const params = new URLSearchParams(searchKey);
    const showAll = params.get('showAll') === 'true';
    const firstNameParam = params.get('firstName') || '';
    const lastNameParam = params.get('lastName') || '';
    const emailParam = params.get('email') || '';
    const cardNumberParam = params.get('cardNumber') || '';
    const balanceParam = params.get('balance') === 'min1kr' ? 'min1kr' : 'all';
    const expiryParam = params.get('expiry');
    const normalizedExpiry = (expiryParam === 'expired' || expiryParam === 'active') ? expiryParam : 'all';
    const purchaseDateParam = params.get('purchaseDate');
    const normalizedPurchaseDate = (
      purchaseDateParam === 'today'
      || purchaseDateParam === 'thisWeek'
      || purchaseDateParam === 'thisMonth'
      || purchaseDateParam === 'custom'
    ) ? purchaseDateParam : 'all';
    const purchaseDateFromParam = params.get('purchaseDateFrom') || '';
    const purchaseDateToParam = params.get('purchaseDateTo') || '';
    const pageParam = parseInt(params.get('page') || '1', 10);
    const pageSizeParam = parseInt(params.get('pageSize') || '25', 10);
    const sortParam = normalizeSortKey(params.get('sortBy'));
    const dirParam: SortDir = params.get('sortDir') === 'asc' ? 'asc' : 'desc';
    const normalizedPageSize = [25, 50, 100].includes(pageSizeParam) ? pageSizeParam : 25;

    setSortKey(sortParam);
    setSortDir(dirParam);
    setFirstName(firstNameParam);
    setLastName(lastNameParam);
    setEmail(emailParam);
    setCardNumber(cardNumberParam);
    setBalanceFilter(balanceParam);
    setExpiryFilter(normalizedExpiry);
    setPurchaseDateFilter(normalizedPurchaseDate);
    setPurchaseDateFrom(purchaseDateFromParam);
    setPurchaseDateTo(purchaseDateToParam);
    setPageSize(normalizedPageSize);

    const requestParams: Record<string, string> = {
      balance: balanceParam,
      expiry: normalizedExpiry,
      purchaseDate: normalizedPurchaseDate,
    };
    if (showAll) requestParams.showAll = 'true';
    if (firstNameParam) requestParams.firstName = firstNameParam;
    if (lastNameParam) requestParams.lastName = lastNameParam;
    if (emailParam) requestParams.email = emailParam;
    if (cardNumberParam) requestParams.cardNumber = cardNumberParam;
    if (normalizedPurchaseDate === 'custom') {
      if (purchaseDateFromParam) requestParams.purchaseDateFrom = purchaseDateFromParam;
      if (purchaseDateToParam) requestParams.purchaseDateTo = purchaseDateToParam;
    }

    const hasSearch = showAll || firstNameParam || lastNameParam || emailParam || cardNumberParam;
    if (!hasSearch) {
      setResults(null);
      setTotalCount(null);
      return;
    }

    setLastParams(requestParams);
    doSearch(
      requestParams,
      Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1,
      sortParam ? { key: sortParam, dir: dirParam } : undefined
    );
  }, [doSearch, searchKey]);

  const displayResults = results;
  const totalPages = totalCount ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1;
  const canPage = totalCount !== null && totalCount > pageSize && (displayResults?.length ?? 0) !== totalCount;

  const visibleColumns = useMemo(() => {
    return ([
      ['name', 'Namn', true],
      ['email', 'E-post', columnVisibility.email],
      ['cardNo', 'Kortnummer', true],
      ['phone', 'Telefon', columnVisibility.phone],
      ['balance', 'Saldo', columnVisibility.balance],
      ['expiry', 'Utgångsdatum', columnVisibility.expiry],
      ['status', 'Status', columnVisibility.status],
      ['firstTransactionDate', 'Inköpsdatum', columnVisibility.firstTransactionDate],
      ['firstTransactionRetailstore', 'Inköpt på', columnVisibility.firstTransactionRetailstore],
      ['lastTransactionDate', 'Senaste transaktion', columnVisibility.lastTransactionDate],
      ['lastTransactionRetailstore', 'Säljställe för senaste transaktionen', columnVisibility.lastTransactionRetailstore],
    ] as [SortKey, string, boolean][])
      .filter(([, , isVisible]) => isVisible);
  }, [columnVisibility]);

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Förnamn"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            disabled={isLoading}
          />
          <Input
            placeholder="Efternamn"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            disabled={isLoading}
          />
          <Input
            type="email"
            placeholder="E-postadress"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isLoading}
          />
          <Input
            placeholder="Kortnummer"
            value={cardNumber}
            onChange={(event) => setCardNumber(event.target.value)}
            disabled={isLoading}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={isLoading || !canSearch}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            Sök
          </Button>
          <Button type="button" variant="outline" disabled={isLoading} onClick={handleShowAll}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
            Visa alla
          </Button>
          <Button type="button" variant="outline" disabled={isLoading} onClick={handleClearSearchFields}>
            Rensa sökfälten
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-[140px] space-y-1">
            <Label>Saldo</Label>
            <Select
              value={balanceFilter}
              onValueChange={(value) => setBalanceFilter(value as 'all' | 'min1kr')}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla</SelectItem>
                <SelectItem value="min1kr">Har saldo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-[160px] space-y-1">
            <Label>Utgångsdatum</Label>
            <Select
              value={expiryFilter}
              onValueChange={(value) => setExpiryFilter(value as 'all' | 'expired' | 'active')}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla</SelectItem>
                <SelectItem value="expired">Utgångna</SelectItem>
                <SelectItem value="active">Aktiva</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-[190px] space-y-1">
            <Label>Inköpsdatum</Label>
            <Select
              value={purchaseDateFilter}
              onValueChange={(value) => setPurchaseDateFilter(value as 'all' | 'today' | 'thisWeek' | 'thisMonth' | 'custom')}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla</SelectItem>
                <SelectItem value="today">Idag</SelectItem>
                <SelectItem value="thisWeek">Den här veckan</SelectItem>
                <SelectItem value="thisMonth">Den här månaden</SelectItem>
                <SelectItem value="custom">Egen period</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {purchaseDateFilter === 'custom' && (
            <>
              <div className="w-[150px] space-y-1">
                <Label>Från</Label>
                <DateInput
                  value={purchaseDateFrom}
                  onChange={(event) => setPurchaseDateFrom(event.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="w-[150px] space-y-1">
                <Label>Till</Label>
                <DateInput
                  value={purchaseDateTo}
                  onChange={(event) => setPurchaseDateTo(event.target.value)}
                  disabled={isLoading}
                />
              </div>
            </>
          )}
          <Button type="button" disabled={isLoading} onClick={handleApplyFilters}>
            Applicera filter
          </Button>
          <Button type="button" variant="outline" disabled={isLoading} onClick={handleClearFilters}>
            Rensa filter
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Ändra filter och klicka “Applicera filter” för att uppdatera listan.
        </p>
      </form>

      {displayResults !== null && (
        displayResults.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Inga kort eller kortinnehavare hittades.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <p className="text-sm text-muted-foreground">
                Antal rader: {totalCount ?? displayResults.length}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Visa</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(value) => {
                      const nextSize = parseInt(value, 10);
                      if (Number.isNaN(nextSize) || nextSize === pageSize) return;
                      const params = new URLSearchParams(searchKey);
                      const hasSearchState = params.get('showAll') || params.get('firstName') || params.get('lastName') || params.get('email') || params.get('cardNumber');
                      if (!hasSearchState) return;
                      params.set('page', '1');
                      params.set('pageSize', value);
                      params.set('balance', balanceFilter);
                      params.set('expiry', expiryFilter);
                      params.set('purchaseDate', purchaseDateFilter);
                      if (sortKey) params.set('sortBy', sortKey);
                      params.set('sortDir', sortDir);
                      if (purchaseDateFilter === 'custom') {
                        if (purchaseDateFrom) params.set('purchaseDateFrom', purchaseDateFrom);
                        if (purchaseDateTo) params.set('purchaseDateTo', purchaseDateTo);
                      } else {
                        params.delete('purchaseDateFrom');
                        params.delete('purchaseDateTo');
                      }
                      setSearchParams(params);
                    }}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="h-8 w-[84px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                  <span>rader</span>
                </div>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="sm" onClick={exportToExcel} title="Exportera till Excel (XLSX)" disabled={isExporting}>
                    <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={exportToPdf} title="Exportera till PDF" disabled={isExporting}>
                    <FileText className="mr-1 h-4 w-4" /> PDF
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 border-b px-3 py-2">
              {COLUMN_OPTIONS.map((column) => (
                <label key={column.key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={columnVisibility[column.key]}
                    onCheckedChange={(checked) =>
                      setColumnVisibility((previous) => ({ ...previous, [column.key]: Boolean(checked) }))
                    }
                  />
                  {column.label}
                </label>
              ))}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {visibleColumns.map(([key, label]) => (
                    <th
                      key={key}
                      className="p-3 text-left font-medium"
                    >
                      <SortableTableHeaderButton
                        label={label}
                        active={sortKey === key}
                        direction={sortDir}
                        onClick={() => handleSort(key)}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayResults.map((row, index) => {
                  const name = getCardholderName(row);
                  const emailValue = getEmail(row);
                  const cardNo = getCardNo(row);
                  const phone = getPhone(row);
                  const balance = formatBalance(getBalance(row));
                  const expiry = formatDate(getExpiry(row));
                  const statusKey = getStatusKey(row);
                  const statusLabel = getStatusLabel(row) || '-';
                  const purchaseDate = formatDate(getPurchaseDate(row));
                  const purchaseLocation = getPurchaseLocation(row);
                  const latestTxDate = getLatestTransactionDate(row);
                  const latestTxType = getLatestTransactionType(row);
                  const latestTxLocation = getLatestTransactionLocation(row);
                  const accountId = row['__accountId'] || '';
                  const customerId = row['__customerId'] || '';
                  const canAssignCard = Boolean(!cardNo && accountId && customerId);
                  const isClickable = Boolean(cardNo || canAssignCard);

                  return (
                    <tr
                      key={index}
                      className={`border-b bg-background/40 last:border-0 even:bg-muted/20 hover:bg-accent/80 hover:shadow-[inset_0_0_0_1px_hsl(var(--ring)/0.18)] ${isClickable ? 'cursor-pointer' : ''}`}
                      title={canAssignCard ? 'Klicka för att koppla kort' : undefined}
                      onClick={() => {
                        if (cardNo) {
                          setSelectedCardNumber(cardNo);
                          return;
                        }
                        if (canAssignCard) {
                          handleAssignCardClick(row);
                        }
                      }}
                    >
                      <td className="p-3">{name || '-'}</td>
                      {columnVisibility.email && (
                        <td className="p-3 text-muted-foreground">{emailValue || '-'}</td>
                      )}
                      <td className="p-3 font-mono font-semibold text-foreground">{cardNo || '-'}</td>
                      {columnVisibility.phone && (
                        <td className="p-3 text-muted-foreground">{phone || '-'}</td>
                      )}
                      {columnVisibility.balance && (
                        <td className="p-3">{balance}</td>
                      )}
                      {columnVisibility.expiry && (
                        <td className="p-3">{expiry}</td>
                      )}
                      {columnVisibility.status && (
                        <td className="p-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${getStatusClasses(statusKey)}`}>
                            {statusLabel}
                          </span>
                        </td>
                      )}
                      {columnVisibility.firstTransactionDate && (
                        <td className="p-3">{purchaseDate}</td>
                      )}
                      {columnVisibility.firstTransactionRetailstore && (
                        <td className="p-3 text-muted-foreground">{purchaseLocation || '-'}</td>
                      )}
                      {columnVisibility.lastTransactionDate && (
                        <td className="p-3">
                          {latestTxDate || latestTxType ? (
                            <span className="inline-flex flex-wrap items-center gap-1">
                              {latestTxDate && <span>{latestTxDate}</span>}
                              {latestTxType && <span className="font-semibold">{latestTxType}</span>}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                      )}
                      {columnVisibility.lastTransactionRetailstore && (
                        <td className="p-3 text-muted-foreground">{latestTxLocation || '-'}</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {canPage && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            Sida {page} av {totalPages}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={isLoading || page <= 1} onClick={() => updatePage(1)}>
              Första
            </Button>
            <Button type="button" variant="outline" disabled={isLoading || page <= 1} onClick={() => updatePage(Math.max(1, page - 10))}>
              -10
            </Button>
            <Button type="button" variant="outline" disabled={isLoading || page <= 1} onClick={() => updatePage(Math.max(1, page - 1))}>
              Föregående
            </Button>
            <Button type="button" variant="outline" disabled={isLoading || page >= totalPages} onClick={() => updatePage(Math.min(totalPages, page + 1))}>
              Nästa
            </Button>
            <Button type="button" variant="outline" disabled={isLoading || page >= totalPages} onClick={() => updatePage(Math.min(totalPages, page + 10))}>
              +10
            </Button>
            <Button type="button" variant="outline" disabled={isLoading || page >= totalPages} onClick={() => updatePage(totalPages)}>
              Sista
            </Button>
          </div>
        </div>
      )}

      <GiftCardDetailsDialog
        cardNumber={selectedCardNumber}
        open={Boolean(selectedCardNumber)}
        onOpenChange={(open) => {
          if (!open) setSelectedCardNumber(null);
        }}
      />
      <AssignExistingCardDialog
        open={Boolean(selectedCardholderForAssignment)}
        onOpenChange={(open) => {
          if (!open) setSelectedCardholderForAssignment(null);
        }}
        onAssign={handleAssignExistingCard}
        isLoading={isAssigningCard}
        customerName={selectedCardholderForAssignment ? getCardholderName(selectedCardholderForAssignment) : ''}
        accountId={selectedCardholderForAssignment?.['__accountId'] || ''}
      />
    </div>
  );
}
