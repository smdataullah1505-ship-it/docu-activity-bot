CREATE TABLE public.ai_rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_key text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT date_trunc('hour', now()),
  request_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_key, window_start)
);

GRANT ALL ON public.ai_rate_limits TO service_role;

ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.bump_ai_rate_limit(_client_key text, _limit integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
  _window timestamptz := date_trunc('hour', now());
BEGIN
  INSERT INTO public.ai_rate_limits (client_key, window_start, request_count)
  VALUES (_client_key, _window, 1)
  ON CONFLICT (client_key, window_start)
  DO UPDATE SET request_count = public.ai_rate_limits.request_count + 1,
                updated_at = now()
  RETURNING request_count INTO _count;

  DELETE FROM public.ai_rate_limits WHERE window_start < _window - interval '1 day';

  RETURN _count <= _limit;
END;
$$;

REVOKE ALL ON FUNCTION public.bump_ai_rate_limit(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bump_ai_rate_limit(text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.bump_ai_rate_limit(text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.bump_ai_rate_limit(text, integer) TO service_role;