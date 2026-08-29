import React, { useState, useEffect } from "react";
import { devLog } from '@/utils/logger';

import { Button } from "@/components/ui/button";
import { Edit, Lightbulb, User, Download, Lock, Loader2, Share2, Gift, BookOpen, Copy, Radio, Paintbrush, Eye, EyeOff, Plus } from "lucide-react";
import { isFreeCustomDemoWeek } from "@/utils/promoUtils";
import PaymentPopup from "@/components/PaymentPopup";
import ShareWorksheetModal from "@/components/ShareWorksheetModal";
import { DuplicateWorksheetButton } from "@/components/DuplicateWorksheetButton";
import { PublishWorksheetButton } from "@/components/worksheet/PublishWorksheetButton";
import { LoginRequiredModal } from "@/components/LoginRequiredModal";
import { exportAsHTML } from "@/utils/htmlExport";

import { trackWorksheetEvent } from "@/services/worksheetService";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDownloadTracking } from "@/hooks/useDownloadTracking";
import { useAuthFlow } from "@/hooks/useAuthFlow";
import { supabase } from "@/integrations/supabase/client";
import { useDemoContext } from '@/contexts/DemoContext';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface WorksheetToolbarProps {
  viewMode: "student" | "teacher" | "live-session";
  setViewMode: (mode: "student" | "teacher" | "live-session") => void;
  hasLiveSessionData?: boolean;
  isEditing: boolean;
  isSaving?: boolean;
  handleEdit: () => void;
  handleSave: () => void;
  onDiscardChanges?: () => void;
  worksheetId?: string | null;
  userIp?: string | null;
  isDownloadUnlocked?: boolean;
  onDownloadUnlock?: (token: string) => void;
  onTrackDownload?: () => void;
  showPdfButton?: boolean;
  editableWorksheet: any;
  userId?: string;
  onExpandAll?: () => void;
  onCloseSidebar?: () => void;
  onCreateHomework?: () => void;
  onAddExercise?: () => void;
  onDuplicateSuccess?: () => void;
  // P1.4 — autosave state surfaced to the teacher
  autosaveStatus?: 'disabled' | 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
  autosaveLastSavedAt?: Date | null;
  /** Forces a save (used before sharing) and resolves when the DB is up to date. */
  onFlushSave?: () => Promise<boolean | void>;
  // Drawing overlay props (for Live Session mode)
  isDrawingEnabled?: boolean;
  isDrawingLayerVisible?: boolean;
  onDrawingToggle?: () => void;
  onDrawingLayerToggle?: () => void;
}


