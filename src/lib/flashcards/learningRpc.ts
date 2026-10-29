// Narrow typed wrapper for the two token-scoped flashcard learning RPCs. They are not in the
// generated Database types yet; after regeneration replace `callRpc` with `supabase.rpc` (one line).
import { supabase } from '@/integrations/supabase/client';
import type { LearningRpcRow } from '@/types/flashcards';
import { parseSaveResult, type SaveQuality, type SaveReviewResult } from './reviewState';

type RpcResponse = { data: unknown; error: { message?: string; code?: string } | null };

const callRpc = (fn: string, args: Record<string, unknown>): PromiseLike<RpcResponse> =>
  (supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => PromiseLike<RpcResponse> }).rpc(fn, args);

export class FlashcardRpcError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = 'FlashcardRpcError';
  }
}

export const isInvalidAccess = (error: unknown): boolean =>
  error instanceof FlashcardRpcError && /invalid_access/.test(error.message);

export async function fetchLearningCards(shareToken: string, email: string): Promise<LearningRpcRow[]> {
  const { data, error } = await callRpc('get_flashcard_learning_cards_by_token', {
    p_share_token: shareToken,
    p_email: email,
  });
  if (error) throw new FlashcardRpcError(error.message ?? 'rpc_error', error.code);
  return Array.isArray(data) ? (data as LearningRpcRow[]) : [];
}

export async function saveFlashcardReview(args: {
  shareToken: string;
  email: string;
  cardId: string;
  direction: 1 | 2;
  quality: SaveQuality;
  responseTimeMs: number;
}): Promise<SaveReviewResult> {
  const { data, error } = await callRpc('save_flashcard_review_by_token', {
    p_share_token: args.shareToken,
    p_email: args.email,
    p_card_id: args.cardId,
    p_direction: args.direction,
    p_quality: args.quality,
    p_response_time_ms: args.responseTimeMs,
  });
  if (error) throw new FlashcardRpcError(error.message ?? 'rpc_error', error.code);
  const parsed = parseSaveResult(data);
  if (!parsed) throw new FlashcardRpcError('unexpected_save_response');
  return parsed;
}
