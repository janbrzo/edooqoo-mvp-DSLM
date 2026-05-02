import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DraggableDialog, DraggableDialogContent, DraggableDialogHeader, DraggableDialogTitle, DraggableDialogFooter } from '@/components/ui/draggable-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AutoResizeTextarea } from '@/components/ui/AutoResizeTextarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { format, addDays, getDay, isAfter } from 'date-fns';
import { CalendarIcon, User, Plus, Trash2, AlertTriangle, Check, ChevronsUpDown, MapPin, Lock } from 'lucide-react';
import { CalendarSlot, CreateSlotInput } from '@/hooks/useCalendarSlots';
import { CreateRecurrenceInput } from '@/hooks/useCalendarRecurrence';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

const DAYS_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DURATIONS = [30, 45, 60, 90, 120];

interface Student {
  id: string;
  name: string;
}

interface TimeSlotEntry {
  id: string;
  start: string;
  end: string;
}

type SlotType = 'available' | 'lesson' | 'block';
type AvailableMode = 'single' | 'batch';
type LessonMode = 'single' | 'recurring';

interface ConflictInfo {
  date: string;
  time: string;
  hasStudent: boolean;
  studentName?: string;
  type: 'blocked' | 'replaceable';
}

interface UnifiedSlotModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateSingle: (input: CreateSlotInput) => Promise<any>;
  onCreateBatch: (inputs: CreateSlotInput[]) => Promise<any>;
  onCreateRecurring: (input: CreateRecurrenceInput) => Promise<any>;
  onDeleteSlot: (id: string) => Promise<void>;
  students: Student[];
  defaultDuration: number;
  defaultDate?: Date;
  defaultStartTime?: string;
  currentDate: Date;
  existingSlots: CalendarSlot[];
  studentMap: Record<string, string>;
  teacherId?: string;
  onLinkWorksheet?: (studentId: string | null) => void;
}

function computeEndTime(start: string, duration: number): string {
  const [h, m] = start.split(':').map(Number);
  const totalMin = h * 60 + m + duration;
  const eh = Math.floor(totalMin / 60);
  const em = totalMin % 60;
  if (eh >= 24) return '23:59';
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}

