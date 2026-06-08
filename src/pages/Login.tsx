import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useBackofficeTheme } from '@/contexts/BackofficeThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreditCard, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SupportOption } from '@/types/giftcard';
import { cn } from '@/lib/utils';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [supportOptions, setSupportOptions] = useState<SupportOption[]>([]);
  const [selectedSupportId, setSelectedSupportId] = useState('');
  const [showSupportSelect, setShowSupportSelect] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const { theme } = useBackofficeTheme();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !password) {
      toast({
        title: 'Fel',
        description: 'Fyll i användarnamn och lösenord',
        variant: 'destructive',
      });
      return;
    }

    if (showSupportSelect && !selectedSupportId) {
      toast({
        title: 'Fel',
        description: 'Välj ett företag för att fortsätta',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    const result = await login({
      username,
      password,
      supportId: showSupportSelect ? selectedSupportId : undefined,
    });

    if (result.needsSupportSelection) {
      setSupportOptions(result.supportOptions || []);
      setShowSupportSelect(true);
      if (result.supportOptions && result.supportOptions.length === 1) {
        setSelectedSupportId(result.supportOptions[0].value);
      }
      toast({
        title: 'Välj företag',
        description: 'Denna användare har flera företag. Välj ett för att fortsätta.',
      });
      setIsSubmitting(false);
      return;
    }

    if (result.success) {
      toast({
        title: 'Välkommen!',
        description: 'Du är nu inloggad',
      });
      navigate('/');
    } else {
      toast({
        title: 'Inloggning misslyckades',
        description: result.error,
        variant: 'destructive',
      });
    }

    setIsSubmitting(false);
  };

  return (
    <div className={cn('login-shell min-h-screen flex items-center justify-center bg-background p-4', `theme-${theme}`)}>
      <Card className="login-card w-full max-w-md">
        <CardHeader className="text-center">
          <div className="login-brand mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
            <CreditCard className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">Presentkort Backoffice</CardTitle>
          <CardDescription>
            {showSupportSelect ? 'Välj företag för att fortsätta' : 'Logga in för att hantera presentkort'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!showSupportSelect && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="username">Användarnamn</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Ange användarnamn"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isSubmitting}
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Lösenord</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Ange lösenord"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    autoComplete="current-password"
                  />
                </div>
              </>
            )}

            {showSupportSelect && (
              <div className="space-y-2">
                <Label htmlFor="support">Företag</Label>
                <Select value={selectedSupportId} onValueChange={setSelectedSupportId}>
                  <SelectTrigger id="support">
                    <SelectValue placeholder="Välj företag..." />
                  </SelectTrigger>
                  <SelectContent>
                    {supportOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {showSupportSelect ? 'Väljer...' : 'Loggar in...'}
                </>
              ) : showSupportSelect ? (
                'Fortsätt'
              ) : (
                'Logga in'
              )}
            </Button>

            {showSupportSelect && (
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setShowSupportSelect(false);
                  setSupportOptions([]);
                  setSelectedSupportId('');
                }}
              >
                Tillbaka
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
