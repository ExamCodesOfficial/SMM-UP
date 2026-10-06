import React from "react";
import { readApiPayload } from "../lib/apiResponse";
import { AlertTriangle, Check, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import ContentPage from "./ContentPage";

interface Props {
  onNavigate: (tab: string) => void;
  onCompleted: (user: any) => void;
}

export default function PasswordChangePage({ onNavigate, onCompleted }: Props) {
  const [context, setContext] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    fetch("/api/auth/recovery-status", { cache: "no-store" })
      .then(async (response) => ({ ok: response.ok, data: await readApiPayload(response) }))
      .then(({ ok, data }) => {
        if (!alive) return;
        if (ok && data.active) setContext(data);
        else setError(data.error || "Recovery session is invalid or expired.");
      })
      .catch(() => alive && setError("Could not verify the recovery session."))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/complete-password-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await readApiPayload(response);
      if (!response.ok) throw new Error(data.error || "Password change failed.");
      if (data.signedIn === false) {
        setSuccess(data.message || "Permanent password created. Sign in with the new password.");
        setTimeout(() => { window.location.href = "/auth"; }, 1400);
        return;
      }
      onCompleted(data.user);
    } catch (submitError: any) {
      setError(submitError?.message || "Password change failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ContentPage
      kicker="Restricted recovery"
      title="Create Permanent Password"
      subtitle="Temporary access cannot open your wallet, orders or API keys. Complete this step to restore normal account access."
      crumbs={[{ label: "Home", tab: "home" }, { label: "Password recovery" }]}
      onNavigate={onNavigate}
    >
      <div className="max-w-xl mx-auto border border-white/12 bg-white/[0.025] p-5 sm:p-7 space-y-5">
        <div className="flex items-start gap-3 p-3.5 border border-white/10 bg-black/35">
          <ShieldCheck className="w-5 h-5 text-zinc-300 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-white">Restricted password-change session</p>
            <p className="text-xs text-zinc-500 mt-1">No account data or API secrets are available until a permanent password is saved.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-zinc-500"><Loader2 className="w-4 h-4 animate-spin" /> Verifying recovery session…</div>
        ) : context ? (
          <form onSubmit={submit} className="space-y-4">
            <div className="text-xs text-zinc-400">
              Recovering <strong className="text-white">@{context.username}</strong> · {context.email}
            </div>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1.5">New permanent password</span>
              <input type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} className="up-input" />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1.5">Confirm password</span>
              <input type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="up-input" />
            </label>
            <p className="text-[11px] leading-relaxed text-zinc-500">Use 10–128 characters and at least three of: lowercase, uppercase, numbers and symbols.</p>
            {error && <div className="p-3 border border-white/15 bg-white/[0.04] text-xs text-zinc-200 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /> {error}</div>}
            {success && <div className="p-3 border border-white/20 bg-white/[0.06] text-xs text-white flex gap-2"><Check className="w-4 h-4 shrink-0" /> {success}</div>}
            <button type="submit" disabled={busy} className="btn-up btn-up-solid w-full disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              {busy ? "Saving permanent password…" : "Save password and continue"}
            </button>
            <p className="text-[10px] text-zinc-600 flex gap-1.5"><Check className="w-3 h-3 shrink-0" /> Saving invalidates the temporary password and every other recovery session immediately.</p>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="p-3 border border-white/15 bg-white/[0.04] text-xs text-zinc-200 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /> {error}</div>
            <a href="/support" className="btn-up btn-up-ghost w-full">Contact support</a>
          </div>
        )}
      </div>
    </ContentPage>
  );
}
