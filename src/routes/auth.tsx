import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Google, Loader2, Sparkles } from "lucide-react";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Lecture Lab AI" },
      {
        name: "description",
        content: "Sign in to create live quizzes and review student results in Lecture Lab AI.",
      },
      { property: "og:title", content: "Sign in — Lecture Lab AI" },
      {
        property: "og:description",
        content: "Sign in to create live quizzes and review student results in Lecture Lab AI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"teacher" | "student">("student");
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active && data.user) void navigate({ to: "/" });
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setConfirmationSent(false);
    try {
      if (mode === "sign-up") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName.trim(), role },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setConfirmationSent(true);
          toast.success("Check your email to confirm your account.");
        } else {
          await navigate({ to: "/" });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        await navigate({ to: "/" });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (!result.redirected) await navigate({ to: "/" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google sign-in failed.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-10 sm:px-6">
      <Toaster richColors position="top-center" />
      <main className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl gradient-hero text-primary-foreground shadow-md">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-3xl font-bold">Lecture Lab AI</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in for live quizzes and results.</p>
        </div>

        <section className="surface-elevated p-6">
          <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
            {(["sign-in", "sign-up"] as const).map((item) => (
              <Button
                key={item}
                type="button"
                variant={mode === item ? "default" : "ghost"}
                onClick={() => {
                  setMode(item);
                  setConfirmationSent(false);
                }}
              >
                {item === "sign-in" ? "Sign in" : "Create account"}
              </Button>
            ))}
          </div>

          {confirmationSent && (
            <div className="mb-4 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
              Your account is created. Check your email and confirm it before signing in.
            </div>
          )}

          <form className="space-y-4" onSubmit={submit}>
            {mode === "sign-up" && (
              <div>
                <label className="text-sm font-medium" htmlFor="full-name">Full name</label>
                <Input id="full-name" className="mt-1.5" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} />
              </div>
            )}
            <div>
              <label className="text-sm font-medium" htmlFor="auth-email">Email</label>
              <Input id="auth-email" className="mt-1.5" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="auth-password">Password</label>
              <Input id="auth-password" className="mt-1.5" type="password" autoComplete={mode === "sign-up" ? "new-password" : "current-password"} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {mode === "sign-up" && (
              <fieldset>
                <legend className="text-sm font-medium">I am signing up as</legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(["student", "teacher"] as const).map((item) => (
                    <Button key={item} type="button" variant={role === item ? "default" : "outline"} onClick={() => setRole(item)} className="capitalize">
                      {item}
                    </Button>
                  ))}
                </div>
              </fieldset>
            )}
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {mode === "sign-in" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" className="w-full" onClick={signInWithGoogle} disabled={loading}>
            <Google className="mr-2 h-4 w-4" /> Continue with Google
          </Button>
        </section>
      </main>
    </div>
  );
}