import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const MAX_BYTES = 200 * 1024 * 1024; // 200 MB

interface Submission {
  id: string;
  task_id: string;
  student_id: string;
  file_path: string;
  file_name: string;
  file_size: number;
  submitted_at: string;
}

function prettySize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function SubmissionBox({
  taskId,
  userId,
}: {
  taskId: string;
  userId: string;
}) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressNote, setProgressNote] = useState<string | null>(null);

  const submission = useQuery({
    queryKey: ["submission", taskId, userId],
    queryFn: async (): Promise<Submission | null> => {
      const { data, error: err } = await supabase
        .from("submissions")
        .select("*")
        .eq("task_id", taskId)
        .eq("student_id", userId)
        .limit(1);
      if (err) throw err;
      return (data?.[0] as Submission) ?? null;
    },
  });

  async function upload(file: File) {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(
        `That file is ${prettySize(file.size)}. The limit is 200 MB — please upload a smaller file.`,
      );
      return;
    }
    setBusy(true);
    setProgressNote("Uploading…");
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${taskId}/${userId}/${Date.now()}-${safeName}`;

    const previous = submission.data;
    const { error: upErr } = await supabase.storage
      .from("submissions")
      .upload(path, file, { upsert: false, contentType: file.type });

    if (upErr) {
      setError(upErr.message);
      setBusy(false);
      setProgressNote(null);
      return;
    }

    const { error: rowErr } = await supabase.from("submissions").upsert(
      {
        task_id: taskId,
        student_id: userId,
        file_path: path,
        file_name: file.name,
        file_size: file.size,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "task_id,student_id" },
    );

    if (rowErr) {
      await supabase.storage.from("submissions").remove([path]);
      setError(rowErr.message);
    } else if (previous) {
      await supabase.storage.from("submissions").remove([previous.file_path]);
    }

    if (fileRef.current) fileRef.current.value = "";
    setBusy(false);
    setProgressNote(null);
    await queryClient.invalidateQueries({
      queryKey: ["submission", taskId, userId],
    });
  }

  async function download() {
    const s = submission.data;
    if (!s) return;
    const { data, error: err } = await supabase.storage
      .from("submissions")
      .createSignedUrl(s.file_path, 60);
    if (err || !data) {
      setError("Could not open that file right now.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function remove() {
    const s = submission.data;
    if (!s) return;
    setBusy(true);
    await supabase.from("submissions").delete().eq("id", s.id);
    await supabase.storage.from("submissions").remove([s.file_path]);
    setBusy(false);
    await queryClient.invalidateQueries({
      queryKey: ["submission", taskId, userId],
    });
  }

  const s = submission.data;

  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-soft">
          Submission
        </span>
        <span className="text-[10px] text-slate-soft">Max 200 MB</span>
      </div>

      {s ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm text-ink">
            {s.file_name}
          </span>
          <span className="text-[11px] text-slate-soft">
            {prettySize(s.file_size)}
          </span>
          <button
            type="button"
            onClick={download}
            className="rounded-sm border border-border px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand"
          >
            View
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="rounded-sm bg-ink px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-brand disabled:opacity-60"
          >
            Replace
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            className="rounded-sm border border-border px-3 py-1.5 text-xs font-semibold text-destructive transition hover:border-destructive disabled:opacity-60"
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          <span className="flex-1 text-xs text-slate-soft">
            {submission.isLoading ? "Checking…" : "Nothing handed in yet."}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="rounded-sm bg-ink px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-brand disabled:opacity-60"
          >
            {busy ? "Uploading…" : "Upload file"}
          </button>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />

      {progressNote && (
        <p className="mt-2 text-[11px] text-slate-soft">{progressNote}</p>
      )}
      {error && (
        <p className="mt-2 text-[11px] font-medium text-destructive">{error}</p>
      )}
      {s && !error && (
        <p className="mt-2 text-[10px] text-slate-soft">
          Handed in {new Date(s.submitted_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}
