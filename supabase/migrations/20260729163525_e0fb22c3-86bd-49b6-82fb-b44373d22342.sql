DROP POLICY IF EXISTS "Authenticated can read published teacher quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Teachers can read all profiles" ON public.profiles;
REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_teacher(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_teacher(uuid) TO service_role;