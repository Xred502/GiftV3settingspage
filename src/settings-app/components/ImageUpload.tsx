import { useRef, useState, DragEvent } from 'react';
import { Upload, X, Loader2, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}

export default function ImageUpload({ value, onChange, label }: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Endast bildfiler stöds (JPG, PNG, GIF, SVG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Filen är för stor (max 5 MB).');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('/api/settings/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Uppladdning misslyckades');
      }
      const { url } = await res.json();
      onChange(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Uppladdning misslyckades');
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  return (
    <div className="space-y-2">
      {label && <p className="text-xs text-muted-foreground">{label}</p>}

      {value && (
        <div className="relative inline-block">
          <img src={value} alt="Förhandsvisning" className="h-20 w-auto max-w-xs rounded border object-contain bg-slate-50" />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive text-destructive-foreground p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 cursor-pointer transition-colors text-sm text-muted-foreground',
          dragging ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-400',
          uploading && 'pointer-events-none opacity-60',
        )}
      >
        {uploading
          ? <><Loader2 className="h-5 w-5 animate-spin" /><span>Laddar upp...</span></>
          : <><ImageIcon className="h-5 w-5" /><span>Dra hit eller klicka för att välja bild</span><span className="text-xs">JPG, PNG, SVG, WebP · max 5 MB</span></>
        }
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ''; }}
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
