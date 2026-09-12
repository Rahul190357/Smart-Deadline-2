import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useClassDetail,
  useProfessorClasses,
  completion,
  notStarted,
  type Task,
} from "@/lib/data";
import { generateSubtasks } from "@/lib/ai.functions";

function makeCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 4; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return `CLS-${out}`;
}

const inputCls =
  "w-full rounded-sm border border-border bg-card px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15";

export function ProfessorDashboard({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const classes = useProfessorClasses(userId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeClass = useMemo(() => {
    const list = classes.data ?? [];
    return list.find((c) => c.id === selectedId) ?? list[0] ?? null;
  }, [classes.data, selectedId]);

  const detail = useClassDetail(activeClass?.id);

  const [newClassName, setNewClassName] = useState("");
  const [creatingClass, setCreatingClass] = useState(false);

  async function createClass(e: React.FormEvent) {
    e.preventDefault();
    if (!newClassName.trim()) return;
    setCreatingClass(true);
    const { error } = await supabase
      .from("class_groups")
      .insert({ professor_id: userId, name: newClassName.trim(), code: makeCode() });
    if (!error) {
      setNewClassName("");
      await queryClient.invalidateQueries({ queryKey: ["prof-classes", userId] });
    }
    setCreatingClass(false);
  }

  if (classes.isLoading) {
    return <p className="text-sm text-slate-soft">Loading your classes…</p>;
  }

  if ((classes.data ?? []).length === 0) {
    return (
      <section className="glass-card mx-auto max-w-xl p-8 animate-rise">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Create your first class group
        </h1>
        <p className="mt-2 text-sm text-slate-soft">
          You'll get a unique class code to share with your students.
        </p>
        <form onSubmit={createClass} className="mt-6 flex gap-3">
          <input
            className={inputCls}
            placeholder="e.g. Physics 204 — Section A"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
          />
          <button
            disabled={creatingClass}
            className="shrink-0 rounded-sm bg-ink px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-brand disabled:opacity-60"
          >
            Create
          </button>
        </form>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {/* Class switcher + new class */}
      <div className="flex flex-wrap items-center gap-3">
        {(classes.data ?? []).map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedId(c.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeClass?.id === c.id
                ? "bg-ink text-primary-foreground shadow-sm"
                : "border border-border bg-card text-slate-soft hover:border-ink hover:text-ink"
            }`}
          >
            {c.name}
          </button>
        ))}
        <form onSubmit={createClass} className="flex items-center gap-2">
          <input
            className="w-44 rounded-sm border border-border bg-card px-4 py-2 text-xs outline-none focus:border-brand"
            placeholder="New class name…"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
          />
          <button
            disabled={creatingClass || !newClassName.trim()}
            className="rounded-sm bg-ink px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-brand disabled:opacity-50"
          >
            + Class
          </button>
        </form>
      </div>

      {activeClass && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-6">
          <div className="lg:col-span-4 space-y-4">
            <CreateTaskCard
              classId={activeClass.id}
              members={detail.data?.members ?? []}
              onCreated={() =>
                queryClient.invalidateQueries({
                  queryKey: ["class-detail", activeClass.id],
                })
              }
            />
            <TaskCommandTable
              tasks={detail.data?.tasks ?? []}
              members={detail.data?.members ?? []}
              assignments={detail.data?.assignments ?? []}
              subtasks={detail.data?.subtasks ?? []}
              statuses={detail.data?.statuses ?? []}
            />
          </div>

          <div className="space-y-4 lg:col-span-2">
            <section className="glass-card p-6 animate-rise">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-soft">
                Class code
              </span>
              <p className="mt-2 font-body text-3xl font-bold tracking-[0.15em] text-brand">
                {activeClass.code}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-soft">
                Share this code — students enter it to join {activeClass.name}.
              </p>
            </section>

            <section
              className="glass-card p-6 animate-rise"
              style={{ animationDelay: "80ms" }}
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="font-display text-sm font-semibold">
                  Members
                </span>
                <span className="rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-semibold text-brand">
                  {detail.data?.members.length ?? 0} students
                </span>
              </div>
              <ul className="space-y-2">
                {(detail.data?.members ?? []).map((m) => {
                  const stalled = (detail.data?.tasks ?? []).some((t) =>
                    (detail.data?.assignments ?? []).some(
                      (a) => a.task_id === t.id && a.student_id === m.student_id,
                    ) &&
                    notStarted(
                      t.id,
                      m.student_id,
                      detail.data?.subtasks ?? [],
                      detail.data?.statuses ?? [],
                    ),
                  );
                  return (
                    <li
                      key={m.id}
                      className="glass-inset flex items-center gap-3 px-4 py-2.5"
                    >
                      <span
                        className={`size-2 shrink-0 rounded-full ${stalled ? "bg-destructive" : "bg-brand"}`}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {m.full_name}
                      </span>
                      {stalled && (
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                          Not started
                        </span>
                      )}
                    </li>
                  );
                })}
                {(detail.data?.members.length ?? 0) === 0 && (
                  <p className="text-xs text-slate-soft">
                    No students yet — share the class code.
                  </p>
                )}
              </ul>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateTaskCard({
  classId,
  members,
  onCreated,
}: {
  classId: string;
  members: { student_id: string; full_name: string }[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [weight, setWeight] = useState(10);
  const [scope, setScope] = useState<"class" | "specific">("class");
  const [picked, setPicked] = useState<string[]>([]);
  const [subtaskText, setSubtaskText] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function aiGenerate() {
    if (!title.trim()) {
      setError("Enter a task title first, then generate subtasks.");
      return;
    }
    setError(null);
    setAiBusy(true);
    const { subtasks } = await generateSubtasks({
      data: { title: title.trim(), subject: subject.trim() },
    });
    setSubtaskText(subtasks.join("\n"));
    setAiBusy(false);
  }

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const subtasks = subtaskText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8);
    if (scope === "specific" && picked.length === 0) {
      setError("Select at least one student, or assign to the whole class.");
      return;
    }
    setBusy(true);
    try {
      const { data: task, error: taskErr } = await supabase
        .from("tasks")
        .insert({
          class_id: classId,
          title: title.trim(),
          subject: subject.trim(),
          due_date: dueDate,
          weight,
          scope,
        })
        .select("id")
        .single();
      if (taskErr) throw taskErr;

      const assignees =
        scope === "class" ? members.map((m) => m.student_id) : picked;
      if (assignees.length > 0) {
        const { error: aErr } = await supabase.from("task_assignments").insert(
          assignees.map((sid) => ({ task_id: task.id, student_id: sid })),
        );
        if (aErr) throw aErr;
      }
      if (subtasks.length > 0) {
        const { error: sErr } = await supabase.from("subtasks").insert(
          subtasks.map((t, i) => ({ task_id: task.id, title: t, position: i })),
        );
        if (sErr) throw sErr;
      }
      setTitle("");
      setSubject("");
      setDueDate("");
      setWeight(10);
      setScope("class");
      setPicked([]);
      setSubtaskText("");
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish task");
    }
    setBusy(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="glass-card flex w-full items-center justify-between p-6 text-left transition hover:-translate-y-0.5 hover:shadow-md animate-rise"
      >
        <div>
          <p className="font-display text-lg font-semibold">Create new task</p>
          <p className="mt-1 text-xs text-slate-soft">
            Title, due date, weight — AI can draft the subtasks.
          </p>
        </div>
        <div className="grid size-11 shrink-0 place-items-center rounded-sm bg-ink text-xl font-bold text-primary-foreground shadow-sm">
          +
        </div>
      </button>
    );
  }

  return (
    <section className="glass-card p-6 animate-rise">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">New task</h2>
        <button
          onClick={() => setOpen(false)}
          className="text-xs font-semibold text-slate-soft hover:text-ink"
        >
          Cancel
        </button>
      </div>
      <form onSubmit={publish} className="grid grid-cols-2 gap-3">
        <label className="col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-slate-soft">
            Title
          </span>
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Gravitation field lab report"
            required
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-medium text-slate-soft">
            Subject
          </span>
          <input
            className={inputCls}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Physics"
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-medium text-slate-soft">
            Due date
          </span>
          <input
            className={inputCls}
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-medium text-slate-soft">
            Effort / marks weight
          </span>
          <input
            className={inputCls}
            type="number"
            min={1}
            max={100}
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
            required
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-medium text-slate-soft">
            Assign to
          </span>
          <select
            className={inputCls}
            value={scope}
            onChange={(e) => setScope(e.target.value as "class" | "specific")}
          >
            <option value="class">Whole class</option>
            <option value="specific">Specific students</option>
          </select>
        </label>

        {scope === "specific" && (
          <div className="col-span-2 glass-inset max-h-36 space-y-1 overflow-y-auto p-3">
            {members.map((m) => (
              <label
                key={m.student_id}
                className="flex items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={picked.includes(m.student_id)}
                  onChange={(e) =>
                    setPicked(
                      e.target.checked
                        ? [...picked, m.student_id]
                        : picked.filter((p) => p !== m.student_id),
                    )
                  }
                  className="accent-brand"
                />
                {m.full_name}
              </label>
            ))}
            {members.length === 0 && (
              <p className="text-xs text-slate-soft">
                No students have joined yet.
              </p>
            )}
          </div>
        )}

        <div className="col-span-2">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-soft">
              Subtasks (one per line)
            </span>
            <button
              type="button"
              onClick={aiGenerate}
              disabled={aiBusy}
              className="rounded-sm border border-brand/40 bg-brand/5 px-3 py-1 text-[11px] font-semibold text-brand transition hover:bg-brand/10 disabled:opacity-60"
            >
              {aiBusy ? "Generating…" : "✦ Generate with AI"}
            </button>
          </div>
          <textarea
            className={`${inputCls} min-h-24 resize-y`}
            value={subtaskText}
            onChange={(e) => setSubtaskText(e.target.value)}
            placeholder={"Derive the potential function\nPlot B vs radius\nWrite uncertainty analysis"}
          />
        </div>

        {error && (
          <p className="col-span-2 text-xs font-medium text-destructive">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="col-span-2 rounded-sm bg-ink px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-brand disabled:opacity-60"
        >
          {busy ? "Publishing…" : "Publish task"}
        </button>
      </form>
    </section>
  );
}

function TaskCommandTable({
  tasks,
  members,
  assignments,
  subtasks,
  statuses,
}: {
  tasks: Task[];
  members: { student_id: string; full_name: string }[];
  assignments: { task_id: string; student_id: string }[];
  subtasks: import("@/lib/data").Subtask[];
  statuses: import("@/lib/data").Status[];
}) {
  return (
    <section
      className="glass-card overflow-hidden p-6 animate-rise"
      style={{ animationDelay: "120ms" }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">
          Live completion
        </h2>
        <span className="text-[11px] font-medium text-slate-soft">
          {tasks.length} task{tasks.length === 1 ? "" : "s"}
        </span>
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-slate-soft">
          No tasks yet — publish your first one above.
        </p>
      ) : (
        <div className="space-y-3">
          {tasks.map((t) => {
            const assignees = assignments
              .filter((a) => a.task_id === t.id)
              .map((a) => a.student_id);
            const stalled = assignees.filter((sid) =>
              notStarted(t.id, sid, subtasks, statuses),
            );
            const avg =
              assignees.length === 0
                ? 0
                : Math.round(
                    assignees.reduce(
                      (sum, sid) =>
                        sum + completion(t.id, sid, subtasks, statuses),
                      0,
                    ) / assignees.length,
                  );
            return (
              <div key={t.id} className="glass-inset p-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`size-2 shrink-0 rounded-full ${stalled.length > 0 ? "bg-destructive" : "bg-brand"}`}
                      />
                      <p className="truncate text-sm font-semibold">
                        {t.title}
                      </p>
                    </div>
                    <p className="mt-0.5 pl-4 text-[11px] text-slate-soft">
                      Due {t.due_date} · {t.weight} marks ·{" "}
                      {t.scope === "class" ? "Whole class" : `${assignees.length} students`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full bar-fill ${stalled.length > 0 ? "bg-destructive" : "gradient-brand"}`}
                        style={{ width: `${avg}%` }}
                      />
                    </div>
                    <span className="w-10 text-right font-display text-sm font-semibold">
                      {avg}%
                    </span>
                  </div>
                </div>
                {stalled.length > 0 && (
                  <p className="mt-2 pl-4 text-[11px] font-medium text-destructive">
                    {stalled.length} student{stalled.length === 1 ? "" : "s"} not
                    started —{" "}
                    {stalled
                      .map(
                        (sid) =>
                          members.find((m) => m.student_id === sid)
                            ?.full_name ?? "Student",
                      )
                      .join(", ")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
