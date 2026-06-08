import { AlertCircle, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  savedAt: string;
  onRestore: () => void;
  onDismiss: () => void;
}

export default function DraftBanner({ savedAt, onRestore, onDismiss }: Props) {
  const date = new Date(savedAt);
  const formatted = date.toLocaleString('sv-SE', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="flex items-center gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
      <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
      <span className="flex-1">Du har ett osparat utkast från <strong>{formatted}</strong>.</span>
      <Button size="sm" variant="outline" className="h-7 gap-1.5 border-amber-300 text-amber-800 hover:bg-amber-100" onClick={onRestore}>
        <RotateCcw className="h-3 w-3" />
        Återställ
      </Button>
      <button onClick={onDismiss} className="text-amber-500 hover:text-amber-700">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
