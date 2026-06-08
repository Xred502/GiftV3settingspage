import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2 } from 'lucide-react';

interface GiftCardSearchProps {
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: (query: string) => void;
  isLoading?: boolean;
}

export default function GiftCardSearch({ query, onQueryChange, onSearch, isLoading }: GiftCardSearchProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) onSearch(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Sök på kortnummer, kund eller email..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="pl-10"
          disabled={isLoading}
        />
      </div>
      <Button type="submit" disabled={isLoading || !query.trim()}>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          'Sök'
        )}
      </Button>
    </form>
  );
}






