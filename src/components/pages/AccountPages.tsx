import React from "react";
import { Key, Copy, Check, RefreshCw, ShieldCheck, User, ArrowLeft, IndianRupee } from "lucide-react";
import ContentPage, { P, H2 } from "../ContentPage";
import { formatINR } from "../../lib/utils";

interface PageProps {
  onNavigate: (tab: string) => void;
}

/* ══════════════════════ ACCOUNT ══════════════════════ */
export function AccountPage({ onNavigate, user }: PageProps & { user: any }) {
  const [copied, setCopied] = React.useState(false);
  const apiKey = user?.api_key || user?.apiKey || "";

  return (
    <ContentPage
      kicker="Account"
      title="My Account"
      subtitle="Your profile, balance and reseller API key — all in one place."
      crumbs={[{ label: "Home", tab: "home" }, { label: "Account" }]}
      onNavigate={onNavigate}
    >
      <div className="space-y-4">
        <div className="p-5 rounded-none border border-white/12 bg-white/[0.03] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-none bg-white/[0.05] border border-white/10 flex items-center justify-center text-zinc-200">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">{user?.username}</div>
              <div className="text-xs text-zinc-500">{user?.email}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Balance</div>
            <div className="text-lg font-bold text-white">{formatINR(user?.balance || 0)}</div>
          </div>
        </div>

        <div className="p-5 rounded-none border border-white/12 bg-white/[0.03]">
          <div className="flex items-center gap-2 mb-2">
            <Key className="w-4 h-4 text-zinc-400" />
            <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Reseller API Key</span>
          </div>
          {apiKey ? (
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2.5 bg-black/60 border border-white/10 text-xs font-mono text-zinc-300 truncate">
                {apiKey}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(apiKey);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                }}
                className="btn-up btn-up-ghost btn-up-sm shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
          ) : (
            <P>Your API key is available from the profile panel — open Profile from the top bar.</P>
          )}
          <p className="text-[11px] text-zinc-500 mt-2.5 flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3" />
            Leaked key? Regenerate it from the profile panel — the old key dies instantly.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <button onClick={() => onNavigate("transactions")} className="btn-up btn-up-ghost w-full justify-between">
            <span className="flex items-center gap-2"><IndianRupee className="w-4 h-4" /> Deposit history</span>
            <span>→</span>
          </button>
          <button onClick={() => onNavigate("logs")} className="btn-up btn-up-ghost w-full justify-between">
            <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Order history</span>
            <span>→</span>
          </button>
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
      subtitle="Every UPI top-up with its UTR reference and clearing status."
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
          <p className="text-xs text-zinc-600">Top up from the Wallet button; your UTR receipts will appear here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-white/10 rounded-none">
          <table className="w-full text-left text-xs">
            <thead className="bg-black/80 border-b border-white/10 text-zinc-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">UTR</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {txns.map((t: any, i: number) => (
                <tr key={i} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-zinc-400">{t.created_at ? new Date(t.created_at).toLocaleString("en-IN") : "—"}</td>
                  <td className="px-4 py-3 font-mono text-zinc-300">{t.utr || t.memo || "—"}</td>
                  <td className="px-4 py-3 text-right text-white font-semibold">{formatINR(t.amount || 0)}</td>
                  <td className="px-4 py-3 text-zinc-300">{t.status || "Credited"}</td>
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
