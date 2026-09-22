import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { AuthenticatedPageShell } from '@/components/AuthenticatedPageShell';
import { PageLoadingState } from '@/components/ui/PageLoadingState';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useDemoContext } from '@/contexts/DemoContext';
import { useAuthFlow } from '@/hooks/useAuthFlow';
import { useTokenSystem } from '@/hooks/useTokenSystem';
import StickyNav from '@/components/landing/StickyNav';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStudents } from '@/hooks/useStudents';
import { useStudent } from '@/hooks/useStudent';
import { useWorksheetHistory } from '@/hooks/useWorksheetHistory';
import { useDeletedWorksheets } from '@/hooks/useDeletedWorksheets';
import { StudentEditDialog } from '@/components/StudentEditDialog';
import { IntakeExtractionBanner } from '@/components/student/IntakeExtractionBanner';

import { StudentHeaderBar } from '@/components/student/StudentHeaderBar';
import { StudentSnapshotPanel } from '@/components/student/StudentSnapshotPanel';
import { StudentSettingsMenu } from '@/components/student/StudentSettingsMenu';
import { useStudentNextLesson } from '@/hooks/useStudentNextLesson';
import { selectFocusAreas, formatNextLessonLabel } from '@/lib/students/studentSnapshot';
import { PrepTab } from '@/components/student/prep/PrepTab';
// v6.9.111 M5.4 — Timeline tab (data hooks + presentational composition).
import { useStudentTimeline } from '@/hooks/useStudentTimeline';
import { useStudentTimelineSources } from '@/hooks/useStudentTimelineSources';
import { TIMELINE_PAGE_SIZE, type TimelineFilter } from '@/lib/students/timelineEvents';
import { useFutureTimeline } from '@/hooks/useFutureTimeline';
import { selectPrepSuggestion, buildRationale, type PrepSuggestion } from '@/lib/students/prepPlan';
// v6.9.111 M6.4 — Library tab (pure rules + presentational composition).
import {
  buildWorksheetItems,
  filterBySearch,
  sortItems,
  type LibrarySection,
  type LibrarySort,
  type LibraryWorksheetItem,
} from '@/lib/students/libraryItems';
// v6.9.111 M7.2 — canonical URL contract for the student workspace.
import {
  buildWorkspaceParams,
  resolveTab,
  resolveWorkspaceParams,
  WORKSPACE_TABS,
  type WorkspaceNavigationTarget,
  type WorkspaceTab,
} from '@/lib/students/workspaceTabs';
import { DeleteWorksheetButton } from "@/components/DeleteWorksheetButton";
import { DuplicateWorksheetButton } from "@/components/DuplicateWorksheetButton";
import { StudentSelector } from '@/components/StudentSelector';
import { useStudentKnowledge } from '@/hooks/useStudentKnowledge';
import { StudentKnowledgeQuickAddModal } from '@/components/student-knowledge/StudentKnowledgeQuickAddModal';
import { useAllWorksheetHomework } from '@/hooks/useAllWorksheetHomework';
import { WelcomeTestSuggestion } from '@/components/dashboard/WelcomeTestSuggestion';
import { Activity, Brain, FileText, Sparkles } from 'lucide-react';
import { writeAutoGenerateIntent } from '@/lib/worksheet/autoGenerateBootstrap';
import { hasImage, hasAudio } from '@/utils/worksheetUtils';
import ShareWorksheetModal from '@/components/ShareWorksheetModal';
import RenameDialog from '@/components/RenameDialog';
import { toast } from 'sonner';
import { SectionSkeleton } from '@/components/dslm/SectionSkeleton';

/**
 * v6.9.111 M7.4 — lazy workspace areas.
 *
 * Prep stays eager: it is the default tab and must paint without a second
 * network round-trip. Timeline, Library and Learning model are code-split and
 * only requested once their tab becomes active (Radix unmounts inactive
 * TabsContent), each behind a local SectionSkeleton — never a full-page spinner.
 */
const TimelineTab = lazy(() =>
  import('@/components/student/timeline/TimelineTab').then((m) => ({ default: m.TimelineTab })),
);
const LibraryTab = lazy(() =>
  import('@/components/student/library/LibraryTab').then((m) => ({ default: m.LibraryTab })),
);
const DSLMTab = lazy(() =>
  import('@/components/dslm/DSLMTab').then((m) => ({ default: m.DSLMTab })),
);
const DslmExplainerBanner = lazy(() =>
  import('@/components/student/DslmExplainerBanner').then((m) => ({
    default: m.DslmExplainerBanner,
  })),
);



