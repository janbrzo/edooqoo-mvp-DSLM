import React from 'react';
import { cn } from '@/lib/utils';

interface FeatureScreenshotFrameProps {
  src: string;
  alt: string;
  caption?: string;
  className?: string;
  imageClassName?: string;
  objectPosition?: string;
  loading?: 'eager' | 'lazy';
}

const FeatureScreenshotFrame: React.FC<FeatureScreenshotFrameProps> = ({
  src,
  alt,
  caption,
  className,
  imageClassName,
  objectPosition = 'center',
  loading = 'lazy',
}) => (
  <figure className={cn('overflow-hidden rounded-xl border border-border bg-background shadow-sm', className)}>
    <img
      src={src}
      alt={alt}
      loading={loading}
      decoding="async"
      className={cn('h-full w-full object-cover', imageClassName)}
      style={{ objectPosition }}
    />
    {caption && (
      <figcaption className="border-t border-border bg-background/95 px-4 py-2 text-xs leading-5 text-muted-foreground">
        {caption}
      </figcaption>
    )}
  </figure>
);

export default FeatureScreenshotFrame;

