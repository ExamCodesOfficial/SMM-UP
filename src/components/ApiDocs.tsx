import React from "react";
import { Copy, Check, Key, BookOpen, Terminal, AlertTriangle, FlaskConical, ArrowLeft } from "lucide-react";
import { SmmUpLogo } from "./icons/ExecutiveIcons";

interface ApiDocsProps {
  user: any;
}

const BASE = "https://smmup.co.in/api/v2";

function useCopy() {
  const [copied, setCopied] = React.useState<string | null>(null);
  const copy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1800);
  };
  return { copied, copy };
}

function CodeBlock({ id, code, lang }: { id: string; code: string; lang: string }) {
  const { copied, copy } = useCopy();
  return (
    <div className="rounded-none border border-white/12 bg-black/70 overflow-hidden my-3">
      <div className="px-3.5 py-2 border-b border-white/10 flex items-center justify-between">
        <span className="text-[10px] font-mono tracking-[0.2em] text-zinc-500 uppercase">{lang}</span>
        <button
          onClick={() => copy(id, code)}
          className="text-zinc-500 hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider"
        >
          {copied === id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied === id ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="p-4 text-[11px] sm:text-xs font-mono text-zinc-300 overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function ParamTable({ rows }: { rows: [string, string, string][] }) {
  return (
    <div className="overflow-x-auto border border-white/10 rounded-none my-3">
      <table className="w-full text-left text-xs">
        <thead className="bg-black/80 border-b border-white/10 text-zinc-400 uppercase tracking-wider">
          <tr>
            <th className="px-3.5 py-2.5 w-32">Parameter</th>
            <th className="px-3.5 py-2.5 w-24">Required</th>
            <th className="px-3.5 py-2.5">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06]">
          {rows.map(([p, r, d]) => (
            <tr key={p} className="hover:bg-white/[0.02]">
              <td className="px-3.5 py-2.5 font-mono text-white">{p}</td>
              <td className="px-3.5 py-2.5 text-zinc-400">{r}</td>
              <td className="px-3.5 py-2.5 text-zinc-300">{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 pb-12 mb-12 border-b border-white/[0.06] last:border-0">
      <h2 className="text-lg sm:text-xl font-light tracking-[0.08em] text-white uppercase mb-4 flex items-center gap-3">
        <span className="w-5 h-px bg-white/30 inline-block" />
        {title}
      </h2>
      <div className="text-sm text-zinc-400 leading-relaxed font-light space-y-3">{children}</div>
    </section>
  );
}

const NAV = [
  { id: "getting-started", label: "Getting started" },
  { id: "authentication", label: "Authentication" },
  { id: "key-lifecycle", label: "Key lifecycle" },
  { id: "scopes-limits", label: "Scopes & limits" },
  { id: "security-telemetry", label: "Security & activity" },
  { id: "add-order", label: "Add order" },
  { id: "order-status", label: "Order status" },
  { id: "multi-status", label: "Multiple statuses" },
  { id: "services", label: "Service list" },
  { id: "balance", label: "Balance" },
  { id: "refill", label: "Refill order" },
  { id: "refill-status", label: "Refill status" },
  { id: "cancel", label: "Cancel orders" },
  { id: "errors", label: "Errors & limits" },
  { id: "examples", label: "Code examples" },
];

export default function ApiDocs({ user }: ApiDocsProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-20">
      {/* Header */}
      <div className="mb-10">
        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-zinc-500 hover:text-white transition-colors cursor-pointer mb-6"
        >
          <ArrowLeft className="w-3 h-3" />
          <span>Home</span>
        </a>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <span className="text-[10px] font-bold tracking-[0.25em] text-zinc-500 uppercase block mb-2 font-mono">
              Developers
            </span>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-[0.06em] text-white uppercase">
              API Documentation
            </h1>
            <div className="w-16 h-px bg-white/20 mt-4" />
            <p className="mt-4 text-sm text-zinc-400 font-light max-w-2xl leading-relaxed">
              Connect your own panel, bot or script to SMM UP. Standard SMM v2 protocol — if your software
              supports SMM panels, it already speaks this API.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            {user ? (
              <a href="/account" className="btn-up btn-up-ghost btn-up-sm">
                <Key className="w-4 h-4" />
                <span>Manage API keys</span>
              </a>
            ) : (
              <a href="/auth" className="btn-up btn-up-solid btn-up-sm">
                <Key className="w-4 h-4" />
                <span>Sign in to get key</span>
              </a>
            )}
            <a href="/playground" className="btn-up btn-up-ghost btn-up-sm">
              <FlaskConical className="w-4 h-4" />
              <span>Playground</span>
            </a>
          </div>
        </div>
      </div>

      <details className="lg:hidden mb-7 border border-white/10 bg-white/[0.02]">
        <summary className="cursor-pointer px-4 py-3 text-xs uppercase tracking-[0.16em] text-zinc-300">Documentation index</summary>
        <nav className="grid grid-cols-2 gap-px border-t border-white/10 bg-white/10">
          {NAV.map((item) => (
            <a key={item.id} href={`#${item.id}`} className="bg-[#080808] px-3 py-2.5 text-[11px] text-zinc-400 hover:text-white">
              {item.label}
            </a>
          ))}
        </nav>
      </details>

      <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-10">
        {/* Sticky sidebar */}
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-0.5 border-l border-white/10">
            {NAV.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className="block pl-4 py-1.5 text-xs text-zinc-500 hover:text-white transition-colors -ml-px border-l border-transparent hover:border-white"
              >
                {n.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Doc body */}
        <div className="min-w-0">
          <Section id="getting-started" title="Getting started">
            <p>
              Every request is a single HTTPS call to one endpoint, <code className="text-white font-mono text-xs bg-white/[0.06] px-1.5 py-0.5">POST {BASE}</code> (GET also works).
              Responses are always JSON.
            </p>
            <div className="grid sm:grid-cols-3 gap-3 my-4">
              {[
                { icon: BookOpen, t: "1. Create account", d: "Free, 10 seconds, no KYC." },
                { icon: Key, t: "2. Create named key", d: "Choose only the scopes and limits this integration needs." },
                { icon: Terminal, t: "3. Copy and call", d: "The secret is shown once, then stored only as a hash." },
              ].map((s, i) => (
                <div key={i} className="p-4 rounded-none border border-white/10 bg-white/[0.02]">
                  <s.icon className="w-4 h-4 text-zinc-300 mb-2" />
                  <div className="text-sm font-semibold text-white">{s.t}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{s.d}</div>
                </div>
              ))}
            </div>
            <CodeBlock
              id="gs"
              lang="cURL — check everything works"
              code={`curl -X POST ${BASE} \\
  -d "key=YOUR_API_KEY" \\
  -d "action=balance"
# → {"balance":"150.00","currency":"INR"}`}
            />
          </Section>

          <Section id="authentication" title="Authentication">
            <p>
              Send your API key with every request — as <code className="text-white font-mono text-xs bg-white/[0.06] px-1.5 py-0.5">key</code> in
              the body/query, <code className="text-white font-mono text-xs bg-white/[0.06] px-1.5 py-0.5">x-api-key</code> header, or{" "}
              <code className="text-white font-mono text-xs bg-white/[0.06] px-1.5 py-0.5">Authorization: Bearer</code>.
            </p>
            <div className="p-4 rounded-none border border-white/12 bg-white/[0.03] text-xs flex items-start gap-2.5 my-3">
              <AlertTriangle className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
              <span>
                A key with <code className="text-white">orders:create</code> can spend your wallet balance. Keep every secret server-side.
                If one leaks, rotate it from Account; the old secret stops working permanently.
              </span>
            </div>
            <p className="text-xs text-zinc-500 my-3">
              Scopes map to actions: <code className="text-zinc-300">services:read</code>, <code className="text-zinc-300">balance:read</code>,{" "}
              <code className="text-zinc-300">orders:create</code>, <code className="text-zinc-300">orders:read</code>,{" "}
              <code className="text-zinc-300">orders:cancel</code> and <code className="text-zinc-300">orders:refill</code>.
              Full Access selects all current scopes; it is not a future-expanding wildcard.
            </p>
            {user?.hasApiKey && (
              <p className="text-xs text-zinc-500 font-mono">
                Signed in — manage named keys, limits and expiration on the Account page.
              </p>
            )}
          </Section>

          <Section id="key-lifecycle" title="Named-key lifecycle">
            <p>
              API access uses named credential identities rather than one permanent account-wide secret. Each key has a stable public identity,
              an independently managed secret version, scopes, spend limits, optional expiry and its own activity history.
            </p>
            <div className="overflow-x-auto border border-white/10 my-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-black/80 border-b border-white/10 text-zinc-400 uppercase tracking-wider">
                  <tr><th className="px-3.5 py-2.5">Operation</th><th className="px-3.5 py-2.5">Effect</th><th className="px-3.5 py-2.5">Secret behavior</th></tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-zinc-300">
                  {[
                    ["Create", "Creates a separately named integration identity. The current account page shows the configured creation fee before confirmation.", "The complete secret is returned once; only its hash and masked hint persist."],
                    ["Pause", "Temporarily blocks authentication without deleting history or configuration.", "The current secret is preserved and works again after resume."],
                    ["Resume", "Returns a paused key to active status if no secure reissue is pending.", "No new secret is generated."],
                    ["Rotate / reissue", "Free replacement for a compromised, lost or owner-flagged secret.", "The old version is permanently revoked and can never be restored."],
                    ["Archive", "Permanently disables the named identity after exact-name confirmation. There is no fee refund.", "All versions stay revoked; operational history remains attributable."],
                  ].map(([operation, effect, secret]) => (
                    <tr key={operation}><td className="px-3.5 py-2.5 font-mono text-white">{operation}</td><td className="px-3.5 py-2.5">{effect}</td><td className="px-3.5 py-2.5">{secret}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border border-white/15 bg-white/[0.03] text-xs">
              <strong className="text-white">One-time reveal:</strong> if you close the reveal without saving a new secret, rotate the key again.
              SMM UP cannot retrieve an earlier raw secret because it is never stored.
            </div>
          </Section>

          <Section id="scopes-limits" title="Scopes, spend limits & expiry">
            <p>Grant only what an integration needs. A request is rejected before supplier or wallet mutation when its key lacks the required scope.</p>
            <div className="overflow-x-auto border border-white/10 my-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-black/80 border-b border-white/10 text-zinc-400 uppercase tracking-wider">
                  <tr><th className="px-3.5 py-2.5">Scope</th><th className="px-3.5 py-2.5">Permitted actions</th></tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-zinc-300">
                  {[
                    ["services:read", "services"],
                    ["balance:read", "balance"],
                    ["orders:create", "add; may spend wallet funds"],
                    ["orders:read", "status and multiple-status lookup"],
                    ["orders:cancel", "cancel eligible orders"],
                    ["orders:refill", "refill and refill_status"],
                  ].map(([scope, actions]) => (
                    <tr key={scope}><td className="px-3.5 py-2.5 font-mono text-white">{scope}</td><td className="px-3.5 py-2.5">{actions}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="list-disc pl-5 space-y-2 text-xs text-zinc-400">
              <li><strong className="text-zinc-200">Full Access</strong> synchronizes all scopes that exist today; it is not a wildcard for future permissions.</li>
              <li><strong className="text-zinc-200">Daily and monthly limits</strong> are optional INR spending ceilings enforced atomically in IST buckets.</li>
              <li>Concurrent order attempts cannot jointly exceed the same key limit; a rejected/rolled-back order does not consume settled spend.</li>
              <li><strong className="text-zinc-200">Expiry</strong> is optional. “Never” leaves the key active until it is paused, rotated, archived or owner-disabled.</li>
              <li>Account-level ordering holds and payment/security controls override individual key status.</li>
            </ul>
          </Section>

          <Section id="security-telemetry" title="Security, throttling & activity">
            <div className="grid md:grid-cols-2 gap-3 my-4">
              {[
                ["Server-side only", "Never embed a key in browser JavaScript, mobile binaries, public repositories, screenshots or client-visible logs."],
                ["Shared throttling", "Each key is limited to 120 requests per 60-second fixed window through a shared persistent limiter across server instances."],
                ["Complete attribution", "Orders, targets, charges, refunds and key version remain attributed to the named key that performed the operation."],
                ["Bounded telemetry", "Detailed request telemetry is retained for 90 days; lifetime financial/order attribution remains on durable operational records."],
              ].map(([title, detail]) => (
                <div key={title} className="p-4 border border-white/10 bg-white/[0.02]"><h3 className="text-xs font-semibold text-white mb-1">{title}</h3><p className="text-xs text-zinc-500">{detail}</p></div>
              ))}
            </div>
            <p className="text-xs text-zinc-500">
              Activity records may include action, result, HTTP status, latency, service ID, order ID, amount and timestamps. They exclude raw API
              secrets, passwords, authorization headers, cookies, OTPs and banking credentials. Use the Account page to filter activity and view lifetime reports.
            </p>
            <CodeBlock
              id="auth-header"
              lang="Recommended server-side header"
              code={`curl -X POST ${BASE} \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  --data "action=balance"`}
            />
          </Section>

          <Section id="add-order" title="Add order">
            <ParamTable
              rows={[
                ["key", "yes", "Your API key"],
                ["action", "yes", "add"],
                ["service", "yes", "Service ID from the service list"],
                ["link", "yes", "Public target URL or username"],
                ["quantity", "yes*", "Amount to deliver (*not for Package or Custom Comments types)"],
                ["comments", "yes*", "One per line — only for Custom Comments services"],
                ["runs", "no", "Drip-feed: number of deliveries"],
                ["interval", "no", "Drip-feed: minutes between deliveries"],
                ["answer_number", "no", "Poll answer number — Poll vote services only"],
              ]}
            />
            <CodeBlock
              id="add"
              lang="cURL — place an order"
              code={`curl -X POST ${BASE} \\
  -d "key=YOUR_API_KEY" \\
  -d "action=add" \\
  -d "service=5641" \\
  -d "link=https://t.me/yourchannel" \\
  -d "quantity=1000"

# → {"order":22001}`}
            />
            <p>
              The response <code className="text-white font-mono text-xs bg-white/[0.06] px-1.5 py-0.5">order</code> ID is what you use for
              status, refill and cancel calls. Charge = (service rate × quantity) ÷ 1000, debited from balance instantly.
            </p>
          </Section>

          <Section id="order-status" title="Order status">
            <ParamTable
              rows={[
                ["key", "yes", "Your API key"],
                ["action", "yes", "status"],
                ["order", "yes", "Order ID returned by add"],
              ]}
            />
            <CodeBlock
              id="status"
              lang="Request → response"
              code={`curl -X POST ${BASE} -d "key=KEY" -d "action=status" -d "order=22001"

{
  "charge": "50.59",
  "start_count": "1204",
  "status": "In progress",
  "remains": "612",
  "currency": "INR"
}`}
            />
            <p>Possible statuses: Pending, In progress, Processing, Completed, Partial, Canceled, Failed.</p>
          </Section>

          <Section id="multi-status" title="Multiple statuses">
            <p>
              Pass comma-separated order IDs to <code className="text-white font-mono text-xs bg-white/[0.06] px-1.5 py-0.5">order</code> (up
              to 100) and the response becomes an object keyed by order ID:
            </p>
            <CodeBlock
              id="mstatus"
              lang="Request → response"
              code={`curl -X POST ${BASE} -d "key=KEY" -d "action=status" -d "order=22001,22002"

{
  "22001": { "charge": "50.59", "start_count": "1204", "status": "Completed", "remains": "0", "currency": "INR" },
  "22002": { "charge": "4.80",  "start_count": "0",    "status": "Pending",   "remains": "1000", "currency": "INR" }
}`}
            />
          </Section>

          <Section id="services" title="Service list">
            <ParamTable
              rows={[
                ["key", "yes", "Your API key"],
                ["action", "yes", "services"],
              ]}
            />
            <CodeBlock
              id="services"
              lang="cURL — fetch the live catalog"
              code={`curl -X POST ${BASE} -d "key=KEY" -d "action=services"

[
  {
    "service": 5641,
    "name": "Telegram Post Views [ Max 1M ] | Last 1 Post FAST",
    "type": "Default",
    "category": "Telegram Post Views | Future post",
    "rate": "50.59",
    "min": "1",
    "max": "1000000",
    "refill": true,
    "cancel": true,
    "average_time": "0-15 minutes"
  }
]`}
            />
            <p>Rates are INR per 1,000 units, live — cache for a few minutes, not days.</p>
          </Section>

          <Section id="balance" title="Balance">
            <ParamTable
              rows={[
                ["key", "yes", "Your API key"],
                ["action", "yes", "balance"],
              ]}
            />
            <CodeBlock id="bal" lang="Request → response" code={`curl -X POST ${BASE} -d "key=KEY" -d "action=balance"

{ "balance": "150.00", "currency": "INR" }`} />
          </Section>

          <Section id="refill" title="Refill order">
            <p>
              Requests a free redelivery for an order inside its refill window (7D → Lifetime, per service).
            </p>
            <ParamTable
              rows={[
                ["key", "yes", "Your API key"],
                ["action", "yes", "refill"],
                ["order", "yes", "Order ID, or comma-separated IDs"],
              ]}
            />
            <CodeBlock
              id="refill"
              lang="Request → response"
              code={`curl -X POST ${BASE} -d "key=KEY" -d "action=refill" -d "order=22001"

{ "refill": "99120" }`}
            />
          </Section>

          <Section id="refill-status" title="Refill status">
            <ParamTable
              rows={[
                ["key", "yes", "Your API key"],
                ["action", "yes", "refill_status"],
                ["refill", "yes", "Refill ID returned by the refill action"],
              ]}
            />
            <CodeBlock
              id="rstatus"
              lang="Request → response"
              code={`curl -X POST ${BASE} -d "key=KEY" -d "action=refill_status" -d "refill=99120"

{ "status": "Completed" }`}
            />
          </Section>

          <Section id="cancel" title="Cancel orders">
            <ParamTable
              rows={[
                ["key", "yes", "Your API key"],
                ["action", "yes", "cancel"],
                ["order", "yes", "Order ID, or comma-separated IDs (up to 100)"],
              ]}
            />
            <CodeBlock
              id="cancel"
              lang="Request → response"
              code={`curl -X POST ${BASE} -d "key=KEY" -d "action=cancel" -d "order=22001,22002"

[ { "order": 22001, "cancel": 1 }, { "order": 22002, "cancel": { "error": "Already completed" } } ]`}
            />
            <p>Only services marked cancelable can be cancelled; the undelivered remainder refunds to balance automatically.</p>
          </Section>

          <Section id="errors" title="Errors & rate limits">
            <div className="overflow-x-auto border border-white/10 rounded-none my-3">
              <table className="w-full text-left text-xs">
                <thead className="bg-black/80 border-b border-white/10 text-zinc-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-3.5 py-2.5 w-24">HTTP</th>
                    <th className="px-3.5 py-2.5">Meaning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {[
                    ["400", "Missing/invalid parameters, insufficient balance, or quantity outside min/max"],
                    ["401", "Missing, invalid, expired, paused, archived or revoked API credential"],
                    ["403", "Required scope is absent, ordering is held, or another account security control blocks the action"],
                    ["404", "Order/service not found, or the resource is not owned by this account/key context"],
                    ["409", "A concurrent, idempotency or lifecycle conflict prevented the operation"],
                    ["429", "Shared rate limit hit — 120 requests per 60 seconds per key. Back off and retry"],
                    ["500", "The request failed safely on our side — retry with backoff; contact support if it persists"],
                    ["503", "A required internal dependency is unavailable or securely misconfigured; retry later"],
                  ].map(([c, d]) => (
                    <tr key={c} className="hover:bg-white/[0.02]">
                      <td className="px-3.5 py-2.5 font-mono text-white">{c}</td>
                      <td className="px-3.5 py-2.5 text-zinc-300">{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>Errors always return <code className="text-white font-mono text-xs bg-white/[0.06] px-1.5 py-0.5">{'{"error":"…"}'}</code> with a human-readable message.</p>
          </Section>

          <Section id="examples" title="Code examples">
            <CodeBlock
              id="ex-php"
              lang="PHP"
              code={`<?php
$key = 'YOUR_API_KEY';
$data = http_build_query([
  'key' => $key,
  'action' => 'add',
  'service' => 5641,
  'link' => 'https://t.me/yourchannel',
  'quantity' => 1000,
]);
$ctx = stream_context_create(['http' => [
  'method' => 'POST',
  'header' => "Content-Type: application/x-www-form-urlencoded\\r\\n",
  'content' => $data,
]]);
$res = json_decode(file_get_contents('${BASE}', false, $ctx), true);
echo 'Order ID: ' . ($res['order'] ?? $res['error']);`}
            />
            <CodeBlock
              id="ex-py"
              lang="Python"
              code={`import requests

KEY = "YOUR_API_KEY"

def api(action, **params):
    payload = {"key": KEY, "action": action, **params}
    r = requests.post("${BASE}", json=payload, timeout=30)
    return r.json()

# Balance
print(api("balance"))

# Order + track
order_id = api("add", service=5641,
               link="https://t.me/yourchannel", quantity=1000)["order"]
print(api("status", order=order_id))`}
            />
            <CodeBlock
              id="ex-node"
              lang="Node.js"
              code={`const KEY = "YOUR_API_KEY";

async function api(action, params = {}) {
  const r = await fetch("${BASE}", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: KEY, action, ...params }),
  });
  return r.json();
}

const bal = await api("balance");
console.log("Balance:", bal.balance, bal.currency);`}
            />
          </Section>
        </div>
      </div>
    </div>
  );
}
