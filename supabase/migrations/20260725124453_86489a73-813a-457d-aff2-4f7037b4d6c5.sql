CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.mcp_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  token_hash text NOT NULL UNIQUE,
  token_prefix text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY['read:students','read:worksheets','read:suggestions'],
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

GRANT SELECT, UPDATE, DELETE ON public.mcp_tokens TO authenticated;
GRANT ALL ON public.mcp_tokens TO service_role;

ALTER TABLE public.mcp_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_reads_own_tokens" ON public.mcp_tokens
  FOR SELECT TO authenticated USING (teacher_id = auth.uid());
CREATE POLICY "teacher_updates_own_tokens" ON public.mcp_tokens
  FOR UPDATE TO authenticated USING (teacher_id = auth.uid());
CREATE POLICY "teacher_deletes_own_tokens" ON public.mcp_tokens
  FOR DELETE TO authenticated USING (teacher_id = auth.uid());

CREATE INDEX mcp_tokens_hash_lookup_idx ON public.mcp_tokens(token_hash) WHERE revoked_at IS NULL;
CREATE INDEX mcp_tokens_teacher_idx ON public.mcp_tokens(teacher_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.create_mcp_token(_name text, _expires_at timestamptz DEFAULT NULL)
RETURNS TABLE(id uuid, token text, token_prefix text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  _uid uuid := auth.uid();
  _raw bytea := extensions.gen_random_bytes(24);
  _token text;
  _prefix text;
  _hash text;
  _new_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF _name IS NULL OR char_length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'name required';
  END IF;
  _token := 'edq_mcp_' || replace(replace(replace(encode(_raw, 'base64'), '+', ''), '/', ''), '=', '');
  _hash := encode(extensions.digest(_token, 'sha256'), 'hex');
  _prefix := substring(_token, 1, 16);
  INSERT INTO public.mcp_tokens (teacher_id, name, token_hash, token_prefix, expires_at)
    VALUES (_uid, trim(_name), _hash, _prefix, _expires_at)
    RETURNING mcp_tokens.id INTO _new_id;
  RETURN QUERY SELECT _new_id, _token, _prefix;
END $$;

GRANT EXECUTE ON FUNCTION public.create_mcp_token(text, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_mcp_token(_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  UPDATE public.mcp_tokens SET revoked_at = now()
    WHERE id = _id AND teacher_id = auth.uid() AND revoked_at IS NULL;
END $$;

GRANT EXECUTE ON FUNCTION public.revoke_mcp_token(uuid) TO authenticated;