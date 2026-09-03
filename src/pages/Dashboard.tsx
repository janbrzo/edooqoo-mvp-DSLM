import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthenticatedPageShell } from "@/components/AuthenticatedPageShell";
import { useAuthFlow } from "@/hooks/useAuthFlow";
import { useTokenSystem } from "@/hooks/useTokenSystem";
import { useStudents } from "@/hooks/useStudents";
import { useWorksheetHistory } from "@/hooks/useWorksheetHistory";
import { useProfile } from "@/hooks/useProfile";
import { useDemoContext } from "@/contexts/DemoContext";
import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";
import { useNextUpStudents } from "@/hooks/useNextUpStudents";
import { useDashboardAttention } from "@/hooks/useDashboardAttention";
import { useDashboardCounts } from "@/hooks/useDashboardCounts";
import { supabase } from '@/integrations/supabase/client';
import { devLog } from '@/utils/logger';
import { toast } from "sonner";
import StickyNav from '@/components/landing/StickyNav';
import { FreeWeekBanner } from "@/components/FreeWeekBanner";
import { AddStudentDialog } from "@/components/dashboard/AddStudentDialog";
import RenameDialog from "@/components/RenameDialog";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { GuidedStepsBar, guidedSteps } from "@/components/dashboard/GuidedStepsBar";
import { NextUpSection } from "@/components/dashboard/NextUpSection";
import { AttentionSection } from "@/components/dashboard/AttentionSection";
import { EverythingElseSection } from "@/components/dashboard/EverythingElseSection";
import { EmptyDashboard } from "@/components/dashboard/EmptyDashboard";
import { formatWorksheetTitle, type RecentWorksheet } from "@/components/dashboard/RecentWorksheetRow";

/**
 * v6.9.109 — `/dashboard` → "Today".
 * One job: point the teacher to the next move. Single column, three zones
 * (Next up · Needs your attention · Everything else). Spec:
 * docs/ux/dashboard-today-spec.md
 */
