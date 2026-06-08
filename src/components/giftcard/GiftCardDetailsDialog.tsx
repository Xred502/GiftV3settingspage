import { ReactNode, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { GiftCardDetails, RetailstoreOption } from '@/types/giftcard';
import { giftcardService, formatCurrency } from '@/services/giftcardService';
import GiftCardStatusBadge from './GiftCardStatusBadge';
import TransactionList from './TransactionList';
import DepositDialog from './DepositDialog';
import {
  AlertTriangle,
  Calendar,
  History,
  Loader2,
  Lock,
  Pencil,
  Save,
  Unlock,
  User,
  Wallet,
  X,
} from 'lucide-react';

interface GiftCardDetailsDialogProps {
  cardNumber: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  headerActions?: ReactNode;
}

function normalizeCustomerValue(value?: string) {
  if (!value) return '';
  const trimmed = String(value).trim();
  if (!trimmed || trimmed === '&nbsp;' || trimmed === '\u00a0') return '';
  return trimmed;
}

export default function GiftCardDetailsDialog({
  cardNumber,
  open,
  onOpenChange,
  headerActions,
}: GiftCardDetailsDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [giftCard, setGiftCard] = useState<GiftCardDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditingExpiry, setIsEditingExpiry] = useState(false);
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [isSavingExpiry, setIsSavingExpiry] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [retailstores, setRetailstores] = useState<RetailstoreOption[]>([]);
  const [isLoadingRetailstores, setIsLoadingRetailstores] = useState(false);
  const [retailstoresError, setRetailstoresError] = useState<string | null>(null);

  useEffect(() => {
    if (open && cardNumber) {
      loadDetails(cardNumber);
    }
    if (!open) {
      setGiftCard(null);
      setError(null);
      setIsEditingExpiry(false);
      setNewExpiryDate('');
      setIsDepositOpen(false);
      setIsBlockDialogOpen(false);
      setRetailstores([]);
      setRetailstoresError(null);
      setIsLoadingRetailstores(false);
    }
  }, [open, cardNumber]);

  useEffect(() => {
    if (!giftCard?.accountId || !open) return;
    loadRetailstores(giftCard.accountId);
  }, [giftCard?.accountId, open]);

  const loadRetailstores = async (accountId: string) => {
    setIsLoadingRetailstores(true);
    setRetailstoresError(null);
    const result = await giftcardService.getRetailstores(accountId);
    if (result.success && result.data) {
      setRetailstores(result.data);
    } else {
      setRetailstores([]);
      setRetailstoresError(result.error || 'Kunde inte hämta butiker');
    }
    setIsLoadingRetailstores(false);
  };

  const loadDetails = async (identifier: string) => {
    setIsLoading(true);
    setError(null);
    const result = await giftcardService.getGiftCardDetails(identifier);
    if (result.success && result.data) {
      setGiftCard(result.data);
    } else {
      setError(result.error || 'Kunde inte hämta kortinformation');
    }
    setIsLoading(false);
  };

  const handleEditExpiry = () => {
    if (giftCard?.expiresAt) {
      setNewExpiryDate(format(new Date(giftCard.expiresAt), 'yyyy-MM-dd'));
    } else {
      setNewExpiryDate('');
    }
    setIsEditingExpiry(true);
  };

  const handleSaveExpiry = async () => {
    if (!cardNumber || !newExpiryDate || !giftCard) return;
    setIsSavingExpiry(true);
    const identifier = giftCard.cardNumber || cardNumber;
    const result = await giftcardService.updateExpiry(identifier, newExpiryDate);
    if (result.success) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const nextExpiry = new Date(`${newExpiryDate}T00:00:00`);
      const nextStatus = giftCard.status === 'blocked'
        ? 'blocked'
        : nextExpiry >= today
          ? 'active'
          : 'expired';
      setGiftCard({ ...giftCard, expiresAt: `${newExpiryDate}T00:00:00`, status: nextStatus });
      toast({ title: 'Uppdaterat', description: 'Utgångsdatumet har ändrats.' });
      setIsEditingExpiry(false);
    } else {
      toast({ title: 'Fel', description: result.error || 'Kunde inte uppdatera utgångsdatum', variant: 'destructive' });
    }
    setIsSavingExpiry(false);
  };

  const handleDeposit = async (amountInKronor: number, terminalId: string) => {
    if (!cardNumber || !giftCard) return;
    if (!terminalId) {
      toast({
        title: 'Ingen terminal vald',
        description: 'Välj en butik/terminal innan du genomför transaktionen.',
        variant: 'destructive',
      });
      return;
    }

    const identifier = giftCard.cardNumber || cardNumber;
    const isWithdrawal = amountInKronor < 0;
    const absAmount = Math.abs(amountInKronor);
    if (absAmount <= 0) return;

    setIsActionLoading(true);
    const amountInOre = Math.round(absAmount * 100) * (isWithdrawal ? -1 : 1);
    const result = await giftcardService.deposit(identifier, amountInOre, terminalId, user?.username, giftCard.accountId);
    if (result.success) {
      toast({
        title: isWithdrawal ? 'Uttag genomfört' : 'Insättning genomförd',
        description: `${absAmount} kr har ${isWithdrawal ? 'dragits av från' : 'satts in på'} kortet.`,
      });
      setIsDepositOpen(false);
      await loadDetails(identifier);
    } else {
      toast({
        title: isWithdrawal ? 'Uttag misslyckades' : 'Insättning misslyckades',
        description: result.error,
        variant: 'destructive',
      });
    }
    setIsActionLoading(false);
  };

  const handleBlockToggle = async () => {
    if (!cardNumber || !giftCard) return;
    setIsActionLoading(true);
    const identifier = giftCard.cardNumber || cardNumber;
    const action = giftCard.status === 'blocked' ? giftcardService.unblockCard : giftcardService.blockCard;
    const result = await action(identifier);

    if (result.success) {
      toast({
        title: giftCard.status === 'blocked' ? 'Spärr hävd' : 'Kort spärrat',
        description: giftCard.status === 'blocked'
          ? 'Kortet är nu aktivt igen.'
          : 'Kortet har spärrats.',
      });
      setIsBlockDialogOpen(false);
      await loadDetails(identifier);
    } else {
      toast({ title: 'Åtgärd misslyckades', description: result.error, variant: 'destructive' });
    }
    setIsActionLoading(false);
  };

  const customer = giftCard?.customer;
  const customerName = customer
    ? [customer.firstName, customer.lastName].filter((value) => normalizeCustomerValue(value)).join(' ').trim()
    : '';
  const customerEmail = customer ? normalizeCustomerValue(customer.email) : '';
  const customerFields = customer
    ? [
      { label: 'E-post', value: customerEmail },
      { label: 'Adress', value: normalizeCustomerValue(customer.street) },
      { label: 'Ort', value: normalizeCustomerValue(customer.city) },
      { label: 'Postnummer', value: normalizeCustomerValue(customer.postalcode) },
      { label: 'Land', value: normalizeCustomerValue(customer.country) },
      { label: 'Bolag', value: normalizeCustomerValue(customer.company) },
      { label: 'Telefon 1', value: normalizeCustomerValue(customer.phone1) },
      { label: 'Telefon 2', value: normalizeCustomerValue(customer.phone2) },
    ]
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full max-w-4xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-start justify-between gap-3 pr-10">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <span className="font-mono">{cardNumber}</span>
              {giftCard && <GiftCardStatusBadge status={giftCard.status} />}
            </div>
            {giftCard && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {headerActions}
                <Button
                  size="sm"
                  variant={giftCard.status === 'blocked' ? 'outline' : 'destructive'}
                  onClick={() => setIsBlockDialogOpen(true)}
                  disabled={isActionLoading}
                  className="h-8 rounded-none border-2 border-black px-3"
                >
                  {giftCard.status === 'blocked' ? (
                  <>
                    <Unlock className="mr-2 h-4 w-4" />
                    Häv spärr
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Spärra kort
                  </>
                  )}
                </Button>
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
            <Skeleton className="h-48" />
          </div>
        ) : error ? (
          <div className="py-8 text-center text-muted-foreground">{error}</div>
        ) : giftCard ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Kund</CardTitle>
                  <User className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {customer ? (
                    <div className="space-y-3">
                      <div className="font-semibold">{customerName || '-'}</div>
                      <div className="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-3">
                        {customerFields.map((field) => {
                          const displayValue = field.value || '-';
                          const isEmpty = displayValue === '-';
                          return (
                            <div key={field.label} className="rounded-md border bg-muted/30 p-2">
                              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{field.label}</div>
                              <div className={`mt-1 break-words whitespace-normal text-sm ${isEmpty ? 'text-muted-foreground' : ''}`}>
                                {displayValue}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">Kortinnehavare saknas</div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Saldo</CardTitle>
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">{formatCurrency(giftCard.balance)}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => setIsDepositOpen(true)}
                        disabled={giftCard.status === 'blocked' || isActionLoading}
                        title="Justera saldo"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Utgångsdatum</CardTitle>
                    <Calendar className="h-4 w-4 text-foreground/80" />
                  </CardHeader>
                  <CardContent>
                    {isEditingExpiry ? (
                      <div className="space-y-2">
                        <DateInput
                          value={newExpiryDate}
                          onChange={(event) => setNewExpiryDate(event.target.value)}
                          className="h-8 text-sm"
                        />
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 gap-1 text-xs"
                            onClick={handleSaveExpiry}
                            disabled={isSavingExpiry || !newExpiryDate}
                          >
                            {isSavingExpiry ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                            Spara
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1 text-xs"
                            onClick={() => setIsEditingExpiry(false)}
                            disabled={isSavingExpiry}
                          >
                            <X className="h-3 w-3" />
                            Avbryt
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold">
                          {giftCard.expiresAt ? format(new Date(giftCard.expiresAt), 'yyyy-MM-dd', { locale: sv }) : '-'}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={handleEditExpiry}
                          title="Ändra utgångsdatum"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="h-4 w-4" />
                  Transaktionshistorik
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TransactionList transactions={giftCard.transactions} />
              </CardContent>
            </Card>
          </div>
        ) : null}
      </DialogContent>

      <DepositDialog
        open={isDepositOpen}
        onOpenChange={setIsDepositOpen}
        onDeposit={handleDeposit}
        isLoading={isActionLoading}
        retailstores={retailstores}
        isLoadingRetailstores={isLoadingRetailstores}
        retailstoresError={retailstoresError}
      />

      <AlertDialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              {giftCard?.status === 'blocked' ? 'Häv spärr?' : 'Spärra kort?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {giftCard?.status === 'blocked'
                ? 'Kortet kommer att aktiveras och kan användas igen.'
                : 'Kortet kommer att spärras och kan inte användas förrän spärren hävs.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActionLoading}>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBlockToggle}
              disabled={isActionLoading}
              className={giftCard?.status !== 'blocked' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {giftCard?.status === 'blocked' ? 'Häv spärr' : 'Spärra'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
