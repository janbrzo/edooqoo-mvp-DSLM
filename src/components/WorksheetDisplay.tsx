import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useDownloadTracking } from "@/hooks/useDownloadTracking";
import { usePaymentTracking } from "@/hooks/usePaymentTracking";
import { updateWorksheet } from "@/services/worksheetService";
import WorksheetHeader from "./worksheet/WorksheetHeader";
import InputParamsCard from "./worksheet/InputParamsCard";
import WorksheetToolbar from "./worksheet/WorksheetToolbar";
import WorksheetContainer from "./worksheet/WorksheetContainer";
import WorksheetContent from "./worksheet/WorksheetContent";
import WorksheetViewTracking from "./worksheet/WorksheetViewTracking";
import { useDownloadStatus } from "@/hooks/useDownloadStatus";
import { useIsMobile } from "@/hooks/use-mobile";
import { StudentKnowledgeFAB } from "@/components/student-knowledge/StudentKnowledgeFAB";
import { StudentKnowledgeMiniList } from "@/components/student-knowledge/StudentKnowledgeMiniList";
import { StudentKnowledgeToggleButton } from "@/components/student-knowledge/StudentKnowledgeToggleButton";
import { StudentKnowledgeFloatingPanel } from "@/components/student-knowledge/StudentKnowledgeFloatingPanel";
import { StudentKnowledgeLessonIdeasButton } from "@/components/student-knowledge/StudentKnowledgeLessonIdeasButton";
import { useStudentKnowledge } from "@/hooks/useStudentKnowledge";
import { useStudents } from "@/hooks/useStudents";
import { useFlashcardSets } from "@/hooks/useFlashcardSets";
import { useLiveSessionAnswers } from "@/hooks/useLiveSessionAnswers";
import { CreateHomeworkModal } from "@/components/homework/CreateHomeworkModal";
import { AddExerciseModal } from "@/components/worksheet/AddExerciseModal";
import { QuickAddWordToFlashcardsModal } from "@/components/flashcards/QuickAddWordToFlashcardsModal";
import { ViewFlashcardSetsModal } from "@/components/flashcards/ViewFlashcardSetsModal";
import { SelectWordFAB, QuickAddWordFAB } from "@/components/flashcards/FlashcardFABs";
import { SelectWordMode } from "@/components/worksheet/SelectWordMode";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Plus, TextSelect, Layers, Radio, StickyNote, Loader2, Lightbulb, User, Target, MoreHorizontal, Send } from "lucide-react";
import type { NewKnowledgeEntry, StudentKnowledgeEntry, UpdateKnowledgeEntry, KnowledgeCategory } from "@/types/studentKnowledge";
import { LoginRequiredModal } from "@/components/LoginRequiredModal";
import { StudentRequiredModal } from "@/components/StudentRequiredModal";
import { KNOWLEDGE_CATEGORIES } from "@/types/studentKnowledge";
import { devLog, devWarn } from '@/utils/logger';
// Drawing overlay imports
import { DrawingToolbar, DrawingOverlay, type DrawingOverlayRef } from "@/components/drawing";
import type { DrawingTool, DrawingColor, StrokeWidth } from "@/types/drawing";
import { DRAWING_COLORS, HIGHLIGHTER_COLORS, STROKE_WIDTHS } from "@/types/drawing";
import { supabase } from "@/integrations/supabase/client";
// Live Session Quick Notes panels
import { LiveSessionQuickNotes } from "./worksheet/LiveSessionQuickNotes";
import { DraftTeacherNotes } from "./worksheet/DraftTeacherNotes";

interface Exercise {
  type: string;
  title: string;
  icon: string;
  time: number;
  instructions: string;
  content?: string;
  questions?: any[];
  items?: any[];
  sentences?: any[];
  dialogue?: any[];
  word_bank?: string[];
  expressions?: string[];
  expression_instruction?: string;
  teacher_tip: string;
}

export interface Worksheet {
  title: string;
  subtitle: string;
  introduction: string;
  exercises: Exercise[];
  vocabulary_sheet: {
    term: string;
    meaning: string;
  }[];
}

interface WorksheetDisplayProps {
  worksheet: Worksheet;
  inputParams: any;
  generationTime: number;
  sourceCount: number;
  onBack: () => void;
  wordBankOrder?: any;
  onDownload?: () => void;
  worksheetId?: string | null;
  onFeedbackSubmit?: (rating: number, feedback: string) => void;
  editableWorksheet: any;
  setEditableWorksheet: (worksheet: any) => void;
  onDiscardChanges?: () => void;
  userId?: string;
  studentName?: string;
  studentId?: string;
  onStudentChange?: () => void;
  selectedImage?: any;
  selectedAudio?: any;
  audioUrl?: string;
  tokenLeft?: number;
  // PROBLEM 5: Title from database for proper rename sync
  worksheetTitle?: string;
}

