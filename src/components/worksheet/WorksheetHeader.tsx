
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Zap, Database, Clock, GraduationCap, User, Pencil } from "lucide-react";
import { GCalStatusButton } from "@/components/calendar/GCalStatusButton";
import { Link, useNavigate } from "react-router-dom";
import { StudentSelector } from "@/components/StudentSelector";
import { HomeworkNotificationBadge } from "@/components/homework/HomeworkNotificationBadge";
import { useAuthFlow } from "@/hooks/useAuthFlow";
import RenameDialog from "@/components/RenameDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WorksheetHeaderProps {
  onBack: () => void;
  generationTime: number;
  sourceCount: number;
  inputParams: any;
  studentName?: string;
  worksheetId?: string;
  studentId?: string;
  onStudentChange?: () => void;
  onStudentNameChange?: (newName: string) => void;
  tokenLeft?: number;
  worksheetTitle?: string;
  onTitleChange?: (newTitle: string) => void;
}

function WorksheetHeader({
  onBack,
  generationTime,
  sourceCount,
  inputParams,
  studentName,
  worksheetId,
  studentId: propsStudentId,
  onStudentChange,
  onStudentNameChange,
  tokenLeft,
  worksheetTitle,
  onTitleChange
}: WorksheetHeaderProps) {
  const { isRegisteredUser } = useAuthFlow();
  const navigate = useNavigate();
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  
  // Try to get student name from multiple sources
  const displayStudentName = studentName || 
    inputParams?.studentName || 
    (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('worksheetStudentName') : null);

  const studentId = propsStudentId || inputParams?.studentId || 
    (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('worksheetStudentId') : null);

  const handleBack = () => {
    window.history.back();
  };

  const handleGenerateNewWorksheet = () => {
    sessionStorage.setItem('forceNewWorksheet', 'true');
    navigate('/?forceNew=' + Date.now());
  };

  const handleStudentTransferSuccess = (newStudentName?: string) => {
    // PROBLEM 5.2: Immediately update UI with new student name
    if (onStudentNameChange && newStudentName) {
      onStudentNameChange(newStudentName);
    }
    // Update sessionStorage with new student info after transfer
    if (onStudentChange) {
      onStudentChange();
    }
  };
  
  const handleRenameWorksheet = async (newTitle: string) => {
    if (!worksheetId) return;
    
    try {
      const { error } = await supabase
        .from('worksheets')
        .update({ title: newTitle })
        .eq('id', worksheetId);
      
      if (error) throw error;
      
      toast.success('Worksheet renamed successfully');
      if (onTitleChange) onTitleChange(newTitle);
    } catch (error) {
      console.error('Error renaming worksheet:', error);
      toast.error('Failed to rename worksheet');
      throw error;
    }
  };

  console.log('🔍 WorksheetHeader debug:', {
    worksheetId,
    displayStudentName,
    studentId,
    inputParams,
    hasWorksheetId: !!worksheetId,
    isRegisteredUser
  });

  return (
    <div className="mb-6">
      <div className="flex gap-2 mb-4 justify-between items-center">
        {/* Left side: Back and Generate */}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <Button onClick={handleGenerateNewWorksheet}>
            Generate New Worksheet
          </Button>
        </div>
        
        {/* Right side: Tokens, bell, Dashboard, Profile - ONLY FOR REGISTERED USERS */}
        {isRegisteredUser && (
          <div className="flex items-center gap-3">
            {tokenLeft !== undefined && (
              <Badge variant="outline" className="text-sm px-3 py-1">
                Tokens Left: {tokenLeft}
              </Badge>
            )}
            <HomeworkNotificationBadge />
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard">
                <GraduationCap className="h-4 w-4 mr-2" />
                Dashboard
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/profile">
                <User className="h-4 w-4 mr-2" />
                Profile
              </Link>
            </Button>
            <GCalStatusButton />
          </div>
        )}
      </div>
      <div className="bg-worksheet-purple rounded-lg p-6">
        <div className="flex flex-col md:flex-row justify-between">
          <div>
            <h1 className="mb-1 font-bald text-white text-2xl font-semibold flex items-center gap-2">
              {/* PROBLEM 1: Dynamic title truncation based on student name length */}
              {(() => {
                const studentNameLength = displayStudentName?.length || 10;
                const maxTitleLength = Math.max(59 - 5 - studentNameLength, 20); // 5 = " for "
                const titleToDisplay = worksheetTitle || 'Your Generated Worksheet';
                const truncatedTitle = titleToDisplay.length > maxTitleLength 
                  ? titleToDisplay.substring(0, maxTitleLength) + '...'
                  : titleToDisplay;
                return (
                  <span title={worksheetTitle || 'Your Generated Worksheet'}>
                    {truncatedTitle}
                  </span>
                );
              })()}
              {/* Rename button */}
              {worksheetId && isRegisteredUser && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsRenameOpen(true)}
                  className="h-8 w-8 text-yellow-300 hover:bg-white/20"
                  title="Rename worksheet"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              <span className="text-yellow-300 flex items-center gap-2">
                <span>for</span>
                {displayStudentName ? (
                  studentId ? (
                    <a 
                      href={`/student/${studentId}`} 
                      className="hover:underline hover:text-yellow-200 transition-colors cursor-pointer"
                    >
                      {displayStudentName}
                    </a>
                  ) : displayStudentName
                ) : "Unassigned"}
                {/* Show StudentSelector when we have worksheetId OR fallback for anonymous users */}
                {(worksheetId || !studentId) && (
                  <StudentSelector
                    worksheetId={worksheetId || 'temp-id'}
                    currentStudentId={studentId}
                    worksheetTitle="Current Worksheet"
                    onTransferSuccess={handleStudentTransferSuccess}
                    className="hover:bg-white/20 text-yellow-300"
                    size="sm"
                  />
                )}
              </span>
            </h1>
          </div>
          <div className="flex gap-4 mt-4 md:mt-0">
            <div className="flex items-center gap-1 bg-white/20 px-4 py-2 rounded-md">
              <Zap className="h-4 w-4 text-yellow-300" />
              <span className="text-sm text-white">Generated in {generationTime}s</span>
            </div>
            <div className="flex items-center gap-1 bg-white/20 px-4 py-2 rounded-md">
              <Database className="h-4 w-4 text-blue-300" />
              <span className="text-sm text-white">Based on {sourceCount} sources</span>
            </div>
            <div className="flex items-center gap-1 bg-white/20 px-4 py-2 rounded-md">
              <Clock className="h-4 w-4 text-green-300" />
              <span className="text-sm text-white">{inputParams.lessonTime} lesson</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Rename Dialog */}
      <RenameDialog
        isOpen={isRenameOpen}
        onClose={() => setIsRenameOpen(false)}
        currentTitle={worksheetTitle || 'Untitled Worksheet'}
        onRename={handleRenameWorksheet}
        type="worksheet"
      />
    </div>
  );
}

export default WorksheetHeader;
