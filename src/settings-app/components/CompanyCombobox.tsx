import { useState } from 'react';
import { Check, ChevronsUpDown, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import type { Company } from '@/services/websiteSettingsService';

interface Props {
  companies: Company[];
  value: string;
  onValueChange: (id: string) => void;
}

export default function CompanyCombobox({ companies, value, onValueChange }: Props) {
  const [open, setOpen] = useState(false);
  const selected = companies.find((c) => (c.id || c.companyId) === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full max-w-sm justify-between h-10 font-normal"
        >
          <span className="flex items-center gap-2 min-w-0">
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {selected ? selected.companyName : 'Välj företag...'}
            </span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Sök företag..." />
          <CommandList>
            <CommandEmpty>Inga företag hittades.</CommandEmpty>
            <CommandGroup>
              {companies.map((c) => {
                const id = c.id || c.companyId;
                const active = c.companyActive === true || c.companyActive === 1;
                return (
                  <CommandItem
                    key={id}
                    value={`${c.companyName} ${c.companyNumber ?? ''}`}
                    onSelect={() => { onValueChange(id); setOpen(false); }}
                    className="flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <Check className={cn('h-4 w-4 shrink-0', value === id ? 'opacity-100' : 'opacity-0')} />
                      <span>
                        <span className="font-medium">{c.companyName}</span>
                        {c.companyNumber && (
                          <span className="ml-1.5 text-xs text-muted-foreground">{c.companyNumber}</span>
                        )}
                      </span>
                    </span>
                    <Badge variant={active ? 'default' : 'secondary'} className="text-[10px] h-4 shrink-0">
                      {active ? 'Aktiv' : 'Inaktiv'}
                    </Badge>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
