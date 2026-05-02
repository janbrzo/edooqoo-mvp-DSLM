/**
 * StudentHubProfile (v5.2) — "Tell us about yourself"
 * Each of the 10 categories saves to student_knowledge_entries with category='Self-Profile'.
 * Auto-save on blur / on selection change. Single edge function call per field group.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, User } from 'lucide-react';
import { StudentHubLayout } from '@/components/student-hub/StudentHubLayout';
import { getSavedHubEmail } from '@/hooks/useStudentHubData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SELF_PROFILE_FIELDS, type SelfProfileFieldDef } from '@/constants/studentSelfProfile';
import { cn } from '@/lib/utils';

type FieldValue = string | string[] | number | null;

const StudentHubProfile: React.FC = () => {
  const { teacherToken } = useParams<{ teacherToken: string }>();
  const navigate = useNavigate();
  const email = getSavedHubEmail();

  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [savingField, setSavingField] = useState<string | null>(null);
  const [savedField, setSavedField] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!email) {
      navigate('/my');
      return;
    }
    if (!teacherToken) return;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-student-self-profile', {
          body: { teacherToken, studentEmail: email },
        });
        if (error) throw error;
        setValues((data as any)?.fields || {});
      } catch (e: any) {
        console.error('Failed to load self-profile', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [teacherToken, email, navigate]);

  const filledCount = useMemo(() => {
    return SELF_PROFILE_FIELDS.filter((f) => {
      const v = values[f.id];
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === 'number') return true;
      return typeof v === 'string' && v.trim().length > 0;
    }).length;
  }, [values]);

  const persist = async (field: string, value: FieldValue) => {
    if (!teacherToken || !email) return;
    setSavingField(field);
    try {
      const { error } = await supabase.functions.invoke('update-student-self-profile', {
        body: { teacherToken, studentEmail: email, fields: { [field]: value } },
      });
      if (error) throw error;
      setSavedField(field);
      setTimeout(() => setSavedField((s) => (s === field ? null : s)), 2000);
    } catch (e: any) {
      console.error('Save failed', e);
      toast.error(e?.message || 'Could not save — try again');
    } finally {
      setSavingField((s) => (s === field ? null : s));
    }
  };

  const setLocal = (field: string, value: FieldValue) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  if (!email) return null;

  return (
    <StudentHubLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Tell us about yourself
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Your answers help your teacher generate worksheets and lessons that match your real life. Saved automatically.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <Badge variant="secondary" className="text-xs">
                {filledCount}/{SELF_PROFILE_FIELDS.length} categories filled
              </Badge>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${(filledCount / SELF_PROFILE_FIELDS.length) * 100}%` }}
                />
              </div>
            </div>
          </CardHeader>
        </Card>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {SELF_PROFILE_FIELDS.map((f) => (
              <SelfProfileFieldCard
                key={f.id}
                def={f}
                value={values[f.id]}
                onLocalChange={(v) => setLocal(f.id, v)}
                onCommit={(v) => persist(f.id, v)}
                isSaving={savingField === f.id}
                isSaved={savedField === f.id}
              />
            ))}
          </div>
        )}
      </div>
    </StudentHubLayout>
  );
};

interface FieldCardProps {
  def: SelfProfileFieldDef;
  value: FieldValue | undefined;
  onLocalChange: (v: FieldValue) => void;
  onCommit: (v: FieldValue) => void;
  isSaving: boolean;
  isSaved: boolean;
}

const SelfProfileFieldCard: React.FC<FieldCardProps> = ({ def, value, onLocalChange, onCommit, isSaving, isSaved }) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Label className="text-base font-semibold">{def.label}</Label>
            <p className="text-xs text-muted-foreground mt-1">{def.helper}</p>
          </div>
          <div className="shrink-0 h-5 w-5 flex items-center justify-center">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {!isSaving && isSaved && <CheckCircle2 className="h-4 w-4 text-green-600" />}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <FieldRenderer def={def} value={value} onLocalChange={onLocalChange} onCommit={onCommit} />
      </CardContent>
    </Card>
  );
};

const FieldRenderer: React.FC<Omit<FieldCardProps, 'isSaving' | 'isSaved'>> = ({ def, value, onLocalChange, onCommit }) => {
  if (def.type === 'text') {
    const v = (value as string) || '';
    return (
      <Input
        value={v}
        maxLength={def.maxLength}
        onChange={(e) => onLocalChange(e.target.value)}
        onBlur={() => onCommit(v)}
        placeholder={def.helper}
      />
    );
  }
  if (def.type === 'textarea') {
    const v = (value as string) || '';
    return (
      <Textarea
        value={v}
        maxLength={def.maxLength}
        rows={4}
        onChange={(e) => onLocalChange(e.target.value)}
        onBlur={() => onCommit(v)}
        placeholder={def.helper}
      />
    );
  }
  if (def.type === 'single') {
    const v = (value as string) || '';
    return (
      <div className="flex flex-wrap gap-2">
        {def.options?.map((opt) => {
          const active = v === opt.value;
          return (
            <button
              type="button"
              key={opt.value}
              onClick={() => {
                onLocalChange(opt.value);
                onCommit(opt.value);
              }}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm border transition-colors',
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-muted'
              )}
            >
              {opt.label}
            </button>
          );
        })}
        {def.allowFreeText && (
          <Input
            className="max-w-xs"
            placeholder="Or type…"
            value={def.options?.some((o) => o.value === v) ? '' : v}
            onChange={(e) => onLocalChange(e.target.value)}
            onBlur={(e) => onCommit(e.target.value)}
          />
        )}
      </div>
    );
  }
  if (def.type === 'multi') {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    const toggle = (val: string) => {
      const next = arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
      if (def.maxSelect && next.length > def.maxSelect) return;
      onLocalChange(next);
      onCommit(next);
    };
    return (
      <div className="flex flex-wrap gap-2">
        {def.options?.map((opt) => {
          const active = arr.includes(opt.value);
          return (
            <button
              type="button"
              key={opt.value}
              onClick={() => toggle(opt.value)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm border transition-colors',
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-muted'
              )}
            >
              {opt.label}
            </button>
          );
        })}
        {def.maxSelect && (
          <span className="text-xs text-muted-foreground self-center">
            {arr.length}/{def.maxSelect}
          </span>
        )}
      </div>
    );
  }
  if (def.type === 'slider') {
    const num = typeof value === 'number' ? value : def.min ?? 1;
    return (
      <div className="space-y-3">
        <Slider
          min={def.min ?? 0}
          max={def.max ?? 10}
          step={def.step ?? 1}
          value={[num]}
          onValueChange={(arr) => onLocalChange(arr[0])}
          onValueCommit={(arr) => onCommit(arr[0])}
        />
        <p className="text-sm font-medium text-foreground">
          {num} {def.unit || ''}
        </p>
      </div>
    );
  }
  return null;
};

export default StudentHubProfile;
