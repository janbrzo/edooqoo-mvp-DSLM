import React, { useEffect, useState, useRef, useCallback } from 'react';
import { AuthenticatedPageShell } from '@/components/AuthenticatedPageShell';
import { useNavigate } from 'react-router-dom';
import { useAuthFlow } from '@/hooks/useAuthFlow';
import { useTokenSystem } from '@/hooks/useTokenSystem';
import StickyNav from '@/components/landing/StickyNav';
import { useCalendarSettings } from '@/hooks/useCalendarSettings';
import { useCalendarVacations } from '@/hooks/useCalendarVacations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Copy, Trash2, Plus, Download } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useDemoContext } from '@/contexts/DemoContext';

const SECTIONS = [
  { id: 'general', label: 'General' },
  { id: 'booking', label: 'Booking Rules' },
  { id: 'public', label: 'Public Calendar' },
  { id: 'gcal', label: 'Google Calendar' },
  { id: 'google-meet', label: 'Google Meet' },
  { id: 'vacations', label: 'Vacations' },
  { id: 'payments', label: 'Payment Tracking' },
  { id: 'notifications', label: 'In-App Notifications' },
  { id: 'email-notifications', label: 'Email Alerts' },
  { id: 'data-export', label: 'Data Export' },
];

const GCAL_COLORS = [
  { v: '1', l: 'Lavender' }, { v: '2', l: 'Sage' }, { v: '3', l: 'Grape' },
  { v: '4', l: 'Flamingo' }, { v: '5', l: 'Banana' }, { v: '6', l: 'Tangerine' },
  { v: '7', l: 'Peacock' }, { v: '9', l: 'Blueberry' }, { v: '10', l: 'Basil' },
  { v: '11', l: 'Tomato' },
];

const GCAL_COLOR_HEX: Record<string, string> = {
  '1': '#7986cb', '2': '#33b679', '3': '#8e24aa', '4': '#e67c73',
  '5': '#f6bf26', '6': '#f4511e', '7': '#039be5', '9': '#3f51b5',
  '10': '#0b8043', '11': '#d50000',
};

