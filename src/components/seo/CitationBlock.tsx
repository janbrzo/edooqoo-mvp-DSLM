import React from 'react';

/**
 * Sprint 4 (Faza 4) — GEO/AEO citation block.
 *
 * One extractable 40-60 word paragraph answer engines can quote verbatim.
 * The `data-citation-block` marker is the contract used by
 * scripts/seo/audit-structured-data.mjs and scripts/seo/inject-citation-blocks.mjs.
 */
interface CitationBlockProps {
  /** 40-60 words, brand-first, factual. No marketing language, no roadmap claims. */
  citation: string;
  /** Canonical URL of the page the citation belongs to. */
  sourceUrl: string;
  className?: string;
}

const CitationBlock: React.FC<CitationBlockProps> = ({ citation, sourceUrl, className }) => (
  <p data-citation-block="true" data-citation-source={sourceUrl} className={className}>
    {citation}
  </p>
);

export default CitationBlock;
