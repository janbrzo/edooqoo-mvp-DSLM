
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
import { DeadlinePicker } from '@/components/shared/DeadlinePicker';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { devLog } from '@/utils/logger';
import { ALL_WELCOME_TEST_QUESTIONS } from '@/data/welcomeTestQuestions';
import { toast as sonnerToast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const ADD_STUDENT_DRAFT_KEY = 'add-student-dialog-draft';

interface AddStudentDialogProps {
  /** If provided, the dialog will NOT navigate to /student/:id on success —
   *  the caller takes over (e.g. WorksheetForm auto-selects the new student). */
  onStudentAdded?: (newStudent?: { id: string; name: string }) => void;
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
  const [mainGoal, setMainGoal] = useState<string>('custom');
  const [customGoal, setCustomGoal] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [sendOverdueEmails, setSendOverdueEmails] = useState(true);
  const [nativeLanguage, setNativeLanguage] = useState('Spanish');
  // v6.9.34 — 2-mode flow: `know` (teacher fills level+goal now),
  // `defer` (recommended; level/goal inferred from Welcome Test). The
  // `manual` opt-out was removed — teachers can still skip the test from
  // the student page after creation.
  const [mode, setMode] = useState<'know' | 'defer'>('defer');
  const deferProfile = mode !== 'know';
  const [mainGoalDeadline, setMainGoalDeadline] = useState<string>('');
  // v6.9.34 — default ON in both modes.
  const [sendTestWhenKnown, setSendTestWhenKnown] = useState(true);
  const autoSendWelcomeTest = mode === 'defer' ? true : sendTestWhenKnown;
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
    const finalLevel = deferProfile ? null : englishLevel;
    const finalGoal = deferProfile
      ? null
      : (mainGoal === 'custom' ? customGoal : mainGoal);
    if (!name || !studentEmail) return;
    if (!deferProfile && (!englishLevel || !finalGoal)) return;

    setLoading(true);
    try {
      const newStudent = await addStudent(
        name,
        finalLevel,
        finalGoal,
        studentEmail || undefined,
        sendOverdueEmails,
        nativeLanguage,
        deferProfile ? null : (mainGoalDeadline || null)
      );
      
      // Reset form and close dialog
      setName('');
      setEnglishLevel('');
      setMainGoal('custom');
      setCustomGoal('');
      setStudentEmail('');
      setSendOverdueEmails(true);
      setNativeLanguage('Spanish');
      setMode('defer');
      setSendTestWhenKnown(false);
      setMainGoalDeadline('');
      sessionStorage.removeItem(ADD_STUDENT_DRAFT_KEY);
      setOpen(false);
      
      // Refresh onboarding progress
      devLog('[AddStudentDialog] Force refreshing students hook and onboarding');
      refreshProgress();
      
      // Force refresh students
      await refetch();
      refreshProgress();

      // v6.9.34 — If autosend was requested, fire-and-forget the test
      // creation + email so the side-effect happens regardless of whether
      // the caller takes over navigation (inline-add in WorksheetForm).
      if (autoSendWelcomeTest && newStudent?.id && studentEmail) {
        // Best-effort: don't block UX on this.
        void (async () => {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            const teacherId = user?.id;
            if (!teacherId) return;
            // Reuse existing flow: create test row + questions + share token + email
            const mod = await import('@/hooks/useWelcomeTestActions');
            // Note: hook can't be called outside React, so call the underlying
            // Edge Function directly via the same pattern.
            void mod; // keep dynamic import for tree-shake safety
            // Inline lightweight version:
            const { data: existing } = await supabase
              .from('student_tests')
              .select('id, share_token')
              .eq('student_id', newStudent.id)
              .eq('teacher_id', teacherId)
              .eq('test_type', 'welcome')
              .is('deleted_at', null)
              .order('created_at', { ascending: false })
              .limit(1);
            let testId = existing?.[0]?.id ?? null;
            let shareToken: string | null = existing?.[0]?.share_token ?? null;
            if (!testId) {
              const { data: created, error: createErr } = await supabase
                .from('student_tests')
                .insert({
                  student_id: newStudent.id,
                  teacher_id: teacherId,
                  test_type: 'welcome',
                  title: `Welcome Test - ${newStudent.name}`,
                  description: 'Comprehensive placement & learning profile assessment',
                  attempt_number: 1,
                  status: 'pending',
                  total_questions: ALL_WELCOME_TEST_QUESTIONS.length,
                } as any)
                .select('id')
                .single();
              if (createErr || !created) throw createErr;
              testId = created.id;
              const rows = ALL_WELCOME_TEST_QUESTIONS.map((q: any, i: number) => ({
                test_id: testId,
                question_index: i,
                question_type: q.question_type,
                question_text: q.question_text,
                question_data: q.options ? { options: q.options } : {},
                correct_answer: q.correct_answer || '',
                explanation: q.description || null,
                element_type: q.element_type || null,
                difficulty_level: q.difficulty_level || null,
                skill_tags: q.nano_skill ? [q.nano_skill] : [],
              }));
              await supabase.from('student_test_questions').insert(rows as any);
            }
            if (!shareToken && testId) {
              const { data: tokRow } = await supabase
                .from('student_tests')
                .update({ share_token: crypto.randomUUID() } as any)
                .eq('id', testId)
                .select('share_token')
                .single();
              shareToken = tokRow?.share_token ?? null;
            }
            if (shareToken) {
              const { data: teacher } = await supabase
                .from('profiles')
                .select('first_name, last_name, email')
                .eq('id', teacherId)
                .single();
              const teacherName = teacher
                ? [teacher.first_name, teacher.last_name].filter(Boolean).join(' ') || teacher.email || ''
                : '';
              await supabase.functions.invoke('send-test-email', {
                body: {
                  shareToken,
                  recipientEmail: studentEmail,
                  testTitle: `Welcome Test - ${newStudent.name}`,
                  teacherName,
                  testType: 'welcome',
                },
              });
              sonnerToast.success(`Welcome Test sent to ${studentEmail}`);
            }
          } catch (err) {
            console.error('[AddStudentDialog] auto-send welcome test failed', err);
            sonnerToast.error('Welcome Test could not be sent automatically. You can send it manually from the student page.');
          }
        })();
      }

      // Notify parent component that student was added
      // v6.9.33 — when caller provides onStudentAdded it owns next navigation
      // (e.g. WorksheetForm auto-selects the new student without page nav).
      if (onStudentAdded) {
        devLog('🔄 Calling onStudentAdded callback (caller-controlled nav) ...');
        onStudentAdded(newStudent ? { id: newStudent.id, name: newStudent.name } : undefined);
      } else if (newStudent?.id) {
        // v6.9.34 — Default flow per Plan v6.9.34:
        //  • autosend ON  → focus Add Goal modal (test runs in background)
        //  • autosend OFF → focus Send Welcome Test banner
        const ts = Date.now();
        if (autoSendWelcomeTest) {
          navigate(`/student/${newStudent.id}?tab=dslm&view=goals&focus=add-goal-modal&_=${ts}`);
        } else {
          navigate(`/student/${newStudent.id}?tab=dslm&view=pathway&focus=send-welcome-test&_=${ts}`);
        }
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
      <DialogContent className="sm:max-w-[480px] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Student</DialogTitle>
          <DialogDescription>
            Only name + email are required. Defer level &amp; goal until after the Welcome Test if you prefer.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Row 1: name + email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="name" className="text-xs">Name <span className="text-destructive">*</span></Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Student's name"
                required
                autoFocus
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email" className="text-xs">Email <span className="text-destructive">*</span></Label>
              <Input
                id="email"
                type="email"
                value={studentEmail}
                onChange={(e) => setStudentEmail(e.target.value)}
                placeholder="student@example.com"
                required
                className="h-9"
              />
            </div>
          </div>

          {/* Row 2: native language (always shown — short) */}
          <div className="space-y-1">
            <Label htmlFor="native-language" className="text-xs">Native Language</Label>
            <Select value={nativeLanguage} onValueChange={setNativeLanguage}>
              <SelectTrigger id="native-language" className="h-9">
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

          {/* v6.9.33 — 3-mode setup */}
          <RadioGroup value={mode} onValueChange={(v: any) => setMode(v)} className="space-y-1.5">
            <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-2.5">
              <RadioGroupItem id="mode-know" value="know" className="mt-0.5" />
              <Label htmlFor="mode-know" className="flex-1 cursor-pointer">
                <span className="text-xs font-medium block">I already know my student</span>
                <span className="text-[11px] text-muted-foreground">
                  Set CEFR level and main goal now. Roadmap and Next Steps unlock immediately.
                </span>
              </Label>
            </div>
            <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-2.5">
              <RadioGroupItem id="mode-defer" value="defer" className="mt-0.5" />
              <Label htmlFor="mode-defer" className="flex-1 cursor-pointer">
                <span className="text-xs font-medium block">I don't know my student yet — fill from Welcome Test</span>
                <span className="text-[11px] text-muted-foreground">
                  Recommended. The test is sent right after creating. Roadmap + Next Steps unlock once the student completes it (usually 1–3 days). Use generic worksheets in the meantime.
                </span>
              </Label>
            </div>
            <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-2.5">
              <RadioGroupItem id="mode-manual" value="manual" className="mt-0.5" />
              <Label htmlFor="mode-manual" className="flex-1 cursor-pointer">
                <span className="text-xs font-medium block">Skip Welcome Test — I'll set everything manually later</span>
                <span className="text-[11px] text-muted-foreground">
                  You can add level, goals and roadmap any time from the student's page.
                </span>
              </Label>
            </div>
          </RadioGroup>

          {/* Level + Goal + Deadline — collapsed when deferred */}
          {mode === 'know' && (
            <div className="space-y-3 border-l-2 border-primary/30 pl-3">
              <div className="space-y-1">
                <Label htmlFor="level" className="text-xs">English Level (CEFR) <span className="text-destructive">*</span></Label>
                <Select value={englishLevel} onValueChange={setEnglishLevel} required>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENGLISH_LEVELS.map((level) => (
                      <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="goal" className="text-xs flex items-center gap-1.5">
                  Main Goal <span className="text-destructive">*</span>
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="What is Main Goal?">
                          <Info className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        Main Goal is the student's primary outcome (e.g. job interview in English, B2 exam). You'll be able to add Supporting Goals (sub-skills) and Additional Goals (side topics) later from the student's Goals tab.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <Select value={mainGoal} onValueChange={setMainGoal} required>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select main goal" />
                  </SelectTrigger>
                  <SelectContent>
                    {MAIN_GOALS.map((goal) => (
                      <SelectItem key={goal.value} value={goal.value}>{goal.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {mainGoal === 'custom' && (
                  <Input
                    placeholder="Describe the custom goal"
                    value={customGoal}
                    onChange={(e) => setCustomGoal(e.target.value)}
                    required
                    className="h-9 mt-1"
                  />
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Goal Deadline (optional)</Label>
                <DeadlinePicker value={mainGoalDeadline} onChange={setMainGoalDeadline} compact />
              </div>
              <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-2 mt-2">
                <Checkbox
                  id="send-test-known"
                  checked={sendTestWhenKnown}
                  onCheckedChange={(v) => setSendTestWhenKnown(!!v)}
                  className="mt-0.5"
                />
                <Label htmlFor="send-test-known" className="text-[11px] cursor-pointer">
                  Also send the Welcome Test (refines learning profile)
                </Label>
              </div>
            </div>
          )}

          {/* Overdue email toggle — compact row */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <Label htmlFor="send-overdue-new" className="text-xs text-muted-foreground cursor-pointer">
              Send overdue homework reminders
            </Label>
            <Switch
              id="send-overdue-new"
              checked={sendOverdueEmails}
              onCheckedChange={setSendOverdueEmails}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} size="sm">
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={
                loading ||
                !name ||
                !studentEmail ||
                (!deferProfile && (!englishLevel || !mainGoal || (mainGoal === 'custom' && !customGoal)))
              }
            >
              {loading ? 'Adding…' : (autoSendWelcomeTest ? 'Add & Send Test' : 'Add Student')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
