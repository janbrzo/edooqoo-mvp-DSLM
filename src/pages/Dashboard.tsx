import React, { useState, useEffect } from "react";
import { AuthenticatedPageShell } from "@/components/AuthenticatedPageShell";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthFlow } from "@/hooks/useAuthFlow";
import { useTokenSystem } from "@/hooks/useTokenSystem";
import { useStudents } from "@/hooks/useStudents";
import { useWorksheetHistory } from "@/hooks/useWorksheetHistory";
import { AddStudentDialog } from "@/components/dashboard/AddStudentDialog";
import { supabase } from '@/integrations/supabase/client';
import { StudentCard } from "@/components/dashboard/StudentCard";
import { StudentSelector } from "@/components/StudentSelector";
import { useProfile } from "@/hooks/useProfile";
import { useDemoContext } from "@/contexts/DemoContext";
import { format } from "date-fns";
import { 
  Users, 
  FileText, 
  Calendar,
  Plus,
  Target,
  Coins,
  BookOpen,
  Pencil,
  Search,
  ArrowUpAZ,
  ArrowDownAZ,
  Copy,
  Trash2,
  UserPlus,
  Share2
} from "lucide-react";
import { devLog } from '@/utils/logger';
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useWorksheetStats } from "@/hooks/useWorksheetStats";
import { DeleteWorksheetButton } from "@/components/DeleteWorksheetButton";
import { DuplicateWorksheetButton } from "@/components/DuplicateWorksheetButton";
import { FreeWeekBanner } from "@/components/FreeWeekBanner";
import { MediaBadges } from '@/components/worksheet/MediaBadges';
import { hasImage, hasAudio } from '@/utils/worksheetUtils';
import { useAllWorksheetHomework } from "@/hooks/useAllWorksheetHomework";
import { WorksheetHomeworkList } from "@/components/dashboard/WorksheetHomeworkList";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import RenameDialog from "@/components/RenameDialog";
import { toast } from "sonner";
import StickyNav from '@/components/landing/StickyNav';
import CompactStatsBar from '@/components/dashboard/CompactStatsBar';
import { useUpcomingLessonsCount } from '@/hooks/useUpcomingLessonsCount';

