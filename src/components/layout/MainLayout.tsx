import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { themeOptions, type BackofficeTheme, useBackofficeTheme } from '@/contexts/BackofficeThemeContext';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  BarChart3,
  ChevronDown,
  CreditCard,
  FileSpreadsheet,
  Gift,
  LogOut,
  Palette,
  User,
} from 'lucide-react';
import { giftcardMakerPages, isGiftcardMakerRoute } from '@/lib/giftcard-maker';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  children: ReactNode;
  background?: 'soft' | 'default';
}

const themePrimarySwatches: Record<BackofficeTheme, string> = {
  modern: 'hsl(214 84% 56%)',
  'microdeb-dark': 'hsl(95 61% 58%)',
  warm: 'hsl(17 78% 54%)',
  water: 'hsl(319 100% 58%)',
};

export default function MainLayout({ children }: MainLayoutProps) {
  const { user, logout } = useAuth();
  const { theme: backofficeTheme, setTheme: setBackofficeTheme } = useBackofficeTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/', label: '\u00d6versikt', icon: BarChart3 },
    { path: '/giftcards', label: 'Kortregister', icon: CreditCard },
    { path: '/report', label: 'Rapporter', icon: FileSpreadsheet },
  ];

  return (
    <div className={cn('backoffice-shell min-h-screen bg-background', `theme-${backofficeTheme}`)}>
      <div className="backoffice-orb backoffice-orb-1" aria-hidden="true" />
      <div className="backoffice-orb backoffice-orb-2" aria-hidden="true" />
      <header className="backoffice-header sticky top-0 z-50 w-full border-b border-border/70">
        <div className="container flex min-h-20 flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center justify-between gap-6">
            <Link to="/" className="flex items-center gap-2">
              <div className="brand-mark flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <CreditCard className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <span className="block text-lg font-semibold">Presentkort Microdeb</span>
              </div>
            </Link>

            <nav className="hidden items-center gap-1 md:flex md:flex-1 md:min-w-0 md:flex-nowrap md:overflow-x-auto md:whitespace-nowrap">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'nav-pill flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-all',
                    location.pathname === item.path
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                      : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}

              <Link
                to="/giftcard-maker"
                className={cn(
                  'nav-pill flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-all',
                  location.pathname === '/giftcard-maker' || isGiftcardMakerRoute(location.pathname)
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                    : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                )}
              >
                <Gift className="h-4 w-4" />
                <span>Skapa presentkort</span>
              </Link>

            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">{user?.username || ''}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Logga ut</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 gap-2 px-2.5 text-muted-foreground hover:text-foreground"
                  aria-label="V\u00e4lj tema"
                >
                  <Palette className="h-4 w-4" />
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-border/80 shadow-sm"
                    style={{ backgroundColor: themePrimarySwatches[backofficeTheme] }}
                    aria-hidden="true"
                  />
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="grid min-w-0 w-[140px] grid-cols-3 gap-1.5 p-2">
                {themeOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.key}
                    onClick={() => setBackofficeTheme(option.key)}
                    className="inline-flex h-8 w-8 cursor-pointer items-center justify-center p-0"
                    title={option.label}
                    aria-label={option.label}
                  >
                    <span
                      className={cn(
                        'h-4 w-4 rounded-full border border-border/80 shadow-sm transition-transform',
                        backofficeTheme === option.key && 'ring-2 ring-ring ring-offset-2 ring-offset-popover'
                      )}
                      style={{ backgroundColor: themePrimarySwatches[option.key] }}
                      aria-hidden="true"
                    />
                    <span className="sr-only">{option.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="container relative z-10 flex-1 py-6">
        <div className="pb-8">{children}</div>
      </main>
    </div>
  );
}
