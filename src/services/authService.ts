import { AuthUser, LoginCredentials, ApiResponse, CustomerOption, SupportOption } from '@/types/giftcard';
import { apiFetch } from '@/services/api';

export const authService = {
  async login(credentials: LoginCredentials): Promise<ApiResponse<AuthUser> & { needsSupportSelection?: boolean; supportOptions?: SupportOption[] }> {
    try {
      const response = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: credentials.username,
          password: credentials.password,
          supportId: credentials.supportId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error || 'Felaktiga inloggningsuppgifter',
        };
      }

      const data = await response.json();

      if (data?.needsSupportSelection) {
        return {
          success: false,
          needsSupportSelection: true,
          supportOptions: data.supportOptions || [],
          error: data.error,
        };
      }

      return {
        success: true,
        data: {
          username: credentials.username,
          role: data.role || 'Kundsupport',
          needsCustomer: data.needsCustomer ?? false,
          selectedCustomerId: data.selectedCustomerId || undefined,
        },
      };
    } catch (error) {
      console.error('Login request failed:', error);
      return {
        success: false,
        error: 'Kunde inte ansluta till servern',
      };
    }
  },

  async logout(): Promise<void> {
    try {
      await apiFetch('/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    }
  },

  async verifySession(): Promise<AuthUser | null> {
    try {
      const response = await apiFetch('/auth/me', {
        method: 'GET',
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return {
        username: data.username || 'user',
        role: data.role || 'Kundsupport',
        needsCustomer: data.needsCustomer ?? !data.selectedCustomerId,
        selectedCustomerId: data.selectedCustomerId,
        selectedCustomerLabel: data.selectedCustomerLabel,
      };
    } catch (error) {
      console.error('Session verification failed:', error);
      return null;
    }
  },

  async getCustomers(): Promise<ApiResponse<CustomerOption[]>> {
    try {
      const response = await apiFetch('/customers', {
        method: 'GET',
      });

      if (!response.ok) {
        return { success: false, error: 'Kunde inte hämta kundlistan' };
      }

      const data = await response.json();
      return { success: true, data: data.customers || [] };
    } catch (error) {
      console.error('Get customers failed:', error);
      return { success: false, error: 'Ett fel uppstod vid hämtning av kunder' };
    }
  },

  async selectCustomer(customerId: string, customerLabel?: string): Promise<ApiResponse<{ selectedCustomerLabel?: string }>> {
    try {
      const response = await apiFetch('/customers/select', {
        method: 'POST',
        body: JSON.stringify({ customerId, customerLabel }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.error || 'Kunde inte välja kund' };
      }

      const data = await response.json().catch(() => ({}));
      return { success: true, data: { selectedCustomerLabel: data.selectedCustomerLabel } };
    } catch (error) {
      console.error('Select customer failed:', error);
      return { success: false, error: 'Ett fel uppstod vid kundval' };
    }
  },
};
