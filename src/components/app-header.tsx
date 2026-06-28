import { Link } from "@tanstack/react-router";
import { Sparkles, LogOut, LayoutDashboard, Wand2, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Role } from "@/lib/use-profile";

export function AppHeader({
  role,
  displayName,
  email,
}: {
  role: Role;
  displayName?: string | null;
  email?: string | null;
}) {
  const sign = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
  };
  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-600 to-fuchsia-600 grid place-items-center text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="hidden sm:inline">Lecture Lab AI</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            to="/"
            className="px-3 py-1.5 rounded-md hover:bg-slate-100 inline-flex items-center gap-1.5"
          >
            <LayoutDashboard className="h-4 w-4" /> <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <Link
            to="/lab"
            className="px-3 py-1.5 rounded-md hover:bg-slate-100 inline-flex items-center gap-1.5"
          >
            <Wand2 className="h-4 w-4" /> <span className="hidden sm:inline">Activities</span>
          </Link>
          {role === "teacher" && (
            <Link
              to="/analytics"
              className="px-3 py-1.5 rounded-md hover:bg-slate-100 inline-flex items-center gap-1.5"
            >
              <BarChart3 className="h-4 w-4" /> <span className="hidden sm:inline">Analytics</span>
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              role === "teacher"
                ? "bg-indigo-100 text-indigo-700"
                : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {role === "teacher" ? "👨‍🏫 Teacher" : "🎓 Student"}
          </span>
          <div className="hidden md:flex flex-col items-end text-xs">
            <span className="font-medium text-slate-700">{displayName || "User"}</span>
            <span className="text-slate-500">{email}</span>
          </div>
          <button
            onClick={sign}
            className="text-slate-500 hover:text-rose-600 p-1.5"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
