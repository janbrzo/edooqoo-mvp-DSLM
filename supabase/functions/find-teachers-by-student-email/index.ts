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
      return new Response(JSON.stringify({ teachers: [] }), {
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
      .in('teacher_id', teacherIds)
      .not('hub_token', 'is', null);

    const teachers = (settings || [])
      .filter(s => s.hub_token)
      .map(s => {
        const profile = profiles?.find(p => p.id === s.teacher_id);
        const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Teacher';
        return {
          name,
          token: s.hub_token,
        };
      });

    return new Response(JSON.stringify({ teachers }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error in find-teachers-by-student-email:', err);
    return new Response(JSON.stringify({ error: (err as Error)?.message ?? String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
