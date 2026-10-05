import React from "react";
import { X, Lock, Mail, User, ArrowRight, AlertCircle, Sparkles } from "lucide-react";
import { SmmUpLogo } from "./icons/ExecutiveIcons";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (userData: any) => void;
}

export default function AuthModal({ isOpen, onClose, onAuthSuccess }: AuthModalProps) {
  const [isRegister, setIsRegister] = React.useState(false);
  const [username, setUsername] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState("");

  // Keyboard: Escape dismisses the modal
  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
    const payload = isRegister
      ? { username: username.trim(), email: email.trim(), password }
      : { email: email.trim(), password };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMsg(data.error || "Authentication failed. Please verify credentials.");
      } else {
        onAuthSuccess(data.user);
        onClose();
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fadeIn"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md border border-white/10 bg-[#0A0A0A] rounded-none shadow-[0_10px_50px_rgba(0,0,0,0.8)] p-6 sm:p-8 animate-fadeInScale">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-white rounded-none hover:bg-white/[0.05] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-8">
          <SmmUpLogo size={48} className="mx-auto mb-4" />
          <h2 className="text-xl sm:text-2xl font-light tracking-[0.16em] text-white uppercase">
            {isRegister ? "Create Account" : "Sign In"}
          </h2>
          <div className="w-12 h-0.5 bg-white/20 mx-auto my-2.5" />
          <p className="text-xs text-zinc-400">
            {isRegister
              ? "Join SMM UP for automated wholesale delivery & 0% fee UPI top-up."
              : "Access your wallet balance, order history, and developer API key."}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-2">
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. aryan_smm"
                  required
                  className="w-full bg-black/60 border border-white/15 focus:border-white focus:ring-1 focus:ring-white/20 text-white pl-11 pr-4 py-3 text-sm rounded-none outline-none transition-all placeholder:text-zinc-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@domain.com"
                required
                className="w-full bg-black/60 border border-white/15 focus:border-white focus:ring-1 focus:ring-white/20 text-white pl-11 pr-4 py-3 text-sm rounded-none outline-none transition-all placeholder:text-zinc-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                minLength={6}
                className="w-full bg-black/60 border border-white/15 focus:border-white focus:ring-1 focus:ring-white/20 text-white pl-11 pr-4 py-3 text-sm rounded-none outline-none transition-all placeholder:text-zinc-500"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-none bg-white/[0.06] border border-white/15 text-zinc-100 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-zinc-100 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-6 rounded-none bg-white text-black font-bold tracking-wider text-xs uppercase hover:bg-zinc-200 transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,255,255,0.3)] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-6"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>{isRegister ? "Create Account" : "Sign In to SMM UP"}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Toggle Mode */}
        <div className="text-center mt-6 pt-5 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setErrorMsg("");
            }}
            className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            {isRegister ? (
              <span>Already have an account? <strong className="text-white underline">Sign In</strong></span>
            ) : (
              <span>Need an account? <strong className="text-white underline">Create Account</strong></span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
