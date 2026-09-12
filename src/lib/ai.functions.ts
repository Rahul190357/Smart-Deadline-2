import { createServerFn } from "@tanstack/react-start";

const FALLBACK = [
  "Read the brief and gather materials",
  "Draft the main work",
  "Review and refine",
  "Final check and submit",
];

export const generateSubtasks = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const d = data as { title?: unknown; subject?: unknown };
    if (typeof d?.title !== "string" || !d.title.trim()) {
      throw new Error("A task title is required");
    }
    return {
      title: d.title.slice(0, 200),
      subject: typeof d.subject === "string" ? d.subject.slice(0, 120) : "",
    };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { subtasks: FALLBACK };

    try {
      const res = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3.1-flash-lite",
            messages: [
              {
                role: "system",
                content:
                  "You break academic assignments into subtasks. Reply with ONLY a JSON array of 3 to 5 short action-oriented subtask strings (max 8 words each). No markdown, no commentary.",
              },
              {
                role: "user",
                content: `Assignment: "${data.title}"${data.subject ? ` (subject: ${data.subject})` : ""}`,
              },
            ],
          }),
        },
      );
      if (!res.ok) return { subtasks: FALLBACK };
      const json = await res.json();
      const text: string = json?.choices?.[0]?.message?.content ?? "";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      if (
        Array.isArray(parsed) &&
        parsed.length >= 3 &&
        parsed.every((s) => typeof s === "string")
      ) {
        return { subtasks: parsed.slice(0, 5) };
      }
      return { subtasks: FALLBACK };
    } catch {
      return { subtasks: FALLBACK };
    }
  });
