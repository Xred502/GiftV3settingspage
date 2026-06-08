import { Link } from 'react-router-dom';
import { GiftCard } from '@/types/giftcard';
import { formatCurrency } from '@/services/giftcardService';
import GiftCardStatusBadge from './GiftCardStatusBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Eye, CreditCard } from 'lucide-react';
import { SortableTableHeaderButton } from '@/components/ui/sortable-table-header-button';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

interface GiftCardListProps {
  giftCards: GiftCard[];
  isLoading?: boolean;
  totalCount?: number | null;
  sortBy?: GiftCardSortKey;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: GiftCardSortKey) => void;
}

type GiftCardSortKey =
  | 'cardNumber'
  | 'balance'
  | 'status'
  | 'expiresAt'
  | 'firstTransactionDate'
  | 'lastTransactionDate';

function formatDate(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '-';
  return format(date, 'yyyy-MM-dd', { locale: sv });
}

function getLastTransactionLabel(card: GiftCard): string {
  return card.lastTransactionTitle || card.lastTransactionType || '-';
}

export default function GiftCardList({ giftCards, isLoading, totalCount, sortBy, sortDir, onSort }: GiftCardListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span>Laddar presentkort...</span>
        </div>
      </div>
    );
  }

  if (giftCards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">Inga presentkort hittades</h3>
        <p className="text-muted-foreground mt-1">
          Sök efter kortnummer, kund eller email för att hitta presentkort
        </p>
      </div>
    );
  }

  const headerClass = onSort ? 'p-2' : '';

  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground">
        Antal kort: {totalCount ?? giftCards.length}
      </div>
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={headerClass}>
                <SortableTableHeaderButton
                  label="Kortnummer"
                  active={sortBy === 'cardNumber'}
                  direction={sortDir}
                  onClick={() => onSort?.('cardNumber')}
                />
              </TableHead>
              <TableHead className={headerClass}>
                <SortableTableHeaderButton
                  label="Saldo"
                  active={sortBy === 'balance'}
                  direction={sortDir}
                  onClick={() => onSort?.('balance')}
                />
              </TableHead>
              <TableHead className={headerClass}>
                <SortableTableHeaderButton
                  label="Status"
                  active={sortBy === 'status'}
                  direction={sortDir}
                  onClick={() => onSort?.('status')}
                />
              </TableHead>
              <TableHead className={headerClass}>
                <SortableTableHeaderButton
                  label="Utgångsdatum"
                  active={sortBy === 'expiresAt'}
                  direction={sortDir}
                  onClick={() => onSort?.('expiresAt')}
                />
              </TableHead>
              <TableHead className={headerClass}>
                <SortableTableHeaderButton
                  label="Inköpsdatum"
                  active={sortBy === 'firstTransactionDate'}
                  direction={sortDir}
                  onClick={() => onSort?.('firstTransactionDate')}
                />
              </TableHead>
              <TableHead className={headerClass}>
                <SortableTableHeaderButton
                  label="Senaste transaktion"
                  active={sortBy === 'lastTransactionDate'}
                  direction={sortDir}
                  onClick={() => onSort?.('lastTransactionDate')}
                />
              </TableHead>
              <TableHead className="text-right">Åtgärder</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {giftCards.map((card) => (
              <TableRow
                key={card.id}
                className="cursor-pointer hover:bg-accent/70 hover:shadow-[inset_0_0_0_1px_hsl(var(--ring)/0.18)]"
              >
                <TableCell className="font-mono font-semibold text-foreground">
                  {card.cardNumber}
                </TableCell>
                <TableCell className="font-semibold">
                  {formatCurrency(card.balance)}
                </TableCell>
                <TableCell>
                  <GiftCardStatusBadge status={card.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(card.expiresAt)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(card.firstTransactionDate)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <div>{formatDate(card.lastTransactionDate)}</div>
                  <div className="text-xs text-muted-foreground">{getLastTransactionLabel(card)}</div>
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="ghost" size="sm">
                    <Link to={`/giftcard/${card.id}`}>
                      <Eye className="h-4 w-4 mr-2" />
                      Visa
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}






