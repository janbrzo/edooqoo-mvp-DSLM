/**
 * StudentTestPage: legacy /test/:token route.
 *
 * Non-welcome student tests are retired (only a handful of old placement rows
 * exist). The route stays so old emailed links show a clear message, not a 404.
 * Welcome Tests live on /welcome-test/:token.
 */
import { AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function StudentTestPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="py-10 text-center space-y-3">
          <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground" />
          <h1 className="text-lg font-semibold">This test link is no longer active</h1>
          <p className="text-sm text-muted-foreground">Ask your teacher for a new link.</p>
        </CardContent>
      </Card>
    </div>
  );
}
