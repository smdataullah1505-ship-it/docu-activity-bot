-- Quiz access is based on ownership, not profile roles.
DROP POLICY IF EXISTS "Teachers read own quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Teachers create own quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Users can read own quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Users can create own quizzes" ON public.quizzes;
CREATE POLICY "Users can read own quizzes" ON public.quizzes
  FOR SELECT TO authenticated
  USING (auth.uid() = teacher_id);
CREATE POLICY "Users can create own quizzes" ON public.quizzes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Students insert own attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Students read own attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Teachers read attempts for own quizzes" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Users insert own attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Users read own attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Quiz owners read attempts" ON public.quiz_attempts;
CREATE POLICY "Users insert own attempts" ON public.quiz_attempts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Users read own attempts" ON public.quiz_attempts
  FOR SELECT TO authenticated
  USING (auth.uid() = student_id);
CREATE POLICY "Quiz owners read attempts" ON public.quiz_attempts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quizzes q
      WHERE q.code = quiz_attempts.quiz_code
        AND q.teacher_id = auth.uid()
    )
  );

-- Students receive only answer-free quiz metadata through this surface.
CREATE OR REPLACE VIEW public.quizzes_public
WITH (security_invoker = false)
AS SELECT code, topic, activity_type, created_at
FROM public.quizzes;
GRANT SELECT ON public.quizzes_public TO authenticated;