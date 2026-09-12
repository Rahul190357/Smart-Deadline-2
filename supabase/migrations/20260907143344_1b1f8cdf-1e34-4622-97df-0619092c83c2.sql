create type public.app_role as enum ('professor', 'student');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Authenticated users can view profiles" on public.profiles for select to authenticated using (true);
create policy "Users insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update to authenticated using (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select, insert on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Users view own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);
create policy "Users set own role" on public.user_roles for insert to authenticated with check (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.class_groups (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  code text not null unique,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.class_groups to authenticated;
grant all on public.class_groups to service_role;
alter table public.class_groups enable row level security;

create table public.class_members (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.class_groups(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (class_id, student_id)
);
grant select, insert, delete on public.class_members to authenticated;
grant all on public.class_members to service_role;
alter table public.class_members enable row level security;

create or replace function public.is_class_professor(_class_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.class_groups where id = _class_id and professor_id = auth.uid())
$$;

create or replace function public.is_class_member(_class_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.class_members where class_id = _class_id and student_id = auth.uid())
$$;

create policy "Professors manage own classes" on public.class_groups for all to authenticated
  using (professor_id = auth.uid()) with check (professor_id = auth.uid());
create policy "Signed-in users can find classes by code" on public.class_groups for select to authenticated using (true);

create policy "Students join classes themselves" on public.class_members for insert to authenticated
  with check (student_id = auth.uid());
create policy "Members and professors view membership" on public.class_members for select to authenticated
  using (student_id = auth.uid() or public.is_class_professor(class_id) or public.is_class_member(class_id));
create policy "Students leave or professor removes" on public.class_members for delete to authenticated
  using (student_id = auth.uid() or public.is_class_professor(class_id));

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.class_groups(id) on delete cascade,
  title text not null,
  subject text not null default '',
  due_date date not null,
  weight int not null default 10,
  scope text not null default 'class' check (scope in ('class', 'specific')),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.tasks to authenticated;
grant all on public.tasks to service_role;
alter table public.tasks enable row level security;
create policy "Professors manage tasks in their classes" on public.tasks for all to authenticated
  using (public.is_class_professor(class_id)) with check (public.is_class_professor(class_id));
create policy "Class members view tasks" on public.tasks for select to authenticated
  using (public.is_class_member(class_id));

create table public.task_assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (task_id, student_id)
);
grant select, insert, delete on public.task_assignments to authenticated;
grant all on public.task_assignments to service_role;
alter table public.task_assignments enable row level security;
create or replace function public.is_task_professor(_task_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tasks t where t.id = _task_id and public.is_class_professor(t.class_id))
$$;
create policy "Professors manage assignments" on public.task_assignments for insert to authenticated
  with check (public.is_task_professor(task_id));
create policy "Professors delete assignments" on public.task_assignments for delete to authenticated
  using (public.is_task_professor(task_id));
create policy "Students and professors view assignments" on public.task_assignments for select to authenticated
  using (student_id = auth.uid() or public.is_task_professor(task_id));

create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  position int not null default 0
);
grant select, insert, update, delete on public.subtasks to authenticated;
grant all on public.subtasks to service_role;
alter table public.subtasks enable row level security;
create policy "Professors manage subtasks" on public.subtasks for all to authenticated
  using (public.is_task_professor(task_id)) with check (public.is_task_professor(task_id));
create policy "Class members view subtasks" on public.subtasks for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id and public.is_class_member(t.class_id)));

create or replace function public.is_subtask_visible_to_professor(_subtask_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.subtasks s join public.tasks t on t.id = s.task_id where s.id = _subtask_id and public.is_class_professor(t.class_id))
$$;

create table public.subtask_status (
  subtask_id uuid not null references public.subtasks(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'done')),
  updated_at timestamptz not null default now(),
  primary key (subtask_id, student_id)
);
grant select, insert, update on public.subtask_status to authenticated;
grant all on public.subtask_status to service_role;
alter table public.subtask_status enable row level security;
create policy "Students manage own status" on public.subtask_status for insert to authenticated
  with check (student_id = auth.uid());
create policy "Students update own status" on public.subtask_status for update to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "Students and professors view status" on public.subtask_status for select to authenticated
  using (student_id = auth.uid() or public.is_subtask_visible_to_professor(subtask_id));