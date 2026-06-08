import MainLayout from '@/components/layout/MainLayout';
import CardholderSearch from '@/components/giftcard/CardholderSearch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';

export default function Cardholders() {
  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kortinnehavare</h1>
          <p className="text-muted-foreground mt-1">
            Sök och hantera kortinnehavare i systemet
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Sök kortinnehavare
            </CardTitle>
            <CardDescription>
              Sök på förnamn, efternamn och/eller e-postadress
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CardholderSearch />
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
