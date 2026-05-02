import React, { useState, useRef, useEffect } from "react";
import { ArrowUp, Image, X, Maximize2, Headphones } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generatePDF } from "@/utils/pdfUtils";
import { FormData } from "@/components/WorksheetForm";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface WorksheetContainerProps {
  children: React.ReactNode;
  worksheetId?: string | null;
  onDownload?: () => void;
  isDownloadUnlocked: boolean;
  viewMode: "student" | "teacher" | "live-session";
  editableWorksheet: any;
  selectedImage?: {
    id: string;
    url: string;
    description: string;
    photographer: string;
    photographerUrl: string;
  } | null;
  selectedAudio?: {
    url?: string | null;
    ai_generated_audio_url?: string | null;
    transcript?: string | null;
    duration?: number | null;
  } | null;
  isPinned?: boolean;
  onTogglePin?: () => void;
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
}

export default function WorksheetContainer({
  children,
  worksheetId,
  onDownload,
  isDownloadUnlocked,
  viewMode,
  editableWorksheet,
  selectedImage,
  selectedAudio,
  isPinned = false,
  onTogglePin,
  isFullScreen = false,
  onToggleFullScreen
}: WorksheetContainerProps) {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const worksheetRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  // PROBLEM 2: Animated labels for Pin buttons (show for 5 seconds)
  const [showPinLabels, setShowPinLabels] = useState(true);
  
  useEffect(() => {
    const timer = setTimeout(() => setShowPinLabels(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const handleDownloadPDF = async () => {
    if (!isDownloadUnlocked) {
      toast({
        title: "Payment Required",
        description: "Please complete payment to download files.",
        variant: "destructive"
      });
      return;
    }

    if (worksheetRef.current) {
      try {
        const today = new Date();
        const formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const viewModeText = viewMode === 'teacher' ? 'Teacher' : 'Student';
        const filename = `${formattedDate}-${viewModeText}-${editableWorksheet.title.replace(/\s+/g, '-').toLowerCase()}.pdf`;
        
        const result = await generatePDF('worksheet-content', filename, viewMode === 'teacher', editableWorksheet.title);
        if (result) {
          toast({
            title: "PDF Downloaded",
            description: "Your worksheet has been downloaded successfully."
          });
          if (onDownload) {
            onDownload();
          }
        } else {
          toast({
            title: "PDF Generation Failed",
            description: "There was an error generating your PDF. Please try again.",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error('PDF generation error:', error);
        toast({
          title: "PDF Generation Failed",
          description: "There was an error generating your PDF. Please try again.",
          variant: "destructive"
        });
      }
    }
  };

  return (
    <div className="container mx-auto py-6" data-worksheet-id={worksheetId || undefined}>
      <style>{`
        @media print {
          @page {
            margin: 2mm 4.5mm 10mm 4.5mm !important;
          }
          .container {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .worksheet-content {
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>
      
      {children}
      
      {/* PROBLEM 2: Pin buttons - ALWAYS visible when media exists with elegant Tooltips */}
      {(selectedImage || selectedAudio) && onTogglePin && (
        <TooltipProvider>
          <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50 pointer-events-none">
            {/* Pin Image button - only show if image exists and no audio */}
            {selectedImage && !selectedAudio && (
              <div className="relative flex items-center pointer-events-auto">
                {/* Animated label - shows for 5 seconds on first load */}
                <span 
                  className={`absolute right-full mr-2 whitespace-nowrap bg-worksheet-purple text-white text-xs px-2 py-1 rounded shadow-lg transition-opacity duration-300 ${showPinLabels ? 'opacity-100 animate-in slide-in-from-right-2' : 'opacity-0 pointer-events-none'}`}
                >
                  {isPinned ? "Unpin image" : "Pin image"}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={onTogglePin}
                      className="rounded-full bg-worksheet-purple text-white p-3 shadow-lg cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
                      aria-label={isPinned ? "Unpin image" : "Pin image"}
                    >
                      <Image className="h-5 w-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="bg-worksheet-purple text-white border-worksheet-purple">
                    <p>{isPinned ? "Unpin image" : "Pin image"}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
            
            {/* Pin Audio button - only show if audio exists */}
            {selectedAudio && (
              <div className="relative flex items-center pointer-events-auto">
                {/* Animated label - shows for 5 seconds on first load */}
                <span 
                  className={`absolute right-full mr-2 whitespace-nowrap bg-worksheet-purple text-white text-xs px-2 py-1 rounded shadow-lg transition-opacity duration-300 ${showPinLabels ? 'opacity-100 animate-in slide-in-from-right-2' : 'opacity-0 pointer-events-none'}`}
                >
                  {isPinned ? "Unpin audio player" : "Pin audio player"}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={onTogglePin}
                      className="rounded-full bg-worksheet-purple text-white p-3 shadow-lg cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
                      aria-label={isPinned ? "Unpin audio player" : "Pin audio player"}
                    >
                      <Headphones className="h-5 w-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="bg-worksheet-purple text-white border-worksheet-purple">
                    <p>{isPinned ? "Unpin audio player" : "Pin audio player"}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        </TooltipProvider>
      )}
      
      {/* Scroll to top button - only visible after scrolling */}
      {showScrollTop && (
        <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-40" style={{ marginBottom: (selectedImage || selectedAudio) ? '60px' : '0' }}>
          <button 
            onClick={scrollToTop}
            className="rounded-full bg-worksheet-purple text-white p-3 shadow-lg cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
            aria-label="Scroll to top"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Pinned image in bottom right corner */}
      {isPinned && selectedImage && (
        <div 
          className="fixed bottom-6 right-24 z-40 bg-white border-2 border-gray-300 rounded-lg shadow-2xl overflow-hidden"
          style={{ width: '300px' }}
        >
          <div className="relative">
            <img
              src={selectedImage.url}
              alt={selectedImage.description || 'Lesson image'}
              className="w-full h-auto object-contain max-h-[200px]"
            />
            <div className="absolute top-1 right-1 flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleFullScreen}
                className="bg-white/80 hover:bg-white"
                title="Expand image"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onTogglePin}
                className="bg-white/80 hover:bg-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Full screen modal for pinned image */}
      {isFullScreen && selectedImage && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 cursor-pointer"
          onClick={onToggleFullScreen}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFullScreen?.();
            }}
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white"
          >
            <X className="h-6 w-6" />
          </Button>
          <img
            src={selectedImage.url}
            alt={selectedImage.description || 'Lesson image'}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </div>
  );
}
