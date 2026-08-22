import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
};

/**
 * Lightweight client-side session + profile reader.
 * Auth is optional in this app — the no-login generator flow never depends on it.
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async (s: Session | null) => {
      if (!active) return;
      setSession(s);
      if (!s?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("id, email, full_name, role")
        .eq("id", s.user.id)
        .maybeSingle();
      if (!active) return;
      setProfile((data as Profile | null) ?? null);
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      void load(s);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, profile, loading, user: session?.user ?? null };
}
