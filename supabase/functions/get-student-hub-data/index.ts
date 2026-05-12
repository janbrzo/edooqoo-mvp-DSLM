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
    const { token, email, action, gcalSettings, password } = await req.json();
    if (!token || !email) {
      return new Response(JSON.stringify({ error: 'Token and email are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const normalizedEmail = email.toLowerCase().trim();

    // 1. Resolve token → teacher_id (try hub_token first, fallback to public_calendar_token)
    let settingsData;
    const { data: byHub } = await supabase
      .from('calendar_settings')
      .select('teacher_id, default_meeting_link, public_calendar_token')
      .eq('hub_token', token)
      .maybeSingle();

    if (byHub) {
      settingsData = byHub;
    } else {
      // Backward compatibility: try public_calendar_token
      const { data: byCalendar } = await supabase
        .from('calendar_settings')
        .select('teacher_id, default_meeting_link, public_calendar_token')
        .eq('public_calendar_token', token)
        .eq('public_calendar_enabled', true)
        .maybeSingle();
      settingsData = byCalendar;
    }

    if (!settingsData) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const teacherId = settingsData.teacher_id;
    const normalEmail = normalizedEmail;

    // Handle password actions
    if (action === 'check_password_required') {
      const { data: studentPw } = await supabase
        .from('students')
        .select('hub_password_hash')
        .eq('teacher_id', teacherId)
        .ilike('student_email', normalEmail)
        .is('deleted_at', null)
        .maybeSingle();
      return new Response(JSON.stringify({
        requiresPassword: !!studentPw?.hub_password_hash,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'verify_password') {
      const { data: studentPw } = await supabase
        .from('students')
        .select('id, hub_password_hash')
        .eq('teacher_id', teacherId)
        .ilike('student_email', normalEmail)
        .is('deleted_at', null)
        .maybeSingle();
      if (!studentPw?.hub_password_hash) {
        return new Response(JSON.stringify({ verified: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // Use Web Crypto for PBKDF2 verification
      const encoder = new TextEncoder();
      const storedParts = studentPw.hub_password_hash.split(':');
      if (storedParts.length !== 3) {
        return new Response(JSON.stringify({ verified: false, error: 'Invalid hash format' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const [, saltHex, hashHex] = storedParts;
      const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((b: string) => parseInt(b, 16)));
      const key = await crypto.subtle.importKey('raw', encoder.encode(password || ''), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
      const computedHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
      return new Response(JSON.stringify({ verified: computedHex === hashHex }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'set_password') {
      if (!password || password.length < 4) {
        return new Response(JSON.stringify({ error: 'Password must be at least 4 characters' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: studentPw } = await supabase
        .from('students')
        .select('id')
        .eq('teacher_id', teacherId)
        .ilike('student_email', normalEmail)
        .is('deleted_at', null)
        .maybeSingle();
      if (!studentPw) {
        return new Response(JSON.stringify({ error: 'Student not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const encoder = new TextEncoder();
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
      const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
      const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
      const stored = `pbkdf2:${saltHex}:${hashHex}`;
      await supabase.from('students').update({ hub_password_hash: stored }).eq('id', studentPw.id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'remove_password') {
      const { data: studentPw } = await supabase
        .from('students')
        .select('id')
        .eq('teacher_id', teacherId)
        .ilike('student_email', normalEmail)
        .is('deleted_at', null)
        .maybeSingle();
      if (studentPw) {
        await supabase.from('students').update({ hub_password_hash: null }).eq('id', studentPw.id);
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_password_status') {
      const { data: studentPw } = await supabase
        .from('students')
        .select('hub_password_hash')
        .eq('teacher_id', teacherId)
        .ilike('student_email', normalEmail)
        .is('deleted_at', null)
        .maybeSingle();
      return new Response(JSON.stringify({ hasPassword: !!studentPw?.hub_password_hash }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle GCal-related actions
    if (action === 'get_gcal_status') {
      const { data: gcalToken } = await supabase.from('student_gcal_tokens')
        .select('settings')
        .eq('student_email', normalEmail)
        .eq('teacher_id', teacherId)
        .maybeSingle();
      return new Response(JSON.stringify({
        gcal_connected: !!gcalToken,
        gcal_settings: gcalToken?.settings || null,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'disconnect_gcal') {
      await supabase.from('student_gcal_tokens')
        .delete()
        .eq('student_email', normalEmail)
        .eq('teacher_id', teacherId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'update_gcal_settings' && gcalSettings) {
      await supabase.from('student_gcal_tokens')
        .update({ settings: gcalSettings, updated_at: new Date().toISOString() })
        .eq('student_email', normalEmail)
        .eq('teacher_id', teacherId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle sync_all_lessons_gcal
    if (action === 'sync_all_lessons_gcal') {
      // Find student by email
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('teacher_id', teacherId)
        .ilike('student_email', normalEmail)
        .is('deleted_at', null)
        .maybeSingle();
      
      if (!student) {
        return new Response(JSON.stringify({ count: 0, reason: 'student not found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get all booked/completed slots for this student
      const { data: studentSlots } = await supabase
        .from('calendar_slots')
        .select('id')
        .eq('student_id', student.id)
        .eq('teacher_id', teacherId)
        .in('status', ['booked', 'completed', 'no_show']);

      if (!studentSlots || studentSlots.length === 0) {
        return new Response(JSON.stringify({ count: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Call student-gcal-sync for each
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      let syncedCount = 0;
      for (const s of studentSlots) {
        try {
          const res = await fetch(`${supabaseUrl}/functions/v1/student-gcal-sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({ email: normalEmail, teacherId, slotId: s.id, action: 'upsert' }),
          });
          const result = await res.json();
          if (result.success) syncedCount++;
        } catch (e) {
          console.error('Sync error for slot', s.id, e);
        }
      }

      return new Response(JSON.stringify({ count: syncedCount }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('id, name, english_level, student_email')
      .eq('teacher_id', teacherId)
      .ilike('student_email', normalizedEmail)
      .is('deleted_at', null)
      .single();

    if (studentError || !studentData) {
      return new Response(JSON.stringify({ error: 'Student not found for this teacher' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const studentId = studentData.id;

    // 3. Get teacher name
    const { data: teacherProfile } = await supabase
      .from('profiles')
      .select('first_name, last_name, email')
      .eq('id', teacherId)
      .single();

    const teacherName = [teacherProfile?.first_name, teacherProfile?.last_name].filter(Boolean).join(' ') || 'Teacher';

    // 4. Flashcard sets (no share_token filter — Hub shows ALL student's sets)
    const { data: flashcardSets } = await supabase
      .from('flashcard_sets')
      .select('id, title, description, share_token, is_bidirectional, back_type, created_at, updated_at')
      .eq('student_id', studentId)
      .eq('teacher_id', teacherId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    // Auto-generate share_token for sets that don't have one (needed for study links)
    for (const set of flashcardSets || []) {
      if (!set.share_token) {
        const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
        await supabase.from('flashcard_sets').update({ share_token: token }).eq('id', set.id);
        set.share_token = token;
      }
    }

    // Count cards per set
    const setIds = (flashcardSets || []).map(s => s.id);
    let cardsCountMap: Record<string, number> = {};
    let masteredCountMap: Record<string, number> = {};

    if (setIds.length > 0) {
      const { data: cards } = await supabase
        .from('flashcard_cards')
        .select('id, set_id')
        .in('set_id', setIds)
        .is('deleted_at', null);

      (cards || []).forEach(c => {
        cardsCountMap[c.set_id] = (cardsCountMap[c.set_id] || 0) + 1;
      });

      const { data: progress } = await supabase
        .from('flashcard_progress')
        .select('set_id, card_id, repetition')
        .eq('learner_identifier', normalizedEmail)
        .in('set_id', setIds)
        .gte('repetition', 4);

      (progress || []).forEach(p => {
        masteredCountMap[p.set_id] = (masteredCountMap[p.set_id] || 0) + 1;
      });
    }

    const enrichedFlashcardSets = (flashcardSets || []).map(s => ({
      ...s,
      cards_count: cardsCountMap[s.id] || 0,
      mastered_count: masteredCountMap[s.id] || 0,
    }));

    // 5. Homework assignments
    const { data: homeworks } = await supabase
      .from('homework_assignments')
      .select('id, title, share_token, deadline, created_at, completed_at, reviewed_at, source_worksheet_id, selected_exercises')
      .eq('student_id', studentId)
      .eq('teacher_id', teacherId)
      .not('share_token', 'is', null)
      .order('created_at', { ascending: false });

    // Get homework progress
    const homeworkIds = (homeworks || []).map(h => h.id);
    let homeworkProgressMap: Record<string, { total: number; completed: number }> = {};

    if (homeworkIds.length > 0) {
      const { data: answers } = await supabase
        .from('homework_student_answers')
        .select('homework_id, is_submitted')
        .ilike('student_email', normalizedEmail)
        .in('homework_id', homeworkIds);

      (answers || []).forEach(a => {
        if (!homeworkProgressMap[a.homework_id]) {
          homeworkProgressMap[a.homework_id] = { total: 0, completed: 0 };
        }
        homeworkProgressMap[a.homework_id].total++;
        if (a.is_submitted) homeworkProgressMap[a.homework_id].completed++;
      });
    }

    // Get source worksheet titles
    const worksheetIds = [...new Set((homeworks || []).filter(h => h.source_worksheet_id).map(h => h.source_worksheet_id!))];
    let worksheetTitleMap: Record<string, string> = {};
    if (worksheetIds.length > 0) {
      const { data: worksheets } = await supabase
        .from('worksheets')
        .select('id, title')
        .in('id', worksheetIds);
      (worksheets || []).forEach(w => { worksheetTitleMap[w.id] = w.title || 'Untitled'; });
    }

    const enrichedHomeworks = (homeworks || []).map(h => {
      const exercises = Array.isArray(h.selected_exercises) ? h.selected_exercises : [];
      const progress = homeworkProgressMap[h.id];
      return {
        id: h.id,
        title: h.title,
        share_token: h.share_token,
        deadline: h.deadline,
        created_at: h.created_at,
        completed_at: h.completed_at,
        reviewed_at: h.reviewed_at,
        source_worksheet_title: h.source_worksheet_id ? worksheetTitleMap[h.source_worksheet_id] : null,
        exercises_count: exercises.length,
        completed_exercises_count: progress?.completed || 0,
      };
    });

    // 6. Shared worksheets — by student_id OR share_recipient_email
    const { data: sharedByStudentId } = await supabase
      .from('worksheets')
      .select('id, title, share_token, created_at, form_data, ai_response')
      .eq('student_id', studentId)
      .eq('teacher_id', teacherId)
      .not('share_token', 'is', null)
      .order('created_at', { ascending: false });

    const { data: sharedByEmail } = await supabase
      .from('worksheets')
      .select('id, title, share_token, created_at, form_data, ai_response')
      .eq('teacher_id', teacherId)
      .ilike('share_recipient_email', normalEmail)
      .not('share_token', 'is', null)
      .is('student_id', null)
      .order('created_at', { ascending: false });

    // Merge and deduplicate
    const seenWsIds = new Set<string>();
    const sharedWorksheets = [...(sharedByStudentId || []), ...(sharedByEmail || [])].filter(w => {
      if (seenWsIds.has(w.id)) return false;
      seenWsIds.add(w.id);
      return true;
    });

    // Check linked slots for worksheets
    const wsIds = (sharedWorksheets || []).map(w => w.id);
    let linkedSlotMap: Record<string, string> = {};
    if (wsIds.length > 0) {
      const { data: linkedSlots } = await supabase
        .from('calendar_slots')
        .select('worksheet_id, slot_date')
        .in('worksheet_id', wsIds);
      (linkedSlots || []).forEach(s => {
        if (s.worksheet_id) linkedSlotMap[s.worksheet_id] = s.slot_date;
      });
    }

    const enrichedWorksheets = (sharedWorksheets || []).map(w => {
      let formData: any = null;
      let aiResponse: any = null;
      try { formData = typeof w.form_data === 'string' ? JSON.parse(w.form_data) : w.form_data; } catch {}
      try { aiResponse = typeof w.ai_response === 'string' ? JSON.parse(w.ai_response) : w.ai_response; } catch {}
      const exercises = aiResponse?.exercises || [];
      return {
        id: w.id,
        title: w.title || 'Untitled',
        share_token: w.share_token,
        created_at: w.created_at,
        english_level: formData?.englishLevel || null,
        exercises_count: exercises.length,
        linked_slot_date: linkedSlotMap[w.id] || null,
      };
    });

    // 7. Upcoming lessons
    const today = new Date().toISOString().split('T')[0];
    const { data: upcomingLessons } = await supabase
      .from('calendar_slots')
      .select('id, slot_date, start_time, end_time, status, title, notes, meeting_link, confirmed_at, worksheet_id')
      .eq('student_id', studentId)
      .eq('teacher_id', teacherId)
      .gte('slot_date', today)
      .in('status', ['booked', 'available'])
      .order('slot_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(10);

    // Get worksheet share tokens for lessons
    const lessonWsIds = [...new Set((upcomingLessons || []).filter(l => l.worksheet_id).map(l => l.worksheet_id!))];
    let lessonWsTokenMap: Record<string, string> = {};
    if (lessonWsIds.length > 0) {
      const { data: lessonWs } = await supabase
        .from('worksheets')
        .select('id, share_token')
        .in('id', lessonWsIds);
      (lessonWs || []).forEach(w => { if (w.share_token) lessonWsTokenMap[w.id] = w.share_token; });
    }

    const enrichedLessons = (upcomingLessons || []).map(l => ({
      ...l,
      worksheet_share_token: l.worksheet_id ? lessonWsTokenMap[l.worksheet_id] || null : null,
    }));

    // 8. Past lessons count
    const { count: completedLessonsCount } = await supabase
      .from('calendar_slots')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('teacher_id', teacherId)
      .eq('status', 'completed');

    const { count: totalLessonsCount } = await supabase
      .from('calendar_slots')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('teacher_id', teacherId)
      .in('status', ['booked', 'completed', 'no_show']);

    // 9. Compute stats
    const totalFlashcards = Object.values(cardsCountMap).reduce((a, b) => a + b, 0);
    const masteredFlashcards = Object.values(masteredCountMap).reduce((a, b) => a + b, 0);
    const activeHomeworks = enrichedHomeworks.filter(h => !h.completed_at).length;

    const stats = {
      totalLessons: totalLessonsCount || 0,
      completedLessons: completedLessonsCount || 0,
      upcomingLessons: enrichedLessons.length,
      activeHomeworks,
      flashcardSetsCount: enrichedFlashcardSets.length,
      totalFlashcards,
      masteredFlashcards,
    };

    // 10. Per-student meeting link
    const { data: studentSettingsData } = await supabase
      .from('calendar_student_settings')
      .select('default_meeting_link')
      .eq('student_id', studentId)
      .eq('teacher_id', teacherId)
      .maybeSingle();
    const studentMeetingLink = studentSettingsData?.default_meeting_link || null;

    return new Response(JSON.stringify({
      teacherName,
      teacherEmail: teacherProfile?.email || null,
      studentName: studentData.name,
      studentId,
      studentEmail: studentData.student_email,
      englishLevel: studentData.english_level,
      flashcardSets: enrichedFlashcardSets,
      homeworks: enrichedHomeworks,
      sharedWorksheets: enrichedWorksheets,
      upcomingLessons: enrichedLessons,
      stats,
      defaultMeetingLink: studentMeetingLink || null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error in get-student-hub-data:', err);
    return new Response(JSON.stringify({ error: (err as Error)?.message ?? String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
