DROP POLICY IF EXISTS "Anyone can insert cached activities" ON public.generated_activities;
DROP POLICY IF EXISTS "Anyone can delete cached activities" ON public.generated_activities;

REVOKE INSERT, UPDATE, DELETE ON public.generated_activities FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.generated_activities FROM authenticated;