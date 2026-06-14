import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PageSeo } from '@/components/seo/PageSeo';
import { SEO_META } from '@/constants/seoMeta';
import { BLOG_CATEGORIES, BLOG_POSTS } from '@/data/blogIndex';

const PostLink: React.FC<{
  href: string;
  className: string;
  children: React.ReactNode;
}> = ({ href, className, children }) => (
  href.endsWith('.html')
    ? <a href={href} className={className}>{children}</a>
    : <Link to={href} className={className}>{children}</Link>
);

const Blog = () => {
  const location = useLocation();
  const fromState = { from: location.pathname + location.search };
  const posts = useMemo(
    () => BLOG_POSTS.map((post) => ({ ...post, href: post.url })),
    [],
  );
  const recentPosts = useMemo(
    () => [...posts]
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 8),
    [posts],
  );

  const blogLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Edooqoo Blog',
    description: SEO_META.blog.description,
    url: 'https://edooqoo.com/blog',
    publisher: { '@type': 'Organization', name: 'Edooqoo', url: 'https://edooqoo.com' },
    blogPost: posts.map((post) => ({
      '@type': 'BlogPosting',
      headline: post.title,
      url: `https://edooqoo.com${post.href}`,
      datePublished: post.date || undefined,
    })),
  };

  return (
    <div className="min-h-screen bg-background">
      <PageSeo {...SEO_META.blog} jsonLd={blogLd} />
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link to="/" className="text-xl font-bold text-primary">Edooqoo</Link>
          <div className="flex items-center gap-4">
            <Link to="/pricing" className="text-sm text-muted-foreground transition-colors hover:text-primary">
              Pricing
            </Link>
            <Link
              to="/signup"
              state={fromState}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-opacity hover:opacity-90"
            >
              Sign Up Free
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-4 py-12">
        <h1 className="mb-4 text-4xl font-bold text-foreground">Edooqoo Blog</h1>
        <p className="mb-12 text-lg text-muted-foreground">
          Practical resources for recurring one-to-one adult English lessons.
        </p>

        <section className="mb-12 rounded-2xl border border-border bg-secondary/40 p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-xl font-semibold text-foreground">Latest posts</h2>
            <span className="text-xs text-muted-foreground">
              Updated {recentPosts[0]?.date || 'when a new article is published'}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {recentPosts.map((post) => (
              <PostLink
                key={post.href}
                href={post.href}
                className="block rounded-lg border bg-card p-3 transition-all hover:border-violet-200 hover:shadow-md"
              >
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-violet-600">
                  {post.category}
                </div>
                <div className="mb-1 text-sm font-medium leading-snug text-foreground">{post.title}</div>
                <div className="text-xs text-muted-foreground">{post.date}</div>
              </PostLink>
            ))}
          </div>
        </section>

        {BLOG_CATEGORIES.map((cluster) => {
          const clusterPosts = posts.filter((post) => post.category === cluster);
          if (!clusterPosts.length) return null;
          return (
            <section key={cluster} className="mb-12">
              <h2 className="mb-6 text-2xl font-semibold text-foreground">{cluster}</h2>
              <div className="space-y-4">
                {clusterPosts.map((post) => (
                  <PostLink
                    key={post.href}
                    href={post.href}
                    className="block rounded-lg border bg-card p-5 transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="mb-1 font-semibold text-foreground">{post.title}</h3>
                        <p className="text-sm text-muted-foreground">{post.description}</p>
                      </div>
                      <span className="whitespace-nowrap text-xs text-muted-foreground">{post.date}</span>
                    </div>
                  </PostLink>
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
};

export default Blog;