/** Four task-oriented destinations shown in the canonical workspace tab strip. */
const WORKSPACE_TAB_PRESENTATION = {
  prep: { label: 'Prep', Icon: Sparkles },
  timeline: { label: 'Timeline', Icon: Activity },
  library: { label: 'Library', Icon: FileText },
  model: { label: 'Learning model', Icon: Brain },
} satisfies Record<WorkspaceTab, { label: string; Icon: typeof Sparkles }>;

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
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [timelineVisibleCount, setTimelineVisibleCount] = useState(TIMELINE_PAGE_SIZE);
  const [librarySearch, setLibrarySearch] = useState('');
  const [librarySort, setLibrarySort] = useState<LibrarySort>('newest');

  /**
   * v6.9.111 M7.3 — the canonical URL contract now owns all four visible tabs.
   * Legacy aliases are normalised with replace, so bookmarks and email links
   * enter the matching task-oriented workspace without polluting Back history.
   */
  const workspace = useMemo(() => resolveWorkspaceParams(searchParams), [searchParams]);
  const activeTab = workspace.resolved.tab;

  useEffect(() => {
    if (!workspace.changed) return;
    setSearchParams(workspace.next, { replace: true });
  }, [workspace, setSearchParams]);

  const timelineFilter: TimelineFilter = workspace.resolved.filter ?? 'all';
  const librarySection: LibrarySection = workspace.resolved.section ?? 'worksheets';

  const pageSize = 10;

  // Get flashcard set ID from URL
  const flashcardSetId = searchParams.get('set');

  /** Writes canonical workspace state into the URL (teacher-initiated nav). */
  const navigateWorkspace = (target: WorkspaceNavigationTarget) => {
    setSearchParams(buildWorkspaceParams(searchParams, target));
  };

  /** Main tab clicks always write one of the four canonical destinations. */
  const handleTabChange = (tab: string) => {
    navigateWorkspace({ tab: resolveTab(tab).tab } as WorkspaceNavigationTarget);
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

  // v6.9.111 M3.3 — workspace frame: focus areas + next lesson summary.
  const focusAreas = useMemo(
    () => selectFocusAreas(studentKnowledge.entries),
    [studentKnowledge.entries],
  );
  const { lesson: nextLesson, isLoading: nextLessonLoading } = useStudentNextLesson(
    id,
    student?.teacher_id,
  );
  const nextLessonLabel = useMemo(() => formatNextLessonLabel(nextLesson), [nextLesson]);

  // v6.9.111 M4.4 — Prep tab data (no new network call in the target state:
  // OneMinutePrepCard already calls this hook on the Overview tab today).
  const futureTimeline = useFutureTimeline({
    // Demo ids are not UUIDs — keep Supabase out of it (see demo-mode rule).
    studentId: isDemoMode ? '' : id || '',
    teacherId: isDemoMode ? '' : student?.teacher_id || '',
  });
  const prepSuggestion = useMemo(
    () =>
      selectPrepSuggestion(futureTimeline.phaseSteps as any, futureTimeline.nextSteps as any, {
        mainGoal: student?.main_goal ?? null,
        focusAreas,
      }),
    [futureTimeline.phaseSteps, futureTimeline.nextSteps, student?.main_goal, focusAreas],
  );
  const prepRationale = useMemo(
    () => buildRationale(prepSuggestion, focusAreas),
    [prepSuggestion, focusAreas],
  );

  // v6.9.111 M5.4 — Timeline data. The three extra reads only fire once the
  // Timeline tab is actually open; worksheets and notes are already loaded.
  const timelineSources = useStudentTimelineSources(
    id,
    student?.teacher_id,
    activeTab === 'timeline',
  );
  const timeline = useStudentTimeline({
    lessons: timelineSources.lessons,
    homework: timelineSources.homework,
    tests: timelineSources.tests,
    worksheets: worksheets as any,
    knowledgeEntries: studentKnowledge.entries as any,
    filter: timelineFilter,
    visibleCount: timelineVisibleCount,
  });

  const handleTimelineFilterChange = (next: TimelineFilter) => {
    navigateWorkspace({ tab: 'timeline', filter: next });
    setTimelineVisibleCount(TIMELINE_PAGE_SIZE);
  };

  /** Resolve relative timeline aliases through the canonical workspace contract. */
  const handleTimelineNavigate = (href: string) => {
    if (!href.startsWith('?')) {
      navigate(href);
      return;
    }

    const targetParams = new URLSearchParams(href.slice(1));
    const target = resolveWorkspaceParams(targetParams).resolved;

    if (target.tab === 'timeline') {
      navigateWorkspace({
        tab: 'timeline',
        filter: target.filter,
        testId: targetParams.get('testId') ?? undefined,
      });
      return;
    }
    if (target.tab === 'library') {
      navigateWorkspace({
        tab: 'library',
        section: target.section,
        set: targetParams.get('set') ?? undefined,
      });
      return;
    }
    if (target.tab === 'model') {
      navigateWorkspace({
        tab: 'model',
        view: target.view,
        focus: targetParams.get('focus') ?? undefined,
        editSuggestion: targetParams.get('editSuggestion') ?? undefined,
        cacheKey: targetParams.get('_') ?? undefined,
      });
      return;
    }
    navigateWorkspace({ tab: 'prep' });
  };

  // v6.9.111 M6.4 — Library items: no extra queries, reuse the page worksheets.
  const libraryItems = useMemo(() => {
    const built = buildWorksheetItems(
      (worksheets as any[]).map((w) => ({
        id: w.id,
        title: w.title,
        created_at: w.created_at,
        form_data: w.form_data,
        share_token: w.share_token,
        student_id: w.student_id,
        hasImage: hasImage(w),
        hasAudio: hasAudio(w),
      })),
    );
    return sortItems(filterBySearch(built, librarySearch), librarySort);
  }, [worksheets, librarySearch, librarySort]);

  const libraryDeletedItems = useMemo(
    () =>
      (deletedWorksheets as any[]).map((w) => ({
        id: w.id,
        title: w.title,
        deletedAt: w.deleted_at,
      })),
    [deletedWorksheets],
  );

  const handleLibrarySectionChange = (section: LibrarySection) => {
    navigateWorkspace({ tab: 'library', section });
    setLibrarySearch('');
    setCurrentPage(1);
  };

  const handleLibraryRestore = async (worksheetId: string) => {
    const result = await restoreDeleted(worksheetId);
    if (result.success) refetchWorksheets();
  };

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
    return <PageLoadingState label="Loading student profile" />;
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

  // v6.9.111 M4.4 — Prep tab: same contract as `onUseWorksheetSuggestion`
  // below. The Worksheet Generation Engine itself is untouched; this only
  // prefills the form / writes the auto-generate intent.
  const handlePrepGenerate = (s: PrepSuggestion, autoGenerate: boolean) => {
    sessionStorage.setItem('preSelectedStudent', JSON.stringify({ id: student.id, name: student.name }));
    if (autoGenerate) {
      writeAutoGenerateIntent({
        studentId: student.id,
        suggestionId: s.id,
        topic: s.topic,
        goal: s.goal,
        additionalInfo: s.additionalInfo,
        grammarFocus: s.grammarFocus,
        exercises: s.exercises,
        exerciseFocusMap: s.exerciseFocusMap,
        studentName: student.name || null,
        studentEmail: (student as any).student_email || null,
      });
    } else {
      sessionStorage.setItem('prefillWorksheet', JSON.stringify({
        topic: s.topic,
        goal: s.goal,
        additionalInfo: s.additionalInfo,
        grammarFocus: s.grammarFocus,
      }));
      if (s.id) sessionStorage.setItem('prefillSuggestionId', s.id);
      else sessionStorage.removeItem('prefillSuggestionId');
      if (s.exercises.length > 0) {
        sessionStorage.setItem('prefillExercises', JSON.stringify(s.exercises));
      }
      if (Object.keys(s.exerciseFocusMap).length > 0) {
        sessionStorage.setItem('prefillExerciseFocusMap', JSON.stringify(s.exerciseFocusMap));
      }
      sessionStorage.setItem('forceNewWorksheet', 'true');
    }
    navigate('/');
  };

  /** Reuse: prefill the form from an existing worksheet's saved form_data. */
  const handleReuseWorksheet = (worksheetId: string) => {
    const source: any = worksheets.find((w: any) => w.id === worksheetId);
    const fd = source?.form_data || null;
    sessionStorage.setItem('preSelectedStudent', JSON.stringify({ id: student.id, name: student.name }));
    if (fd) {
      sessionStorage.setItem('prefillWorksheet', JSON.stringify({
        topic: fd.topic || fd.lessonTopic || '',
        goal: fd.lessonGoal || fd.goal || '',
        additionalInfo: fd.additionalInformation || fd.additionalInfo || '',
        grammarFocus: fd.grammarFocus || '',
      }));
      sessionStorage.removeItem('prefillSuggestionId');
    }
    sessionStorage.setItem('forceNewWorksheet', 'true');
    navigate('/');
  };

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
      />
      <div className="max-w-6xl mx-auto p-4">
        <StudentHeaderBar
          name={student.name}
          englishLevel={student.english_level}
          mainGoal={student.main_goal}
          nextLessonLabel={nextLessonLabel}
          isNextLessonLoading={nextLessonLoading}
          menu={
            <StudentSettingsMenu
              student={student as any}
              teacherId={student.teacher_id}
              gcalEnabled={gcalEnabled}
              onEdit={() => setIsEditDialogOpen(true)}
              onDelete={handleDeleteStudent}
            />
          }
        />

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-6">
          <div className="order-2 min-w-0 lg:order-1">


        {/* v6.9.62 P6 — intake extraction banner: shown when ?intake=<id> is present. */}
        {searchParams.get('intake') && id ? (
          <IntakeExtractionBanner
            extractionId={searchParams.get('intake') as string}
            studentId={id}
            onDismiss={() => {
              const next = new URLSearchParams(searchParams);
              next.delete('intake');
              setSearchParams(next, { replace: true });
            }}
          />
        ) : null}

        {/* v6.9.111 M7.3 — four task-oriented workspace tabs. */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="mb-6 grid h-auto min-h-11 w-full grid-cols-4">
            {WORKSPACE_TABS.map((tab) => {
              const { label, Icon } = WORKSPACE_TAB_PRESENTATION[tab];
              return (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="min-w-0 gap-1 px-1 text-xs sm:gap-2 sm:px-3 sm:text-sm"
                  aria-label={label}
                  title={label}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {tab === 'model' ? (
                    <>
                      <span className="sm:hidden">Model</span>
                      <span className="hidden sm:inline">Learning model</span>
                    </>
                  ) : (
                    <span>{label}</span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Prep Tab (v6.9.111 M4.4) */}
          <TabsContent value="prep">
            <PrepTab
              banners={
                <WelcomeTestSuggestion
                  studentId={student.id}
                  teacherId={student.teacher_id}
                  studentName={student.name}
                  studentEmail={student.student_email}
                  surface="overview"
                />
              }
              studentName={student.name}
              nextLessonLabel={nextLessonLabel}
              isLessonLoading={nextLessonLoading}
              suggestion={prepSuggestion}
              rationale={prepRationale}
              focusAreas={focusAreas}
              isSuggestionsLoading={futureTimeline.loading}
              onGenerate={() => handlePrepGenerate(prepSuggestion, true)}
              onChangeTopic={() => handlePrepGenerate(prepSuggestion, false)}
              onOpenModel={() => navigateWorkspace({ tab: 'model' })}
              lastWorksheet={
                worksheets && worksheets.length > 0
                  ? {
                      id: (worksheets[0] as any).id,
                      title: (worksheets[0] as any).title ?? null,
                      created_at: (worksheets[0] as any).created_at,
                    }
                  : null
              }
              isWorksheetLoading={loading}
              onReuse={handleReuseWorksheet}
              onOpenLibrary={() => navigateWorkspace({ tab: 'library', section: 'worksheets' })}
              recentNotes={studentKnowledge.entries.slice(0, 3)}
              isNotesLoading={studentKnowledge.isLoading}
              isNoteSaving={false}
              onSaveNote={async (content) => {
                await studentKnowledge.addEntry({
                  content,
                  category: 'Notes',
                  entry_source: 'manual',
                } as any);
              }}
              onExpandNote={() => setQuickAddNoteOpen(true)}
              onViewAllNotes={() => navigateWorkspace({ tab: 'model', view: 'profile' })}
            />
          </TabsContent>

          {/* Timeline Tab (v6.9.111 M5.4) */}
          <TabsContent value="timeline">
            <Suspense fallback={<SectionSkeleton />}>
            <TimelineTab
              groups={timeline.groups}
              counts={timeline.counts}
              filter={timelineFilter}
              onFilterChange={handleTimelineFilterChange}
              isLoading={timelineSources.isLoading}
              isEmpty={timeline.isEmpty}
              hasMore={timeline.hasMore}
              onLoadMore={() =>
                setTimelineVisibleCount((count) => count + TIMELINE_PAGE_SIZE)
              }
              onNavigate={handleTimelineNavigate}
              onGoToPrep={() => handleTabChange('prep')}
            />
          </TabsContent>

          {/* v6.9.111 M6.4 — Library tab */}
          <TabsContent value="library">
            <LibraryTab
              section={librarySection}
              counts={{ worksheets: totalCount || 0 }}
              onSectionChange={handleLibrarySectionChange}
              items={libraryItems}
              isLoading={loading}
              search={librarySearch}
              onSearchChange={setLibrarySearch}
              sort={librarySort}
              onSortChange={setLibrarySort}
              onGenerate={handleGenerateWorksheet}
              onOpen={(worksheetId) => navigate(`/worksheet/${worksheetId}`)}
              onReuse={handleReuseWorksheet}
              onRename={(worksheetId, currentTitle) =>
                setRenameWorksheetData({ id: worksheetId, title: currentTitle })
              }
              onShare={(item: LibraryWorksheetItem) => {
                setShareWorksheetData({
                  id: item.id,
                  title: item.title,
                  shareToken: item.shareToken || undefined,
                });
                setShareModalOpen(true);
              }}
              renderWorksheetActions={(item: LibraryWorksheetItem) => (
                <>
                  <DuplicateWorksheetButton
                    worksheetId={item.id}
                    worksheetTitle={item.title}
                    onDuplicate={refetchWorksheets}
                  />
                  <StudentSelector
                    worksheetId={item.id}
                    currentStudentId={item.studentId || undefined}
                    worksheetTitle={item.title}
                    onTransferSuccess={refetchWorksheets}
                  />
                  <DeleteWorksheetButton
                    worksheetId={item.id}
                    worksheetTitle={item.title}
                    onDelete={deleteWorksheet}
                  />
                </>
              )}
              page={currentPage}
              pageCount={Math.max(1, Math.ceil((totalCount || 0) / pageSize))}
              onPageChange={setCurrentPage}
              deletedItems={libraryDeletedItems}
              deletedTotalCount={deletedTotalCount || 0}
              isDeletedLoading={deletedLoading}
              onRestore={handleLibraryRestore}
            />
          </TabsContent>

          {/* Learning model tab */}
          <TabsContent value="model">
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
                if (autoGenerate) {
                  // v6.9.53 — single source of truth: persistent intent in
                  // localStorage + legacy session flags mirrored inside the
                  // helper. Survives refresh, mount-race and premature clears.
                  writeAutoGenerateIntent({
                    studentId: student.id,
                    suggestionId: suggestionId || null,
                    topic,
                    goal: goal || '',
                    additionalInfo: additionalInfo || '',
                    grammarFocus: grammarFocus || '',
                    exercises: exercises || [],
                    exerciseFocusMap: (exerciseFocusMap || {}) as Record<string, 'vocabulary' | 'grammar'>,
                    // v6.9.55 — surface in GeneratingModal header.
                    studentName: student.name || null,
                    studentEmail: (student as any).student_email || null,
                  });
                } else {
                  // Manual "Use this" — only prefill, never auto-fire.
                  sessionStorage.setItem('prefillWorksheet', JSON.stringify({ topic, goal, additionalInfo: additionalInfo || '', grammarFocus: grammarFocus || '' }));
                  if (suggestionId) sessionStorage.setItem('prefillSuggestionId', suggestionId);
                  else sessionStorage.removeItem('prefillSuggestionId');
                  if (exercises && exercises.length > 0) {
                    sessionStorage.setItem('prefillExercises', JSON.stringify(exercises));
                    const PIC = ['describe-picture','answer-questions-picture','true-false-picture','multiple-choice-picture'];
                    const AUD = ['listening-comprehension','answer-questions-audio','true-false-audio','multiple-choice-audio','fill-in-blanks-audio'];
                    const hasPic = exercises.some(id => PIC.includes(id));
                    const hasAud = exercises.some(id => AUD.includes(id));
                    const media = hasPic ? ['picture'] : hasAud ? ['audio'] : [];
                    sessionStorage.setItem('prefillMediaTypes', JSON.stringify(media));
                  }
                  if (exerciseFocusMap && Object.keys(exerciseFocusMap).length > 0) {
                    sessionStorage.setItem('prefillExerciseFocusMap', JSON.stringify(exerciseFocusMap));
                  }
                  sessionStorage.setItem('forceNewWorksheet', 'true');
                }
                navigate('/');
              }}
            />
          </TabsContent>

        </Tabs>
          </div>

          <div className="order-1 lg:order-2">
          <StudentSnapshotPanel
            englishLevel={student.english_level}
            mainGoal={student.main_goal}
            mainGoalTargetDate={(student as any).main_goal_target_date ?? null}
            focusAreas={focusAreas}
            hubEmail={student.student_email}
            onOpenModel={() => navigateWorkspace({ tab: 'model' })}
          />
          </div>
        </div>



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
          onAdd={async (entry) => { await studentKnowledge.addEntry(entry); }}
          suggestedTags={studentKnowledge.suggestedTags || []}
        />
      </div>
    </AuthenticatedPageShell>
  );
};

export default StudentPage;
