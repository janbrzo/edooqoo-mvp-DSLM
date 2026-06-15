CREATE OR REPLACE FUNCTION public.consume_token(p_teacher_id uuid, p_worksheet_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_available INTEGER;
  tokens_frozen BOOLEAN;
  monthly_limit INTEGER;
  monthly_used INTEGER;
  total_created INTEGER;
  sub_type TEXT;
  sub_status TEXT;
  teacher_email_var TEXT;
  should_count_monthly BOOLEAN := FALSE;
  already_charged INTEGER;
BEGIN
  -- v6.9.59: serialize concurrent callers for the same (teacher, worksheet)
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_teacher_id::text || ':' || p_worksheet_id::text, 0)
  );

  -- v6.9.59: idempotent short-circuit on (teacher_id, worksheet_id)
  SELECT COUNT(*) INTO already_charged
  FROM public.token_transactions
  WHERE teacher_id = p_teacher_id
    AND transaction_type = 'usage'
    AND reference_id = p_worksheet_id;
  IF already_charged > 0 THEN
    RAISE NOTICE 'consume_token: already charged for worksheet %, no-op', p_worksheet_id;
    RETURN TRUE;
  END IF;

  -- Load current profile state + email
  SELECT 
    COALESCE(available_tokens, 0), 
    COALESCE(is_tokens_frozen, FALSE),
    COALESCE(monthly_worksheet_limit, 0),
    COALESCE(monthly_worksheets_used, 0),
    COALESCE(total_worksheets_created, 0),
    subscription_type,
    subscription_status,
    email
  INTO current_available, tokens_frozen, monthly_limit, monthly_used, total_created, sub_type, sub_status, teacher_email_var
  FROM public.profiles 
  WHERE id = p_teacher_id;

  RAISE NOTICE 'Token consumption attempt: user=%, available=%, monthly_limit=%, monthly_used=%, frozen=%', 
    p_teacher_id, current_available, monthly_limit, monthly_used, tokens_frozen;

  IF tokens_frozen = TRUE THEN
    RAISE NOTICE 'Token consumption blocked: tokens are frozen for user %', p_teacher_id;
    RETURN FALSE;
  END IF;

  -- PRIORITY 1: monthly limit (from active subscription)
  IF monthly_limit > 0 AND monthly_used < monthly_limit THEN
    UPDATE public.profiles 
    SET 
      monthly_worksheets_used = monthly_worksheets_used + 1,
      total_worksheets_created = COALESCE(total_worksheets_created, 0) + 1,
      total_tokens_consumed = COALESCE(total_tokens_consumed, 0) + 1
    WHERE id = p_teacher_id;

    INSERT INTO public.token_transactions (teacher_id, teacher_email, transaction_type, amount, description, reference_id)
    VALUES (p_teacher_id, teacher_email_var, 'usage', 0, 'Worksheet generation (from monthly limit)', p_worksheet_id);

    RAISE NOTICE 'Token consumed from monthly limit for user %', p_teacher_id;
    RETURN TRUE;
  END IF;

  -- PRIORITY 2: available tokens (purchased/subscription bonus/demo)
  IF current_available > 0 THEN
    should_count_monthly := (COALESCE(sub_status, '') IN ('active','active_cancelled'))
                            OR (COALESCE(sub_type, '') <> 'Free Demo')
                            OR (total_created >= 2);

    UPDATE public.profiles 
    SET 
      available_tokens = available_tokens - 1,
      total_tokens_consumed = COALESCE(total_tokens_consumed, 0) + 1,
      total_worksheets_created = COALESCE(total_worksheets_created, 0) + 1,
      monthly_worksheets_used = monthly_worksheets_used + CASE WHEN should_count_monthly THEN 1 ELSE 0 END
    WHERE id = p_teacher_id;
    
    INSERT INTO public.token_transactions (teacher_id, teacher_email, transaction_type, amount, description, reference_id)
    VALUES (p_teacher_id, teacher_email_var, 'usage', -1, 'Worksheet generation (from available tokens)', p_worksheet_id);
    
    RAISE NOTICE 'Token consumed from available tokens for user %', p_teacher_id;
    RETURN TRUE;
  END IF;

  RAISE NOTICE 'Token consumption failed: no tokens available for user %', p_teacher_id;
  RETURN FALSE;
END;
$function$;