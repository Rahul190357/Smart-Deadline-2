import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSession, signOut } from "@/lib/auth";
import { useRole } from "@/lib/data";
import { GlassBackdrop, Logo } from "@/components/GlassBackdrop";
import { RolePicker } from "@/components/RolePicker";
import { ProfessorDashboard } from "@/components/ProfessorDashboard";
import { StudentDashboard } from "@/components/StudentDashboard";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — SmartDeadline" },
      {
        name: "description",
        content:
          "Your SmartDeadline dashboard: publish tasks as a professor or work your urgency-ranked queue as a student.",
      },
      { property: "og:title", content: "Dashboard — SmartDeadline" },
      {
        property: "og:description",
        content:
          "Your SmartDeadline dashboard: publish tasks as a professor or work your urgency-ranked queue as a student.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { session, loading, user } = useSession();
  const navigate = useNavigate();
  const role = useRole(user?.id);

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/", replace: true });
    }
  }, [loading, session, navigate]);

  if (loading || !user) {
    return (
      <GlassBackdrop>
        <div className="grid min-h-screen place-items-center">
          <p className="text-sm text-slate-soft">Loading…</p>
        </div>
      </GlassBackdrop>
    );
  }

  return (
    <GlassBackdrop>
      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8 lg:px-12">
        <header className="ledger-header mb-8 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border pb-5">
          <Logo />
          <div className="flex shrink-0 items-center gap-3">
            {role.data && (
              <span className="hidden border border-border bg-card px-3 py-1.5 text-[10px] font-semibold uppercase text-slate-soft sm:inline">
                {role.data}
              </span>
            )}
            <span className="hidden max-w-48 truncate text-xs text-slate-soft sm:inline">
              {user.email}
            </span>
            <button
              onClick={() => signOut()}
                className="rounded-sm border border-ink bg-transparent px-4 py-2 text-xs font-semibold text-ink transition hover:bg-ink hover:text-primary-foreground"
            >
              Sign out
            </button>
          </div>
        </header>

        {role.isLoading ? (
          <p className="text-sm text-slate-soft">Loading your workspace…</p>
        ) : role.data === null ? (
          <RolePicker userId={user.id} />
        ) : role.data === "professor" ? (
          <ProfessorDashboard userId={user.id} />
        ) : (
          <StudentDashboard userId={user.id} />
        )}
      </div>
    </GlassBackdrop>
  );
}
