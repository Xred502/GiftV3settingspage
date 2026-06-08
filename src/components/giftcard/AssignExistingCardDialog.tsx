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
import { Loader2 } from 'lucide-react';

interface AssignExistingCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssign: (cardNumber: string) => Promise<void>;
  isLoading?: boolean;
  customerName: string;
  accountId: string;
}

export default function AssignExistingCardDialog({
  open,
  onOpenChange,
  onAssign,
  isLoading,
  customerName,
  accountId,
}: AssignExistingCardDialogProps) {
  const [cardNumber, setCardNumber] = useState('');

  useEffect(() => {
    if (!open) {
      setCardNumber('');
    }
  }, [open]);

  const normalizedCardNumber = cardNumber.replace(/\D+/g, '');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!normalizedCardNumber) return;
    await onAssign(normalizedCardNumber);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Koppla befintligt kort</DialogTitle>
          <DialogDescription>
            Koppla ett redan existerande kortnummer till {customerName || 'kortinnehavaren'}.
            Konto-ID: {accountId || '-'}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Endast kortnummer som redan finns i databasen och som inte redan är kopplade till ett annat konto kan användas.
            </div>
            <div className="space-y-2">
              <Label htmlFor="assign-card-number">Kortnummer</Label>
              <Input
                id="assign-card-number"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Ange befintligt kortnummer"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
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
            <Button type="submit" disabled={isLoading || !normalizedCardNumber}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Kopplar...
                </>
              ) : (
                'Koppla kort'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
