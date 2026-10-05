import React from "react";
import { Layers, Send, AlertCircle, CheckCircle2, Info } from "lucide-react";
import confetti from "canvas-confetti";
import { formatINR } from "../lib/utils";

interface Service {
  service: number | string;
  rate: number;
}

interface MassOrderProps {
  services: Service[];
  user: any;
  onOpenAuth: () => void;
  onOrderSuccess: (order: any) => void;
}

export default function MassOrder({
  services,
  user,
  onOpenAuth,
  onOrderSuccess,
}: MassOrderProps) {
  const [content, setContent] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [results, setResults] = React.useState<{ line: string; success: boolean; msg: string }[]>([]);
  const [errorMsg, setErrorMsg] = React.useState("");

  // Parse lines
  const parsedOrders = React.useMemo(() => {
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    return lines.map((l) => {
      const parts = l.split("|").map((p) => p.trim());
      if (parts.length < 3) {
        return { valid: false, error: "Format must be service_id | link | quantity", raw: l };
      }
      const sId = parseInt(parts[0], 10);
      const link = parts[1];
      const qty = parseInt(parts[2], 10);

      if (isNaN(sId) || !link || isNaN(qty) || qty <= 0) {
        return { valid: false, error: "Invalid parameters", raw: l };
      }

      const s = services.find((srv) => Number(srv.service) === sId);
      const rate = s ? s.rate : 0;
      const charge = (rate * qty) / 1000;

      return { valid: true, serviceId: sId, link, quantity: qty, charge, raw: l };
    });
  }, [content, services]);

  const totalEstimated = parsedOrders.reduce((acc, curr) => acc + (curr.charge || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (!user) {
      onOpenAuth();
      return;
    }

    const validItems = parsedOrders.filter((p) => p.valid);
    if (validItems.length === 0) {
      setErrorMsg("No valid order lines detected. Use the format: service_id | target_link | quantity");
      return;
    }

    if ((user.balance || 0) < totalEstimated) {
      setErrorMsg(`Insufficient wallet balance. Batch requires ${formatINR(totalEstimated)} — top up your wallet to proceed.`);
      return;
    }

    setSubmitting(true);
    setResults([]);
    const localResults = [];

    for (const item of validItems) {
      try {
        const res = await fetch("/api/orders/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceId: item.serviceId,
            link: item.link,
            quantity: item.quantity,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          localResults.push({
            line: `${item.serviceId} | ${item.link}`,
            success: true,
            msg: `Placed #${data.providerOrderId || data.orderId}`,
          });
          onOrderSuccess(data);
        } else {
          localResults.push({
            line: `${item.serviceId} | ${item.link}`,
            success: false,
            msg: data.error || "Order failed",
          });
        }
      } catch {
        localResults.push({
          line: `${item.serviceId} | ${item.link}`,
          success: false,
          msg: "Network error",
        });
      }
    }

    setResults(localResults);
    setSubmitting(false);
    if (localResults.some((r) => r.success)) {
      confetti({ particleCount: 60, spread: 55 });
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 relative z-10">
      {/* Title */}
      <div className="text-center mb-10">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-[0.2em] sm:tracking-[0.25em] text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.4)] uppercase mb-3">
          MASS ORDER
        </h1>
        <div className="w-20 h-0.5 bg-white/20 mx-auto mb-4" />
        <p className="text-sm sm:text-base text-zinc-300 font-light tracking-wide max-w-xl mx-auto">
          Place many orders at once across multiple platforms.
        </p>
      </div>

      <div className="p-6 sm:p-8 rounded-none border border-white/[0.08] bg-zinc-950/70 backdrop-blur-xl shadow-[0_4px_30px_rgba(0,0,0,0.6)]">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-2">
              Enter one order per line:
            </label>
            <div className="p-3.5 bg-black/50 border border-white/10 rounded-none text-xs text-zinc-400 mb-3 space-y-1">
              <span className="font-semibold text-white">Format:</span> <code>service_id | target_link | quantity</code>
              <div className="text-zinc-500">Example: 2664 | https://instagram.com/p/test1234 | 1000</div>
            </div>
            <textarea
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="2664 | https://instagram.com/p/reel1 | 1000&#10;508 | https://t.me/channel | 500"
              className="w-full bg-black/60 border border-white/15 focus:border-white focus:ring-1 focus:ring-white/20 text-white p-4 text-sm rounded-none outline-none transition-all placeholder:text-zinc-500 font-mono"
              required
            />
          </div>

          {/* Validation stats */}
          <div className="flex flex-wrap justify-between items-center text-xs p-4 border border-white/10 bg-black/40 rounded-none">
            <div className="text-zinc-300">
              Total Lines: <strong className="text-white">{parsedOrders.length}</strong> (
              <span className="text-zinc-100 font-semibold">
                {parsedOrders.filter((p) => p.valid).length} valid
              </span>
              )
            </div>
            <div className="text-zinc-300">
              Estimated Total: <strong className="text-white text-sm">{formatINR(totalEstimated)}</strong>
            </div>
          </div>

          {/* Inline error surface (replaces native alert popups) */}
          {errorMsg && (
            <div className="p-4 rounded-none bg-white/[0.06] border border-white/15 text-zinc-100 text-xs sm:text-sm flex items-start gap-3 animate-fadeIn">
              <AlertCircle className="w-5 h-5 shrink-0 text-zinc-100" />
              <div className="flex-1">
                <span>{errorMsg}</span>
                {/insufficient/i.test(errorMsg) && (
                  <a
                    href="/add-funds"
                    className="mt-2 inline-flex items-center gap-1.5 text-[#E4E4E7] hover:text-white font-semibold underline underline-offset-4 text-xs cursor-pointer"
                  >
                    Open Add Funds
                  </a>
                )}
              </div>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto p-4 border border-white/10 bg-black/60 rounded-none text-xs">
              {results.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 ${
                    r.success ? "text-zinc-100" : "text-zinc-100"
                  }`}
                >
                  {r.success ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="truncate">
                    {r.line} &rarr; {r.msg}
                  </span>
                </div>
              ))}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || parsedOrders.length === 0}
            className="w-full py-3.5 px-6 rounded-none bg-white text-black font-bold tracking-wider text-xs uppercase hover:bg-zinc-200 transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,255,255,0.3)] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>
              {submitting
                ? "Placing your batch orders…"
                : `Place Batch (${formatINR(totalEstimated)})`}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}
