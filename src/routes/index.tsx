import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthScreen } from "@/components/AuthScreen";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SmartDeadline — class deadlines, ranked by urgency" },
      {
        name: "description",
        content:
          "Professors publish tasks with AI-generated subtasks; students work a queue ranked by urgency. Live completion tracking for the whole class.",
      },
      { property: "og:title", content: "SmartDeadline" },
      {
        property: "og:description",
        content:
          "Class task management with urgency-ranked student queues and live professor dashboards.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { session, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, session, navigate]);

  if (session) return null;
  return <AuthScreen />;
}
