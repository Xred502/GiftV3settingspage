import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Layout from '../components/Layout';
import CompanyCombobox from '../components/CompanyCombobox';
import CodeEditor from '../components/CodeEditor';
import DraftBanner from '../components/DraftBanner';
import ChangeHistoryPanel from '../components/ChangeHistoryPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { websiteSettingsService, Company, GiftcardTemplate } from '@/services/websiteSettingsService';
import { Code2, Settings, Save, Loader2, History, ExternalLink, Eye, EyeOff, Plus, Trash2, LayoutTemplate, Pencil } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAutosaveDraft, loadDraft, clearDraft } from '../hooks/useLocalDraft';
import { useChangeHistory } from '../hooks/useChangeHistory';

// ── Zod schema ─────────────────────────────────────────────────────────────────

const emailOrEmpty = z.union([z.literal(''), z.string().email('Ogiltig e-postadress')]);
const numStr       = z.string().refine((v) => v === '' || !isNaN(Number(v)), { message: 'Måste vara ett tal' });

const settingsSchema = z.object({
  companyName:             z.string().min(1, 'Företagsnamn krävs'),
  companyNumber:           z.string(),

  copyOfPdfGiftCardTo:     emailOrEmpty,
  copyOfReceiptTo:         emailOrEmpty,
  maximumMsgTextLimit:     numStr,
  customerEmailTemplate:   z.string(),
  paymentPlatform:         z.string(),
  paymentTestMode:         z.boolean(),
  microdebSwishApiKey:     z.string(),
  swedbankAuthToken:       z.string(),
  swedbankPayeeIdToken:    z.string(),
  netsSecretApiKey:        z.string(),
  netsCheckoutKey:         z.string(),
  companyAmountJson:       z.string(),
  minimumAmountLimit:      numStr,
  maximumAmountLimit:      numStr,
  canSendHome:             z.boolean(),
  deliveryCharges:         z.string(),
  allowMultipleCards:      z.boolean(),
  trackingCode:            z.string(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

// ── Types ──────────────────────────────────────────────────────────────────────

interface HtmlState {
  bannerHtml: string;
  companyFooterHtml: string;
  companyCustomStyle: string;
  formBackgroundColor: string;
}

interface CompanyMeta {
  id: string;
  support_id?: string | number;
  giftCardNumberLatest?: string;
  createdAtUtc?: string;
  updatedAtUtc?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function str(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val);
}

function bool(val: unknown): boolean {
  return val === 1 || val === true || val === '1';
}

function companyToForm(c: Company): SettingsFormValues {
  return {
    companyName: str(c.companyName),
    companyNumber: str(c.companyNumber),

    copyOfPdfGiftCardTo: str(c.copyOfPdfGiftCardTo),
    copyOfReceiptTo: str(c.copyOfReceiptTo),
    maximumMsgTextLimit: str(c.maximumMsgTextLimit),
    customerEmailTemplate: str(c.customerEmailTemplate),
    paymentPlatform: str(c.paymentPlatform),
    paymentTestMode: bool(c.paymentTestMode),
    microdebSwishApiKey: str(c.microdebSwishApiKey),
    swedbankAuthToken: str(c.swedbankAuthToken),
    swedbankPayeeIdToken: str(c.swedbankPayeeIdToken),
    netsSecretApiKey: str(c.netsSecretApiKey),
    netsCheckoutKey: str(c.netsCheckoutKey),
    companyAmountJson: str(c.companyAmountJson),
    minimumAmountLimit: str(c.minimumAmountLimit),
    maximumAmountLimit: str(c.maximumAmountLimit),
    canSendHome: bool(c.canSendHome),
    deliveryCharges: str(c.deliveryCharges),
    allowMultipleCards: bool(c.allowMultipleCards),
    trackingCode: str(c.trackingCode),
  };
}

function formToPayload(f: SettingsFormValues): Record<string, unknown> {
  const numOrNull = (v: string) => (v.trim() !== '' ? Number(v) : null);
  return {
    ...f,

    paymentTestMode: f.paymentTestMode ? 1 : 0,
    canSendHome: f.canSendHome ? 1 : 0,
    allowMultipleCards: f.allowMultipleCards ? 1 : 0,
    maximumMsgTextLimit: numOrNull(f.maximumMsgTextLimit),
    minimumAmountLimit: numOrNull(f.minimumAmountLimit),
    maximumAmountLimit: numOrNull(f.maximumAmountLimit),
    deliveryCharges: f.deliveryCharges || null,
  };
}

const EMPTY_HTML: HtmlState = { bannerHtml: '', companyFooterHtml: '', companyCustomStyle: '', formBackgroundColor: '' };
const EMPTY_META: CompanyMeta = { id: '' };

// ── Sub-components ─────────────────────────────────────────────────────────────

function SwitchField({ label, description, name, control }: {
  label: string;
  description?: string;
  name: keyof SettingsFormValues;
  control: ReturnType<typeof useForm<SettingsFormValues>>['control'];
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex items-center justify-between py-1.5">
          <div className="space-y-0.5">
            <FormLabel className="text-sm font-medium cursor-pointer">{label}</FormLabel>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          <FormControl>
            <Switch checked={!!field.value} onCheckedChange={field.onChange} />
          </FormControl>
        </FormItem>
      )}
    />
  );
}

function TextField({ label, name, control, type = 'text', placeholder }: {
  label: string;
  name: keyof SettingsFormValues;
  control: ReturnType<typeof useForm<SettingsFormValues>>['control'];
  type?: string;
  placeholder?: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="space-y-1.5">
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input type={type} placeholder={placeholder} {...field} value={str(field.value)} />
          </FormControl>
          <FormMessage className="text-xs" />
        </FormItem>
      )}
    />
  );
}

