import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import GiftCardStatusBadge from '@/components/giftcard/GiftCardStatusBadge';
import TransactionList from '@/components/giftcard/TransactionList';
import DepositDialog from '@/components/giftcard/DepositDialog';
import { GiftCardDetails as GiftCardDetailsType, RetailstoreOption } from '@/types/giftcard';
import { giftcardService, formatCurrency } from '@/services/giftcardService';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DateInput } from '@/components/ui/date-input';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, 
  CreditCard, 
  User, 
  Calendar, 
  Wallet,
  Lock,
  Unlock,
  Plus,
  History,
  AlertTriangle,
  Pencil,
  Save,
  X,
  Loader2
} from 'lucide-react';
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

export default function GiftCardDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [giftCard, setGiftCard] = useState<GiftCardDetailsType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [retailstores, setRetailstores] = useState<RetailstoreOption[]>([]);
  const [isLoadingRetailstores, setIsLoadingRetailstores] = useState(false);
  const [retailstoresError, setRetailstoresError] = useState<string | null>(null);
  const [isEditingExpiry, setIsEditingExpiry] = useState(false);
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [isSavingExpiry, setIsSavingExpiry] = useState(false);

  useEffect(() => {
    if (id) {
      loadGiftCard(id);
    }
  }, [id]);

  useEffect(() => {
    if (giftCard?.accountId) {
      loadRetailstores(giftCard.accountId);
    }
  }, [giftCard?.accountId]);

  useEffect(() => {
    if (giftCard) {
      setIsEditingExpiry(false);
      setIsSavingExpiry(false);
    }
  }, [giftCard]);

  const loadGiftCard = async (cardId: string) => {
    setIsLoading(true);
    const result = await giftcardService.getGiftCardDetails(cardId);
    
    if (result.success && result.data) {
      setGiftCard(result.data);
    } else {
      toast({
        title: 'Kunde inte hämta kortinformation',
        description: result.error,
        variant: 'destructive',
      });
      navigate('/giftcards');
    }
    
    setIsLoading(false);
  };

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

  const handleEditExpiry = () => {
    if (giftCard?.expiresAt) {
      setNewExpiryDate(format(new Date(giftCard.expiresAt), 'yyyy-MM-dd', { locale: sv }));
    } else {
      setNewExpiryDate('');
    }
    setIsEditingExpiry(true);
  };

  const handleSaveExpiry = async () => {
    if (!id || !giftCard || !newExpiryDate) return;
    setIsSavingExpiry(true);
    const result = await giftcardService.updateExpiry(giftCard.cardNumber || id, newExpiryDate);
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
      toast({
        title: 'Uppdaterat',
        description: 'Utgångsdatumet har ändrats.',
      });
      setIsEditingExpiry(false);
    } else {
      toast({
        title: 'Fel',
        description: result.error || 'Kunde inte uppdatera utgångsdatum',
        variant: 'destructive',
      });
    }
    setIsSavingExpiry(false);
  };

  const handleDeposit = async (amountInKronor: number, terminalId: string) => {
    if (!id || !giftCard) return;
    if (!terminalId) {
      toast({
        title: 'Ingen terminal vald',
        description: 'Välj en butik/terminal innan du genomför transaktionen.',
        variant: 'destructive',
      });
      return;
    }

    const identifier = giftCard.cardNumber || id;
    const isWithdrawal = amountInKronor < 0;
    const absAmount = Math.abs(amountInKronor);
    if (absAmount <= 0) return;

    setIsActionLoading(true);
    const amountInOre = Math.round(absAmount * 100) * (isWithdrawal ? -1 : 1);
    const result = await giftcardService.deposit(identifier, amountInOre, terminalId, user?.username, giftCard.accountId);

    if (result.success) {
      toast({
        title: isWithdrawal ? 'Uttag genomfört' : 'Insättning genomförd',
        description: `${absAmount} kr har ${isWithdrawal ? 'dragits av från' : 'satts in på'} kortet`,
      });
      setIsDepositOpen(false);
      loadGiftCard(id);
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
    if (!id || !giftCard) return;
    
    setIsActionLoading(true);
    const action = giftCard.status === 'blocked' 
      ? giftcardService.unblockCard 
      : giftcardService.blockCard;
    
    const identifier = giftCard.cardNumber || id;
    const result = await action(identifier);
    
    if (result.success) {
      toast({
        title: giftCard.status === 'blocked' ? 'Spärr hävd' : 'Kort spärrat',
        description: giftCard.status === 'blocked' 
          ? 'Kortet är nu aktivt igen' 
          : 'Kortet har spärrats',
      });
      setIsBlockDialogOpen(false);
      loadGiftCard(id);
    } else {
      toast({
        title: 'Åtgärd misslyckades',
        description: result.error,
        variant: 'destructive',
      });
    }
    
    setIsActionLoading(false);
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </MainLayout>
    );
  }

  if (!giftCard) {
    return null;
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
              <span className="font-mono">{giftCard.cardNumber}</span>
              <GiftCardStatusBadge status={giftCard.status} />
            </h1>
            <p className="text-muted-foreground">
              Konto-ID: {giftCard.accountId}
            </p>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Balance */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Saldo
              </CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {formatCurrency(giftCard.balance)}
              </div>
            </CardContent>
          </Card>

          {/* Expiry */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Utgångsdatum
              </CardTitle>
              <Calendar className="h-4 w-4 text-foreground/80" />
            </CardHeader>
            <CardContent>
              {isEditingExpiry ? (
                <div className="space-y-2">
                  <DateInput
                    value={newExpiryDate}
                    onChange={(e) => setNewExpiryDate(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <div className="flex gap-2">
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
                  <span className="text-2xl font-semibold">
                    {giftCard.expiresAt
                      ? format(new Date(giftCard.expiresAt), 'yyyy-MM-dd', { locale: sv })
                      : '-'
                    }
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={handleEditExpiry}
                    title="Ändra utgångsdatum"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customer */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Kund
              </CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {giftCard.customer ? (
                <div>
                  <div className="font-semibold">
                    {giftCard.customer.firstName} {giftCard.customer.lastName}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {giftCard.customer.email}
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground">Ingen kund kopplad</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Åtgärder</CardTitle>
            <CardDescription>
              Utför operationer på presentkortet
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button onClick={() => setIsDepositOpen(true)} disabled={giftCard.status === 'blocked'}>
              <Plus className="h-4 w-4 mr-2" />
              Justera saldo
            </Button>
            
            <Button 
              variant={giftCard.status === 'blocked' ? 'outline' : 'destructive'}
              onClick={() => setIsBlockDialogOpen(true)}
            >
              {giftCard.status === 'blocked' ? (
                <>
                  <Unlock className="h-4 w-4 mr-2" />
                  Häv spärr
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Spärra kort
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Transaktionshistorik
            </CardTitle>
            <CardDescription>
              Alla transaktioner för detta presentkort
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TransactionList transactions={giftCard.transactions} />
          </CardContent>
        </Card>
      </div>

      {/* Deposit Dialog */}
      <DepositDialog
        open={isDepositOpen}
        onOpenChange={setIsDepositOpen}
        onDeposit={handleDeposit}
        isLoading={isActionLoading}
        retailstores={retailstores}
        isLoadingRetailstores={isLoadingRetailstores}
        retailstoresError={retailstoresError}
      />

      {/* Block Confirmation Dialog */}
      <AlertDialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              {giftCard.status === 'blocked' ? 'Häv spärr?' : 'Spärra kort?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {giftCard.status === 'blocked' 
                ? 'Kortet kommer att aktiveras och kan användas igen.'
                : 'Kortet kommer att spärras och kan inte användas förrän spärren hävs.'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActionLoading}>Avbryt</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBlockToggle}
              disabled={isActionLoading}
              className={giftCard.status !== 'blocked' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {giftCard.status === 'blocked' ? 'Häv spärr' : 'Spärra'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}











