-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('teacher','student')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    CASE WHEN NEW.raw_user_meta_data->>'role' = 'teacher' THEN 'teacher' ELSE 'student' END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- QUIZZES
CREATE TABLE public.quizzes (
  code text PRIMARY KEY,
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic text NOT NULL,
  activity_type text NOT NULL,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.quizzes TO authenticated;
GRANT ALL ON public.quizzes TO service_role;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers read own quizzes" ON public.quizzes FOR SELECT TO authenticated USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers create own quizzes" ON public.quizzes FOR INSERT TO authenticated WITH CHECK (auth.uid() = teacher_id);

-- Answer-free lookup surface for students (no answer/explanation columns exposed)
CREATE VIEW public.quizzes_public
WITH (security_invoker = false)
AS SELECT code, topic, activity_type, created_at FROM public.quizzes;
GRANT SELECT ON public.quizzes_public TO authenticated;

-- QUIZ ATTEMPTS
CREATE TABLE public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_code text NOT NULL REFERENCES public.quizzes(code) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  score integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  tab_switches integer NOT NULL DEFAULT 0,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quiz_code, student_id)
);
GRANT SELECT, INSERT ON public.quiz_attempts TO authenticated;
GRANT ALL ON public.quiz_attempts TO service_role;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students insert own attempts" ON public.quiz_attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Students read own attempts" ON public.quiz_attempts FOR SELECT TO authenticated USING (auth.uid() = student_id);
CREATE POLICY "Teachers read attempts for own quizzes" ON public.quiz_attempts FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.quizzes q WHERE q.code = quiz_attempts.quiz_code AND q.teacher_id = auth.uid())
);