
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Users, Loader2 } from 'lucide-react';
import { useStudents } from '@/hooks/useStudents';
import { useStudentSelector } from '@/hooks/useStudentSelector';
import { useAuthFlow } from '@/hooks/useAuthFlow';
import { Tables } from '@/integrations/supabase/types';

type Student = Tables<'students'>;

interface StudentSelectorProps {
  worksheetId: string;
  currentStudentId?: string | null;
  worksheetTitle?: string;
  onTransferSuccess?: (newStudentName?: string) => void;
  size?: 'sm' | 'default';
  className?: string;
}

export const StudentSelector: React.FC<StudentSelectorProps> = ({
  worksheetId,
  currentStudentId,
  worksheetTitle,
  onTransferSuccess,
  size = 'sm',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [lastTransferredStudentName, setLastTransferredStudentName] = useState<string | undefined>();
  const { user } = useAuthFlow();
  const { students } = useStudents();
  const { updateWorksheetStudent, isLoading } = useStudentSelector(() => {
    // Note: onTransferSuccess is now called directly in handleStudentChange
    // to pass the new student name
  });

  console.log('🔍 StudentSelector render debug:', {
    worksheetId,
    currentStudentId,
    studentsCount: students?.length || 0,
    students: students?.map(s => ({ id: s.id, name: s.name })) || [],
    isOpen,
    user: !!user
  });

  const handleStudentChange = async (newStudentId: string) => {
    if (!user?.id) return;
    
    // Handle "unassigned" option
    const studentId = newStudentId === 'unassigned' ? null : newStudentId;
    
    // Don't allow transferring to the same student
    if (studentId === currentStudentId) {
      setIsOpen(false);
      return;
    }
    
    const newStudentName = studentId 
      ? students.find(s => s.id === studentId)?.name
      : null;
    
    const success = await updateWorksheetStudent(
      worksheetId,
      studentId,
      user.id,
      worksheetTitle,
      newStudentName || undefined
    );
    
    if (success) {
      // PROBLEM 5.2: Pass new student name to callback for immediate UI update
      if (onTransferSuccess) {
        onTransferSuccess(newStudentName || 'Unassigned');
      }
      setIsOpen(false);
    }
  };

  // Handle click with proper event stopping
  const handleClick = (e: React.MouseEvent) => {
    console.log('🎯 StudentSelector clicked - stopping propagation');
    e.stopPropagation();
    e.preventDefault();
  };

  // Handle popover trigger click
  const handlePopoverTrigger = (e: React.MouseEvent) => {
    console.log('🎯 Popover trigger clicked, current isOpen:', isOpen);
    e.stopPropagation();
    e.preventDefault();
    setIsOpen(!isOpen);
  };

  const currentStudent = currentStudentId 
    ? students.find(s => s.id === currentStudentId) 
    : null;

  const buttonSize = size === 'sm' ? 'h-6 w-6' : 'h-8 w-8';
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <div onClick={handleClick} className="inline-flex" style={{ pointerEvents: 'auto' }}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`${buttonSize} p-0 hover:bg-muted ${className}`}
            disabled={isLoading}
            title="Transfer to another student"
            onClick={handlePopoverTrigger}
          >
            {isLoading ? (
              <Loader2 className={`${iconSize} animate-spin`} />
            ) : (
              <Users className={iconSize} />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <div className="p-3">
            <h4 className="font-medium mb-2">Transfer to Student</h4>
            <Select onValueChange={handleStudentChange} disabled={isLoading}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a student..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">
                  <span className="text-muted-foreground">Unassigned</span>
                </SelectItem>
                {students && students.length > 0 ? (
                  students
                    .filter(student => student.id !== currentStudentId)
                    .map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.name}
                      </SelectItem>
                    ))
                ) : (
                  <SelectItem value="no-students" disabled>
                    <span className="text-muted-foreground">No students available</span>
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {currentStudent && (
              <p className="text-xs text-muted-foreground mt-2">
                Currently assigned to: {currentStudent.name}
              </p>
            )}
            {!currentStudent && (
              <p className="text-xs text-muted-foreground mt-2">
                Currently unassigned
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
