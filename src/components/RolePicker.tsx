import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Role } from "@/lib/data";

export function RolePicker({ userId }: { userId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  async function pick(role: Role) {
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role });
    if (error) setError(error.message);
    await queryClient.invalidateQueries({ queryKey: ["role", userId] });
    setBusy(false);
  }

  return (
    <section className="glass-card mx-auto max-w-2xl p-8 animate-rise">
      <h1 className="font-display text-3xl font-bold tracking-tight">
        How will you use SmartDeadline?
      </h1>
      <p className="mt-2 text-sm text-slate-soft">
        This sets your dashboard. It can't be changed later.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          disabled={busy}
          onClick={() => pick("professor")}
          className="glass-inset p-6 text-left transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60"
        >
          <div className="grid size-10 place-items-center rounded-full border-2 border-brand text-brand">
            <span className="font-display font-bold">P</span>
          </div>
          <p className="mt-4 font-display text-lg font-semibold">Professor</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-soft">
            Create class groups, publish tasks, and watch completion live.
          </p>
        </button>
        <button
          disabled={busy}
          onClick={() => pick("student")}
          className="glass-inset p-6 text-left transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60"
        >
          <div className="grid size-10 place-items-center rounded-full border-2 border-destructive text-destructive">
            <span className="font-display font-bold">S</span>
          </div>
          <p className="mt-4 font-display text-lg font-semibold">Student</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-soft">
            Join classes with a code and work a queue ranked by urgency.
          </p>
        </button>
      </div>
      {error && (
        <p className="mt-4 text-xs font-medium text-destructive">{error}</p>
      )}
    </section>
  );
}
