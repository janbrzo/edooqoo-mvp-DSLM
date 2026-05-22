// get-student-self-profile — v5.2
// Reads the latest Self-Profile entries for a student in the hub flow.
// Body: { teacherToken, studentEmail }
// Output: { fields: { [fieldName]: string }, studentId }
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const { teacherToken, studentEmail } = await req.json();
    if (!teacherToken || !studentEmail) {
      return new Response(JSON.stringify({ error: 'teacherToken and studentEmail required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: settings } = await supabase
      .from('calendar_settings')
      .select('teacher_id')
      .eq('hub_token', teacherToken)
      .maybeSingle();
    if (!settings) {
      return new Response(JSON.stringify({ error: 'Invalid teacher token' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const teacherId = (settings as any).teacher_id;

    const normalizedEmail = String(studentEmail).toLowerCase().trim();
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('teacher_id', teacherId)
      .ilike('student_email', normalizedEmail)
      .is('deleted_at', null)
      .maybeSingle();
    if (!student) {
      return new Response(JSON.stringify({ error: 'Student not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const studentId = (student as any).id;

    const { data: entries } = await supabase
      .from('student_knowledge_entries')
      .select('content, metadata, created_at')
      .eq('student_id', studentId)
      .eq('teacher_id', teacherId)
      .eq('category', 'Self-Profile')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    const fields: Record<string, any> = {};
    for (const e of (entries || []) as any[]) {
      const field = e?.metadata?.field;
      if (!field || fields[field] !== undefined) continue;
      // Prefer raw_value when available (preserves arrays/numbers)
      fields[field] = e?.metadata?.raw_value ?? e.content;
    }

    return new Response(JSON.stringify({ fields, studentId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('get-student-self-profile error', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
