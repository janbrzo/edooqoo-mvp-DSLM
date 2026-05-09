import React, { useState, useEffect, useMemo } from 'react';
import { AuthenticatedPageShell } from '@/components/AuthenticatedPageShell';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useDemoContext } from '@/contexts/DemoContext';
import { useAuthFlow } from '@/hooks/useAuthFlow';
import { useTokenSystem } from '@/hooks/useTokenSystem';
import StickyNav from '@/components/landing/StickyNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useStudents } from '@/hooks/useStudents';
import { useStudent } from '@/hooks/useStudent';
import { useWorksheetHistory } from '@/hooks/useWorksheetHistory';
import { useDeletedWorksheets } from '@/hooks/useDeletedWorksheets';
import { StudentEditDialog } from '@/components/StudentEditDialog';
import { DeleteWorksheetButton } from "@/components/DeleteWorksheetButton";
import { DuplicateWorksheetButton } from "@/components/DuplicateWorksheetButton";
import { StudentSelector } from '@/components/StudentSelector';
import { StudentKnowledgeSection } from '@/components/student-knowledge/StudentKnowledgeSection';
import { useStudentKnowledge } from '@/hooks/useStudentKnowledge';
import { StudentKnowledgeEntryCard } from '@/components/student-knowledge/StudentKnowledgeEntryCard';
import { StudentKnowledgeQuickAddModal } from '@/components/student-knowledge/StudentKnowledgeQuickAddModal';
import { OneMinutePrepCard } from '@/components/student-knowledge/OneMinutePrepCard';
import { useAllWorksheetHomework } from '@/hooks/useAllWorksheetHomework';
import { WorksheetHomeworkSection } from '@/components/worksheet/WorksheetHomeworkSection';
import { StudentHomeworkTab } from '@/components/student-homework/StudentHomeworkTab';
import { FlashcardSetsSection } from '@/components/flashcards/FlashcardSetsSection';
import { StudentProgressTab } from '@/components/student-progress/StudentProgressTab';
import { DSLMTab } from '@/components/dslm/DSLMTab';
import { DslmExplainerBanner } from '@/components/student/DslmExplainerBanner';
import { StudentTestsTab } from '@/components/student-tests/StudentTestsTab';
import { EventLogPanel } from '@/components/dslm/EventLogPanel';
import { SkillsOverviewPanel } from '@/components/dslm/SkillsOverviewPanel';
import { WelcomeTestSuggestion } from '@/components/dashboard/WelcomeTestSuggestion';
import { StudentCalendarTab } from '@/components/calendar/StudentCalendarTab';
import { ArrowLeft, FileText, Calendar, User, BookOpen, Target, Edit, Plus, Trash2, Brain, GraduationCap, StickyNote, Mail, Globe, Share2, TrendingUp, ClipboardCheck, Activity, Pencil, BarChart3, DollarSign, Video, ExternalLink } from 'lucide-react';
import { formatGoalLabel } from '@/constants/studentGoals';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { deepFixTextObjects } from '@/utils/textObjectFixer';
import { MediaBadges } from '@/components/worksheet/MediaBadges';
import { hasImage, hasAudio } from '@/utils/worksheetUtils';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import ShareWorksheetModal from '@/components/ShareWorksheetModal';
import RenameDialog from '@/components/RenameDialog';
import { StudentSwitcherPopover } from '@/components/StudentSwitcherPopover';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';

