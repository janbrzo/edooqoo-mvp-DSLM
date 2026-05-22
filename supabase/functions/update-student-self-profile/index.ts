// update-student-self-profile — v5.2
// Lets a student (authenticated via student-hub flow: knows teacher token + their own email)
// upsert "Self-Profile" entries into student_knowledge_entries.
//
// Body:
//   { teacherToken: string, studentEmail: string,
//     fields: { [fieldName: string]: string | string[] | number | null } }
//
// One row per field with category='Self-Profile', entry_source='student_self',
// metadata.field=fieldName. Same field upserts (soft-deletes prior, inserts new).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logError, formatErr } from "../_shared/logError.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ALLOWED_FIELDS = new Set([
  'profession_role',
  'industry_sector',
  'daily_responsibilities',
  'english_use_contexts',
  'learning_obstacles',
  'interests_passions',
  'learning_style_pref',
  'motivation_driver',
  'time_availability_per_week',
  'cultural_context',
]);

function valueToContent(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map((v) => String(v)).join(', ');
  return String(value);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { teacherToken, studentEmail, fields } = body || {};
    if (!teacherToken || !studentEmail || !fields || typeof fields !== 'object') {
      return new Response(JSON.stringify({ error: 'teacherToken, studentEmail and fields required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Resolve teacher_id from public hub token (calendar_settings.hub_token)
    const { data: settings, error: sErr } = await supabase
      .from('calendar_settings')
      .select('teacher_id')
      .eq('hub_token', teacherToken)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!settings) {
      return new Response(JSON.stringify({ error: 'Invalid teacher token' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const teacherId = (settings as any).teacher_id as string;

    // Resolve student by email under this teacher
    const normalizedEmail = String(studentEmail).toLowerCase().trim();
    const { data: student, error: stErr } = await supabase
      .from('students')
      .select('id')
      .eq('teacher_id', teacherId)
      .ilike('student_email', normalizedEmail)
      .is('deleted_at', null)
      .maybeSingle();
    if (stErr) throw stErr;
    if (!student) {
      return new Response(JSON.stringify({ error: 'Student not found for this teacher' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const studentId = (student as any).id as string;

    const updatedFields: string[] = [];
    for (const [field, rawValue] of Object.entries(fields)) {
      if (!ALLOWED_FIELDS.has(field)) continue;
      const content = valueToContent(rawValue).trim();

      // Soft-delete prior entries for this field. We pre-select then update by id
      // because chained .filter('metadata->>field', ...) on JSONB combined with
      // .update() is unreliable across PostgREST versions and was returning 500.
      const { data: prior } = await supabase
        .from('student_knowledge_entries')
        .select('id, metadata')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .eq('category', 'Self-Profile')
        .is('deleted_at', null);
      const priorIds = (prior || [])
        .filter((r: any) => r?.metadata?.field === field)
        .map((r: any) => r.id);
      if (priorIds.length > 0) {
        await supabase
          .from('student_knowledge_entries')
          .update({ deleted_at: new Date().toISOString() } as any)
          .in('id', priorIds);
      }

      if (content.length === 0) continue; // empty value = "clear"

      const { error: insErr } = await supabase
        .from('student_knowledge_entries')
        .insert({
          student_id: studentId,
          teacher_id: teacherId,
          category: 'Self-Profile' as any,
          content,
          tags: ['self_profile'],
          entry_source: 'student_self' as any,
          metadata: { field, raw_value: rawValue, source: 'student_hub' } as any,
        } as any);
      if (insErr) throw insErr;
      updatedFields.push(field);
    }

    return new Response(JSON.stringify({ ok: true, updatedFields }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const f = formatErr(err);
    console.error('update-student-self-profile error', f);
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const sb = createClient(supabaseUrl, serviceKey);
      await logError(sb, {
        source_name: 'update-student-self-profile',
        component: 'auth',
        message: f.message,
        error_code: f.code,
        stack: f.stack,
      });
    } catch (_) { /* swallow */ }
    return new Response(JSON.stringify({ error: f.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
