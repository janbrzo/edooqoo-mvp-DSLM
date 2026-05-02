import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthFlow } from '@/hooks/useAuthFlow';
import { useCalendarSlotLogs, SlotLog } from '@/hooks/useCalendarSlotLogs';
import { useStudents } from '@/hooks/useStudents';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, History, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

const ACTIONS = ['all', 'created', 'booked', 'confirmed', 'cancelled_by_teacher', 'cancelled_by_student', 'rescheduled', 'reschedule_requested', 'student_assigned', 'student_removed', 'student_changed', 'time_changed', 'notes_updated', 'worksheet_linked', 'status_changed', 'deleted', 'hard_deleted', 'restored', 'rejected'];

function humanizeAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

const CalendarLogHistoryPage = () => {
  const { user, loading: authLoading, isRegisteredUser } = useAuthFlow();
  const navigate = useNavigate();
  const { logs, loading, total, fetchLogs } = useCalendarSlotLogs(user?.id);
  const { students } = useStudents();
  const [page, setPage] = useState(0);
  const [actionFilter, setActionFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [studentFilterId, setStudentFilterId] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    if (!authLoading && !isRegisteredUser) navigate('/login');
  }, [authLoading, isRegisteredUser, navigate]);

  useEffect(() => {
    if (user?.id) {
      fetchLogs({ page, action: actionFilter === 'all' ? undefined : actionFilter });
    }
  }, [user?.id, page, actionFilter, fetchLogs]);

  const totalPages = Math.ceil(total / 50);

  const studentList = useMemo(() => students.map(s => ({ id: s.id, name: s.name })), [students]);

  const filteredLogs = useMemo(() => {
    let result = logs;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        JSON.stringify(l.details).toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q)
      );
    }
    if (studentFilterId !== 'all') {
      result = result.filter(l =>
        l.details?.student_id === studentFilterId ||
        l.details?.student_name?.toLowerCase().includes(
          students.find(s => s.id === studentFilterId)?.name?.toLowerCase() || ''
        )
      );
    }
    if (dateFrom) {
      result = result.filter(l => l.created_at >= dateFrom);
    }
    if (dateTo) {
      result = result.filter(l => l.created_at.slice(0, 10) <= dateTo);
    }
    return result;
  }, [logs, search, studentFilterId, dateFrom, dateTo, students]);

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/calendar')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Calendar
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="h-5 w-5" /> Calendar Logs
          </h1>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Select value={actionFilter} onValueChange={v => { setActionFilter(v); setPage(0); }}>
            <SelectTrigger className="h-8 w-48 text-xs">
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              {ACTIONS.map(a => (
                <SelectItem key={a} value={a}>{a === 'all' ? 'All actions' : humanizeAction(a)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={studentFilterId} onValueChange={v => { setStudentFilterId(v); setPage(0); }}>
            <SelectTrigger className="h-8 w-48 text-xs">
              <SelectValue placeholder="All students" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All students</SelectItem>
              {studentList.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 w-36 text-xs" placeholder="From" />
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 w-36 text-xs" placeholder="To" />
          <Input placeholder="Search logs..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 w-60 text-xs" />
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading logs...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No logs found.</div>
        ) : (
          <div className="space-y-1">
            {filteredLogs.map(log => (
              <div key={log.id} className="flex items-start gap-3 px-3 py-2 border rounded-md text-xs hover:bg-muted/50 transition-colors">
                <div className="text-muted-foreground whitespace-nowrap">
                  {format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{humanizeAction(log.action)}</span>
                  <span className="text-muted-foreground ml-1">by {log.actor}</span>
                  {log.details?.student_name && (
                    <span className="text-muted-foreground ml-1">— Student: {log.details.student_name}</span>
                  )}
                  {log.details?.slot_date && (
                    <span className="text-muted-foreground ml-1">— Date: {log.details.slot_date}</span>
                  )}
                  {log.details?.start_time && (
                    <span className="text-muted-foreground"> at {String(log.details.start_time).slice(0, 5)}</span>
                  )}
                  {log.details?.old_status && log.details?.new_status && (
                    <span className="text-muted-foreground ml-1">— {log.details.old_status} → {log.details.new_status}</span>
                  )}
                  {log.details?.student_email && (
                    <span className="text-muted-foreground ml-1">({log.details.student_email})</span>
                  )}
                  {log.details?.changes && typeof log.details.changes === 'object' && (
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {Object.entries(log.details.changes).map(([k, v]) => (
                        <span key={k} className="mr-2">{k}: {String(v)}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarLogHistoryPage;