export default function WorksheetDisplay({
  worksheet,
  inputParams,
  generationTime,
  sourceCount,
  onBack,
  wordBankOrder,
  onDownload,
  worksheetId,
  onFeedbackSubmit,
  editableWorksheet,
  setEditableWorksheet,
  onDiscardChanges,
  userId,
  studentName,
  studentId,
  onStudentChange,
  selectedImage,
  selectedAudio,
  audioUrl,
  tokenLeft,
  worksheetTitle
}: WorksheetDisplayProps) {
  // Problem #7: Default to Live Session for logged-in users, Teacher for anonymous
  const [viewMode, setViewMode] = useState<'student' | 'teacher' | 'live-session'>(
    userId ? 'live-session' : 'teacher'
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandAllRef, setExpandAllRef] = useState<(() => void) | null>(null);
  // ✅ NEW: Ref for scrollToExercise function from WorksheetContent
  const [scrollToExerciseRef, setScrollToExerciseRef] = useState<((index: number) => void) | null>(null);
  
  // PROBLEM 5.1 & 5.2: Local state for immediate UI updates
  const [localTitle, setLocalTitle] = useState(worksheetTitle || editableWorksheet?.title);
  const [localStudentName, setLocalStudentName] = useState(studentName);
  
  // Sync local states when props change
  useEffect(() => {
    setLocalTitle(worksheetTitle || editableWorksheet?.title);
  }, [worksheetTitle, editableWorksheet?.title]);
  
  useEffect(() => {
    setLocalStudentName(studentName);
  }, [studentName]);
  
  // ✅ Wrap onDiscardChanges to ALSO exit edit mode
  const handleDiscardChanges = () => {
    onDiscardChanges?.();
    setIsEditing(false); // Exit edit mode immediately after discarding changes
  };
  const [closeSidebarRef, setCloseSidebarRef] = useState<(() => void) | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const { toast } = useToast();
  const { isDownloadUnlocked, userIp, handleDownloadUnlock, trackDownload, checkTokenGeneratedWorksheet } = useDownloadStatus();
  const isMobile = useIsMobile();
  const { trackDownloadAttempt } = useDownloadTracking(userId);
  const { trackPaymentButtonClick } = usePaymentTracking(userId);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<'add' | 'view' | 'edit'>('add');
  const [selectedEntry, setSelectedEntry] = useState<StudentKnowledgeEntry | null>(null);
  
  // DRAWING OVERLAY: State for drawing mode (Live Session only)
  const [isDrawingEnabled, setIsDrawingEnabled] = useState(false);
  const [isDrawingLayerVisible, setIsDrawingLayerVisible] = useState(true); // NAPRAWKA v4: domyślnie widoczna
  const [hasExistingDrawings, setHasExistingDrawings] = useState(false);
  const [currentDrawingTool, setCurrentDrawingTool] = useState<DrawingTool>('marker');
  // NAPRAWKA v4: Osobne ustawienia dla każdego narzędzia
  // Każde narzędzie ma własny kolor i grubość linii
  const [toolSettings, setToolSettings] = useState({
    marker: { color: DRAWING_COLORS[0], strokeWidth: STROKE_WIDTHS[3] }, // Black, size 4
    highlighter: { color: HIGHLIGHTER_COLORS[0], strokeWidth: STROKE_WIDTHS[5] }, // Yellow semi-transparent, size 6
    arrow: { color: DRAWING_COLORS[3], strokeWidth: STROKE_WIDTHS[2] }, // Red, size 3
  });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [drawingIsSaving, setDrawingIsSaving] = useState(false);
  const [drawingLastSavedAt, setDrawingLastSavedAt] = useState<Date | null>(null);
  const drawingOverlayRef = useRef<DrawingOverlayRef>(null);
  const worksheetContentWrapperRef = useRef<HTMLDivElement>(null);
  
  // NAPRAWKA v4: Dynamicznie pobierz ustawienia dla aktualnego narzędzia
  const currentToolSettings = toolSettings[currentDrawingTool as keyof typeof toolSettings] || toolSettings.marker;
  const currentDrawingColor = currentToolSettings.color;
  const currentStrokeWidth = currentToolSettings.strokeWidth;

  // CRITICAL FIX: Inject selectedImage/selectedAudio/audioUrl into editableWorksheet
  // This ensures Lesson Media renders when opening worksheet from /student → Homework
  useEffect(() => {
    if (!editableWorksheet) return;
    
    let needsUpdate = false;
    const updates: any = {};

    // Check if we need to inject selectedImage
    if (selectedImage && !editableWorksheet.selected_image) {
      updates.selected_image = selectedImage;
      needsUpdate = true;
    }

    // Check if we need to inject selectedAudio
    if (selectedAudio && !editableWorksheet.selected_audio) {
      updates.selected_audio = selectedAudio;
      needsUpdate = true;
    }

    // Check if we need to inject audio_url
    if (audioUrl && !editableWorksheet.audio_url) {
      updates.audio_url = audioUrl;
      // Also inject other audio fields if available from selectedAudio
      if (selectedAudio) {
        if (selectedAudio.transcript && !editableWorksheet.audio_transcript) {
          updates.audio_transcript = selectedAudio.transcript;
        }
        if (selectedAudio.duration && !editableWorksheet.audio_duration) {
          updates.audio_duration = selectedAudio.duration;
        }
        if (selectedAudio.voice && !editableWorksheet.audio_voice) {
          updates.audio_voice = selectedAudio.voice;
        }
      }
      needsUpdate = true;
    }

    // Only update if something changed
    if (needsUpdate) {
      devLog('[WorksheetDisplay] Injecting media into editableWorksheet:', updates);
      setEditableWorksheet({
        ...editableWorksheet,
        ...updates
      });
    }
  }, [selectedImage, selectedAudio, audioUrl, editableWorksheet, setEditableWorksheet]);
  const [isMiniListOpen, setIsMiniListOpen] = useState(false);
  const [miniListPage, setMiniListPage] = useState(1);
  const [miniListCategoryFilter, setMiniListCategoryFilter] = useState<KnowledgeCategory | null>(null);
  const MINI_LIST_PAGE_SIZE = 8;
  const [showHomeworkModal, setShowHomeworkModal] = useState(false);
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [isAiEvalLoading, setIsAiEvalLoading] = useState(false);
  
  // Flashcard FAB buttons state (Problem 4)
  const [showQuickAddWordModal, setShowQuickAddWordModal] = useState(false);
  const [showViewSetsModal, setShowViewSetsModal] = useState(false);
  const [isSelectWordMode, setIsSelectWordMode] = useState(false);
  const [selectedWordForFlashcard, setSelectedWordForFlashcard] = useState('');
  
  // Login required modal state for anonymous users
  const [showLoginRequiredModal, setShowLoginRequiredModal] = useState(false);
  const [lockedFeatureName, setLockedFeatureName] = useState("");
  
  // Student required modal state for logged-in users without student
  const [showStudentRequiredModal, setShowStudentRequiredModal] = useState(false);
  const [studentRequiredFeatureName, setStudentRequiredFeatureName] = useState("");
  
  const handleLockedFeature = (featureName: string) => {
    if (!userId) {
      // Scenario C: anonymous user → LoginRequiredModal
      setLockedFeatureName(featureName);
      setShowLoginRequiredModal(true);
    } else {
      // Scenario B: logged in, no student → StudentRequiredModal
      setStudentRequiredFeatureName(featureName);
      setShowStudentRequiredModal(true);
    }
  };
  
  // Fetch all students for homework creation
  const { students } = useStudents();
  
  // Initialize student knowledge hook only if we have studentId and userId (teacherId)
  const shouldShowFAB = !!(studentId && userId && worksheetId);
  // Show FABs for ALL users when worksheetId exists (disabled for anonymous)
  const shouldShowFlashcardFABsForAll = !!worksheetId;
  const studentKnowledge = useStudentKnowledge({
    studentId: studentId || '',
    teacherId: userId || ''
  });
  
  // Fetch flashcard sets count for badge
  const { sets: flashcardSets } = useFlashcardSets(userId || '', studentId || '');
  const flashcardSetsCount = flashcardSets?.length || 0;
  
  // PROBLEM 1 FIX: Integrate Live Session for real-time student answers
  const { liveAnswers, liveItemEvaluations, liveAiEvaluations, liveAudioAnswers, studentEmail: liveStudentEmail, isConnected: isLiveConnected } = useLiveSessionAnswers({
    worksheetId: worksheetId || '',
    enabled: viewMode === 'live-session'
  });
  
  const shouldShowMiniList = shouldShowFAB && (studentKnowledge.entries?.length || 0) > 0;
  
  // CRITICAL FIX: Reconstruct selectedAudio/selectedImage from database fields
  // This fixes Problem 2 - media not loading from Dashboard
  useEffect(() => {
    if (!editableWorksheet || !worksheetId) return;
    
    devLog('🔍 Media reconstruction check:', {
      worksheetId,
      hasSelectedAudio: !!editableWorksheet.selected_audio,
      hasAudioUrl: !!editableWorksheet.audio_url,
      hasSelectedImage: !!editableWorksheet.selected_image,
      hasImageInFormData: !!editableWorksheet.form_data?.selectedImage
    });
    
    let needsUpdate = false;
    const updatedWorksheet = { ...editableWorksheet };
    
    // Reconstruct selectedAudio if NULL but audio_url exists
    if (!updatedWorksheet.selected_audio && updatedWorksheet.audio_url) {
      devLog('🎵 Reconstructing selectedAudio from database fields:', {
        audio_url: updatedWorksheet.audio_url,
        audio_transcript: updatedWorksheet.audio_transcript,
        audio_duration: updatedWorksheet.audio_duration,
        audio_voice: updatedWorksheet.audio_voice
      });
      updatedWorksheet.selected_audio = {
        url: updatedWorksheet.audio_url,
        ai_generated_audio_url: updatedWorksheet.audio_url,
        transcript: updatedWorksheet.audio_transcript || null,
        duration: updatedWorksheet.audio_duration || null,
        voice: updatedWorksheet.audio_voice || null,
        source: 'database-reconstructed'
      };
      needsUpdate = true;
    }
    
    // Reconstruct selectedImage if NULL but form_data has selectedImage
    if (!updatedWorksheet.selected_image && updatedWorksheet.form_data?.selectedImage) {
      devLog('🖼️ Reconstructing selectedImage from form_data');
      updatedWorksheet.selected_image = updatedWorksheet.form_data.selectedImage;
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      devLog('✅ Media reconstructed successfully, updating state');
      setEditableWorksheet(updatedWorksheet);
    } else {
      devLog('✅ No media reconstruction needed');
    }
  }, [worksheetId, editableWorksheet?.audio_url, editableWorksheet?.selected_audio, editableWorksheet?.selected_image]); // Run when worksheet or media fields change
  
  // FAZA A: Sprawdź czy istnieją rysunki przy załadowaniu - NAPRAWIONE v2
  // CRITICAL: Uruchamiaj tylko przy zmianie worksheetId (nie viewMode!)
  useEffect(() => {
    const checkExistingDrawings = async () => {
      if (!worksheetId) return;
      
      devLog('🎨 [Drawing] Checking existing drawings for worksheet:', worksheetId);
      
      try {
        const { data, error } = await supabase
          .from('worksheet_drawings')
          .select('id, drawing_data')
          .eq('worksheet_id', worksheetId)
          .maybeSingle();
        
        if (error) {
          devLog('🎨 [Drawing] Error checking drawings:', error.message);
          setHasExistingDrawings(false);
          return;
        }
        
        // NAPRAWKA: Sprawdź czy są faktyczne obiekty w rysunku
        const drawingData = data?.drawing_data as any;
        const hasDrawings = !!(drawingData?.objects && drawingData.objects.length > 0);
        
        devLog('🎨 [Drawing] Found drawings:', hasDrawings, 'Objects count:', drawingData?.objects?.length || 0);
        
        setHasExistingDrawings(hasDrawings);
      } catch (err) {
        devLog('🎨 [Drawing] Exception checking drawings:', err);
        setHasExistingDrawings(false);
      }
    };
    checkExistingDrawings();
  }, [worksheetId]); // TYLKO worksheetId - nie viewMode!

  // NAPRAWKA v5: ZAWSZE pokaż warstwę przy przełączeniu na Live Session
  // Używamy setTimeout żeby dać czas na mount DrawingOverlay przed ustawieniem widoczności
  useEffect(() => {
    devLog('🎨 [Drawing] ViewMode effect:', { viewMode, isDrawingLayerVisible });
    
    if (viewMode === 'live-session') {
      // NAPRAWKA v5: Użyj setTimeout żeby dać czas na mount komponentu
      // To zapobiega race condition gdzie komponent nie jest jeszcze gotowy
      const timeoutId = setTimeout(() => {
        devLog('🎨 [Drawing] Auto-showing drawing layer (entering live-session, after delay)');
        setIsDrawingLayerVisible(true);
      }, 100); // 100ms daje czas na mount i inicjalizację canvas
      
      return () => clearTimeout(timeoutId);
    } else {
      // Tylko wyłącz tryb rysowania przy wyjściu z live-session
      if (isDrawingEnabled) {
        devLog('🎨 [Drawing] Disabling drawing mode (left live-session)');
        setIsDrawingEnabled(false);
      }
    }
  }, [viewMode]);

  // FAZA E: Select Word mode automatycznie włącza Select on Worksheet
  useEffect(() => {
    if (isSelectWordMode && isDrawingEnabled) {
      devLog('🎨 [Drawing] Select Word mode active - switching to select-worksheet tool');
      setCurrentDrawingTool('select-worksheet');
    }
  }, [isSelectWordMode, isDrawingEnabled]);

  useEffect(() => {
    validateWorksheetStructure();
    
    // AUTO-UNLOCK: Check if this is a token-generated worksheet
    if (userId && worksheetId) {
      devLog('🔍 Checking if worksheet should be auto-unlocked for user:', userId);
      checkTokenGeneratedWorksheet(worksheetId, userId);
    }
    
    const style = document.createElement('style');
    style.textContent = `
      @media print {
        @page {
          margin: 10mm;
        }
        
        .page-number {
          position: fixed;
          bottom: 10mm;
          right: 10mm;
          font-size: 10pt;
          color: #666;
        }
        
        .page-number::before {
          content: "Page " counter(page) " of " counter(pages);
        }
      }
      
      /* Mobile responsive styles */
      @media (max-width: 767px) {
        .container {
          padding: 10px !important;
        }
        
        .worksheet-content {
          padding: 15px !important;
        }
        
        .grid.grid-cols-1.md\\:grid-cols-4 {
          grid-template-columns: 1fr !important;
        }
        
        .grid.grid-cols-1.md\\:grid-cols-3 {
          grid-template-columns: 1fr !important;
        }
        
        .text-3xl {
          font-size: 1.5rem !important;
          line-height: 2rem !important;
        }
        
        .text-xl {
          font-size: 1.125rem !important;
          line-height: 1.5rem !important;
        }
        
        .p-6 {
          padding: 1rem !important;
        }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, [userId, worksheetId, checkTokenGeneratedWorksheet]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in input/textarea
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) {
        return;
      }
      
      // Don't intercept if modals are open (except for Escape)
      if (isPanelOpen || showHomeworkModal || showQuickAddWordModal || showViewSetsModal) {
        // Only handle Escape to close modals
        if (e.key === 'Escape') {
          if (showQuickAddWordModal) setShowQuickAddWordModal(false);
          else if (showViewSetsModal) setShowViewSetsModal(false);
          else if (showHomeworkModal) setShowHomeworkModal(false);
          else if (isPanelOpen) handleClosePanel();
        }
        return;
      }
      
      // Don't intercept if select word mode is active (Escape handled there)
      if (isSelectWordMode) {
        return;
      }

      // Ctrl/Cmd + S - Save when editing
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (isEditing) handleSave();
        return;
      }
      
      // Escape - Exit edit mode
      if (e.key === 'Escape') {
        if (isEditing && onDiscardChanges) handleDiscardChanges();
        return;
      }
      
      // N - Add Student Note (quick add)
      if (e.key.toLowerCase() === 'n' && shouldShowFAB) {
        e.preventDefault();
        handleAddNote();
        return;
      }
      
      // F - Quick Add Word to Flashcards
      if (e.key.toLowerCase() === 'f' && shouldShowFAB) {
        e.preventDefault();
        setSelectedWordForFlashcard('');
        setShowQuickAddWordModal(true);
        return;
      }
      
      // S - Select Word Mode
      if (e.key.toLowerCase() === 's' && shouldShowFAB && !isSelectWordMode) {
        e.preventDefault();
        setIsSelectWordMode(true);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, isPanelOpen, showHomeworkModal, showQuickAddWordModal, showViewSetsModal, shouldShowFAB, onDiscardChanges, isSelectWordMode]);
  
  const validateWorksheetStructure = () => {
    if (!worksheet) {
      toast({
        title: "Invalid worksheet data",
        description: "The worksheet data is missing or invalid.",
        variant: "destructive"
      });
      return;
    }
    
    if (!Array.isArray(worksheet.exercises) || worksheet.exercises.length === 0) {
      toast({
        title: "Missing exercises",
        description: "The worksheet doesn't contain any exercises.",
        variant: "destructive"
      });
      return;
    }
  };
  
  const handleEdit = () => {
    setIsEditing(true);
  };
  
  const handleSave = async () => {
    if (!worksheetId) {
      toast({
        title: "Cannot save changes",
        description: "Missing worksheet ID",
        variant: "destructive"
      });
      return;
    }

    // Handle anonymous users - save locally only
    if (!userId) {
      setIsEditing(false);
      toast({
        title: "Changes saved locally",
        description: "Your changes have been saved in this browser. Log in to save them to your account.",
        className: "bg-green-50 border-green-200"
      });
      devLog('📝 Anonymous user changes saved locally');
      return;
    }

    // Handle logged-in users - save to database
    setIsSaving(true);
    
    try {
      devLog('💾 Saving worksheet changes to database...');
      await updateWorksheet(worksheetId, editableWorksheet, userId);
      
      setIsEditing(false);
      toast({
        title: "Changes saved successfully",
        description: "Your worksheet has been updated and saved to the database.",
        className: "bg-green-50 border-green-200"
      });
      
      devLog('✅ Worksheet changes saved successfully');
    } catch (error) {
      console.error('❌ Error saving worksheet changes:', error);
      toast({
        title: "Failed to save changes",
        description: error instanceof Error ? error.message : "An unexpected error occurred while saving.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Enhanced download handler with tracking
  const handleDownloadWithTracking = () => {
    // Track download attempt with proper locked/unlocked distinction
    trackDownloadAttempt(isDownloadUnlocked, worksheetId || 'unknown');

    trackDownload();
    if (onDownload) {
      onDownload();
    }
  };

  // Enhanced payment unlock handler with tracking
  const handleDownloadUnlockWithTracking = (token: string) => {
    trackPaymentButtonClick(worksheetId || 'unknown', 1);

    handleDownloadUnlock(token);
  };

  const handleSaveEntry = async (data: NewKnowledgeEntry | { entryId: string; updates: UpdateKnowledgeEntry }) => {
    try {
      if ('entryId' in data) {
        // Edit existing entry
        await studentKnowledge.updateEntry(data.entryId, data.updates);
        toast({
          title: "Note updated",
          description: "Student knowledge entry has been updated successfully.",
          className: "bg-green-50 border-green-200"
        });
      } else {
        // Add new entry
        await studentKnowledge.addEntry(data);
        toast({
          title: "Note added",
          description: "Student knowledge entry has been added successfully.",
          className: "bg-green-50 border-green-200"
        });
      }
      setIsPanelOpen(false);
      setSelectedEntry(null);
      setPanelMode('add');
    } catch (error) {
      console.error('Error saving entry:', error);
      toast({
        title: "Error",
        description: "Failed to save the note. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleViewEntry = (entry: StudentKnowledgeEntry) => {
    setSelectedEntry(entry);
    setPanelMode('view');
    setIsPanelOpen(true);
  };

  const handleAddNote = () => {
    setSelectedEntry(null);
    setPanelMode('add');
    setPreSelectedCategory(undefined); // Regular add note
    setIsPanelOpen(true);
  };

  // PROBLEM 10: Handler for "Next Lesson Ideas" category - pre-selects category
  const [preSelectedCategory, setPreSelectedCategory] = useState<KnowledgeCategory | undefined>(undefined);
  
  const handleAddLessonIdea = () => {
    setSelectedEntry(null);
    setPanelMode('add');
    setPreSelectedCategory('Next Lesson Ideas');
    setIsPanelOpen(true);
  };
  
  // Reset preSelectedCategory when panel closes
  const handleClosePanelWithReset = () => {
    setIsPanelOpen(false);
    setSelectedEntry(null);
    setPanelMode('add');
    setPreSelectedCategory(undefined);
  };

  const handleClosePanel = () => {
    handleClosePanelWithReset();
  };

  const handleCreateHomework = async () => {
    if (!userId) {
      toast({
        title: "Login required",
        description: "Please log in to create homework assignments.",
        variant: "destructive"
      });
      return;
    }
    
    if (!worksheetId) {
      toast({
        title: "Cannot create homework",
        description: "Worksheet must be saved first.",
        variant: "destructive"
      });
      return;
    }
    
    // Show loading modal while AI eval runs
    setIsAiEvalLoading(true);
    
    // Trigger AI evaluation BEFORE opening modal (Problem 1A fix)
    try {
      devLog('[WorksheetDisplay] Triggering AI eval before Create Homework modal, worksheetId:', worksheetId);
      const { data, error } = await supabase.functions.invoke('process-pending-ai-evaluations', {
        body: { worksheet_id: worksheetId, trigger_source: 'create_homework' }
      });
      if (error) {
        console.error('[WorksheetDisplay] AI eval error:', error);
      } else {
        devLog('[WorksheetDisplay] AI eval result:', data);
      }
    } catch (err) {
      devWarn('[WorksheetDisplay] AI eval network error:', err);
    }
    
    setIsAiEvalLoading(false);
    setShowHomeworkModal(true);
  };

  const handleLoadMoreMiniList = () => {
    setMiniListPage(prev => prev + 1);
  };

  const totalEntries = studentKnowledge.entries?.length || 0;
  const hasMoreEntries = totalEntries >= miniListPage * MINI_LIST_PAGE_SIZE;

  // Get native language from student data
  const currentStudent = students.find(s => s.id === studentId);
  const nativeLanguage = currentStudent?.native_language || 'Spanish';

  return (
    <WorksheetViewTracking worksheetId={worksheetId} userId={userId}>
      {/* Select Word Mode Overlay */}
      <SelectWordMode
        isActive={isSelectWordMode}
        onWordSelected={(word) => {
          setSelectedWordForFlashcard(word);
          setIsSelectWordMode(false);
          setShowQuickAddWordModal(true);
        }}
        onCancel={() => setIsSelectWordMode(false)}
      />
      
      {/* Flashcard FAB Buttons - Green group (top) - FOR REGISTERED USERS */}
      {shouldShowFAB && (
        <>
          {/* View Flashcard Sets - with badge and animated label */}
          <div className="fixed top-[calc(50%-135px)] right-6 z-50 flex items-center gap-2 pointer-events-none">
            <div className="bg-green-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap opacity-0">
              View Flashcard Sets
            </div>
            <div className="relative pointer-events-auto">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setShowViewSetsModal(true)}
                    size="icon"
                    className="p-3 rounded-full shadow-lg bg-green-500 hover:bg-green-600 text-white"
                  >
                    <Layers className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="bg-green-500 text-white border-green-500">
                  <p>View Flashcard Sets</p>
                </TooltipContent>
              </Tooltip>
              {flashcardSetsCount > 0 && (
                <Badge 
                  variant="secondary" 
                  className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center p-0 text-xs bg-green-600 text-white border-2 border-background shadow-md z-10"
                >
                  {flashcardSetsCount > 9 ? '9+' : flashcardSetsCount}
                </Badge>
              )}
            </div>
          </div>
          
          {/* Select Word from Worksheet - with animated label */}
          <SelectWordFAB onClick={() => setIsSelectWordMode(true)} />
          
          {/* Quick Add Word - with animated label */}
          <QuickAddWordFAB onClick={() => {
            setSelectedWordForFlashcard('');
            setShowQuickAddWordModal(true);
          }} flashcardSetsCount={flashcardSetsCount} />
        </>
      )}
      
      {/* Flashcard FAB Buttons for ANONYMOUS USERS - disabled with login modal */}
      {shouldShowFlashcardFABsForAll && !shouldShowFAB && (
        <>
          {/* View Flashcard Sets - LOCKED */}
          <div className="fixed top-[calc(50%-135px)] right-6 z-50">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => handleLockedFeature('Flashcard Sets')}
                  size="icon"
                  className="p-3 rounded-full shadow-lg bg-gray-300 text-gray-500 cursor-not-allowed"
                >
                  <Layers className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                🔒 {userId ? 'Assign a student to view flashcard sets' : 'Login to view flashcard sets'}
              </TooltipContent>
            </Tooltip>
          </div>
          
          {/* Select Word - LOCKED */}
          <div className="fixed top-[calc(50%-90px)] right-6 z-50">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => handleLockedFeature('Select Word for Flashcards')}
                  size="icon"
                  className="p-3 rounded-full shadow-lg bg-gray-300 text-gray-500 cursor-not-allowed"
                >
                  <TextSelect className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                🔒 {userId ? 'Assign a student to select words' : 'Login to add flashcards'}
              </TooltipContent>
            </Tooltip>
          </div>
          
          {/* Quick Add Word - LOCKED */}
          <div className="fixed top-[calc(50%-45px)] right-6 z-50">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => handleLockedFeature('Quick Add Flashcard')}
                  size="icon"
                  className="p-3 rounded-full shadow-lg bg-gray-300 text-gray-500 cursor-not-allowed"
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                🔒 {userId ? 'Assign a student to add flashcards' : 'Login to add flashcards'}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Add Student Note - LOCKED */}
          <div className="fixed top-[calc(50%+5px)] right-6 z-50">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => handleLockedFeature('Student Notes')}
                  size="icon"
                  className="p-3 rounded-full shadow-lg bg-gray-300 text-gray-500 cursor-not-allowed"
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                🔒 {userId ? 'Assign a student to add notes' : 'Login to add notes'}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Lesson Ideas - LOCKED */}
          <div className="fixed top-[calc(50%+55px)] right-6 z-50">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => handleLockedFeature('Lesson Ideas')}
                  size="icon"
                  className="p-3 rounded-full shadow-lg bg-gray-300 text-gray-500 cursor-not-allowed"
                >
                  <Lightbulb className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                🔒 {userId ? 'Assign a student for lesson ideas' : 'Login for lesson ideas'}
              </TooltipContent>
            </Tooltip>
          </div>
        </>
      )}
      
      {/* Student Knowledge FAB, Toggle Button, Lesson Ideas Button, and Mini List */}
      {shouldShowFAB && (
        <>
          {/* PROBLEM 9: New Lesson Ideas button (above FAB) */}
          <StudentKnowledgeLessonIdeasButton onClick={handleAddLessonIdea} />
          <StudentKnowledgeFAB onClick={handleAddNote} />
          <StudentKnowledgeToggleButton
            count={totalEntries}
            isOpen={isMiniListOpen}
            onClick={() => setIsMiniListOpen(!isMiniListOpen)}
          />
          {!isPanelOpen && (
            <StudentKnowledgeMiniList
              entries={studentKnowledge.entries || []}
              onViewEntry={handleViewEntry}
              onLoadMore={handleLoadMoreMiniList}
              hasMore={hasMoreEntries}
              isLoading={studentKnowledge.isLoading}
              isLoadingMore={false}
              isOpen={isMiniListOpen}
              onToggle={() => setIsMiniListOpen(!isMiniListOpen)}
              selectedCategory={miniListCategoryFilter}
              onCategoryFilter={setMiniListCategoryFilter}
            />
          )}
        </>
      )}

      {/* Student Knowledge Floating Panel */}
      {shouldShowFAB && (
        <StudentKnowledgeFloatingPanel
          mode={panelMode}
          isOpen={isPanelOpen}
          onClose={handleClosePanel}
          entry={selectedEntry}
          studentId={studentId!}
          teacherId={userId!}
          studentName={studentName || ''}
          worksheetId={worksheetId || undefined}
          onSave={handleSaveEntry}
          suggestedTags={studentKnowledge.suggestedTags || []}
          onEdit={() => setPanelMode('edit')}
          preSelectedCategory={preSelectedCategory}
          hideCategories={preSelectedCategory === 'Next Lesson Ideas'} // PROBLEM 6: Only show "Next Lesson Ideas" category when lightbulb clicked
        />
      )}
      
      {/* Flashcard Modals (Problem 4) */}
      {shouldShowFAB && (
        <>
          <QuickAddWordToFlashcardsModal
            open={showQuickAddWordModal}
            onOpenChange={setShowQuickAddWordModal}
            studentId={studentId!}
            teacherId={userId!}
            worksheetId={worksheetId || undefined}
            nativeLanguage={nativeLanguage}
            initialWord={selectedWordForFlashcard}
          />
          <ViewFlashcardSetsModal
            open={showViewSetsModal}
            onOpenChange={setShowViewSetsModal}
            studentId={studentId!}
            teacherId={userId!}
            studentName={studentName}
          />
        </>
      )}
      
      <WorksheetContainer
        worksheetId={worksheetId}
        onDownload={handleDownloadWithTracking}
        isDownloadUnlocked={isDownloadUnlocked}
        viewMode={viewMode}
        editableWorksheet={editableWorksheet}
        selectedImage={inputParams?.selectedImage || editableWorksheet?.selected_image}
        selectedAudio={(() => {
          // Reconstruct selectedAudio from editableWorksheet
          return (editableWorksheet?.audio_url)
            ? {
                url: editableWorksheet.audio_url || null,
                ai_generated_audio_url: editableWorksheet.audio_url || null,
                transcript: editableWorksheet.audio_transcript || null,
                duration: editableWorksheet.audio_duration || null,
              }
            : (inputParams?.selectedAudio || editableWorksheet?.selected_audio || null);
        })()}
        isPinned={isPinned}
        onTogglePin={() => setIsPinned(!isPinned)}
        isFullScreen={isFullScreen}
        onToggleFullScreen={() => setIsFullScreen(!isFullScreen)}
      >
        <div className={`mb-6 ${isMobile ? 'px-2' : ''}`}>
          <WorksheetHeader
            onBack={onBack}
            generationTime={generationTime}
            sourceCount={sourceCount}
            inputParams={inputParams}
            studentName={localStudentName}
            worksheetId={worksheetId}
            studentId={studentId}
            onStudentChange={() => {
              onStudentChange?.();
            }}
            onStudentNameChange={(newName) => setLocalStudentName(newName)}
            tokenLeft={tokenLeft}
            // PROBLEM 5.1: Use local title for immediate UI update
            worksheetTitle={localTitle}
            onTitleChange={(newTitle) => {
              setLocalTitle(newTitle); // Immediate UI update
              setEditableWorksheet((prev: any) => ({ ...prev, title: newTitle }));
            }}
          />
          <InputParamsCard 
            inputParams={inputParams} 
            selectedExercises={inputParams.selectedExercises}
            exerciseFocusMap={inputParams.exerciseFocusMap}
            onExerciseClick={(exerciseType: string) => {
              // Find the actual index of the exercise in the worksheet by its type
              const activeExercises = editableWorksheet?.exercises?.filter((ex: any) => !ex.deleted) || [];
              const actualIndex = activeExercises.findIndex(
                (ex: any) => ex.type === exerciseType
              );
              
              // Scroll to exercise using the scrollToExercise function from WorksheetContent
              if (actualIndex >= 0 && scrollToExerciseRef) {
                scrollToExerciseRef(actualIndex);
              }
            }}
          />
          <WorksheetToolbar
            viewMode={viewMode}
            setViewMode={setViewMode}
            isEditing={isEditing}
            isSaving={isSaving}
            handleEdit={handleEdit}
            handleSave={handleSave}
            onDiscardChanges={handleDiscardChanges}
            worksheetId={worksheetId}
            userIp={userIp}
            isDownloadUnlocked={isDownloadUnlocked}
            onDownloadUnlock={handleDownloadUnlockWithTracking}
            onTrackDownload={trackDownload}
            showPdfButton={false}
            editableWorksheet={editableWorksheet}
            userId={userId}
            onExpandAll={expandAllRef || (() => {})}
            onCloseSidebar={closeSidebarRef || (() => {})}
            onCreateHomework={handleCreateHomework}
            onAddExercise={() => setShowAddExerciseModal(true)}
            isDrawingEnabled={isDrawingEnabled}
            isDrawingLayerVisible={isDrawingLayerVisible}
            onDrawingToggle={() => {
              setIsDrawingEnabled(!isDrawingEnabled);
              if (!isDrawingEnabled) setIsDrawingLayerVisible(true); // Draw włącza też widoczność
            }}
            onDrawingLayerToggle={() => setIsDrawingLayerVisible(!isDrawingLayerVisible)}
          />

          {/* DRAWING: Toolbar when drawing mode is enabled (Live Session only) */}
          {viewMode === 'live-session' && isDrawingEnabled && (
            <DrawingToolbar
              state={{
                isEnabled: isDrawingEnabled,
                activeTool: currentDrawingTool,
                activeColor: currentDrawingColor,
                strokeWidth: currentStrokeWidth,
                canUndo: canUndo,
                canRedo: canRedo,
                isSaving: drawingIsSaving,
                lastSavedAt: drawingLastSavedAt
              }}
              toolSettings={toolSettings}
              onToolChange={setCurrentDrawingTool}
              onColorChange={(color: DrawingColor) => {
                // NAPRAWKA v5: Zmienia kolor tylko dla aktualnego narzędzia
                setToolSettings(prev => ({
                  ...prev,
                  [currentDrawingTool]: { ...prev[currentDrawingTool as keyof typeof prev], color }
                }));
              }}
              onStrokeWidthChange={(strokeWidth: StrokeWidth) => {
                // NAPRAWKA v5: Zmienia grubość tylko dla aktualnego narzędzia
                setToolSettings(prev => ({
                  ...prev,
                  [currentDrawingTool]: { ...prev[currentDrawingTool as keyof typeof prev], strokeWidth }
                }));
              }}
              onUndo={() => drawingOverlayRef.current?.undo()}
              onRedo={() => drawingOverlayRef.current?.redo()}
              onClearAll={() => drawingOverlayRef.current?.clearAll()}
            />
          )}

          {/* Worksheet Content with Drawing Overlay */}
          <div className="relative" ref={worksheetContentWrapperRef}>
            <WorksheetContent
              editableWorksheet={editableWorksheet}
              isEditing={isEditing}
              viewMode={viewMode}
              setEditableWorksheet={setEditableWorksheet}
              worksheetId={worksheetId}
              onFeedbackSubmit={onFeedbackSubmit}
              isDownloadUnlocked={isDownloadUnlocked}
              inputParams={inputParams}
              userId={userId}
              studentId={studentId}
              onExpandAll={(expandFn: () => void) => setExpandAllRef(() => expandFn)}
              onScrollToExercise={(scrollFn: (index: number) => void) => setScrollToExerciseRef(() => scrollFn)}
              onCloseSidebar={(closeFn: () => void) => setCloseSidebarRef(() => closeFn)}
              isPinned={isPinned}
              onTogglePin={() => setIsPinned(!isPinned)}
              isFullScreen={isFullScreen}
              onToggleFullScreen={() => setIsFullScreen(!isFullScreen)}
              liveSessionAnswers={viewMode === 'live-session' ? liveAnswers : undefined}
              liveStudentEmail={viewMode === 'live-session' ? liveStudentEmail : undefined}
              isLiveConnected={viewMode === 'live-session' ? isLiveConnected : undefined}
              liveItemEvaluations={viewMode === 'live-session' ? liveItemEvaluations : undefined}
              liveAiEvaluations={viewMode === 'live-session' ? liveAiEvaluations : undefined}
              liveAudioAnswers={viewMode === 'live-session' ? liveAudioAnswers : undefined}
            />
            
            {/* DRAWING OVERLAY: Canvas overlay for drawing (Live Session only) */}
            {/* NAPRAWKA v4: Przekazuj isVisible do kontroli widoczności CSS */}
            {viewMode === 'live-session' && worksheetId && userId && (
              <DrawingOverlay
                ref={drawingOverlayRef}
                worksheetId={worksheetId}
                teacherId={userId}
                isTeacher={true}
                isEnabled={isDrawingEnabled}
                isVisible={isDrawingLayerVisible}
                externalTool={currentDrawingTool}
                externalColor={currentDrawingColor}
                externalStrokeWidth={currentStrokeWidth}
                hideToolbar={true}
                onHistoryChange={(newCanUndo, newCanRedo) => {
                  setCanUndo(newCanUndo);
                  setCanRedo(newCanRedo);
                }}
                onSaveStatusChange={(isSaving, lastSavedAt) => {
                  setDrawingIsSaving(isSaving);
                  setDrawingLastSavedAt(lastSavedAt);
                }}
              />
            )}
          </div>
        </div>
      </WorksheetContainer>
      
      {/* Live Session Quick Notes Panels - only in live-session mode with assigned student */}
      {viewMode === 'live-session' && studentId && userId && (
        <>
          <LiveSessionQuickNotes
            studentId={studentId}
            teacherId={userId}
            worksheetId={worksheetId || undefined}
            isVisible={true}
          />
          <DraftTeacherNotes
            worksheetId={worksheetId || undefined}
            isVisible={true}
          />
        </>
      )}
      
      {/* Disabled bottom panels when in live-session but no student/login */}
      {viewMode === 'live-session' && (!studentId || !userId) && worksheetId && (
        <>
          {/* Disabled Quick Notes - matches LiveSessionQuickNotes position */}
          <div 
            className="fixed bottom-4 left-4 z-[100] bg-white border-2 border-muted/50 rounded-lg shadow-xl w-[420px] opacity-50 cursor-not-allowed"
            onClick={() => handleLockedFeature('Quick Notes')}
          >
            <div className="flex items-center gap-1 px-3 py-2 border-b border-muted/30">
              <Button variant="ghost" size="icon" disabled className="h-7 w-7"><User className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" disabled className="h-7 w-7"><Target className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" disabled className="h-7 w-7"><StickyNote className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" disabled className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
            </div>
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="flex-1 h-8 rounded-md border bg-muted/30 px-3 flex items-center">
                <span className="text-sm text-muted-foreground">
                  {userId ? 'Assign a student to add notes...' : 'Login to add notes...'}
                </span>
              </div>
              <Button variant="ghost" size="icon" disabled className="h-8 w-8">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {/* Disabled Personal Notes - matches DraftTeacherNotes position */}
          <div 
            className="fixed bottom-4 left-[440px] z-[100] bg-white border-2 border-muted/50 rounded-lg shadow-xl w-72 opacity-50 cursor-not-allowed"
            onClick={() => handleLockedFeature('Personal Notes')}
          >
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="flex-1 h-8 rounded-md border bg-muted/30 px-3 flex items-center">
                <span className="text-sm text-muted-foreground">
                  {userId ? 'Assign student for notes...' : 'Login for notes...'}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
      
      {/* AI Evaluation Loading Modal */}
      {isAiEvalLoading && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-8 max-w-md mx-4 shadow-xl">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-worksheet-purple" />
              <p className="text-center font-medium text-gray-700">
                Analyzing student progress...
              </p>
              <p className="text-center text-sm text-gray-500">
                AI is evaluating open-ended answers for more accurate homework setup.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Homework Modal */}
      <CreateHomeworkModal
        open={showHomeworkModal}
        onOpenChange={setShowHomeworkModal}
        worksheetId={worksheetId || ''}
        worksheetTitle={editableWorksheet?.title || 'Worksheet'}
        exercises={editableWorksheet?.exercises || []}
        teacherId={userId || ''}
        students={students}
        preselectedStudent={studentId}
        worksheetFormData={inputParams}
        // PROBLEM 4.1: Include inputParams in media check for immediate detection after generation
        worksheetHasPicture={!!(
          selectedImage || 
          editableWorksheet?.selected_image || 
          editableWorksheet?.image_url ||
          inputParams?.selectedImage
        )}
        worksheetHasAudio={!!(
          selectedAudio || 
          editableWorksheet?.selected_audio || 
          editableWorksheet?.audio_url || 
          audioUrl ||
          inputParams?.selectedAudio
        )}
      />
      
      {/* Add Exercise Modal - Live Session */}
      <AddExerciseModal
        open={showAddExerciseModal}
        onOpenChange={setShowAddExerciseModal}
        worksheetId={worksheetId || ''}
        worksheetFormData={inputParams}
        currentExerciseCount={editableWorksheet?.exercises?.filter((ex: any) => !ex.deleted)?.length || 0}
        editableWorksheet={editableWorksheet}
        setEditableWorksheet={setEditableWorksheet}
        userId={userId || ''}
        worksheetHasPicture={!!(selectedImage || editableWorksheet?.selected_image || inputParams?.selectedImage)}
        worksheetHasAudio={!!(selectedAudio || editableWorksheet?.selected_audio || editableWorksheet?.audio_url || audioUrl || inputParams?.selectedAudio)}
      />
      
      {/* Login Required Modal for anonymous users */}
      <LoginRequiredModal
        open={showLoginRequiredModal}
        onOpenChange={setShowLoginRequiredModal}
        featureName={lockedFeatureName}
      />
      
      {/* Student Required Modal for logged-in users without student */}
      <StudentRequiredModal
        open={showStudentRequiredModal}
        onOpenChange={setShowStudentRequiredModal}
        featureName={studentRequiredFeatureName}
      />
    </WorksheetViewTracking>
  );
}
