import { Helmet } from "react-helmet-async";

const BASE = "https://edooqoo.com";
const DEFAULT_OG_IMAGE = `${BASE}/lovable-uploads/2d55c1e0-547e-45aa-a55c-e71479adb602.png`;

export interface PageSeoProps {
  title: string;
  description: string;
  path: string;
  ogType?: "website" | "article";
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  robots?: string;
  /** Absolute or root-relative image URL overriding the sitewide social preview. */
  image?: string;
  imageAlt?: string;
}

export const PageSeo = ({
  title,
  description,
  path,
  ogType = "website",
  jsonLd,
  robots = "index,follow",
  image,
  imageAlt,
}: PageSeoProps) => {
  const url = `${BASE}${path}`;
  const imageUrl = image
    ? (image.startsWith("http") ? image : `${BASE}${image}`)
    : DEFAULT_OG_IMAGE;
  const ldArr = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={robots} />
      <link rel="canonical" href={url} />
      <link rel="alternate" hrefLang="x-default" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content="Edooqoo" />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:alt" content={imageAlt ?? title} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
      <meta name="twitter:image:alt" content={imageAlt ?? title} />
      {ldArr.map((ld, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(ld)}</script>
      ))}
    </Helmet>
  );
};

export const buildFaqPageLd = (items: { question: string; answer: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map((i) => ({
    "@type": "Question",
    name: i.question,
    acceptedAnswer: { "@type": "Answer", text: i.answer },
  })),
});
