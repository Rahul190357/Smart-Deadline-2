import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SubmissionBox } from "@/components/SubmissionBox";
import {
  useStudentClasses,
  useStudentData,
  setSubtaskStatus,
  urgencyScore,
  daysLeft,
  completion,
  type Status,
  type Task,
} from "@/lib/data";

const inputCls =
  "w-full rounded-sm border border-border bg-card px-4 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15";

const NEXT: Record<Status["status"], Status["status"]> = {
  not_started: "in_progress",
  in_progress: "done",
  done: "not_started",
};

export function StudentDashboard({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const classes = useStudentClasses(userId);
  const classIds = (classes.data ?? []).map((c) => c.id);
  const data = useStudentData(userId, classIds);

  const [code, setCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setJoinError(null);
    setJoining(true);
    const { data: found, error: findErr } = await supabase
      .from("class_groups")
      .select("id, name")
      .ilike("code", code.trim())
      .limit(1);
    const foundClass = found?.[0];
    if (findErr || !foundClass) {
      setJoinError("No class found with that code.");
      setJoining(false);
      return;
    }
    const { error } = await supabase
      .from("class_members")
      .insert({ class_id: foundClass.id, student_id: userId });
    if (error) {
      setJoinError(
        error.message.includes("duplicate")
          ? "You're already in that class."
          : error.message,
      );
    } else {
      setCode("");
      await queryClient.invalidateQueries({
        queryKey: ["student-classes", userId],
      });
    }
    setJoining(false);
  }

  const myTasks = useMemo(() => {
    if (!data.data) return [];
    const assignedIds = new Set(
      data.data.assignments
        .filter((a) => a.student_id === userId)
        .map((a) => a.task_id),
    );
    return data.data.tasks
      .filter((t) => assignedIds.has(t.id))
      .map((t) => ({ task: t, urgency: urgencyScore(t) }))
      .sort((a, b) => b.urgency - a.urgency);
  }, [data.data, userId]);

  const overall = useMemo(() => {
    if (!data.data || myTasks.length === 0) return 0;
    const pct = myTasks.map(({ task }) =>
      completion(task.id, userId, data.data!.subtasks, data.data!.statuses),
    );
    return Math.round(pct.reduce((a, b) => a + b, 0) / pct.length);
  }, [data.data, myTasks, userId]);

  async function cycle(subtaskId: string, current: Status["status"]) {
    await setSubtaskStatus(subtaskId, userId, NEXT[current]);
    await queryClient.invalidateQueries({ queryKey: ["student-data"] });
  }

  if (classes.isLoading) {
    return <p className="text-sm text-slate-soft">Loading your classes…</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-6">
      {/* Queue */}
      <section className="glass-card p-6 lg:col-span-4 animate-rise">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              Your queue
            </h1>
            <p className="mt-1 text-xs text-slate-soft">
              Ranked by urgency — work from the top.
            </p>
          </div>
          <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
            {myTasks.length} open
          </span>
        </div>

        {myTasks.length === 0 ? (
          <div className="glass-inset p-8 text-center">
            <p className="font-display text-lg font-semibold">All clear</p>
            <p className="mt-1 text-sm text-slate-soft">
              No tasks assigned to you yet. Enjoy the calm.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {myTasks.map(({ task, urgency }, i) => (
              <TaskCard
                key={task.id}
                task={task}
                urgency={urgency}
                index={i}
                subtasks={data.data?.subtasks ?? []}
                statuses={data.data?.statuses ?? []}
                assignments={data.data?.assignments ?? []}
                userId={userId}
                onCycle={cycle}
              />
            ))}
          </div>
        )}
      </section>

      {/* Side column */}
      <div className="space-y-4 lg:col-span-2">
        <section
          className="glass-card p-6 animate-rise"
          style={{ animationDelay: "60ms" }}
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="font-display text-sm font-semibold">
              Your overall progress
            </span>
            <span className="rounded-sm bg-brand/10 px-2.5 py-1 text-[11px] font-semibold text-brand">
              {overall}%
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full gradient-brand bar-fill"
              style={{ width: `${overall}%` }}
            />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-soft">
            Averages your completion across all assigned tasks.
          </p>
        </section>

        <section
          className="glass-card p-6 animate-rise"
          style={{ animationDelay: "120ms" }}
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-soft">
            Your classes
          </span>
          <ul className="mt-3 space-y-2">
            {(classes.data ?? []).map((c) => (
              <li
                key={c.id}
                className="glass-inset flex items-center justify-between px-4 py-2.5"
              >
                <span className="truncate text-sm font-medium">{c.name}</span>
                <span className="shrink-0 font-display text-xs font-semibold tracking-widest text-brand">
                  {c.code}
                </span>
              </li>
            ))}
            {(classes.data ?? []).length === 0 && (
              <p className="text-xs text-slate-soft">
                You haven't joined a class yet.
              </p>
            )}
          </ul>
          <form onSubmit={join} className="mt-4 flex gap-2">
            <input
              className={`${inputCls} uppercase tracking-widest`}
              placeholder="CLASS CODE"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <button
              disabled={joining}
                className="shrink-0 rounded-sm bg-ink px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-brand disabled:opacity-60"
            >
              Join
            </button>
          </form>
          {joinError && (
            <p className="mt-2 text-xs font-medium text-destructive">
              {joinError}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function TaskCard({
  task,
  urgency,
  index,
  subtasks,
  statuses,
  assignments,
  userId,
  onCycle,
}: {
  task: Task;
  urgency: number;
  index: number;
  subtasks: import("@/lib/data").Subtask[];
  statuses: Status[];
  assignments: { task_id: string; student_id: string }[];
  userId: string;
  onCycle: (subtaskId: string, current: Status["status"]) => void;
}) {
  const [open, setOpen] = useState(index === 0);
  const subs = subtasks
    .filter((s) => s.task_id === task.id)
    .sort((a, b) => a.position - b.position);
  const myPct = completion(task.id, userId, subtasks, statuses);
  const d = daysLeft(task.due_date);

  // Group (cohort) progress for this task
  const assignees = assignments
    .filter((a) => a.task_id === task.id)
    .map((a) => a.student_id);
  const groupPct =
    assignees.length === 0
      ? 0
      : Math.round(
          assignees.reduce(
            (sum, sid) => sum + completion(task.id, sid, subtasks, statuses),
            0,
          ) / assignees.length,
        );

  const pill =
    d < 0
      ? { text: "Overdue", cls: "bg-destructive/10 text-destructive" }
      : d <= 2
        ? { text: `Due in ${d}d`, cls: "bg-destructive/10 text-destructive" }
        : d <= 6
          ? { text: `Due in ${d}d`, cls: "bg-brand/10 text-brand" }
          : { text: `Due in ${d}d`, cls: "bg-brand/10 text-brand" };

  return (
    <article
      className="glass-inset overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md animate-rise"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-5 text-left"
      >
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${pill.cls}`}
          >
            {pill.text}
          </span>
          <span className="text-[11px] font-medium text-slate-soft">
            Urgency {urgency}
          </span>
          <span className="ml-auto font-display text-sm font-semibold text-slate-soft">
            {myPct}%
          </span>
        </div>
        <h3 className="mt-2 font-display text-lg font-semibold tracking-tight">
          {task.title}
        </h3>
        <p className="mt-0.5 text-[11px] text-slate-soft">
          {task.subject || "General"} · {task.weight} marks · due {task.due_date}
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full gradient-brand bar-fill"
            style={{ width: `${myPct}%` }}
          />
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-5 pb-5 pt-4">
          <ul className="space-y-2">
            {subs.map((s) => {
              const st =
                statuses.find(
                  (x) => x.subtask_id === s.id && x.student_id === userId,
                )?.status ?? "not_started";
              return (
                <li key={s.id} className="flex items-center gap-3">
                  <button
                    onClick={() => onCycle(s.id, st)}
                    title="Click to advance: not started → in progress → done"
                    className={`grid size-5 shrink-0 place-items-center rounded-md text-[10px] font-bold transition ${
                      st === "done"
                        ? "gradient-brand text-primary-foreground"
                        : st === "in_progress"
                          ? "bg-brand/15 text-brand"
                          : "border border-border bg-card"
                    }`}
                  >
                    {st === "done" ? "✓" : st === "in_progress" ? "…" : ""}
                  </button>
                  <span
                    className={`flex-1 text-sm ${
                      st === "done"
                        ? "text-slate-soft line-through"
                        : "text-ink"
                    }`}
                  >
                    {s.title}
                  </span>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider ${
                      st === "done"
                        ? "text-brand"
                        : st === "in_progress"
                          ? "text-brand"
                          : "text-slate-soft"
                    }`}
                  >
                    {st.replace("_", " ")}
                  </span>
                </li>
              );
            })}
            {subs.length === 0 && (
              <p className="text-xs text-slate-soft">No subtasks listed.</p>
            )}
          </ul>

          <div className="mt-4 border-t border-border pt-3">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-soft">
              <span>Group progress</span>
              <span>{groupPct}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-cyan-soft bar-fill"
                style={{ width: `${groupPct}%` }}
              />
            </div>
          </div>

          <SubmissionBox taskId={task.id} userId={userId} />
        </div>
      )}
    </article>
  );
}
