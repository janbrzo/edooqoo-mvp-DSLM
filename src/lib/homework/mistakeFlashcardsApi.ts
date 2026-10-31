import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

export interface MistakeScope {
  homeworkId: string;
  revision: string;
  audience: 'teacher' | 'student';
  shareToken?: string;
  email?: string;
}
const requestSchema = z.object({
  mode: z.enum(['preview', 'create']), homework_id: z.string().uuid(),
  share_token: z.string().trim().min(1).max(256).optional(),
  student_email: z.string().trim().email().max(254).optional(),
});
const previewSchema = z.object({ count: z.number().int().min(0).max(500) });
const savedSchema = z.object({
  set_id: z.string().uuid(), share_token: z.string().regex(/^[a-f0-9]{64}$/),
  created_count: z.number().int().nonnegative(), existing_count: z.number().int().nonnegative(),
});
export type MistakeSaveResult = z.infer<typeof savedSchema>;
export async function requestMistakeFlashcards(scope: MistakeScope, mode: 'preview'): Promise<{ count: number }>;
export async function requestMistakeFlashcards(scope: MistakeScope, mode: 'create'): Promise<MistakeSaveResult>;
export async function requestMistakeFlashcards(scope: MistakeScope, mode: 'preview' | 'create') {
  if (localStorage.getItem('edooqoo_demo_mode')) throw new Error('demo_mode');
  const body = requestSchema.parse({ mode, homework_id: scope.homeworkId,
    ...(scope.audience === 'student' ? { share_token: scope.shareToken, student_email: scope.email } : {}),
  });
  if (scope.audience === 'student' && (!body.share_token || !body.student_email)) throw new Error('not_allowed');
  const { data, error } = await supabase.functions.invoke('homework-mistake-flashcards', { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return mode === 'preview' ? previewSchema.parse(data) : savedSchema.parse(data);
}