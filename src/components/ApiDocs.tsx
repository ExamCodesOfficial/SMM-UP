import React from "react";
import {
  Copy,
  Check,
  Terminal,
  Shield,
  Zap,
  AlertTriangle,
  ChevronRight,
  Key,
  BookOpen,
  Code2,
} from "lucide-react";
import { SmmUpLogo } from "./icons/ExecutiveIcons";

interface ApiDocsProps {
  user: any;
  onOpenAuth: () => void;
  onOpenProfile: () => void;
  onBack: () => void;
}

const BASE = "https://smmup.co.in/api/v2";

function useCopy() {
  const [copied, setCopied] = React.useState<string | null>(null);
  const copy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };
  return { copied, copy };
}

function CodeBlock({ id, code, copied, copy, lang = "bash" }: any) {
  return (
    <div className="relative rounded-none border border-white/[0.08] bg-black/70 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">{lang}</span>
        <button
          onClick={() => copy(id, code)}
          className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          {copied === id ? (
            <>
              <Check className="w-3 h-3 text-zinc-100" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 text-[11px] leading-relaxed text-zinc-300 font-mono overflow-x-auto whitespace-pre-wrap break-all">
        {code}
      </pre>
    </div>
  );
}

function ParamTable({ rows }: { rows: [string, string, boolean][] }) {
  return (
    <div className="rounded-none border border-white/[0.08] overflow-hidden">
      {rows.map(([name, desc, required], i) => (
        <div
          key={name}
          className={`px-4 py-3 flex flex-col sm:flex-row gap-1 sm:gap-4 text-xs ${
            i % 2 === 0 ? "bg-white/[0.015]" : "bg-transparent"
          }`}
        >
          <div className="sm:w-44 shrink-0 flex items-center gap-2">
            <code className="text-zinc-100 font-mono">{name}</code>
            {required ? (
              <span className="text-[9px] font-mono uppercase text-zinc-100">required</span>
            ) : (
              <span className="text-[9px] font-mono uppercase text-zinc-600">optional</span>
            )}
          </div>
          <div className="text-zinc-400 leading-relaxed">{desc}</div>
        </div>
      ))}
    </div>
  );
}

const ENDPOINTS = [
  { id: "services", action: "services", title: "Service Catalog", desc: "Returns the full catalog of live services with retail pricing, limits, refill and cancel flags." },
  { id: "add", action: "add", title: "Create Order", desc: "Places a new order and debits your wallet atomically. Returns the provider order ID." },
  { id: "status", action: "status", title: "Order Status", desc: "Returns live status, start count and remaining quantity for a single order." },
  { id: "cancel", action: "cancel", title: "Cancel Order", desc: "Requests cancellation of a pending order. Only available on cancellable services." },
  { id: "refill", action: "refill", title: "Refill Request", desc: "Requests a refill on drop-detected orders. Only available on refill-guaranteed services." },
  { id: "balance", action: "balance", title: "Wallet Balance", desc: "Returns your current wallet balance in INR." },
];

export default function ApiDocs({ user, onOpenAuth, onOpenProfile, onBack }: ApiDocsProps) {
  const { copied, copy } = useCopy();
  const [active, setActive] = React.useState("services");

  const keyPlaceholder = user?.hasApiKey ? user.apiKeyMasked || "sup_••••••••••••••••" : "YOUR_API_KEY";

  const cURL = `curl -X POST "${BASE}" \\
  -d "key=${keyPlaceholder}" \\
  -d "action=balance"`;

  const python = `import requests

API_URL = "https://smmup.co.in/api/v2"
API_KEY = "${keyPlaceholder}"

def call(action, **params):
    payload = {"key": API_KEY, "action": action, **params}
    r = requests.post(API_URL, data=payload, timeout=30)
    return r.json()

print(call("balance"))`;

  const php = `<?php
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, "https://smmup.co.in/api/v2");
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
    "key"    => "${keyPlaceholder}",
    "action" => "balance",
]));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
echo curl_exec($ch);`;

  const js = `const res = await fetch("https://smmup.co.in/api/v2", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    key: "${keyPlaceholder}",
    action: "balance",
  }),
});
console.log(await res.json());`;

  return (
    <div className="pt-6 pb-16 max-w-5xl mx-auto px-4 sm:px-6">
      {/* ── HERO ── */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <SmmUpLogo size={36} />
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-wide text-white flex items-center gap-2">
              <Terminal className="w-5 h-5 text-[#E4E4E7]" />
              Developer API
            </h1>
            <p className="text-xs text-zinc-400 font-mono mt-0.5">Standard SMM v2 &bull; smmup.co.in</p>
          </div>
        </div>
        <button
          onClick={onBack}
          className="px-3.5 py-2 rounded-none border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] text-zinc-300 hover:text-white text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          <ChevronRight className="w-3.5 h-3.5 rotate-180" />
          Back
        </button>
      </div>

      <div className="p-5 rounded-none border border-[#E4E4E7]/20 bg-[#E4E4E7]/[0.04] mb-8">
        <div className="flex items-start gap-3">
          <Zap className="w-4 h-4 text-[#E4E4E7] shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="text-sm text-white font-medium">One endpoint. Six actions. Full compatibility.</p>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Every request goes to a single URL with an <code className="text-zinc-100 font-mono">action</code> parameter.
              Works with any SMM panel, bot framework, or custom script that speaks the v2 spec.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <code className="px-2.5 py-1 rounded-sm bg-black/60 border border-white/10 text-[11px] font-mono text-zinc-100">
                {BASE}
              </code>
              <button
                onClick={() => copy("base", BASE)}
                className="px-2 py-1 rounded-sm border border-white/10 text-[10px] font-mono uppercase text-zinc-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
              >
                {copied === "base" ? <Check className="w-3 h-3 text-zinc-100" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── API KEY PANEL ── */}
      <div className="p-5 rounded-none border border-white/[0.08] bg-white/[0.015] mb-10">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
            <Key className="w-4 h-4 text-zinc-100" />
            <span>Your API Key</span>
          </span>
          <span className="text-[10px] text-zinc-100 font-semibold bg-white/[0.06] px-2 py-0.5 rounded-full">
            Standard v2
          </span>
        </div>

        {!user ? (
          <>
            <p className="text-xs text-zinc-400 leading-relaxed mb-4">
              API keys are created on demand &mdash; never automatically at signup. Sign in to generate yours.
            </p>
            <button
              onClick={onOpenAuth}
              className="px-5 py-2.5 rounded-none bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-all cursor-pointer"
            >
              Sign in to generate key
            </button>
          </>
        ) : !user.hasApiKey ? (
          <>
            <p className="text-xs text-zinc-400 leading-relaxed mb-4">
              You have not generated an API key yet. Generate it from your profile &mdash; the full key is shown only once.
            </p>
            <button
              onClick={onOpenProfile}
              className="px-5 py-2.5 rounded-none bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-all cursor-pointer"
            >
              Generate API key
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-zinc-400 leading-relaxed mb-3">
              Your key is masked for safety. Copy it from your profile, or regenerate to issue a new one.
            </p>
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                readOnly
                value={user.apiKeyMasked || "sup_••••••••••••••••"}
                className="flex-1 bg-black/70 border border-white/10 text-zinc-300 px-3.5 py-2.5 rounded-none text-xs outline-none font-mono"
              />
              <button
                onClick={onOpenProfile}
                className="px-4 py-2.5 rounded-none bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-all cursor-pointer shrink-0"
              >
                Manage
              </button>
            </div>
            <div className="flex items-start gap-2 text-[11px] text-zinc-500">
              <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                For your safety the full key is never sent to the browser after creation. Store it in an environment
                variable on your server &mdash; never in client-side code or public repos.
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── AUTHENTICATION ── */}
      <SectionTitle icon={<Shield className="w-4 h-4" />} title="Authentication" />
      <div className="space-y-4 mb-10">
        <p className="text-sm text-zinc-400 leading-relaxed">
          Pass your key as the <code className="text-zinc-100 font-mono">key</code> parameter in the POST body. For
          server-to-server integrations you may also send it as an{" "}
          <code className="text-zinc-100 font-mono">Authorization: Bearer</code> header or{" "}
          <code className="text-zinc-100 font-mono">X-API-Key</code> header instead, which keeps the key out of
          server logs and URL history.
        </p>
        <ParamTable
          rows={[
            ["key", "Your personal API key. Generated manually from your profile.", true],
            ["action", "The operation to perform: services, add, status, cancel, refill, balance.", true],
          ]}
        />
        <div className="flex items-start gap-2 p-4 rounded-none border border-white/15 bg-white/[0.05] text-[11px] text-zinc-100/90">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Treat your API key like a password. Anyone holding it can spend your wallet balance. Regenerate it
            immediately if it is ever exposed.
          </span>
        </div>
      </div>

      {/* ── ENDPOINTS ── */}
      <SectionTitle icon={<BookOpen className="w-4 h-4" />} title="Endpoints" />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {ENDPOINTS.map((ep) => (
          <button
            key={ep.id}
            onClick={() => {
              setActive(ep.id);
              document.getElementById(`ep-${ep.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className={`p-4 rounded-none border text-left transition-all cursor-pointer ${
              active === ep.id
                ? "border-[#E4E4E7]/40 bg-[#E4E4E7]/[0.06]"
                : "border-white/[0.08] bg-white/[0.015] hover:bg-white/[0.04]"
            }`}
          >
            <div className="text-[10px] font-mono text-[#E4E4E7] mb-1.5">action={ep.action}</div>
            <div className="text-sm font-semibold text-white mb-1">{ep.title}</div>
            <div className="text-[11px] text-zinc-400 leading-relaxed">{ep.desc}</div>
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <EndpointBlock
          id="ep-services"
          active={active === "services"}
          onHover={() => setActive("services")}
          action="services"
          title="Service Catalog"
          description="Returns every live service with your retail rate, quantity limits, and refill/cancel availability."
          code={`curl -X POST "${BASE}" \\\n  -d "key=${keyPlaceholder}" \\\n  -d "action=services"`}
          params={[["key", "Your API key.", true]]}
          response={`[\n  {\n    "service": 1,\n    "name": "Telegram Members [Premium]",\n    "type": "Default",\n    "category": "Telegram",\n    "platform": "Telegram",\n    "rate": "0.30",\n    "min": 10,\n    "max": 1000000,\n    "dripfeed": true,\n    "refill": true,\n    "refill_days": 30,\n    "refill_type": "30 Days Guaranteed",\n    "cancel": true\n  }\n]`}
          copied={copied}
          copy={copy}
        />

        <EndpointBlock
          id="ep-add"
          active={active === "add"}
          onHover={() => setActive("add")}
          action="add"
          title="Create Order"
          description="Debits your wallet atomically, then dispatches to the delivery network. Balance is checked before any upstream call."
          code={`curl -X POST "${BASE}" \\\n  -d "key=${keyPlaceholder}" \\\n  -d "action=add" \\\n  -d "service=1" \\\n  -d "link=https://t.me/yourchannel" \\\n  -d "quantity=1000"`}
          params={[
            ["service", "Service ID from the catalog.", true],
            ["link", "Target link, username, or post ID depending on service type.", true],
            ["quantity", "Amount to deliver. Ignored for Package type (always 1).", false],
            ["comments", "Newline-separated comments for Custom Comments services.", false],
            ["usernames", "Comma or newline separated usernames for Mentions services.", false],
            ["hashtags", "Hashtags for Hashtag-type services.", false],
            ["username", "Single username for username-type services.", false],
            ["runs", "Drip-feed number of delivery runs.", false],
            ["interval", "Minutes between drip-feed runs.", false],
          ]}
          response={`{\n  "order": 482913\n}`}
          copied={copied}
          copy={copy}
        />

        <EndpointBlock
          id="ep-status"
          active={active === "status"}
          onHover={() => setActive("status")}
          action="status"
          title="Order Status"
          description="Returns live delivery progress for an order. Accepts either the provider order ID returned by add, or your internal order ID."
          code={`curl -X POST "${BASE}" \\\n  -d "key=${keyPlaceholder}" \\\n  -d "action=status" \\\n  -d "order=482913"`}
          params={[
            ["order", "Order ID returned from the add action.", true],
          ]}
          response={`{\n  "charge": "0.30",\n  "start_count": 1000,\n  "status": "In progress",\n  "remains": 0,\n  "currency": "INR"\n}`}
          copied={copied}
          copy={copy}
        />

        <EndpointBlock
          id="ep-cancel"
          active={active === "cancel"}
          onHover={() => setActive("cancel")}
          action="cancel"
          title="Cancel Order"
          description="Requests cancellation while an order is still pending. Only services flagged cancel: true are eligible."
          code={`curl -X POST "${BASE}" \\\n  -d "key=${keyPlaceholder}" \\\n  -d "action=cancel" \\\n  -d "order=482913"`}
          params={[["order", "Order ID to cancel.", true]]}
          response={`{\n  "success": true,\n  "message": "Cancel requested"\n}`}
          copied={copied}
          copy={copy}
        />

        <EndpointBlock
          id="ep-refill"
          active={active === "refill"}
          onHover={() => setActive("refill")}
          action="refill"
          title="Refill Request"
          description="Submits a refill claim on orders that have dropped. Available on refill-guaranteed services only."
          code={`curl -X POST "${BASE}" \\\n  -d "key=${keyPlaceholder}" \\\n  -d "action=refill" \\\n  -d "order=482913"`}
          params={[["order", "Order ID to refill.", true]]}
          response={`{\n  "success": true,\n  "refill": 771204\n}`}
          copied={copied}
          copy={copy}
        />

        <EndpointBlock
          id="ep-balance"
          active={active === "balance"}
          onHover={() => setActive("balance")}
          action="balance"
          title="Wallet Balance"
          description="Returns your current spendable wallet balance."
          code={`curl -X POST "${BASE}" \\\n  -d "key=${keyPlaceholder}" \\\n  -d "action=balance"`}
          params={[["key", "Your API key.", true]]}
          response={`{\n  "balance": "250.00",\n  "currency": "INR"\n}`}
          copied={copied}
          copy={copy}
        />
      </div>

      {/* ── CODE EXAMPLES ── */}
      <div className="mt-12">
        <SectionTitle icon={<Code2 className="w-4 h-4" />} title="Code Examples" />
        <div className="space-y-4">
          <CodeBlock id="curl" code={cURL} copied={copied} copy={copy} lang="cURL" />
          <CodeBlock id="py" code={python} copied={copied} copy={copy} lang="Python" />
          <CodeBlock id="php" code={php} copied={copied} copy={copy} lang="PHP" />
          <CodeBlock id="js" code={js} copied={copied} copy={copy} lang="JavaScript" />
        </div>
      </div>

      {/* ── ERRORS ── */}
      <div className="mt-12">
        <SectionTitle icon={<AlertTriangle className="w-4 h-4" />} title="Error Codes" />
        <ParamTable
          rows={[
            ["400", "Missing or invalid parameters, or insufficient wallet balance.", false],
            ["401", "API key is missing or invalid.", false],
            ["404", "Service or order not found.", false],
            ["429", "Rate limit exceeded. Slow down and retry.", false],
            ["500", "Upstream delivery network error. Safe to retry.", false],
          ]}
        />
      </div>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white font-mono mb-5 flex items-center gap-2.5 pb-3 border-b border-white/[0.08]">
      <span className="text-[#E4E4E7]">{icon}</span>
      {title}
    </h2>
  );
}

function EndpointBlock({
  id,
  active,
  onHover,
  action,
  title,
  description,
  code,
  params,
  response,
  copied,
  copy,
}: any) {
  return (
    <div
      id={id}
      onMouseEnter={onHover}
      className={`scroll-mt-24 p-5 rounded-none border transition-all ${
        active ? "border-[#E4E4E7]/30 bg-[#E4E4E7]/[0.03]" : "border-white/[0.08] bg-white/[0.01]"
      }`}
    >
      <div className="flex items-center gap-2.5 mb-2">
        <code className="px-2.5 py-1 rounded-sm bg-black/60 border border-[#E4E4E7]/20 text-[11px] font-mono text-[#E4E4E7]">
          action={action}
        </code>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      <p className="text-xs text-zinc-400 leading-relaxed mb-4">{description}</p>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">Request</div>
            <CodeBlock id={`${id}-req`} code={code} copied={copied} copy={copy} />
          </div>
          {params?.length > 1 && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">Parameters</div>
              <ParamTable rows={params} />
            </div>
          )}
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">Response</div>
          <CodeBlock id={`${id}-res`} code={response} copied={copied} copy={copy} lang="json" />
        </div>
      </div>
    </div>
  );
}