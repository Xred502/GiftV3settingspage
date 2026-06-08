import { useEffect, useRef } from 'react';

function draftKey(companyId: string, tab: string) {
  return `settings-draft:${companyId}:${tab}`;
}

export function saveDraft(companyId: string, tab: string, data: unknown) {
  try {
    localStorage.setItem(draftKey(companyId, tab), JSON.stringify({
      savedAt: new Date().toISOString(),
      data,
    }));
  } catch {}
}

export function loadDraft<T>(companyId: string, tab: string): { savedAt: string; data: T } | null {
  try {
    const raw = localStorage.getItem(draftKey(companyId, tab));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function clearDraft(companyId: string, tab: string) {
  try { localStorage.removeItem(draftKey(companyId, tab)); } catch {}
}

export function useAutosaveDraft(
  companyId: string,
  tab: string,
  data: unknown,
  isDirty: boolean,
  delayMs = 2000,
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isDirty || !companyId) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => saveDraft(companyId, tab, data), delayMs);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [data, isDirty, companyId, tab, delayMs]);
}