const CalendarSettingsPage = () => {
  const { user, loading: authLoading, isRegisteredUser } = useAuthFlow();
  const { tokenLeft } = useTokenSystem(user?.id);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !isRegisteredUser) navigate('/login');
  }, [authLoading, isRegisteredUser, navigate]);

  const { settings, loading, updateSettings, generatePublicToken } = useCalendarSettings(user?.id);
  const { vacations, addVacation, removeVacation } = useCalendarVacations(user?.id);

  const [vacStart, setVacStart] = useState('');
  const [vacEnd, setVacEnd] = useState('');
  const [vacLabel, setVacLabel] = useState('Vacation');
  const [activeSection, setActiveSection] = useState('general');
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalLoading, setGcalLoading] = useState(false);

  const { isDemoMode } = useDemoContext();

  // Check GCal connection status
  const fetchGcalStatus = useCallback(async () => {
    if (!user?.id || isDemoMode) return;
    const { data } = await supabase.from('calendar_gcal_tokens').select('id').eq('teacher_id', user.id).maybeSingle();
    setGcalConnected(!!data);
  }, [user?.id, isDemoMode]);

  useEffect(() => { fetchGcalStatus(); }, [fetchGcalStatus]);

  // Handle OAuth callback from Google
  useEffect(() => {
    if (isDemoMode) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code && user?.id) {
      setGcalLoading(true);
      supabase.functions.invoke('gcal-auth-callback', {
        body: { code, redirectUri: `${window.location.origin}/calendar/settings`, teacherId: user.id },
      }).then(({ error }) => {
        if (error) {
          toast.error('Failed to connect Google Calendar');
        } else {
          toast.success('Google Calendar connected!');
          fetchGcalStatus();
        }
        window.history.replaceState({}, '', '/calendar/settings');
        setGcalLoading(false);
      });
    }
  }, [user?.id]);

  // IntersectionObserver for active section
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );

    SECTIONS.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, [settings]);

  const scrollToSection = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  if (authLoading || loading || !settings) return null;

  const publicUrl = settings.public_calendar_token
    ? `${window.location.origin}/book/${settings.public_calendar_token}`
    : null;

  const handleAddVacation = async () => {
    if (!vacStart || !vacEnd) return;
    await addVacation(vacStart, vacEnd, vacLabel || 'Vacation');
    setVacStart(''); setVacEnd(''); setVacLabel('Vacation');
  };

  const handleConnectGcal = async () => {
    setGcalLoading(true);
    try {
      const redirectUri = `${window.location.origin}/calendar/settings`;
      const { data, error } = await supabase.functions.invoke('gcal-auth-start', {
        body: { teacherId: user?.id, redirectUri },
      });
      if (error) throw error;
      if (data?.authUrl) window.location.href = data.authUrl;
    } catch (err: any) {
      toast.error('Failed to start Google Calendar connection');
      setGcalLoading(false);
    }
  };

  const handleDisconnectGcal = async () => {
    if (!user?.id) return;
    await supabase.from('calendar_gcal_tokens').delete().eq('teacher_id', user.id);
    await updateSettings({ gcal_integration_enabled: false });
    setGcalConnected(false);
    toast.success('Google Calendar disconnected');
  };

  return (
    <AuthenticatedPageShell>
      <StickyNav 
        isRegisteredUser={!!isRegisteredUser} 
        tokenLeft={tokenLeft} 
        user={user}
      />
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6 sticky top-0 z-10 bg-background py-3 border-b">
          <Button variant="ghost" size="sm" onClick={() => navigate('/calendar')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Calendar
          </Button>
          <h1 className="text-2xl font-bold">Calendar Settings</h1>
        </div>
        {isDemoMode && (
          <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800">
            👁 Demo view — settings are visible but cannot be modified. Sign up free to unlock editing.
          </div>
        )}

        <div className="flex gap-6">
          {/* Sidebar navigation — hidden on mobile */}
          <nav className="hidden lg:block w-48 shrink-0">
            <div className="sticky top-20 space-y-1">
              {SECTIONS.map(s => (
                <button
                  key={s.id}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                    activeSection === s.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  )}
                  onClick={() => scrollToSection(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </nav>

          {/* Content */}
          <div className="flex-1 space-y-6 max-w-2xl">
            {/* General */}
            <Card id="general">
              <CardHeader>
                <CardTitle className="text-lg">General</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Default Lesson Duration (minutes)</Label>
                  <Input type="number" className="w-24" value={settings.default_lesson_duration_minutes} onChange={e => updateSettings({ default_lesson_duration_minutes: Number(e.target.value) })} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Timezone</Label>
                  <Select value={settings.timezone} onValueChange={v => updateSettings({ timezone: v })}>
                    <SelectTrigger className="w-56"><SelectValue placeholder="Select timezone" /></SelectTrigger>
                    <SelectContent>
                      {['Europe/Warsaw','Europe/London','Europe/Berlin','Europe/Paris','Europe/Madrid','Europe/Rome','Europe/Prague','Europe/Bucharest','Europe/Athens','Europe/Istanbul','Europe/Moscow','America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Sao_Paulo','America/Mexico_City','America/Buenos_Aires','Asia/Tokyo','Asia/Shanghai','Asia/Seoul','Asia/Kolkata','Asia/Dubai','Asia/Bangkok','Asia/Singapore','Australia/Sydney','Australia/Melbourne','Pacific/Auckland','Africa/Cairo','Africa/Johannesburg'].map(tz => (
                        <SelectItem key={tz} value={tz}>{tz.replace('_', ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Min. Cancellation Hours</Label>
                  <Input type="number" className="w-24" value={settings.min_cancellation_hours || ''} onChange={e => updateSettings({ min_cancellation_hours: e.target.value ? Number(e.target.value) : null })} />
                </div>
                <div className="flex items-center justify-between">
                  <div><Label>Display Start Hour</Label><p className="text-xs text-muted-foreground">First hour visible on calendar grid</p></div>
                  <Input type="number" className="w-24" min={0} max={23} value={settings.display_start_hour} onChange={e => updateSettings({ display_start_hour: Number(e.target.value) })} />
                </div>
                <div className="flex items-center justify-between">
                  <div><Label>Display End Hour</Label><p className="text-xs text-muted-foreground">Last hour visible on calendar grid</p></div>
                  <Input type="number" className="w-24" min={1} max={24} value={settings.display_end_hour} onChange={e => updateSettings({ display_end_hour: Number(e.target.value) })} />
                </div>
                <div className="flex items-center justify-between">
                  <div><Label>Buffer Between Lessons (minutes)</Label><p className="text-xs text-muted-foreground">Minimum gap between consecutive lessons</p></div>
                  <Input type="number" className="w-24" min={0} value={settings.buffer_minutes} onChange={e => updateSettings({ buffer_minutes: Number(e.target.value) })} />
                </div>
              </CardContent>
            </Card>

            {/* Booking */}
            <Card id="booking">
              <CardHeader><CardTitle className="text-lg">Booking Rules</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Default Booking Mode</Label>
                  <Select value={settings.default_booking_mode} onValueChange={v => updateSettings({ default_booking_mode: v as any })}>
                    <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto_confirm">Auto-confirm</SelectItem>
                      <SelectItem value="requires_confirmation">Requires confirmation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Max slots per student per week</Label>
                  <Input type="number" className="w-24" value={settings.max_slots_per_student_per_week ?? ''} onChange={e => updateSettings({ max_slots_per_student_per_week: e.target.value ? Number(e.target.value) : null })} placeholder="No limit" />
                </div>
                <div className="flex items-center justify-between">
                  <div><Label>Enforce slot limit</Label><p className="text-xs text-muted-foreground">Block vs. warning only</p></div>
                  <Switch checked={settings.enforce_slot_limit} onCheckedChange={v => updateSettings({ enforce_slot_limit: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <div><Label>Allow student rescheduling without your confirmation</Label><p className="text-xs text-muted-foreground">Students can move their lessons to other available slots automatically</p></div>
                  <Switch checked={settings.allow_student_reschedule} onCheckedChange={v => updateSettings({ allow_student_reschedule: v })} />
                </div>
              </CardContent>
            </Card>

            {/* Public Calendar */}
            <Card id="public">
              <CardHeader>
                <CardTitle className="text-lg">Public Calendar</CardTitle>
                <CardDescription>Let students book available slots via a shareable link</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable Public Calendar</Label>
                  <Switch checked={settings.public_calendar_enabled} onCheckedChange={async v => { if (v && !settings.public_calendar_token) { await generatePublicToken(); } else { await updateSettings({ public_calendar_enabled: v }); } }} />
                </div>
                {publicUrl && (
                  <div className="flex items-center gap-2">
                    <Input value={publicUrl} readOnly className="text-xs" />
                    <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success('Link copied!'); }}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {settings.public_calendar_enabled && (
                  <>
                    <div>
                      <Label className="text-xs">Custom booking URL (optional)</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{window.location.origin}/book/</span>
                        <Input
                          value={(settings as any).public_calendar_slug || ''}
                          onChange={e => {
                            const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 50);
                            updateSettings({ public_calendar_slug: val || null } as any);
                          }}
                          placeholder="john-smith"
                          className="h-8 text-sm max-w-48"
                        />
                      </div>
                      {(settings as any).public_calendar_slug && (
                        <div className="flex items-center gap-2 mt-1">
                          <Input value={`${window.location.origin}/book/${(settings as any).public_calendar_slug}`} readOnly className="text-xs" />
                          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/book/${(settings as any).public_calendar_slug}`); toast.success('Custom link copied!'); }}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">Lowercase letters, numbers, and hyphens only (3-50 characters)</p>
                    </div>
                    <div className="bg-muted/50 rounded-md p-3 text-xs text-muted-foreground">
                      💡 Share the booking link above with students, or direct them to <strong>{window.location.origin}/my</strong> — they can enter their email to access their Student Hub (lessons, flashcards, homework).
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Google Calendar */}
            <Card id="gcal">
              <CardHeader>
                <CardTitle className="text-lg">Google Calendar</CardTitle>
                <CardDescription>Sync lessons to your Google Calendar automatically</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {gcalConnected ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700">✓ Connected</Badge>
                      <Button variant="outline" size="sm" className="text-xs h-7" onClick={handleDisconnectGcal}>Disconnect</Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div><Label>Auto-sync confirmed lessons</Label><p className="text-xs text-muted-foreground">Automatically create Google Calendar events for confirmed lessons</p></div>
                      <Switch checked={settings.gcal_integration_enabled} onCheckedChange={v => updateSettings({ gcal_integration_enabled: v })} />
                    </div>
                    {/* Per-status colors with visual dots */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Event colors by status</Label>
                      {[
                        { key: 'gcal_color_booked', label: 'Booked lesson', def: '9' },
                        { key: 'gcal_color_available', label: 'Available slot', def: '2' },
                        { key: 'gcal_color_pending', label: 'Pending booking', def: '5' },
                        { key: 'gcal_color_completed', label: 'Completed lesson', def: '10' },
                        { key: 'gcal_color_no_show', label: 'No Show', def: '6' },
                      ].map(item => {
                        const currentVal = (settings as any)[item.key] || item.def;
                        return (
                          <div key={item.key} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-3.5 h-3.5 rounded-full inline-block border border-border" style={{ backgroundColor: GCAL_COLOR_HEX[currentVal] || '#ccc' }} />
                              <Label className="text-sm">{item.label}</Label>
                            </div>
                            <Select value={currentVal} onValueChange={v => updateSettings({ [item.key]: v } as any)}>
                              <SelectTrigger className="w-56">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-3 h-3 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: GCAL_COLOR_HEX[currentVal] || '#ccc' }} />
                                  <span className="truncate">{GCAL_COLORS.find(c => c.v === currentVal)?.l || 'Select color'}</span>
                                </div>
                              </SelectTrigger>
                              <SelectContent className="min-w-[220px]">
                                {GCAL_COLORS.map(c => (
                                  <SelectItem key={c.v} value={c.v}>
                                    <span className="flex items-center gap-2">
                                      <span className="w-3 h-3 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: GCAL_COLOR_HEX[c.v] || '#ccc' }} />
                                      {c.l}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}
                    </div>
                    {/* Reminder toggle */}
                    <div className="flex items-center justify-between">
                      <div><Label>Reminder before lesson</Label><p className="text-xs text-muted-foreground">Get notified before each lesson in Google Calendar</p></div>
                      <Switch checked={settings.gcal_default_reminder_minutes !== null && settings.gcal_default_reminder_minutes !== undefined}
                        onCheckedChange={v => updateSettings({ gcal_default_reminder_minutes: v ? 30 : null })} />
                    </div>
                    {settings.gcal_default_reminder_minutes !== null && settings.gcal_default_reminder_minutes !== undefined && (
                      <div className="flex items-center justify-between">
                        <Label>Minutes before</Label>
                        <Input type="number" className="w-24" value={settings.gcal_default_reminder_minutes} onChange={e => updateSettings({ gcal_default_reminder_minutes: Number(e.target.value) })} />
                      </div>
                    )}
                    {/* Sync toggles */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">What to sync to Google Calendar</Label>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div><Label className="text-sm">Booked lessons</Label><p className="text-xs text-muted-foreground">Confirmed lessons with students</p></div>
                          <Switch checked={(settings as any).gcal_sync_booked !== false} onCheckedChange={v => updateSettings({ gcal_sync_booked: v } as any)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <div><Label className="text-sm">Pending bookings</Label><p className="text-xs text-muted-foreground">Student requests awaiting your confirmation</p></div>
                          <Switch checked={(settings as any).gcal_sync_pending !== false} onCheckedChange={v => updateSettings({ gcal_sync_pending: v } as any)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <div><Label className="text-sm">Available slots (when you create them)</Label><p className="text-xs text-muted-foreground">Show empty available slots in your Google Calendar</p></div>
                          <Switch checked={(settings as any).gcal_sync_available_new === true} onCheckedChange={v => updateSettings({ gcal_sync_available_new: v } as any)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <div><Label className="text-sm">Available slots (after cancellation)</Label><p className="text-xs text-muted-foreground">When a booked lesson is cancelled and becomes available again</p></div>
                          <Switch checked={(settings as any).gcal_sync_available_on_cancel !== false} onCheckedChange={v => updateSettings({ gcal_sync_available_on_cancel: v } as any)} />
                        </div>
                      </div>
                    </div>
                    {/* On cancellation */}
                    <div className="flex items-center justify-between">
                      <div><Label>On cancellation</Label><p className="text-xs text-muted-foreground">What happens to the GCal event when a lesson is cancelled</p></div>
                      <Select value={(settings as any).gcal_on_cancel_action || 'update'} onValueChange={v => updateSettings({ gcal_on_cancel_action: v } as any)}>
                        <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="update">Update to Available Slot</SelectItem>
                          <SelectItem value="delete">Delete event</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : (
                  <Button onClick={handleConnectGcal} disabled={gcalLoading} variant="outline">
                    {gcalLoading ? 'Connecting...' : '🗓️ Connect Google Calendar'}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Google Meet */}
            <Card id="google-meet">
              <CardHeader>
                <CardTitle className="text-lg">Meeting Links</CardTitle>
                <CardDescription>Video meeting links for online lessons</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-b pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-create permanent student meeting links</Label>
                      <p className="text-xs text-muted-foreground">Automatically generate one permanent meeting link per student. All lessons for that student will use the same room.</p>
                    </div>
                    <Switch 
                      checked={(settings as any).auto_create_student_meeting_link || false}
                      disabled={!gcalConnected}
                      onCheckedChange={async (v) => {
                        await updateSettings({ auto_create_student_meeting_link: v } as any);
                        if (v && user?.id && gcalConnected) {
                          // Batch-generate real Google Meet rooms for existing students without one
                          try {
                            const { data: students } = await supabase.from('students').select('id').eq('teacher_id', user.id).is('deleted_at', null);
                            if (students) {
                              let generated = 0;
                              for (const s of students) {
                                const { data: existing } = await supabase.from('calendar_student_settings')
                                  .select('id, generated_meeting_link, meeting_link_mode').eq('student_id', s.id).eq('teacher_id', user.id).maybeSingle();
                                // Skip if already has a generated link or is in custom mode
                                if ((existing as any)?.generated_meeting_link) continue;
                                if ((existing as any)?.meeting_link_mode === 'custom' && (existing as any)?.default_meeting_link) continue;
                                // Call edge function to create real Google Meet room
                                const { data: result } = await supabase.functions.invoke('gcal-sync', {
                                  body: { teacherId: user.id, studentId: s.id, action: 'create_permanent_room', slotId: s.id },
                                });
                                if (result?.meetLink) {
                                  generated++;
                                  // Propagate to future slots
                                  const today = new Date().toISOString().split('T')[0];
                                  await supabase.from('calendar_slots').update({ meeting_link: result.meetLink } as any)
                                    .eq('teacher_id', user.id).eq('student_id', s.id).gte('slot_date', today)
                                    .not('status', 'in', '("completed","deleted")');
                                }
                              }
                              toast.success(`Google Meet rooms created for ${generated} students`);
                            }
                          } catch (err) { console.error('Batch link generation error:', err); }
                        }
                      }}
                    />
                    {!gcalConnected && (
                      <p className="text-xs text-amber-600 mt-1">Requires Google Calendar connection</p>
                    )}
                  </div>
                </div>
                <div className="bg-muted/50 rounded-md p-3 text-xs text-muted-foreground space-y-2">
                  <p><strong>How it works:</strong></p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li><strong>Permanent Student Link (recommended):</strong> Each student gets one permanent meeting room. All lessons use the same link — simple for students.</li>
                    <li>You can manually override any student's link in their profile page.</li>
                    <li>Students see a "Join Lesson" button in their Hub.</li>
                  </ul>
                </div>
                {gcalConnected && (
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Legacy: Auto-create per-lesson Meet links</Label>
                        <p className="text-xs text-muted-foreground">Creates a different Google Meet link for every lesson. Not recommended if permanent student links are enabled.</p>
                      </div>
                      <Switch 
                        checked={(settings as any).auto_create_meet_link || false} 
                        onCheckedChange={v => updateSettings({ auto_create_meet_link: v } as any)}
                        disabled={!!(settings as any).auto_create_student_meeting_link}
                      />
                      {(settings as any).auto_create_student_meeting_link && (
                        <p className="text-xs text-amber-600 mt-1">Disabled — permanent student links are active.</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Vacations */}
            <Card id="vacations">
              <CardHeader>
                <CardTitle className="text-lg">Vacations</CardTitle>
                <CardDescription>Mark days when you're unavailable. Students will see this on your booking page.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 flex-wrap items-end">
                  <div><Label className="text-xs">Start</Label><Input type="date" value={vacStart} onChange={e => setVacStart(e.target.value)} className="h-9 w-40" /></div>
                  <div><Label className="text-xs">End</Label><Input type="date" value={vacEnd} onChange={e => setVacEnd(e.target.value)} className="h-9 w-40" /></div>
                  <div><Label className="text-xs">Label</Label><Input value={vacLabel} onChange={e => setVacLabel(e.target.value)} className="h-9 w-40" placeholder="Vacation" /></div>
                  <Button size="sm" className="h-9" onClick={handleAddVacation} disabled={!vacStart || !vacEnd}><Plus className="h-3.5 w-3.5 mr-1" /> Add</Button>
                </div>
                {vacations.length > 0 && (
                  <div className="space-y-2">
                    {vacations.map(v => (
                      <div key={v.id} className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
                        <div>
                          <span className="font-medium">{v.label}</span>
                          <span className="text-muted-foreground ml-2">{format(new Date(v.start_date), 'MMM d')} – {format(new Date(v.end_date), 'MMM d, yyyy')}</span>
                        </div>
                        <Button variant="ghost" size="sm" className="text-destructive h-7" onClick={() => removeVacation(v.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment Tracking */}
            <Card id="payments">
              <CardHeader><CardTitle className="text-lg">Payment Tracking</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-muted-foreground">Enable Payment Tracking</Label>
                    <p className="text-xs text-muted-foreground">Payment tracking is currently in development and will be available soon.</p>
                  </div>
                  <Switch checked={settings.payment_tracking_enabled} disabled className="opacity-50" />
                </div>
                {settings.payment_tracking_enabled && (
                  <>
                    <div className="flex items-center justify-between">
                      <Label>Default Lesson Price</Label>
                      <Input type="number" className="w-24" value={settings.default_lesson_price ?? ''} onChange={e => updateSettings({ default_lesson_price: e.target.value ? Number(e.target.value) : null })} placeholder="0" />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Currency</Label>
                      <Select value={settings.currency || 'USD'} onValueChange={v => updateSettings({ currency: v })}>
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['USD','EUR','PLN','GBP','CHF','CZK','SEK','NOK','DKK','HUF','RON','BGN','HRK','TRY','BRL','MXN','ARS','JPY','KRW','CNY','INR','AED','THB','SGD','AUD','NZD','ZAR','EGP'].map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Data Export */}
            <Card id="data-export">
              <CardHeader>
                <CardTitle className="text-lg">Data Export</CardTitle>
                <CardDescription>Export your calendar data as a CSV file for Excel or Google Sheets</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Export includes all lessons within the currently selected date range in the calendar view. The CSV file contains lesson dates, times, student names, status, payment info, and more.
                </p>
                <Button variant="outline" size="sm" onClick={async () => {
                  const now = new Date();
                  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
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
                }}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Export Current Month (CSV)
                </Button>
              </CardContent>
            </Card>

            {/* Notifications */}
            <Card id="notifications">
              <CardHeader>
                <CardTitle className="text-lg">In-App Notifications</CardTitle>
                <CardDescription>Bell icon notifications that appear in the calendar toolbar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between"><Label>Notify on new booking</Label><Switch checked={settings.notify_on_booking} onCheckedChange={v => updateSettings({ notify_on_booking: v })} /></div>
                <div className="flex items-center justify-between"><Label>Notify on cancellation</Label><Switch checked={settings.notify_on_cancellation} onCheckedChange={v => updateSettings({ notify_on_cancellation: v })} /></div>
                <div className="flex items-center justify-between">
                  <Label>Student reminder (hours before)</Label>
                  <Input type="number" className="w-24" value={settings.notify_student_reminder_hours ?? ''} onChange={e => updateSettings({ notify_student_reminder_hours: e.target.value ? Number(e.target.value) : null })} placeholder="None" />
                </div>
              </CardContent>
            </Card>

            {/* Email Notifications */}
            <Card id="email-notifications">
              <CardHeader>
                <CardTitle className="text-lg">Your Email Notifications</CardTitle>
                <CardDescription>Emails sent to <strong>you</strong> when calendar events happen.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div><Label>Email on new booking</Label><p className="text-xs text-muted-foreground">Receive email when a student books a lesson</p></div>
                  <Switch checked={settings.notify_email_on_booking} onCheckedChange={v => updateSettings({ notify_email_on_booking: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <div><Label>Email on cancellation</Label><p className="text-xs text-muted-foreground">Receive email when a lesson is cancelled</p></div>
                  <Switch checked={settings.notify_email_on_cancellation} onCheckedChange={v => updateSettings({ notify_email_on_cancellation: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <div><Label>Email on reschedule request</Label><p className="text-xs text-muted-foreground">Receive email when a student requests to reschedule</p></div>
                  <Switch checked={settings.notify_email_on_reschedule} onCheckedChange={v => updateSettings({ notify_email_on_reschedule: v })} />
                </div>
              </CardContent>
            </Card>

            {/* Student Email Defaults */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Student Email Defaults</CardTitle>
                <CardDescription>Default email notification settings for all students. You can override these per student in each student's profile.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div><Label>Email on confirmation</Label><p className="text-xs text-muted-foreground">Send email to student when you confirm a booking</p></div>
                  <Switch checked={settings.notify_email_on_confirmation} onCheckedChange={v => updateSettings({ notify_email_on_confirmation: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <div><Label>Email on rejection</Label><p className="text-xs text-muted-foreground">Send email to student when you reject a booking</p></div>
                  <Switch checked={settings.notify_email_on_rejection} onCheckedChange={v => updateSettings({ notify_email_on_rejection: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <div><Label>Email on new lesson created</Label><p className="text-xs text-muted-foreground">Send email to student when you create a new lesson for them</p></div>
                  <Switch checked={settings.notify_email_on_lesson_created} onCheckedChange={v => updateSettings({ notify_email_on_lesson_created: v })} />
                </div>
                <div className="bg-muted/50 rounded-md p-3 text-xs text-muted-foreground">
                  💡 By default, all students receive email notifications for confirmations, rejections, and new lessons. Per-student email preferences will be available in a future update.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AuthenticatedPageShell>
  );
};

export default CalendarSettingsPage;
