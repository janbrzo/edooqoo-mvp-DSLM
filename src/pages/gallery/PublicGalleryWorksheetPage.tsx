import React, { useEffect, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { PageSeo } from '@/components/seo/PageSeo';
import GalleryExerciseRenderer from '@/components/gallery/GalleryExerciseRenderer';
import PublicTopNav from '@/components/public/PublicTopNav';

interface PublicWorksheetRow {
  id: string;
  title: string;
  ai_response: string | null;
  html_content: string | null;
  public_topic: string | null;
  public_level: string | null;
  published_at: string | null;
  is_public: boolean;
  public_slug: string;
}

const PublicGalleryWorksheetPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const fromState = { from: location.pathname + location.search };
  const [worksheet, setWorksheet] = useState<PublicWorksheetRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('worksheets')
        .select('id, title, ai_response, html_content, public_topic, public_level, published_at, is_public, public_slug')
        .eq('public_slug', slug)
        .maybeSingle();
      if (cancelled) return;
      if (!data) {
        setNotFound(true);
      } else {
        setWorksheet(data as PublicWorksheetRow);
        // Best-effort view counter increment via RPC-less update path.
        // Public users have SELECT only; skip increment to respect RLS.
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  if (notFound || !worksheet) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-3xl font-bold">Worksheet not found</h1>
        <p className="text-muted-foreground">This worksheet may have been unpublished by its author.</p>
        <Link to="/gallery" className="text-primary underline">Back to gallery</Link>
      </div>
    );
  }

  // Unpublished-but-slug-known → soft "removed" notice (better than 404 for SEO equity).
  if (!worksheet.is_public) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <PageSeo title="Worksheet no longer public — Edooqoo" description="This worksheet has been unpublished." path={`/gallery/${slug}`} />
        <h1 className="text-3xl font-bold">This worksheet is no longer public</h1>
        <p className="text-muted-foreground">The author has removed it from the gallery.</p>
        <Link to="/gallery" className="text-primary underline">Browse other worksheets</Link>
      </div>
    );
  }

  let parsed: any = null;
  try { parsed = worksheet.ai_response ? JSON.parse(worksheet.ai_response) : null; } catch (_) { /* ignore */ }

  const learningResourceLd = {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: worksheet.title,
    inLanguage: 'en',
    educationalLevel: worksheet.public_level || undefined,
    about: worksheet.public_topic || undefined,
    learningResourceType: 'Worksheet',
    datePublished: worksheet.published_at || undefined,
    url: `https://edooqoo.com/gallery/${worksheet.public_slug}`,
    isAccessibleForFree: true,
    publisher: { '@type': 'Organization', name: 'Edooqoo' },
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicTopNav />
      <PageSeo
        title={`${worksheet.title} — Free ESL Worksheet`}
        description={`Free ${worksheet.public_level || ''} English worksheet about ${worksheet.public_topic || 'general topics'}. Published on Edooqoo gallery.`.slice(0, 158)}
        path={`/gallery/${worksheet.public_slug}`}
        jsonLd={learningResourceLd}
      />
      <article className="container mx-auto px-4 py-10 max-w-4xl">
        <nav className="text-sm text-muted-foreground mb-4">
          <Link to="/gallery" className="hover:underline">← Gallery</Link>
        </nav>
        <header className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">{worksheet.title}</h1>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {worksheet.public_level && <span className="rounded bg-secondary px-2 py-1">{worksheet.public_level}</span>}
            {worksheet.public_topic && <span className="rounded bg-muted px-2 py-1">{worksheet.public_topic}</span>}
          </div>
        </header>

        <aside aria-label="Preview notice" className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Preview mode.</strong> This is a static read-only preview of a worksheet a teacher published. Interactive answers, AI-assisted review, audio playback and downloads are available only in the full editor — <Link to="/signup" state={fromState} className="font-semibold underline">sign up free</Link> to generate or open this worksheet interactively.
        </aside>

        {parsed?.exercises && Array.isArray(parsed.exercises) ? (
          <ol className="space-y-6">
            {parsed.exercises.map((ex: any, i: number) => (
              <li key={i}>
                <GalleryExerciseRenderer exercise={ex} index={i} />
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted-foreground">Worksheet content unavailable in preview format.</p>
        )}

        <div className="mt-10 rounded-lg border bg-primary/5 p-6 text-center">
          <h2 className="text-xl font-bold mb-2">From idea to a teacher-reviewed worksheet workflow</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Edooqoo's DSLM workflow turns your student's goals into a tailored worksheet —
            fully editable, with audio, images and AI-grading built in. Free to start, no credit card.
          </p>
          <Link to="/signup" state={fromState} className="inline-block rounded-md bg-primary px-5 py-2 text-primary-foreground font-semibold">
            Try 1-Minute Prep free
          </Link>
        </div>
      </article>
    </div>
  );
};

export default PublicGalleryWorksheetPage;
