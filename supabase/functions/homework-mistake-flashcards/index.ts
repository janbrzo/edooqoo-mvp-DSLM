import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'https://esm.sh/zod@3.23.8';
import { jsonResponse, resolveCaller, teacherIdOf } from '../_shared/auth.ts';
import { handleMistakes, MistakeFailure, type MistakeSource } from './service.ts';

const schema = z.object({
  mode: z.enum(['preview', 'create']), homework_id: z.string().uuid(),
  share_token: z.string().trim().min(1).max(256).optional(),
  student_email: z.string().trim().email().max(254).optional(),
}).strict();

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, corsHeaders);
  try {
    if (Number(req.headers.get('content-length') ?? 0) > 2048) return jsonResponse({ error: 'invalid_request' }, 400, corsHeaders);
    const raw = await req.text();
    if (raw.length > 2048) return jsonResponse({ error: 'invalid_request' }, 400, corsHeaders);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return jsonResponse({ error: 'invalid_request' }, 400, corsHeaders); }
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonResponse({ error: 'invalid_request' }, 400, corsHeaders);
    const caller = await resolveCaller(req);
    const teacherId = teacherIdOf(caller);
    if (!teacherId && (!parsed.data.share_token || !parsed.data.student_email)) return jsonResponse({ error: 'not_allowed' }, 403, corsHeaders);
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return jsonResponse({ error: 'service_unavailable' }, 503, corsHeaders);
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const result = await handleMistakes(parsed.data, teacherId, {
      load: async id => {
        const { data: hw, error } = await admin.from('homework_assignments')
          .select('id,teacher_id,student_id,title,share_token,selected_exercises,attempt,reviewed_at,completed_at,completed_by_teacher').eq('id', id).maybeSingle();
        if (error) throw new MistakeFailure('service_unavailable', 503);
        if (!hw?.student_id) return null;
        // Authorize before loading private exercises/answers for extraction.
        const { data: student, error: studentError } = await admin.from('students').select('id,teacher_id,student_email,deleted_at').eq('id', hw.student_id).maybeSingle();
        if (studentError) throw new MistakeFailure('service_unavailable', 503);
        if (!student || student.deleted_at || student.teacher_id !== hw.teacher_id) return null;
        const owner = teacherId === hw.teacher_id;
        const learner = !!parsed.data.share_token && hw.share_token === parsed.data.share_token && !!student.student_email
          && student.student_email.trim().toLowerCase() === parsed.data.student_email?.trim().toLowerCase();
        if (!owner && !learner) return null;
        const { data: source, error: sourceError } = await admin.rpc('load_homework_mistake_source', { p_homework_id: id });
        if (sourceError) throw new MistakeFailure('service_unavailable', 503);
        return source as MistakeSource | null;
      },
      save: async (source, cards, ownerId, request) => {
        const hw = source.homework;
        const snapshot = {
          teacher_id: hw.teacher_id, student_id: hw.student_id, attempt: hw.attempt,
          reviewed_at: hw.reviewed_at, completed_at: hw.completed_at, completed_by_teacher: hw.completed_by_teacher,
          selected_exercises: hw.selected_exercises, answers: source.answers,
        };
        const { data, error } = await admin.rpc('save_homework_mistake_flashcards', {
          p_homework_id: hw.id, p_teacher_id: ownerId, p_share_token: request.share_token ?? null,
          p_student_email: request.student_email ?? null, p_snapshot: snapshot, p_cards: cards,
        });
        if (error) {
          const known = ['source_changed','set_unavailable','card_unavailable','contributions_disabled','not_reviewed','not_allowed'];
          throw new MistakeFailure(known.find(code => error.message.includes(code)) ?? 'save_failed', 409);
        }
        return data;
      },
    });
    return jsonResponse(result, 200, corsHeaders);
  } catch (error) {
    return jsonResponse({ error: error instanceof MistakeFailure ? error.code : 'service_unavailable' }, error instanceof MistakeFailure ? error.status : 503, corsHeaders);
  }
});