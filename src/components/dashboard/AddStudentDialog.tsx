
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useStudents } from '@/hooks/useStudents';
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { NATIVE_LANGUAGES } from '@/types/flashcards';
import { MAIN_GOALS, ENGLISH_LEVELS } from '@/constants/studentGoals';
import { devLog } from '@/utils/logger';

const ADD_STUDENT_DRAFT_KEY = 'add-student-dialog-draft';

interface AddStudentDialogProps {
  onStudentAdded?: () => void;
  triggerButton?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  size?: 'sm' | 'default';
  variant?: 'default' | 'outline';
  prefillName?: string;
  prefillEmail?: string;
}

export const AddStudentDialog = ({ 
  onStudentAdded, 
  triggerButton = true,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
  size = 'default',
  variant = 'default',
  prefillName,
  prefillEmail,
}: AddStudentDialogProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const navigate = useNavigate();
  
  // Use external state if provided, otherwise use internal state
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = externalOnOpenChange || setInternalOpen;
  const [name, setName] = useState('');
  const [englishLevel, setEnglishLevel] = useState('');
  const [mainGoal, setMainGoal] = useState('');
  const [customGoal, setCustomGoal] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [sendOverdueEmails, setSendOverdueEmails] = useState(true);
  const [nativeLanguage, setNativeLanguage] = useState('Spanish');
  const [loading, setLoading] = useState(false);
  const { addStudent, refetch } = useStudents();
  const { refreshProgress } = useOnboardingProgress();

  // Prefill from props (e.g. from calendar notification)
  useEffect(() => {
    if (prefillName && open) setName(prefillName);
    if (prefillEmail && open) setStudentEmail(prefillEmail);
  }, [prefillName, prefillEmail, open]);

  // Load draft from sessionStorage on mount so data survives tab switches / remounts
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(ADD_STUDENT_DRAFT_KEY);
      if (!stored) return;
      const draft = JSON.parse(stored) as {
        name?: string;
        englishLevel?: string;
        mainGoal?: string;
        customGoal?: string;
        studentEmail?: string;
        nativeLanguage?: string;
        sendOverdueEmails?: boolean;
      };

      if (draft.name) setName(draft.name);
      if (draft.englishLevel) setEnglishLevel(draft.englishLevel);
      if (draft.mainGoal) setMainGoal(draft.mainGoal);
      if (draft.customGoal) setCustomGoal(draft.customGoal);
      if (draft.studentEmail) setStudentEmail(draft.studentEmail);
      if (draft.nativeLanguage) setNativeLanguage(draft.nativeLanguage);
      if (typeof draft.sendOverdueEmails === 'boolean') {
        setSendOverdueEmails(draft.sendOverdueEmails);
      }
    } catch (error) {
      console.error('[AddStudentDialog] Failed to load draft from sessionStorage', error);
    }
  }, []);

  // Persist draft to sessionStorage whenever fields change
  useEffect(() => {
    try {
      const isPristine =
        !name &&
        !englishLevel &&
        !mainGoal &&
        !customGoal &&
        !studentEmail &&
        sendOverdueEmails === true;

      if (isPristine) {
        sessionStorage.removeItem(ADD_STUDENT_DRAFT_KEY);
        return;
      }

      const draft = {
        name,
        englishLevel,
        mainGoal,
        customGoal,
        studentEmail,
        nativeLanguage,
        sendOverdueEmails,
      };

      sessionStorage.setItem(ADD_STUDENT_DRAFT_KEY, JSON.stringify(draft));
    } catch (error) {
      console.error('[AddStudentDialog] Failed to save draft to sessionStorage', error);
    }
  }, [name, englishLevel, mainGoal, customGoal, studentEmail, sendOverdueEmails]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalGoal = mainGoal === 'custom' ? customGoal : mainGoal;
    if (!name || !englishLevel || !finalGoal || !studentEmail) return;

    setLoading(true);
    try {
      // PROBLEM 7: addStudent returns the new student data
      const newStudent = await addStudent(name, englishLevel, finalGoal, studentEmail || undefined, sendOverdueEmails, nativeLanguage);
      
      // Reset form and close dialog
      setName('');
      setEnglishLevel('');
      setMainGoal('');
      setCustomGoal('');
      setStudentEmail('');
      setSendOverdueEmails(true);
      setNativeLanguage('Spanish');
      sessionStorage.removeItem(ADD_STUDENT_DRAFT_KEY);
      setOpen(false);
      
      // Refresh onboarding progress
      devLog('[AddStudentDialog] Force refreshing students hook and onboarding');
      refreshProgress();
      
      // Force refresh students
      await refetch();
      refreshProgress();
      
      // Notify parent component that student was added
      if (onStudentAdded) {
        devLog('🔄 Calling onStudentAdded callback...');
        onStudentAdded();
      }
      
      // PROBLEM 7: Navigate to new student's page with overview tab
      if (newStudent?.id) {
        devLog('🚀 Navigating to new student page:', newStudent.id);
        navigate(`/student/${newStudent.id}?tab=overview`);
      }
    } catch (error) {
      // Error handled in hook
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {triggerButton && (
        <DialogTrigger asChild>
          <Button size={size} variant={variant}>
            <Plus className="h-4 w-4 mr-2" />
            Add Student
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Student</DialogTitle>
          <DialogDescription>
            Add a new student to your class. You can update their information later.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Student Name <span className="text-destructive">*</span></Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter student's name"
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="level">English Level (CEFR) <span className="text-destructive">*</span></Label>
            <Select value={englishLevel} onValueChange={setEnglishLevel} required>
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
          <div className="space-y-2">
            <Label htmlFor="goal">Main Goal <span className="text-destructive">*</span></Label>
            <Select value={mainGoal} onValueChange={setMainGoal} required>
              <SelectTrigger>
                <SelectValue placeholder="Select main learning goal" />
              </SelectTrigger>
              <SelectContent>
                {MAIN_GOALS.map((goal) => (
                  <SelectItem key={goal.value} value={goal.value}>
                    {goal.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {mainGoal === 'custom' && (
              <Input
                placeholder="Enter custom learning goal"
                value={customGoal}
                onChange={(e) => setCustomGoal(e.target.value)}
                required={mainGoal === 'custom'}
              />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Student Email <span className="text-destructive">*</span></Label>
            <Input
              id="email"
              type="email"
              value={studentEmail}
              onChange={(e) => setStudentEmail(e.target.value)}
              placeholder="student@example.com"
              required
            />
            <p className="text-xs text-muted-foreground">
              Email will be used for homework notifications, shared worksheets, and Student Hub access.
            </p>
          </div>
          <div className="flex items-center justify-between space-x-2">
            <div className="space-y-0.5">
              <Label htmlFor="send-overdue-new">Send overdue homework emails</Label>
              <p className="text-xs text-muted-foreground">
                Automatically send reminders when homework is overdue
              </p>
            </div>
            <Switch 
              id="send-overdue-new" 
              checked={sendOverdueEmails} 
              onCheckedChange={setSendOverdueEmails} 
            />
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name || !englishLevel || !mainGoal || (mainGoal === 'custom' && !customGoal) || !studentEmail}>
              {loading ? 'Adding...' : 'Add Student'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
