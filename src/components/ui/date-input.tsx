import * as React from 'react';
import { Calendar } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type DateInputProps = React.ComponentProps<typeof Input>;

export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ className, onClick, ...props }, forwardedRef) => {
    const innerRef = React.useRef<HTMLInputElement | null>(null);

    React.useImperativeHandle(forwardedRef, () => innerRef.current as HTMLInputElement, []);

    const setRefs = (node: HTMLInputElement | null) => {
      innerRef.current = node;
      if (typeof forwardedRef === 'function') {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    };

    const openPicker = () => {
      const input = innerRef.current;
      if (!input) return;
      if (typeof input.showPicker === 'function') {
        input.showPicker();
        return;
      }
      input.focus();
      input.click();
    };

    return (
      <div className="date-input-wrapper relative">
        <Input
          {...props}
          ref={setRefs}
          type="date"
          className={cn('date-input-control appearance-none pr-11', className)}
          onClick={(event) => {
            onClick?.(event);
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          tabIndex={-1}
          className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-foreground/80 hover:text-foreground"
          onClick={openPicker}
          aria-label="Välj datum"
        >
          <Calendar className="h-4 w-4" />
        </Button>
      </div>
    );
  },
);

DateInput.displayName = 'DateInput';
