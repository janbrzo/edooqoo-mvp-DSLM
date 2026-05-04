import { useState, useMemo, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Calendar, Eye, Copy, ExternalLink, Trash2, FileText, CheckCircle2, Mail, Clock, Pencil } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useDemoContext } from '@/contexts/DemoContext';
import { useWorksheetHistory } from '@/hooks/useWorksheetHistory';
import { useAllWorksheetHomework, HomeworkAssignment } from '@/hooks/useAllWorksheetHomework';
import { CreateHomeworkModal } from '@/components/homework/CreateHomeworkModal';
import { SendHomeworkEmailDialog } from '@/components/homework/SendHomeworkEmailDialog';
import { useStudents } from '@/hooks/useStudents';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import RenameDialog from '@/components/RenameDialog';
import { devLog } from '@/utils/logger';

interface StudentHomeworkTabProps {
  studentId: string;
  teacherId: string;
  studentName: string;
}

export const StudentHomeworkTab = ({ studentId, teacherId, studentName }: StudentHomeworkTabProps) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed' | 'viewed' | 'not_viewed' | 'overdue'>('all');
  const [sortBy, setSortBy] = useState<'deadline' | 'created'>('created');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedWorksheetForHomework, setSelectedWorksheetForHomework] = useState<string>('');
  const [deletingHomeworkId, setDeletingHomeworkId] = useState<string | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedHomeworkForEmail, setSelectedHomeworkForEmail] = useState<HomeworkAssignment | null>(null);
  const [editingDeadline, setEditingDeadline] = useState<{id: string, date: Date, time: string} | null>(null);
  const [renameHomeworkData, setRenameHomeworkData] = useState<{id: string; title: string} | null>(null);
  
  const { students } = useStudents();
  const { worksheets } = useWorksheetHistory(studentId);
  const { isDemoMode } = useDemoContext();
  
  // Fetch homework directly for this student, regardless of worksheet assignment
  const [allHomework, setAllHomework] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const fetchHomework = async () => {
    if (isDemoMode) {
      setAllHomework([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('homework_assignments')
        .select(`
          *,
          students!inner(name, student_email)
        `)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Transform data to include student info at root level
      const transformedData = (data || []).map((hw: any) => ({
        ...hw,
        student_name: hw.students?.name || '',
        student_email: hw.students?.student_email || null
      }));
      
      setAllHomework(transformedData);
    } catch (error) {
      console.error('Error fetching homework:', error);
      setAllHomework([]);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchHomework();
  }, [studentId]);
  
  const refetch = fetchHomework;
  
  // Apply filters and sorting
  const filteredHomework = useMemo(() => {
    let filtered = [...allHomework];
    
    // Filter by status
    if (filterStatus === 'pending') {
      filtered = filtered.filter(hw => !hw.completed_at);
    } else if (filterStatus === 'completed') {
      filtered = filtered.filter(hw => hw.completed_at !== null);
    } else if (filterStatus === 'viewed') {
      filtered = filtered.filter(hw => hw.viewed_at !== null);
    } else if (filterStatus === 'not_viewed') {
      filtered = filtered.filter(hw => hw.viewed_at === null);
    } else if (filterStatus === 'overdue') {
      filtered = filtered.filter(hw => hw.deadline && isOverdue(hw.deadline));
    }
    
    // Sort
    if (sortBy === 'deadline') {
      filtered.sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });
    } else {
      filtered.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
    
    return filtered;
  }, [allHomework, filterStatus, sortBy]);
  
  const isOverdue = (deadline: string) => {
    return new Date(deadline) < new Date();
  };
  
  const handleCopyLink = async (shareToken: string | null, title: string) => {
    if (!shareToken) {
      toast.error("Share link not available");
      return;
    }
    
    const url = `${window.location.origin}/homework/${shareToken}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Homework link copied!");
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };
  
  const handleOpenHomework = (shareToken: string | null) => {
    if (!shareToken) {
      toast.error("Share link not available");
      return;
    }
    window.open(`/homework/${shareToken}`, '_blank');
  };
  
  const handleOpenEmailDialog = (hw: HomeworkAssignment) => {
    setSelectedHomeworkForEmail(hw);
    setEmailDialogOpen(true);
  };
  
  const handleMarkCompleted = async (homeworkId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please log in to mark homework as completed");
        return;
      }

      const { data, error } = await supabase.rpc('mark_homework_completed', {
        p_homework_id: homeworkId,
        p_user_id: user.id,
        p_is_teacher: true
      });

      if (error) throw error;

      toast.success("Homework marked as completed!");
      refetch(); // Refresh homework list
    } catch (error: any) {
      console.error('Error marking homework as completed:', error);
      toast.error(error.message || "Failed to mark homework as completed");
    }
  };
  
  const handleDeleteHomework = async (homeworkId: string) => {
    try {
      const { error } = await supabase
        .from('homework_assignments')
        .delete()
        .eq('id', homeworkId)
        .eq('teacher_id', teacherId);
      
      if (error) throw error;
      
      toast.success("Homework deleted successfully");
      refetch();
      setDeletingHomeworkId(null);
    } catch (error) {
      console.error('Error deleting homework:', error);
      toast.error("Failed to delete homework");
    }
  };
  
  const handleUpdateDeadline = async (homeworkId: string, newDate: Date, newTime: string) => {
    try {
      // Combine date and time
      const [hours, minutes] = newTime.split(':');
      const combinedDateTime = new Date(newDate);
      combinedDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      const { error } = await supabase
        .from('homework_assignments')
        .update({ deadline: combinedDateTime.toISOString() })
        .eq('id', homeworkId)
        .eq('teacher_id', teacherId);
      
      if (error) throw error;
      
      toast.success("Deadline updated successfully!");
      refetch();
      setEditingDeadline(null);
    } catch (error) {
      console.error('Error updating deadline:', error);
      toast.error("Failed to update deadline");
    }
  };
  
  const handleCreateNew = () => {
    if (worksheets.length === 0) {
      toast.error("No worksheets available. Create a worksheet first.");
      return;
    }
    // Set first worksheet as default
    setSelectedWorksheetForHomework(worksheets[0].id);
    setIsCreateModalOpen(true);
  };
  
  // Rename homework handler
  const handleRenameHomework = async (homeworkId: string, newTitle: string) => {
    try {
      const { error } = await supabase
        .from('homework_assignments')
        .update({ title: newTitle })
        .eq('id', homeworkId)
        .eq('teacher_id', teacherId);
      
      if (error) throw error;
      
      toast.success('Homework renamed successfully');
      refetch();
    } catch (error) {
      console.error('Error renaming homework:', error);
      toast.error('Failed to rename homework');
      throw error;
    }
  };
  
  // Get the first worksheet for the modal
  const firstWorksheet = worksheets[0];
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">
          Homework Assignments ({allHomework.length})
        </h2>
        <Button onClick={handleCreateNew}>
          <Plus className="h-4 w-4 mr-2" />
          Create New Homework
        </Button>
      </div>
      
      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Homework</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="not_viewed">Not Viewed</SelectItem>
            <SelectItem value="viewed">Viewed</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="deadline">By Deadline</SelectItem>
            <SelectItem value="created">By Created Date</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Homework List */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          Loading homework...
        </div>
      ) : filteredHomework.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            {allHomework.length === 0 
              ? "No homework assignments yet. Create one to get started!"
              : "No homework matches the selected filters."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredHomework.map((hw) => {
            const worksheet = worksheets.find(w => w.id === hw.source_worksheet_id);
            
            return (
              <Card key={hw.id} className="p-4">
                <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {hw.share_token ? (
                        <Link 
                          to={`/homework/${hw.share_token}`}
                          className="font-semibold mb-2 truncate block hover:text-primary hover:underline transition-colors"
                        >
                          {hw.title}
                        </Link>
                      ) : (
                        <span className="font-semibold mb-2 truncate block">
                          {hw.title}
                        </span>
                      )}
                      {/* Rename button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenameHomeworkData({
                            id: hw.id,
                            title: hw.title
                          });
                        }}
                        title="Rename homework"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                      {/* Completed Badge - only one badge, shown when homework is submitted */}
                      {hw.completed_at && (
                        <Badge className="bg-green-500 text-white text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Completed
                        </Badge>
                      )}
                      {hw.source_worksheet_id && (
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3 flex-shrink-0" />
                          Source: <Link 
                            to={`/worksheet/${hw.source_worksheet_id}`} 
                            className="text-primary hover:underline"
                          >
                            View Worksheet
                          </Link>
                        </span>
                      )}
            {hw.deadline && (
              <Popover>
                <PopoverTrigger asChild>
                  <Badge 
                    variant="secondary"
                    className={`cursor-pointer hover:bg-secondary/80 ${isOverdue(hw.deadline) && !hw.completed_at ? "text-red-600 border-red-600" : ""}`}
                  >
                    <Calendar className="h-3 w-3 mr-1" />
                    Due: {format(new Date(hw.deadline), 'MMM dd, yyyy HH:mm')}
                  </Badge>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-50" align="start">
                  <div className="p-3">
                    <Label className="text-sm font-medium mb-2 block">Change Deadline</Label>
                    <CalendarComponent
                      mode="single"
                      selected={editingDeadline?.id === hw.id ? editingDeadline.date : new Date(hw.deadline)}
                      onSelect={(date) => {
                        if (date) {
                          const currentTime = editingDeadline?.id === hw.id 
                            ? editingDeadline.time 
                            : format(new Date(hw.deadline), 'HH:mm');
                          setEditingDeadline({ id: hw.id, date, time: currentTime });
                        }
                      }}
                      className="rounded-md border"
                    />
                    <div className="mt-3 space-y-2">
                      <Label htmlFor={`time-${hw.id}`} className="text-sm">Time</Label>
                      <Input 
                        id={`time-${hw.id}`}
                        type="time" 
                        value={editingDeadline?.id === hw.id ? editingDeadline.time : format(new Date(hw.deadline), 'HH:mm')}
                        onChange={(e) => {
                          const currentDate = editingDeadline?.id === hw.id 
                            ? editingDeadline.date 
                            : new Date(hw.deadline);
                          setEditingDeadline({ id: hw.id, date: currentDate, time: e.target.value });
                        }}
                      />
                      <Button 
                        onClick={() => {
                          if (editingDeadline?.id === hw.id) {
                            handleUpdateDeadline(hw.id, editingDeadline.date, editingDeadline.time);
                          }
                        }}
                        className="w-full mt-2"
                        size="sm"
                      >
                        <Clock className="h-4 w-4 mr-2" />
                        Update Deadline
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
                      <Badge variant="outline" className="text-xs">
                        Created: {format(new Date(hw.created_at), 'MMM dd, yyyy')}
                      </Badge>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {hw.view_count} views
                      </span>
                      {hw.viewed_at && (
                        <span className="text-xs">
                          Last viewed: {format(new Date(hw.viewed_at), 'MMM dd, HH:mm')}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 flex-shrink-0">
                    {/* Mark as Completed button */}
                    {!hw.completed_at && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleMarkCompleted(hw.id)}
                        title="Mark as completed"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Mark Done
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEmailDialog(hw)}
                      title="Send email notification"
                    >
                      <Mail className="h-4 w-4" />
                    </Button>

                    {/* Calendar Icon for Deadline Edit */}
                    {hw.deadline && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            title="Edit deadline"
                          >
                            <Calendar className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 z-50" align="start">
                          <div className="p-3 space-y-3">
                            <div>
                              <Label className="text-sm font-medium">Deadline Date</Label>
                              <CalendarComponent
                                mode="single"
                                selected={editingDeadline?.id === hw.id ? editingDeadline.date : new Date(hw.deadline)}
                                onSelect={(date) => {
                                  if (date) {
                                    const currentTime = editingDeadline?.id === hw.id 
                                      ? editingDeadline.time 
                                      : format(new Date(hw.deadline), 'HH:mm');
                                    setEditingDeadline({ id: hw.id, date, time: currentTime });
                                  }
                                }}
                                initialFocus
                              />
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Time</Label>
                              <Input
                                type="time"
                                value={editingDeadline?.id === hw.id ? editingDeadline.time : format(new Date(hw.deadline), 'HH:mm')}
                                onChange={(e) => {
                                  const currentDate = editingDeadline?.id === hw.id 
                                    ? editingDeadline.date 
                                    : new Date(hw.deadline);
                                  setEditingDeadline({ id: hw.id, date: currentDate, time: e.target.value });
                                }}
                                className="mt-1"
                              />
                            </div>
                            <Button
                              onClick={() => {
                                if (editingDeadline?.id === hw.id) {
                                  handleUpdateDeadline(hw.id, editingDeadline.date, editingDeadline.time);
                                }
                              }}
                              className="w-full"
                              size="sm"
                            >
                              Update Deadline
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyLink(hw.share_token, hw.title)}
                      title="Copy homework link"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenHomework(hw.share_token)}
                      title="Open homework"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeletingHomeworkId(hw.id)}
                      title="Delete homework"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingHomeworkId} onOpenChange={(open) => !open && setDeletingHomeworkId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Homework Assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The student will no longer be able to access this homework.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingHomeworkId && handleDeleteHomework(deletingHomeworkId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Create Homework Modal */}
      {firstWorksheet && (
        <CreateHomeworkModal
          open={isCreateModalOpen}
          onOpenChange={setIsCreateModalOpen}
          worksheetId={selectedWorksheetForHomework || firstWorksheet.id}
          worksheetTitle={firstWorksheet.title || 'Worksheet'}
          exercises={(() => {
            // Safe parsing with try-catch to prevent crashes on corrupted ai_response
            if (!firstWorksheet.ai_response) return [];
            try {
              const parsed = JSON.parse(firstWorksheet.ai_response);
              return parsed.exercises || [];
            } catch (e) {
              console.error('❌ Failed to parse worksheet ai_response for homework modal:', e);
              devLog(`⚠️ Worksheet ${firstWorksheet.id} ai_response length: ${firstWorksheet.ai_response?.length || 0}`);
              return [];
            }
          })()}
          teacherId={teacherId}
          students={students.map(s => ({
            id: s.id,
            name: s.name,
            english_level: s.english_level
          }))}
          preselectedStudent={studentId}
        />
      )}
      
      {/* Email Dialog */}
      {selectedHomeworkForEmail && (
        <SendHomeworkEmailDialog
          open={emailDialogOpen}
          onOpenChange={setEmailDialogOpen}
          homeworkId={selectedHomeworkForEmail.id}
          homeworkTitle={selectedHomeworkForEmail.title}
          studentEmail={selectedHomeworkForEmail.student_email}
          studentId={selectedHomeworkForEmail.student_id}
          lastSentAt={selectedHomeworkForEmail.reminder_sent_at}
          currentReminderHours={selectedHomeworkForEmail.reminder_hours || 24}
          deadline={selectedHomeworkForEmail.deadline}
          reminderScheduledAt={selectedHomeworkForEmail.reminder_scheduled_at}
        />
      )}
      
      {/* Rename Homework Dialog */}
      {renameHomeworkData && (
        <RenameDialog
          isOpen={!!renameHomeworkData}
          onClose={() => setRenameHomeworkData(null)}
          currentTitle={renameHomeworkData.title}
          onRename={(newTitle) => handleRenameHomework(renameHomeworkData.id, newTitle)}
          type="homework"
        />
      )}
    </div>
  );
};
