export interface GiftCard {
  id: string;
  cardNumber: string;
  accountId: string;
  balance: number; // in öre
  status: 'active' | 'blocked' | 'expired';
  expiresAt: string;
  createdAt: string;
  firstTransactionDate?: string;
  lastTransactionDate?: string;
  lastTransactionType?: string;
  lastTransactionTitle?: string;
}

export interface GiftCardTransaction {
  id: string;
  accountId: string;
  amount: number; // in öre
  type: string;
  description: string;
  date: string;
  workstationId?: string;
  receiptGuid?: string;
  receiptId?: string;
}

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  street?: string;
  city?: string;
  postalcode?: string;
  country?: string;
  company?: string;
  phone1?: string;
  phone2?: string;
}

export interface GiftCardDetails extends GiftCard {
  transactions: GiftCardTransaction[];
  customer?: Customer;
}

export interface WorkstationOption {
  id: string;
  name: string;
  terminalId: string;
  isDefault?: boolean;
}

export interface RetailstoreOption {
  id: string;
  name: string;
  workstations: WorkstationOption[];
  defaultWorkstationId?: string;
  defaultTerminalId?: string;
}

export interface AuthUser {
  username: string;
  role: string;
  needsCustomer: boolean;
  selectedCustomerId?: string;
  selectedCustomerLabel?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
  supportId?: string;
}

export interface SupportOption {
  value: string;
  label: string;
}

export interface CustomerOption {
  value: string;
  label: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
