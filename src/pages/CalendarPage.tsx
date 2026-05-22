import React, { useState, useEffect, useMemo } from 'react';
import { AuthenticatedPageShell } from '@/components/AuthenticatedPageShell';
import { useNavigate } from 'react-router-dom';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAuthFlow } from '@/hooks/useAuthFlow';
import { useTokenSystem } from '@/hooks/useTokenSystem';
import StickyNav from '@/components/landing/StickyNav';
import { useCalendarSlots, CalendarSlot, ViewMode } from '@/hooks/useCalendarSlots';
import { useCalendarSettings } from '@/hooks/useCalendarSettings';
import { useCalendarRecurrence } from '@/hooks/useCalendarRecurrence';
import { useStudents } from '@/hooks/useStudents';
import { useCalendarVacations } from '@/hooks/useCalendarVacations';
import { useCalendarNotifications, CalendarNotification } from '@/hooks/useCalendarNotifications';
import { CalendarWeekView } from '@/components/calendar/CalendarWeekView';
import { CalendarDayView } from '@/components/calendar/CalendarDayView';
import { CalendarMonthView } from '@/components/calendar/CalendarMonthView';
import { CalendarScheduleView } from '@/components/calendar/CalendarScheduleView';
import { CalendarToolbar } from '@/components/calendar/CalendarToolbar';
import { UnifiedSlotModal } from '@/components/calendar/UnifiedSlotModal';
import { SlotDetailModal } from '@/components/calendar/SlotDetailModal';
import { LinkWorksheetModal } from '@/components/calendar/LinkWorksheetModal';
import { CalendarNotificationBell } from '@/components/calendar/CalendarNotificationBell';
import { RecurringBookingModal } from '@/components/calendar/RecurringBookingModal';
import { AddStudentDialog } from '@/components/dashboard/AddStudentDialog';
import { PaymentHistoryModal } from '@/components/calendar/PaymentHistoryModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Filter, Search, Eye, EyeOff, Lock, X, Download } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useDemoContext } from '@/contexts/DemoContext';
import { cn } from '@/lib/utils';
import { format as fnsFormat } from 'date-fns';

const LEGEND_ITEMS = [
  { key: 'available', label: 'Available', badge: 'A', color: 'bg-green-200 border-green-400' },
  { key: 'booked', label: 'Booked', badge: 'B', color: 'bg-blue-200 border-blue-400' },
  { key: 'pending', label: 'Pending', badge: 'P', color: 'bg-amber-200 border-amber-400' },
  { key: 'needs_review', label: 'Needs Review', badge: '?', color: 'bg-purple-200 border-purple-400' },
  { key: 'completed', label: 'Completed', badge: '✓', color: 'bg-emerald-200 border-emerald-400' },
  { key: 'no_show', label: 'No Show', badge: 'NS', color: 'bg-red-200 border-red-400' },
  { key: 'rescheduled', label: 'Rescheduled', badge: 'R', color: 'bg-indigo-200 border-indigo-400' },
  { key: 'student_cancelled', label: 'Student Cancellation', badge: 'SC', color: 'bg-amber-200 border-amber-400' },
  { key: 'teacher_cancelled', label: 'Teacher Cancellation', badge: 'TC', color: 'bg-blue-200 border-blue-400' },
  { key: 'block', label: 'Block', badge: 'B', color: 'bg-gray-200 border-gray-400', icon: Lock },
  { key: 'deleted', label: 'Deleted', badge: 'D', color: 'bg-muted/50 border-border/50' },
];