const WorksheetToolbar = ({
  viewMode,
  setViewMode,
  hasLiveSessionData = false,
  isEditing,
  isSaving = false,
  handleEdit,
  handleSave,
  onDiscardChanges,
  worksheetId,
  userIp,
  isDownloadUnlocked = false,
  onDownloadUnlock,
  onTrackDownload,
  showPdfButton = false,
  editableWorksheet,
  userId,
  onExpandAll,
  onCloseSidebar,
  onCreateHomework,
  onAddExercise,
  onDuplicateSuccess,
  autosaveStatus = 'disabled',
  autosaveLastSavedAt = null,
  onFlushSave,
  isDrawingEnabled = false,
  isDrawingLayerVisible = false,
  onDrawingToggle,
  onDrawingLayerToggle,
}: WorksheetToolbarProps) => {
  const [showPaymentPopup, setShowPaymentPopup] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isPreparingShare, setIsPreparingShare] = useState(false);
  const [pendingAction, setPendingAction] = useState<'html-student' | 'html-teacher' | 'pdf' | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginFeatureName, setLoginFeatureName] = useState("");

  const isMobile = useIsMobile();
  const { trackDownloadAttempt } = useDownloadTracking(userId);
  const { user, isRegisteredUser } = useAuthFlow();
  const { isDemoMode } = useDemoContext();
  
  // PROBLEM 6 & 7: Track student email and share token status
  const [studentEmail, setStudentEmail] = useState<string | undefined>(undefined);
  const [hasActiveShareToken, setHasActiveShareToken] = useState(false);
  
  // Handler for locked features (anonymous users)
  const handleLockedFeatureClick = (featureName: string) => {
    setLoginFeatureName(featureName);
    setShowLoginModal(true);
  };
  
  // Fetch student email and share token status when worksheet changes
  useEffect(() => {
    const fetchWorksheetData = async () => {
      if (!worksheetId || isDemoMode) return;
      
      try {
        // Fetch worksheet data including share token and student_id
        const { data: worksheet, error: worksheetError } = await supabase
          .from('worksheets')
          .select('share_token, student_id')
          .eq('id', worksheetId)
          .single();
        
        if (worksheetError) throw worksheetError;
        
        // Check if share token exists (permanent links, no expiration)
        setHasActiveShareToken(!!worksheet?.share_token);
        
        // Fetch student email if student_id exists (PROBLEM 6)
        if (worksheet?.student_id) {
          const { data: student, error: studentError } = await supabase
            .from('students')
            .select('student_email')
            .eq('id', worksheet.student_id)
            .single();
          
          if (!studentError && student?.student_email) {
            setStudentEmail(student.student_email);
          }
        }
      } catch (error) {
        console.error('[WorksheetToolbar] Error fetching worksheet data:', error);
      }
    };
    
    fetchWorksheetData();
  }, [worksheetId, isDemoMode]);

  const handleDownloadHTML = async (downloadViewMode: "student" | "teacher") => {
    const originalViewMode = viewMode;

    const performExport = async () => {
      // Close sidebar before export to prevent overlay
      if (onCloseSidebar) {
        onCloseSidebar();
        // Wait for sidebar close to complete
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Expand all exercises before export to ensure full content is captured
      if (onExpandAll) {
        onExpandAll();
        // Wait for expansion to complete
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // Get the actual worksheet title from editableWorksheet
      const title = editableWorksheet?.title || 'English Worksheet';
      
      const timestamp = new Date().toISOString().split('T')[0];
      const viewModeText = downloadViewMode === 'teacher' ? 'Teacher' : 'Student';
      const sanitizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const filename = `${timestamp}-${viewModeText}-${sanitizedTitle}.html`;
      
      devLog(`Preparing to download HTML for ${downloadViewMode} view.`);
      
      const success = await exportAsHTML('worksheet-content', filename, downloadViewMode, title);
      
      if (success) {
        if (onTrackDownload) {
          onTrackDownload();
        }
        
        if (worksheetId) {
          try {
            devLog(`Attempting to track download for worksheet: ${worksheetId}`);
            await trackWorksheetEvent('download', worksheetId, userIp || 'anonymous');
            devLog('Download tracked successfully in worksheets table');
          } catch (error) {
            console.error('Failed to track download in worksheets table:', error);
          }
        } else {
          devLog('No worksheetId provided, skipping worksheet table tracking');
        }
      }
      if (!success) {
        console.error('Failed to export HTML');
      }
    };

    if (originalViewMode === downloadViewMode) {
      await performExport();
    } else {
      // Switch view, wait for DOM update, export, then switch back.
      setViewMode(downloadViewMode);
      // Use a short timeout to allow React to re-render the component tree.
      await new Promise(resolve => setTimeout(resolve, 200)); 
      try {
        await performExport();
      } finally {
        // Switch back to the original view mode.
        setViewMode(originalViewMode);
      }
    }
  };

  const handleDownloadClick = async (type: 'html-student' | 'html-teacher' | 'pdf') => {
    // Track download attempt with proper locked/unlocked distinction
    trackDownloadAttempt(!isDownloadUnlocked, worksheetId || 'unknown', {
      downloadType: type
    });

    if (isDownloadUnlocked) {
      if (type === 'html-student') {
        handleDownloadHTML('student');
      } else if (type === 'html-teacher') {
        handleDownloadHTML('teacher');
      }
    } else {
      setPendingAction(type);
      setShowPaymentPopup(true);
    }
  };

  const handlePaymentSuccess = (token: string) => {
    if (onDownloadUnlock) {
      onDownloadUnlock(token);
    }
    
    if (pendingAction === 'html-student') {
      handleDownloadHTML('student');
    } else if (pendingAction === 'html-teacher') {
      handleDownloadHTML('teacher');
    }
    
    setPendingAction(null);
  };

  const handlePaymentPopupClose = () => {
    setShowPaymentPopup(false);
    setPendingAction(null);
  };

  const handleShareClick = () => {
    devLog('Share button clicked');
    devLog('User:', user);
    devLog('Is registered user:', isRegisteredUser);
    devLog('Worksheet ID:', worksheetId);
    
    setShowShareModal(true);
  };

  // Check if user can share worksheets (registered user with valid worksheetId)
  const canShareWorksheet = isRegisteredUser && worksheetId && !user?.is_anonymous;
  
  // Check if FREE DEMO WEEK is active to show gift icon instead of lock
  const isFreeWeek = isFreeCustomDemoWeek();
  const shouldShowGiftIcon = isFreeWeek && !isDownloadUnlocked;

  return (
    <>
      <div className="sticky top-0 z-[60] bg-white border-b mb-6 py-3 px-4">
        <div className={`flex ${isMobile ? 'flex-col gap-3' : 'justify-between items-center'} max-w-[98%] mx-auto`}>
          <div className={`flex ${isMobile ? 'justify-center flex-wrap' : ''} space-x-2 items-center`}>
            <Button
              variant={viewMode === 'student' ? 'default' : 'outline'}
              onClick={() => setViewMode('student')}
              className={viewMode === 'student' ? 'bg-worksheet-purple hover:bg-worksheet-purpleDark' : ''}
              size="sm"
            >
              <User className="mr-2 h-4 w-4" />
              Student
            </Button>
            <Button
              variant={viewMode === 'teacher' ? 'default' : 'outline'}
              onClick={() => setViewMode('teacher')}
              className={viewMode === 'teacher' ? 'bg-worksheet-purple hover:bg-worksheet-purpleDark' : ''}
              size="sm"
            >
              <Lightbulb className="mr-2 h-4 w-4" />
              Teacher
            </Button>
            {/* Live Session button - disabled for anonymous users */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={viewMode === 'live-session' ? 'default' : 'outline'}
                  onClick={() => isRegisteredUser ? setViewMode('live-session') : handleLockedFeatureClick('Live Session')}
                  className={`${!isRegisteredUser 
                    ? 'opacity-50 cursor-not-allowed border-gray-300 text-gray-400'
                    : viewMode === 'live-session' 
                      ? 'bg-blue-600 hover:bg-blue-700' 
                      : 'border-blue-600 text-blue-600 hover:bg-blue-50'} ${hasLiveSessionData ? 'animate-pulse' : ''}`}
                  size="sm"
                >
                  <Radio className="mr-2 h-4 w-4" />
                  Live Session
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isRegisteredUser ? 'View student answers in real-time' : '🔒 Login to use Live Session'}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className={`flex ${isMobile ? 'flex-col gap-2' : 'items-center'}`}>
            {!isEditing && (
              <>
                <Button
                  variant="outline"
                  onClick={handleEdit}
                  className={`border-worksheet-purple text-worksheet-purple ${isMobile ? '' : 'mr-2'}`}
                  size="sm"
                >
                  <Edit className="mr-2 h-4 w-4" /> Edit
                </Button>
                
                {/* Duplicate Worksheet Button - visible for all, disabled for anonymous */}
                {worksheetId && (
                  isRegisteredUser ? (
                    <DuplicateWorksheetButton
                      worksheetId={worksheetId}
                      worksheetTitle={editableWorksheet?.title || 'Worksheet'}
                      onDuplicate={onDuplicateSuccess || (() => {})}
                      variant="outline"
                      size="sm"
                      className="border-worksheet-purple text-worksheet-purple mr-2"
                    />
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          onClick={() => handleLockedFeatureClick('Duplicate Worksheet')}
                          className="opacity-50 cursor-not-allowed border-gray-300 text-gray-400 mr-2"
                        size="sm"
                      >
                        <Copy className="mr-2 h-4 w-4" /> Duplicate
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>🔒 Login to duplicate worksheets</p>
                      </TooltipContent>
                    </Tooltip>
                  )
                )}

                {/* Sprint 3 (Plan v6.9.20) — Publish to public gallery (teachers only) */}
                {worksheetId && isRegisteredUser && (
                  <span className="mr-2">
                    <PublishWorksheetButton worksheetId={worksheetId} />
                  </span>
                )}
                
                {/* Share button - visible for all, disabled for anonymous */}
                {isRegisteredUser && canShareWorksheet ? (
                  <Button
                    variant="outline"
                    onClick={handleShareClick}
                    className={`${hasActiveShareToken ? 'border-2 border-green-500' : 'border-worksheet-purple'} text-worksheet-purple ${isMobile ? '' : 'mr-2'}`}
                    size="sm"
                  >
                    <Share2 className="mr-2 h-4 w-4" /> Share
                  </Button>
                ) : !isRegisteredUser && worksheetId && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        onClick={() => handleLockedFeatureClick('Share Worksheet')}
                        className="opacity-50 cursor-not-allowed border-gray-300 text-gray-400 mr-2"
                        size="sm"
                      >
                        <Share2 className="mr-2 h-4 w-4" /> Share
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>🔒 Login to share worksheets</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                
                {/* Create Homework button - visible for all, disabled for anonymous */}
                {isRegisteredUser && onCreateHomework ? (
                  <Button
                    variant="outline"
                    onClick={onCreateHomework}
                    className={`border-worksheet-purple text-worksheet-purple ${isMobile ? '' : 'mr-2'}`}
                    size="sm"
                  >
                    <BookOpen className="mr-2 h-4 w-4" /> {viewMode === 'live-session' ? 'Homework' : 'Create Homework'}
                  </Button>
                ) : !isRegisteredUser && worksheetId && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        onClick={() => handleLockedFeatureClick('Create Homework')}
                        className="opacity-50 cursor-not-allowed border-gray-300 text-gray-400 mr-2"
                        size="sm"
                      >
                        <BookOpen className="mr-2 h-4 w-4" /> Homework
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>🔒 Login to create homework</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                
                {/* Add Exercise button - only in Live Session */}
                {viewMode === 'live-session' && isRegisteredUser && onAddExercise && (
                  <Button
                    variant="outline"
                    onClick={onAddExercise}
                    className={`border-green-600 text-green-600 hover:bg-green-50 ${isMobile ? '' : 'mr-2'}`}
                    size="sm"
                  >
                    <Plus className="mr-2 h-4 w-4" /> Add Exercise
                  </Button>
                )}
              </>
            )}
            {isEditing && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleSave}
                      disabled={isSaving}
                      className={`bg-green-600 hover:bg-green-700 ${isMobile ? '' : 'mr-2'}`}
                      size="sm"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save Changes'
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Ctrl+S / Cmd+S</p>
                  </TooltipContent>
                </Tooltip>
                {onDiscardChanges && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={onDiscardChanges}
                        disabled={isSaving}
                        variant="outline"
                        className={`border-red-500 text-red-500 hover:bg-red-50 ${isMobile ? '' : 'mr-2'}`}
                        size="sm"
                      >
                        Discard Changes
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Press Escape</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </>
            )}
            {/* In Live Session mode: show Draw button instead of Download buttons */}
            {viewMode === 'live-session' && onDrawingToggle ? (
              <div className="flex gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={onDrawingToggle}
                      className={`${isDrawingEnabled 
                        ? 'bg-amber-500 hover:bg-amber-600' 
                        : 'bg-worksheet-purple hover:bg-worksheet-purpleDark'} ${isMobile ? 'w-full' : ''}`}
                      size="sm"
                    >
                      <Paintbrush className="mr-2 h-4 w-4" />
                      {isDrawingEnabled ? 'Stop Drawing' : 'Draw'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isDrawingEnabled ? 'Stop drawing mode (drawings stay visible)' : 'Draw annotations on the worksheet'}</p>
                  </TooltipContent>
                </Tooltip>
                {onDrawingLayerToggle && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={onDrawingLayerToggle}
                        variant="outline"
                        className="border-worksheet-purple text-worksheet-purple"
                        size="sm"
                      >
                        {isDrawingLayerVisible ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                        {isDrawingLayerVisible ? 'Hide' : 'Show'}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{isDrawingLayerVisible ? 'Hide drawing layer' : 'Show drawing layer'}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            ) : (
              <div className={`flex ${isMobile ? 'flex-col gap-2' : 'gap-2'}`}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => handleDownloadClick('html-student')}
                      className={`${isDownloadUnlocked 
                        ? 'bg-worksheet-purple hover:bg-worksheet-purpleDark' 
                        : 'bg-gray-400 hover:bg-gray-500'} ${isMobile ? 'w-full' : ''}`}
                      size="sm"
                    >
                      {isDownloadUnlocked ? (
                        <Download className="mr-2 h-4 w-4" />
                      ) : shouldShowGiftIcon ? (
                        <Gift className="mr-2 h-4 w-4" />
                      ) : (
                        <Lock className="mr-2 h-4 w-4" />
                      )}
                      {isMobile ? 'Student (HTML)' : 'Download STUDENT'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Download as HTML file. Best quality, works offline. Double-click to open.</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => handleDownloadClick('html-teacher')}
                      className={`${isDownloadUnlocked 
                        ? 'bg-worksheet-purple hover:bg-worksheet-purpleDark' 
                        : 'bg-gray-400 hover:bg-gray-500'} ${isMobile ? 'w-full' : ''}`}
                      size="sm"
                    >
                      {isDownloadUnlocked ? (
                        <Download className="mr-2 h-4 w-4" />
                      ) : shouldShowGiftIcon ? (
                        <Gift className="mr-2 h-4 w-4" />
                      ) : (
                        <Lock className="mr-2 h-4 w-4" />
                      )}
                      {isMobile ? 'Teacher (HTML)' : 'Download TEACHER'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Download as HTML file. Best quality, works offline. Double-click to open.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        </div>
      </div>

      <PaymentPopup
        isOpen={showPaymentPopup}
        onClose={handlePaymentPopupClose}
        onPaymentSuccess={handlePaymentSuccess}
        worksheetId={worksheetId}
        userIp={userIp}
        isRegisteredUser={!!isRegisteredUser}
      />

      {/* PROBLEM 6: Pass studentEmail to ShareWorksheetModal */}
      {canShareWorksheet && (
        <ShareWorksheetModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          worksheetId={worksheetId!}
          worksheetTitle={editableWorksheet?.title || 'English Worksheet'}
          studentEmail={studentEmail}
        />
      )}

      {/* Login Required Modal for anonymous users */}
      <LoginRequiredModal
        open={showLoginModal}
        onOpenChange={setShowLoginModal}
        featureName={loginFeatureName}
      />
    </>
  );
};

export default WorksheetToolbar;
