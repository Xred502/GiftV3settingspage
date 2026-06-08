import { apiFetch } from './api';
import { downloadXlsx } from './exportService';

export interface FilterOption {
  value: string;
  label: string;
}

export interface ReportFilters {
  dateRegions: FilterOption[];
  transactionTypes: FilterOption[];
  retailstores: FilterOption[];
  presentcardAccounts: FilterOption[];
  balanceRetailstores?: FilterOption[];
}

export interface TransactionReportRow {
  [key: string]: string;
}

export interface TransactionReportResult {
  success: boolean;
  transactions?: TransactionReportRow[];
  filterOptions?: ReportFilters;
  totalCount?: number;
  error?: string;
}

export interface BalanceReportRow {
  cardNumber: string;
  balance: number;
  expires?: string;
  accountName?: string;
  accountId?: string;
  lastTransactionDate?: string;
  lastTransactionTitle?: string;
}

export interface BalanceReportResult {
  success: boolean;
  rows?: BalanceReportRow[];
  totalBalance?: number;
  totalCount?: number;
  page?: number;
  pageSize?: number;
  error?: string;
}

export interface BalanceByRetailstoreRow {
  retailstoreName: string;
  balance: number;
  transactionTitle?: string;
  lastTransactionDate?: string;
  lastTransactionTitle?: string;
}

export interface BalanceByRetailstoreReportResult {
  success: boolean;
  rows?: BalanceByRetailstoreRow[];
  totalBalance?: number;
  totalCount?: number;
  error?: string;
}

export const reportService = {
  async getFilters(): Promise<{ success: boolean; filterOptions?: ReportFilters; error?: string }> {
    try {
      const response = await apiFetch('/report/filters', {
        method: 'GET',
      });

      if (!response.ok) {
        return { success: false, error: 'Kunde inte h\u00e4mta filteralternativ' };
      }

      const data = await response.json();
      return { success: true, filterOptions: data.filterOptions };
    } catch (error) {
      console.error('Get report filters failed:', error);
      return { success: false, error: 'Ett fel uppstod vid h\u00e4mtning av filter' };
    }
  },

  async generateReport(filters: {
    dateRegion?: FilterOption;
    transactionType?: FilterOption;
    transactionTypes?: FilterOption[];
    retailstoreId?: string;
    presentcardAccount?: string;
  }): Promise<TransactionReportResult> {
    try {
      const response = await apiFetch('/report/transactions', {
        method: 'POST',
        body: JSON.stringify(filters),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.error || 'Kunde inte generera rapport' };
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Generate report failed:', error);
      return { success: false, error: 'Ett fel uppstod vid generering av rapport' };
    }
  },

  async generateBalanceReport(filters: {
    asOfDate?: string;
    expiryStatus?: 'all' | 'expired' | 'active';
    viewMode?: 'summary' | 'per-card';
    includeZeroBalance?: boolean;
    includeLatestTransaction?: boolean;
    presentcardAccount?: string;
    page?: number;
    pageSize?: number;
  }): Promise<BalanceReportResult> {
    try {
      const response = await apiFetch('/report/balances', {
        method: 'POST',
        body: JSON.stringify(filters),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.error || 'Kunde inte hämta saldo-rapport' };
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Generate balance report failed:', error);
      return { success: false, error: 'Ett fel uppstod vid hämtning av saldo-rapport' };
    }
  },

  async generateBalanceByRetailstoreReport(filters: {
    asOfDate?: string;
    presentcardAccounts?: string[];
    retailstores?: string[];
    transactionTitles?: string[];
  }): Promise<BalanceByRetailstoreReportResult> {
    try {
      const response = await apiFetch('/report/balances-by-retailstore', {
        method: 'POST',
        body: JSON.stringify(filters),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.error || 'Kunde inte hämta saldo-rapport per säljställe' };
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Generate balance by retailstore report failed:', error);
      return { success: false, error: 'Ett fel uppstod vid hämtning av saldo-rapport per säljställe' };
    }
  },

  async getReceiptGuid(transactionId: string, dateRegion?: FilterOption): Promise<{ success: boolean; guid?: string; error?: string }> {
    try {
      const response = await apiFetch('/report/receipt-guid', {
        method: 'POST',
        body: JSON.stringify({ transactionId, dateRegion }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.error || 'Kunde inte h\u00e4mta kvitto' };
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Get receipt GUID failed:', error);
      return { success: false, error: 'Ett fel uppstod vid h\u00e4mtning av kvitto' };
    }
  },
};

export function exportToXlsx(rows: TransactionReportRow[], filename: string = 'transaktionsrapport.xlsx'): Promise<void> {
  if (rows.length === 0) return Promise.resolve();
  const headers = Object.keys(rows[0]).filter(h => !h.startsWith('__'));
  return downloadXlsx(rows as Array<Record<string, string>>, filename, headers, 'Transaktionsrapport');
}