function MeetingLinkField({ studentId, teacherId, hasGcal }: { studentId: string; teacherId: string; hasGcal?: boolean }) {
  const { isDemoMode } = useDemoContext();
  const [link, setLink] = useState('');
  const [saved, setSaved] = useState(false);
  const [autoLinkEnabled, setAutoLinkEnabled] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [mode, setMode] = useState<'default' | 'custom'>('default');
  const [loaded, setLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (isDemoMode) {
      setLoaded(true);
      return;
    }
    const load = async () => {
      const { data: calSettings } = await supabase.from('calendar_settings')
        .select('auto_create_student_meeting_link')
        .eq('teacher_id', teacherId).maybeSingle();
      const autoEnabled = !!(calSettings as any)?.auto_create_student_meeting_link && !!hasGcal;
      setAutoLinkEnabled(autoEnabled);

      const { data } = await supabase.from('calendar_student_settings')
        .select('default_meeting_link, generated_meeting_link, meeting_link_mode')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .maybeSingle();

      const savedLink = (data as any)?.default_meeting_link || '';
      const genLink = (data as any)?.generated_meeting_link || '';
      const savedMode = (data as any)?.meeting_link_mode || 'default';

      setGeneratedLink(genLink);
      setLink(savedLink);
      setMode(autoEnabled ? savedMode : 'custom');
      setLoaded(true);
    };
    load();
  }, [studentId, teacherId, hasGcal, isDemoMode]);

  const propagateToFutureSlots = async (linkToPropagate: string | null) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      await supabase.from('calendar_slots')
        .update({ meeting_link: linkToPropagate } as any)
        .eq('teacher_id', teacherId)
        .eq('student_id', studentId)
        .gte('slot_date', today)
        .not('status', 'in', '("completed","deleted")');
    } catch (_) {}
  };

  const handleSave = async (linkToSave: string | null, newMode: 'default' | 'custom') => {
    const updateData: any = {
      default_meeting_link: linkToSave,
      meeting_link_mode: newMode,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase.from('calendar_student_settings')
      .select('id').eq('student_id', studentId).eq('teacher_id', teacherId).maybeSingle();
    if (existing) {
      await supabase.from('calendar_student_settings').update(updateData).eq('id', existing.id);
    } else {
      await supabase.from('calendar_student_settings').insert({ student_id: studentId, teacher_id: teacherId, ...updateData } as any);
    }
    await propagateToFutureSlots(linkToSave);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleModeChange = async (newMode: 'default' | 'custom') => {
    setMode(newMode);
    if (newMode === 'default') {
      if (generatedLink) {
        setLink(generatedLink);
        await handleSave(generatedLink, 'default');
      } else if (hasGcal) {
        // Generate a real Google Meet room via edge function
        setGenerating(true);
        try {
          const { data: result } = await supabase.functions.invoke('gcal-sync', {
            body: { teacherId, studentId, action: 'create_permanent_room', slotId: studentId },
          });
          const meetLink = result?.meetLink;
          if (meetLink) {
            setGeneratedLink(meetLink);
            setLink(meetLink);
            await handleSave(meetLink, 'default');
            toast.success('Google Meet room created');
          } else {
            toast.error('Failed to create Google Meet room');
            setMode('custom');
          }
        } catch (err) {
          toast.error('Failed to create Google Meet room');
          setMode('custom');
        } finally {
          setGenerating(false);
        }
      }
    }
  };

  if (!loaded) return null;

  const currentLink = mode === 'default' && autoLinkEnabled ? (generatedLink || '') : link;

  return (
    <div>
      <label className="text-sm font-medium text-muted-foreground">
        {!autoLinkEnabled ? 'Meeting Link' : mode === 'custom' ? 'Custom Meeting Link' : 'Default Meeting Link'}
      </label>
      {autoLinkEnabled && (
        <div className="flex items-center gap-2 mt-1 mb-1">
          <button
            onClick={() => handleModeChange('default')}
            disabled={generating}
            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${mode === 'default' ? 'bg-primary/10 border-primary text-primary font-medium' : 'border-border text-muted-foreground hover:text-foreground'}`}
          >
            {generating ? 'Creating…' : 'Default'}
          </button>
          <button
            onClick={() => handleModeChange('custom')}
            disabled={generating}
            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${mode === 'custom' ? 'bg-primary/10 border-primary text-primary font-medium' : 'border-border text-muted-foreground hover:text-foreground'}`}
          >
            Custom
          </button>
        </div>
      )}
      <div className="flex items-center gap-2 mt-1">
        <Video className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <Input
          value={currentLink}
          onChange={e => { setLink(e.target.value); setSaved(false); }}
          onBlur={() => {
            if (mode === 'custom' || !autoLinkEnabled) {
              const finalLink = link || null;
              // If clearing custom and generated exists, revert to default
              if (!finalLink && generatedLink && autoLinkEnabled) {
                setMode('default');
                setLink(generatedLink);
                handleSave(generatedLink, 'default');
              } else {
                handleSave(finalLink, autoLinkEnabled ? 'custom' : 'custom');
              }
            }
          }}
          placeholder="https://meet.google.com/..."
          className="h-8 text-sm"
          disabled={(autoLinkEnabled && mode === 'default') || generating}
        />
        {currentLink && (
          <button
            onClick={() => window.open(currentLink, '_blank')}
            className="p-1.5 rounded-md hover:bg-muted transition-colors flex-shrink-0"
            title="Open link in new tab"
          >
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
        {saved && <span className="text-xs text-green-600 whitespace-nowrap">✓ Saved</span>}
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        {currentLink
          ? "Your permanent meeting room link. Students will see a 'Join Lesson' button."
          : hasGcal
            ? "Enable 'Auto-create permanent student meeting links' in Calendar Settings to generate a Google Meet room, or paste your own link."
            : "Connect Google Calendar in Settings to auto-generate Google Meet rooms, or paste your meeting room link (e.g., Zoom)."
        }
      </p>
    </div>
  );
}

const StudentPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isRegisteredUser } = useAuthFlow();
  const { tokenLeft } = useTokenSystem(user?.id);
  const { isDemoMode, showDemoBlockedToast } = useDemoContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const { students, updateStudent, deleteStudent, loading: studentsLoading } = useStudents();
  const [currentPage, setCurrentPage] = useState(1);
  const [deletedCurrentPage, setDeletedCurrentPage] = useState(1);
  const [oneMinuteTipOpen, setOneMinuteTipOpen] = useState(false);
  // v6.8.4 — "1 MINUTE" (DSLM) is now the default tab. The Edooqoo promise:
  // ~1 minute weekly prep per student instead of 1–2 hours. Backward-compat:
  // existing `?tab=overview` links still open the Overview tab as before.
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'dslm');
  const [deleteConfirmName, setDeleteConfirmName] = useState('');

  // Sync activeTab when URL searchParams change (Issue 8: programmatic navigation)
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [searchParams]);
  const pageSize = 10;

  // Get flashcard set ID from URL
  const flashcardSetId = searchParams.get('set');

  // Sync tab with URL — backward compat redirects
  const handleTabChange = (tab: string) => {
    const redirectMap: Record<string, { tab: string; view?: string }> = {
      skills: { tab: 'dslm', view: 'skills' },
      knowledge: { tab: 'dslm', view: 'profile' },
      progress: { tab: 'dslm', view: 'pathway' },
      events: { tab: 'dslm', view: 'profile' },
    };
    const redirect = redirectMap[tab];
    if (redirect) {
      setActiveTab(redirect.tab);
      setSearchParams({ tab: redirect.tab, ...(redirect.view ? { view: redirect.view } : {}) });
      return;
    }
    setActiveTab(tab);
    // Remove set param when changing tabs
    setSearchParams({ tab });
  };

  // Handle flashcard set change
  const handleFlashcardSetChange = (setId: string | null) => {
    if (setId) {
      setSearchParams({ tab: 'flashcards', set: setId });
    } else {
      setSearchParams({ tab: 'flashcards' });
    }
  };
  
  // Single-student fetch (cached) — falls back to the list lookup for demo mode / pre-warmed cache
  const { data: studentFromQuery, isLoading: studentLoading } = useStudent(id);
  const student = studentFromQuery || students.find(s => s.id === id);
  
  const { worksheets, loading, deleteWorksheet, refetch: refetchWorksheets, restoreWorksheet, totalCount } = 
    useWorksheetHistory(id || '', false, true, currentPage, pageSize);
  const { deletedWorksheets, loading: deletedLoading, restoreWorksheet: restoreDeleted, totalCount: deletedTotalCount } = 
    useDeletedWorksheets(id || '', false, true, deletedCurrentPage, pageSize);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareWorksheetData, setShareWorksheetData] = useState<{id: string; title: string; shareToken?: string} | null>(null);
  const [teacherCalendarToken, setTeacherCalendarToken] = useState<string | null>(null);
  const [gcalEnabled, setGcalEnabled] = useState(false);

  // Fetch teacher's public_calendar_token and gcal status for share links
  useEffect(() => {
    if (isDemoMode || !student?.teacher_id) return;
    supabase.from('calendar_settings')
      .select('public_calendar_token, gcal_integration_enabled')
      .eq('teacher_id', student.teacher_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.public_calendar_token) setTeacherCalendarToken(data.public_calendar_token);
        setGcalEnabled(!!data?.gcal_integration_enabled);
      });
  }, [student?.teacher_id, isDemoMode]);
  
  // Rename worksheet state
  const [renameWorksheetData, setRenameWorksheetData] = useState<{id: string; title: string} | null>(null);

  // v6.9.13 — local Add-Note quick modal triggered from overview tab.
  const [quickAddNoteOpen, setQuickAddNoteOpen] = useState(false);

  // Get recent notes for overview
  const studentKnowledge = useStudentKnowledge({
    studentId: id || '',
    teacherId: student?.teacher_id || '',
  });

  useEffect(() => {
    refetchWorksheets();
  }, [currentPage, deletedCurrentPage]);

  // Auth check for "student not found" - redirect to login if not authenticated
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsAuthenticated(!!user);
      setAuthChecked(true);
    });
  }, []);

  if (loading || (studentsLoading && studentLoading) || !authChecked) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!student) {
    // If not authenticated, redirect to login with return URL
    if (!isAuthenticated) {
      const returnUrl = `/student/${id}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
      navigate(`/login?redirect=${encodeURIComponent(returnUrl)}`);
      return <div className="min-h-screen flex items-center justify-center">Redirecting to login...</div>;
    }

    return (
      <AuthenticatedPageShell className="p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-8">
            <h1 className="text-2xl font-bold mb-4">Student not found</h1>
            <Button asChild>
              <Link to="/dashboard">Back to Dashboard</Link>
            </Button>
          </div>
        </div>
      </AuthenticatedPageShell>
    );
  }

  const handleWorksheetClick = (worksheet: any) => {
    navigate(`/worksheet/${worksheet.id}`);
  };

  const handleGenerateWorksheet = () => {
    sessionStorage.setItem('preSelectedStudent', JSON.stringify({
      id: student.id,
      name: student.name
    }));
    sessionStorage.setItem('forceNewWorksheet', 'true');
    navigate('/');
  };

  // Use centralized goal formatting from constants
  const formatGoal = formatGoalLabel;

  const handleDeleteStudent = async () => {
    try {
      const result = await deleteStudent(student.id);
      if (result) {
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Error deleting student:', error);
    }
  };
  
  // Rename worksheet handler
  const handleRenameWorksheet = async (worksheetId: string, newTitle: string) => {
    if (isDemoMode) { showDemoBlockedToast('Renaming worksheets'); return; }
    try {
      const { error } = await supabase
        .from('worksheets')
        .update({ title: newTitle })
        .eq('id', worksheetId);
      
      if (error) throw error;
      
      toast.success('Worksheet renamed successfully');
      refetchWorksheets();
    } catch (error) {
      console.error('Error renaming worksheet:', error);
      toast.error('Failed to rename worksheet');
      throw error;
    }
  };

  return (
    <AuthenticatedPageShell>
      <StickyNav 
        isRegisteredUser={!!isRegisteredUser} 
        tokenLeft={tokenLeft} 
        user={user}
        onGenerateWorksheet={handleGenerateWorksheet}
        leftContent={
          <>
            <Button variant="ghost" size="sm" asChild className="gap-1">
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back</span>
              </Link>
            </Button>
            <span className="text-border">|</span>
            <StudentSwitcherPopover 
              students={students} 
              currentStudentId={student.id} 
              onSelect={(sid) => navigate(`/student/${sid}`)} 
            />
            <span className="font-semibold text-sm truncate max-w-[150px]">{student.name}</span>
          </>
        }
      />
      <div className="max-w-6xl mx-auto p-4">

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          {/* v6.8.6 P4 — on <lg widths show icon-only triggers (with aria-label
              + tooltip via title) so the 7-tab strip never overflows on
              narrower laptop windows; full text returns at lg: breakpoint. */}
          <TabsList className="grid w-full grid-cols-7 mb-6">
            <TabsTrigger value="overview" className="flex items-center gap-2" aria-label="Overview" title="Overview">
              <User className="h-4 w-4" />
              <span className="hidden lg:inline">Overview</span>
            </TabsTrigger>
            <TooltipProvider delayDuration={300} disableHoverableContent>
              <Tooltip open={oneMinuteTipOpen} onOpenChange={() => { /* controlled — ignore focus-driven opens */ }}>
                <TooltipTrigger asChild>
                  <TabsTrigger
                    value="dslm"
                    className="flex items-center gap-2"
                    aria-label="1 MINUTE"
                    onMouseEnter={() => setOneMinuteTipOpen(true)}
                    onMouseLeave={() => setOneMinuteTipOpen(false)}
                    onFocus={(e) => e.preventDefault()}
                    onBlur={() => setOneMinuteTipOpen(false)}
                  >
                    <Brain className="h-4 w-4" />
                    <span className="hidden lg:inline">1 MINUTE</span>
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <strong>1 MINUTE</strong> — Edooqoo's promise: ~1 minute weekly prep per student instead of 1–2 hours. Powered by DSLM (Dynamic Student Learning Model).
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TabsTrigger value="worksheets" className="flex items-center gap-2" aria-label="Worksheets" title="Worksheets">
              <FileText className="h-4 w-4" />
              <span className="hidden lg:inline">Worksheets</span>
            </TabsTrigger>
            <TabsTrigger value="homework" className="flex items-center gap-2" aria-label="Homework" title="Homework">
              <BookOpen className="h-4 w-4" />
              <span className="hidden lg:inline">Homework</span>
            </TabsTrigger>
            <TabsTrigger value="flashcards" className="flex items-center gap-2" aria-label="Flashcards" title="Flashcards">
              <GraduationCap className="h-4 w-4" />
              <span className="hidden lg:inline">Flashcards</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2" aria-label="Calendar" title="Calendar">
              <Calendar className="h-4 w-4" />
              <span className="hidden lg:inline">Calendar</span>
            </TabsTrigger>
            <TabsTrigger value="tests" className="flex items-center gap-2" aria-label="Tests" title="Tests">
              <ClipboardCheck className="h-4 w-4" />
              <span className="hidden lg:inline">Tests</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            {/* Welcome Test Suggestion Banner */}
            <WelcomeTestSuggestion
              studentId={student.id}
              teacherId={student.teacher_id}
              studentName={student.name}
              studentEmail={student.student_email}
              surface="overview"
            />
            {/* v6.9.8 — Quick Prep digest (Personal hooks + Focus on + Lesson ideas) */}
            <OneMinutePrepCard
              studentId={student.id}
              teacherId={student.teacher_id}
              studentName={student.name}
            />
            {student.student_email && (
              <div className="bg-muted/50 border border-border rounded-md p-3 text-sm mb-4 flex items-start gap-3">
                <BookOpen className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-muted-foreground text-xs">
                  This student can access their worksheets, homework, flashcards & lessons at{' '}
                  <a href="https://edooqoo.com/my" target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">edooqoo.com/my</a>
                  {' '}— no login needed, just their email.
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Student Details */}
              <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <User className="h-5 w-5 mr-2" />
                    Student Details
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditDialogOpen(true)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-5 w-5 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <Trash2 className="h-5 w-5 text-destructive" />
                            Delete Student: {student.name}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. To confirm deletion, please type the student's full name below:
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        
                        <div className="py-4">
                          <Input
                            placeholder={`Type "${student.name}" to confirm`}
                            value={deleteConfirmName}
                            onChange={(e) => setDeleteConfirmName(e.target.value)}
                          />
                        </div>
                        
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setDeleteConfirmName('')}>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDeleteStudent}
                            disabled={deleteConfirmName !== student.name}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                          >
                            Delete Student
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">English Level</label>
                  <Badge variant="secondary" className="ml-2">{student.english_level}</Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Main Goal</label>
                  <div className="flex items-center mt-1">
                    <Target className="h-4 w-4 mr-2 text-primary" />
                    <span>{formatGoal(student.main_goal)}</span>
                  </div>
                </div>
                {student.student_email && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <div className="flex items-center mt-1">
                      <Mail className="h-4 w-4 mr-2 text-primary" />
                      <span className="text-sm">{student.student_email}</span>
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Native Language</label>
                  <div className="flex items-center mt-1">
                    <Globe className="h-4 w-4 mr-2 text-primary" />
                    <span>{student.native_language || 'Not set'}</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Overdue Homework Emails</label>
                  <div className="flex items-center mt-1">
                    <Mail className="h-4 w-4 mr-2 text-primary" />
                    <Badge variant={student.send_overdue_emails !== false ? 'default' : 'secondary'}>
                      {student.send_overdue_emails !== false ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Total Worksheets</label>
                  <div className="flex items-center mt-1">
                    <BookOpen className="h-4 w-4 mr-2 text-primary" />
                    <span className="font-semibold">{totalCount || 0}</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Student Since</label>
                  <div className="flex items-center mt-1">
                    <Calendar className="h-4 w-4 mr-2 text-primary" />
                    <span>{format(new Date(student.created_at), 'MMM dd, yyyy')}</span>
                  </div>
                </div>
                {/* Default Meeting Link */}
                <MeetingLinkField studentId={student.id} teacherId={student.teacher_id} hasGcal={gcalEnabled} />
              </CardContent>
            </Card>

              {/* Recent Worksheets */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center mb-2">
                    <FileText className="h-5 w-5 mr-2" />
                    Recent Worksheets
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button 
                      size="sm"
                      onClick={handleGenerateWorksheet}
                      className="flex-1"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Generate Another
                    </Button>
                    {worksheets.length > 0 && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setActiveTab('worksheets')}
                      >
                        View All
                      </Button>
                    )}
                  </div>
                </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  </div>
                ) : worksheets.length > 0 ? (
                  <div className="space-y-3">
                    {worksheets.slice(0, 5).map((worksheet) => (
                      <div key={worksheet.id}>
                        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                          <Link
                            to={`/worksheet/${worksheet.id}`}
                            className="flex items-center space-x-3 flex-1 cursor-pointer"
                          >
                            <FileText className="h-4 w-4 text-primary" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium text-sm">
                                  {worksheet.title || 'Untitled Worksheet'}
                                </h3>
                                <MediaBadges 
                                  hasImage={hasImage(worksheet)} 
                                  hasAudio={hasAudio(worksheet)}
                                  size="sm"
                                />
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(worksheet.created_at), 'MMM dd, yyyy')}
                              </p>
                            </div>
                          </Link>
                          <DeleteWorksheetButton
                            worksheetId={worksheet.id}
                            worksheetTitle={worksheet.title || 'Untitled Worksheet'}
                            onDelete={deleteWorksheet}
                            variant="ghost"
                            size="sm"
                          />
                        </div>
                        <WorksheetHomeworkSection 
                          worksheetId={worksheet.id}
                          compact={true}
                          displayMode="simplified"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-muted-foreground">No worksheets generated yet</p>
                    <Button onClick={handleGenerateWorksheet} className="mt-4" size="sm">
                      Generate First Worksheet
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

              {/* Recent Notes */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center mb-2">
                    <StickyNote className="h-5 w-5 mr-2" />
                    Recent Notes
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button 
                      size="sm"
                      onClick={() => setQuickAddNoteOpen(true)}
                      className="flex-1"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Note
                    </Button>
                    {studentKnowledge.entries.length > 0 && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleTabChange('knowledge')}
                      >
                        View All
                      </Button>
                    )}
                  </div>
                </CardHeader>
              <CardContent>
                {studentKnowledge.isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  </div>
                ) : studentKnowledge.entries.length > 0 ? (
                  <div className="space-y-3">
                    {studentKnowledge.entries.slice(0, 3).map((entry) => (
                      <StudentKnowledgeEntryCard
                        key={entry.id}
                        entry={entry}
                        onView={(entryToView) => {
                          // Switch to Knowledge Base tab for viewing
                          handleTabChange('knowledge');
                        }}
                        onEdit={(entryToEdit) => {
                          // Switch to Knowledge Base tab for editing
                          handleTabChange('knowledge');
                        }}
                        onDelete={studentKnowledge.deleteEntry}
                        onMarkOutdated={studentKnowledge.markAsOutdated}
                        onMarkCurrent={studentKnowledge.markAsCurrent}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <StickyNote className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-muted-foreground">No notes added yet</p>
                    <Button 
                      onClick={() => setQuickAddNoteOpen(true)} 
                      className="mt-4" 
                      size="sm"
                    >
                      Add First Note
                    </Button>
                  </div>
                )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Worksheets Tab */}
          <TabsContent value="worksheets">
            <div className="space-y-6">
              {/* Active Worksheets */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center">
                      <FileText className="h-5 w-5 mr-2" />
                      All Worksheets ({totalCount || 0})
                    </CardTitle>
                    {worksheets.length > 0 && (
                      <Button onClick={handleGenerateWorksheet} size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Generate another
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                      <p className="mt-4 text-muted-foreground">Loading worksheets...</p>
                    </div>
                  ) : worksheets.length > 0 ? (
                    <>
                      <div className="space-y-3">
                        {worksheets.map((worksheet) => (
                          <div key={worksheet.id}>
                            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                              <Link 
                                to={`/worksheet/${worksheet.id}`}
                                className="flex items-center space-x-3 flex-1"
                              >
                                <FileText className="h-5 w-5 text-primary" />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-medium">
                                      {worksheet.title || 'Untitled Worksheet'}
                                    </h3>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setRenameWorksheetData({
                                          id: worksheet.id,
                                          title: worksheet.title || 'Untitled Worksheet'
                                        });
                                      }}
                                      title="Rename worksheet"
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <MediaBadges 
                                      hasImage={hasImage(worksheet)} 
                                      hasAudio={hasAudio(worksheet)}
                                      size="sm"
                                    />
                                  </div>
                                  {worksheet.form_data?.grammar && (
                                    <p className="text-sm text-muted-foreground">
                                      Grammar: {worksheet.form_data.grammar}
                                    </p>
                                  )}
                                </div>
                              </Link>
                              <div className="flex items-center space-x-2">
                                {/* PROBLEM 8: Date and time on same line */}
                                <div className="text-sm font-medium whitespace-nowrap">
                                  {format(new Date(worksheet.created_at), 'MMM dd, yyyy HH:mm')}
                                </div>
                                {/* PROBLEM 7: Share button with green border if active */}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={`${
                                    worksheet.share_token
                                      ? 'border-2 border-green-500 rounded-md'
                                      : ''
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShareWorksheetData({
                                      id: worksheet.id,
                                      title: worksheet.title || 'Untitled Worksheet',
                                      shareToken: worksheet.share_token || undefined
                                    });
                                    setShareModalOpen(true);
                                  }}
                                >
                                  <Share2 className="h-4 w-4" />
                                </Button>
                                <DuplicateWorksheetButton
                                  worksheetId={worksheet.id}
                                  worksheetTitle={worksheet.title || 'Untitled Worksheet'}
                                  onDuplicate={refetchWorksheets}
                                />
                                <StudentSelector
                                  worksheetId={worksheet.id}
                                  currentStudentId={worksheet.student_id}
                                  worksheetTitle={worksheet.title || 'Untitled Worksheet'}
                                  onTransferSuccess={refetchWorksheets}
                                />
                                <DeleteWorksheetButton
                                  worksheetId={worksheet.id}
                                  worksheetTitle={worksheet.title || 'Untitled Worksheet'}
                                  onDelete={deleteWorksheet}
                                />
                              </div>
                            </div>
                            <WorksheetHomeworkSection 
                              worksheetId={worksheet.id}
                            />
                          </div>
                        ))}
                      </div>
                      
                      {totalCount > pageSize && (
                        <div className="flex items-center justify-between pt-4 mt-4 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                          >
                            Previous
                          </Button>
                          <span className="text-sm text-muted-foreground">
                            Page {currentPage} of {Math.ceil(totalCount / pageSize)}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => p + 1)}
                            disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                          >
                            Next
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                      <p className="text-muted-foreground">No worksheets generated yet</p>
                      <Button onClick={handleGenerateWorksheet} className="mt-4">
                        Generate First Worksheet
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Deleted Worksheets */}
              {deletedWorksheets.length > 0 && (
                <Card className="border-red-200 bg-red-50/50">
                  <CardHeader>
                    <CardTitle className="flex items-center text-red-700">
                      <Trash2 className="h-5 w-5 mr-2" />
                      Deleted Worksheets ({deletedTotalCount || 0})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {deletedLoading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mx-auto"></div>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-3">
                          {deletedWorksheets.map((worksheet) => (
                            <div
                              key={worksheet.id}
                              className="flex items-center justify-between p-4 bg-white rounded-lg border border-red-200"
                            >
                              <div className="flex items-center space-x-3 flex-1">
                                <FileText className="h-5 w-5 text-red-400" />
                                <div>
                                  <h3 className="font-medium text-gray-700">
                                    {worksheet.title || 'Untitled Worksheet'}
                                  </h3>
                                  <p className="text-sm text-red-600">
                                    Deleted: {format(new Date(worksheet.deleted_at), 'MMM dd, yyyy HH:mm')}
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  const result = await restoreDeleted(worksheet.id);
                                  if (result.success) {
                                    refetchWorksheets();
                                  }
                                }}
                                className="border-green-500 text-green-700 hover:bg-green-50"
                              >
                                Restore
                              </Button>
                            </div>
                          ))}
                        </div>
                        
                        {deletedTotalCount > pageSize && (
                          <div className="flex items-center justify-between pt-4 mt-4 border-t">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeletedCurrentPage(p => Math.max(1, p - 1))}
                              disabled={deletedCurrentPage === 1}
                            >
                              Previous
                            </Button>
                            <span className="text-sm text-muted-foreground">
                              Page {deletedCurrentPage} of {Math.ceil(deletedTotalCount / pageSize)}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeletedCurrentPage(p => p + 1)}
                              disabled={deletedCurrentPage >= Math.ceil(deletedTotalCount / pageSize)}
                            >
                              Next
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Homework Tab */}
          <TabsContent value="homework">
            <Card>
              <CardContent className="pt-6">
                <StudentHomeworkTab
                  studentId={id!}
                  teacherId={student.teacher_id}
                  studentName={student.name}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* DSLM Tab */}
          <TabsContent value="dslm">
            <WelcomeTestSuggestion
              studentId={student.id}
              teacherId={student.teacher_id}
              studentName={student.name}
              studentEmail={student.student_email}
              surface="oneMinute"
            />
            <DslmExplainerBanner teacherId={student.teacher_id} />
            <DSLMTab
              studentId={id || ''}
              teacherId={student.teacher_id}
              studentName={student.name}
              englishLevel={student.english_level}
              mainGoal={student.main_goal}
              mainGoalTargetDate={(student as any).main_goal_target_date || null}
              totalWorksheetCount={totalCount || 0}
              studentNotes={studentKnowledge.entries.slice(0, 10).map(e => e.content)}
              useRoadmap={(student as any).dslm_use_roadmap ?? true}
              onUseRoadmapChange={async (next) => {
                await updateStudent(student.id, { dslm_use_roadmap: next } as any);
              }}
              pacingMode={(student as any).dslm_pacing_mode ?? 50}
              onPacingModeChange={async (next) => {
                await updateStudent(student.id, { dslm_pacing_mode: next } as any);
              }}
              onMainGoalChange={async (newGoal) => {
                await updateStudent(student.id, { main_goal: newGoal });
              }}
              onMainGoalTargetDateChange={async (date) => {
                await updateStudent(student.id, { main_goal_target_date: date } as any);
              }}
              onUseWorksheetSuggestion={(topic, goal, additionalInfo, grammarFocus, exercises, exerciseFocusMap, autoGenerate, suggestionId) => {
                sessionStorage.setItem('preSelectedStudent', JSON.stringify({ id: student.id, name: student.name }));
                sessionStorage.setItem('prefillWorksheet', JSON.stringify({ topic, goal, additionalInfo: additionalInfo || '', grammarFocus: grammarFocus || '' }));
                // v4.8: persist source suggestion id so generation success can flip is_used.
                if (suggestionId) sessionStorage.setItem('prefillSuggestionId', suggestionId);
                else sessionStorage.removeItem('prefillSuggestionId');
                // v4.6: write exercises + focus map + inferred media family together so
                // the form can hydrate them coherently. Media family is inferred from
                // exercise IDs (picture/audio/none — never mixed).
                if (exercises && exercises.length > 0) {
                  sessionStorage.setItem('prefillExercises', JSON.stringify(exercises));
                  const PIC = ['describe-picture','answer-questions-picture','true-false-picture','multiple-choice-picture'];
                  const AUD = ['listening-comprehension','answer-questions-audio','true-false-audio','multiple-choice-audio','fill-in-blanks-audio'];
                  const hasPic = exercises.some(id => PIC.includes(id));
                  const hasAud = exercises.some(id => AUD.includes(id));
                  const media = hasPic && !hasAud ? ['picture'] : hasAud && !hasPic ? ['audio'] : hasPic && hasAud ? ['picture'] : [];
                  sessionStorage.setItem('prefillMediaTypes', JSON.stringify(media));
                }
                if (exerciseFocusMap && Object.keys(exerciseFocusMap).length > 0) {
                  sessionStorage.setItem('prefillExerciseFocusMap', JSON.stringify(exerciseFocusMap));
                }
                if (autoGenerate) sessionStorage.setItem('autoGenerateWorksheet', 'true');
                sessionStorage.setItem('forceNewWorksheet', 'true');
                navigate('/');
              }}
            />
          </TabsContent>

          {/* Progress Tab (backup) */}
          <TabsContent value="progress">
            <StudentProgressTab
              studentId={id || ''}
              teacherId={student.teacher_id}
              studentName={student.name}
              englishLevel={student.english_level}
              mainGoal={student.main_goal}
              studentNotes={studentKnowledge.entries.slice(0, 10).map(e => e.content)}
              onMainGoalChange={async (newGoal) => {
                await updateStudent(student.id, { main_goal: newGoal });
              }}
              onUseWorksheetSuggestion={(topic, goal, additionalInfo, grammarFocus, exercises) => {
                sessionStorage.setItem('preSelectedStudent', JSON.stringify({
                  id: student.id,
                  name: student.name
                }));
                sessionStorage.setItem('prefillWorksheet', JSON.stringify({
                  topic,
                  goal,
                  additionalInfo: additionalInfo || '',
                  grammarFocus: grammarFocus || ''
                }));
                if (exercises && exercises.length > 0) {
                  sessionStorage.setItem('prefillExercises', JSON.stringify(exercises));
                }
                sessionStorage.setItem('forceNewWorksheet', 'true');
                navigate('/');
              }}
            />
          </TabsContent>

          {/* Tests Tab */}
          <TabsContent value="tests">
            <StudentTestsTab
              studentId={id || ''}
              teacherId={student.teacher_id}
              studentName={student.name}
            />
          </TabsContent>

          {/* Skills Overview Tab - DSLM Layer B */}
          <TabsContent value="skills">
            <SkillsOverviewPanel
              studentId={id || ''}
              teacherId={student.teacher_id}
            />
          </TabsContent>

          {/* Knowledge Base Tab */}
          <TabsContent value="knowledge">
            <StudentKnowledgeSection
              studentId={id || ''}
              teacherId={student.teacher_id}
              studentName={student.name}
            />
          </TabsContent>

          {/* Flashcards Tab */}
          <TabsContent value="flashcards">
            <FlashcardSetsSection
              studentId={id || ''}
              teacherId={student.teacher_id}
              studentName={student.name || 'Student'}
              studentNativeLanguage={student.native_language || 'Spanish'}
              initialEditingSetId={activeTab === 'flashcards' ? flashcardSetId : null}
              onSetChange={handleFlashcardSetChange}
              teacherCalendarToken={teacherCalendarToken}
            />
          </TabsContent>

          {/* Calendar Tab */}
          <TabsContent value="calendar">
            <StudentCalendarTab studentId={id || ''} teacherId={student.teacher_id} />
          </TabsContent>

          {/* Events Tab - DSLM Debug Panel */}
          <TabsContent value="events">
            <EventLogPanel
              studentId={id || ''}
              teacherId={student.teacher_id}
            />
          </TabsContent>
        </Tabs>

        {/* Student Edit Dialog */}
        <StudentEditDialog
          student={student}
          isOpen={isEditDialogOpen}
          onClose={() => setIsEditDialogOpen(false)}
          onSave={updateStudent}
        />
        
        {/* PROBLEM 5: Share Worksheet Modal with pre-filled student email */}
        {shareWorksheetData && (
          <ShareWorksheetModal
            worksheetId={shareWorksheetData.id}
            worksheetTitle={shareWorksheetData.title}
            studentEmail={student?.student_email || ''}
            isOpen={shareModalOpen}
            onClose={() => {
              setShareModalOpen(false);
              setShareWorksheetData(null);
              refetchWorksheets();
            }}
          />
        )}
        
        {/* Rename Worksheet Dialog */}
        {renameWorksheetData && (
          <RenameDialog
            isOpen={!!renameWorksheetData}
            onClose={() => setRenameWorksheetData(null)}
            currentTitle={renameWorksheetData.title}
            onRename={(newTitle) => handleRenameWorksheet(renameWorksheetData.id, newTitle)}
            type="worksheet"
          />
        )}

        {/* v6.9.13 — Quick Add Note (from overview tab) */}
        <StudentKnowledgeQuickAddModal
          isOpen={quickAddNoteOpen}
          onClose={() => setQuickAddNoteOpen(false)}
          onAdd={studentKnowledge.addEntry}
          suggestedTags={studentKnowledge.suggestedTags || []}
        />
      </div>
    </AuthenticatedPageShell>
  );
};

export default StudentPage;
