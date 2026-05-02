import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useStudents } from '@/hooks/useStudents';
import { useAuthFlow } from '@/hooks/useAuthFlow';
import { duplicateWorksheetAPI } from '@/services/worksheetService/duplicateService';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';

interface DuplicateWorksheetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worksheetId: string;
  worksheetTitle: string;
  onSuccess: () => void;
}

export const DuplicateWorksheetModal = ({ 
  open, 
  onOpenChange, 
  worksheetId, 
  worksheetTitle,
  onSuccess 
}: DuplicateWorksheetModalProps) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string>('unassigned');
  const [loading, setLoading] = useState(false);
  const { students } = useStudents();
  const { user } = useAuthFlow();

  const handleDuplicate = async () => {
    if (!user?.id) {
      toast.error("Please log in to duplicate worksheets");
      return;
    }

    setLoading(true);
    try {
      const studentId = selectedStudentId === 'unassigned' ? null : selectedStudentId;
      const result = await duplicateWorksheetAPI(worksheetId, studentId, user.id);
      
      if (result.success) {
        const studentName = selectedStudentId === 'unassigned' 
          ? 'Unassigned' 
          : students.find(s => s.id === selectedStudentId)?.name || 'Unknown';
        
        toast.success(`Worksheet duplicated for ${studentName}!`);
        onOpenChange(false);
        onSuccess();
        setSelectedStudentId('unassigned'); // Reset selection
      } else {
        toast.error(result.error || "Failed to duplicate worksheet");
      }
    } catch (error: any) {
      console.error('Error duplicating worksheet:', error);
      toast.error(error.message || "Failed to duplicate worksheet");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Duplicate Worksheet
          </DialogTitle>
          <DialogDescription>
            Create a copy of "{worksheetTitle}" and assign it to a student
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="student-select">Assign to Student</Label>
            <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
              <SelectTrigger id="student-select">
                <SelectValue placeholder="Select a student" />
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-[200px] overflow-y-auto" sideOffset={5}>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {students.map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="flex justify-end space-x-2">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDuplicate}
            disabled={loading}
          >
            {loading ? 'Duplicating...' : 'Duplicate'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
