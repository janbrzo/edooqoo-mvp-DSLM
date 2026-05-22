import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, ArrowRight, Sparkles } from 'lucide-react';

interface PricingTeaserProps {
  onSeeFullPricing?: () => void;
}

const TIERS = [
  {
    name: 'Free',
    price: '$0',
    cadence: 'forever',
    bullets: ['2 worksheet tokens', 'Save unlimited drafts', 'Basic student profile'],
    highlight: false,
  },
  {
    name: 'Side-Gig',
    price: '$9',
    cadence: '/ month',
    bullets: ['10 worksheets / mo', 'DSLM tracking', 'Calendar + reminders'],
    highlight: true,
    badge: 'Most popular',
  },
  {
    name: 'Full-Time',
    price: 'from $19',
    cadence: '/ month',
    bullets: ['30–120 worksheets', 'AI homework grading', 'Student Hub branding'],
    highlight: false,
  },
];

/**
 * Compact 3-card pricing teaser shown high on the landing page (between
 * ValueCards and EcosystemSection). Links into the full PricingSection
 * lower in the page via #pricing-section anchor scroll.
 */
export const PricingTeaser: React.FC<PricingTeaserProps> = ({ onSeeFullPricing }) => {
  const handleClick = () => {
    if (onSeeFullPricing) return onSeeFullPricing();
    const el = document.getElementById('pricing-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="py-12 px-4 bg-background/50 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Simple pricing — pay for what you use
          </h2>
          <p className="text-muted-foreground">Start free. Upgrade only when you need more worksheets.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TIERS.map((t) => (
            <Card
              key={t.name}
              className={
                t.highlight
                  ? 'border-primary border-2 shadow-md relative'
                  : 'border-border'
              }
            >
              {t.highlight && t.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
                  <Sparkles className="h-3 w-3" />
                  {t.badge}
                </div>
              )}
              <CardContent className="p-5">
                <div className="mb-3">
                  <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t.name}</div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-bold text-foreground">{t.price}</span>
                    <span className="text-xs text-muted-foreground">{t.cadence}</span>
                  </div>
                </div>
                <ul className="space-y-1.5 mb-4">
                  {t.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-xs text-foreground">
                      <Check className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-6">
          <Button variant="ghost" onClick={handleClick} className="text-primary hover:text-primary/80">
            See full pricing
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default PricingTeaser;