
import { GiftCard, GiftCardDetails, GiftCardTransaction, ApiResponse, RetailstoreOption } from '@/types/giftcard';
import { apiFetch } from './api';

const TERMINAL_ID = 'd0091f52-5fc8-40e0-b8fe-0cc898478e71';

function mps2Path(path: string): string {
  if (path.startsWith('/')) return `/mps2${path}`;
  return `/mps2/${path}`;
}

// Helper to convert öre to kronor for display
export function oreToKronor(ore: number): number {
  return ore / 100;
}

// Helper to format currency in SEK
export function formatCurrency(ore: number): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
  }).format(oreToKronor(ore));
}

function getTransactionTime(value?: string): number {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? 0 : date.valueOf();
}

function getTransactionKeys(tx: GiftCardTransaction): string[] {
  const keys: string[] = [];
  if (tx.receiptGuid) keys.push(`guid:${tx.receiptGuid}`);
  if (tx.receiptId) keys.push(`receipt:${tx.receiptId}`);
  if (tx.id) keys.push(`id:${tx.id}`);
  keys.push(`fallback:${tx.date || ''}|${tx.amount ?? ''}|${tx.type || ''}|${tx.description || ''}`);
  return keys;
}

function mergeTransaction(base: GiftCardTransaction, incoming: GiftCardTransaction): GiftCardTransaction {
  return {
    ...base,
    ...incoming,
    id: base.id || incoming.id,
    accountId: base.accountId || incoming.accountId,
    amount: base.amount ?? incoming.amount,
    type: base.type || incoming.type,
    description: base.description || incoming.description,
    date: base.date || incoming.date,
    workstationId: base.workstationId || incoming.workstationId,
    receiptGuid: base.receiptGuid || incoming.receiptGuid,
    receiptId: base.receiptId || incoming.receiptId,
  };
}

function mergeTransactions(primary: GiftCardTransaction[], secondary: GiftCardTransaction[]): GiftCardTransaction[] {
  const merged: GiftCardTransaction[] = [];
  const keyToIndex = new Map<string, number>();

  const add = (tx: GiftCardTransaction) => {
    const keys = getTransactionKeys(tx);
    let existingIndex: number | undefined;
    for (const key of keys) {
      const idx = keyToIndex.get(key);
      if (idx !== undefined) {
        existingIndex = idx;
        break;
      }
    }
    if (existingIndex === undefined) {
      const idx = merged.length;
      merged.push(tx);
      for (const key of keys) {
        keyToIndex.set(key, idx);
      }
      return;
    }

    merged[existingIndex] = mergeTransaction(merged[existingIndex], tx);
    for (const key of keys) {
      keyToIndex.set(key, existingIndex);
    }
  };

  (primary || []).forEach(add);
  (secondary || []).forEach(add);

  return merged.sort((a, b) => getTransactionTime(b.date) - getTransactionTime(a.date));
}

