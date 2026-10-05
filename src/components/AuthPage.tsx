import React from "react";
import { SmmUpLogo } from "./icons/ExecutiveIcons";
import { pathFor } from "../lib/routes";

interface AuthPageProps {
  initialMode: "login" | "register";
  onAuthSuccess: () => void;
}

/**
 * Full-page Authentication Terminal — replaces the legacy popup modal.
 * Route: /auth (state-synced). Sharp, monochrome, mobile-first.
 */
export default function AuthPage({ initialMode, onAuthSuccess }: AuthPageProps) {
  const [mode, setMode] = React.useState<"login" | "register">(initialMode);
  const [identifier, setIdentifier] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");

  React.useEffect(() => {
    setMode(initialMode);
    setError("");
    setSuccess("");
  }, [initialMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload =
        mode === "login"
          ? { identifier, password }
          : { username: identifier, email, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Authentication failed");
        setLoading(false);
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
            {mode === "login" ? "Welcome Back" : "Create Account"}
          </h1>
          <div className="w-12 h-px bg-white/20 mx-auto mt-4" />
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

            <div className="flex items-center rounded-none bg-black/60 p-1 border border-white/10">
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
            </div>
          </div>

          <form key={mode} onSubmit={handleSubmit} className="space-y-4 form-swap">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                {mode === "login" ? "Username or Email" : "Username"}
              </label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={mode === "login" ? "Enter username or email" : "Choose username"}
                className="up-input"
              />
            </div>

            {mode === "register" && (
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="client@domain.com"
                  className="up-input"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="up-input"
              />
            </div>

            {error && (
              <div className="p-3 rounded-none bg-white/[0.04] border border-white/15 text-zinc-200 text-xs">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 rounded-none bg-white/[0.06] border border-white/20 text-white text-xs">
                {success}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-up btn-up-solid w-full">
              {loading
                ? "Connecting..."
                : mode === "login"
                ? "Sign In"
                : "Create Free Account"}
            </button>
          </form>

          {/* Mode switch line */}
          <div className="pt-5 mt-5 border-t border-white/[0.06] text-center space-y-3">
            <p className="text-xs text-zinc-500">
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
