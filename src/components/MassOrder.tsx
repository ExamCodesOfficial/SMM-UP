import React from "react";
import { Layers, Send, AlertCircle, CheckCircle2 } from "lucide-react";
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
  onOpenWallet: () => void;
  onOrderSuccess: (order: any) => void;
}

export default function MassOrder({
  services,
  user,
  onOpenAuth,
  onOpenWallet,
  onOrderSuccess,
}: MassOrderProps) {
  const [content, setContent] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [results, setResults] = React.useState<{ line: string; success: boolean; msg: string }[]>([]);

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
        return { valid: false, error: "Invalid numeric parameters", raw: l };
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
    if (!user) {
      onOpenAuth();
      return;
    }

    const valids = parsedOrders.filter((p) => p.valid);
    if (valids.length === 0) {
      alert("No valid order lines found.");
      return;
    }

    if ((user.balance || 0) < totalEstimated) {
      alert(`Insufficient balance. Required: ${formatINR(totalEstimated)}, Available: ${formatINR(user.balance)}`);
      onOpenWallet();
      return;
    }

    setSubmitting(true);
    setResults([]);
    const localResults: { line: string; success: boolean; msg: string }[] = [];

    for (const ord of valids) {
      try {
        const res = await fetch("/api/orders/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceId: ord.serviceId,
            link: ord.link,
            quantity: ord.quantity,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          localResults.push({ line: ord.raw, success: true, msg: `Order #${data.providerOrderId} Placed` });
          onOrderSuccess(data);
        } else {
          localResults.push({ line: ord.raw, success: false, msg: data.error || "Failed" });
        }
      } catch (err) {
        localResults.push({ line: ord.raw, success: false, msg: "Network error" });
      }
    }

    setResults(localResults);
    setSubmitting(false);
    if (localResults.some((r) => r.success)) {
      confetti({ particleCount: 60, spread: 55 });
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="p-6 border border-white/10 bg-white/[0.02] rounded-sm relative shadow-[0_0_30px_rgba(255,255,255,0.02)]">
        {/* Corner Brackets */}
        <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-white/30 pointer-events-none" />
        <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-white/30 pointer-events-none" />
        <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-white/30 pointer-events-none" />
        <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-white/30 pointer-events-none" />

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base sm:text-lg font-bold tracking-[0.14em] text-white flex items-center gap-2">
              <Layers className="w-4 h-4" />
              <span>MASS ORDER ENGINE</span>
              <span className="text-[10px] text-white/40">❖</span>
            </h2>
            <p className="text-[11px] text-gray-500 font-mono tracking-wider">
              BATCH PROVISIONING FOR AGENCIES & RESELLERS
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] tracking-[0.2em] text-gray-400 font-bold mb-2">
              ENTER ONE ORDER PER LINE IN FORMAT:
            </label>
            <div className="p-2.5 bg-black/60 border border-white/10 text-[11px] font-mono text-gray-400 rounded-sm mb-3">
              service_id | link | quantity
              <br />
              <span className="text-gray-600">Example: 1420 | https://instagram.com/myaccount | 1000</span>
            </div>
            <textarea
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="1420 | https://instagram.com/thatonearyan | 1000&#10;85 | https://t.me/telegram_channel | 500"
              className="w-full bg-black/80 border border-white/10 focus:border-white/40 text-white p-3 text-xs font-mono rounded-sm outline-none transition-all placeholder:text-gray-600"
              required
            />
          </div>

          {/* Validation stats */}
          <div className="flex flex-wrap justify-between items-center text-xs font-mono p-3 border border-white/10 bg-black/40 rounded-sm">
            <div>
              Total Lines: <span className="text-white font-bold">{parsedOrders.length}</span> (
              <span className="text-emerald-400">{parsedOrders.filter((p) => p.valid).length} valid</span>)
            </div>
            <div>
              Est. Total: <span className="text-white font-bold">{formatINR(totalEstimated)}</span>
            </div>
          </div>

          {results.length > 0 && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto p-3 border border-white/10 bg-black/60 rounded-sm text-xs font-mono">
              {results.map((r, i) => (
                <div key={i} className={`flex items-center gap-2 ${r.success ? "text-emerald-400" : "text-red-400"}`}>
                  {r.success ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                  <span className="truncate">{r.line} &rarr; {r.msg}</span>
                </div>
              ))}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || parsedOrders.length === 0}
            className="w-full py-3 bg-white text-black font-bold text-xs tracking-[0.2em] rounded-sm hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.3)] disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{submitting ? "SUBMITTING BATCH..." : `DISPATCH ALL ORDERS (${formatINR(totalEstimated)})`}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
