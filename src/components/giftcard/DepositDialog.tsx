import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import type { RetailstoreOption } from '@/types/giftcard';

interface DepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeposit: (amountInKronor: number, terminalId: string) => Promise<void>;
  isLoading?: boolean;
  retailstores?: RetailstoreOption[];
  isLoadingRetailstores?: boolean;
  retailstoresError?: string | null;
}

export default function DepositDialog({ 
  open, 
  onOpenChange, 
  onDeposit, 
  isLoading, 
  retailstores, 
  isLoadingRetailstores, 
  retailstoresError, 
}: DepositDialogProps) {
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [selectedRetailstoreId, setSelectedRetailstoreId] = useState<string>('');

  const storeOptions = retailstores || [];
  const selectedStore = storeOptions.find((store) => store.id === selectedRetailstoreId) || storeOptions[0];
  const defaultWorkstation = selectedStore?.workstations?.find((ws) => ws.isDefault) || selectedStore?.workstations?.[0];
  const terminalId = selectedStore?.defaultTerminalId || defaultWorkstation?.terminalId || '';

  useEffect(() => {
    if (!open) return;
    if (selectedRetailstoreId) return;
    if (storeOptions.length > 0) {
      setSelectedRetailstoreId(storeOptions[0].id);
    }
  }, [open, storeOptions, selectedRetailstoreId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    
    if (isNaN(numAmount) || numAmount <= 0) {
      return;
    }
    
    if (!terminalId) {
      return;
    }

    const signedAmount = mode === 'withdraw' ? -numAmount : numAmount;
    await onDeposit(signedAmount, terminalId);
    setAmount('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Justera saldo</DialogTitle>
          <DialogDescription>
            Välj insättning eller uttag och ange belopp i kronor
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Butik</Label>
              {isLoadingRetailstores ? (
                <div className="text-sm text-muted-foreground">Hämtar butiker...</div>
              ) : storeOptions.length === 0 ? (
                <div className="text-sm text-destructive">{retailstoresError || 'Inga butiker hittades för kortet'}</div>
              ) : (
                <Select value={selectedStore?.id || ''} onValueChange={setSelectedRetailstoreId} disabled={isLoading}>
                  <SelectTrigger>
                    <SelectValue placeholder="Välj butik" />
                  </SelectTrigger>
                  <SelectContent>
                    {storeOptions.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {selectedStore && terminalId && (
                <div className="text-xs text-muted-foreground">Terminal: {defaultWorkstation?.name || terminalId}</div>
              )}
              {selectedStore && !terminalId && (
                <div className="text-xs text-destructive">Ingen terminal kopplad till vald butik.</div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Typ</Label>
              <Select value={mode} onValueChange={(val) => setMode(val as 'deposit' | 'withdraw')} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">Sätt in (+)</SelectItem>
                  <SelectItem value="withdraw">Dra av (-)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Belopp (SEK)</Label>
              <Input
                id="amount"
                type="number"
                min="1"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Avbryt
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading || !terminalId || !amount || parseFloat(amount) <= 0}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Behandlar...
                </>
              ) : (
                mode === 'withdraw' ? 'Dra av' : 'Sätt in'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}













