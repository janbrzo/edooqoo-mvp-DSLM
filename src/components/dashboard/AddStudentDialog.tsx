
import React, { useMemo, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useStudents } from '@/hooks/useStudents';
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress';
import { useNavigate } from 'react-router-dom';
import { Plus, Eraser } from 'lucide-react';
import { NATIVE_LANGUAGES } from '@/types/flashcards';
import { MAIN_GOALS, ENGLISH_LEVELS } from '@/constants/studentGoals';
import { DeadlinePicker } from '@/components/shared/DeadlinePicker';
import { Checkbox } from '@/components/ui/checkbox';
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
import { cn } from '@/lib/utils';

const ADD_STUDENT_DRAFT_KEY = 'add-student-dialog-draft';

const normalizeText = (value: string) => value.trim().toLowerCase();
const hasMeaningfulValue = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

const confidenceOf = (item?: { confidence?: number | string | null } | null): number => {
  const raw = typeof item?.confidence === 'number' ? item.confidence : Number(item?.confidence);
  return Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0;
};

const quoteAppearsInText = (quote: unknown, rawText: string): boolean => {
  if (!hasMeaningfulValue(quote) || !hasMeaningfulValue(rawText)) return false;
  const q = normalizeText(String(quote));
  if (q.length < 2) return false;
  return normalizeText(rawText).includes(q);
};

const mapEnglishLevel = (level?: string | null): string => {
  const match = String(level || '').toUpperCase().match(/\b(A1|A2|B1|B2|C1|C2)\b/);
  return match?.[1] || '';
};

const mapNativeLanguage = (language?: string | null): string => {
  if (!hasMeaningfulValue(language)) return '';
  const normalized = normalizeText(language!);
  return NATIVE_LANGUAGES.find((lang) => normalizeText(lang.value) === normalized || normalizeText(lang.label) === normalized)?.value || '';
};

const mapGoalToSelectValue = (goalText?: string | null): string => {
  if (!hasMeaningfulValue(goalText)) return '';
  const text = normalizeText(goalText!);
  const exact = MAIN_GOALS.find((goal) => normalizeText(goal.value) === text || normalizeText(goal.label) === text);
  if (exact) return exact.value;

  const synonymRules: Array<[string[], string]> = [
    [['work', 'business', 'job', 'career', 'meeting', 'presentation', 'client', 'professional', 'interview'], 'work'],
    [['ielts', 'toefl', 'cambridge', 'exam', 'certificate', 'cae', 'fce', 'cpe'], 'exam'],
    [['general', 'overall', 'fluency', 'speaking', 'conversation', 'grammar', 'vocabulary'], 'general'],
    [['travel', 'trip', 'holiday', 'vacation'], 'travel'],
    [['academic', 'university', 'study', 'research', 'paper'], 'academic'],
    [['social', 'people', 'small talk', 'networking', 'friends'], 'social-conversation'],
    [['confidence', 'self', 'personal development', 'improve myself'], 'personal-development'],
    [['fun', 'movie', 'music', 'game', 'entertainment', 'hobby'], 'fun-entertainment'],
  ];

  for (const [keywords, value] of synonymRules) {
    if (keywords.some((keyword) => text.includes(keyword))) return value;
  }
  return 'custom';
};

const getMainGoalSuggestionText = (extraction: IntakeExtractionPayload | null): string => {
  const direct = extraction?.main_goal?.value;
  if (hasMeaningfulValue(direct)) return direct!.trim();

  const goal = extraction?.goals?.find((item) => normalizeText(item.goal_type || '') === 'main') || extraction?.goals?.[0];
  if (!goal) return '';
  const title = hasMeaningfulValue(goal.title) ? goal.title!.trim() : '';
  const description = hasMeaningfulValue(goal.description) ? goal.description!.trim() : '';
  if (title && !['main', 'goal', 'primary goal'].includes(normalizeText(title))) return title;
  if (description) return description;
  return hasMeaningfulValue(goal.evidence_quote) ? goal.evidence_quote!.trim() : '';
};

