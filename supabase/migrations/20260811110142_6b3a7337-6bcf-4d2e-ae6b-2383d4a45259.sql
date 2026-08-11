ALTER TABLE public.saved_activities ADD COLUMN document_hash text;

DELETE FROM public.saved_activities;

DROP INDEX IF EXISTS saved_activities_lookup_idx;

CREATE INDEX saved_activities_cache_idx
  ON public.saved_activities
  (document_hash, topic, activity_type, difficulty, question_count, created_at DESC);