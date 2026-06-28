import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import {
  Sparkles,
  Upload,
  Target,
  Wand2,
  ShieldCheck,
  ImageIcon,
  BarChart3,
  Save,
  Smartphone,
  PencilRuler,
  X,
  Loader2,
  Eye,
  EyeOff,
  LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "tempmail.com",
  "10minutemail.com",
  "guerrillamail.com",
  "yopmail.com",
  "trashmail.com",
  "throwawaymail.com",
  "fakeinbox.com",
]);

const ALLOWED_TLDS = ["com", "edu", "org", "gov", "net", "io", "co", "ai", "us", "uk", "in"];

function validateEmail(email: string): string | null {
  if (!email) return "Email is required";
  if (/\s/.test(email)) return "Email cannot contain spaces";
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) return "Enter a valid email address";
  const domain = email.split("@")[1].toLowerCase();
  if (DISPOSABLE_DOMAINS.has(domain)) return "Disposable emails are not allowed";
  const tld = domain.split(".").pop() ?? "";
  if (!ALLOWED_TLDS.includes(tld)) return `TLD .${tld} is not supported`;
  return null;
}

function validateDisplayName(name: string): string | null {
  if (!name || name.trim().length < 2) return "Display name must be at least 2 characters";
  if (name.length > 50) return "Display name must be 50 characters or fewer";
  if (!/^[A-Za-z0-9 '\-]+$/.test(name)) return "Only letters, numbers, spaces, hyphens, apostrophes";
  return null;
}

function passwordScore(pw: string): { score: 0 | 1 | 2 | 3; label: string; error: string | null } {
  const checks = [
    pw.length >= 8,
    /[A-Z]/.test(pw),
    /[a-z]/.test(pw),
    /[0-9]/.test(pw),
    /[!@#$%^&*]/.test(pw),
  ];
  const passing = checks.filter(Boolean).length;
  const error = checks.every(Boolean)
    ? null
    : "Password needs 8+ chars with upper, lower, number, and special (!@#$%^&*)";
  const score = passing >= 5 ? 3 : passing >= 4 ? 2 : passing >= 2 ? 1 : 0;
  const label = score === 3 ? "Strong" : score === 2 ? "Medium" : score === 1 ? "Weak" : "Too weak";
  return { score, label, error };
}

type Mode = "closed" | "signup" | "login";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>("closed");

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

  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-br from-indigo-50 to-fuchsia-50">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (session) {
    return (
      <div>
        <div className="fixed top-3 right-3 z-40 flex items-center gap-2 rounded-full bg-white/90 backdrop-blur px-3 py-1.5 shadow-sm border text-xs">
          <span className="text-slate-600">{session.user.email}</span>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              toast.success("Signed out");
            }}
            className="text-slate-500 hover:text-rose-600 inline-flex items-center gap-1"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
        {children}
      </div>
    );
  }

  return (
    <>
      <Landing onSignUp={() => setMode("signup")} onLogin={() => setMode("login")} />
      {mode !== "closed" && (
        <AuthModal
          mode={mode}
          onClose={() => setMode("closed")}
          onSwitch={(m) => setMode(m)}
        />
      )}
    </>
  );
}