const Dashboard = () => {
  const { user, loading, isRegisteredUser } = useAuthFlow();
  const { tokenLeft, profile } = useTokenSystem(user?.id);
  const { students, loading: studentsLoading, refetch: refetchStudents, deleteStudent } = useStudents();
  // ✅ FIX: Use lightweight + listView mode - only fetch necessary columns, not ai_response & html_content
  const { worksheets, loading: historyLoading, refetch: refetchWorksheets, deleteWorksheet } = useWorksheetHistory(undefined, true, true);
  const { thisMonthCount, loading: statsLoading } = useWorksheetStats();
  const { profile: userProfile } = useProfile();
  const { isDemoMode, showDemoBlockedToast } = useDemoContext();
  
  const [addStudentModalOpen, setAddStudentModalOpen] = useState(false);
  const navigate = useNavigate();
  const [selectedTimeFrame, setSelectedTimeFrame] = useState("month");
  const [renameWorksheetData, setRenameWorksheetData] = useState<{id: string; title: string} | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [sortMode, setSortMode] = useState<'recent' | 'az' | 'za'>('recent');
  
  // ✅ FIX: Track if initial data has ever been loaded
  const [hasEverLoaded, setHasEverLoaded] = useState(false);
  
  // Fetch homework for all worksheets
  const worksheetIds = worksheets.map(w => w.id);
  const { homeworkByWorksheet, loading: homeworkLoading } = useAllWorksheetHomework(worksheetIds);
  const { count: upcomingLessonsCount } = useUpcomingLessonsCount();

  // ✅ FIX: Mark as loaded once all data is ready (only first time)
  useEffect(() => {
    if (!loading && !studentsLoading && !historyLoading && !statsLoading && !hasEverLoaded) {
      setHasEverLoaded(true);
    }
  }, [loading, studentsLoading, historyLoading, statsLoading, hasEverLoaded]);

  // Authentication check and redirection
  useEffect(() => {
    if (!loading && !isRegisteredUser) {
      navigate('/');
    }
  }, [loading, isRegisteredUser, navigate]);

  // ✅ FIX: Show loading state ONLY on first ever load, not on navigation back
  if (!hasEverLoaded && (loading || studentsLoading || historyLoading || statsLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!isRegisteredUser) {
    navigate('/');
    return null;
  }

  const displayName = userProfile?.first_name || 'Teacher';
  const subscriptionType = profile?.subscription_type || 'Free Demo';

  // Use stats from the new hook instead of calculating from filtered worksheets
  const totalWorksheetsCreated = profile?.total_worksheets_created || 0;

  const handleGenerateWorksheet = () => {
    if (isDemoMode) { showDemoBlockedToast('Generating worksheets'); return; }
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

  const handleWorksheetOpen = (worksheet: any) => {
    navigate(`/worksheet/${worksheet.id}`);
  };

  const handleDeleteWorksheet = async (worksheetId: string) => {
    devLog('Dashboard: Deleting worksheet', worksheetId);
    try {
      const result = await deleteWorksheet(worksheetId);
      if (result.success) {
        await refetchWorksheets(); // Refresh the worksheets list
        return { success: true };
      } else {
        return { success: false, error: result.error || 'Failed to delete worksheet' };
      }
    } catch (error) {
      console.error('Error deleting worksheet:', error);
      return { success: false, error: 'Failed to delete worksheet' };
    }
  };

  const formatWorksheetTitle = (worksheet: any) => {
    if (worksheet.title) return worksheet.title;
    const formData = worksheet.form_data;
    if (formData?.lessonTopic) return formData.lessonTopic;
    return 'Untitled Worksheet';
  };


  const getStudentNameForWorksheet = (worksheet: any) => {
    if (worksheet.student_id) {
      const student = students.find(s => s.id === worksheet.student_id);
      return student?.name;
    }
    return null;
  };

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

      <div className="container mx-auto px-4 py-4">

        <CompactStatsBar
          tokenLeft={tokenLeft}
          thisMonthCount={thisMonthCount}
          totalWorksheets={totalWorksheetsCreated}
          studentsCount={students.length}
          activeHomeworkCount={Object.values(homeworkByWorksheet).flat().filter((h: any) => !h.completed_at).length}
          upcomingLessonsCount={upcomingLessonsCount}
        />

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Students Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Students ({students.length})
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSortMode(prev => prev === 'az' ? 'za' : 'az')}
                    className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                    title={sortMode === 'az' ? 'Sort Z-A' : 'Sort A-Z'}
                  >
                    {sortMode === 'za' ? (
                      <><ArrowDownAZ className="h-3.5 w-3.5 mr-1" />Z-A</>
                    ) : (
                      <><ArrowUpAZ className="h-3.5 w-3.5 mr-1" />A-Z</>
                    )}
                  </Button>
                  {sortMode !== 'recent' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSortMode('recent')}
                      className="h-8 px-2 text-xs text-muted-foreground"
                    >
                      Recent
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => setAddStudentModalOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Student
                  </Button>
                </div>
              </div>
              <CardDescription>
                Manage your students and generate worksheets for them
              </CardDescription>
              {/* Search bar */}
              {students.length > 0 && (
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search students..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              )}
            </CardHeader>
            <CardContent>
              {students.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No students yet</p>
                  <Button
                    onClick={() => setAddStudentModalOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Student
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {(() => {
                    let filtered = students.filter(s => 
                      s.name.toLowerCase().includes(studentSearch.toLowerCase())
                    );
                    if (sortMode === 'az') {
                      filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
                    } else if (sortMode === 'za') {
                      filtered = [...filtered].sort((a, b) => b.name.localeCompare(a.name));
                    }
                    // 'recent' keeps the original order from useStudents (sorted by updated_at desc)
                    
                    if (filtered.length === 0 && studentSearch) {
                      return (
                        <p className="text-center text-sm text-muted-foreground py-4">
                          No students matching "{studentSearch}"
                        </p>
                      );
                    }
                    
                    return filtered.map((student) => (
                      <StudentCard 
                        key={student.id} 
                        student={student}
                        onOpenWorksheet={handleWorksheetOpen}
                        onDeleteStudent={deleteStudent}
                      />
                    ));
                  })()}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Worksheets */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Recent Worksheets
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    asChild
                  >
                    <Link to="/worksheets">
                      View All
                    </Link>
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleGenerateWorksheet}
                    className="gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Generate
                  </Button>
                </div>
              </div>
              <CardDescription>
                Your recently generated worksheets
              </CardDescription>
            </CardHeader>
            <CardContent>
              {worksheets.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No worksheets yet</p>
                  <Button onClick={handleGenerateWorksheet}>
                    <Plus className="h-4 w-4 mr-2" />
                    Generate Your First Worksheet
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {worksheets.slice(0, 5).map((worksheet) => {
                    const homework = homeworkByWorksheet[worksheet.id] || [];
                    const homeworkCount = homework.length;
                    
                    return (
                      <Card key={worksheet.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          {/* First line: Title + Student Badge + Media + Actions */}
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <Link 
                                to={`/worksheet/${worksheet.id}`}
                                className="flex items-center gap-2 min-w-0 cursor-pointer hover:text-primary transition-colors"
                              >
                                <h3 className="font-semibold text-base truncate">
                                  {formatWorksheetTitle(worksheet)}
                                </h3>
                              </Link>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setRenameWorksheetData({
                                    id: worksheet.id,
                                    title: formatWorksheetTitle(worksheet)
                                  });
                                }}
                                title="Rename worksheet"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Badge variant="secondary" className="text-xs shrink-0">
                                for {getStudentNameForWorksheet(worksheet) || 'Unassigned'}
                              </Badge>
                              <StudentSelector 
                                worksheetId={worksheet.id}
                                currentStudentId={worksheet.student_id}
                                onTransferSuccess={refetchWorksheets}
                              />
                              <MediaBadges 
                                hasImage={hasImage(worksheet)} 
                                hasAudio={hasAudio(worksheet)}
                                size="sm"
                              />
                            </div>
                            
                            <div className="flex items-center gap-0 shrink-0">
                              <DuplicateWorksheetButton 
                                worksheetId={worksheet.id}
                                worksheetTitle={formatWorksheetTitle(worksheet)}
                                onDuplicate={refetchWorksheets}
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                              />
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (worksheet.share_token) {
                                        const url = `${window.location.origin}/shared/${worksheet.share_token}`;
                                        navigator.clipboard.writeText(url);
                                        toast.success("Shared worksheet link copied to clipboard");
                                      } else {
                                        toast.error("No share link. Generate one from the worksheet view first.");
                                      }
                                    }}
                                  >
                                    <Share2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Copy share link</p></TooltipContent>
                              </Tooltip>
                              <DeleteWorksheetButton 
                                worksheetId={worksheet.id}
                                worksheetTitle={formatWorksheetTitle(worksheet)}
                                onDelete={handleDeleteWorksheet}
                                variant="ghost"
                                size="sm"
                              />
                            </div>
                          </div>
                          
                          {/* Second line: Topic */}
                          {worksheet.form_data?.lessonTopic && (
                            <p className="text-sm text-muted-foreground mb-2 truncate">
                              Topic: {worksheet.form_data.lessonTopic}
                            </p>
                          )}
                          
                          {/* Third line: Date + Time */}
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                            <Calendar className="h-3 w-3" />
                            <span>{format(new Date(worksheet.created_at), 'MMM dd, yyyy')}</span>
                            <span>•</span>
                            <span>{format(new Date(worksheet.created_at), 'HH:mm')}</span>
                          </div>
                          
                          {homeworkCount > 0 && (
                            <Collapsible>
                              <CollapsibleTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full justify-between hover:bg-accent/50"
                                >
                                  <span className="flex items-center gap-2 text-sm font-medium">
                                    <BookOpen className="h-4 w-4 text-primary" />
                                    Homework Assignments ({homeworkCount})
                                  </span>
                                  <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="mt-2">
                                <WorksheetHomeworkList homework={homework} />
                              </CollapsibleContent>
                            </Collapsible>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Add Student Modal - controlled externally */}
      <AddStudentDialog 
        triggerButton={false}
        open={addStudentModalOpen}
        onOpenChange={setAddStudentModalOpen}
        onStudentAdded={() => {
          setAddStudentModalOpen(false);
          refetchStudents();
        }}
      />
      
      {/* Rename Worksheet Dialog */}
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
