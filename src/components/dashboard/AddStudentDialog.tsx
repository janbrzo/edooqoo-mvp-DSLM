
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
import { toast as sonnerToast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ensureWelcomeTest, sendWelcomeTestEmail } from '@/lib/welcomeTest/ensureWelcomeTest';
import { PasteIntakeSection } from './PasteIntakeSection';
import {
  applyIntakeExtraction,
  type IntakeExtractionPayload,
  type IntakeIncludes,
} from '@/lib/intake/applyIntakeExtraction';

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

  // v6.9.62 P6 — paste intake state
  const [pasteEnabled, setPasteEnabled] = useState(false);
  const [pasteRaw, setPasteRaw] = useState('');
  const [extraction, setExtraction] = useState<IntakeExtractionPayload | null>(null);
  const [extractionModel, setExtractionModel] = useState<string | null>(null);
  const [intakeIncludes, setIntakeIncludes] = useState<IntakeIncludes>({
    notes: true,
    signals: {},
    goals: {},
    english_level: true,
    main_goal: true,
    native_language: true,
    pacing: true,
  });

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

      // v6.9.62 P6 — Apply paste intake extraction (atomic RPC). Best-effort:
      // if it fails, the student row already exists; surface a retry toast.
      let intakeExtractionId: string | null = null;
      if (pasteEnabled && extraction && newStudent?.id) {
        try {
          const res = await applyIntakeExtraction({
            studentId: newStudent.id,
            payload: extraction,
            includes: intakeIncludes,
            rawText: pasteRaw,
            model: extractionModel ?? 'google/gemini-2.5-flash',
          });
          intakeExtractionId = res.extraction_id;
          sonnerToast.success(`Profile seeded — ${res.auto_count} item${res.auto_count === 1 ? '' : 's'} applied.`);
        } catch (err: any) {
          console.error('[AddStudentDialog] applyIntakeExtraction failed', err);
          sonnerToast.error('Student created, but intake suggestions failed to apply. Open the profile to retry.');
        }
      }

      // Reset form and close dialog
      setName('');
      setEnglishLevel('');
      setMainGoal('custom');
      setCustomGoal('');
      setStudentEmail('');
      setSendOverdueEmails(true);
      setNativeLanguage('Spanish');
      setMode('defer');
      setSendTestWhenKnown(true);
      setMainGoalDeadline('');
      setPasteEnabled(false);
      setPasteRaw('');
      setExtraction(null);
      setExtractionModel(null);
      setIntakeIncludes({
        notes: true, signals: {}, goals: {},
        english_level: true, main_goal: true, native_language: true, pacing: true,
      });
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
            // v6.9.36 — canonical helper (status='draft' → seed questions →
            // share token → status='assigned') eliminates the previous
            // invalid `status: 'pending'` and `.single()`-on-update paths
            // that caused the autosend 400.
            const ensured = await ensureWelcomeTest({
              studentId: newStudent.id,
              teacherId,
              studentName: newStudent.name,
            });
            await sendWelcomeTestEmail({
              token: ensured.token,
              recipientEmail: studentEmail,
              studentName: newStudent.name,
              teacherId,
            });
            sonnerToast.success(`Welcome Test sent to ${studentEmail}`);
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
        const intakeQs = intakeExtractionId ? `&intake=${intakeExtractionId}` : '';
        if (autoSendWelcomeTest) {
          navigate(`/student/${newStudent.id}?tab=dslm&view=goals&focus=add-goal-modal&_=${ts}${intakeQs}`);
        } else {
          navigate(`/student/${newStudent.id}?tab=dslm&view=pathway&focus=send-welcome-test&_=${ts}${intakeQs}`);
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

          {/* v6.9.62 P6 — Paste intake (AI). Opt-in, independent of know/defer. */}
          <PasteIntakeSection
            enabled={pasteEnabled}
            onEnabledChange={setPasteEnabled}
            rawText={pasteRaw}
            onRawTextChange={setPasteRaw}
            extraction={extraction}
            onExtractionChange={setExtraction}
            includes={intakeIncludes}
            setIncludes={setIntakeIncludes}
            existing={{
              english_level: mode === 'know' ? englishLevel || null : null,
              main_goal: mode === 'know'
                ? (mainGoal === 'custom' ? customGoal : mainGoal) || null
                : null,
              main_goal_target_date: mode === 'know' ? mainGoalDeadline || null : null,
              native_language: nativeLanguage || null,
              mainGoalSet: mode === 'know',
            }}
            model={extractionModel}
            onModelResolved={setExtractionModel}
          />

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
