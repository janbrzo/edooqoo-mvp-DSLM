import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar, Settings, Loader2, CheckCircle2, XCircle, Lock, Unlock } from 'lucide-react';
import { StudentHubLayout } from '@/components/student-hub/StudentHubLayout';
import { getSavedHubEmail } from '@/hooks/useStudentHubData';
import { toast } from 'sonner';

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

const STATUS_COLOR_ITEMS = [
  { key: 'color_booked', label: 'Booked lesson', defaultV: '3' },
  { key: 'color_pending', label: 'Pending booking', defaultV: '5' },
  { key: 'color_completed', label: 'Completed lesson', defaultV: '10' },
  { key: 'color_no_show', label: 'No Show', defaultV: '6' },
];

const DEFAULT_SETTINGS: Record<string, any> = {
  auto_add: true,
  reminder_minutes: 30,
  color_booked: '3',
  color_pending: '5',
  color_completed: '10',
  color_no_show: '6',
  sync_booked: true,
  sync_pending: true,
};

export default function StudentHubSettings() {
  const { teacherToken } = useParams<{ teacherToken: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const email = getSavedHubEmail();
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [settings, setSettings] = useState<Record<string, any>>({ ...DEFAULT_SETTINGS });
  // Password state
  const [hasPassword, setHasPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    const gcal = searchParams.get('gcal');
    if (gcal === 'connected') {
      setConnected(true);
      setSearchParams({});
    } else if (gcal === 'error') {
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!email || !teacherToken) return;
    fetchConnectionStatus();
    fetchPasswordStatus();
  }, [email, teacherToken]);

  const fetchPasswordStatus = async () => {
    try {
      const { data } = await supabase.functions.invoke('get-student-hub-data', {
        body: { token: teacherToken, email, action: 'get_password_status' },
      });
      setHasPassword(!!data?.hasPassword);
    } catch (err) {
      console.error('Error checking password status:', err);
    }
  };

  const handleSetPassword = async () => {
    if (!newPassword || newPassword.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setPasswordLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-student-hub-data', {
        body: { token: teacherToken, email, action: 'set_password', password: newPassword },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success('Password set successfully');
        setHasPassword(true);
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to set password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleRemovePassword = async () => {
    if (!window.confirm('Are you sure you want to remove your Hub password?')) return;
    setPasswordLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-student-hub-data', {
        body: { token: teacherToken, email, action: 'remove_password' },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success('Password removed');
        setHasPassword(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const fetchConnectionStatus = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('get-student-hub-data', {
        body: { token: teacherToken, email, action: 'get_gcal_status' },
      });
      if (data?.gcal_connected) {
        setConnected(true);
        if (data.gcal_settings) {
          setSettings({ ...DEFAULT_SETTINGS, ...data.gcal_settings });
        }
      }
    } catch (err) {
      console.error('Error checking gcal status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('student-gcal-auth-start', {
        body: { email, teacherToken, origin: window.location.origin },
      });
      if (error) throw error;
      if (data?.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (err: any) {
      toast.error('Failed to start Google Calendar connection');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const { error } = await supabase.functions.invoke('get-student-hub-data', {
        body: { token: teacherToken, email, action: 'disconnect_gcal' },
      });
      if (error) throw error;
      setConnected(false);
      toast.success('Google Calendar disconnected');
    } catch (err) {
      toast.error('Failed to disconnect');
    }
  };

  const updateSetting = async (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    try {
      await supabase.functions.invoke('get-student-hub-data', {
        body: { token: teacherToken, email, action: 'update_gcal_settings', gcalSettings: newSettings },
      });
    } catch (err) {
      console.error('Error saving gcal settings:', err);
    }
  };

  const handleSyncAllLessons = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-student-hub-data', {
        body: { token: teacherToken, email, action: 'sync_all_lessons_gcal' },
      });
      if (error) throw error;
      toast.success(`Synced ${data?.count || 0} lessons to your calendar`);
    } catch (err) {
      toast.error('Failed to sync lessons');
    } finally {
      setSyncing(false);
    }
  };

  if (!email) return null;

  const getColorValue = (key: string) => settings[key] || DEFAULT_SETTINGS[key];

  return (
    <StudentHubLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" /> Settings
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your preferences</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" /> Google Calendar Sync
            </CardTitle>
            <CardDescription>
              Connect your Google Calendar to automatically add lessons to your personal calendar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Checking connection...
              </div>
            ) : connected ? (
              <>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-700">Connected to Google Calendar</span>
                </div>

                <div className="space-y-4 pt-2">
                  {/* Auto-add toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-add lessons to calendar</Label>
                      <p className="text-xs text-muted-foreground">Automatically add new lessons when booked</p>
                    </div>
                    <Switch
                      checked={settings.auto_add}
                      onCheckedChange={v => updateSetting('auto_add', v)}
                    />
                  </div>

                  {/* What to sync */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">What to sync to Google Calendar</Label>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Booked lessons</span>
                      <Switch checked={settings.sync_booked !== false} onCheckedChange={v => updateSetting('sync_booked', v)} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Pending bookings</span>
                      <Switch checked={settings.sync_pending !== false} onCheckedChange={v => updateSetting('sync_pending', v)} />
                    </div>
                  </div>

                  {/* Reminder */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Reminder before lesson</Label>
                      <p className="text-xs text-muted-foreground">Get a popup reminder in Google Calendar</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        className="w-20 h-8 text-sm"
                        value={settings.reminder_minutes}
                        onChange={e => updateSetting('reminder_minutes', parseInt(e.target.value) || 30)}
                        min={5}
                        max={1440}
                      />
                      <span className="text-sm text-muted-foreground">min</span>
                    </div>
                  </div>

                  {/* Per-status colors */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Event colors by status</Label>
                    {STATUS_COLOR_ITEMS.map(item => (
                      <div key={item.key} className="flex items-center justify-between">
                        <span className="text-sm">{item.label}</span>
                        <Select value={getColorValue(item.key)} onValueChange={v => updateSetting(item.key, v)}>
                          <SelectTrigger className="w-40 h-8 text-xs">
                            <span className="flex items-center gap-2 truncate">
                              <span className="w-3 h-3 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: GCAL_COLOR_HEX[getColorValue(item.key)] || '#3f51b5' }} />
                              <span className="truncate">{GCAL_COLORS.find(c => c.v === getColorValue(item.key))?.l || 'Color'}</span>
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            {GCAL_COLORS.map(c => (
                              <SelectItem key={c.v} value={c.v}>
                                <span className="flex items-center gap-2">
                                  <span className="w-3 h-3 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: GCAL_COLOR_HEX[c.v] }} />
                                  {c.l}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>

                  {/* Sync all existing */}
                  <div className="pt-2 space-y-2">
                    <Button variant="outline" size="sm" onClick={handleSyncAllLessons} disabled={syncing}>
                      {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Calendar className="h-4 w-4 mr-2" />}
                      Sync all existing lessons to calendar
                    </Button>
                  </div>
                </div>

                <div className="pt-2">
                  <Button variant="outline" size="sm" className="text-destructive" onClick={handleDisconnect}>
                    <XCircle className="h-3.5 w-3.5 mr-1" /> Disconnect Google Calendar
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  When connected, your booked lessons will automatically appear in your Google Calendar with reminders.
                </p>
                <Button onClick={handleConnect} disabled={connecting}>
                  {connecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Calendar className="h-4 w-4 mr-2" />}
                  Connect Google Calendar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hub Password Protection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lock className="h-5 w-5" />
              Hub Password Protection
            </CardTitle>
            <CardDescription>
              Set a password to protect access to your Learning Hub. Anyone with your email will need to enter this password.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasPassword ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Password is set</span>
                </div>
                <Button variant="outline" size="sm" onClick={handleRemovePassword} disabled={passwordLoading}>
                  {passwordLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Unlock className="h-4 w-4 mr-1" />}
                  Remove Password
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">No password set. Your Hub is accessible with just your email.</p>
                <div className="space-y-2">
                  <Label>New Password (min. 4 characters)</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter password"
                    minLength={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Confirm Password</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                  />
                </div>
                <Button onClick={handleSetPassword} disabled={passwordLoading || !newPassword || newPassword.length < 4 || newPassword !== confirmPassword}>
                  {passwordLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Lock className="h-4 w-4 mr-1" />}
                  Set Password
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="bg-muted/50 rounded-md p-4 text-sm text-muted-foreground space-y-2">
              <p className="font-medium">How it works:</p>
              <ul className="list-disc pl-4 space-y-1 text-xs">
                <li>When you connect your Google account, new lessons will be automatically added to your calendar.</li>
                <li>Each lesson gets a reminder notification before it starts.</li>
                <li>If a lesson is cancelled, it will be removed from your calendar.</li>
                <li>Your Google account is only used for calendar events — we don't access any other data.</li>
                <li>Event colors change based on lesson status (booked, pending, completed).</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </StudentHubLayout>
  );
}
