/**
 * Edge Function: track-student-event
 * Pozwala na manualne dodawanie eventów DSLM (np. teacher observations)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TrackEventRequest {
  student_id: string;
  event_type: string;
  event_source: string;
  source_id?: string;
  event_payload?: Record<string, unknown>;
  skill_ids?: string[];
  element_type?: string;
  session_id?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Get auth header to identify the teacher
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's auth
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    });

    // Get user
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const teacherId = user.id;
    const body: TrackEventRequest = await req.json();
    
    console.log('Track student event request:', {
      teacherId,
      studentId: body.student_id,
      eventType: body.event_type,
      eventSource: body.event_source
    });

    // Validate required fields
    if (!body.student_id || !body.event_type || !body.event_source) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: student_id, event_type, event_source' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate event_source
    const validSources = ['homework', 'flashcard', 'test', 'worksheet', 'teacher', 'system'];
    if (!validSources.includes(body.event_source)) {
      return new Response(
        JSON.stringify({ error: `Invalid event_source. Must be one of: ${validSources.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify teacher has access to student
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: student, error: studentError } = await supabaseService
      .from('students')
      .select('id, teacher_id')
      .eq('id', body.student_id)
      .eq('teacher_id', teacherId)
      .maybeSingle();

    if (studentError) {
      console.error('Student lookup error:', studentError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify student access' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!student) {
      return new Response(
        JSON.stringify({ error: 'Student not found or access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert event using database function
    const { data: eventId, error: insertError } = await supabaseService.rpc('add_student_event', {
      p_student_id: body.student_id,
      p_teacher_id: teacherId,
      p_event_type: body.event_type,
      p_event_source: body.event_source,
      p_source_id: body.source_id || null,
      p_event_payload: body.event_payload || {},
      p_skill_ids: body.skill_ids || null,
      p_element_type: body.element_type || null,
      p_session_id: body.session_id || null
    });

    if (insertError) {
      console.error('Insert event error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to insert event', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Event tracked successfully:', eventId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        event_id: eventId,
        message: 'Event tracked successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: (error as Error)?.message ?? String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