function Landing({ onSignUp, onLogin }: { onSignUp: () => void; onLogin: () => void }) {
  const steps = [
    { icon: Upload, title: "Upload Your Document", desc: "PDF, PPTX, DOCX, or TXT. The AI reads and understands your content." },
    { icon: Target, title: "Choose a Topic", desc: "AI extracts all topics from your document. Pick the one you want to explore." },
    { icon: Wand2, title: "Generate Activities", desc: "13 activity modes — MCQs, flashcards, image questions, charts, and more." },
  ];
  const features = [
    { icon: Sparkles, title: "13 Activity Modes", desc: "From quick recap to chart interpreter." },
    { icon: ImageIcon, title: "Visual Learning", desc: "AI-generated images, charts, and interactive visualizations." },
    { icon: ShieldCheck, title: "Document-Only AI", desc: "No hallucinations. All content grounded in your material." },
    { icon: Save, title: "Save & Reuse", desc: "Your activities are saved and organized." },
    { icon: Smartphone, title: "Works Anywhere", desc: "Mobile, tablet, desktop." },
    { icon: PencilRuler, title: "Coming Soon: Quiz Designer", desc: "Create quizzes for your students." },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50">
      <header className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-600 to-fuchsia-600 grid place-items-center text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          Lecture Lab AI
          <span className="ml-2 text-xs font-normal text-slate-500">Beta</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onLogin}>Log in</Button>
          <Button onClick={onSignUp} className="bg-indigo-600 hover:bg-indigo-700">
            Sign Up Free
          </Button>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 pt-10 pb-16 text-center">
        <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-indigo-600 to-fuchsia-600 bg-clip-text text-transparent leading-tight">
          Turn Any Lecture into an Interactive Learning Experience
        </h1>
        <p className="mt-5 text-lg text-slate-600 max-w-2xl mx-auto">
          Upload your teaching material. AI generates 13 different activities instantly.
          No setup. No coding. Just learning.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button size="lg" onClick={onSignUp} className="bg-indigo-600 hover:bg-indigo-700">
            Get Started — It's Free
          </Button>
        </div>
        <div className="mt-4 inline-flex items-center gap-2 text-sm text-slate-500">
          ✨ Trusted by teachers and students
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-semibold text-center mb-8">How it works</h2>
        <div className="grid md:grid-cols-3 gap-5">
          {steps.map((s, i) => (
            <div key={i} className="rounded-2xl bg-white border p-6 shadow-sm">
              <div className="h-10 w-10 rounded-lg bg-indigo-100 text-indigo-700 grid place-items-center mb-3">
                <s.icon className="h-5 w-5" />
              </div>
              <div className="text-sm font-semibold text-slate-500">Step {i + 1}</div>
              <div className="font-semibold mt-1">{s.title}</div>
              <p className="text-sm text-slate-600 mt-2">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-semibold text-center mb-8">Everything you need</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <div key={i} className="rounded-2xl bg-white border p-5 shadow-sm">
              <f.icon className="h-5 w-5 text-fuchsia-600 mb-2" />
              <div className="font-semibold">{f.title}</div>
              <p className="text-sm text-slate-600 mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-16">
        <div className="grid md:grid-cols-2 gap-4">
          <blockquote className="rounded-2xl bg-white border p-5 shadow-sm text-sm">
            <p className="italic text-slate-700">"Lecture Lab AI saved me hours of prep time."</p>
            <footer className="mt-2 text-slate-500">— Teacher, University</footer>
          </blockquote>
          <blockquote className="rounded-2xl bg-white border p-5 shadow-sm text-sm">
            <p className="italic text-slate-700">"My students loved the image questions!"</p>
            <footer className="mt-2 text-slate-500">— Professor, College</footer>
          </blockquote>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 pb-16">
        <div className="rounded-2xl border-2 border-dashed border-indigo-200 bg-white/60 p-8 text-center">
          <div className="text-2xl mb-2">🔒</div>
          <div className="font-semibold">Please sign up to upload documents</div>
          <p className="text-sm text-slate-600 mt-1">
            Your documents and activities stay private to your account.
          </p>
          <Button onClick={onSignUp} className="mt-4 bg-indigo-600 hover:bg-indigo-700">
            Sign Up Free
          </Button>
        </div>
      </section>

      <footer className="border-t bg-white/60">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-2 text-sm text-slate-600">
          <div>Lecture Lab AI — Beta Version</div>
          <div className="flex gap-4">
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
            <span>Contact</span>
          </div>
          <div>Built with ❤️ for educators</div>
        </div>
      </footer>
    </div>
  );
}

function AuthModal({
  mode,
  onClose,
  onSwitch,
}: {
  mode: "signup" | "login";
  onClose: () => void;
  onSwitch: (m: "signup" | "login") => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-slate-400 hover:text-slate-700">
          <X className="h-5 w-5" />
        </button>
        {mode === "signup" ? (
          <SignUpForm onSwitch={() => onSwitch("login")} />
        ) : (
          <LoginForm onSwitch={() => onSwitch("signup")} />
        )}
      </div>
    </div>
  );
}

function OtpInputs({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, " ").slice(0, 6).split("");
  return (
    <div className="flex justify-center gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          maxLength={1}
          value={d.trim()}
          onChange={(e) => {
            const c = e.target.value.replace(/\D/g, "").slice(-1);
            const next = (value.padEnd(6, " ").slice(0, 6).split("") as string[]);
            next[i] = c || " ";
            const cleaned = next.join("").trimEnd();
            onChange(cleaned);
            if (c && i < 5) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[i].trim() && i > 0) refs.current[i - 1]?.focus();
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
            if (pasted.length > 1) {
              e.preventDefault();
              onChange(pasted);
              refs.current[Math.min(pasted.length, 5)]?.focus();
            }
          }}
          className="w-12 h-12 text-center text-lg font-semibold border rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
        />
      ))}
    </div>
  );
}