const Dashboard = () => {
  const { user, loading, isRegisteredUser } = useAuthFlow();
  const { tokenLeft, profile } = useTokenSystem(user?.id);
  const { profile: userProfile } = useProfile();
  const { students, loading: studentsLoading } = useStudents();
  // lightweight + listView: only the columns the row needs, first page only
  const { worksheets, loading: historyLoading, refetch: refetchWorksheets, deleteWorksheet } =
    useWorksheetHistory(undefined, true, true);
  const { items: nextUp, loading: nextUpLoading } = useNextUpStudents(students);
  const { items: attention, loading: attentionLoading } = useDashboardAttention(students);
  const { worksheetsCount, lessonsThisWeek } = useDashboardCounts();
  const { progress, dismissOnboarding } = useOnboardingProgress();
  const { isDemoMode, showDemoBlockedToast } = useDemoContext();

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [addStudentModalOpen, setAddStudentModalOpen] = useState(false);
  const [renameWorksheetData, setRenameWorksheetData] = useState<{ id: string; title: string } | null>(null);
  const [hasEverLoaded, setHasEverLoaded] = useState(false);

  const guided =
    !isDemoMode && !progress.completed && !progress.dismissed && !progress.steps.generate_worksheet;
  const showWorksheets = !guided || !!progress.steps.generate_worksheet;
  const steps = useMemo(() => guidedSteps(progress.steps), [progress.steps]);
  const recentWorksheets = useMemo(() => worksheets.slice(0, 5) as RecentWorksheet[], [worksheets]);

  // v6.9.8 — auto-open Add Student dialog when arriving from Welcome email CTA
  useEffect(() => {
    if (searchParams.get('action') === 'add-student' && isRegisteredUser && !isDemoMode) {
      setAddStudentModalOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('action');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, isRegisteredUser, isDemoMode, setSearchParams]);

  // Mark as loaded once core data is ready (first time only) — later navigations do not flash a spinner.
  useEffect(() => {
    if (!loading && !studentsLoading && !historyLoading && !hasEverLoaded) {
      setHasEverLoaded(true);
    }
  }, [loading, studentsLoading, historyLoading, hasEverLoaded]);

  useEffect(() => {
    if (!loading && !isRegisteredUser) {
      navigate('/');
    }
  }, [loading, isRegisteredUser, navigate]);

  if (!hasEverLoaded && (loading || studentsLoading || historyLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
        <div className="text-center">
          <div className="mx-auto h-32 w-32 animate-spin rounded-full border-b-2 border-primary" />
          <p className="mt-4 text-foreground">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  if (!isRegisteredUser) {
    return null;
  }

  const subscriptionType = profile?.subscription_type || 'Free Demo';

  const handleGenerateWorksheet = () => {
    // v6.9.8 — navigation handler MUST NOT block in demo (the generation guard lives in useWorksheetGeneration)
    sessionStorage.setItem('forceNewWorksheet', 'true');
    navigate('/');
  };

  const handleRenameWorksheet = async (newTitle: string) => {
    if (!renameWorksheetData) return;
    if (isDemoMode) { showDemoBlockedToast('Renaming worksheets'); return; }
    try {
      const { error } = await supabase
        .from('worksheets')
        .update({ title: newTitle })
        .eq('id', renameWorksheetData.id);
      if (error) throw error;
      toast.success('Worksheet renamed successfully');
      setRenameWorksheetData(null);
      await refetchWorksheets();
    } catch (error) {
      console.error('Error renaming worksheet:', error);
      toast.error('Failed to rename worksheet');
      throw error;
    }
  };

  const handleDeleteWorksheet = async (worksheetId: string) => {
    devLog('Dashboard: Deleting worksheet', worksheetId);
    try {
      const result = await deleteWorksheet(worksheetId);
      if (result.success) {
        await refetchWorksheets();
        return { success: true };
      }
      return { success: false, error: result.error || 'Failed to delete worksheet' };
    } catch (error) {
      console.error('Error deleting worksheet:', error);
      return { success: false, error: 'Failed to delete worksheet' };
    }
  };

  const openBell = () => {
    window.dispatchEvent(new CustomEvent('unifiedBell:open'));
  };

  const openAddStudent = () => setAddStudentModalOpen(true);

  return (
    <AuthenticatedPageShell>
      <FreeWeekBanner />
      <StickyNav
        isRegisteredUser={true}
        tokenLeft={tokenLeft}
        user={user}
        subscriptionType={subscriptionType}
        onGenerateWorksheet={handleGenerateWorksheet}
      />

      {/* App.tsx already renders the global <main>; this is a plain container. */}
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-6">
        <DashboardHeader
          firstName={userProfile?.first_name ?? null}
          studentsCount={students.length}
          lessonsThisWeek={lessonsThisWeek}
          onAddStudent={openAddStudent}
        />

        {students.length === 0 ? (
          <EmptyDashboard onAddStudent={openAddStudent} />
        ) : (
          <>
            {guided && <GuidedStepsBar steps={steps} onShowEverything={() => { void dismissOnboarding(); }} />}
            <NextUpSection items={nextUp} loading={nextUpLoading} />
            <AttentionSection items={attention} loading={attentionLoading} onOpenInbox={openBell} />
            <EverythingElseSection
              studentsCount={students.length}
              worksheetsCount={worksheetsCount}
              showWorksheets={showWorksheets}
              recentWorksheets={recentWorksheets}
              students={students}
              onRename={(w) => setRenameWorksheetData({ id: w.id, title: formatWorksheetTitle(w) })}
              onRefetch={refetchWorksheets}
              onDelete={handleDeleteWorksheet}
            />
          </>
        )}
      </div>

      <AddStudentDialog
        triggerButton={false}
        open={addStudentModalOpen}
        onOpenChange={setAddStudentModalOpen}
      />

      <RenameDialog
        isOpen={!!renameWorksheetData}
        onClose={() => setRenameWorksheetData(null)}
        currentTitle={renameWorksheetData?.title || ''}
        onRename={handleRenameWorksheet}
        type="worksheet"
      />
    </AuthenticatedPageShell>
  );
};

export default Dashboard;
