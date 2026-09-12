import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    if (mode === "signin") {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) setError(signInError.message);
    } else {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: window.location.origin,
        },
      });
      if (signUpError) setError(signUpError.message);
      else setMessage("Account created — check your email to confirm, then sign in.");
    }

    setBusy(false);
  }

  async function signInGoogle() {
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) setError(result.error.message ?? "Google sign-in failed");
  }

  function changeMode(nextMode: "signin" | "signup") {
    setMode(nextMode);
    setError(null);
    setMessage(null);
  }

  return (
    <main className="notebook-auth">
      <div className="notebook-wrap">
        <header className="notebook-header" aria-label="SmartDeadline">
          <div className="stamp-logo" aria-hidden="true">SD</div>
          <div className="notebook-wordmark">
            SmartDeadline <span>/ academic planner</span>
          </div>
        </header>

        <div className="notebook-hero">
          <section>
            <span className="notebook-tag">course deadlines, one queue</span>
            <h1>Every deadline in the class, on one bright surface.</h1>
            <p className="notebook-sub">
              “The dream begins, most of the time, with a teacher who believes in you,
              who tugs and pushes and leads you on to the next plateau, sometimes poking
              you with a sharp stick called truth.”
              <span className="notebook-quote-author">— Dan Rather</span>
            </p>

            <div className="notebook-roles">
              <article className="notebook-role-card professors">
                <h2>Professors</h2>
                <p>Create a class, share the code, spot stalled students in red.</p>
              </article>
              <article className="notebook-role-card students">
                <h2>Students</h2>
                <p>Join with a code, work the ranked queue, tick off subtasks.</p>
              </article>
            </div>
          </section>

          <section className="notebook-signin-card" aria-label="Account access">
            <div className="notebook-pin" aria-hidden="true" />
            <div className="notebook-card-label">sign-in slip</div>
            <div className="notebook-tabs" role="tablist" aria-label="Account action">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signin"}
                className={`notebook-tab ${mode === "signin" ? "active" : ""}`}
                onClick={() => changeMode("signin")}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signup"}
                className={`notebook-tab ${mode === "signup" ? "active" : ""}`}
                onClick={() => changeMode("signup")}
              >
                Create account
              </button>
            </div>

            <form onSubmit={submit}>
              {mode === "signup" && (
                <label className="notebook-field">
                  <span>Full name</span>
                  <input
                    type="text"
                    placeholder="Your name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    autoComplete="name"
                    required
                  />
                </label>
              )}
              <label className="notebook-field">
                <span>Email</span>
                <input
                  type="email"
                  placeholder="you@university.edu"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </label>
              <label className="notebook-field">
                <span>Password</span>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  minLength={6}
                  required
                />
              </label>

              {error && <p className="notebook-feedback error" role="alert">{error}</p>}
              {message && <p className="notebook-feedback success">{message}</p>}

              <button className="notebook-primary" type="submit" disabled={busy}>
                {busy ? "One moment…" : mode === "signin" ? "Sign in" : "Create account"}
              </button>
            </form>

            <div className="notebook-divider">or</div>
            <button className="notebook-secondary" type="button" onClick={signInGoogle}>
              Continue with Google
            </button>
            <p className="notebook-footnote">
              You&apos;ll pick Professor or Student after signing in.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}