export const giftcardService = {
  async searchGiftCards(query: string, sortBy?: string, sortDir?: 'asc' | 'desc'): Promise<ApiResponse<GiftCard[]>> {
    try {
      const response = await apiFetch('/giftcards', {
        method: 'POST',
        body: JSON.stringify({ query, page: 1, pageSize: 100, sortBy, sortDir }),
      });

      if (!response.ok) {
        return { success: false, error: 'Kunde inte hämta presentkort' };
      }

      const data = await response.json();
      if (data.success === false) {
        return { success: false, error: data.error || 'Presentkort hittades inte' };
      }

      return { success: true, data: data.giftcards || [] };
    } catch (error) {
      console.error('Search giftcards failed:', error);
      return { success: false, error: 'Ett fel uppstod vid sökning' };
    }
  },

  async getGiftCardDetails(cardId: string): Promise<ApiResponse<GiftCardDetails>> {
    try {
      // Get card info via Identifier/History endpoint (required before mutations)
      const response = await apiFetch(
        mps2Path(`/Identifier/History?identifier=${encodeURIComponent(cardId)}&terminalId=${TERMINAL_ID}`),
        { method: 'GET' }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.Success && data.Data) {
          const d = data.Data;
          const transactions: GiftCardTransaction[] = (d.transactions || []).map((tx: any) => ({
            id: String(tx.id),
            accountId: String(tx.account?.id || d.id),
            amount: tx.amount || 0,
            type: tx.type,
            description: tx.title || '',
            date: tx.startdate,
            workstationId: tx.workstation?.id ? String(tx.workstation.id) : undefined,
            receiptGuid: tx.guid || tx.receiptGuid || undefined,
            receiptId: tx.receipt?.id ? String(tx.receipt.id) : undefined,
          }));

          const isBlocked = d.identifier?.blocked === true;
          const isExpired = d.identifier?.expires && new Date(d.identifier.expires) < new Date();
          const giftCardDetails: GiftCardDetails = {
            id: String(d.id),
            cardNumber: d.identifier?.value || cardId,
            accountId: String(d.id),
            balance: d.balance || 0,
            status: isBlocked ? 'blocked' : isExpired ? 'expired' : 'active',
            expiresAt: d.identifier?.expires,
            createdAt: d.transactions?.[0]?.startdate,
            transactions,
            customer: d.owner ? {
              id: d.owner.userid,
              firstName: d.owner.firstname,
              lastName: d.owner.lastname,
              email: d.owner.email,
            } : undefined,
          };

          let mergedDetails = giftCardDetails;
          try {
            const dbResp = await apiFetch('/giftcards/details', {
              method: 'POST',
              body: JSON.stringify({ cardNumber: cardId }),
            });
            if (dbResp.ok) {
              const dbData = await dbResp.json();
              const dbDetails: GiftCardDetails | undefined = dbData?.data;
              if (dbDetails) {
                const mergedStatus = dbDetails.status === 'blocked'
                  ? 'blocked'
                  : giftCardDetails.status;
                const mergedCustomer = dbDetails.customer || giftCardDetails.customer
                  ? {
                    id: dbDetails.customer?.id || giftCardDetails.customer?.id || '',
                    firstName: giftCardDetails.customer?.firstName || dbDetails.customer?.firstName || '',
                    lastName: giftCardDetails.customer?.lastName || dbDetails.customer?.lastName || '',
                    email: giftCardDetails.customer?.email || dbDetails.customer?.email || '',
                    street: dbDetails.customer?.street || giftCardDetails.customer?.street,
                    city: dbDetails.customer?.city || giftCardDetails.customer?.city,
                    postalcode: dbDetails.customer?.postalcode || giftCardDetails.customer?.postalcode,
                    country: dbDetails.customer?.country || giftCardDetails.customer?.country,
                    company: dbDetails.customer?.company || giftCardDetails.customer?.company,
                    phone1: dbDetails.customer?.phone1 || giftCardDetails.customer?.phone1,
                    phone2: dbDetails.customer?.phone2 || giftCardDetails.customer?.phone2,
                  }
                  : undefined;
                mergedDetails = {
                  ...giftCardDetails,
                  accountId: dbDetails.accountId || giftCardDetails.accountId,
                  cardNumber: giftCardDetails.cardNumber || dbDetails.cardNumber,
                  balance: (dbDetails.balance ?? giftCardDetails.balance),
                  expiresAt: dbDetails.expiresAt || giftCardDetails.expiresAt,
                  createdAt: giftCardDetails.createdAt || dbDetails.createdAt,
                  status: mergedStatus,
                  customer: mergedCustomer,
                  transactions: mergeTransactions(dbDetails.transactions || [], transactions),
                };
              }
            }
          } catch (error) {
            console.warn('Could not merge DB transactions:', error);
          }

          return { success: true, data: mergedDetails };
        }
      }

      // Fallback to DB details if MPS2 cannot resolve the identifier
      const dbResp = await apiFetch('/giftcards/details', {
        method: 'POST',
        body: JSON.stringify({ cardNumber: cardId }),
      });
      if (!dbResp.ok) {
        const errorData = await dbResp.json().catch(() => ({}));
        return { success: false, error: errorData.error || 'Kunde inte hämta kortinformation' };
      }
      const dbData = await dbResp.json();
      return { success: true, data: dbData.data };
    } catch (error) {
      console.error('Get giftcard details failed:', error);
      return { success: false, error: 'Ett fel uppstod vid hämtning av kortinformation' };
    }
  },
  async deposit(cardId: string, amountInOre: number, terminalId: string, operatorId?: string, accountId?: string): Promise<ApiResponse<{ newBalance: number }>> {
    try {
      const guid = crypto.randomUUID();

      const response = await apiFetch(
        mps2Path('/Transaction/Deposit'),
        {
          method: 'POST',
          body: JSON.stringify({
            Identifier: cardId,
            AccountId: accountId || undefined,
            TerminalId: terminalId,
            OperatorId: operatorId || 'Backoffice',
            Amount: amountInOre,
            Vat: 0,
            Guid: guid,
            DateTime: new Date().toISOString(),
            ReferenceNumber: '',
            Receipt: '',
            ExternalId: guid,
            IsOffline: false,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.error || errorData.message || 'Transaktionen misslyckades' };
      }

      const data = await response.json();
      const newBalance = data?.newBalance ?? data?.balance ?? data?.Data?.balance;
      return { success: true, data: { newBalance } };
    } catch (error) {
      console.error('Deposit failed:', error);
      return { success: false, error: 'Ett fel uppstod vid transaktionen' };
    }
  },

  async blockCard(cardId: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiFetch(
        '/card/block',
        {
          method: 'POST',
          body: JSON.stringify({ cardNumber: cardId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.error || errorData.message || 'Kunde inte spärra kortet' };
      }

      return { success: true };
    } catch (error) {
      console.error('Block card failed:', error);
      return { success: false, error: 'Ett fel uppstod vid spärrning' };
    }
  },

  async unblockCard(cardId: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiFetch(
        '/card/unblock',
        {
          method: 'POST',
          body: JSON.stringify({ cardNumber: cardId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.error || errorData.message || 'Kunde inte häva spärren' };
      }

      return { success: true };
    } catch (error) {
      console.error('Unblock card failed:', error);
      return { success: false, error: 'Ett fel uppstod vid hävning av spärr' };
    }
  },

  async updateExpiry(cardNumber: string, newExpiryDate: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiFetch(
        '/card/update-expiry',
        {
          method: 'POST',
          body: JSON.stringify({ cardNumber, newExpiryDate }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.error || 'Kunde inte uppdatera utgångsdatum' };
      }

      const data = await response.json();
      if (data.success === false) {
        return { success: false, error: data.error || 'Kunde inte uppdatera utgångsdatum' };
      }

      return { success: true };
    } catch (error) {
      console.error('Update expiry failed:', error);
      return { success: false, error: 'Ett fel uppstod vid uppdatering av utgångsdatum' };
    }
  },
  async searchCardholders(params: {
    firstName?: string;
    lastName?: string;
    cardNumber?: string;
    email?: string;
    cardAccount?: string;
    minBalanceOre?: number;
    expiryFilter?: 'all' | 'expired' | 'active';
    purchaseDateFilter?: 'all' | 'today' | 'thisWeek' | 'thisMonth' | 'custom';
    purchaseDateFrom?: string;
    purchaseDateTo?: string;
    exportAll?: boolean;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
  }): Promise<ApiResponse<{ cardholders: Array<Record<string, string>>; totalCount?: number; page?: number; pageSize?: number }>> {
    try {
      const response = await apiFetch(
        '/cardholder/search',
        {
          method: 'POST',
          body: JSON.stringify(params),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.error || 'Kunde inte söka kortinnehavare' };
      }

      const data = await response.json();
      if (data.success === false) {
        return { success: false, error: data.error || 'Sökning misslyckades' };
      }

      return {
        success: true,
        data: {
          cardholders: data.cardholders || [],
          totalCount: data.totalCount,
          page: data.page,
          pageSize: data.pageSize,
        },
      };
    } catch (error) {
      console.error('Cardholder search failed:', error);
      return { success: false, error: 'Ett fel uppstod vid sökning av kortinnehavare' };
    }
  },

  async assignExistingCardToCardholder(params: {
    customerId: string;
    accountId: string;
    cardNumber: string;
  }): Promise<ApiResponse<{ cardNumber: string; accountId: string; customerId: string }>> {
    try {
      const response = await apiFetch('/cardholder/assign-card', {
        method: 'POST',
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.error || 'Kunde inte koppla kortet' };
      }

      const data = await response.json();
      if (data.success === false) {
        return { success: false, error: data.error || 'Kunde inte koppla kortet' };
      }

      return {
        success: true,
        data: {
          cardNumber: data.cardNumber || params.cardNumber,
          accountId: data.accountId || params.accountId,
          customerId: data.customerId || params.customerId,
        },
      };
    } catch (error) {
      console.error('Assign existing card failed:', error);
      return { success: false, error: 'Ett fel uppstod vid koppling av kortet' };
    }
  },

  async getRetailstores(accountId: string): Promise<ApiResponse<RetailstoreOption[]>> {
    try {
      const response = await apiFetch(`/giftcards/retailstores?accountId=${encodeURIComponent(accountId)}`, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.error || 'Kunde inte hämta butiker' };
      }

      const data = await response.json();
      return { success: true, data: data.retailstores || [] };
    } catch (error) {
      console.error('Get retailstores failed:', error);
      return { success: false, error: 'Ett fel uppstod vid hämtning av butiker' };
    }
  },

  async listAllGiftCards(params?: { page?: number; pageSize?: number; minBalanceOre?: number; expiryFilter?: 'all' | 'expired' | 'active'; sortBy?: string; sortDir?: 'asc' | 'desc'; query?: string }): Promise<ApiResponse<{ giftcards: GiftCard[]; totalCount?: number; page?: number; pageSize?: number }>> {
    try {
      const response = await apiFetch(
        '/giftcards',
        {
          method: 'POST',
          body: JSON.stringify({
            showAll: true,
            query: params?.query,
            page: params?.page,
            pageSize: params?.pageSize,
            minBalanceOre: params?.minBalanceOre,
            expiryFilter: params?.expiryFilter,
            sortBy: params?.sortBy,
            sortDir: params?.sortDir,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.error || 'Kunde inte hämta presentkort' };
      }

      const data = await response.json();
      if (data.success === false) {
        return { success: false, error: data.error || 'Kunde inte hämta presentkort' };
      }
      return {
        success: true,
        data: {
          giftcards: data.giftcards || [],
          totalCount: data.totalCount,
          page: data.page,
          pageSize: data.pageSize,
        },
      };
    } catch (error) {
      console.error('List all giftcards failed:', error);
      return { success: false, error: 'Ett fel uppstod vid hämtning av presentkort' };
    }
  },
};
