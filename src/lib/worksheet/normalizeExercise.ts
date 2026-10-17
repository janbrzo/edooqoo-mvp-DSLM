/**
 * Re-export of the shared exercise shape normalizer so renderers (client) and
 * scorers (Edge Functions) read the same canonical shape.
 */
export * from '../../../supabase/functions/_shared/normalizeExercise';
