import { useState, useEffect, FormEvent } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { websiteSettingsService, Company } from '@/services/websiteSettingsService';
import { Code2, Search, Settings, Save, Loader2, Globe, Plus } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface SettingsForm {
  companyName: string;
  companyNumber: string;
  companyEmail: string;
  companyHelpLineEmail: string;
  companyPhone: string;
  companyUrl: string;
  companyLogoFileName: string;
  companyAddressInformation: string;
  linkToPolicy: string;
  companyActive: boolean;
  showCompanyEmail: boolean;
  showCompanyContactNumber: boolean;
  templatePreview: boolean;
  copyOfPdfGiftCardTo: string;
  copyOfReceiptTo: string;
  maximumMsgTextLimit: string;
  customerEmailTemplate: string;
  paymentPlatform: string;
  paymentTestMode: boolean;
  microdebSwishApiKey: string;
  swedbankAuthToken: string;
  swedbankPayeeIdToken: string;
  netsSecretApiKey: string;
  netsCheckoutKey: string;
  companyAmountJson: string;
  minimumAmountLimit: string;
  maximumAmountLimit: string;
  canSendHome: boolean;
  deliveryCharges: string;
  allowMultipleCards: boolean;
  backgroundImageUrl: string;
  formBackgroundColor: string;
  trackingCode: string;
  companyStyleUrl: string;
}

interface HtmlForm {
  bannerHtml: string;
  companyFooterHtml: string;
  companyCustomStyle: string;
}

interface CompanyMeta {
  id: string;
  support_id?: string | number;
  giftCardNumberLatest?: string;
  createdAtUtc?: string;
  updatedAtUtc?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function str(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val);
}

function bool(val: unknown): boolean {
  return val === 1 || val === true || val === '1';
}

function companyToForms(c: Company): { settings: SettingsForm; html: HtmlForm; meta: CompanyMeta } {
  return {
    settings: {
      companyName: str(c.companyName),
      companyNumber: str(c.companyNumber),
      companyEmail: str(c.companyEmail),
      companyHelpLineEmail: str(c.companyHelpLineEmail),
      companyPhone: str(c.companyPhone),
      companyUrl: str(c.companyUrl),
      companyLogoFileName: str(c.companyLogoFileName),
      companyAddressInformation: str(c.companyAddressInformation),
      linkToPolicy: str(c.linkToPolicy),
      companyActive: bool(c.companyActive),
      showCompanyEmail: bool(c.showCompanyEmail),
      showCompanyContactNumber: bool(c.showCompanyContactNumber),
      templatePreview: bool(c.templatePreview),
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
      backgroundImageUrl: str(c.backgroundImageUrl),
      formBackgroundColor: str(c.formBackgroundColor),
      trackingCode: str(c.trackingCode),
      companyStyleUrl: str(c.companyStyleUrl),
    },
    html: {
      bannerHtml: str(c.bannerHtml),
      companyFooterHtml: str(c.companyFooterHtml),
      companyCustomStyle: str(c.companyCustomStyle),
    },
    meta: {
      id: c.id || c.companyId,
      support_id: c.support_id,
      giftCardNumberLatest: str(c.giftCardNumberLatest),
      createdAtUtc: c.createdAtUtc,
      updatedAtUtc: c.updatedAtUtc,
    },
  };
}