function normalizeTime(t: string): string {
  return t.slice(0, 5);
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export function UnifiedSlotModal({
  open, onOpenChange, onCreateSingle, onCreateBatch, onCreateRecurring,
  onDeleteSlot, students, defaultDuration, defaultDate, defaultStartTime,
  currentDate, existingSlots, studentMap, teacherId, onLinkWorksheet,
}: UnifiedSlotModalProps) {
  const [slotType, setSlotType] = useState<SlotType>('available');
  const [availableMode, setAvailableMode] = useState<AvailableMode>('single');
  const [lessonMode, setLessonMode] = useState<LessonMode>('single');

  // Single fields
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [duration, setDuration] = useState(String(defaultDuration));
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState('');
  const [studentId, setStudentId] = useState<string>('none');
  const [studentComboOpen, setStudentComboOpen] = useState(false);

  // Worksheet linking for single lesson
  const [worksheetId, setWorksheetId] = useState<string>('none');
  const [studentWorksheets, setStudentWorksheets] = useState<{ id: string; title: string; created_at: string }[]>([]);

  // Batch fields
  const [selectedDays, setSelectedDays] = useState([true, true, true, true, true, false, false]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [timeSlotEntries, setTimeSlotEntries] = useState<TimeSlotEntry[]>([]);

  // Recurring fields
  const [recurDays, setRecurDays] = useState([true, false, false, false, false, false, false]);
  const [recurFrom, setRecurFrom] = useState('');
  const [recurTo, setRecurTo] = useState('');

  const [discountPercent, setDiscountPercent] = useState('');
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [conflictBlocked, setConflictBlocked] = useState(false);

  // Fetch worksheets when student changes
  useEffect(() => {
    if (studentId === 'none' || !teacherId) {
      setStudentWorksheets([]);
      setWorksheetId('none');
      return;
    }
    const fetchWs = async () => {
      const { data } = await supabase
        .from('worksheets')
        .select('id, title, created_at')
        .eq('teacher_id', teacherId)
        .eq('student_id', studentId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(20);
      setStudentWorksheets((data || []) as any);
    };
    fetchWs();
  }, [studentId, teacherId]);

  // Reset on open
  useEffect(() => {
    if (open) {
      const d = defaultDate || currentDate;
      setDate(format(d, 'yyyy-MM-dd'));
      const st = defaultStartTime || '09:00';
      setStartTime(st);
      const dur = Number(duration);
      setEndTime(computeEndTime(st, dur));
      setNotes('');
      setLocation('');
      setDiscountPercent('');
      setStudentId('none');
      setWorksheetId('none');
      setConflicts([]);
      setConflictBlocked(false);
      setDateFrom(format(d, 'yyyy-MM-dd'));
      setDateTo(format(addDays(d, 27), 'yyyy-MM-dd'));
      setRecurFrom(format(d, 'yyyy-MM-dd'));
      setRecurTo('');
      setTimeSlotEntries([{ id: generateId(), start: st, end: computeEndTime(st, dur) }]);
    }
  }, [open, defaultDate, defaultStartTime]);

  // Reset conflicts when inputs change
  useEffect(() => {
    if (conflicts.length > 0) {
      setConflicts([]);
      setConflictBlocked(false);
    }
  }, [date, startTime, endTime, dateFrom, dateTo, selectedDays, studentId, slotType, recurDays, recurFrom, recurTo]);

  const handleDurationChange = (val: string) => {
    setDuration(val);
    setEndTime(computeEndTime(startTime, Number(val)));
    setTimeSlotEntries(prev => prev.map(e => ({ ...e, end: computeEndTime(e.start, Number(val)) })));
  };

  const handleStartTimeChange = (val: string) => {
    setStartTime(val);
    setEndTime(computeEndTime(val, Number(duration)));
  };

  const addTimeSlotEntry = () => {
    const last = timeSlotEntries[timeSlotEntries.length - 1];
    const newStart = last ? last.end : '09:00';
    setTimeSlotEntries(prev => [...prev, { id: generateId(), start: newStart, end: computeEndTime(newStart, Number(duration)) }]);
  };

  const removeTimeSlotEntry = (id: string) => {
    if (timeSlotEntries.length <= 1) return;
    setTimeSlotEntries(prev => prev.filter(e => e.id !== id));
  };

  const updateTimeSlotEntry = (id: string, field: 'start' | 'end', value: string) => {
    setTimeSlotEntries(prev => prev.map(e => {
      if (e.id !== id) return e;
      if (field === 'start') return { ...e, start: value, end: computeEndTime(value, Number(duration)) };
      return { ...e, [field]: value };
    }));
  };

  const jsDayToOurDay = (jsDay: number) => jsDay === 0 ? 6 : jsDay - 1;

  const batchSlots = useMemo(() => {
    if (slotType !== 'available' || availableMode !== 'batch') return [];
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) return [];
    if (timeSlotEntries.length === 0) return [];
    const slots: CreateSlotInput[] = [];
    let d = from;
    while (!isAfter(d, to)) {
      const ourDay = jsDayToOurDay(getDay(d));
      if (selectedDays[ourDay]) {
        for (const entry of timeSlotEntries) {
          slots.push({ slot_date: format(d, 'yyyy-MM-dd'), start_time: entry.start, end_time: entry.end });
        }
      }
      d = addDays(d, 1);
    }
    return slots;
  }, [slotType, availableMode, dateFrom, dateTo, selectedDays, timeSlotEntries]);

  const recurringSlots = useMemo(() => {
    if (slotType !== 'lesson' || lessonMode !== 'recurring') return [];
    if (!recurFrom || !recurTo || studentId === 'none') return [];
    const from = new Date(recurFrom);
    const to = new Date(recurTo);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || isAfter(from, to)) return [];
    const slots: CreateSlotInput[] = [];
    let d = from;
    while (!isAfter(d, to)) {
      const ourDay = jsDayToOurDay(getDay(d));
      if (recurDays[ourDay]) {
        slots.push({ slot_date: format(d, 'yyyy-MM-dd'), start_time: startTime, end_time: endTime, student_id: studentId });
      }
      d = addDays(d, 1);
    }
    return slots;
  }, [slotType, lessonMode, recurFrom, recurTo, recurDays, startTime, endTime, studentId]);

  const checkConflicts = (newSlots: CreateSlotInput[]): { blocked: boolean; replaceable: CalendarSlot[]; info: ConflictInfo[] } => {
    const info: ConflictInfo[] = [];
    let blocked = false;
    const replaceable: CalendarSlot[] = [];
    const isAddingLesson = slotType === 'lesson';

    for (const ns of newSlots) {
      const nsStart = normalizeTime(ns.start_time);
      const nsEnd = normalizeTime(ns.end_time);
      const overlapping = existingSlots.filter(ex =>
        ex.slot_date === ns.slot_date &&
        ex.status !== 'cancelled' &&
        normalizeTime(ex.start_time) < nsEnd &&
        normalizeTime(ex.end_time) > nsStart
      );
      for (const ov of overlapping) {
        const hasStudent = ov.student_id !== null;
        if (hasStudent) {
          blocked = true;
          info.push({
            date: ov.slot_date, time: `${normalizeTime(ov.start_time)}–${normalizeTime(ov.end_time)}`,
            hasStudent: true, studentName: ov.student_id ? studentMap[ov.student_id] : undefined, type: 'blocked',
          });
        } else {
          replaceable.push(ov);
        }
      }
    }
    return { blocked, replaceable, info };
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      // Block type
      if (slotType === 'block') {
        const result = await onCreateSingle({
          slot_date: date, start_time: startTime, end_time: endTime,
          notes: notes || undefined, status: 'available',
          slot_type: 'block',
        } as any);
        if (!result) { setSaving(false); return; }
        onOpenChange(false);
        return;
      }

      if (slotType === 'available' && availableMode === 'single') {
        const newSlots = [{ slot_date: date, start_time: startTime, end_time: endTime }];
        const { blocked, replaceable, info } = checkConflicts(newSlots);
        if (blocked) { setConflicts(info); setConflictBlocked(true); setSaving(false); return; }
        for (const r of replaceable) await onDeleteSlot(r.id);
        const result = await onCreateSingle({ slot_date: date, start_time: startTime, end_time: endTime, notes: notes || undefined, discount_percent: discountPercent ? Number(discountPercent) : undefined } as any);
        if (!result) { setSaving(false); return; }
      } else if (slotType === 'available' && availableMode === 'batch') {
        if (batchSlots.length === 0) { setSaving(false); return; }
        const { blocked, replaceable, info } = checkConflicts(batchSlots);
        if (blocked) { setConflicts(info); setConflictBlocked(true); setSaving(false); return; }
        for (const r of replaceable) await onDeleteSlot(r.id);
        const result = await onCreateBatch(batchSlots);
        if (!result) { setSaving(false); return; }
      } else if (slotType === 'lesson' && lessonMode === 'single') {
        if (studentId === 'none') { setSaving(false); return; }
        const newSlots = [{ slot_date: date, start_time: startTime, end_time: endTime, student_id: studentId }];
        const { blocked, replaceable, info } = checkConflicts(newSlots);
        if (blocked) { setConflicts(info); setConflictBlocked(true); setSaving(false); return; }
        for (const r of replaceable) await onDeleteSlot(r.id);
        const studentName = students.find(s => s.id === studentId)?.name;
        const result = await onCreateSingle({
          slot_date: date, start_time: startTime, end_time: endTime,
          student_id: studentId, title: studentName ? `${studentName} — English lesson` : undefined,
          notes: notes || undefined, worksheet_id: worksheetId !== 'none' ? worksheetId : undefined,
        });
        if (!result) {
          setConflicts([{ date, time: `${startTime}–${endTime}`, hasStudent: true, type: 'blocked', studentName: 'existing lesson' }]);
          setConflictBlocked(true);
          setSaving(false);
          return;
        }
      } else if (slotType === 'lesson' && lessonMode === 'recurring') {
        if (studentId === 'none' || recurringSlots.length === 0) { setSaving(false); return; }
        const { blocked, replaceable, info } = checkConflicts(recurringSlots);
        if (blocked) { setConflicts(info); setConflictBlocked(true); setSaving(false); return; }
        for (const r of replaceable) await onDeleteSlot(r.id);
        const studentName = students.find(s => s.id === studentId)?.name;
        const slotsWithMeta = recurringSlots.map(s => ({
          ...s, title: studentName ? `${studentName} — English lesson` : undefined,
          notes: notes || undefined, booking_type: 'recurring_instance',
        }));
        const result = await onCreateBatch(slotsWithMeta);
        if (!result) {
          setConflicts([{ date: recurFrom, time: `${startTime}–${endTime}`, hasStudent: true, type: 'blocked', studentName: 'existing lesson' }]);
          setConflictBlocked(true);
          setSaving(false);
          return;
        }
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const isValid = (() => {
    if (slotType === 'lesson' && studentId === 'none') return false;
    if (slotType === 'available' && availableMode === 'batch' && batchSlots.length === 0) return false;
    if (slotType === 'lesson' && lessonMode === 'recurring' && recurringSlots.length === 0) return false;
    return true;
  })();

  const mode = slotType === 'available' ? availableMode : (slotType === 'block' ? 'single' : lessonMode);
  const modalTitle = slotType === 'block' ? 'Add Block' : slotType === 'lesson' ? 'Add Lesson' : (availableMode === 'batch' ? 'Add Slots' : 'Add Slot');
  const selectedStudentName = students.find(s => s.id === studentId)?.name || '';

  return (
    <DraggableDialog open={open} onOpenChange={onOpenChange}>
      <DraggableDialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DraggableDialogHeader>
          <DraggableDialogTitle className="text-lg font-semibold leading-none tracking-tight">{modalTitle}</DraggableDialogTitle>
        </DraggableDialogHeader>

        <div className="space-y-4">
          {/* Top tabs — 3 tabs: Available Slot | Lesson | Block */}
          <Tabs value={slotType} onValueChange={v => { setSlotType(v as SlotType); setConflicts([]); setConflictBlocked(false); }}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="available" className="text-xs">
                <CalendarIcon className="h-3.5 w-3.5 mr-1" /> Available Slot
              </TabsTrigger>
              <TabsTrigger value="lesson" className="text-xs">
                <User className="h-3.5 w-3.5 mr-1" /> Lesson
              </TabsTrigger>
              <TabsTrigger value="block" className="text-xs">
                <Lock className="h-3.5 w-3.5 mr-1" /> Block
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Sub-mode toggle — only for available and lesson */}
          {slotType === 'available' && (
            <div className="flex gap-1 p-0.5 bg-muted rounded-md">
              <button className={`flex-1 text-xs py-1.5 rounded-sm transition-colors ${availableMode === 'single' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setAvailableMode('single')}>Single Slot</button>
              <button className={`flex-1 text-xs py-1.5 rounded-sm transition-colors ${availableMode === 'batch' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setAvailableMode('batch')}>Batch Slots</button>
            </div>
          )}
          {slotType === 'lesson' && (
            <div className="flex gap-1 p-0.5 bg-muted rounded-md">
              <button className={`flex-1 text-xs py-1.5 rounded-sm transition-colors ${lessonMode === 'single' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setLessonMode('single')}>Single Lesson</button>
              <button className={`flex-1 text-xs py-1.5 rounded-sm transition-colors ${lessonMode === 'recurring' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setLessonMode('recurring')}>Recurring Lesson</button>
            </div>
          )}

          {/* Student selector (lesson only) — Combobox with search */}
          {slotType === 'lesson' && (
            <div>
              <Label className="text-xs">Student *</Label>
              <Popover open={studentComboOpen} onOpenChange={setStudentComboOpen} modal={false}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={studentComboOpen} className="w-full h-9 justify-between text-sm font-normal">
                    {studentId !== 'none' ? selectedStudentName : 'Select a student (type to search)...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start" onPointerDownOutside={e => e.preventDefault()}>
                  <Command>
                    <CommandInput placeholder="Search students..." autoFocus />
                    <CommandList>
                      <CommandEmpty>No student found.</CommandEmpty>
                      <CommandGroup>
                        {students.map(s => (
                          <CommandItem
                            key={s.id}
                            value={`${s.name}__${s.id}`}
                            onSelect={() => { setStudentId(s.id); setStudentComboOpen(false); }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", studentId === s.id ? "opacity-100" : "opacity-0")} />
                            {s.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* ─── SINGLE SLOT / SINGLE LESSON / BLOCK ─── */}
          {(mode === 'single') && (
            <>
              <div>
                <Label className="text-xs">Date</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Start</Label>
                  <Input type="time" value={startTime} onChange={e => handleStartTimeChange(e.target.value)} className="h-9" />
                </div>
                <div>
                  <Label className="text-xs">End</Label>
                  <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="h-9" />
                </div>
                <div>
                  <Label className="text-xs">Duration</Label>
                  <Select value={duration} onValueChange={handleDurationChange}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DURATIONS.map(d => (
                        <SelectItem key={d} value={String(d)}>{d} min</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {/* ─── BATCH SLOTS ─── */}
          {slotType === 'available' && availableMode === 'batch' && (
            <>
              <div>
                <Label className="text-xs mb-2 block">Days of the week</Label>
                <div className="flex gap-3 flex-wrap">
                  {DAYS_LABELS.map((day, i) => (
                    <label key={i} className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox checked={selectedDays[i]} onCheckedChange={v => { const next = [...selectedDays]; next[i] = !!v; setSelectedDays(next); }} />
                      <span className="text-xs">{day}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">From</Label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9" /></div>
                <div><Label className="text-xs">To</Label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9" /></div>
              </div>
              <div>
                <Label className="text-xs">Lesson Duration</Label>
                <Select value={duration} onValueChange={handleDurationChange}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{DURATIONS.map(d => (<SelectItem key={d} value={String(d)}>{d} min</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Time slots</Label>
                {timeSlotEntries.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-2">
                    <Input type="time" value={entry.start} onChange={e => updateTimeSlotEntry(entry.id, 'start', e.target.value)} className="h-8 flex-1" />
                    <span className="text-xs text-muted-foreground">–</span>
                    <Input type="time" value={entry.end} onChange={e => updateTimeSlotEntry(entry.id, 'end', e.target.value)} className="h-8 flex-1" />
                    {timeSlotEntries.length > 1 && (
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => removeTimeSlotEntry(entry.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={addTimeSlotEntry}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Time Slot
                </Button>
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-md px-3 py-2 text-sm">
                This will create <span className="font-semibold text-primary">{batchSlots.length}</span> available slots
              </div>
            </>
          )}

          {/* ─── RECURRING LESSON ─── */}
          {slotType === 'lesson' && lessonMode === 'recurring' && (
            <>
              <div>
                <Label className="text-xs mb-2 block">Days of the week</Label>
                <div className="flex gap-3 flex-wrap">
                  {DAYS_LABELS.map((day, i) => (
                    <label key={i} className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox checked={recurDays[i]} onCheckedChange={v => { const next = [...recurDays]; next[i] = !!v; setRecurDays(next); }} />
                      <span className="text-xs">{day}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label className="text-xs">Start</Label><Input type="time" value={startTime} onChange={e => handleStartTimeChange(e.target.value)} className="h-9" /></div>
                <div><Label className="text-xs">End</Label><Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="h-9" /></div>
                <div>
                  <Label className="text-xs">Duration</Label>
                  <Select value={duration} onValueChange={handleDurationChange}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{DURATIONS.map(d => (<SelectItem key={d} value={String(d)}>{d} min</SelectItem>))}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">From</Label><Input type="date" value={recurFrom} onChange={e => setRecurFrom(e.target.value)} className="h-9" /></div>
                <div><Label className="text-xs">To</Label><Input type="date" value={recurTo} onChange={e => setRecurTo(e.target.value)} className="h-9" /></div>
              </div>
              {recurringSlots.length > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-md px-3 py-2 text-sm">
                  This will create <span className="font-semibold text-primary">{recurringSlots.length}</span> lessons
                </div>
              )}
            </>
          )}

          {/* 2B: Worksheet link ONLY for lesson mode single — removed from Available Slot */}
          {slotType === 'lesson' && mode === 'single' && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Worksheet</span>
              <div className="flex items-center gap-1">
                {worksheetId !== 'none' ? (
                  <span className="text-xs font-medium truncate max-w-[200px]">
                    {studentWorksheets.find(w => w.id === worksheetId)?.title || 'Linked'}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">None</span>
                )}
                {studentId !== 'none' && studentWorksheets.length > 0 ? (
                  <Select value={worksheetId} onValueChange={setWorksheetId}>
                    <SelectTrigger className="h-7 w-7 p-0 border-0">
                      <span className="sr-only">Link worksheet</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No worksheet</SelectItem>
                      {studentWorksheets.map(ws => (
                        <SelectItem key={ws.id} value={ws.id}>
                          <span className="truncate">{ws.title || 'Untitled'}</span>
                          <span className="text-xs text-muted-foreground ml-2">{format(new Date(ws.created_at), 'MMM d')}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Button
                    variant="ghost" size="sm" className="h-6 w-6 p-0"
                    disabled={studentId === 'none'}
                    onClick={() => onLinkWorksheet?.(studentId !== 'none' ? studentId : null)}
                  >
                    <CalendarIcon className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Block info */}
          {slotType === 'block' && (
            <div className="bg-muted/50 border border-border rounded-md px-3 py-2 text-xs text-muted-foreground">
              <Lock className="h-3 w-3 inline mr-1" />
              Private block — only visible to you. Prevents adding slots or lessons in this time range.
            </div>
          )}

          {/* Discount — available slot single mode only */}
          {slotType === 'available' && mode === 'single' && (
            <div>
              <Label className="text-xs">Discount % (optional)</Label>
              <Input
                type="number" min="0" max="100" value={discountPercent}
                onChange={e => setDiscountPercent(e.target.value)}
                placeholder="e.g. 10"
                className="h-9 w-32"
              />
            </div>
          )}

          {/* Location + Notes (all modes except batch) */}
          {mode !== 'batch' && (
            <>
              {slotType !== 'block' && (
                <div>
                  <Label className="text-xs">Location (optional)</Label>
                  <div className="relative">
                    <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Room 5, Zoom link..." className="h-9 pl-8" />
                  </div>
                </div>
              )}
              <div>
                <Label className="text-xs">Notes (optional)</Label>
                <AutoResizeTextarea value={notes} onChange={e => setNotes(e.target.value)} placeholder={slotType === 'block' ? 'e.g. Doctor appointment' : 'Visible to student'} rows={1} className="min-h-[36px]" />
              </div>
            </>
          )}

          {/* Conflict warning */}
          {conflicts.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2 text-sm space-y-1">
              <div className="flex items-center gap-1 font-medium text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Conflicts detected — cannot proceed
              </div>
              <p className="text-xs text-muted-foreground">Remove existing lessons first, then add new ones or edit existing ones.</p>
              {conflicts.filter(c => c.type === 'blocked').slice(0, 5).map((c, i) => (
                <div key={i} className="text-xs text-muted-foreground">
                  {c.date} {c.time} — Lesson with {c.studentName || 'student'}
                </div>
              ))}
              {conflicts.filter(c => c.type === 'blocked').length > 5 && <div className="text-xs text-muted-foreground">...and {conflicts.filter(c => c.type === 'blocked').length - 5} more</div>}
            </div>
          )}
        </div>

        <DraggableDialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving || !isValid || conflictBlocked}>
            {saving ? 'Creating...' : slotType === 'block' ? 'Create Block' : slotType === 'available' && availableMode === 'batch' ? `Create ${batchSlots.length} Slots` : slotType === 'lesson' && lessonMode === 'recurring' ? `Create ${recurringSlots.length} Lessons` : slotType === 'lesson' ? 'Create Lesson' : 'Create Slot'}
          </Button>
        </DraggableDialogFooter>
      </DraggableDialogContent>
    </DraggableDialog>
  );
}