function SecretField({ label, name, control }: {
  label: string;
  name: keyof SettingsFormValues;
  control: ReturnType<typeof useForm<SettingsFormValues>>['control'];
}) {
  const [show, setShow] = useState(false);
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="space-y-1.5">
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <div className="relative">
              <Input
                type={show ? 'text' : 'password'}
                className="pr-9"
                {...field}
                value={str(field.value)}
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute inset-y-0 right-0 px-3 text-muted-foreground hover:text-foreground"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </FormControl>
          <FormMessage className="text-xs" />
        </FormItem>
      )}
    />
  );
}

// ── AmountChipInput ────────────────────────────────────────────────────────────

function AmountChipInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const amounts = value
    ? value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).map(Number).filter((n) => !isNaN(n) && n > 0)
    : [];

  const toFieldValue = (nums: number[]) =>
    [...new Set(nums)].sort((a, b) => a - b).join('\r\n');

  function add() {
    const n = Number(inputVal.trim().replace(/[^0-9]/g, ''));
    if (!n || amounts.includes(n)) { setInputVal(''); return; }
    onChange(toFieldValue([...amounts, n]));
    setInputVal('');
    inputRef.current?.focus();
  }

  function remove(n: number) {
    onChange(toFieldValue(amounts.filter((a) => a !== n)));
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); add(); }
    if (e.key === 'Backspace' && inputVal === '' && amounts.length > 0) {
      remove(amounts[amounts.length - 1]);
    }
  }

  return (
    <div
      className="flex flex-wrap gap-2 rounded-md border border-input bg-background px-3 py-2 min-h-[44px] cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {amounts.map((n) => (
        <span key={n} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-0.5 text-sm font-medium">
          {n.toLocaleString('sv-SE')} kr
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); remove(n); }}
            className="text-primary/60 hover:text-primary leading-none"
            aria-label={`Ta bort ${n} kr`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="number"
        min="1"
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={add}
        placeholder={amounts.length === 0 ? 'Ange belopp och tryck Enter...' : 'Lägg till...'}
        className="flex-1 min-w-[120px] bg-transparent outline-none text-sm placeholder:text-muted-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function WebsiteSettings() {
  const { toast } = useToast();
  const { pushEntry } = useChangeHistory();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [companyMeta, setCompanyMeta] = useState<CompanyMeta>(EMPTY_META);

  // HTML/CSS form (not in RHF — CodeMirror manages its own state)
  const [htmlState, setHtmlState] = useState<HtmlState>(EMPTY_HTML);
  const [htmlDirty, setHtmlDirty] = useState(false);
  const [htmlSaved, setHtmlSaved] = useState<HtmlState>(EMPTY_HTML);
  const [isSavingHtml, setIsSavingHtml] = useState(false);
  const GIFTCARD_SITE_BASE = import.meta.env.VITE_GIFTCARD_SITE_URL ?? 'https://presentkort.microdeb.se';

  // Draft banners
  const [settingsDraftInfo, setSettingsDraftInfo] = useState<{ savedAt: string } | null>(null);
  const [htmlDraftInfo, setHtmlDraftInfo] = useState<{ savedAt: string } | null>(null);

  // Order search

  // React Hook Form
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: companyToForm({} as Company),
  });
  const { isDirty: settingsDirty, isSubmitting } = form.formState;
  const watchedValues = form.watch();

  // ── Load companies ─────────────────────────────────────────────────────────

  useEffect(() => { loadCompanies(); }, []);

  async function loadCompanies() {
    setIsLoadingCompanies(true);
    const result = await websiteSettingsService.getCompanies();
    if (result.success && result.companies) {
      setCompanies(result.companies);
      if (result.companies.length > 0) {
        setSelectedCompanyId(result.companies[0].id || result.companies[0].companyId);
      }
    } else {
      toast({ title: 'Fel', description: result.error, variant: 'destructive' });
    }
    setIsLoadingCompanies(false);
  }

  // ── Select company ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedCompanyId || companies.length === 0) return;
    const company = companies.find((c) => (c.id || c.companyId) === selectedCompanyId);
    if (!company) return;

    const formValues = companyToForm(company);
    form.reset(formValues);

    const html: HtmlState = {
      bannerHtml: str(company.bannerHtml),
      companyFooterHtml: str(company.companyFooterHtml),
      companyCustomStyle: str(company.companyCustomStyle),
      formBackgroundColor: str(company.formBackgroundColor),
    };
    setHtmlState(html);
    setHtmlSaved(html);
    setHtmlDirty(false);

    setCompanyMeta({
      id: company.id || company.companyId,
      support_id: company.support_id,
      giftCardNumberLatest: str(company.giftCardNumberLatest),
      createdAtUtc: company.createdAtUtc,
      updatedAtUtc: company.updatedAtUtc,
    });

    // Check for drafts
    const sd = loadDraft<SettingsFormValues>(selectedCompanyId, 'settings');
    setSettingsDraftInfo(sd ? { savedAt: sd.savedAt } : null);
    const hd = loadDraft<HtmlState>(selectedCompanyId, 'html');
    setHtmlDraftInfo(hd ? { savedAt: hd.savedAt } : null);

    // Load templates
    loadTemplates(selectedCompanyId);
  }, [selectedCompanyId, companies]);

  // ── Autosave drafts ────────────────────────────────────────────────────────

  useAutosaveDraft(selectedCompanyId, 'settings', watchedValues, settingsDirty);
  useAutosaveDraft(selectedCompanyId, 'html', htmlState, htmlDirty);

  // ── HTML helpers ───────────────────────────────────────────────────────────

  const setH = useCallback(<K extends keyof HtmlState>(key: K, value: string) => {
    setHtmlState((prev) => ({ ...prev, [key]: value }));
    setHtmlDirty(true);
  }, []);

  // ── Save handlers ──────────────────────────────────────────────────────────

  async function handleSaveSettings(values: SettingsFormValues) {
    const before = formToPayload(form.formState.defaultValues as SettingsFormValues);
    const after = formToPayload(values);
    const result = await websiteSettingsService.updateCompany(selectedCompanyId, after);
    if (result.success) {
      toast({ title: 'Sparat', description: 'Inställningarna har sparats.' });
      clearDraft(selectedCompanyId, 'settings');
      setSettingsDraftInfo(null);
      form.reset(values);
      const company = companies.find((c) => (c.id || c.companyId) === selectedCompanyId);
      pushEntry(selectedCompanyId, company?.companyName ?? selectedCompanyId, 'Inställningar', before as Record<string, unknown>, after as Record<string, unknown>);
    } else {
      toast({ title: 'Fel', description: result.error, variant: 'destructive' });
    }
  }

  async function handleSaveHtml() {
    setIsSavingHtml(true);
    const before: Record<string, unknown> = { ...htmlSaved };
    const after = {
      bannerHtml: htmlState.bannerHtml,
      companyFooterHtml: htmlState.companyFooterHtml,
      companyCustomStyle: htmlState.companyCustomStyle,
      formBackgroundColor: htmlState.formBackgroundColor || null,
    };
    const result = await websiteSettingsService.updateCompany(selectedCompanyId, after);
    if (result.success) {
      toast({ title: 'Sparat', description: 'HTML & CSS har sparats.' });
      setHtmlSaved(htmlState);
      setHtmlDirty(false);
      clearDraft(selectedCompanyId, 'html');
      setHtmlDraftInfo(null);
      const company = companies.find((c) => (c.id || c.companyId) === selectedCompanyId);
      pushEntry(selectedCompanyId, company?.companyName ?? selectedCompanyId, 'HTML & CSS', before, after as Record<string, unknown>);
    } else {
      toast({ title: 'Fel', description: result.error, variant: 'destructive' });
    }
    setIsSavingHtml(false);
  }

  // ── Template handlers ──────────────────────────────────────────────────────

  async function loadTemplates(companyId?: string) {
    const cid = companyId ?? selectedCompanyId;
    if (!cid) return;
    setIsLoadingTemplates(true);
    const company = companies.find((c) => (c.id || c.companyId) === cid);
    const result = await websiteSettingsService.getTemplates(cid, company?.companyName);
    if (result.success) {
      setTemplates(result.templates ?? []);
    }
    setIsLoadingTemplates(false);
  }

  function openTemplateDialog(template: GiftcardTemplate | null) {
    setEditingTemplate(template);
    setTplForm({
      templateName: template?.templateName ?? '',
      operatorId: template?.operatorId ?? selectedCompany?.companyName ?? '',
      htmlContent: template?.htmlContent ?? '',
      cssContent: template?.cssContent ?? '',
      templatePreview: template?.templatePreview ?? 0,
    });
    setTemplateDialogOpen(true);
  }

  async function handleSaveTemplate() {
    if (!tplForm.templateName.trim()) return;
    setIsSavingTemplate(true);
    if (editingTemplate) {
      const result = await websiteSettingsService.updateTemplate(selectedCompanyId, editingTemplate.templateId, tplForm);
      if (result.success) {
        toast({ title: 'Sparat', description: 'Mallen har uppdaterats.' });
        setTemplateDialogOpen(false);
        await loadTemplates();
      } else {
        toast({ title: 'Fel', description: result.error, variant: 'destructive' });
      }
    } else {
      const result = await websiteSettingsService.createTemplate(selectedCompanyId, tplForm);
      if (result.success) {
        toast({ title: 'Skapad', description: `${tplForm.templateName} har skapats.` });
        setTemplateDialogOpen(false);
        await loadTemplates();
      } else {
        toast({ title: 'Fel', description: result.error, variant: 'destructive' });
      }
    }
    setIsSavingTemplate(false);
  }

  async function handleToggleTemplate(tpl: GiftcardTemplate) {
    const newActive = (tpl.isActive ?? 1) === 1 ? 0 : 1;
    setTogglingTemplateId(tpl.templateId);
    const result = await websiteSettingsService.updateTemplate(selectedCompanyId, tpl.templateId, { isActive: newActive });
    if (result.success) {
      setTemplates((prev) => prev.map((t) => t.templateId === tpl.templateId ? { ...t, isActive: newActive } : t));
    } else {
      toast({ title: 'Fel', description: result.error, variant: 'destructive' });
    }
    setTogglingTemplateId(null);
  }

  async function handleDeleteTemplate() {
    if (!deletingTemplate) return;
    setIsDeletingTemplate(true);
    const result = await websiteSettingsService.deleteTemplate(selectedCompanyId, deletingTemplate.templateId);
    if (result.success) {
      toast({ title: 'Borttagen', description: `${deletingTemplate.templateName || 'Mallen'} har tagits bort.` });
      setDeleteTemplateDialogOpen(false);
      setDeletingTemplate(null);
      await loadTemplates();
    } else {
      toast({ title: 'Fel', description: result.error, variant: 'destructive' });
    }
    setIsDeletingTemplate(false);
  }

  // ── Order search ───────────────────────────────────────────────────────────

  const hasCompany = !!selectedCompanyId;
  const selectedCompany = companies.find((c) => (c.id || c.companyId) === selectedCompanyId);
  const giftcardPageUrl = selectedCompanyId
    ? `${GIFTCARD_SITE_BASE}/${encodeURIComponent(selectedCompany?.companyId || selectedCompanyId)}`
    : null;

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyNumber, setNewCompanyNumber] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

  // Templates state
  const [templates, setTemplates] = useState<GiftcardTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<GiftcardTemplate | null>(null);
  const [tplForm, setTplForm] = useState({ templateName: '', operatorId: '', htmlContent: '', cssContent: '', templatePreview: 0 });
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [deleteTemplateDialogOpen, setDeleteTemplateDialogOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<GiftcardTemplate | null>(null);
  const [isDeletingTemplate, setIsDeletingTemplate] = useState(false);
  const [togglingTemplateId, setTogglingTemplateId] = useState<number | string | null>(null);

  async function handleToggleCompanyActive() {
    if (!selectedCompanyId || !selectedCompany) return;
    setIsDeactivating(true);
    const newActive = !selectedCompany.companyActive;
    const result = await websiteSettingsService.updateCompany(selectedCompanyId, { companyActive: newActive ? 1 : 0 });
    if (result.success) {
      const label = newActive ? 'Återaktiverat' : 'Inaktiverat';
      toast({ title: label, description: `${selectedCompany.companyName ?? selectedCompanyId} har ${newActive ? 'återaktiverats' : 'inaktiverats'}.` });
      setDeactivateDialogOpen(false);
      await loadCompanies();
    } else {
      toast({ title: 'Fel', description: result.error, variant: 'destructive' });
    }
    setIsDeactivating(false);
  }

  async function handleCreateCompany(e: React.FormEvent) {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    setIsCreating(true);
    const result = await websiteSettingsService.createCompany({
      companyName: newCompanyName.trim(),
      companyNumber: newCompanyNumber.trim() || undefined,
    });
    if (result.success && result.data) {
      toast({ title: 'Skapat', description: `${newCompanyName.trim()} har skapats.` });
      setCreateDialogOpen(false);
      setNewCompanyName('');
      setNewCompanyNumber('');
      await loadCompanies();
      const newId = result.data.id || result.data.companyId;
      if (newId) setSelectedCompanyId(newId);
    } else {
      toast({ title: 'Fel', description: result.error, variant: 'destructive' });
    }
    setIsCreating(false);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className="space-y-5">

        {/* Company selector */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Välj företag</CardTitle>
            <CardDescription>Sök och välj vilket företag du vill redigera</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingCompanies ? (
              <Skeleton className="h-10 w-64" />
            ) : (
              <div className="flex items-center gap-3">
                <CompanyCombobox
                  companies={companies}
                  value={selectedCompanyId}
                  onValueChange={setSelectedCompanyId}
                />
                {selectedCompany && (
                  <Badge variant={selectedCompany.companyActive ? 'default' : 'secondary'}>
                    {selectedCompany.companyActive ? 'Aktiv' : 'Inaktiv'}
                  </Badge>
                )}
                <Button size="sm" variant="outline" onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Skapa nytt
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create company dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Skapa nytt företag</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateCompany}>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <label htmlFor="new-company-name" className="text-sm font-medium">Företagsnamn *</label>
                  <Input
                    id="new-company-name"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    placeholder="Ange företagsnamn"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="new-company-number" className="text-sm font-medium">Organisationsnummer</label>
                  <Input
                    id="new-company-number"
                    value={newCompanyNumber}
                    onChange={(e) => setNewCompanyNumber(e.target.value)}
                    placeholder="XXXXXX-XXXX"
                  />
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Avbryt
                </Button>
                <Button type="submit" disabled={isCreating || !newCompanyName.trim()}>
                  {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  Skapa företag
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Deactivate company dialog */}
        <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {selectedCompany?.companyActive ? 'Inaktivera företag' : 'Återaktivera företag'}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground py-2">
              {selectedCompany?.companyActive
                ? <>Är du säker på att du vill inaktivera <strong>{selectedCompany?.companyName}</strong>? Företaget blir inte längre tillgängligt för kunder.</>
                : <>Vill du återaktivera <strong>{selectedCompany?.companyName}</strong>? Företaget blir åter tillgängligt för kunder.</>}
            </p>
            <DialogFooter className="mt-2">
              <Button variant="outline" onClick={() => setDeactivateDialogOpen(false)}>
                Avbryt
              </Button>
              <Button
                variant={selectedCompany?.companyActive ? 'destructive' : 'default'}
                onClick={handleToggleCompanyActive}
                disabled={isDeactivating}
              >
                {isDeactivating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                {selectedCompany?.companyActive ? 'Inaktivera' : 'Återaktivera'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Tabs */}
        <Tabs defaultValue="installningar">
          <TabsList>
            <TabsTrigger value="installningar" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Inställningar
              {settingsDirty && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
            </TabsTrigger>
            <TabsTrigger value="html-css" className="flex items-center gap-2">
              <Code2 className="h-4 w-4" />
              HTML & CSS
              {htmlDirty && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
            </TabsTrigger>
            <TabsTrigger value="historik" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Historik
            </TabsTrigger>
            <TabsTrigger value="mallar" className="flex items-center gap-2">
              <LayoutTemplate className="h-4 w-4" />
              Mallar
            </TabsTrigger>
          </TabsList>

          {/* ── Inställningar ───────────────────────────────────────────────── */}
          <TabsContent value="installningar" className="mt-4 space-y-4">
            {!hasCompany ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">Välj ett företag ovan</CardContent></Card>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSaveSettings)} className="space-y-4">

                  {settingsDraftInfo && (
                    <DraftBanner
                      savedAt={settingsDraftInfo.savedAt}
                      onRestore={() => {
                        const draft = loadDraft<SettingsFormValues>(selectedCompanyId, 'settings');
                        if (draft) { form.reset(draft.data); setSettingsDraftInfo(null); }
                      }}
                      onDismiss={() => { clearDraft(selectedCompanyId, 'settings'); setSettingsDraftInfo(null); }}
                    />
                  )}

                  {/* Grunduppgifter */}
                  <Card>
                    <CardHeader><CardTitle className="text-base">Grunduppgifter</CardTitle></CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                      <TextField label="Företagsnamn" name="companyName" control={form.control} />
                      <TextField label="Organisationsnummer" name="companyNumber" control={form.control} />
                    </CardContent>
                  </Card>


                  {/* E-post */}
                  <Card>
                    <CardHeader><CardTitle className="text-base">E-post & notifikationer</CardTitle></CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                      <TextField label="Kopia av PDF-presentkort till" name="copyOfPdfGiftCardTo" control={form.control} type="email" />
                      <TextField label="Kopia av kvitto till" name="copyOfReceiptTo" control={form.control} type="email" />
                      <TextField label="Max tecken i meddelande" name="maximumMsgTextLimit" control={form.control} />
                      <div className="sm:col-span-2 space-y-1.5">
                        <FormField control={form.control} name="customerEmailTemplate" render={({ field }) => (
                          <FormItem>
                            <FormLabel>E-postmall till kund (HTML)</FormLabel>
                            <FormControl><textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y min-h-[120px] font-mono text-xs" {...field} value={str(field.value)} /></FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )} />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Betalning */}
                  <Card>
                    <CardHeader><CardTitle className="text-base">Betalning</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2 space-y-1.5">
                          <FormField control={form.control} name="paymentPlatform" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Betalplattform <span className="text-xs font-normal text-muted-foreground">(JSON-format, ex: ["Only Nets Easy"])</span></FormLabel>
                              <FormControl><Input {...field} value={str(field.value)} /></FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )} />
                        </div>
                        <SwitchField label="Testläge" description="Aktivera för att testa utan riktiga transaktioner" name="paymentTestMode" control={form.control} />
                      </div>
                      <Separator />
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">API-nycklar</p>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <SecretField label="Microdeb Swish API-nyckel" name="microdebSwishApiKey" control={form.control} />
                        <SecretField label="Swedbank Auth Token" name="swedbankAuthToken" control={form.control} />
                        <SecretField label="Swedbank Payee ID Token" name="swedbankPayeeIdToken" control={form.control} />
                        <SecretField label="Nets Secret API-nyckel" name="netsSecretApiKey" control={form.control} />
                        <SecretField label="Nets Checkout-nyckel" name="netsCheckoutKey" control={form.control} />
                        <TextField label="Spårningskod (analytics)" name="trackingCode" control={form.control} />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Belopp & leverans */}
                  <Card>
                    <CardHeader><CardTitle className="text-base">Belopp & leverans</CardTitle></CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2 space-y-1.5">
                        <FormField control={form.control} name="companyAmountJson" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Förinställda belopp</FormLabel>
                            <FormControl>
                              <AmountChipInput value={str(field.value)} onChange={field.onChange} />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">Skriv ett belopp och tryck Enter för att lägga till. Klicka × för att ta bort.</p>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )} />
                      </div>
                      <TextField label="Minsta belopp (kr)" name="minimumAmountLimit" control={form.control} />
                      <TextField label="Högsta belopp (kr)" name="maximumAmountLimit" control={form.control} />
                      <SwitchField label="Hemleverans tillåten" name="canSendHome" control={form.control} />
                      <TextField label="Leveransavgift" name="deliveryCharges" control={form.control} />
                      <SwitchField label="Tillåt flera kort i samma order" name="allowMultipleCards" control={form.control} />
                    </CardContent>
                  </Card>

                  {/* Systeminformation */}
                  <Card className="border-dashed opacity-80">
                    <CardHeader><CardTitle className="text-sm text-muted-foreground">Systeminformation (skrivskyddad)</CardTitle></CardHeader>
                    <CardContent className="grid gap-2 sm:grid-cols-2 text-sm text-muted-foreground">
                      {[
                        ['ID', companyMeta.id],
                        ['Support ID', str(companyMeta.support_id)],
                        ['Senaste presentkortsnummer', str(companyMeta.giftCardNumberLatest) || '–'],
                        ['Skapad', companyMeta.createdAtUtc ? new Date(companyMeta.createdAtUtc).toLocaleString('sv-SE') : '–'],
                        ['Senast uppdaterad', companyMeta.updatedAtUtc ? new Date(companyMeta.updatedAtUtc).toLocaleString('sv-SE') : '–'],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <span className="font-medium text-foreground">{k}:</span>{' '}
                          <span className="font-mono text-xs break-all">{v}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Danger zone */}
                  <Card className="border-destructive/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base text-destructive">Farlig zon</CardTitle>
                      <CardDescription>Åtgärder som påverkar företagets synlighet i systemet.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">
                            {selectedCompany?.companyActive ? 'Inaktivera företag' : 'Återaktivera företag'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {selectedCompany?.companyActive
                              ? 'Sätter företaget som inaktivt så det inte är tillgängligt för kunder.'
                              : 'Aktiverar företaget igen så det blir tillgängligt för kunder.'}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant={selectedCompany?.companyActive ? 'destructive' : 'outline'}
                          size="sm"
                          onClick={() => setDeactivateDialogOpen(true)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          {selectedCompany?.companyActive ? 'Inaktivera' : 'Återaktivera'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Save bar */}
                  <div className="sticky bottom-4 flex justify-end">
                    <Button
                      type="submit"
                      disabled={!settingsDirty || isSubmitting}
                      className="gap-2 shadow-lg"
                    >
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Spara inställningar
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </TabsContent>

          {/* ── HTML & CSS ──────────────────────────────────────────────────── */}
          <TabsContent value="html-css" className="mt-4 space-y-4">
            {!hasCompany ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">Välj ett företag ovan</CardContent></Card>
            ) : (
              <>
                {htmlDraftInfo && (
                  <DraftBanner
                    savedAt={htmlDraftInfo.savedAt}
                    onRestore={() => {
                      const draft = loadDraft<HtmlState>(selectedCompanyId, 'html');
                      if (draft) { setHtmlState(draft.data); setHtmlDirty(true); setHtmlDraftInfo(null); }
                    }}
                    onDismiss={() => { clearDraft(selectedCompanyId, 'html'); setHtmlDraftInfo(null); }}
                  />
                )}

                <div className="space-y-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Banner HTML</CardTitle>
                        {giftcardPageUrl && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => window.open(giftcardPageUrl, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                            Öppna presentkortssidan
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CodeEditor
                        language="html"
                        value={htmlState.bannerHtml}
                        onChange={(v) => setH('bannerHtml', v)}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">Footer HTML</CardTitle></CardHeader>
                    <CardContent>
                      <CodeEditor
                        language="html"
                        value={htmlState.companyFooterHtml}
                        onChange={(v) => setH('companyFooterHtml', v)}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">Anpassad CSS</CardTitle></CardHeader>
                    <CardContent>
                      <CodeEditor
                        language="css"
                        value={htmlState.companyCustomStyle}
                        onChange={(v) => setH('companyCustomStyle', v)}
                        minHeight="320px"
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">Formulärbakgrund</CardTitle></CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground mb-3">Bakgrundsfärg på formulärkortet (lämna tomt för vitt). Används för att matcha företagets temafärg.</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          className="h-9 w-12 rounded border border-input cursor-pointer p-1"
                          value={htmlState.formBackgroundColor || '#ffffff'}
                          onChange={(e) => setH('formBackgroundColor', e.target.value)}
                        />
                        <Input
                          placeholder="#ffffff"
                          value={htmlState.formBackgroundColor}
                          onChange={(e) => setH('formBackgroundColor', e.target.value)}
                          className="font-mono w-36"
                        />
                        {htmlState.formBackgroundColor && (
                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => setH('formBackgroundColor', '')}
                          >
                            Återställ
                          </button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="sticky bottom-4 flex justify-end">
                  <Button onClick={handleSaveHtml} disabled={!htmlDirty || isSavingHtml} className="gap-2 shadow-lg">
                    {isSavingHtml ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Spara HTML & CSS
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* ── Historik ─────────────────────────────────────────────────────── */}
          <TabsContent value="historik" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <ChangeHistoryPanel />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Mallar ───────────────────────────────────────────────────────── */}
          <TabsContent value="mallar" className="mt-4 space-y-4">
            {!hasCompany ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">Välj ett företag ovan</CardContent></Card>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {isLoadingTemplates ? 'Laddar mallar…' : (() => {
                      const active = templates.filter((t) => (t.isActive ?? 1) === 1).length;
                      const total = templates.length;
                      const hasActiveField = templates.some((t) => t.isActive !== undefined);
                      return hasActiveField
                        ? `${total} mall${total !== 1 ? 'ar' : ''} (${active} aktiv${active !== 1 ? 'a' : ''})`
                        : `${total} mall${total !== 1 ? 'ar' : ''}`;
                    })()}
                  </p>
                  <Button size="sm" onClick={() => openTemplateDialog(null)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Skapa ny mall
                  </Button>
                </div>

                {isLoadingTemplates ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : templates.length === 0 ? (
                  <Card>
                    <CardContent className="py-10 flex flex-col items-center gap-2 text-muted-foreground">
                      <LayoutTemplate className="h-8 w-8 opacity-30" />
                      <p className="text-sm">Inga mallar hittades för detta företag</p>
                      <Button size="sm" variant="outline" className="mt-1" onClick={() => openTemplateDialog(null)}>
                        <Plus className="h-4 w-4 mr-1" />
                        Skapa första mallen
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {templates.map((tpl) => {
                      const isActive = (tpl.isActive ?? 1) === 1;
                      const hasActiveField = tpl.isActive !== undefined;
                      return (
                        <Card key={String(tpl.templateId)} className={!isActive ? 'opacity-60' : ''}>
                          <CardContent className="py-3 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              {hasActiveField && (
                                <Switch
                                  checked={isActive}
                                  onCheckedChange={() => handleToggleTemplate(tpl)}
                                  disabled={togglingTemplateId === tpl.templateId}
                                  aria-label={isActive ? 'Inaktivera mall' : 'Aktivera mall'}
                                />
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium truncate">{tpl.templateName || '(namnlös)'}</p>
                                  {hasActiveField && (
                                    <Badge variant={isActive ? 'default' : 'secondary'} className="text-xs shrink-0">
                                      {isActive ? 'Aktiv' : 'Inaktiv'}
                                    </Badge>
                                  )}
                                </div>
                                {tpl.operatorId && (
                                  <p className="text-xs text-muted-foreground">Operator: {tpl.operatorId}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <Button size="sm" variant="outline" onClick={() => openTemplateDialog(tpl)}>
                                <Pencil className="h-3.5 w-3.5 mr-1" />
                                Redigera
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive hover:text-destructive"
                                onClick={() => { setDeletingTemplate(tpl); setDeleteTemplateDialogOpen(true); }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* ── Template create/edit dialog ────────────────────────────────────── */}
        <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
          <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? 'Redigera mall' : 'Skapa ny mall'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Mallnamn *</label>
                <Input
                  value={tplForm.templateName}
                  onChange={(e) => setTplForm((f) => ({ ...f, templateName: e.target.value }))}
                  placeholder="Ange mallnamn"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Operator-ID</label>
                <Input
                  value={tplForm.operatorId}
                  onChange={(e) => setTplForm((f) => ({ ...f, operatorId: e.target.value }))}
                  placeholder="t.ex. Showtic"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Mallförhandsvisning</p>
                  <p className="text-xs text-muted-foreground">Visa mallval för kunden</p>
                </div>
                <Switch
                  checked={tplForm.templatePreview === 1}
                  onCheckedChange={(checked) => setTplForm((f) => ({ ...f, templatePreview: checked ? 1 : 0 }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">HTML-innehåll</label>
                <CodeEditor
                  language="html"
                  value={tplForm.htmlContent}
                  onChange={(v) => setTplForm((f) => ({ ...f, htmlContent: v }))}
                  minHeight="200px"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">CSS</label>
                <CodeEditor
                  language="css"
                  value={tplForm.cssContent}
                  onChange={(v) => setTplForm((f) => ({ ...f, cssContent: v }))}
                  minHeight="150px"
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>Avbryt</Button>
              <Button onClick={handleSaveTemplate} disabled={isSavingTemplate || !tplForm.templateName.trim()}>
                {isSavingTemplate ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                {editingTemplate ? 'Spara ändringar' : 'Skapa mall'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Template delete confirm dialog ─────────────────────────────────── */}
        <Dialog open={deleteTemplateDialogOpen} onOpenChange={setDeleteTemplateDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Ta bort mall</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground py-2">
              Är du säker på att du vill ta bort mallen <strong>{deletingTemplate?.templateName || '(namnlös)'}</strong>? Åtgärden kan inte ångras.
            </p>
            <DialogFooter className="mt-2">
              <Button variant="outline" onClick={() => setDeleteTemplateDialogOpen(false)}>Avbryt</Button>
              <Button variant="destructive" onClick={handleDeleteTemplate} disabled={isDeletingTemplate}>
                {isDeletingTemplate ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Ta bort
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
