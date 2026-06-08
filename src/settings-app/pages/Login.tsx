import { useState, FormEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Globe, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SupportOption } from '@/types/giftcard';

export default function Login() {
  const { login } = useAuth();
  const { toast } = useToast();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [supportOptions, setSupportOptions] = useState<SupportOption[]>([]);
  const [selectedSupportId, setSelectedSupportId] = useState('');
  const [showSupportSelect, setShowSupportSelect] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!showSupportSelect && (!username || !password)) {
      toast({ title: 'Fel', description: 'Fyll i användarnamn och lösenord', variant: 'destructive' });
      return;
    }

    if (showSupportSelect && !selectedSupportId) {
      toast({ title: 'Fel', description: 'Välj ett företag för att fortsätta', variant: 'destructive' });
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
      if (result.supportOptions?.length === 1) {
        setSelectedSupportId(result.supportOptions[0].value);
      }
      toast({ title: 'Välj företag', description: 'Denna användare har flera företag.' });
      setIsSubmitting(false);
      return;
    }

    if (!result.success) {
      toast({ title: 'Inloggning misslyckades', description: result.error, variant: 'destructive' });
    }

    setIsSubmitting(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900">
            <Globe className="h-6 w-6 text-white" />
          </div>
          <div>
            <CardTitle className="text-xl">Webbplatsinställningar</CardTitle>
            <CardDescription className="mt-1">
              {showSupportSelect ? 'Välj företag för att fortsätta' : 'Logga in för att fortsätta'}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!showSupportSelect && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="username">Användarnamn</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isSubmitting}
                    autoComplete="username"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Lösenord</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    autoComplete="current-password"
                  />
                </div>
              </>
            )}

            {showSupportSelect && (
              <div className="space-y-1.5">
                <Label>Företag</Label>
                <Select value={selectedSupportId} onValueChange={setSelectedSupportId}>
                  <SelectTrigger>
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

            <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {showSupportSelect ? 'Fortsätt' : 'Logga in'}
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
