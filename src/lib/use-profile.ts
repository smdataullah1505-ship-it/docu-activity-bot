import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "teacher" | "student";

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  role: Role;
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return { session, ready };
}

export function useProfile(session: Session | null) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      return;
    }
    let active = true;
    setLoading(true);
    supabase
      .from("profiles")
      .select("id, email, display_name, role")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setProfile(
          data
            ? {
                id: data.id,
                email: data.email,
                display_name: data.display_name,
                role: (data.role as Role) || "student",
              }
            : null,
        );
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session?.user?.id]);
  return { profile, loading, setProfile };
}
