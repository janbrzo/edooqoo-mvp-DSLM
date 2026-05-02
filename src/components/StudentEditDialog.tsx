
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tables } from '@/integrations/supabase/types';
import { NATIVE_LANGUAGES } from '@/types/flashcards';
import { MAIN_GOALS, ENGLISH_LEVELS, isStandardGoal } from '@/constants/studentGoals';

type Student = Tables<'students'>;

interface StudentEditDialogProps {
  student: Student;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Pick<Student, 'name' | 'english_level' | 'main_goal' | 'student_email' | 'send_overdue_emails' | 'native_language'>>) => Promise<any>;
}

export const StudentEditDialog: React.FC<StudentEditDialogProps> = ({
  student,
  isOpen,
  onClose,
  onSave
}) => {
  const [name, setName] = useState(student.name);
  const [englishLevel, setEnglishLevel] = useState(student.english_level);
  const [mainGoal, setMainGoal] = useState(student.main_goal);
  const [studentEmail, setStudentEmail] = useState(student.student_email || '');
  const [sendOverdueEmails, setSendOverdueEmails] = useState(student.send_overdue_emails ?? true);
  const [nativeLanguage, setNativeLanguage] = useState(student.native_language || 'Spanish');
  const [customGoal, setCustomGoal] = useState(
    isStandardGoal(student.main_goal) ? '' : student.main_goal
  );
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const goalToSave = mainGoal === 'custom' ? customGoal : mainGoal;
      await onSave(student.id, {
        name,
        english_level: englishLevel,
        main_goal: goalToSave,
        student_email: studentEmail || null,
        send_overdue_emails: sendOverdueEmails,
        native_language: nativeLanguage
      });
      onClose();
    } catch (error) {
      console.error('Error updating student:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    // Reset form to original values
    setName(student.name);
    setEnglishLevel(student.english_level);
    setMainGoal(student.main_goal);
    setStudentEmail(student.student_email || '');
    setNativeLanguage(student.native_language || 'Spanish');
    setCustomGoal(isStandardGoal(student.main_goal) ? '' : student.main_goal);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Student Details</DialogTitle>
          <DialogDescription>
            Update the student's information below.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Student Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter student name"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="english-level">English Level</Label>
            <Select value={englishLevel} onValueChange={setEnglishLevel}>
              <SelectTrigger>
                <SelectValue placeholder="Select English level" />
              </SelectTrigger>
              <SelectContent>
                {ENGLISH_LEVELS.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    {level.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="main-goal">Main Goal</Label>
            <Select value={mainGoal} onValueChange={setMainGoal}>
              <SelectTrigger>
                <SelectValue placeholder="Select main goal" />
              </SelectTrigger>
              <SelectContent>
                {MAIN_GOALS.map((goal) => (
                  <SelectItem key={goal.value} value={goal.value}>
                    {goal.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="native-language">Native Language</Label>
            <Select value={nativeLanguage} onValueChange={setNativeLanguage}>
              <SelectTrigger id="native-language" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NATIVE_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {mainGoal === 'custom' && (
            <div className="grid gap-2">
              <Label htmlFor="custom-goal">Custom Goal</Label>
              <Input
                id="custom-goal"
                value={customGoal}
                onChange={(e) => setCustomGoal(e.target.value)}
                placeholder="Enter custom goal"
              />
            </div>
          )}
          
          <div className="grid gap-2">
            <Label htmlFor="student-email">Student Email (Optional)</Label>
            <Input
              id="student-email"
              type="email"
              value={studentEmail}
              onChange={(e) => setStudentEmail(e.target.value)}
              placeholder="student@example.com"
            />
            <p className="text-xs text-muted-foreground">
              Email will be used for homework notifications
            </p>
          </div>

          <div className="flex items-center justify-between space-x-2">
            <div className="space-y-0.5">
              <Label htmlFor="send-overdue">Send overdue homework emails</Label>
              <p className="text-xs text-muted-foreground">
                Automatically send reminders when homework is overdue
              </p>
            </div>
            <Switch 
              id="send-overdue" 
              checked={sendOverdueEmails} 
              onCheckedChange={setSendOverdueEmails} 
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
