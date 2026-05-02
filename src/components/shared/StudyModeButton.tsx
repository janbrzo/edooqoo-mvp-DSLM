// ============================================
// FAZA 3: Big Study Button for Shared Worksheets
// ============================================

import { Button } from '@/components/ui/button';
import { PlayCircle } from 'lucide-react';

interface StudyModeButtonProps {
  onStartStudy: () => void;
  worksheetTitle: string;
}

export const StudyModeButton = ({ onStartStudy, worksheetTitle }: StudyModeButtonProps) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
      {/* Semi-transparent overlay */}
      <div className="absolute inset-0 bg-black/20 pointer-events-auto" onClick={onStartStudy} />
      
      {/* Big circular Study button */}
      <div className="relative z-10 flex flex-col items-center pointer-events-auto">
        <Button
          onClick={onStartStudy}
          className="w-32 h-32 rounded-full bg-worksheet-purple hover:bg-worksheet-purpleDark 
                     shadow-2xl transition-all duration-300 hover:scale-110 
                     flex flex-col items-center justify-center gap-2"
        >
          <PlayCircle className="h-12 w-12" />
          <span className="text-lg font-bold">Study</span>
        </Button>
        
        <div className="mt-6 bg-white/95 backdrop-blur-sm rounded-lg px-6 py-3 shadow-lg max-w-sm text-center">
          <p className="text-sm text-gray-600">
            Click <span className="font-semibold text-worksheet-purple">Study</span> to start filling in exercises.
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Your answers will be automatically saved.
          </p>
        </div>
      </div>
    </div>
  );
};
