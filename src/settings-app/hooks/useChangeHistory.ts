import { useCallback } from 'react';

export interface HistoryEntry {
  savedAt: string;
  companyId: string;
  companyName: string;
  tab: string;
  changedFields: string[];
  snapshot: Record<string, unknown>;
}

const HISTORY_KEY = 'settings-change-history';
const MAX_ENTRIES = 50;

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(entries: HistoryEntry[]) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES))); } catch {}
}

export function getHistory(): HistoryEntry[] {
  return loadHistory();
}

export function useChangeHistory() {
  const pushEntry = useCallback((
    companyId: string,
    companyName: string,
    tab: string,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ) => {
    const changedFields = Object.keys(after).filter(
      (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k])
    );
    if (changedFields.length === 0) return;

    const entry: HistoryEntry = {
      savedAt: new Date().toISOString(),
      companyId,
      companyName,
      tab,
      changedFields,
      snapshot: after,
    };

    const history = loadHistory();
    saveHistory([entry, ...history]);
  }, []);

  return { pushEntry, getHistory };
}
