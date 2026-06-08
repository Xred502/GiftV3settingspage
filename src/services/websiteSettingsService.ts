import { apiFetch } from './api';

export interface Company {
  id: string;
  companyId: string;
  companyNumber?: string;
  companyName: string;
  companyActive?: number;
  companyEmail?: string;
  companyHelpLineEmail?: string;
  companyPhone?: string;
  companyUrl?: string;
  companyLogoFileName?: string;
  companyAddressInformation?: string;
  copyOfPdfGiftCardTo?: string;
  copyOfReceiptTo?: string;
  maximumMsgTextLimit?: number | null;
  backgroundImageUrl?: string;
  trackingCode?: string;
  companyCustomStyle?: string;
  companyStyleUrl?: string;
  bannerHtml?: string;
  companyFooterHtml?: string;
  linkToPolicy?: string;
  templatePreview?: number;
  formBackgroundColor?: string;
  showCompanyEmail?: number;
  showCompanyContactNumber?: number;
  customerEmailTemplate?: string;
  paymentPlatform?: string;
  paymentTestMode?: number;
  companyAmountJson?: string;
  minimumAmountLimit?: number | null;
  maximumAmountLimit?: number | null;
  microdebSwishApiKey?: string;
  swedbankAuthToken?: string;
  swedbankPayeeIdToken?: string;
  netsSecretApiKey?: string;
  netsCheckoutKey?: string;
  canSendHome?: number;
  deliveryCharges?: string | number | null;
  giftCardNumberLatest?: string | null;
  allowMultipleCards?: number;
  createdAtUtc?: string;
  updatedAtUtc?: string;
  support_id?: string | number;
}

export interface CompanyUpdatePayload {
  bannerHtml?: string;
  companyFooterHtml?: string;
  companyCustomStyle?: string;
  [key: string]: unknown;
}

export interface GiftcardTemplate {
  templateId: number | string;
  templateName: string;
  htmlContent?: string;
  cssContent?: string;
  companyId?: string;
  operatorId?: string;
  terminalId?: string | number | null;
  isActive?: number;
  templatePreview?: number;
  createdAtUtc?: string;
  updatedAtUtc?: string;
}

export interface TemplateFormPayload {
  templateName: string;
  htmlContent: string;
  cssContent: string;
  operatorId: string;
  isActive?: number;
  templatePreview?: number;
}

export const websiteSettingsService = {
  async getCompanies(): Promise<{ success: boolean; companies?: Company[]; error?: string }> {
    try {
      const response = await apiFetch('/settings/companies');
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { success: false, error: err.error || 'Kunde inte hämta företag' };
      }
      const data = await response.json();
      const companies: Company[] = Array.isArray(data) ? data : (data.companies ?? data.data ?? []);
      return { success: true, companies };
    } catch {
      return { success: false, error: 'Ett fel uppstod vid hämtning av företag' };
    }
  },

  async createCompany(
    payload: { companyName: string; companyNumber?: string; [key: string]: unknown }
  ): Promise<{ success: boolean; data?: Company; error?: string }> {
    try {
      const response = await apiFetch('/settings/companies', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { success: false, error: err.error || 'Kunde inte skapa företag' };
      }
      const data = await response.json();
      return { success: true, data };
    } catch {
      return { success: false, error: 'Ett fel uppstod vid skapande av företag' };
    }
  },

  async updateCompany(
    id: string,
    payload: CompanyUpdatePayload
  ): Promise<{ success: boolean; data?: Company; error?: string }> {
    try {
      const response = await apiFetch(`/settings/companies/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { success: false, error: err.error || 'Kunde inte spara inställningar' };
      }
      const data = await response.json();
      return { success: true, data };
    } catch {
      return { success: false, error: 'Ett fel uppstod vid sparande' };
    }
  },

  async getTemplates(companyId: string, companyName?: string): Promise<{ success: boolean; templates?: GiftcardTemplate[]; error?: string }> {
    try {
      const params = new URLSearchParams({ companyId });
      if (companyName) params.set('companyName', companyName);
      const response = await apiFetch(`/settings/templates?${params.toString()}`);
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { success: false, error: err.error || 'Kunde inte hämta mallar' };
      }
      const data = await response.json();
      const templates: GiftcardTemplate[] = Array.isArray(data) ? data : (data.templates ?? data.data ?? []);
      return { success: true, templates };
    } catch {
      return { success: false, error: 'Ett fel uppstod vid hämtning av mallar' };
    }
  },

  async createTemplate(
    companyId: string,
    payload: TemplateFormPayload
  ): Promise<{ success: boolean; templateId?: number | string; error?: string }> {
    try {
      const response = await apiFetch('/settings/templates', {
        method: 'POST',
        body: JSON.stringify({ ...payload, companyId }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { success: false, error: err.error || 'Kunde inte skapa mall' };
      }
      const data = await response.json();
      return { success: true, templateId: data.templateId };
    } catch {
      return { success: false, error: 'Ett fel uppstod vid skapande av mall' };
    }
  },

  async updateTemplate(
    companyId: string,
    templateId: number | string,
    payload: Partial<TemplateFormPayload>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await apiFetch(
        `/settings/templates/${encodeURIComponent(String(templateId))}?companyId=${encodeURIComponent(companyId)}`,
        { method: 'PATCH', body: JSON.stringify(payload) }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { success: false, error: err.error || 'Kunde inte uppdatera mall' };
      }
      return { success: true };
    } catch {
      return { success: false, error: 'Ett fel uppstod vid uppdatering av mall' };
    }
  },

  async deleteTemplate(
    companyId: string,
    templateId: number | string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await apiFetch(
        `/settings/templates/${encodeURIComponent(String(templateId))}?companyId=${encodeURIComponent(companyId)}`,
        { method: 'DELETE' }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { success: false, error: err.error || 'Kunde inte ta bort mall' };
      }
      return { success: true };
    } catch {
      return { success: false, error: 'Ett fel uppstod vid borttagning av mall' };
    }
  },

};
