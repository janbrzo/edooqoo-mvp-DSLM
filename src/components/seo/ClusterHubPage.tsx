import React from 'react';
import { Link } from 'react-router-dom';
import SeoLandingLayout from '@/components/seo/SeoLandingLayout';
import type { ClusterHub } from '@/constants/clusterHubs';

/**
 * Sprint 3 (Faza 3) — shared renderer for the four topical cluster hubs.
 *
 * Structure is fixed on purpose so every hub emits the same GEO surface:
 * citation block -> comparison table -> spoke list -> tool funnel -> FAQ.
 * Static .html spokes use <a> (full page nav); SPA spokes use <Link>.
 */
const isStatic = (href: string) => href.endsWith('.html');

const ClusterHubPage: React.FC<{ hub: ClusterHub }> = ({ hub }) => {
  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: hub.title,
    description: hub.description,
    url: `https://edooqoo.com${hub.route}`,
    hasPart: hub.spokes.map((spoke) => ({
      '@type': 'WebPage',
      name: spoke.label,
      url: `https://edooqoo.com${spoke.href}`,
    })),
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Edooqoo', item: 'https://edooqoo.com/' },
      { '@type': 'ListItem', position: 2, name: hub.h1, item: `https://edooqoo.com${hub.route}` },
    ],
  };

  return (
    <SeoLandingLayout
      seo={{
        title: hub.title,
        description: hub.description,
        path: hub.route,
        ogType: 'website',
        extraJsonLd: [collectionLd, breadcrumbLd, ...(hub.extraJsonLd ?? [])],
      }}
      h1={hub.h1}
      lead={hub.lead}
      primaryCta={{ label: hub.toolCtaLabel, to: `${hub.tool}?src=hub-${hub.id}` }}
      secondaryCta={{ label: 'See 29 exercise types', to: '/exercise-types' }}
      problems={hub.problems}
      solutionHeading={hub.solutionHeading}
      solutions={hub.solutions}
      listHeading="What to read next in this cluster"
      listIntro="Each page below answers one decision inside this cluster. Anchors match the question tutors actually search for."
      list={hub.spokes
        .filter((spoke) => !isStatic(spoke.href))
        .map((spoke) => ({ title: spoke.label, body: spoke.note, href: spoke.href }))}
      faqs={hub.faqs}
      ctaTitle={hub.ctaTitle}
      ctaBody={hub.ctaBody}
      body={
        <>
          <h2 className="text-xl font-bold text-foreground mt-0">{hub.definitionHeading}</h2>
          <p data-citation-block="true">{hub.citation}</p>

          <h2 className="text-xl font-bold text-foreground">{hub.tableHeading}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">Situation</th>
                  <th className="text-left">What to use</th>
                  <th className="text-left">Why</th>
                  <th className="text-left">Where in Edooqoo</th>
                </tr>
              </thead>
              <tbody>
                {hub.table.map((row) => (
                  <tr key={row.situation}>
                    <td>{row.situation}</td>
                    <td>{row.use}</td>
                    <td>{row.why}</td>
                    <td>
                      {isStatic(row.whereHref) ? (
                        <a href={row.whereHref} className="text-primary hover:underline">{row.where}</a>
                      ) : (
                        <Link to={row.whereHref} className="text-primary hover:underline">{row.where}</Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="text-xl font-bold text-foreground">Reference pages in this cluster</h2>
          <ul>
            {hub.spokes.map((spoke) => (
              <li key={spoke.href}>
                {isStatic(spoke.href) ? (
                  <a href={spoke.href} className="text-primary hover:underline">{spoke.label}</a>
                ) : (
                  <Link to={spoke.href} className="text-primary hover:underline">{spoke.label}</Link>
                )}
                {' — '}
                {spoke.note}
              </li>
            ))}
          </ul>

          <h2 className="text-xl font-bold text-foreground">{hub.toolHeading}</h2>
          <p>{hub.toolBody}</p>
          <p>
            <Link to={`${hub.tool}?src=hub-${hub.id}`} className="text-primary hover:underline">
              {hub.toolCtaLabel}
            </Link>
          </p>
        </>
      }
    />
  );
};

export default ClusterHubPage;
