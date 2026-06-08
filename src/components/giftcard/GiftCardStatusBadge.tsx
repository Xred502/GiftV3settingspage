import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface GiftCardStatusBadgeProps {
  status: 'active' | 'blocked' | 'expired';
}

export default function GiftCardStatusBadge({ status }: GiftCardStatusBadgeProps) {
  const statusConfig = {
    active: {
      label: 'Aktiv',
      className: 'bg-success text-success-foreground hover:bg-success/80',
    },
    blocked: {
      label: 'Spärrad',
      className: 'bg-destructive text-destructive-foreground hover:bg-destructive/80',
    },
    expired: {
      label: 'Utgången',
      className: 'bg-warning text-warning-foreground hover:bg-warning/80',
    },
  };

  const config = statusConfig[status];

  return (
    <Badge className={cn(config.className)}>
      {config.label}
    </Badge>
  );
}




