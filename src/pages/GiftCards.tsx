import MainLayout from '@/components/layout/MainLayout';
import CardholderSearch from '@/components/giftcard/CardholderSearch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard } from 'lucide-react';

export default function GiftCards() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kort och kortinnehavare</h1>
          <p className="mt-1 text-muted-foreground">
            Sök, filtrera och hantera både presentkort och kortinnehavare i samma vy.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Kortregister
            </CardTitle>
            <CardDescription>
              Visar alla kort och alla kortinnehavare från databasen.
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
