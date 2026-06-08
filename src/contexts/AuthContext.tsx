import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthUser, LoginCredentials, CustomerOption, SupportOption } from '@/types/giftcard';
import { authService } from '@/services/authService';

interface LoginResult {
  success: boolean;
  error?: string;
  needsSupportSelection?: boolean;
  supportOptions?: SupportOption[];
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  needsCustomerSelection: boolean;
  login: (credentials: LoginCredentials) => Promise<LoginResult>;
  logout: () => Promise<void>;
  selectCustomer: (customerId: string, customerLabel?: string) => Promise<{ success: boolean; error?: string }>;
  getCustomers: () => Promise<CustomerOption[]>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const sessionUser = await authService.verifySession();
        if (sessionUser) {
          setUser(sessionUser);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (credentials: LoginCredentials): Promise<LoginResult> => {
    try {
      setIsLoading(true);
      const result = await authService.login(credentials);

      if (result.needsSupportSelection) {
        return {
          success: false,
          needsSupportSelection: true,
          supportOptions: result.supportOptions || [],
        };
      }

      if (result.success && result.data) {
        setUser(result.data);
        return { success: true };
      }

      return { success: false, error: result.error || 'Inloggning misslyckades' };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Ett fel uppstod vid inloggning' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
    }
  };

  const selectCustomer = async (customerId: string, customerLabel?: string) => {
    try {
      const result = await authService.selectCustomer(customerId, customerLabel);
      if (result.success) {
        setUser((prev) =>
          prev
            ? {
              ...prev,
              needsCustomer: false,
              selectedCustomerId: customerId,
              selectedCustomerLabel: result.data?.selectedCustomerLabel || customerLabel || prev.selectedCustomerLabel,
            }
            : prev
        );
        return { success: true };
      }
      return { success: false, error: result.error };
    } catch (error) {
      console.error('Select customer error:', error);
      return { success: false, error: 'Ett fel uppstod vid kundval' };
    }
  };

  const getCustomers = async (): Promise<CustomerOption[]> => {
    const result = await authService.getCustomers();
    return result.data || [];
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        needsCustomerSelection: !!user?.needsCustomer,
        login,
        logout,
        selectCustomer,
        getCustomers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
