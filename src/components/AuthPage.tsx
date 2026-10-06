import React from "react";
import { Eye, EyeOff } from "lucide-react";
import { SmmUpLogo } from "./icons/ExecutiveIcons";
import { pathFor } from "../lib/routes";
import { readApiPayload } from "../lib/apiResponse";

interface AuthPageProps {
  initialMode: "login" | "register";
  onAuthSuccess: (destination?: string) => void;
  continuePath?: string | null;
}

function cleanAuthUrl(params: URLSearchParams): string {
  const next = params.get("next");
  return next && /^\/[A-Za-z0-9/_-]*$/.test(next) && !next.startsWith("//")
    ? `/auth?next=${encodeURIComponent(next)}`
    : "/auth";
}

/**
 * Full-page Authentication Terminal — replaces the legacy popup modal.
 * Route: /auth (state-synced). Sharp, monochrome, mobile-first.
 */
export default function AuthPage({ initialMode, onAuthSuccess, continuePath }: AuthPageProps) {
  const [mode, setMode] = React.useState<"login" | "register">(initialMode);
  const [identifier, setIdentifier] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [flow, setFlow] = React.useState<"auth" | "forgot" | "reset">("auth");
  const [resetToken, setResetToken] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const verificationStarted = React.useRef(false);

  React.useEffect(() => {
    setMode(initialMode);
    setError("");
    setSuccess("");
  }, [initialMode]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const passwordResetToken = params.get("reset_token") || "";
    const verificationToken = params.get("verify_token") || "";
    const sanitizedUrl = cleanAuthUrl(params);

    // Tokens are copied to component memory once, then removed from browser
    // history/address state before any network request or further rendering.
    if (passwordResetToken || verificationToken) {
      window.history.replaceState({}, "", sanitizedUrl);
    }
    if (passwordResetToken) {
      setResetToken(passwordResetToken);
      setFlow("reset");
      return;
    }
    if (!verificationToken || verificationStarted.current) return;
    verificationStarted.current = true;
    setLoading(true);
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: verificationToken }),
    })
      .then(async (res) => ({
        ok: res.ok,
        data: await readApiPayload(res, "Email confirmation is temporarily unavailable."),
      }))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || "Email confirmation failed.");
        setSuccess(data.message || "Email update confirmed.");
        if (data.signedIn) setTimeout(() => onAuthSuccess(), 700);
      })
      .catch((err) => setError(err.message || "Email confirmation failed."))
      .finally(() => setLoading(false));
  }, [onAuthSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (flow === "reset" && password !== confirmPassword) {
        setError("Passwords do not match.");
        setLoading(false);
        return;
      }
      const endpoint = flow === "forgot"
        ? "/api/auth/forgot-password"
        : flow === "reset"
          ? "/api/auth/reset-password-email"
          : mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload = flow === "forgot"
        ? { email }
        : flow === "reset"
          ? { token: resetToken, password }
          : mode === "login"
            ? { identifier, password }
            : { username: identifier, email, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readApiPayload(res, "Authentication is temporarily unavailable.");

      if (!res.ok) {
        setError(data.error || "Authentication failed");
        setLoading(false);
        return;
      }

      if (flow === "forgot") {
        setSuccess(data.message || "If the account exists, a reset email has been sent.");
        setLoading(false);
        return;
      }
      if (flow === "reset") {
        setSuccess(data.message || "Password reset complete. You can now sign in.");
        setPassword("");
        setConfirmPassword("");
        setFlow("auth");
        setMode("login");
        setLoading(false);
        return;
      }
      if (data.requiresPasswordChange) {
        setSuccess("Temporary credential accepted. Opening the required password-change step…");
        setTimeout(() => onAuthSuccess("password-change"), 350);
        return;
      }
      setSuccess(mode === "login" ? "Signed in. Redirecting…" : "Account created. Redirecting…");
      setTimeout(() => onAuthSuccess(), 450);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <section className="relative min-h-[calc(100svh-10rem)] flex items-center justify-center px-4 sm:px-6 py-10 md:py-16">
      <div className="w-full max-w-md">
        {/* Terminal header */}
        <div className="text-center mb-8 animate-hero-1">
          <span className="text-[10px] font-bold tracking-[0.25em] text-zinc-500 uppercase block mb-2 font-mono">
            Member Access
          </span>
          <h1 className="text-2xl sm:text-3xl font-light tracking-[0.10em] text-white uppercase">
            {flow === "forgot" ? "Recover Account" : flow === "reset" ? "Choose New Password" : mode === "login" ? "Welcome Back" : "Create Account"}
          </h1>
          <div className="w-12 h-px bg-white/20 mx-auto mt-4" />
          {continuePath && flow === "auth" && (
            <p className="mt-4 text-xs text-zinc-400" role="status">
              Sign in to continue to <span className="text-zinc-200 font-mono">{continuePath}</span>.
            </p>
          )}
        </div>

        {/* Card */}
        <div className="animate-hero-2 p-6 sm:p-8 rounded-none border border-white/12 bg-[#0c0c0c]/90 backdrop-blur-2xl shadow-[0_10px_50px_rgba(0,0,0,0.8)]">
          {/* Card header: brand + segmented mode switch */}
          <div className="flex items-center justify-between pb-5 border-b border-white/[0.08] mb-6">
            <div className="flex items-center gap-2.5">
              <SmmUpLogo size={30} />
              <span className="text-xs font-light tracking-[0.3em] text-white uppercase">
                SMM UP
              </span>
            </div>

            {flow === "auth" && <div className="flex items-center rounded-none bg-black/60 p-1 border border-white/10">
              <button
                type="button"
                onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
                className={`px-3 py-1.5 rounded-none text-xs font-semibold tracking-wider transition-all cursor-pointer ${
                  mode === "login" ? "bg-white text-black" : "text-zinc-400 hover:text-white"
                }`}
              >
                SIGN IN
              </button>
              <button
                type="button"
                onClick={() => { setMode("register"); setError(""); setSuccess(""); }}
                className={`px-3 py-1.5 rounded-none text-xs font-semibold tracking-wider transition-all cursor-pointer ${
                  mode === "register" ? "bg-white text-black" : "text-zinc-400 hover:text-white"
                }`}
              >
                SIGN UP
              </button>
            </div>}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 form-swap">
            {flow === "auth" && <div>
              <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                {mode === "login" ? "Username or Email" : "Username"}
              </label>
              <input
                type="text"
                required
                autoComplete={mode === "login" ? "username" : "username"}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={mode === "login" ? "Enter username or email" : "Choose username"}
                className="up-input"
              />
            </div>}

            {(flow === "forgot" || (flow === "auth" && mode === "register")) && (
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="client@domain.com"
                  className="up-input"
                />
              </div>
            )}

            {flow !== "forgot" && <div>
              <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                {flow === "reset" ? "New Password" : "Password"}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete={mode === "login" && flow === "auth" ? "current-password" : "new-password"}
                  minLength={mode === "register" || flow === "reset" ? 10 : undefined}
                  maxLength={mode === "register" || flow === "reset" ? 128 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="up-input pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute inset-y-0 right-0 min-w-11 flex items-center justify-center text-zinc-500 hover:text-white"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {(mode === "register" || flow === "reset") && (
                <p className="text-[10px] text-zinc-600 mt-1.5">10–128 characters; use at least three of lowercase, uppercase, numbers and symbols.</p>
              )}
            </div>}

            {flow === "reset" && (
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    minLength={10}
                    maxLength={128}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="up-input pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((visible) => !visible)}
                    className="absolute inset-y-0 right-0 min-w-11 flex items-center justify-center text-zinc-500 hover:text-white"
                    aria-label={showConfirmPassword ? "Hide password confirmation" : "Show password confirmation"}
                    aria-pressed={showConfirmPassword}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div role="alert" className="p-3 rounded-none bg-red-950/30 border border-red-400/30 text-red-100 text-xs">
                {error}
              </div>
            )}

            {success && (
              <div role="status" aria-live="polite" className="p-3 rounded-none bg-emerald-950/25 border border-emerald-400/25 text-emerald-100 text-xs">
                {success}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-up btn-up-solid w-full">
              {loading
                ? "Connecting..."
                : flow === "forgot"
                  ? "Send Reset Link"
                  : flow === "reset"
                    ? "Set New Password"
                    : mode === "login"
                      ? "Sign In"
                      : "Create Free Account"}
            </button>
          </form>

          {/* Mode switch line */}
          <div className="pt-5 mt-5 border-t border-white/[0.06] text-center space-y-3">
            {flow === "auth" && <><p className="text-xs text-zinc-500">
              {mode === "login" ? (
                <>
                  New here?{" "}
                  <button
                    type="button"
                    onClick={() => { setMode("register"); setError(""); }}
                    className="text-white underline underline-offset-4 hover:text-zinc-300 transition-colors cursor-pointer"
                  >
                    Create one — free
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => { setMode("login"); setError(""); }}
                    className="text-white underline underline-offset-4 hover:text-zinc-300 transition-colors cursor-pointer"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
            {mode === "login" && (
              <p className="text-xs text-zinc-500">
                Forgot your password?{" "}
                <button type="button" onClick={() => { setFlow("forgot"); setEmail(""); setError(""); setSuccess(""); }} className="text-white underline underline-offset-4 hover:text-zinc-300">Reset by email</button>
              </p>
            )}</>}
            {flow !== "auth" && (
              <p className="text-xs text-zinc-500">
                <button type="button" onClick={() => { setFlow("auth"); setMode("login"); setError(""); setSuccess(""); }} className="text-white underline underline-offset-4 hover:text-zinc-300">Back to sign in</button>
              </p>
            )}
            <p className="text-[11px] text-zinc-600">
              100% Free &bull; No social media passwords ever needed.{" "}
              <a
                href={pathFor("terms")}
                className="underline underline-offset-4 hover:text-zinc-400 transition-colors cursor-pointer"
              >
                Service Terms
              </a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
