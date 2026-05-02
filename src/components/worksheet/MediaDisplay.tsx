import React from 'react';
import { ExternalLink } from 'lucide-react';

interface MediaDisplayProps {
  imageUrl: string;
  photographer?: string;
  photographerUrl?: string;
  description?: string;
}

export default function MediaDisplay({
  imageUrl,
  photographer,
  photographerUrl,
  description
}: MediaDisplayProps) {
  return (
    <div className="my-6 space-y-3">
      <div className="relative rounded-lg overflow-hidden border-2 border-gray-200 shadow-sm">
        <img
          src={imageUrl}
          alt={description || 'Lesson image'}
          className="w-full h-auto object-cover"
        />
      </div>
      
      {/* Unsplash attribution */}
      {photographer && (
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
          <span>Photo by</span>
          {photographerUrl ? (
            <a
              href={photographerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-worksheet-purple hover:underline inline-flex items-center gap-1"
            >
              {photographer}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <span className="font-medium">{photographer}</span>
          )}
          <span>on</span>
          <a
            href="https://unsplash.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-worksheet-purple hover:underline inline-flex items-center gap-1"
          >
            Unsplash
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
}
