import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: vi.fn() } }));

import { buildDuplicatePayload, friendlyDuplicateError, DUPLICATE_SOURCE_COLUMNS } from '../worksheetService/duplicateService';

const published = {
  title: 'Markets',
  ai_response: '{"title":"Markets"}',
  html_content: '<html></html>',
  prompt: 'p',
  form_data: { lessonTopic: 'Markets', clientGenerationId: 'gen-1' },
  selected_image: { url: 'https://cdn.example.com/i.jpg' },
  audio_url: 'https://cdn.example.com/a.mp3',
  // columns that must never be copied, even if a caller passes them
  public_slug: 'markets-abc',
  is_public: true,
  published_at: '2026-01-01',
  public_view_count: 99,
  share_token: 'tok',
  share_recipient_email: 'a@b.c',
  deleted_at: '2026-02-01',
  id: 'orig',
  sequence_number: 7,
};

describe('buildDuplicatePayload', () => {
  const payload = buildDuplicatePayload(published as never, 'student-1', 'teacher-1');

  it('resets publication, sharing and soft-delete state', () => {
    expect(payload).toMatchObject({
      is_public: false,
      public_slug: null,
      published_at: null,
      public_view_count: 0,
      deleted_at: null,
      share_token: null,
      share_expires_at: null,
      share_recipient_email: null,
      last_shared_at: null,
      download_count: 0,
      status: 'copy',
      student_id: 'student-1',
      teacher_id: 'teacher-1',
    });
  });

  it('copies content columns and drops the original generation id', () => {
    expect(payload.title).toBe('Markets');
    expect(payload.ai_response).toBe(published.ai_response);
    expect(payload.selected_image).toEqual(published.selected_image);
    expect(payload.form_data).toEqual({ lessonTopic: 'Markets' });
    expect(published.form_data.clientGenerationId).toBe('gen-1');
  });

  it('never carries id or sequence_number', () => {
    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('sequence_number');
  });

  it('copies only the explicit column list', () => {
    expect(DUPLICATE_SOURCE_COLUMNS).not.toContain('public_slug');
    expect(DUPLICATE_SOURCE_COLUMNS).not.toContain('is_public');
  });
});

describe('friendlyDuplicateError', () => {
  it('hides raw database text', () => {
    const msg = friendlyDuplicateError({
      code: '23505',
      message: 'duplicate key value violates unique constraint "worksheets_public_slug_key"',
    });
    expect(msg).not.toMatch(/constraint|duplicate key/i);
    expect(friendlyDuplicateError({ message: 'boom' })).toMatch(/could not duplicate/i);
  });
});
