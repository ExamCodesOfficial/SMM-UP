import React from "react";
import { readApiPayload } from "../lib/apiResponse";
import { AlertTriangle, Eye, Loader2, ShieldCheck } from "lucide-react";
import ContentPage from "./ContentPage";

interface Props {
  user: any;
  onNavigate: (tab: string) => void;
  onActivated: () => void;
}

export default function SupportAccessPage({ user, onNavigate, onActivated }: Props) {
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/exchange-support-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });
      const data = await readApiPayload(response);
      if (!response.ok) throw new Error(data.error || "Support Access exchange failed.");
      onActivated();
    } catch (submitError: any) {
      setError(submitError?.message || "Support Access exchange failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ContentPage
      kicker="Owner security"
      title="Support Access"
      subtitle="Exchange a five-minute one-time Telegram code for a 15-minute, read-only view of a user's website account."
      crumbs={[{ label: "Home", tab: "home" }, { label: "Support Access" }]}
      onNavigate={onNavigate}
    >
      <div className="max-w-xl mx-auto p-5 sm:p-7 border border-white/12 bg-white/[0.025] space-y-5">
        {user?.role !== "admin" ? (
          <div className="p-4 border border-white/15 bg-white/[0.04] text-xs text-zinc-300 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /> A normal owner session is required. Support users and customer sessions cannot exchange codes.</div>
        ) : (
          <>
            <div className="p-4 border border-white/10 bg-black/35 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-zinc-300 shrink-0" />
              <div><p className="text-sm font-semibold text-white">Actor and subject stay separate</p><p className="text-xs text-zinc-500 mt-1">Every page view records the owner actor, customer subject, session and timestamp. Raw passwords, API secrets and cookies are never exposed.</p></div>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <label className="block"><span className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1.5">One-time Telegram code</span><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} required pattern="SUP-(?:[A-Z0-9]{4}-){3}[A-Z0-9]{4}" maxLength={23} className="up-input font-mono uppercase" placeholder="SUP-XXXX-XXXX-XXXX-XXXX" /></label>
              {error && <div className="p-3 border border-white/15 bg-white/[0.04] text-xs text-zinc-200 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /> {error}</div>}
              <button type="submit" disabled={busy} className="btn-up btn-up-solid w-full disabled:opacity-50">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />} {busy ? "Exchanging securely…" : "Start read-only support session"}</button>
            </form>
            <ul className="text-[11px] leading-relaxed text-zinc-500 space-y-1.5">
              <li>• Code exchange expires after five minutes and succeeds once.</li>
              <li>• Website session expires after 15 minutes or can be exited early.</li>
              <li>• Spending, deposits, key changes, reviews and password changes are blocked server-side.</li>
            </ul>
          </>
        )}
      </div>
    </ContentPage>
  );
}
