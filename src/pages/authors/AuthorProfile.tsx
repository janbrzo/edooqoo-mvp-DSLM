import React from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { PageSeo } from '@/components/seo/PageSeo';
import { CONTENT_AUTHORS } from '@/data/contentAuthors';

const profiles = {
  'jan-brzostowski': CONTENT_AUTHORS.jan,
  martha: CONTENT_AUTHORS.martha,
} as const;

const AuthorProfile: React.FC = () => {
  const { slug } = useParams<{ slug: keyof typeof profiles }>();
  const location = useLocation();
  const profile = slug ? profiles[slug] : undefined;

  if (!profile) return <Navigate to="/404" replace />;

  const canonical = profile.path;
  const description = `${profile.name}: ${profile.role}. ${profile.scope}`;
  const personLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `https://edooqoo.com${canonical}#person`,
    name: profile.name,
    url: `https://edooqoo.com${canonical}`,
    jobTitle: profile.role,
    description: profile.bio,
    worksFor: { '@type': 'Organization', '@id': 'https://edooqoo.com/#organization', name: 'Edooqoo' },
  };

  return (
    <div className="min-h-screen bg-background">
      <PageSeo
        title={`${profile.name} — ${profile.role} | Edooqoo`}
        description={description}
        path={canonical}
        jsonLd={personLd}
      />
      <header className="border-b bg-background/95">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link to="/" className="text-xl font-bold text-primary">Edooqoo</Link>
          <Link to="/blog" className="text-sm text-muted-foreground hover:text-primary">Blog</Link>
        </div>
      </header>
      <main className="container mx-auto max-w-3xl px-4 py-14">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">Editorial profile</p>
        <h1 className="mb-4 text-4xl font-bold text-foreground">{profile.name}</h1>
        <p className="mb-8 text-xl text-muted-foreground">{profile.role}</p>

        <section className="mb-10 rounded-xl border bg-card p-6">
          <h2 className="mb-3 text-2xl font-semibold text-foreground">Editorial responsibility</h2>
          <p className="leading-relaxed text-muted-foreground">{profile.scope}</p>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-2xl font-semibold text-foreground">Profile</h2>
          <p className="leading-relaxed text-muted-foreground">{profile.bio}</p>
        </section>

        {slug === 'jan-brzostowski' ? (
          <section className="mb-10">
            <h2 className="mb-3 text-2xl font-semibold text-foreground">Authorship boundary</h2>
            <p className="leading-relaxed text-muted-foreground">
              Jan authors product, workflow, and operating-system explanations. ESL methodology claims in strategic teaching content are reviewed separately by Martha.
            </p>
          </section>
        ) : (
          <section className="mb-10">
            <h2 className="mb-3 text-2xl font-semibold text-foreground">Review standard</h2>
            <p className="leading-relaxed text-muted-foreground">
              Review checks whether advice leads to a specific adult learner performance, uses current evidence, preserves teacher judgment, and avoids generic classroom or school-like tasks.
            </p>
          </section>
        )}

        <Link
          to="/what-to-teach-next"
          state={{ from: location.pathname }}
          className="font-semibold text-primary hover:underline"
        >
          Read the What Should I Teach Next? resource hub
        </Link>
      </main>
    </div>
  );
};

export default AuthorProfile;
