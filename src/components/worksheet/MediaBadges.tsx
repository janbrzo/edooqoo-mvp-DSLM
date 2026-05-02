import React from 'react';
import { Image, Headphones } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface MediaBadgesProps {
  hasImage: boolean;
  hasAudio: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export const MediaBadges = ({ hasImage, hasAudio, size = 'sm', className = '' }: MediaBadgesProps) => {
  if (!hasImage && !hasAudio) return null;
  
  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {hasImage && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="bg-green-100 text-green-700 rounded-full p-1.5">
              <Image className={iconSize} />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Contains Image</p>
          </TooltipContent>
        </Tooltip>
      )}
      
      {hasAudio && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="bg-blue-100 text-blue-700 rounded-full p-1.5">
              <Headphones className={iconSize} />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Contains Audio</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};
