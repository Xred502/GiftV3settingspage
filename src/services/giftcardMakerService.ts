import { apiFetch } from './api';

export interface GiftcardMakerCompany {
  companyId: string;
  companyName?: string;
}

export interface GiftcardMakerSessionResult {
  success: boolean;
  companies?: GiftcardMakerCompany[];
  companyIds?: string[];
  terminalIds?: string[];
  operatorIds?: string[];
  error?: string;
}

export const giftcardMakerService = {
  async initSession(): Promise<GiftcardMakerSessionResult> {
    try {
      const response = await apiFetch('/giftcard-maker/session', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.error || 'Kunde inte initiera presentkortsskaparen' };
      }

      const data = await response.json();
      return {
        success: true,
        companies: data.companies || [],
        companyIds: data.companyIds || [],
        terminalIds: data.terminalIds || [],
        operatorIds: data.operatorIds || [],
      };
    } catch (error) {
      console.error('Giftcard maker session failed:', error);
      return { success: false, error: 'Ett fel uppstod vid initiering av presentkortsskaparen' };
    }
  },
};