const getMainGoalTargetDate = (extraction: IntakeExtractionPayload | null): string => {
  const direct = extraction?.main_goal?.target_date;
  if (hasMeaningfulValue(direct)) return direct!.trim();
  const goal = extraction?.goals?.find((item) => normalizeText(item.goal_type || '') === 'main') || extraction?.goals?.[0];
  return hasMeaningfulValue(goal?.target_date) ? goal!.target_date!.trim() : '';
};

// v6.9.76 — UI-side safety net used when AI extraction returns no identity
// fields but the raw paste clearly contains them. Mirrors the server-side
// detector but stays intentionally simple.
const extractIdentityFallbackFromNotes = (raw: string): { name?: string; email?: string } => {
  const out: { name?: string; email?: string } = {};
  if (!raw || !raw.trim()) return out;
  const email = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  if (email) out.email = email.toLowerCase();

  const labelMatch = raw.match(
    /(?:student name|name|imi[eę](?: i nazwisko)?|nazwisko|ucze[nń]|uczennica|studentka|student|kursant|kursantka)\s*[:\-–]\s*([^\n,;<>@]{2,120})/i,
  );
  if (labelMatch?.[1]) {
    const v = labelMatch[1].trim().replace(/\s+/g, ' ').replace(/[.。]+$/, '');
    if (v && /[\p{L}]/u.test(v)) out.name = v.slice(0, 120);
  }

  if (!out.name) {
    const inline = raw.match(
      /([\p{Lu}][\p{L}'-]+(?:\s+[\p{Lu}][\p{L}'-]+){1,3})\s*[<,\-–]\s*[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu,
    );
    if (inline?.[1]) out.name = inline[1].trim();
  }

  if (!out.name && email) {
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const idx = lines.findIndex((l) => l.toLowerCase().includes(email.toLowerCase()));
    if (idx >= 0) {
      for (const line of [lines[idx], lines[idx - 1], lines[idx + 1]].filter(Boolean) as string[]) {
        const m = line.match(/[\p{Lu}][\p{L}'-]+(?:\s+[\p{Lu}][\p{L}'-]+){1,3}/u);
        if (m) { out.name = m[0]; break; }
      }
    }
  }

  if (!out.name) {
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines.slice(0, 3)) {
      if (line.length > 80 || /[.!?]/.test(line)) continue;
      const m = line.match(/^[\p{Lu}][\p{L}'-]+(?:\s+[\p{Lu}][\p{L}'-]+){1,3}$/u);
      if (m) { out.name = m[0]; break; }
    }
  }

  return out;
};

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
  const knowsStudent = mode === 'know';
  const deferProfile = !knowsStudent;
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

  // Reset all form state + drop the persisted draft so the dialog is pristine.
  const handleClearForm = () => {
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
    try { sessionStorage.removeItem(ADD_STUDENT_DRAFT_KEY); } catch { /* noop */ }
    sonnerToast.success('Form cleared.');
  };

  // v6.9.74 — After AI extraction lands, convert the preview into the editable
  // draft fields. This deliberately ignores default UI values as evidence and
  // only applies native language when the quoted evidence exists in the paste.
  useEffect(() => {
    if (!extraction) return;
    let changed = false;

    const sn = extraction.student_name;
    const se = extraction.student_email;
    const nameValue = hasMeaningfulValue(sn?.value) ? sn!.value!.trim().slice(0, 120) : '';
    const emailValue = hasMeaningfulValue(se?.value) ? se!.value!.trim().toLowerCase() : '';
    if (nameValue && !name.trim() && confidenceOf(sn) >= 0.55) {
      setName(nameValue);
      changed = true;
    }
    if (emailValue && !studentEmail.trim() && /.+@.+\..+/.test(emailValue) && confidenceOf(se) >= 0.55) {
      setStudentEmail(emailValue);
      changed = true;
    }

    const levelValue = mapEnglishLevel(extraction.english_level?.value);
    if (levelValue && (!englishLevel || englishLevel === 'unknown') && confidenceOf(extraction.english_level) >= 0.55) {
      setEnglishLevel(levelValue);
      changed = true;
    }

    const goalText = getMainGoalSuggestionText(extraction);
    const goalValue = mapGoalToSelectValue(goalText);
    if (goalText && goalValue && (mainGoal === 'custom' && !customGoal.trim())) {
      setMainGoal(goalValue);
      setCustomGoal(goalValue === 'custom' ? goalText.slice(0, 200) : '');
      changed = true;
    }

    const goalDate = getMainGoalTargetDate(extraction);
    if (goalDate && !mainGoalDeadline && /^\d{4}-\d{2}-\d{2}$/.test(goalDate)) {
      setMainGoalDeadline(goalDate);
      changed = true;
    }

    const nativeCandidate = extraction.native_language;
    const mappedNative = mapNativeLanguage(nativeCandidate?.value);
    const nativeHasEvidence = quoteAppearsInText(nativeCandidate?.evidence_quote, pasteRaw);
    if (mappedNative && nativeHasEvidence && (!nativeLanguage || nativeLanguage === 'Spanish') && confidenceOf(nativeCandidate) >= 0.75) {
      setNativeLanguage(mappedNative);
      changed = true;
    }

    // v6.9.76 safety net — if AI dropped identity but the raw paste has it, fill from regex.
    if ((!name.trim() || !studentEmail.trim()) && pasteRaw.trim()) {
      const fb = extractIdentityFallbackFromNotes(pasteRaw);
      if (fb.name && !name.trim()) { setName(fb.name); changed = true; }
      if (fb.email && !studentEmail.trim() && /.+@.+\..+/.test(fb.email)) {
        setStudentEmail(fb.email);
        changed = true;
      }
    }

    if (changed) sonnerToast.success('AI filled the form — review and adjust before adding.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraction]);

  const intakeExistingForAnalysis = useMemo(() => ({
    english_level: knowsStudent && englishLevel ? englishLevel : null,
    main_goal: knowsStudent && (mainGoal !== 'custom' || customGoal.trim())
      ? (mainGoal === 'custom' ? customGoal.trim() : mainGoal)
      : null,
    main_goal_target_date: knowsStudent && mainGoalDeadline ? mainGoalDeadline : null,
    native_language: null,
    mainGoalSet: knowsStudent && Boolean(mainGoal !== 'custom' || customGoal.trim()),
  }), [knowsStudent, englishLevel, mainGoal, customGoal, mainGoalDeadline]);

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
      <DialogContent className={`${pasteEnabled ? 'sm:max-w-[980px]' : 'sm:max-w-[520px]'} max-h-[92vh] overflow-y-auto transition-[max-width] duration-200`}>
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <DialogTitle>Add Student</DialogTitle>
              <DialogDescription>
                Only name + email are required. Defer level &amp; goal until after the Welcome Test if you prefer.
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearForm}
              className="h-7 text-[11px] text-muted-foreground hover:text-destructive"
              title="Reset all fields and the saved draft"
            >
              <Eraser className="h-3 w-3 mr-1" /> Clear
            </Button>
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className={pasteEnabled ? 'space-y-3 lg:grid lg:grid-cols-[430px_minmax(0,1fr)] lg:gap-5 lg:space-y-0 lg:items-start' : 'space-y-3'}>
          <div className="space-y-3">
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
              <p className="text-[10px] text-muted-foreground">
                AI will only change this if the notes explicitly mention the student's native language.
              </p>
            </div>

            {/* v6.9.76 — Segmented control: both modes visually active */}
            <div
              role="radiogroup"
              aria-label="Student knowledge mode"
              className="grid grid-cols-2 gap-1 rounded-md border bg-background p-0.5"
            >
              {[
                { value: 'defer' as const, title: "I don't know my student yet", hint: 'Recommended — fill from Welcome Test' },
                { value: 'know' as const,  title: 'I already know my student',   hint: 'Set CEFR + goal now' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={mode === opt.value}
                  onClick={() => setMode(opt.value)}
                  className={cn(
                    'rounded px-3 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    mode === opt.value
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  <div className="text-xs font-medium leading-tight">{opt.title}</div>
                  <div className="text-[10px] opacity-80 mt-0.5 leading-tight">{opt.hint}</div>
                </button>
              ))}
            </div>

            {knowsStudent && (
              <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="level" className="text-xs">CEFR <span className="text-destructive">*</span></Label>
                    <Select value={englishLevel} onValueChange={setEnglishLevel} required>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Level" /></SelectTrigger>
                      <SelectContent>
                        {ENGLISH_LEVELS.filter((level) => level.value !== 'unknown').map((level) => (
                          <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="goal" className="text-xs flex items-center gap-1">
                      Main Goal <span className="text-destructive">*</span>
                      <TooltipProvider delayDuration={150}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="What is Main Goal?">
                              <Info className="h-3 w-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            Main Goal is the student's primary outcome (e.g. job interview in English, B2 exam). Add Supporting/Additional goals later from the Goals tab.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <Select value={mainGoal} onValueChange={setMainGoal} required>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Main goal" /></SelectTrigger>
                      <SelectContent>
                        {MAIN_GOALS.map((goal) => (
                          <SelectItem key={goal.value} value={goal.value}>{goal.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {mainGoal === 'custom' && (
                  <Input
                    placeholder="Describe the custom goal"
                    value={customGoal}
                    onChange={(e) => setCustomGoal(e.target.value)}
                    required
                    className="h-9"
                  />
                )}
                <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Goal Deadline (optional)</Label>
                    <DeadlinePicker value={mainGoalDeadline} onChange={setMainGoalDeadline} compact />
                  </div>
                  <label
                    htmlFor="send-test-known"
                    className="flex items-center gap-2 rounded-md border bg-background px-2 h-9 cursor-pointer"
                  >
                    <Checkbox
                      id="send-test-known"
                      checked={sendTestWhenKnown}
                      onCheckedChange={(v) => setSendTestWhenKnown(!!v)}
                    />
                    <span className="text-[11px] whitespace-nowrap">Send Welcome Test</span>
                  </label>
                </div>
              </div>
            )}

            {/* Overdue email toggle — collapsed under details in know mode to save vertical space */}
            {knowsStudent ? (
              <details className="rounded-md border bg-background px-2 py-1.5">
                <summary className="text-[11px] text-muted-foreground cursor-pointer select-none">More options</summary>
                <div className="flex items-center justify-between gap-2 pt-2">
                  <Label htmlFor="send-overdue-new" className="text-xs text-muted-foreground cursor-pointer">
                    Send overdue homework reminders
                  </Label>
                  <Switch
                    id="send-overdue-new"
                    checked={sendOverdueEmails}
                    onCheckedChange={setSendOverdueEmails}
                  />
                </div>
              </details>
            ) : (
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
            )}
          </div>

          <div className={pasteEnabled ? 'lg:border-l lg:pl-5 lg:min-w-0' : ''}>
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
                english_level: knowsStudent ? englishLevel || null : null,
                main_goal: knowsStudent
                  ? (mainGoal === 'custom' ? customGoal : mainGoal) || null
                  : null,
                main_goal_target_date: knowsStudent ? mainGoalDeadline || null : null,
                native_language: nativeLanguage || null,
                mainGoalSet: knowsStudent,
              }}
              analysisExisting={intakeExistingForAnalysis}
              model={extractionModel}
              onModelResolved={setExtractionModel}
            />
          </div>

          <div className={pasteEnabled ? 'flex justify-end gap-2 pt-2 lg:col-span-2' : 'flex justify-end gap-2 pt-2'}>
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
