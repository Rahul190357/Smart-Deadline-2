CREATE TABLE public.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, student_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.submissions TO authenticated;
GRANT ALL ON public.submissions TO service_role;

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students manage own submissions"
ON public.submissions FOR ALL TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

CREATE POLICY "professors read class submissions"
ON public.submissions FOR SELECT TO authenticated
USING (public.is_task_professor(task_id));

CREATE POLICY "students upload own submission files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'submissions' AND (storage.foldername(name))[2] = auth.uid()::text);

CREATE POLICY "students update own submission files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'submissions' AND (storage.foldername(name))[2] = auth.uid()::text);

CREATE POLICY "students delete own submission files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'submissions' AND (storage.foldername(name))[2] = auth.uid()::text);

CREATE POLICY "students read own submission files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'submissions' AND (storage.foldername(name))[2] = auth.uid()::text);

CREATE POLICY "professors read class submission files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'submissions' AND public.is_task_professor(((storage.foldername(name))[1])::uuid));