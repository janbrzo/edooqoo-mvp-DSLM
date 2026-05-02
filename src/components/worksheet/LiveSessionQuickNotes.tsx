import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Send, 
  User, 
  Target, 
  StickyNote, 
  Lightbulb, 
  X,
  Minus,
  Pin,
  Trophy
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStudentKnowledge } from "@/hooks/useStudentKnowledge";
import { toast } from "sonner";
import { KnowledgeCategory, KNOWLEDGE_CATEGORIES } from "@/types/studentKnowledge";

interface LiveSessionQuickNotesProps {
  studentId: string;
  teacherId: string;
  worksheetId?: string;
  studentName?: string;
  isVisible: boolean;
  onClose?: () => void;
}

// Quick category buttons to show (using IDs that match KnowledgeCategory type)
const QUICK_CATEGORIES: { category: KnowledgeCategory; icon: React.ReactNode; label: string }[] = [
  { category: 'Personal', icon: <User className="h-4 w-4" />, label: 'Personal' },
  { category: 'Skill Assessment', icon: <Target className="h-4 w-4" />, label: 'Skills' },
  { category: 'Goals', icon: <Trophy className="h-4 w-4" />, label: 'Goals' },
  { category: 'Notes', icon: <StickyNote className="h-4 w-4" />, label: 'Notes' },
  { category: 'Next Lesson Ideas', icon: <Lightbulb className="h-4 w-4" />, label: 'Next Lesson' },
];

export const LiveSessionQuickNotes: React.FC<LiveSessionQuickNotesProps> = ({
  studentId,
  teacherId,
  worksheetId,
  studentName,
  isVisible,
  onClose,
}) => {
  const [noteText, setNoteText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<KnowledgeCategory>('Notes');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  // PROBLEM 6.3: Auto-hide header, show on hover or when pinned
  const [isHovered, setIsHovered] = useState(false);
  const [isHeaderPinned, setIsHeaderPinned] = useState(false);
  
  const { addEntry } = useStudentKnowledge({ studentId, teacherId });

  const handleSubmit = async () => {
    if (!noteText.trim()) {
      toast.error('Please enter a note');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await addEntry({
        content: noteText.trim(),
        category: selectedCategory,
        worksheet_id: worksheetId,
        entry_source: 'worksheet',
      });
      
      toast.success(`Added to ${selectedCategory}`);
      setNoteText('');
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error('Failed to add note');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isVisible) return null;
  
  // PROBLEM 6: Minimized state - positioned BELOW Draft Notes (at bottom)
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 left-4 z-[100]">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => setIsMinimized(false)}
              size="icon"
              className="rounded-full bg-primary text-primary-foreground shadow-lg h-12 w-12"
            >
              <StickyNote className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Open Quick Notes</p>
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  const showHeader = isHovered || isHeaderPinned;

  return (
    <div 
      className="fixed bottom-4 left-4 z-[100] bg-white border-2 border-primary/30 rounded-lg shadow-xl w-[420px]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* PROBLEM 6.3: Header - hidden by default, visible on hover or when pinned */}
      {showHeader && (
        <div className="flex items-center justify-between p-2 border-b animate-in fade-in duration-200">
          <span className="text-sm font-semibold text-primary flex items-center gap-2">
            <StickyNote className="h-4 w-4" />
            Quick Note {studentName && <span className="text-muted-foreground text-xs">for {studentName}</span>}
          </span>
          <div className="flex items-center gap-1">
            {/* Pin button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsHeaderPinned(!isHeaderPinned)} 
                  className={cn("h-6 w-6 p-0", isHeaderPinned && "text-primary bg-primary/10")}
                >
                  <Pin className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{isHeaderPinned ? 'Unpin header' : 'Pin header'}</p>
              </TooltipContent>
            </Tooltip>
            {/* Minimize button */}
            <Button variant="ghost" size="sm" onClick={() => setIsMinimized(true)} className="h-6 w-6 p-0">
              <Minus className="h-4 w-4" />
            </Button>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}
      
      {/* PROBLEM 6A: Horizontal layout - icons next to input */}
      <div className="flex items-center gap-1 p-2">
        {/* Quick Category Buttons */}
        {QUICK_CATEGORIES.map(({ category, icon, label }) => (
          <Tooltip key={category}>
            <TooltipTrigger asChild>
              <Button
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className={cn(
                  "h-9 w-9 p-0 flex-shrink-0",
                  selectedCategory === category && "bg-primary text-primary-foreground"
                )}
              >
                {icon}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{label}</p>
            </TooltipContent>
          </Tooltip>
        ))}
        
        {/* Input */}
        <Input
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={`Add ${selectedCategory.toLowerCase()} note...`}
          className="flex-1 h-9 text-sm min-w-0"
          disabled={isSubmitting}
        />
        
        {/* Send button */}
        <Button 
          onClick={handleSubmit} 
          size="sm" 
          className="h-9 w-9 p-0 flex-shrink-0"
          disabled={isSubmitting || !noteText.trim()}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default LiveSessionQuickNotes;
