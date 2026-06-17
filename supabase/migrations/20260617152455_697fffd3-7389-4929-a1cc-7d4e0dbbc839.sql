
CREATE TABLE public.generated_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_name text NOT NULL DEFAULT '',
  topic text NOT NULL,
  activity_type text NOT NULL,
  difficulty text,
  question_count integer,
  generated_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_generated_activities_lookup
  ON public.generated_activities (topic, activity_type, difficulty, question_count, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_activities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_activities TO authenticated;
GRANT ALL ON public.generated_activities TO service_role;

ALTER TABLE public.generated_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read cached activities"
  ON public.generated_activities FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert cached activities"
  ON public.generated_activities FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can delete cached activities"
  ON public.generated_activities FOR DELETE
  USING (true);