function useResendTimer() {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (secs <= 0) return;
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs]);
  return { secs, start: () => setSecs(60) };
}

function SignUpForm({ onSwitch }: { onSwitch: () => void }) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"teacher" | "student">("student");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useResendTimer();

  const nameErr = useMemo(() => (displayName ? validateDisplayName(displayName) : null), [displayName]);
  const emailErr = useMemo(() => (email ? validateEmail(email) : null), [email]);
  const canSend = !nameErr && !emailErr && displayName && email && agree && !loading;

  const sendOtp = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { data: { display_name: displayName.trim(), role }, shouldCreateUser: true },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setOtpSent(true);
    timer.start();
    toast.success(`Code sent to ${email}`);
  };

  const verify = async () => {
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: "email" });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome to Lecture Lab AI!");
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold">Create Your Free Account</h2>
      <p className="text-sm text-slate-600 mt-1">Start creating interactive activities in minutes.</p>

      <div className="mt-5 space-y-3">
        {!otpSent && (
          <div>
            <label className="text-sm font-medium">I am a</label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {(["teacher", "student"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium capitalize transition ${
                    role === r
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {r === "teacher" ? "👨‍🏫 Teacher" : "🎓 Student"}
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <label className="text-sm font-medium">Display name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={`mt-1 w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200 ${
              nameErr ? "border-rose-400" : "focus:border-indigo-500"
            }`}
            placeholder="Jane Doe"
            disabled={otpSent}
          />
          {nameErr && <div className="text-xs text-rose-600 mt-1">{nameErr}</div>}
        </div>
        <div>
          <label className="text-sm font-medium">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`mt-1 w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200 ${
              emailErr ? "border-rose-400" : "focus:border-indigo-500"
            }`}
            placeholder="you@school.edu"
            disabled={otpSent}
          />
          {emailErr && <div className="text-xs text-rose-600 mt-1">{emailErr}</div>}
        </div>
        {!otpSent && (
          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
            I agree to the Terms of Service and Privacy Policy
          </label>
        )}


        {otpSent && (
          <div className="space-y-3">
            <div className="text-sm text-slate-600 text-center">We sent a code to {email}</div>
            <OtpInputs value={otp} onChange={setOtp} />
            <div className="text-center text-xs text-slate-500">
              {timer.secs > 0 ? (
                <>Resend code in {timer.secs}s</>
              ) : (
                <button onClick={sendOtp} className="text-indigo-600 hover:underline" disabled={loading}>
                  Resend OTP
                </button>
              )}
            </div>
          </div>
        )}

        {!otpSent ? (
          <Button
            onClick={sendOtp}
            disabled={!canSend}
            className="w-full bg-indigo-600 hover:bg-indigo-700"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send OTP"}
          </Button>
        ) : (
          <Button
            onClick={verify}
            disabled={otp.length !== 6 || loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & Create Account"}
          </Button>
        )}

        <div className="text-center text-sm text-slate-600">
          Already have an account?{" "}
          <button onClick={onSwitch} className="text-indigo-600 hover:underline">
            Log In
          </button>
        </div>
      </div>
    </div>
  );
}

function LoginForm({ onSwitch }: { onSwitch: () => void }) {
  const [method, setMethod] = useState<"otp" | "password">("otp");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const timer = useResendTimer();

  const emailErr = useMemo(() => (email ? validateEmail(email) : null), [email]);
  const pwInfo = useMemo(() => passwordScore(password), [password]);

  const sendOtp = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setOtpSent(true);
    timer.start();
    toast.success(`Code sent to ${email}`);
  };

  const verify = async () => {
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: "email" });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back!");
  };

  const passwordLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back!");
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold">Welcome Back</h2>
      <div className="mt-3 inline-flex rounded-lg border p-0.5 bg-slate-50 text-sm">
        <button
          onClick={() => setMethod("otp")}
          className={`px-3 py-1.5 rounded-md ${method === "otp" ? "bg-white shadow-sm" : "text-slate-600"}`}
        >
          Sign in with OTP
        </button>
        <button
          onClick={() => setMethod("password")}
          className={`px-3 py-1.5 rounded-md ${method === "password" ? "bg-white shadow-sm" : "text-slate-600"}`}
        >
          Sign in with Password
        </button>
      </div>

      <div className="mt-5 space-y-3">
        <div>
          <label className="text-sm font-medium">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`mt-1 w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-200 ${
              emailErr ? "border-rose-400" : "focus:border-indigo-500"
            }`}
            placeholder="you@school.edu"
            disabled={otpSent}
          />
          {emailErr && <div className="text-xs text-rose-600 mt-1">{emailErr}</div>}
        </div>

        {method === "password" ? (
          <>
            <div>
              <label className="text-sm font-medium">Password</label>
              <div className="relative mt-1">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 pr-10 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {password && (
                <div className="mt-2">
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        pwInfo.score >= 3
                          ? "bg-emerald-500 w-full"
                          : pwInfo.score === 2
                            ? "bg-amber-500 w-2/3"
                            : pwInfo.score === 1
                              ? "bg-rose-500 w-1/3"
                              : "bg-rose-300 w-1/6"
                      }`}
                    />
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Strength: {pwInfo.label}</div>
                </div>
              )}
            </div>
            <Button
              onClick={passwordLogin}
              disabled={!!emailErr || !email || !password || loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log In"}
            </Button>
            <button
              type="button"
              onClick={async () => {
                if (emailErr || !email) return toast.error("Enter a valid email first");
                const { error } = await supabase.auth.resetPasswordForEmail(email);
                if (error) toast.error(error.message);
                else toast.success("Password reset email sent");
              }}
              className="text-sm text-indigo-600 hover:underline"
            >
              Forgot Password?
            </button>
          </>
        ) : (
          <>
            {otpSent && (
              <div className="space-y-3">
                <div className="text-sm text-slate-600 text-center">We sent a code to {email}</div>
                <OtpInputs value={otp} onChange={setOtp} />
                <div className="text-center text-xs text-slate-500">
                  {timer.secs > 0 ? (
                    <>Resend code in {timer.secs}s</>
                  ) : (
                    <button onClick={sendOtp} className="text-indigo-600 hover:underline" disabled={loading}>
                      Resend OTP
                    </button>
                  )}
                </div>
              </div>
            )}
            {!otpSent ? (
              <Button
                onClick={sendOtp}
                disabled={!!emailErr || !email || loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send OTP"}
              </Button>
            ) : (
              <Button
                onClick={verify}
                disabled={otp.length !== 6 || loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & Log In"}
              </Button>
            )}
          </>
        )}

        <div className="text-center text-sm text-slate-600">
          Don't have an account?{" "}
          <button onClick={onSwitch} className="text-indigo-600 hover:underline">
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );
}
