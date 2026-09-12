import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Role = "professor" | "student";

export interface ClassGroup {
  id: string;
  professor_id: string;
  name: string;
  code: string;
}
export interface Member {
  id: string;
  class_id: string;
  student_id: string;
  full_name: string;
}
export interface Task {
  id: string;
  class_id: string;
  title: string;
  subject: string;
  due_date: string;
  weight: number;
  scope: "class" | "specific";
  created_at: string;
}
export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  position: number;
}
export interface Status {
  subtask_id: string;
  student_id: string;
  status: "not_started" | "in_progress" | "done";
}

export function daysLeft(dueDate: string) {
  const due = new Date(dueDate + "T23:59:59");
  return Math.ceil((due.getTime() - Date.now()) / 86400000);
}

export function urgencyScore(task: Task) {
  const d = daysLeft(task.due_date);
  const score = task.weight * 1.5 + Math.max(0, 10 - d) * 8 + (d < 0 ? 30 : 0);
  return Math.max(1, Math.min(99, Math.round(score)));
}

export function useRole(userId: string | undefined) {
  return useQuery({
    queryKey: ["role", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Role | null> => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!)
        .limit(1);
      if (error) throw error;
      return (data[0]?.role as Role) ?? null;
    },
  });
}

export function useProfessorClasses(userId: string | undefined) {
  return useQuery({
    queryKey: ["prof-classes", userId],
    enabled: !!userId,
    queryFn: async (): Promise<ClassGroup[]> => {
      const { data, error } = await supabase
        .from("class_groups")
        .select("id, professor_id, name, code")
        .eq("professor_id", userId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useStudentClasses(userId: string | undefined) {
  return useQuery({
    queryKey: ["student-classes", userId],
    enabled: !!userId,
    queryFn: async (): Promise<ClassGroup[]> => {
      const { data, error } = await supabase
        .from("class_members")
        .select("class_id, class_groups(id, professor_id, name, code)")
        .eq("student_id", userId!);
      if (error) throw error;
      return (data ?? [])
        .map((m) => m.class_groups as unknown as ClassGroup)
        .filter(Boolean);
    },
  });
}

/** Everything a professor needs for one class. */
export function useClassDetail(classId: string | undefined) {
  return useQuery({
    queryKey: ["class-detail", classId],
    enabled: !!classId,
    queryFn: async () => {
      const [members, tasks, assignments, subtasks, statuses] =
        await Promise.all([
          supabase
            .from("class_members")
            .select("id, class_id, student_id, profiles(full_name)")
            .eq("class_id", classId!),
          supabase
            .from("tasks")
            .select("*")
            .eq("class_id", classId!)
            .order("due_date", { ascending: true }),
          supabase
            .from("task_assignments")
            .select("task_id, student_id")
            .in(
              "task_id",
              (
                await supabase
                  .from("tasks")
                  .select("id")
                  .eq("class_id", classId!)
              ).data?.map((t) => t.id) ?? ["none"],
            ),
          supabase
            .from("subtasks")
            .select("*")
            .in(
              "task_id",
              (
                await supabase
                  .from("tasks")
                  .select("id")
                  .eq("class_id", classId!)
              ).data?.map((t) => t.id) ?? ["none"],
            )
            .order("position"),
          supabase
            .from("subtask_status")
            .select("subtask_id, student_id, status")
            .in(
              "subtask_id",
              (
                await supabase
                  .from("subtasks")
                  .select("id, tasks!inner(class_id)")
                  .eq("tasks.class_id", classId!)
              ).data?.map((s) => s.id) ?? ["none"],
            ),
        ]);
      if (members.error) throw members.error;
      if (tasks.error) throw tasks.error;
      return {
        members: (members.data ?? []).map((m) => ({
          id: m.id,
          class_id: m.class_id,
          student_id: m.student_id,
          full_name:
            (m.profiles as unknown as { full_name: string } | null)
              ?.full_name ?? "Student",
        })) as Member[],
        tasks: (tasks.data ?? []) as Task[],
        assignments: (assignments.data ?? []) as {
          task_id: string;
          student_id: string;
        }[],
        subtasks: (subtasks.data ?? []) as Subtask[],
        statuses: (statuses.data ?? []) as Status[],
      };
    },
  });
}

/** Everything a student needs across their classes. */
export function useStudentData(userId: string | undefined, classIds: string[]) {
  const key = classIds.slice().sort().join(",");
  return useQuery({
    queryKey: ["student-data", userId, key],
    enabled: !!userId && classIds.length > 0,
    queryFn: async () => {
      const { data: tasks, error } = await supabase
        .from("tasks")
        .select("*")
        .in("class_id", classIds)
        .order("due_date", { ascending: true });
      if (error) throw error;
      const taskIds = (tasks ?? []).map((t) => t.id);
      if (taskIds.length === 0) {
        return {
          tasks: [] as Task[],
          assignments: [],
          subtasks: [] as Subtask[],
          statuses: [] as Status[],
        };
      }
      const [assignments, subtasks, statuses] = await Promise.all([
        supabase
          .from("task_assignments")
          .select("task_id, student_id")
          .in("task_id", taskIds),
        supabase
          .from("subtasks")
          .select("*")
          .in("task_id", taskIds)
          .order("position"),
        supabase
          .from("subtask_status")
          .select("subtask_id, student_id, status")
          .in(
            "subtask_id",
            (
              await supabase
                .from("subtasks")
                .select("id")
                .in("task_id", taskIds)
            ).data?.map((s) => s.id) ?? ["none"],
          ),
      ]);
      return {
        tasks: (tasks ?? []) as Task[],
        assignments: (assignments.data ?? []) as {
          task_id: string;
          student_id: string;
        }[],
        subtasks: (subtasks.data ?? []) as Subtask[],
        statuses: (statuses.data ?? []) as Status[],
      };
    },
  });
}

export async function setSubtaskStatus(
  subtaskId: string,
  studentId: string,
  status: Status["status"],
) {
  const { error } = await supabase
    .from("subtask_status")
    .upsert(
      { subtask_id: subtaskId, student_id: studentId, status },
      { onConflict: "subtask_id,student_id" },
    );
  if (error) throw error;
}

/** completion % of one task for one student */
export function completion(
  taskId: string,
  studentId: string,
  subtasks: Subtask[],
  statuses: Status[],
) {
  const subs = subtasks.filter((s) => s.task_id === taskId);
  if (subs.length === 0) return 0;
  const done = subs.filter((s) =>
    statuses.some(
      (st) =>
        st.subtask_id === s.id &&
        st.student_id === studentId &&
        st.status === "done",
    ),
  ).length;
  return Math.round((done / subs.length) * 100);
}

/** true when the student has not marked anything in progress or done */
export function notStarted(
  taskId: string,
  studentId: string,
  subtasks: Subtask[],
  statuses: Status[],
) {
  const subs = subtasks.filter((s) => s.task_id === taskId);
  return !subs.some((s) =>
    statuses.some(
      (st) =>
        st.subtask_id === s.id &&
        st.student_id === studentId &&
        st.status !== "not_started",
    ),
  );
}
