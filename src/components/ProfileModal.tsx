import React from "react";
import {
  User,
  X,
  Key,
  Copy,
  Check,
  LogOut,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  ExternalLink,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { formatINR, formatNumber } from "../lib/utils";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onLogout: () => void;
  onUserUpdate?: (patch: any) => void;
}

export default function ProfileModal({
  isOpen,
  onClose,
  user,
  onLogout,
  onUserUpdate,
}: ProfileModalProps) {
  const [busy, setBusy] = React.useState<"generate" | "regen" | "delete" | null>(null);
  const [revealed, setRevealed] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmRegen, setConfirmRegen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setRevealed(null);
      setError(null);
      setConfirmRegen(false);
      setConfirmDelete(false);
      setCopied(false);
    }
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const post = async (action: string, body?: any) => {
    const res = await fetch(`/api/auth/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  };

  const handleGenerate = async () => {
    setBusy("generate");
    setError(null);
    try {
      const { ok, data } = await post("generate-key");
      if (!ok) {
        setError(data.error || "Failed to generate API key");
        return;
      }
      setRevealed(data.apiKey);
      onUserUpdate?.({ hasApiKey: true, apiKeyMasked: data.apiKeyMasked });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const handleRegenerate = async () => {
    if (!confirmRegen) {
      setConfirmRegen(true);
      return;
    }
    setBusy("regen");
    setError(null);
    try {
      const { ok, data } = await post("regenerate-key", { confirm: true });
      if (!ok) {
        setError(data.error || "Failed to regenerate API key");
        setConfirmRegen(false);
        return;
      }
      setRevealed(data.apiKey);
      setConfirmRegen(false);
      onUserUpdate?.({ hasApiKey: true, apiKeyMasked: data.apiKeyMasked });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy("delete");
    setError(null);
    try {
      const { ok, data } = await post("delete-key", { confirm: true });
      if (!ok) {
        setError(data.error || "Failed to delete API key");
        setConfirmDelete(false);
        return;
      }
      setRevealed(null);
      setConfirmDelete(false);
      onUserUpdate?.({ hasApiKey: false, apiKeyMasked: null });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const handleCopy = () => {
    const val = revealed || user.apiKeyMasked;
    if (!val) return;
    navigator.clipboard.writeText(val);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayValue = revealed || user.apiKeyMasked || "";
  const isFullKey = Boolean(revealed);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
      <div className="relative w-full max-w-lg border border-white/10 bg-zinc-950/95 rounded-none shadow-[0_4px_40px_rgba(0,0,0,0.8)] p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-5 border-b border-white/[0.08] mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-none bg-white/[0.04] border border-white/10 flex items-center justify-center text-white">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold tracking-wide text-white">{user.username}</h2>
              <p className="text-xs text-zinc-400">{user.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-none hover:bg-white/[0.05] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-3 mb-6 text-center">
          <div className="p-3.5 rounded-none border border-white/[0.06] bg-black/40">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Wallet Balance</div>
            <div className="text-base font-bold text-zinc-100 mt-1">{formatINR(user.balance)}</div>
          </div>
          <div className="p-3.5 rounded-none border border-white/[0.06] bg-black/40">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Total Spent</div>
            <div className="text-base font-bold text-white mt-1">{formatINR(user.total_spent || 0)}</div>
          </div>
          <div className="p-3.5 rounded-none border border-white/[0.06] bg-black/40">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Total Orders</div>
            <div className="text-base font-bold text-white mt-1">{formatNumber(user.total_orders || 0)}</div>
          </div>
        </div>

        {/* API Key Access Section */}
        <div className="p-5 rounded-none border border-white/[0.08] bg-white/[0.015] mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <Key className="w-4 h-4 text-zinc-100" />
              <span>Reseller / Developer API Key</span>
            </span>
            <span className="text-[10px] text-zinc-100 font-semibold bg-white/[0.06] px-2 py-0.5 rounded-full">
              Standard v2
            </span>
          </div>

          {!user.hasApiKey ? (
            <>
              <p className="text-xs text-zinc-400 leading-relaxed">
                You have no API key yet. Generate one only when you actually need it &mdash; bots, panels, or automation
                scripts. It is never created automatically.
              </p>
              <button
                onClick={handleGenerate}
                disabled={busy !== null}
                className="w-full px-5 py-3 rounded-none bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {busy === "generate" ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Key className="w-3.5 h-3.5" />
                    <span>Generate API Key</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              {isFullKey ? (
                <div className="flex items-start gap-2 p-3 rounded-none border border-white/15 bg-white/[0.06] text-[11px] text-zinc-100">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    Copy this key now. For your security it is shown only once and cannot be retrieved later. Use
                    Regenerate if you lose it.
                  </span>
                </div>
              ) : (
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Your key is masked for safety. Use it via the <code className="text-zinc-100 font-mono">key</code>{" "}
                  parameter or <code className="text-zinc-100 font-mono">Authorization: Bearer</code> header.
                </p>
              )}

              <div className="flex items-center gap-2">
                <input
                  type={isFullKey ? "text" : "password"}
                  readOnly
                  value={displayValue || "—"}
                  className="flex-1 bg-black/70 border border-white/10 text-zinc-200 px-3.5 py-2.5 rounded-none text-xs outline-none font-mono"
                />
                {isFullKey && (
                  <button
                    onClick={() => setRevealed(null)}
                    title="Hide key"
                    className="px-3 py-2.5 rounded-none border border-white/10 text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-all cursor-pointer shrink-0"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={handleCopy}
                  className="px-4 py-2.5 rounded-none bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleRegenerate}
                  disabled={busy !== null}
                  className={`px-4 py-2.5 rounded-none border text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                    confirmRegen
                      ? "border-white/15 bg-white/[0.06] text-zinc-100"
                      : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.07] hover:text-white"
                  }`}
                >
                  {busy === "regen" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  <span>{confirmRegen ? "Tap to confirm revoke" : "Regenerate"}</span>
                </button>

                <button
                  onClick={handleDelete}
                  disabled={busy !== null}
                  className={`px-4 py-2.5 rounded-none border text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                    confirmDelete
                      ? "border-white/15 bg-white/[0.06] text-zinc-100"
                      : "border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100"
                  }`}
                >
                  {busy === "delete" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>{confirmDelete ? "Tap to confirm delete" : "Delete"}</span>
                </button>
              </div>

              <a
                href="/api"
                onClick={(e) => {
                  e.preventDefault();
                  window.history.pushState({}, "", "/api");
                  window.dispatchEvent(new PopStateEvent("popstate"));
                  onClose();
                }}
                className="flex items-center justify-between text-xs pt-3 border-t border-white/[0.06] text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <span>View API documentation</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </>
          )}

          {error && (
            <div className="p-3 rounded-none border border-white/15 bg-white/[0.06] text-[11px] text-zinc-100">
              {error}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-white/[0.08]">
          <div className="text-xs text-zinc-400">
            Role: <strong className="text-white capitalize">{user.role || "Standard"}</strong>
          </div>

          <button
            onClick={() => {
              onLogout();
              onClose();
            }}
            className="px-4 py-2 rounded-none border border-white/15 text-zinc-100 hover:bg-white/[0.06] text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}