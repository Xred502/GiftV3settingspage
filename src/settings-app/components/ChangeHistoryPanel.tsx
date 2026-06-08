import { useState } from 'react';
import { History, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getHistory, type HistoryEntry } from '../hooks/useChangeHistory';

const FIELD_LABELS: Record<string, string> = {
  companyName: 'Företagsnamn', companyEmail: 'E-post', companyPhone: 'Telefon',
  companyUrl: 'Hemsida', companyActive: 'Aktiv', bannerHtml: 'Banner HTML',
  companyFooterHtml: 'Footer HTML', companyCustomStyle: 'CSS', paymentPlatform: 'Betalplattform',
  paymentTestMode: 'Testläge', companyAmountJson: 'Belopp',
  canSendHome: 'Hemleverans', allowMultipleCards: 'Flera kort', formBackgroundColor: 'Bakgrundsfärg',
};

function formatField(f: string) {
  return FIELD_LABELS[f] || f;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('sv-SE', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

interface EntryRowProps { entry: HistoryEntry; }

function EntryRow({ entry }: EntryRowProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border-b last:border-0 py-2.5 px-3">
      <button className="flex w-full items-start justify-between gap-2 text-left" onClick={() => setExpanded(!expanded)}>
        <div className="space-y-0.5 min-w-0">
          <p className="text-sm font-medium truncate">{entry.companyName}</p>
          <p className="text-xs text-muted-foreground">{formatTime(entry.savedAt)} · {entry.tab}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {entry.changedFields.slice(0, 4).map((f) => (
              <Badge key={f} variant="secondary" className="text-[10px] h-4">{formatField(f)}</Badge>
            ))}
            {entry.changedFields.length > 4 && (
              <Badge variant="secondary" className="text-[10px] h-4">+{entry.changedFields.length - 4} till</Badge>
            )}
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />}
      </button>

      {expanded && (
        <div className="mt-2 space-y-1">
          {entry.changedFields.map((f) => (
            <div key={f} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{formatField(f)}:</span>{' '}
              <span className="font-mono">{JSON.stringify(entry.snapshot[f])?.slice(0, 80)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChangeHistoryPanel() {
  const [entries, setEntries] = useState<HistoryEntry[]>(() => getHistory());

  function clearHistory() {
    localStorage.removeItem('settings-change-history');
    setEntries([]);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <History className="h-4 w-4" />
          Ändringshistorik
          {entries.length > 0 && (
            <Badge variant="secondary" className="text-xs">{entries.length}</Badge>
          )}
        </div>
        {entries.length > 0 && (
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground" onClick={clearHistory}>
            <Trash2 className="h-3 w-3" />
            Rensa
          </Button>
        )}
      </div>

      <div className="rounded-md border max-h-[480px] overflow-y-auto">
        {entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Inga sparade ändringar än.</p>
        ) : (
          entries.map((e, i) => <EntryRow key={i} entry={e} />)
        )}
      </div>
    </div>
  );
}
