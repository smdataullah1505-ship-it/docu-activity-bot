CREATE TABLE public.cached_topics (
  document_hash text PRIMARY KEY,
  topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.cached_topics TO service_role;

ALTER TABLE public.cached_topics ENABLE ROW LEVEL SECURITY;