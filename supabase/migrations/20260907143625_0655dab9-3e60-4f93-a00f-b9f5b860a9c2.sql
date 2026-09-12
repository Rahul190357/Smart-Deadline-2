create policy "Class members view cohort status" on public.subtask_status for select to authenticated
  using (exists (
    select 1 from public.subtasks s
    join public.tasks t on t.id = s.task_id
    where s.id = subtask_id and public.is_class_member(t.class_id)
  ));