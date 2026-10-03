import React from "react";
import { X, Lock, Mail, User, ArrowRight, AlertCircle } from "lucide-react";

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
        setErrorMsg(data.error || "Authentication failed.");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-md border border-white/15 bg-black rounded-sm shadow-[0_0_50px_rgba(255,255,255,0.06)] p-6 sm:p-8 font-sans">
        {/* Subtle corner brackets */}
        <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-white/40 pointer-events-none" />
        <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-white/40 pointer-events-none" />
        <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-white/40 pointer-events-none" />
        <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-white/40 pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Title */}
        <div className="text-center mb-6">
          <div className="inline-flex px-3 py-1 border border-white/20 text-[9px] tracking-[0.25em] text-gray-400 bg-white/[0.03] mb-3">
            {isRegister ? "CLIENT ONBOARDING" : "SECURE CLIENT PORTAL"}
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-[0.14em] text-white">
            {isRegister ? "CREATE ACCOUNT" : "SIGN IN"}
          </h2>
          <p className="text-[11px] text-gray-500 font-mono tracking-wider mt-1">
            SMM UP &bull; INSTITUTIONAL ACCESS
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="grid grid-cols-2 p-1 border border-white/10 bg-white/[0.02] rounded-sm mb-5 text-xs font-mono">
          <button
            type="button"
            onClick={() => {
              setIsRegister(false);
              setErrorMsg("");
            }}
            className={`py-1.5 text-center rounded-sm transition-all cursor-pointer ${
              !isRegister ? "bg-white text-black font-bold" : "text-gray-400 hover:text-white"
            }`}
          >
            LOGIN
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRegister(true);
              setErrorMsg("");
            }}
            className={`py-1.5 text-center rounded-sm transition-all cursor-pointer ${
              isRegister ? "bg-white text-black font-bold" : "text-gray-400 hover:text-white"
            }`}
          >
            REGISTER
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-[10px] tracking-[0.2em] text-gray-400 font-bold mb-1.5">
                CODENAME / USERNAME
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter codename"
                  className="w-full bg-black/60 border border-white/10 focus:border-white/40 text-white pl-9 pr-3 py-2 text-xs font-mono rounded-sm outline-none transition-all placeholder:text-gray-600"
                  required
                />
                <User className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2.5" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] tracking-[0.2em] text-gray-400 font-bold mb-1.5">
              EMAIL ADDRESS
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@domain.com"
                className="w-full bg-black/60 border border-white/10 focus:border-white/40 text-white pl-9 pr-3 py-2 text-xs font-mono rounded-sm outline-none transition-all placeholder:text-gray-600"
                required
              />
              <Mail className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2.5" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] tracking-[0.2em] text-gray-400 font-bold mb-1.5">
              PASSWORD
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-black/60 border border-white/10 focus:border-white/40 text-white pl-9 pr-3 py-2 text-xs font-mono rounded-sm outline-none transition-all placeholder:text-gray-600"
                required
              />
              <Lock className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2.5" />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-mono rounded-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-white text-black font-bold text-xs tracking-[0.2em] rounded-sm hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.3)] disabled:opacity-50 mt-2"
          >
            <span>{loading ? "AUTHENTICATING..." : isRegister ? "CREATE ACCOUNT" : "SIGN IN TO PORTAL"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
