import React, { useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { Link } from 'react-router-dom';
import { ANON_FEATURES } from '@/constants/anonFeaturesShowcase';
import { AnonFeatureMockup } from './AnonFeatureMockup';
import { cn } from '@/lib/utils';

/**
 * Right-column carousel shown to anonymous teachers inside GeneratingModal
 * during the 70–90s worksheet generation. Auto-rotates every 4s, manual dots.
 */
export const AnonFeatureCarousel: React.FC = () => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'start' });
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    emblaApi.on('select', onSelect);
    onSelect();
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const id = setInterval(() => {
      emblaApi.scrollNext();
    }, 4000);
    return () => clearInterval(id);
  }, [emblaApi]);

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-secondary/30 to-accent/20 rounded-lg p-5 border border-border">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
        While we build your worksheet — meet the full ecosystem
      </div>

      <div className="overflow-hidden flex-1" ref={emblaRef}>
        <div className="flex">
          {ANON_FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.id} className="flex-[0_0_100%] min-w-0 px-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center shadow-md">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold text-foreground leading-tight">{f.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{f.benefit}</p>
                <AnonFeatureMockup id={f.id} />
                <div className="mt-4">
                  <Link
                    to={f.ctaHref}
                    className="inline-flex items-center text-sm font-semibold text-primary hover:underline"
                  >
                    {f.ctaLabel}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-center gap-1.5 mt-4">
        {ANON_FEATURES.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => emblaApi?.scrollTo(i)}
            className={cn(
              'h-1.5 rounded-full transition-all',
              i === selected ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50'
            )}
          />
        ))}
      </div>
    </div>
  );
};

export default AnonFeatureCarousel;