import React from "react";
import { Play, AlertTriangle, RotateCcw } from "lucide-react";
import ContentPage, { P, H2, Callout } from "./ContentPage";

interface ApiPlaygroundProps {
  onNavigate: (tab: string) => void;
  user: any;
}

const ACTIONS: { id: string; label: string; fields: { id: string; label: string; placeholder: string; type?: string }[]; danger?: boolean }[] = [
  { id: "balance", label: "balance — wallet balance", fields: [] },
  { id: "services", label: "services — full catalog list", fields: [] },
  {
    id: "add",
    label: "add — place an order (spends balance!)",
    danger: true,
    fields: [
      { id: "service", label: "Service ID", placeholder: "e.g. 5641" },
      { id: "link", label: "Target link", placeholder: "https://t.me/yourchannel" },
      { id: "quantity", label: "Quantity", placeholder: "1000" },
    ],
  },
  {
    id: "status",
    label: "status — order status (single or comma-separated IDs)",
    fields: [{ id: "order", label: "Order ID(s)", placeholder: "22001 or 22001,22002" }],
  },
  {
    id: "refill",
    label: "refill — request refill for an order",
    fields: [{ id: "order", label: "Order ID", placeholder: "22001" }],
  },
  {
    id: "refill_status",
    label: "refill_status — check a refill request",
    fields: [{ id: "refill", label: "Refill ID", placeholder: "99120" }],
  },
  {
    id: "cancel",
    label: "cancel — cancel a running order",
    danger: true,
    fields: [{ id: "order", label: "Order ID(s)", placeholder: "22001 or 22001,22002" }],
  },
];

export default function ApiPlayground({ onNavigate, user }: ApiPlaygroundProps) {
  const apiKey = user?.api_key || user?.apiKey || "";
  const [key, setKey] = React.useState(apiKey);
  const [action, setAction] = React.useState("balance");
  const [params, setParams] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<string>("// Run an action to see the live JSON response here.");
  const [ok, setOk] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (apiKey && !key) setKey(apiKey);
  }, [apiKey]);

  const current = ACTIONS.find((a) => a.id === action)!;

  const run = async () => {
    setLoading(true);
    setResult("");
    setOk(null);
    try {
      const body: Record<string, string> = { key: key.trim(), action };
      current.fields.forEach((f) => {
        const v = (params[f.id] || "").trim();
        if (v) body[f.id] = v;
      });
      const res = await fetch("/api/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({ error: "Non-JSON response", status: res.status }));
      setOk(res.ok && !data.error);
      const text = JSON.stringify(data, null, 2);
      setResult(text.length > 12000 ? text.slice(0, 12000) + "\n// … trimmed — large payload (services list is long)" : text);
    } catch (e: any) {
      setOk(false);
      setResult(JSON.stringify({ error: "Network error", detail: String(e?.message || e) }, null, 2));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ContentPage
      kicker="Developers"
      title="API Playground"
      subtitle="Run live calls against your account from the browser — no Postman needed."
      crumbs={[{ label: "Home", tab: "home" }, { label: "Developers" }, { label: "API Playground" }]}
      onNavigate={onNavigate}
      wide
    >
      {!user && (
        <Callout>
          You're browsing as a guest. Calls need your API key —{" "}
          <button onClick={() => onNavigate("auth")} className="text-white underline underline-offset-4 hover:text-zinc-300 cursor-pointer">
            sign in
          </button>{" "}
          and we'll pre-fill it from your account.
        </Callout>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Request panel */}
        <div className="p-5 sm:p-6 rounded-none border border-white/12 bg-white/[0.02] space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
              API Key
            </label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Your SMM UP API key"
              className="up-input font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
              Action
            </label>
            <div className="space-y-1.5">
              {ACTIONS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => { setAction(a.id); setParams({}); }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-none border text-xs font-mono transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    action === a.id
                      ? "bg-white text-black border-white font-bold"
                      : "border-white/10 text-zinc-400 hover:text-white hover:border-white/25 bg-black/40"
                  }`}
                >
                  <span className="truncate">{a.label}</span>
                  {a.danger && <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${action === a.id ? "text-black" : "text-zinc-500"}`} />}
                </button>
              ))}
            </div>
          </div>

          {current.fields.map((f) => (
            <div key={f.id}>
              <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                {f.label}
              </label>
              <input
                type="text"
                value={params[f.id] || ""}
                onChange={(e) => setParams((p) => ({ ...p, [f.id]: e.target.value }))}
                placeholder={f.placeholder}
                className="up-input font-mono"
              />
            </div>
          ))}

          {current.danger && (
            <div className="p-3 rounded-none bg-white/[0.04] border border-white/15 text-zinc-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-zinc-400" />
              <span>This action has real effects on your account — it spends balance or changes orders.</span>
            </div>
          )}

          <button onClick={run} disabled={loading || !key.trim()} className="btn-up btn-up-solid w-full">
            <Play className="w-4 h-4" />
            <span>{loading ? "Running…" : "Run request"}</span>
          </button>
        </div>

        {/* Response panel */}
        <div className="rounded-none border border-white/12 bg-black/60 flex flex-col min-h-[420px]">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <span className="text-[10px] font-mono tracking-[0.2em] text-zinc-400 uppercase">Response</span>
            <div className="flex items-center gap-3">
              {ok !== null && (
                <span className={`text-[10px] font-mono uppercase tracking-wider ${ok ? "text-white" : "text-zinc-500"}`}>
                  {ok ? "● OK" : "● Error"}
                </span>
              )}
              <button
                onClick={() => { setResult("// Run an action to see the live JSON response here."); setOk(null); }}
                className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
                title="Clear"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <pre className="flex-1 p-4 text-[11px] sm:text-xs font-mono text-zinc-300 overflow-auto whitespace-pre-wrap break-all leading-relaxed">
            {result}
          </pre>
          <div className="px-4 py-2.5 border-t border-white/[0.06] text-[10px] font-mono text-zinc-600">
            POST https://smmup.co.in/api/v2 • rate limit 120 req/min per key
          </div>
        </div>
      </div>

      <H2>Notes</H2>
      <P>
        The playground talks to the same production API documented on the{" "}
        <button onClick={() => onNavigate("api")} className="text-white underline underline-offset-4 hover:text-zinc-300 cursor-pointer">
          API docs page
        </button>{" "}
        — responses are live, not sandboxed. Large payloads (like the full services list) are trimmed in the
        viewer after ~12 KB.
      </P>
    </ContentPage>
  );
}
