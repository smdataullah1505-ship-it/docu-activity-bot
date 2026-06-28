
-- 1. Role enum and profiles.role
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('teacher', 'student');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role public.user_role NOT NULL DEFAULT 'student';

-- Update handle_new_user to persist role from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'student')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $function$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Security-definer role checker (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.is_teacher(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND role = 'teacher');
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_teacher(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_teacher(uuid) TO authenticated, service_role;

-- Allow teachers to read all profiles (for analytics)
DROP POLICY IF EXISTS "Teachers can read all profiles" ON public.profiles;
CREATE POLICY "Teachers can read all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_teacher(auth.uid()));

-- 3. Quizzes table
CREATE TABLE IF NOT EXISTS public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_role public.user_role NOT NULL,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  topic text NOT NULL,
  title text NOT NULL,
  questions jsonb NOT NULL,
  share_code text UNIQUE,
  time_limit integer,
  is_published boolean NOT NULL DEFAULT false,
  is_practice boolean NOT NULL DEFAULT false,
  difficulty text,
  question_count integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quizzes TO authenticated;
GRANT ALL ON public.quizzes TO service_role;

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

-- Creator full control
CREATE POLICY "Creators manage own quizzes"
  ON public.quizzes FOR ALL TO authenticated
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

-- Students can read published teacher quizzes (needed to attempt via share code)
CREATE POLICY "Authenticated can read published teacher quizzes"
  ON public.quizzes FOR SELECT TO authenticated
  USING (is_published = true AND is_practice = false);

CREATE INDEX IF NOT EXISTS idx_quizzes_creator ON public.quizzes(creator_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_share_code ON public.quizzes(share_code);

CREATE TRIGGER update_quizzes_updated_at
  BEFORE UPDATE ON public.quizzes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Quiz attempts table
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  current_question_index integer NOT NULL DEFAULT 0,
  score integer,
  time_taken integer,
  suspicious_events jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_completed boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One attempt per student per quiz
CREATE UNIQUE INDEX IF NOT EXISTS uq_quiz_attempts_quiz_student
  ON public.quiz_attempts(quiz_id, student_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_attempts TO authenticated;
GRANT ALL ON public.quiz_attempts TO service_role;

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Students manage own attempts
CREATE POLICY "Students manage own attempts"
  ON public.quiz_attempts FOR ALL TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- Quiz creators can view attempts on their quizzes
CREATE POLICY "Creators can view attempts on their quizzes"
  ON public.quiz_attempts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND q.creator_id = auth.uid()
    )
  );

CREATE TRIGGER update_quiz_attempts_updated_at
  BEFORE UPDATE ON public.quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
