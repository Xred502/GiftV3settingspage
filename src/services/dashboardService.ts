import { apiFetch } from './api';

export interface DashboardLatestSale {
  id: string;
  orderId: string;
  giftCardId: string;
  cardNumber?: string;
  createdAtUtc?: string;
  recipientName?: string;
  recipientEmail?: string;
  senderName?: string;
  amount: number;
  deliveryStatus?: string;
  scheduledDeliveryUtc?: string;
  deliveredAtUtc?: string;
  companyName?: string;
  message?: string;
}

export interface DashboardResendOptions {
  sendToOriginal?: boolean;
  manualEmail?: string;
}

export type DashboardPeriod =
  | 'last_7_days'
  | 'last_calendar_week'
  | 'last_calendar_month'
  | 'last_365_days'
  | 'last_calendar_year'
  | 'custom';
export type DashboardComparisonMode = 'previous_week' | 'previous_month' | 'same_period_last_year' | 'custom';

export interface DashboardOverviewParams {
  period?: DashboardPeriod;
  comparison?: DashboardComparisonMode;
  multiples?: number;
  latestSalesLimit?: number;
  currentFrom?: string;
  currentTo?: string;
  compareFrom?: string;
  compareTo?: string;
}

export interface DashboardComparisonSeriesItem {
  key: string;
  label: string;
  shortLabel: string;
  from: string;
  to: string;
  depositsAmount: number;
  depositsCount: number;
  purchasesAmount: number;
  purchasesCount: number;
}

export interface DashboardOverview {
  latestSales: DashboardLatestSale[];
  stats: {
    deposits: { current: number; previous: number; total: number; countCurrent: number; countPrevious: number };
    purchases: { current: number; previous: number; countCurrent: number; countPrevious: number };
    expired: { total: number };
    comparison: {
      mode: DashboardComparisonMode;
      multiples: number;
      series: DashboardComparisonSeriesItem[];
    };
    dateRange: {
      currentFrom: string;
      currentTo: string;
      previousFrom: string;
      previousTo: string;
    };
  };
}

async function parseApiError(response: Response, fallback: string) {
  const errorData = await response.json().catch(() => ({}));
  return errorData.error || fallback;
}

export const dashboardService = {
  async getOverview(options: DashboardOverviewParams = {}): Promise<{ success: boolean; data?: DashboardOverview; error?: string }> {
    try {
      const params = new URLSearchParams();
      if (options.period) params.set('period', options.period);
      if (options.comparison) params.set('comparison', options.comparison);
      if (Number.isFinite(options.multiples)) params.set('multiples', String(options.multiples));
      if (Number.isFinite(options.latestSalesLimit)) params.set('latestSalesLimit', String(options.latestSalesLimit));
      if (options.currentFrom) params.set('currentFrom', options.currentFrom);
      if (options.currentTo) params.set('currentTo', options.currentTo);
      if (options.compareFrom) params.set('compareFrom', options.compareFrom);
      if (options.compareTo) params.set('compareTo', options.compareTo);
      const query = params.toString();
      const response = await apiFetch(`/dashboard${query ? `?${query}` : ''}`, { method: 'GET' });
      if (!response.ok) {
        return { success: false, error: await parseApiError(response, 'Kunde inte hämta översikten') };
      }
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('Dashboard overview failed:', error);
      return { success: false, error: 'Ett fel uppstod vid hämtning av översikten' };
    }
  },

  async resendGiftCard(
    orderId: string,
    giftCardId: string,
    options: DashboardResendOptions = {}
  ): Promise<{ success: boolean; error?: string; sentTo?: string[]; count?: number }> {
    try {
      const response = await apiFetch(
        `/dashboard/orders/${encodeURIComponent(orderId)}/gift-cards/${encodeURIComponent(giftCardId)}/resend`,
        { method: 'POST', body: JSON.stringify(options) }
      );
      if (!response.ok) {
        return { success: false, error: await parseApiError(response, 'Kunde inte skicka om presentkortet') };
      }
      const data = await response.json().catch(() => ({}));
      return { success: true, sentTo: data?.sentTo || [], count: data?.count };
    } catch (error) {
      console.error('Dashboard resend failed:', error);
      return { success: false, error: 'Ett fel uppstod vid omskick av presentkort' };
    }
  },

  async cancelGiftCard(orderId: string, giftCardId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await apiFetch(
        `/dashboard/orders/${encodeURIComponent(orderId)}/gift-cards/${encodeURIComponent(giftCardId)}/cancel`,
        { method: 'POST' }
      );
      if (!response.ok) {
        return { success: false, error: await parseApiError(response, 'Kunde inte avbryta presentkortet') };
      }
      return { success: true };
    } catch (error) {
      console.error('Dashboard cancel failed:', error);
      return { success: false, error: 'Ett fel uppstod vid avbryt av presentkort' };
    }
  },
};
