import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthGate } from "@/components/auth-gate";

type OAuthResult = {
  data: { client?: { name?: string }; redirect_url?: string; redirect_to?: string } | null;
  error: { message: string } | null;
};

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};

const oauthApi = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // Browser-only: the Supabase client reads its session from localStorage.
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  component: ConsentPage,
});

function ConsentPage() {
  return (
    <AuthGate>
      <Consent />
    </AuthGate>
  );
}

function Consent() {
  const { authorization_id } = Route.useSearch();
  const [clientName, setClientName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!authorization_id) {
        setError("Missing authorization_id in the URL.");
        setLoading(false);
        return;
      }
      const { data, error } = await oauthApi().getAuthorizationDetails(authorization_id);
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setClientName(data?.client?.name ?? "an app");
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [authorization_id]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = oauthApi();
    const { data, error } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center p-6">
      <div className="w-full rounded-xl border border-border bg-card p-8 shadow-sm">
        {loading ? (
          <p className="text-muted-foreground">Loading authorization request…</p>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-foreground">
              Connect {clientName} to Lecture Lab AI
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              This lets {clientName} read your Lecture Lab AI data — your profile, uploaded lecture
              materials, generated activities, quizzes and quiz attempts — acting as you.
            </p>
            {error && (
              <p role="alert" className="mt-4 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="mt-6 flex gap-3">
              <button
                disabled={busy || !authorization_id}
                onClick={() => decide(true)}
                className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                Approve
              </button>
              <button
                disabled={busy || !authorization_id}
                onClick={() => decide(false)}
                className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground disabled:opacity-50"
              >
                Deny
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
