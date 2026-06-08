import { ReactNode } from 'react';
import { Globe, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDarkMode } from '../hooks/useDarkMode';

export default function Layout({ children }: { children: ReactNode }) {
  const { isDark, toggle } = useDarkMode();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex h-16 items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 dark:bg-slate-700">
            <Globe className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <span className="font-semibold text-slate-900 dark:text-slate-100">Webbplatsinställningar</span>
            <span className="hidden sm:inline text-slate-400 dark:text-slate-500 text-sm ml-2">Microdeb GiftCard</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label={isDark ? 'Växla till ljust läge' : 'Växla till mörkt läge'}
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  );
}
