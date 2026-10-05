import React from "react";
import {
  Key,
  Copy,
  Check,
  RefreshCw,
  ShieldCheck,
  User,
  ArrowLeft,
  IndianRupee,
  LogOut,
  EyeOff,
  Trash2,
  ExternalLink,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import ContentPage from "../ContentPage";
import { formatINR, formatNumber } from "../../lib/utils";

interface PageProps {
  onNavigate: (tab: string) => void;
}

/* ══════════════════════ ACCOUNT ══════════════════════ */
interface AccountPageProps extends PageProps {
  user: any;
  onLogout: () => void;
  onUserUpdate?: (patch: any) => void;
}

export function AccountPage({
  onNavigate,
  user,
  onLogout,
  onUserUpdate,
}: AccountPageProps) {
  const [busy, setBusy] = React.useState<"generate" | "regen" | "delete" | null>(null);
  const [revealed, setRevealed] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [confirmRegen, setConfirmRegen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [keyMeta, setKeyMeta] = React.useState<{ createdAt?: string; lastUsedAt?: string } | null>(null);

  React.useEffect(() => {
    if (!user?.hasApiKey) {
      setKeyMeta(null);
      return;
    }
    let alive = true;
    fetch("/api/auth/reveal-key", { cache: "no-store" })
      .then(async (res) => ({ ok: res.ok, data: await res.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (alive && ok) {
          setKeyMeta({ createdAt: data.createdAt, lastUsedAt: data.lastUsedAt });
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [user?.hasApiKey]);

  const post = async (action: string, body?: Record<string, unknown>) => {
    const res = await fetch(`/api/auth/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  };

  const resetMessages = () => {
    setError("");
    setSuccess("");
  };

  const handleGenerate = async () => {
    setBusy("generate");
    resetMessages();
    try {
      const { ok, data } = await post("generate-key");
      if (!ok) {
        setError(data.error || "Failed to generate API key.");
        return;
      }
      setRevealed(data.apiKey);
      setSuccess("API key generated. Copy it now; the full value is shown only once.");
      setKeyMeta({ createdAt: new Date().toISOString(), lastUsedAt: undefined });
      onUserUpdate?.({ hasApiKey: true, apiKeyMasked: data.apiKeyMasked, apiKeyCreatedAt: new Date().toISOString() });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const handleRegenerate = async () => {
    if (!confirmRegen) {
      setConfirmRegen(true);
      setConfirmDelete(false);
      resetMessages();
      return;
    }
    setBusy("regen");
    resetMessages();
    try {
      const { ok, data } = await post("regenerate-key", { confirm: true });
      if (!ok) {
        setError(data.error || "Failed to regenerate API key.");
        setConfirmRegen(false);
        return;
      }
      setRevealed(data.apiKey);
      setConfirmRegen(false);
      setSuccess("Old API key revoked. Copy the new key now; it is shown only once.");
      setKeyMeta({ createdAt: new Date().toISOString(), lastUsedAt: undefined });
      onUserUpdate?.({ hasApiKey: true, apiKeyMasked: data.apiKeyMasked, apiKeyCreatedAt: new Date().toISOString() });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setConfirmRegen(false);
      resetMessages();
      return;
    }
    setBusy("delete");
    resetMessages();
    try {
      const { ok, data } = await post("delete-key", { confirm: true });
      if (!ok) {
        setError(data.error || "Failed to delete API key.");
        setConfirmDelete(false);
        return;
      }
      setRevealed(null);
      setKeyMeta(null);
      setConfirmDelete(false);
      setSuccess("API key deleted and access revoked.");
      onUserUpdate?.({ hasApiKey: false, apiKeyMasked: null, apiKeyCreatedAt: null });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const handleCopy = async () => {
    if (!revealed) return;
    await navigator.clipboard.writeText(revealed);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const formatDate = (value?: string | null) => {
    if (!value) return "Never";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString("en-IN");
  };

  const createdAt = keyMeta?.createdAt || user?.apiKeyCreatedAt;

  return (
    <ContentPage
      kicker="Account"
      title="My Account"
      subtitle="Identity, wallet activity, developer access and account security in one permanent workspace."
      crumbs={[{ label: "Home", tab: "home" }, { label: "Account" }]}
      onNavigate={onNavigate}
      wide
    >
      <div className="space-y-6">
        <section className="grid lg:grid-cols-[1fr_auto] gap-5 items-center p-5 sm:p-6 border border-white/12 bg-white/[0.025]">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 border border-white/10 bg-white/[0.04] flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-zinc-200" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 block mb-1">Signed-in account</span>
              <h2 className="text-lg font-semibold text-white truncate">@{user?.username}</h2>
              <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 lg:justify-end">
            <span className="px-2.5 py-1 border border-white/10 bg-black/40 text-[10px] uppercase tracking-wider text-zinc-300">
              {user?.role || "user"}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full bg-white" /> Active session
            </span>
          </div>
        </section>

        <section className="grid sm:grid-cols-3 gap-3">
          <div className="p-4 border border-white/[0.08] bg-black/35">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Wallet balance</span>
            <span className="text-xl font-semibold text-white">{formatINR(user?.balance || 0)}</span>
          </div>
          <div className="p-4 border border-white/[0.08] bg-black/35">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Total spent</span>
            <span className="text-xl font-semibold text-white">{formatINR(user?.total_spent || 0)}</span>
          </div>
          <div className="p-4 border border-white/[0.08] bg-black/35">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Orders placed</span>
            <span className="text-xl font-semibold text-white">{formatNumber(user?.total_orders || 0)}</span>
          </div>
        </section>

        <section className="grid sm:grid-cols-3 gap-3">
          <a href="/add-funds" className="btn-up btn-up-solid w-full justify-between">
            <span className="flex items-center gap-2"><IndianRupee className="w-4 h-4" /> Add funds</span>
            <span>→</span>
          </a>
          <a href="/transactions" className="btn-up btn-up-ghost w-full justify-between">
            <span className="flex items-center gap-2"><IndianRupee className="w-4 h-4" /> Deposit history</span>
            <span>→</span>
          </a>
          <a href="/logs" className="btn-up btn-up-ghost w-full justify-between">
            <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Order history</span>
            <span>→</span>
          </a>
        </section>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
          <section className="p-5 sm:p-6 border border-white/12 bg-white/[0.02] space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-white/[0.08]">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Key className="w-4 h-4" /> Reseller API key
                </div>
                <p className="text-xs text-zinc-500 mt-1">Standard SMM v2 access for your own panel or automation.</p>
              </div>
              <span className={`text-[10px] px-2.5 py-1 border ${user?.hasApiKey ? "border-white/15 text-zinc-200" : "border-white/[0.08] text-zinc-500"}`}>
                {user?.hasApiKey ? "ACTIVE" : "NOT GENERATED"}
              </span>
            </div>

            {!user?.hasApiKey ? (
              <div className="space-y-4">
                <p className="text-xs leading-relaxed text-zinc-400">
                  Generate a key only when needed. Its full value is displayed once; afterward SMM UP stores and displays only a masked reference.
                </p>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={busy !== null}
                  className="btn-up btn-up-solid w-full sm:w-auto disabled:opacity-50"
                >
                  {busy === "generate" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                  <span>{busy === "generate" ? "Generating…" : "Generate API key"}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {revealed ? (
                  <div className="p-3.5 border border-white/15 bg-white/[0.05] text-xs text-zinc-200 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Copy this key now. The full value cannot be retrieved after you leave or hide it.</span>
                  </div>
                ) : (
                  <p className="text-xs leading-relaxed text-zinc-400">
                    The existing key is masked. If the original was lost, regenerate it; the previous key will stop working immediately.
                  </p>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  <code className="flex-1 px-3.5 py-3 bg-black/60 border border-white/10 text-xs font-mono text-zinc-300 break-all">
                    {revealed || user?.apiKeyMasked || "••••••••••••••••"}
                  </code>
                  {revealed && (
                    <>
                      <button type="button" onClick={handleCopy} className="btn-up btn-up-solid btn-up-sm shrink-0">
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copied ? "Copied" : "Copy key"}</span>
                      </button>
                      <button type="button" onClick={() => setRevealed(null)} className="btn-up btn-up-ghost btn-up-sm shrink-0">
                        <EyeOff className="w-3.5 h-3.5" /> Hide
                      </button>
                    </>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-3 text-[11px]">
                  <div className="p-3 border border-white/[0.07] bg-black/30">
                    <span className="text-zinc-500 block mb-1">Created</span>
                    <span className="text-zinc-300">{formatDate(createdAt)}</span>
                  </div>
                  <div className="p-3 border border-white/[0.07] bg-black/30">
                    <span className="text-zinc-500 block mb-1">Last used</span>
                    <span className="text-zinc-300">{formatDate(keyMeta?.lastUsedAt)}</span>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleRegenerate}
                    disabled={busy !== null}
                    className={`btn-up btn-up-ghost w-full disabled:opacity-50 ${confirmRegen ? "border-white/30 bg-white/[0.07]" : ""}`}
                  >
                    {busy === "regen" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    <span>{confirmRegen ? "Confirm: revoke old key" : "Regenerate key"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={busy !== null}
                    className={`btn-up btn-up-ghost w-full disabled:opacity-50 ${confirmDelete ? "border-white/30 bg-white/[0.07]" : ""}`}
                  >
                    {busy === "delete" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    <span>{confirmDelete ? "Confirm: delete key" : "Delete key"}</span>
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3.5 border border-white/15 bg-white/[0.05] text-xs text-zinc-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
              </div>
            )}
            {success && (
              <div className="p-3.5 border border-white/15 bg-white/[0.05] text-xs text-zinc-200 flex items-start gap-2">
                <Check className="w-4 h-4 shrink-0 mt-0.5" /> {success}
              </div>
            )}

            <a href="/api" className="inline-flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white underline underline-offset-4">
              Open API documentation <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </section>

          <aside className="p-5 border border-white/12 bg-white/[0.02] space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldCheck className="w-4 h-4" /> Account security
            </div>
            <ul className="space-y-3 text-xs leading-relaxed text-zinc-400">
              <li className="flex gap-2"><Check className="w-3.5 h-3.5 text-zinc-300 shrink-0 mt-0.5" /> Password is never displayed or returned by the API.</li>
              <li className="flex gap-2"><Check className="w-3.5 h-3.5 text-zinc-300 shrink-0 mt-0.5" /> API keys can be revoked instantly from this page.</li>
              <li className="flex gap-2"><Check className="w-3.5 h-3.5 text-zinc-300 shrink-0 mt-0.5" /> SMM UP never asks for a social-media password, OTP or UPI PIN.</li>
            </ul>
            <p className="text-[10px] text-zinc-600 border-t border-white/[0.07] pt-3">
              Device/session management is not shown until server-side revocable sessions are implemented.
            </p>
            <button type="button" onClick={onLogout} className="btn-up btn-up-ghost w-full">
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </aside>
        </div>
      </div>
    </ContentPage>
  );
}

/* ══════════════════════ TRANSACTIONS ══════════════════════ */
export function TransactionsPage({ onNavigate, user }: PageProps & { user: any }) {
  const [txns, setTxns] = React.useState<any[] | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/payments/history");
        const data = await res.json();
        if (!alive) return;
        if (res.ok && Array.isArray(data.transactions)) setTxns(data.transactions);
        else setTxns([]);
      } catch {
        if (alive) setError("Couldn't load transactions right now.");
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <ContentPage
      kicker="Account"
      title="Deposit History"
      subtitle="Every Direct UPI and Razorpay wallet deposit with its reference and settlement status."
      crumbs={[{ label: "Home", tab: "home" }, { label: "Account", tab: "account" }, { label: "Transactions" }]}
      onNavigate={onNavigate}
      wide
    >
      {error && <div className="p-3 rounded-none bg-white/[0.04] border border-white/15 text-zinc-200 text-xs mb-4">{error}</div>}
      {txns === null ? (
        <div className="space-y-3">{[0,1,2].map(i => <div key={i} className="skeleton h-14 rounded-none" />)}</div>
      ) : txns.length === 0 ? (
        <div className="p-10 text-center border border-white/10 rounded-none">
          <p className="text-sm text-zinc-400 mb-1">No deposits yet{user ? "" : " — or you're not signed in"}.</p>
          <p className="text-xs text-zinc-600 mb-5">Direct UPI and Razorpay payment records will appear here.</p>
          <a href="/add-funds" className="btn-up btn-up-solid btn-up-sm">Add funds</a>
        </div>
      ) : (
        <div className="overflow-x-auto border border-white/10 rounded-none">
          <table className="w-full text-left text-xs">
            <thead className="bg-black/80 border-b border-white/10 text-zinc-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Method / Reference</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {txns.map((t: any, i: number) => (
                <tr key={i} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-zinc-400">{t.createdAt || t.created_at ? new Date(t.createdAt || t.created_at).toLocaleString("en-IN") : "—"}</td>
                  <td className="px-4 py-3 text-zinc-300">
                    <span className="block text-[10px] uppercase tracking-wider text-zinc-500">{t.method === "RAZORPAY" ? "Razorpay" : "Direct UPI"}</span>
                    <span className="font-mono">{t.utr || t.transactionId || t.memo || "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-white font-semibold">{formatINR(t.amount || 0)}</td>
                  <td className="px-4 py-3 text-zinc-300">{t.status === "paid" ? "Completed" : t.status === "test_paid" ? "Test verified" : t.status || "Pending"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ContentPage>
  );
}

/* ══════════════════════ 404 ══════════════════════ */
export function NotFoundPage({ onNavigate }: PageProps) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-[96px] sm:text-[140px] leading-none font-light font-mono text-white/[0.06] select-none">404</div>
        <h1 className="text-xl sm:text-2xl font-light tracking-[0.12em] text-white uppercase -mt-6 mb-4">
          Page not found
        </h1>
        <p className="text-sm text-zinc-500 max-w-sm mx-auto mb-8">
          This link doesn't lead anywhere on SMM UP — it may have moved, or never existed.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button onClick={() => onNavigate("home")} className="btn-up btn-up-solid">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to home</span>
          </button>
          <button onClick={() => onNavigate("catalog")} className="btn-up btn-up-ghost">
            <span>Browse services</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════ HTML SITEMAP ══════════════════════ */
export function SitemapPage({ onNavigate }: PageProps) {
  const groups: { title: string; links: { path: string; label: string }[] }[] = [
    {
      title: "Main",
      links: [
        { path: "/", label: "Home" },
        { path: "/order", label: "Place an Order" },
        { path: "/catalog", label: "Services & Prices" },
        { path: "/mass", label: "Mass Order" },
        { path: "/logs", label: "Order History" },
        { path: "/auth", label: "Sign In / Create Account" },
        { path: "/account", label: "My Account" },
        { path: "/add-funds", label: "Add Funds" },
        { path: "/transactions", label: "Deposit History" },
      ],
    },
    {
      title: "Platforms",
      links: [
        { path: "/telegram-smm-panel", label: "Telegram SMM Panel" },
        { path: "/instagram-smm-panel", label: "Instagram SMM Panel" },
        { path: "/youtube-smm-panel", label: "YouTube SMM Panel" },
        { path: "/twitter-smm-panel", label: "Twitter / X SMM Panel" },
        { path: "/tiktok-smm-panel", label: "TikTok SMM Panel" },
        { path: "/spotify-smm-panel", label: "Spotify SMM Panel" },
      ],
    },
    {
      title: "Developers",
      links: [
        { path: "/api", label: "API Documentation" },
        { path: "/playground", label: "API Playground" },
      ],
    },
    {
      title: "Help & Company",
      links: [
        { path: "/faq", label: "FAQ" },
        { path: "/support", label: "Support & Contact" },
        { path: "/about", label: "About" },
        { path: "/responsible-growth", label: "Responsible Growth & Service Quality" },
        { path: "/review", label: "Leave a Review" },
        { path: "/status", label: "System Status" },
        { path: "/changelog", label: "Changelog" },
        { path: "/press", label: "Press & Brand Kit" },
      ],
    },
    {
      title: "Legal & Trust",
      links: [
        { path: "/terms", label: "Terms of Service" },
        { path: "/privacy", label: "Privacy Policy" },
        { path: "/refunds", label: "Refund & Cancellation" },
        { path: "/acceptable-use", label: "Acceptable Use" },
        { path: "/cookie-policy", label: "Cookie Policy" },
        { path: "/security", label: "Security" },
        { path: "/abuse", label: "Report Abuse" },
      ],
    },
  ];
  return (
    <ContentPage
      kicker="Index"
      title="Sitemap"
      subtitle="Every page on SMM UP, organized."
      crumbs={[{ label: "Home", tab: "home" }, { label: "Sitemap" }]}
      onNavigate={onNavigate}
      wide
    >
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {groups.map((g) => (
          <div key={g.title}>
            <h3 className="text-xs font-bold tracking-[0.2em] text-white uppercase mb-3 pb-2 border-b border-white/10">
              {g.title}
            </h3>
            <ul className="space-y-2">
              {g.links.map((l) => (
                <li key={l.path}>
                  <a
                    href={l.path}
                    className="text-sm text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </ContentPage>
  );
}
