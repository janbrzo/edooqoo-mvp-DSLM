import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { PageSeo } from '@/components/seo/PageSeo';
import PublicTopNav from '@/components/public/PublicTopNav';

interface PublicWorksheet {
  id: string;
  public_slug: string;
  title: string;
  public_topic: string | null;
  public_level: string | null;
  public_exercise_types: string[] | null;
  published_at: string | null;
  public_view_count: number | null;
}

const PAGE_SIZE = 24;

const PublicGalleryIndex: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<PublicWorksheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const levelFilter = params.get('level') || '';
  const topicFilter = (params.get('topic') || '').toLowerCase();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      // v6.9.88 — read through a security-definer RPC that exposes only safe
      // display columns; the worksheets table no longer has a public policy.
      const { data } = await supabase.rpc('list_public_worksheets', {
        p_level: levelFilter || null,
        p_topic: topicFilter || null,
        p_limit: PAGE_SIZE + 1,
        p_offset: page * PAGE_SIZE,
      });
      if (cancelled) return;
      const rows = (data || []) as PublicWorksheet[];
      setHasMore(rows.length > PAGE_SIZE);
      setItems(rows.slice(0, PAGE_SIZE));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [page, levelFilter, topicFilter]);

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
    setPage(0);
  };

  const itemListLd = useMemo(() => ({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.slice(0, 20).map((w, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://edooqoo.com/gallery/${w.public_slug}`,
      name: w.title,
    })),
  }), [items]);

  return (
    <div className="min-h-screen bg-background">
      <PublicTopNav />
      <PageSeo
        title="Public ESL Worksheets Gallery — Edooqoo"
        description="Browse free, ready-to-use English worksheets shared by tutors. Filter by CEFR level (A1–C2) and topic. No sign-up required."
        path="/gallery"
        jsonLd={itemListLd}
      />
      <article className="container mx-auto px-4 py-12 max-w-6xl">
        <header className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Public ESL Worksheets Gallery</h1>
          <p className="text-lg text-muted-foreground">Free worksheets shared by Edooqoo tutors. Click any worksheet to preview it.</p>
          <aside aria-label="Summary" className="mt-4 rounded-md border-l-4 border-primary bg-muted/40 p-3 text-sm">
            <strong>TL;DR:</strong> A growing library of teacher-published English worksheets. Filter by CEFR level or topic. Each worksheet is read-only; sign up to create your own.
          </aside>
        </header>

        {/* v6.9.34 — single granular CEFR chip row. Old composite chips
            (A1/A2 …) and the legacy dropdown were removed because they
            collided with each other and produced empty results. */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mr-1">CEFR:</span>
          {[
            { label: 'All', value: '' },
            { label: 'A1', value: 'A1' },
            { label: 'A2', value: 'A2' },
            { label: 'B1', value: 'B1' },
            { label: 'B2', value: 'B2' },
            { label: 'C1', value: 'C1' },
            { label: 'C2', value: 'C2' },
          ].map((opt) => (
            <button
              key={opt.value || 'all'}
              type="button"
              onClick={() => setFilter('level', opt.value)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                (levelFilter || '') === opt.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-muted text-muted-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            type="text"
            placeholder="Filter by topic…"
            defaultValue={topicFilter}
            onChange={(e) => setFilter('topic', e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm flex-1 min-w-[200px]"
            aria-label="Filter by topic"
          />
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground">No public worksheets match these filters yet.</p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((w) => (
              <li key={w.id} className="rounded-lg border bg-card p-5 hover:shadow-md transition-shadow">
                <Link to={`/gallery/${w.public_slug}`} className="block">
                  <h2 className="text-lg font-semibold text-primary line-clamp-2">{w.title}</h2>
                  <div className="mt-2 flex flex-wrap gap-1 text-xs">
                    {w.public_level && <span className="rounded bg-secondary px-2 py-0.5">{w.public_level}</span>}
                    {w.public_topic && <span className="rounded bg-muted px-2 py-0.5">{w.public_topic}</span>}
                    {(w.public_exercise_types || []).slice(0, 3).map((t) => (
                      <span key={t} className="rounded bg-muted/60 px-2 py-0.5">{t}</span>
                    ))}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <nav className="mt-8 flex gap-2 justify-center" aria-label="Pagination">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded border px-4 py-2 text-sm disabled:opacity-50"
          >Previous</button>
          <span className="px-3 py-2 text-sm text-muted-foreground">Page {page + 1}</span>
          <button
            disabled={!hasMore}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border px-4 py-2 text-sm disabled:opacity-50"
          >Next</button>
        </nav>
      </article>
    </div>
  );
};

export default PublicGalleryIndex;