"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Eye, EyeOff } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (!res || res.error) {
      setError("Invalid email or password");
      return;
    }

    // Middleware re-scopes store_staff to their own store on navigation.
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="jl-field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          className="jl-input"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="jl-field">
        <label htmlFor="password">Password</label>
        {/* Well-styled input with a trailing show/hide toggle. The button sits
            inside the field so the eye icon overlays the right edge. */}
        <div className="jl-input-group">
          <input
            id="password"
            className="jl-input"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ paddingRight: 48 }}
          />
          <span className="trail">
            <button
              type="button"
              className="jl-btn jl-btn--ghost jl-btn--icon jl-btn--sm"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </button>
          </span>
        </div>
      </div>

      {error ? (
        <div className="jl-alert jl-alert--red" role="alert">
          <span className="jl-chip jl-chip--solid">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </svg>
          </span>
          <div className="jl-alert__body">
            <div className="jl-alert__text">{error}</div>
          </div>
        </div>
      ) : null}

      <button
        type="submit"
        className="jl-btn jl-btn--primary jl-btn--block jl-btn--lg"
        disabled={loading}
        data-loading={loading || undefined}
      >
        {loading ? "Signing in" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--canvas)",
        fontFamily: "var(--font)",
        padding: 24,
      }}
    >
      <div className="jl-card jl-card--pad-lg" style={{ width: "100%", maxWidth: 400 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 28,
          }}
        >
          {/* Two-tone Jetline + red Fleet wordmark. */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span
              style={{
                fontSize: 26,
                fontWeight: 900,
                color: "var(--ink-900)",
                letterSpacing: "-0.03em",
                lineHeight: 1,
              }}
            >
              Jetline
            </span>
            <span
              style={{
                fontSize: 26,
                fontWeight: 900,
                color: "#fff",
                background: "var(--red-500)",
                borderRadius: 10,
                padding: "2px 10px 3px 8px",
                letterSpacing: "-0.02em",
                lineHeight: 1,
                boxShadow: "var(--sh-red)",
              }}
            >
              Fleet
            </span>
          </div>
        </div>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