function settingsToPayload(f: SettingsForm): Record<string, unknown> {
  const numOrNull = (v: string) => (v.trim() !== '' ? Number(v) : null);
  return {
    companyName: f.companyName,
    companyNumber: f.companyNumber,
    companyEmail: f.companyEmail,
    companyHelpLineEmail: f.companyHelpLineEmail,
    companyPhone: f.companyPhone,
    companyUrl: f.companyUrl,
    companyLogoFileName: f.companyLogoFileName,
    companyAddressInformation: f.companyAddressInformation,
    linkToPolicy: f.linkToPolicy,
    companyActive: f.companyActive ? 1 : 0,
    showCompanyEmail: f.showCompanyEmail ? 1 : 0,
    showCompanyContactNumber: f.showCompanyContactNumber ? 1 : 0,
    templatePreview: f.templatePreview ? 1 : 0,
    copyOfPdfGiftCardTo: f.copyOfPdfGiftCardTo,
    copyOfReceiptTo: f.copyOfReceiptTo,
    maximumMsgTextLimit: numOrNull(f.maximumMsgTextLimit),
    customerEmailTemplate: f.customerEmailTemplate,
    paymentPlatform: f.paymentPlatform,
    paymentTestMode: f.paymentTestMode ? 1 : 0,
    microdebSwishApiKey: f.microdebSwishApiKey,
    swedbankAuthToken: f.swedbankAuthToken,
    swedbankPayeeIdToken: f.swedbankPayeeIdToken,
    netsSecretApiKey: f.netsSecretApiKey,
    netsCheckoutKey: f.netsCheckoutKey,
    companyAmountJson: f.companyAmountJson,
    minimumAmountLimit: numOrNull(f.minimumAmountLimit),
    maximumAmountLimit: numOrNull(f.maximumAmountLimit),
    canSendHome: f.canSendHome ? 1 : 0,
    deliveryCharges: f.deliveryCharges || null,
    allowMultipleCards: f.allowMultipleCards ? 1 : 0,
    backgroundImageUrl: f.backgroundImageUrl,
    formBackgroundColor: f.formBackgroundColor,
    trackingCode: f.trackingCode,
    companyStyleUrl: f.companyStyleUrl,
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SwitchRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="space-y-0.5">
        <Label className="text-sm font-medium cursor-pointer">{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const EMPTY_SETTINGS: SettingsForm = {
  companyName: '', companyNumber: '', companyEmail: '', companyHelpLineEmail: '',
  companyPhone: '', companyUrl: '', companyLogoFileName: '', companyAddressInformation: '',
  linkToPolicy: '', companyActive: false, showCompanyEmail: false,
  showCompanyContactNumber: false, templatePreview: false, copyOfPdfGiftCardTo: '',
  copyOfReceiptTo: '', maximumMsgTextLimit: '', customerEmailTemplate: '',
  paymentPlatform: '', paymentTestMode: false, microdebSwishApiKey: '',
  swedbankAuthToken: '', swedbankPayeeIdToken: '', netsSecretApiKey: '',
  netsCheckoutKey: '', companyAmountJson: '', minimumAmountLimit: '',
  maximumAmountLimit: '', canSendHome: false, deliveryCharges: '',
  allowMultipleCards: false, backgroundImageUrl: '', formBackgroundColor: '',
  trackingCode: '', companyStyleUrl: '',
};

const EMPTY_HTML: HtmlForm = { bannerHtml: '', companyFooterHtml: '', companyCustomStyle: '' };

export default function WebsiteSettings() {
  const { toast } = useToast();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [companyMeta, setCompanyMeta] = useState<CompanyMeta | null>(null);

  const [htmlForm, setHtmlForm] = useState<HtmlForm>(EMPTY_HTML);
  const [htmlDirty, setHtmlDirty] = useState(false);
  const [isSavingHtml, setIsSavingHtml] = useState(false);

  const [settingsForm, setSettingsForm] = useState<SettingsForm>(EMPTY_SETTINGS);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [orderRef, setOrderRef] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [orderData, setOrderData] = useState<Record<string, unknown> | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyNumber, setNewCompanyNumber] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => { loadCompanies(); }, []);

  useEffect(() => {
    if (!selectedCompanyId || companies.length === 0) return;
    const company = companies.find((c) => (c.id || c.companyId) === selectedCompanyId);
    if (!company) return;
    const { settings, html, meta } = companyToForms(company);
    setSettingsForm(settings);
    setHtmlForm(html);
    setCompanyMeta(meta);
    setSettingsDirty(false);
    setHtmlDirty(false);
  }, [selectedCompanyId, companies]);

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

  async function handleCreateCompany(e: FormEvent) {
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

  function setS<K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) {
    setSettingsForm((prev) => ({ ...prev, [key]: value }));
    setSettingsDirty(true);
  }

  function setH<K extends keyof HtmlForm>(key: K, value: string) {
    setHtmlForm((prev) => ({ ...prev, [key]: value }));
    setHtmlDirty(true);
  }

  async function handleSaveHtml() {
    if (!selectedCompanyId) return;
    setIsSavingHtml(true);
    const result = await websiteSettingsService.updateCompany(selectedCompanyId, {
      bannerHtml: htmlForm.bannerHtml,
      companyFooterHtml: htmlForm.companyFooterHtml,
      companyCustomStyle: htmlForm.companyCustomStyle,
    });
    if (result.success) {
      toast({ title: 'Sparat', description: 'HTML & CSS har sparats.' });
      setHtmlDirty(false);
    } else {
      toast({ title: 'Fel', description: result.error, variant: 'destructive' });
    }
    setIsSavingHtml(false);
  }

  async function handleSaveSettings() {
    if (!selectedCompanyId) return;
    setIsSavingSettings(true);
    const result = await websiteSettingsService.updateCompany(
      selectedCompanyId,
      settingsToPayload(settingsForm)
    );
    if (result.success) {
      toast({ title: 'Sparat', description: 'Inställningarna har sparats.' });
      setSettingsDirty(false);
    } else {
      toast({ title: 'Fel', description: result.error, variant: 'destructive' });
    }
    setIsSavingSettings(false);
  }

  async function handleOrderSearch(e: FormEvent) {
    e.preventDefault();
    if (!orderRef.trim()) return;
    setIsSearching(true);
    setOrderData(null);
    setOrderError(null);
    const result = await websiteSettingsService.getOrderByRef(orderRef.trim());
    if (result.success) {
      setOrderData(result.data ?? {});
    } else {
      setOrderError(result.error ?? 'Hittades inte');
    }
    setIsSearching(false);
  }

  const cid = (c: Company) => c.id || c.companyId;
  const hasCompany = !!selectedCompanyId;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" />
            Webbplatsinställningar
          </h1>
          <p className="text-muted-foreground mt-1">
            Hantera HTML, CSS och inställningar för presentkortshemsidan
          </p>
        </div>

        {/* Company selector */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Välj företag</CardTitle>
            <CardDescription>Välj vilket företag du vill redigera</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingCompanies ? (
              <Skeleton className="h-10 w-64" />
            ) : (
              <div className="flex items-center gap-2">
                {companies.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Inga företag hittades</p>
                ) : (
                  <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                    <SelectTrigger className="w-full max-w-sm">
                      <SelectValue placeholder="Välj företag..." />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={cid(company)} value={cid(company)}>
                          {company.companyName || cid(company)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <Label htmlFor="new-company-name">Företagsnamn *</Label>
                  <Input
                    id="new-company-name"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    placeholder="Ange företagsnamn"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-company-number">Organisationsnummer</Label>
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

        {/* Tabs */}
        <Tabs defaultValue="installningar">
          <TabsList>
            <TabsTrigger value="installningar" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Inställningar
            </TabsTrigger>
            <TabsTrigger value="html-css" className="flex items-center gap-2">
              <Code2 className="h-4 w-4" />
              HTML & CSS
            </TabsTrigger>
            <TabsTrigger value="ordersok" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Ordersökning
            </TabsTrigger>
          </TabsList>

          {/* ── Inställningar tab ── */}
          <TabsContent value="installningar" className="mt-4 space-y-4">
            {!hasCompany ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Välj ett företag ovan
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Grunduppgifter */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Grunduppgifter</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Företagsnamn</Label>
                      <Input value={settingsForm.companyName} onChange={(e) => setS('companyName', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Organisationsnummer</Label>
                      <Input value={settingsForm.companyNumber} onChange={(e) => setS('companyNumber', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>E-postadress</Label>
                      <Input type="email" value={settingsForm.companyEmail} onChange={(e) => setS('companyEmail', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Support-e-post</Label>
                      <Input type="email" value={settingsForm.companyHelpLineEmail} onChange={(e) => setS('companyHelpLineEmail', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Telefon</Label>
                      <Input value={settingsForm.companyPhone} onChange={(e) => setS('companyPhone', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Hemsida (URL)</Label>
                      <Input type="url" value={settingsForm.companyUrl} onChange={(e) => setS('companyUrl', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Logotyp-URL</Label>
                      <Input value={settingsForm.companyLogoFileName} onChange={(e) => setS('companyLogoFileName', e.target.value)} placeholder="https://..." />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Länk till policy</Label>
                      <Input type="url" value={settingsForm.linkToPolicy} onChange={(e) => setS('linkToPolicy', e.target.value)} placeholder="https://..." />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Adressinformation</Label>
                      <Textarea
                        value={settingsForm.companyAddressInformation}
                        onChange={(e) => setS('companyAddressInformation', e.target.value)}
                        className="min-h-[80px]"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Synlighet & status */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Synlighet & status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <SwitchRow
                      label="Företaget aktivt"
                      description="Hemsidan är tillgänglig för besökare"
                      checked={settingsForm.companyActive}
                      onCheckedChange={(v) => setS('companyActive', v)}
                    />
                    <Separator />
                    <SwitchRow
                      label="Visa e-postadress"
                      description="Visa företagets e-post på hemsidan"
                      checked={settingsForm.showCompanyEmail}
                      onCheckedChange={(v) => setS('showCompanyEmail', v)}
                    />
                    <Separator />
                    <SwitchRow
                      label="Visa telefonnummer"
                      description="Visa telefonnumret på hemsidan"
                      checked={settingsForm.showCompanyContactNumber}
                      onCheckedChange={(v) => setS('showCompanyContactNumber', v)}
                    />
                    <Separator />
                    <SwitchRow
                      label="Förhandsgranskning av mall"
                      description="Aktivera mallförhandsgranskning"
                      checked={settingsForm.templatePreview}
                      onCheckedChange={(v) => setS('templatePreview', v)}
                    />
                  </CardContent>
                </Card>

                {/* E-post & notifikationer */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">E-post & notifikationer</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Kopia av PDF-presentkort till</Label>
                        <Input type="email" value={settingsForm.copyOfPdfGiftCardTo} onChange={(e) => setS('copyOfPdfGiftCardTo', e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Kopia av kvitto till</Label>
                        <Input type="email" value={settingsForm.copyOfReceiptTo} onChange={(e) => setS('copyOfReceiptTo', e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Max antal tecken i meddelande</Label>
                        <Input type="number" value={settingsForm.maximumMsgTextLimit} onChange={(e) => setS('maximumMsgTextLimit', e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>E-postmall till mottagare (HTML)</Label>
                      <Textarea
                        value={settingsForm.customerEmailTemplate}
                        onChange={(e) => setS('customerEmailTemplate', e.target.value)}
                        className="font-mono text-xs min-h-[180px] resize-y"
                        spellCheck={false}
                        placeholder="<p>Hej #NameOfReceiver# ...</p>"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Betalning */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Betalning</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5 max-w-sm">
                      <Label>Betalningsplattform</Label>
                      <p className="text-xs text-muted-foreground">JSON-format, t.ex. ["Only Nets Easy"]</p>
                      <Input
                        value={settingsForm.paymentPlatform}
                        onChange={(e) => setS('paymentPlatform', e.target.value)}
                        placeholder='["Only Nets Easy"]'
                      />
                    </div>
                    <SwitchRow
                      label="Testläge för betalning"
                      description="Inga riktiga transaktioner genomförs"
                      checked={settingsForm.paymentTestMode}
                      onCheckedChange={(v) => setS('paymentTestMode', v)}
                    />
                    <Separator />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Microdeb Swish API-nyckel</Label>
                        <Input
                          type="password"
                          autoComplete="off"
                          value={settingsForm.microdebSwishApiKey}
                          onChange={(e) => setS('microdebSwishApiKey', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Swedbank Auth Token</Label>
                        <Input
                          type="password"
                          autoComplete="off"
                          value={settingsForm.swedbankAuthToken}
                          onChange={(e) => setS('swedbankAuthToken', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Swedbank Payee ID Token</Label>
                        <Input
                          type="password"
                          autoComplete="off"
                          value={settingsForm.swedbankPayeeIdToken}
                          onChange={(e) => setS('swedbankPayeeIdToken', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Nets Secret API-nyckel</Label>
                        <Input
                          type="password"
                          autoComplete="off"
                          value={settingsForm.netsSecretApiKey}
                          onChange={(e) => setS('netsSecretApiKey', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Nets Checkout-nyckel</Label>
                        <Input
                          type="password"
                          autoComplete="off"
                          value={settingsForm.netsCheckoutKey}
                          onChange={(e) => setS('netsCheckoutKey', e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Belopp & leverans */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Belopp & leverans</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Minimibelopp (kr)</Label>
                        <Input type="number" value={settingsForm.minimumAmountLimit} onChange={(e) => setS('minimumAmountLimit', e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Maxbelopp (kr)</Label>
                        <Input type="number" value={settingsForm.maximumAmountLimit} onChange={(e) => setS('maximumAmountLimit', e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Fraktkostnad</Label>
                        <Input value={settingsForm.deliveryCharges} onChange={(e) => setS('deliveryCharges', e.target.value)} placeholder="0" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Tillgängliga belopp</Label>
                      <p className="text-xs text-muted-foreground">Ett belopp per rad</p>
                      <Textarea
                        value={settingsForm.companyAmountJson}
                        onChange={(e) => setS('companyAmountJson', e.target.value)}
                        className="font-mono text-sm min-h-[120px]"
                        placeholder={'250\n500\n1000\n2000'}
                      />
                    </div>
                    <Separator />
                    <SwitchRow
                      label="Kan skicka hem"
                      description="Tillåt hemleverans av presentkort"
                      checked={settingsForm.canSendHome}
                      onCheckedChange={(v) => setS('canSendHome', v)}
                    />
                    <Separator />
                    <SwitchRow
                      label="Tillåt flera kort"
                      description="Köparen kan beställa flera presentkort i samma order"
                      checked={settingsForm.allowMultipleCards}
                      onCheckedChange={(v) => setS('allowMultipleCards', v)}
                    />
                  </CardContent>
                </Card>

                {/* Utseende */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Utseende</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Bakgrundsbild (URL)</Label>
                        <Input value={settingsForm.backgroundImageUrl} onChange={(e) => setS('backgroundImageUrl', e.target.value)} placeholder="https://..." />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Formulärets bakgrundsfärg</Label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={settingsForm.formBackgroundColor || '#ffffff'}
                            onChange={(e) => setS('formBackgroundColor', e.target.value)}
                            className="h-10 w-12 cursor-pointer rounded border border-input bg-background p-0.5"
                          />
                          <Input
                            value={settingsForm.formBackgroundColor}
                            onChange={(e) => setS('formBackgroundColor', e.target.value)}
                            placeholder="#ffffff"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>CSS-fil (URL)</Label>
                        <Input value={settingsForm.companyStyleUrl} onChange={(e) => setS('companyStyleUrl', e.target.value)} placeholder="https://..." />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Spårningskod</Label>
                      <p className="text-xs text-muted-foreground">T.ex. Google Analytics eller Meta Pixel</p>
                      <Textarea
                        value={settingsForm.trackingCode}
                        onChange={(e) => setS('trackingCode', e.target.value)}
                        className="font-mono text-xs min-h-[100px] resize-y"
                        spellCheck={false}
                        placeholder="<!-- Tracking code -->"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Systeminfo – readonly */}
                {companyMeta && (
                  <Card className="border-dashed">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-muted-foreground">Systeminformation</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">ID</p>
                        <p className="font-mono text-xs break-all">{companyMeta.id}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Support-ID</p>
                        <p className="font-mono">{str(companyMeta.support_id) || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Senaste kortnummer</p>
                        <p className="font-mono">{companyMeta.giftCardNumberLatest || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Skapad</p>
                        <p>{companyMeta.createdAtUtc || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Senast uppdaterad</p>
                        <p>{companyMeta.updatedAtUtc || '—'}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex justify-end pb-2">
                  <Button onClick={handleSaveSettings} disabled={isSavingSettings || !settingsDirty}>
                    {isSavingSettings ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Spara inställningar
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* ── HTML & CSS tab ── */}
          <TabsContent value="html-css" className="mt-4 space-y-4">
            {!hasCompany ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Välj ett företag ovan
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid gap-4 xl:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Banner-HTML</CardTitle>
                      <CardDescription>HTML för bannern längst upp på sidan</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        value={htmlForm.bannerHtml}
                        onChange={(e) => setH('bannerHtml', e.target.value)}
                        className="font-mono text-xs min-h-[320px] resize-y"
                        placeholder="<!-- Banner HTML -->"
                        spellCheck={false}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Sidfot-HTML</CardTitle>
                      <CardDescription>HTML för sidfoten längst ned på sidan</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        value={htmlForm.companyFooterHtml}
                        onChange={(e) => setH('companyFooterHtml', e.target.value)}
                        className="font-mono text-xs min-h-[320px] resize-y"
                        placeholder="<!-- Sidfot HTML -->"
                        spellCheck={false}
                      />
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Anpassad CSS</CardTitle>
                    <CardDescription>Anpassad CSS-kod för företagets hemsida</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={htmlForm.companyCustomStyle}
                      onChange={(e) => setH('companyCustomStyle', e.target.value)}
                      className="font-mono text-xs min-h-[500px] resize-y"
                      placeholder="/* Anpassad CSS */"
                      spellCheck={false}
                    />
                  </CardContent>
                </Card>

                <div className="flex justify-end pb-2">
                  <Button onClick={handleSaveHtml} disabled={isSavingHtml || !htmlDirty}>
                    {isSavingHtml ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Spara HTML & CSS
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* ── Ordersökning tab ── */}
          <TabsContent value="ordersok" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sök order</CardTitle>
                <CardDescription>Slå upp en order med referensnummer</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleOrderSearch} className="flex gap-2">
                  <div className="flex-1 max-w-sm">
                    <Input
                      value={orderRef}
                      onChange={(e) => setOrderRef(e.target.value)}
                      placeholder="Ange referensnummer..."
                      disabled={isSearching}
                    />
                  </div>
                  <Button type="submit" disabled={isSearching || !orderRef.trim()}>
                    {isSearching ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Search className="h-4 w-4 mr-2" />
                    )}
                    Sök
                  </Button>
                </form>

                {orderError && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                    {orderError}
                  </div>
                )}

                {orderData && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                      Resultat
                    </Label>
                    <pre className="rounded-md bg-muted p-4 text-xs overflow-auto max-h-96 font-mono leading-relaxed">
                      {JSON.stringify(orderData, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
