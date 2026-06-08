import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

import { cn } from '@/lib/utils';

interface SortableTableHeaderButtonProps {
  label: string;
  active: boolean;
  direction?: 'asc' | 'desc';
  onClick: () => void;
  className?: string;
}

export function SortableTableHeaderButton({
  label,
  active,
  direction = 'desc',
  onClick,
  className,
}: SortableTableHeaderButtonProps) {
  const Icon = !active ? ArrowUpDown : direction === 'asc' ? ArrowUp : ArrowDown;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-left font-medium transition-colors',
        active
          ? 'border-border bg-accent text-foreground shadow-sm'
          : 'border-transparent text-muted-foreground hover:border-border/60 hover:bg-muted/80 hover:text-foreground',
        className,
      )}
      aria-pressed={active}
    >
      <span>{label}</span>
      <Icon className={cn('h-3.5 w-3.5 shrink-0', !active && 'opacity-55')} />
    </button>
  );
}
