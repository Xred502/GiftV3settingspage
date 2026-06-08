import { useState } from 'react';
import { GiftCardTransaction } from '@/types/giftcard';
import { formatCurrency } from '@/services/giftcardService';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ExternalLink, Loader2 } from 'lucide-react';
import { reportService } from '@/services/reportService';
import { useToast } from '@/hooks/use-toast';

interface TransactionListProps {
  transactions: GiftCardTransaction[];
}

const RECEIPT_BASE_URL = 'https://www.dittkort.se/receipt/?guid=';

export default function TransactionList({ transactions }: TransactionListProps) {
  const { toast } = useToast();
  const [loadingReceiptId, setLoadingReceiptId] = useState<string | null>(null);

  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Inga transaktioner hittades
      </div>
    );
  }

  async function handleReceiptClick(transactionId: string) {
    setLoadingReceiptId(transactionId);
    try {
      const result = await reportService.getReceiptGuid(transactionId);
      if (result.success && result.guid) {
        window.open(`${RECEIPT_BASE_URL}${result.guid}`, '_blank');
      } else {
        toast({ title: 'Fel', description: result.error || 'Kunde inte hämta kvitto', variant: 'destructive' });
      }
    } finally {
      setLoadingReceiptId(null);
    }
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="max-h-[360px] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Datum</TableHead>
              <TableHead>Beskrivning</TableHead>
              <TableHead className="text-right">Belopp</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell className="text-muted-foreground">
                  {tx.date
                    ? format(new Date(tx.date), 'yyyy-MM-dd HH:mm', { locale: sv })
                    : '-'
                  }
                </TableCell>
                <TableCell>
                  {tx.description || '-'}
                </TableCell>
                <TableCell className={cn(
                  'text-right font-semibold',
                  tx.amount > 0 ? 'text-success' : 'text-destructive'
                )}>
                  {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                </TableCell>
                <TableCell>
                  {tx.receiptId && (
                    <button
                      disabled={loadingReceiptId === tx.id}
                      onClick={() => handleReceiptClick(tx.id)}
                      className="text-primary hover:text-primary/80 transition-colors"
                      title="Visa kvitto"
                    >
                      {loadingReceiptId === tx.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ExternalLink className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}



