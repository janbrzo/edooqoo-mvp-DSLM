import React, { useState, useEffect } from 'react';
import { ExternalLink, Pin, X, ChevronDown, ChevronUp, Maximize2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import DemoWatermark from './DemoWatermark';
import AudioPlayer from './AudioPlayer';
import { devLog } from '@/utils/logger';

interface MediaSectionProps {
  selectedImage?: {
    id: string;
    url: string;
    ai_generated_url?: string;
    description?: string;
    detailedDescription?: string;
    photographer?: string;
    photographerUrl?: string;
    source?: string;
  } | null;
  selectedAudio?: {
    id: string;
    url: string;
    ai_generated_audio_url?: string;
    transcript?: string;
    detailedTranscript?: string;
    duration?: number;
    voice?: string;
    source?: string;
  } | null;
  isDownloadUnlocked: boolean;
  isPinned?: boolean;
  onTogglePin?: () => void;
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
}

/**
 * P1.5 — Renders BOTH image and audio when a worksheet carries both.
 * Previously the audio branch returned early, silently dropping the image
 * on mixed-media worksheets.
 */
export default function MediaSection({
  selectedImage,
  selectedAudio,
  isDownloadUnlocked,
  isPinned = false,
  onTogglePin,
  isFullScreen = false,
  onToggleFullScreen
}: MediaSectionProps) {
  const [isImageCollapsed, setIsImageCollapsed] = useState(false);
  const [isAudioCollapsed, setIsAudioCollapsed] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [showPinLabel, setShowPinLabel] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => setShowPinLabel(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Determine which URL to use with intelligent fallback.
  // NOTE: hooks must run unconditionally — never move this below an early return.
  const imageUrl = React.useMemo(() => {
    if (!selectedImage) return "";
    if (!imageError) {
      if (selectedImage.ai_generated_url) return selectedImage.ai_generated_url;
      if (selectedImage.url && !selectedImage.url.startsWith('data:')) return selectedImage.url;
    }
    return selectedImage.url || "";
  }, [selectedImage, imageError]);

  devLog('🖼️ [MEDIASECTION] Rendering with media:', {
    hasImage: !!selectedImage,
    hasAudio: !!selectedAudio,
    imageId: selectedImage?.id,
    audioId: selectedAudio?.id,
    source: selectedImage?.source || selectedAudio?.source,
  });

  const hasAudio = !!(selectedAudio && (selectedAudio.url || selectedAudio.ai_generated_audio_url));
  const hasImage = !!(selectedImage && imageUrl);

  if (!hasImage && !hasAudio) return null;

  const displayDescription =
    selectedImage?.detailedDescription || selectedImage?.description || 'Lesson image';
  const isVertexAIGenerated = selectedImage?.source === 'vertex-ai-generated';

  return (
    <>
      {hasImage && (
        <div className="mb-8 bg-white border rounded-lg overflow-hidden shadow-sm p-6 relative">
          {!isDownloadUnlocked && <DemoWatermark />}

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Lesson Media</h2>
            <Button
              variant="outline"
              size="sm"
              data-no-pdf="true"
              onClick={() => setIsImageCollapsed(!isImageCollapsed)}
              className="flex items-center gap-2"
            >
              {isImageCollapsed ? (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Expand
                </>
              ) : (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Collapse
                </>
              )}
            </Button>
          </div>

          {!isImageCollapsed && (
            <div className="space-y-3">
              <div className="flex justify-center">
                <div className="relative rounded-lg overflow-hidden border-2 border-gray-200 shadow-sm max-w-3xl">
                  {imageLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100 min-h-[200px]">
                      <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin h-8 w-8 border-4 border-worksheet-purple border-t-transparent rounded-full"></div>
                        <p className="text-sm text-gray-600">Loading image...</p>
                      </div>
                    </div>
                  )}
                  <img
                    src={imageUrl}
                    alt={displayDescription}
                    className="w-full h-auto object-contain max-h-[400px] mx-auto cursor-pointer"
                    onClick={onToggleFullScreen}
                    onLoad={() => setImageLoading(false)}
                    onError={() => {
                      console.error('❌ [MEDIASECTION] Image load failed');
                      setImageLoading(false);
                      if (!imageError) {
                        setImageError(true);
                        toast({
                          title: "Image loading issue",
                          description: "Trying alternative image source...",
                        });
                      } else {
                        toast({
                          title: "Failed to load image",
                          description: "Please try regenerating the worksheet or contact support.",
                          variant: "destructive",
                        });
                      }
                    }}
                    title="Click to expand image"
                  />
                  {onTogglePin && onToggleFullScreen && (
                    <div className="absolute top-2 right-2 flex flex-col gap-2" data-no-pdf="true">
                      <div
                        className={cn(
                          "absolute -left-32 top-0 bg-worksheet-purple text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap transition-opacity duration-500",
                          showPinLabel ? "opacity-100" : "opacity-0"
                        )}
                      >
                        {isPinned ? "Unpin image" : "Pin image"}
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onTogglePin();
                            }}
                            className={cn(
                              "bg-white/90 hover:bg-white shadow-md",
                              isPinned && "bg-worksheet-purple text-white"
                            )}
                            aria-label={isPinned ? "Unpin image" : "Pin image"}
                          >
                            <Pin className={cn("h-4 w-4", isPinned && "fill-current")} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          <p>{isPinned ? "Unpin image" : "Pin image"}</p>
                        </TooltipContent>
                      </Tooltip>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFullScreen();
                        }}
                        className="bg-white/90 hover:bg-white shadow-md"
                        title="Expand image"
                        aria-label="Expand image"
                      >
                        <Maximize2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {isVertexAIGenerated ? (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                  <span>Photo by: </span>
                  <a
                    href="https://deepmind.google/models/gemini/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-worksheet-purple hover:underline inline-flex items-center gap-1"
                  >
                    Google Gemini Image (Vertex AI)
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ) : selectedImage?.photographer && (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                  <span>Photo by</span>
                  {selectedImage.photographerUrl ? (
                    <a
                      href={selectedImage.photographerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-worksheet-purple hover:underline inline-flex items-center gap-1"
                    >
                      {selectedImage.photographer}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="font-medium">{selectedImage.photographer}</span>
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

              {displayDescription && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-worksheet-purple text-center">
                    Show Description
                  </summary>
                  <div className="mt-2 p-4 bg-white rounded-lg border text-sm text-gray-600 text-center italic leading-relaxed">
                    {displayDescription}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      )}

      {hasAudio && (
        <div className="mb-8 bg-white border rounded-lg overflow-hidden shadow-sm p-6 relative">
          {!isDownloadUnlocked && <DemoWatermark />}

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">
              {hasImage ? 'Lesson Audio' : 'Lesson Media'}
            </h2>

            <div className="flex items-center gap-2" data-no-pdf="true">
              {onTogglePin && !hasImage && (
                <div className="flex items-center gap-2 pointer-events-none">
                  <div
                    className={cn(
                      "bg-worksheet-purple text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap transition-opacity duration-500",
                      showPinLabel ? "opacity-100" : "opacity-0"
                    )}
                  >
                    {isPinned ? "Unpin audio player" : "Pin audio player"}
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onTogglePin}
                        className={cn(
                          "flex items-center gap-2 pointer-events-auto",
                          isPinned && "bg-worksheet-purple text-white hover:bg-worksheet-purple/90"
                        )}
                      >
                        <Pin className={cn("h-4 w-4", isPinned && "fill-current")} />
                        {isPinned ? 'Unpin' : 'Pin'}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>{isPinned ? "Unpin audio player" : "Pin audio player"}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAudioCollapsed(!isAudioCollapsed)}
                className="flex items-center gap-2"
              >
                {isAudioCollapsed ? (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Expand
                  </>
                ) : (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Collapse
                  </>
                )}
              </Button>
            </div>
          </div>

          {!isAudioCollapsed && (
            <AudioPlayer
              audioUrl={selectedAudio!.ai_generated_audio_url || selectedAudio!.url || ''}
              transcript={selectedAudio!.transcript}
              duration={selectedAudio!.duration}
              voice={selectedAudio!.voice}
            />
          )}
        </div>
      )}

      {isFullScreen && hasImage && onToggleFullScreen && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 cursor-pointer"
          onClick={onToggleFullScreen}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFullScreen();
            }}
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white"
            aria-label="Close full screen image"
          >
            <X className="h-6 w-6" />
          </Button>
          <img src={imageUrl} alt={displayDescription} className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </>
  );
}
