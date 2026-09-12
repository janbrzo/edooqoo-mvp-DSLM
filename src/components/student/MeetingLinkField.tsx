/**
 * MeetingLinkField — per-student meeting room link editor.
 *
 * Extracted verbatim from `StudentPage.tsx` in phase M2 of the Student
 * Workspace refactor (v6.9.111). Behaviour is unchanged.
 *
 * Data flow:
 * - reads `calendar_settings.auto_create_student_meeting_link` (teacher scope);
 *   combined with `hasGcal` it decides whether the Default/Custom switch shows;
 * - reads `calendar_student_settings.default_meeting_link`,
 *   `generated_meeting_link` and `meeting_link_mode` (student scope);
 * - "Default" mode may generate a permanent Google Meet room through the
 *   `gcal-sync` edge function (`action: 'create_permanent_room'`);
 * - every save propagates the link to future, non-completed rows in
 *   `calendar_slots`.
 */

import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDemoContext } from '@/contexts/DemoContext';
import { Input } from '@/components/ui/input';
import { Video, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export interface MeetingLinkFieldProps {
  studentId: string;
  teacherId: string;
  hasGcal?: boolean;
}

export function MeetingLinkField({ studentId, teacherId, hasGcal }: MeetingLinkFieldProps) {
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

export default MeetingLinkField;
