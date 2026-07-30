-- Drop quiz + profile related objects
DROP TABLE IF EXISTS public.quiz_attempts CASCADE;
DROP TABLE IF EXISTS public.quizzes CASCADE;
DROP TABLE IF EXISTS public.activity_feedback CASCADE;
DROP TABLE IF EXISTS public.documents CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TYPE IF EXISTS public.user_role CASCADE;
DROP FUNCTION IF EXISTS public.get_user_role(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_teacher(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- saved_activities: make it an anonymous cache
ALTER TABLE public.saved_activities ALTER COLUMN user_id DROP NOT NULL;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='saved_activities' LOOP
    EXECUTE format('DROP POLICY %I ON public.saved_activities', p.policyname);
  END LOOP;
END $$;

GRANT SELECT, INSERT, DELETE ON public.saved_activities TO anon, authenticated;
GRANT ALL ON public.saved_activities TO service_role;

ALTER TABLE public.saved_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read cached activities"
  ON public.saved_activities FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anyone can insert cached activities"
  ON public.saved_activities FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Anyone can delete cached activities"
  ON public.saved_activities FOR DELETE TO anon, authenticated USING (true);