import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find all students with this email
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('teacher_id')
      .ilike('student_email', email.toLowerCase().trim());

    if (studentsError) throw studentsError;
    if (!students || students.length === 0) {
      // P1.6 — diagnostic reason instead of a blind empty list
      return new Response(JSON.stringify({ teachers: [], reason: 'email_not_found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const teacherIds = [...new Set(students.map(s => s.teacher_id))];

    // Get teacher profiles and calendar tokens
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', teacherIds);

    const { data: settings } = await supabase
      .from('calendar_settings')
      .select('teacher_id, hub_token')
      .in('teacher_id', teacherIds);

    const tokenByTeacher = new Map<string, string>();
    for (const s of settings || []) {
      if (s.hub_token) tokenByTeacher.set(s.teacher_id, s.hub_token);
    }

    // P1.6 — auto-provision a hub_token for teachers that don't have one yet,
    // instead of silently hiding them from the student ("No teachers found").
    const provisionFailures: string[] = [];
    for (const teacherId of teacherIds) {
      if (tokenByTeacher.has(teacherId)) continue;
      const newToken = crypto.randomUUID().replace(/-/g, '');
      const hasRow = (settings || []).some(s => s.teacher_id === teacherId);
      const { error: provisionError } = hasRow
        ? await supabase
            .from('calendar_settings')
            .update({ hub_token: newToken })
            .eq('teacher_id', teacherId)
            .is('hub_token', null)
        : await supabase
            .from('calendar_settings')
            .insert({ teacher_id: teacherId, hub_token: newToken });

      if (provisionError) {
        console.error('[find-teachers] hub_token provisioning failed:', teacherId, provisionError.message);
        provisionFailures.push(teacherId);
        continue;
      }
      tokenByTeacher.set(teacherId, newToken);
    }

    const teachers = teacherIds
      .filter(id => tokenByTeacher.has(id))
      .map(id => {
        const profile = profiles?.find(p => p.id === id);
        const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Teacher';
        return { name, token: tokenByTeacher.get(id)! };
      });

    const reason = teachers.length > 0
      ? undefined
      : provisionFailures.length > 0
        ? 'hub_not_enabled'
        : 'email_not_found';

    return new Response(JSON.stringify({ teachers, reason }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error in find-teachers-by-student-email:', err);
    return new Response(JSON.stringify({ error: (err as Error)?.message ?? String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