const CalendarPage = () => {
  const { user, loading: authLoading, isRegisteredUser } = useAuthFlow();
  const { tokenLeft } = useTokenSystem(user?.id);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !isRegisteredUser) navigate('/login');
  }, [authLoading, isRegisteredUser, navigate]);

  const {
    slots, loading, viewMode, setViewMode, currentDate, setCurrentDate,
    weekStart, weekEnd, dateRange, showDeleted, setShowDeleted,
    createSlot, createSlotsBatch, updateSlot, deleteSlot, hardDeleteSlot, deleteSlotsBatch,
    navigate: calNavigate, getSlotsForDay, refetch,
  } = useCalendarSlots(user?.id);
  const { settings } = useCalendarSettings(user?.id);
  const { createRule } = useCalendarRecurrence(user?.id);
  const { students } = useStudents();
  const { vacations } = useCalendarVacations(user?.id);

  // Elevated notification state (Problem 7)
  const { notifications, unreadCount, markAllRead, refetch: refetchNotifications } = useCalendarNotifications(user?.id);

  const { isDemoMode, showDemoBlockedToast } = useDemoContext();
  const [gcalConnected, setGcalConnected] = useState<boolean | null>(null);
  useEffect(() => {
    if (!user?.id || isDemoMode) return;
    supabase.from('calendar_gcal_tokens').select('id').eq('teacher_id', user.id).maybeSingle()
      .then(({ data }) => setGcalConnected(!!data));
  }, [user?.id, isDemoMode]);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addModalDate, setAddModalDate] = useState<Date | undefined>();
  const [addModalStartTime, setAddModalStartTime] = useState<string | undefined>();
  const [selectedSlot, setSelectedSlot] = useState<CalendarSlot | null>(null);
  const [linkWorksheetSlot, setLinkWorksheetSlot] = useState<CalendarSlot | null>(null);
  const [studentFilter, setStudentFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [legendFilter, setLegendFilter] = useState<string | null>(null);

  // Multi-select for batch actions
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSlotIds, setSelectedSlotIds] = useState<Set<string>>(new Set());
  const [selectionType, setSelectionType] = useState<string | null>(null);

  // Unpaid counter
  const unpaidCount = useMemo(() => slots.filter(s =>
    s.student_id && ['booked', 'completed', 'needs_review'].includes(s.status) && !s.is_paid
  ).length, [slots]);

  // Add student dialog (from notification)
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [addStudentPrefill, setAddStudentPrefill] = useState<{ name: string; email: string } | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [recurringNotification, setRecurringNotification] = useState<CalendarNotification | null>(null);

  // Sync selectedSlot with fresh slots data
  useEffect(() => {
    if (selectedSlot) {
      const fresh = slots.find(s => s.id === selectedSlot.id);
      if (fresh && JSON.stringify(fresh) !== JSON.stringify(selectedSlot)) {
        setSelectedSlot(fresh);
      }
    }
  }, [slots]);

  const studentMap = useMemo(() => {
    const map: Record<string, string> = {};
    students.forEach(s => { map[s.id] = s.name; });
    return map;
  }, [students]);

  const studentList = useMemo(() => students.map(s => ({ id: s.id, name: s.name })), [students]);
  const studentsWithEmail = useMemo(() => students.map(s => ({ id: s.id, name: s.name, student_email: (s as any).student_email })), [students]);

  const filteredSlots = useMemo(() => {
    let result = slots;
    if (studentFilter !== 'all') {
      result = result.filter(s => s.student_id === studentFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        (s.student_id && studentMap[s.student_id]?.toLowerCase().includes(q)) ||
        s.notes?.toLowerCase().includes(q) ||
        s.title?.toLowerCase().includes(q)
      );
    }
    // Legend filter
    if (legendFilter) {
      result = result.filter(s => {
        if (legendFilter === 'block') return (s as any).slot_type === 'block';
        if (legendFilter === 'pending') return s.status === 'booked' && !s.confirmed_at;
        if (legendFilter === 'booked') return s.status === 'booked' && !!s.confirmed_at;
        if (legendFilter === 'deleted') return (s.status as any) === 'deleted';
        if (legendFilter === 'needs_review') return (s.status as any) === 'needs_review';
        if (legendFilter === 'unpaid') return !!s.student_id && !s.is_paid && ['booked','completed','needs_review'].includes(s.status);
        if (legendFilter === 'rescheduled') return s.status === 'available' && s.cancelled_by === 'system' && s.cancellation_reason?.includes('Rescheduled');
        if (legendFilter === 'student_cancelled') return s.status === 'available' && s.cancelled_by === 'student';
        if (legendFilter === 'teacher_cancelled') return s.status === 'available' && s.cancelled_by === 'teacher' || s.status === 'available' && s.cancelled_by === 'system' && !s.cancellation_reason?.includes('Rescheduled');
        return s.status === legendFilter;
      });
    }
    return result;
  }, [slots, studentFilter, searchQuery, studentMap, legendFilter]);

  const filteredGetSlotsForDay = useMemo(() => {
    return (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      return filteredSlots.filter(s => s.slot_date === dateStr);
    };
  }, [filteredSlots]);

  const handleAddSlot = (date?: Date, startTime?: string) => {
    setAddModalDate(date);
    setAddModalStartTime(startTime);
    setAddModalOpen(true);
  };

  const getSlotSelectionType = (slot: CalendarSlot): string => {
    if ((slot.status as any) === 'needs_review') return 'needs_review';
    if (slot.status === 'booked' && !slot.confirmed_at) return 'pending';
    if (slot.status === 'booked' && slot.confirmed_at) return 'booked';
    if (slot.status === 'available') return 'available';
    if (slot.status === 'completed') return 'completed';
    if (slot.status === 'no_show') return 'no_show';
    return slot.status;
  };

  const handleSlotClick = (slot: CalendarSlot) => {
    // v6.9.8 — demo: opening modals is allowed (read-only preview); blocking happens on Save
    if (selectionMode) {
      const slotType = getSlotSelectionType(slot);
      if (selectionType && slotType !== selectionType) return;
      setSelectedSlotIds(prev => {
        const next = new Set(prev);
        if (next.has(slot.id)) {
          next.delete(slot.id);
          if (next.size === 0) setSelectionType(null);
        } else {
          next.add(slot.id);
          if (!selectionType) setSelectionType(slotType);
        }
        return next;
      });
      return;
    }
    setSelectedSlot(slot);
  };

  const handleShare = () => {
    if (isDemoMode) { showDemoBlockedToast('Sharing public calendar'); return; }
    if (settings?.public_calendar_token) {
      const url = `${window.location.origin}/book/${settings.public_calendar_token}`;
      navigator.clipboard.writeText(url);
      toast.success('Public calendar link copied to clipboard!');
    } else {
      navigate('/calendar/settings');
      toast.info('Enable public calendar in settings first.');
    }
  };

  const handleExport = async () => {
    const from = fnsFormat(dateRange.from, 'yyyy-MM-dd');
    const to = fnsFormat(dateRange.to, 'yyyy-MM-dd');
    try {
      const { data, error } = await supabase.functions.invoke('calendar-export-csv', {
        body: { teacherId: user?.id, dateFrom: from, dateTo: to },
      });
      if (error) throw error;
      const blob = new Blob([data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `calendar-${from}-${to}.csv`;
      a.click(); URL.revokeObjectURL(url);
      toast.success('Export downloaded!');
    } catch (err: any) {
      toast.error('Export failed: ' + (err.message || 'Unknown error'));
    }
  };

  // handleWorksheetLinked is only used by UnifiedSlotModal (new lesson creation)
  const handleWorksheetLinked = async (worksheetId: string | null) => {
    // For UnifiedSlotModal flow only — SlotDetailModal now manages worksheet locally
    if (linkWorksheetSlot && linkWorksheetSlot.id === '__new__') {
      // This is a new lesson workflow — just store the worksheetId for the modal
      // The actual save happens in UnifiedSlotModal
    }
  };

  const handleLinkWorksheetBack = () => {
    setLinkWorksheetSlot(null);
  };

  const handleRecurringCreated = async (input: any) => {
    const result = await createRule(input);
    if (result) await refetch();
    return result;
  };

  const handleDayClick = (date: Date) => {
    setCurrentDate(date);
    setViewMode('day');
  };

  const handleBatchDelete = async () => {
    if (selectedSlotIds.size === 0) return;
    const confirmed = window.confirm(`Delete ${selectedSlotIds.size} available slots?`);
    if (!confirmed) return;
    await deleteSlotsBatch(Array.from(selectedSlotIds));
    setSelectedSlotIds(new Set());
    setSelectionMode(false);
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedSlotIds(new Set());
    setSelectionType(null);
  };

  // Helper to extract student email from student_notes
  const extractEmailFromNotes = (notes: string | null): string => {
    if (!notes) return '';
    const match = notes.match(/\(([^)]+@[^)]+)\)/);
    return match ? match[1] : '';
  };

  const handleBatchConfirm = async () => {
    if (selectedSlotIds.size === 0) return;
    if (!window.confirm(`Confirm ${selectedSlotIds.size} pending bookings?`)) return;
    const ids = Array.from(selectedSlotIds);
    // Fetch slots to get student emails for GCal sync
    const { data: slotsData } = await supabase.from('calendar_slots').select('id, student_notes').in('id', ids);
    await supabase.from('calendar_slots')
      .update({ confirmed_at: new Date().toISOString() } as any)
      .in('id', ids);
    for (const id of ids) {
      supabase.from('calendar_slot_logs').insert({
        slot_id: id, teacher_id: user?.id, action: 'confirmed', actor: 'teacher', details: { batch: true },
      } as any).then(() => {});
      supabase.functions.invoke('gcal-sync', {
        body: { teacherId: user?.id, slotId: id, action: 'upsert' },
      }).catch(console.error);
      // Student GCal sync
      const slotNotes = slotsData?.find(s => s.id === id)?.student_notes;
      const sEmail = extractEmailFromNotes(slotNotes);
      if (sEmail) {
        supabase.functions.invoke('student-gcal-sync', {
          body: { email: sEmail, teacherId: user?.id, slotId: id, action: 'upsert' },
        }).catch(console.error);
      }
    }
    toast.success(`Confirmed ${ids.length} bookings`);
    exitSelectionMode();
    refetch();
  };

  const handleBatchReject = async () => {
    if (selectedSlotIds.size === 0) return;
    if (!window.confirm(`Reject ${selectedSlotIds.size} pending bookings?`)) return;
    const ids = Array.from(selectedSlotIds);
    // Fetch slots to get student emails for GCal sync
    const { data: slotsData } = await supabase.from('calendar_slots').select('id, student_notes').in('id', ids);
    await supabase.from('calendar_slots')
      .update({ status: 'available', student_id: null, booked_at: null, booked_by: null, confirmed_at: null, student_notes: null, title: null } as any)
      .in('id', ids);
    for (const id of ids) {
      supabase.functions.invoke('gcal-sync', {
        body: { teacherId: user?.id, slotId: id, action: 'cancel' },
      }).catch(console.error);
      // Student GCal sync
      const slotNotes = slotsData?.find(s => s.id === id)?.student_notes;
      const sEmail = extractEmailFromNotes(slotNotes);
      if (sEmail) {
        supabase.functions.invoke('student-gcal-sync', {
          body: { email: sEmail, teacherId: user?.id, slotId: id, action: 'delete' },
        }).catch(console.error);
      }
    }
    toast.success(`Rejected ${ids.length} bookings`);
    exitSelectionMode();
    refetch();
  };

  const handleBatchStatusChange = async (status: string) => {
    if (selectedSlotIds.size === 0) return;
    if (!window.confirm(`Mark ${selectedSlotIds.size} slots as ${status}?`)) return;
    const ids = Array.from(selectedSlotIds);
    await supabase.from('calendar_slots').update({ status } as any).in('id', ids);
    for (const id of ids) {
      supabase.functions.invoke('gcal-sync', {
        body: { teacherId: user?.id, slotId: id, action: 'upsert' },
      }).catch(console.error);
    }
    toast.success(`${ids.length} slots marked as ${status}`);
    exitSelectionMode();
    refetch();
  };

  const handleUnifiedModalLinkWorksheet = (studentId: string | null) => {
    if (user) {
      setLinkWorksheetSlot({ student_id: studentId, worksheet_id: null, id: '__new__' } as any);
    }
  };

  const handleNotificationClick = async (n: CalendarNotification) => {
    // Recurring booking → open dedicated modal
    const slotIds = (n.metadata as any)?.slot_ids;
    if (n.notification_type === 'booking_pending' && Array.isArray(slotIds) && slotIds.length > 1 && !n.is_resolved) {
      setRecurringNotification(n);
      return;
    }
    if (n.slot_id) {
      const slot = slots.find(s => s.id === n.slot_id);
      if (slot) {
        setSelectedSlot(slot);
      } else {
        const { data } = await supabase.from('calendar_slots').select('*').eq('id', n.slot_id).single();
        if (data) {
          setCurrentDate(new Date(data.slot_date));
          setTimeout(() => { setSelectedSlot(data as any); }, 500);
        }
      }
    }
  };

  const handleAddStudentFromNotification = (name: string, email: string) => {
    setAddStudentPrefill({ name, email });
    setAddStudentOpen(true);
  };

  if (authLoading) return null;

  return (
    <AuthenticatedPageShell>
      <StickyNav 
        isRegisteredUser={!!isRegisteredUser} 
        tokenLeft={tokenLeft} 
        user={user}
      />
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
          </Button>
          <h1 className="text-2xl font-bold">Calendar</h1>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-8 w-40 pl-7 text-xs"
              />
            </div>
            <Select value={studentFilter} onValueChange={setStudentFilter}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <Filter className="h-3 w-3 mr-1" />
                <SelectValue placeholder="All students" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All students</SelectItem>
                {studentList.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={showDeleted ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setShowDeleted(!showDeleted)}
            >
              {showDeleted ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
              {showDeleted ? 'Hide Deleted' : 'Show Deleted'}
            </Button>
            {!selectionMode ? (
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setSelectionMode(true)}>
                Bulk Actions
              </Button>
            ) : (
              <div className="flex items-center gap-1">
                {(!selectionType || selectionType === 'available') && (
                  <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={handleBatchDelete} disabled={selectedSlotIds.size === 0}>
                    Delete ({selectedSlotIds.size})
                  </Button>
                )}
                {selectionType === 'pending' && (
                  <>
                    <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={handleBatchConfirm} disabled={selectedSlotIds.size === 0}>
                      Confirm ({selectedSlotIds.size})
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs text-destructive" onClick={handleBatchReject} disabled={selectedSlotIds.size === 0}>
                      Reject ({selectedSlotIds.size})
                    </Button>
                  </>
                )}
                {(selectionType === 'needs_review' || selectionType === 'booked') && (
                  <>
                    <Button size="sm" className="h-8 text-xs" onClick={() => handleBatchStatusChange('completed')} disabled={selectedSlotIds.size === 0}>
                      Complete ({selectedSlotIds.size})
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleBatchStatusChange('no_show')} disabled={selectedSlotIds.size === 0}>
                      No Show ({selectedSlotIds.size})
                    </Button>
                  </>
                )}
                {selectedSlotIds.size > 0 && selectionType && (
                  <span className="text-xs text-muted-foreground ml-1">{selectionType}</span>
                )}
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exitSelectionMode}>
                  Cancel
                </Button>
              </div>
            )}
            {settings?.payment_tracking_enabled && unpaidCount > 0 && (
              <Button variant="outline" size="sm" className="h-8 text-xs text-destructive border-destructive/30"
                onClick={() => setPaymentModalOpen(true)}>
                💰 {unpaidCount} unpaid
              </Button>
            )}
            
            {gcalConnected === false && (
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => navigate('/calendar/settings#gcal')}>
                🗓️ Connect GCal
              </Button>
            )}
            <CalendarNotificationBell
              teacherId={user?.id}
              students={studentsWithEmail}
              onNotificationClick={handleNotificationClick}
              onAddStudentClick={handleAddStudentFromNotification}
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAllRead={markAllRead}
            />
          </div>
        </div>

        <CalendarToolbar
          currentDate={currentDate}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onNavigate={calNavigate}
          onAddSlot={() => handleAddSlot()}
          onSettings={() => navigate('/calendar/settings')}
          onShare={handleShare}
          onLogs={() => navigate('/calendar/logs')}
        />

        {/* Legend with clickable filters */}
        <div className="flex flex-wrap gap-3 text-xs items-center">
          {LEGEND_ITEMS.map(item => (
            <button
              key={item.key}
              className={cn(
                'flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors',
                legendFilter === item.key ? 'ring-2 ring-primary bg-primary/10' : 'hover:bg-muted/50'
              )}
              onClick={() => setLegendFilter(legendFilter === item.key ? null : item.key)}
            >
              <span className={cn('w-3 h-3 rounded border text-[8px] font-bold flex items-center justify-center', item.color)}>
                {item.badge}
              </span>
              {item.label}
            </button>
          ))}
          {legendFilter && (
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setLegendFilter(null)}>
              <X className="h-3 w-3 mr-1" /> Clear filter
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">Loading calendar...</div>
        ) : viewMode === 'day' ? (
          <CalendarDayView date={currentDate} slots={filteredGetSlotsForDay(currentDate)} studentMap={studentMap} onSlotClick={handleSlotClick} onAddSlot={handleAddSlot} selectionMode={selectionMode} selectedIds={selectedSlotIds} startHour={settings?.display_start_hour} endHour={settings?.display_end_hour} />
        ) : viewMode === 'month' ? (
          <CalendarMonthView currentDate={currentDate} slots={filteredSlots} studentMap={studentMap} onDayClick={handleDayClick} onAddSlot={(date) => handleAddSlot(date)} onSlotClick={handleSlotClick} />
        ) : viewMode === 'schedule' ? (
          <CalendarScheduleView slots={filteredSlots} studentMap={studentMap} onSlotClick={handleSlotClick} />
        ) : (
          <CalendarWeekView weekStart={weekStart} getSlotsForDay={filteredGetSlotsForDay} studentMap={studentMap} onSlotClick={handleSlotClick} onAddSlot={handleAddSlot} selectionMode={selectionMode} selectedIds={selectedSlotIds} startHour={settings?.display_start_hour} endHour={settings?.display_end_hour} />
        )}
      </div>

      <UnifiedSlotModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onCreateSingle={createSlot}
        onCreateBatch={createSlotsBatch}
        onCreateRecurring={handleRecurringCreated}
        onDeleteSlot={deleteSlot}
        students={studentList}
        defaultDuration={settings?.default_lesson_duration_minutes || 60}
        defaultDate={addModalDate}
        defaultStartTime={addModalStartTime}
        currentDate={currentDate}
        existingSlots={slots}
        studentMap={studentMap}
        teacherId={user?.id}
        onLinkWorksheet={handleUnifiedModalLinkWorksheet}
        demoMode={isDemoMode}
      />

      <SlotDetailModal
        open={!!selectedSlot && !linkWorksheetSlot}
        onOpenChange={(open) => { if (!open) { setSelectedSlot(null); refetch(); } }}
        slot={selectedSlot}
        studentName={selectedSlot?.student_id ? studentMap[selectedSlot.student_id] : undefined}
        students={studentList}
        onUpdate={updateSlot}
        onDelete={hardDeleteSlot}
        onNotificationsChanged={refetchNotifications}
      />

      {linkWorksheetSlot && user && (
        <LinkWorksheetModal
          open={!!linkWorksheetSlot}
          onOpenChange={(open) => { if (!open) setLinkWorksheetSlot(null); }}
          onBack={handleLinkWorksheetBack}
          teacherId={user.id}
          studentId={linkWorksheetSlot.student_id}
          currentWorksheetId={linkWorksheetSlot.worksheet_id}
          onLink={handleWorksheetLinked}
        />
      )}

      {user?.id && recurringNotification && (
        <RecurringBookingModal
          open={!!recurringNotification}
          onOpenChange={(open) => { if (!open) setRecurringNotification(null); }}
          notification={recurringNotification}
          teacherId={user.id}
          students={studentList}
          onDone={() => { setRecurringNotification(null); refetch(); refetchNotifications(); }}
        />
      )}

      <AddStudentDialog
        open={addStudentOpen}
        onOpenChange={setAddStudentOpen}
        triggerButton={false}
        prefillName={addStudentPrefill?.name}
        prefillEmail={addStudentPrefill?.email}
      />

      {user?.id && (
        <PaymentHistoryModal
          open={paymentModalOpen}
          onOpenChange={setPaymentModalOpen}
          teacherId={user.id}
          students={studentList}
          settings={settings}
          onUpdated={refetch}
        />
      )}
    </AuthenticatedPageShell>
  );
};

export default CalendarPage;
