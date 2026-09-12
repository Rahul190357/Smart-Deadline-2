revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.is_class_professor(uuid) from public, anon;
revoke execute on function public.is_class_member(uuid) from public, anon;
revoke execute on function public.is_task_professor(uuid) from public, anon;
revoke execute on function public.is_subtask_visible_to_professor(uuid) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;