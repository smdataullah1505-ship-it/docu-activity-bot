DROP POLICY IF EXISTS "Anyone can read cached activities" ON public.saved_activities;
DROP POLICY IF EXISTS "Anyone can insert cached activities" ON public.saved_activities;
DROP POLICY IF EXISTS "Anyone can delete cached activities" ON public.saved_activities;

REVOKE ALL ON public.saved_activities FROM anon;
REVOKE ALL ON public.saved_activities FROM authenticated;
GRANT ALL ON public.saved_activities TO service_role;

ALTER TABLE public.saved_activities ENABLE ROW LEVEL SECURITY;