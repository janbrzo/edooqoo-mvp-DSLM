import React from 'react';
import AnonPostWorksheetCTA from './AnonPostWorksheetCTA';
import MiniFeatureGrid from './MiniFeatureGrid';
import { PricingSection } from '@/components/PricingSection';
import FinalCTA from '@/components/landing/FinalCTA';

/**
 * Container rendered below GenerationView in the anonymous flow when the
 * worksheet has been successfully generated. Sequence:
 *   1) AnonPostWorksheetCTA (signup nudge)
 *   2) PricingSection (reused from landing)
 *   3) MiniFeatureGrid (the 6 ecosystem features)
 *   4) FinalCTA (reused from landing)
 */
export const AnonPostWorksheetLandingPage: React.FC = () => {
  const scrollToPricing = () => {
    const el = document.getElementById('post-worksheet-pricing');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <AnonPostWorksheetCTA onSeePricing={scrollToPricing} />
      <div id="post-worksheet-pricing" className="scroll-mt-16">
        <PricingSection />
      </div>
      <MiniFeatureGrid />
      <FinalCTA />
    </>
  );
};

export default AnonPostWorksheetLandingPage;