import { Link } from 'react-router-dom';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePublicGalleryExamples } from '@/hooks/usePublicGalleryExamples';

/** Reviewed source links only. Embedding exercise bodies awaits consent and a bounded public RPC. */
const PublicGalleryExamples = () => {
  const { status, items, retry } = usePublicGalleryExamples();

  return (
    <section aria-label="Published worksheet examples" className="not-prose my-10 border-t pt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-foreground">Published worksheet examples</h2>
        <Button asChild variant="link" className="h-auto px-0">
          <Link to="/gallery">Browse public gallery <ArrowRight /></Link>
        </Button>
      </div>
      <div aria-live="polite" className="mt-4">
        {status === 'loading' && <p className="text-sm text-muted-foreground">Loading published examples…</p>}
        {status === 'empty' && <p className="text-sm text-muted-foreground">These examples are not currently listed in the public gallery.</p>}
        {status === 'error' && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">Published examples are temporarily unavailable.</p>
            <Button variant="outline" size="sm" onClick={retry}><RefreshCw /> Retry</Button>
          </div>
        )}
        {status === 'ready' && (
          <ul className="grid gap-4 md:grid-cols-2">
            {items.map((example) => (
              <li key={example.slug} className="rounded-lg border bg-card p-5">
                <h3 className="text-lg font-semibold text-foreground">
                  <Link to={`/gallery/${example.slug}`} className="text-primary hover:underline">{example.title}</Link>
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{example.focus}</p>
                <Button asChild variant="link" className="mt-3 h-auto px-0">
                  <Link to={`/gallery/${example.slug}`}>View original exercises <ArrowRight /></Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default PublicGalleryExamples;