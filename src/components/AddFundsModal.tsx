import React from "react";
import {
  Wallet,
  X,
  QrCode,
  Smartphone,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  History,
  Lock,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import confetti from "canvas-confetti";
import { formatINR } from "../lib/utils";

interface AddFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onDepositSuccess: (newBalance: number) => void;
}

const PRESET_AMOUNTS = [50, 100, 250, 500, 1000, 2500];

export default function AddFundsModal({
  isOpen,
  onClose,
  user,
  onDepositSuccess,
}: AddFundsModalProps) {
  const [amount, setAmount] = React.useState<number | string>(250);
  const [activeStep, setActiveStep] = React.useState<"select" | "pay">("select");
  const [loading, setLoading] = React.useState(false);
  const [qrData, setQrData] = React.useState<{
    qrUrl: string;
    upiUrl: string;
    memo: string;
    amount: number;
    upiVpa: string;
  } | null>(null);

  const [utrNumber, setUtrNumber] = React.useState("");
  const [verifying, setVerifying] = React.useState(false);
  const [verifyError, setVerifyError] = React.useState("");
  const [verifySuccess, setVerifySuccess] = React.useState("");
  const [copiedVpa, setCopiedVpa] = React.useState(false);

  // Past transactions
  const [transactions, setTransactions] = React.useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/payments/history");
      const data = await res.json();
      if (res.ok && data.transactions) {
        setTransactions(data.transactions);
      }
    } catch {}
    setLoadingHistory(false);
  };

  if (!isOpen) return null;

  const handleGenerateQR = async () => {
    const num = parseFloat(String(amount));
    if (isNaN(num) || num < 10) {
      alert("Minimum deposit is ₹10.00");
      return;
    }

    setLoading(true);
    setVerifyError("");
    setVerifySuccess("");
    try {
      const res = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: num }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setQrData(data);
        setActiveStep("pay");
      } else {
        alert(data.error || "Failed to generate payment QR");
      }
    } catch {
      alert("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyUTR = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError("");
    setVerifySuccess("");

    const clean = utrNumber.trim();
    if (!/^\d{12}$/.test(clean)) {
      setVerifyError("Please enter the exact 12-digit numeric UTR from your UPI payment receipt.");
      return;
    }

    setVerifying(true);
    try {
      const res = await fetch("/api/payments/verify-utr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          utr: clean,
          amount: qrData ? qrData.amount : amount,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setVerifyError(data.error || "Payment verification failed.");
      } else {
        setVerifySuccess(data.message || "Payment verified and credited!");
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        onDepositSuccess(data.newBalance);
        loadHistory();
        setUtrNumber("");
      }
    } catch {
      setVerifyError("Network error checking bank records. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const copyVpa = () => {
    if (qrData?.upiVpa) {
      navigator.clipboard.writeText(qrData.upiVpa);
      setCopiedVpa(true);
      setTimeout(() => setCopiedVpa(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
      <div className="relative w-full max-w-lg border border-white/10 bg-zinc-950/95 rounded-2xl shadow-[0_4px_40px_rgba(0,0,0,0.8)] p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-5 border-b border-white/[0.08] mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-emerald-400">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold tracking-wide text-white">
                Deposit Funds
              </h2>
              <p className="text-xs text-zinc-400">
                Direct UPI Instant Clearing &bull; 0% Processing Fees
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/[0.05] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {activeStep === "select" ? (
          /* Step 1: Select Amount */
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-3">
                Select Top-Up Amount (INR)
              </label>
              <div className="grid grid-cols-3 gap-2.5 mb-4">
                {PRESET_AMOUNTS.map((amt) => {
                  const isSelected = Number(amount) === amt;
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAmount(amt)}
                      className={`py-3 px-3 rounded-xl text-sm font-semibold tracking-wide transition-all cursor-pointer ${
                        isSelected
                          ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.25)] scale-[1.02]"
                          : "border border-white/10 bg-white/[0.02] text-zinc-300 hover:border-white/25 hover:text-white"
                      }`}
                    >
                      ₹{amt}
                    </button>
                  );
                })}
              </div>

              {/* Custom amount */}
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-semibold text-sm">
                  ₹
                </span>
                <input
                  type="number"
                  min="10"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Or enter custom INR amount"
                  className="w-full bg-black/60 border border-white/15 focus:border-white focus:ring-1 focus:ring-white/20 text-white pl-9 pr-4 py-3 text-sm rounded-xl outline-none transition-all placeholder:text-zinc-500"
                />
              </div>
            </div>

            {/* Fee Guarantee */}
            <div className="p-4 rounded-xl border border-white/[0.06] bg-black/40 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Gateway Surcharge:</span>
                <span className="text-emerald-400 font-bold">0.00% FREE</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Settlement Guarantee:</span>
                <span className="text-white font-medium">Instant Bank Verification</span>
              </div>
            </div>

            <button
              onClick={handleGenerateQR}
              disabled={loading}
              className="w-full py-3.5 px-6 rounded-xl bg-white text-black font-bold tracking-wider text-xs uppercase hover:bg-zinc-200 transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,255,255,0.3)] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              <span>{loading ? "Generating Dynamic QR..." : "Proceed to Payment QR"}</span>
            </button>
          </div>
        ) : (
          /* Step 2: Pay & Submit 12-Digit UTR */
          <div className="space-y-6">
            {qrData && (
              <div className="flex flex-col items-center justify-center p-5 rounded-2xl border border-white/10 bg-white/[0.015] text-center">
                {/* QR Code Container */}
                <div className="bg-white p-3 rounded-2xl shadow-[0_0_30px_rgba(255,255,255,0.15)] mb-4">
                  <img
                    src={qrData.qrUrl}
                    alt="Scan UPI QR"
                    className="w-48 h-48 sm:w-52 sm:h-52 object-contain"
                  />
                </div>

                <div className="text-xl font-bold text-white mb-1">
                  {formatINR(qrData.amount)}
                </div>

                <div className="text-xs text-zinc-400 flex items-center gap-2 mb-4">
                  <span>UPI ID: <strong className="text-zinc-200">{qrData.upiVpa}</strong></span>
                  <button
                    onClick={copyVpa}
                    className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    title="Copy UPI VPA"
                  >
                    {copiedVpa ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Mobile Intent Button */}
                <a
                  href={qrData.upiUrl}
                  className="sm:hidden w-full py-2.5 px-4 rounded-xl border border-white/20 bg-white/[0.05] text-white text-xs font-semibold hover:bg-white/[0.1] transition-all flex items-center justify-center gap-2 mb-2"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Open in UPI App (GPay / PhonePe / Paytm)</span>
                </a>

                <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Memo tag attached: <code className="text-white font-semibold">{qrData.memo}</code></span>
                </div>
              </div>
            )}

            {/* UTR Verification Form */}
            <form onSubmit={handleVerifyUTR} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-2">
                  Enter 12-Digit Numeric UTR / Reference ID
                </label>
                <input
                  type="text"
                  maxLength={12}
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 427819827361"
                  required
                  className="w-full bg-black/60 border border-white/15 focus:border-white focus:ring-1 focus:ring-white/20 text-white px-4 py-3 text-sm rounded-xl outline-none transition-all placeholder:text-zinc-500 tracking-wider text-center font-semibold"
                />
                <p className="text-[11px] text-zinc-400 mt-2 text-center">
                  Look in your UPI receipt for "UPI Ref No", "UTR", or "12-digit transaction ID".
                </p>
              </div>

              {verifyError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{verifyError}</span>
                </div>
              )}

              {verifySuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                  <span>{verifySuccess}</span>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setActiveStep("select");
                    setVerifyError("");
                  }}
                  className="py-3 px-4 rounded-xl border border-white/15 text-zinc-300 hover:text-white hover:bg-white/[0.04] text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <button
                  type="submit"
                  disabled={verifying || utrNumber.length !== 12}
                  className="flex-1 py-3 px-6 rounded-xl bg-white text-black font-bold tracking-wider text-xs uppercase hover:bg-zinc-200 transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,255,255,0.3)] disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {verifying ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span>Verifying Bank Records...</span>
                    </>
                  ) : (
                    <span>Submit &amp; Credit Balance</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Deposit History */}
        <div className="mt-8 pt-6 border-t border-white/[0.08]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" />
              <span>Recent Deposits</span>
            </span>
          </div>

          {loadingHistory ? (
            <div className="text-xs text-zinc-500 text-center py-3">Loading records...</div>
          ) : transactions.length === 0 ? (
            <div className="text-xs text-zinc-500 text-center py-3">No previous deposits found.</div>
          ) : (
            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {transactions.slice(0, 5).map((t, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-white/[0.05] bg-black/40 text-xs"
                >
                  <div>
                    <span className="text-white font-medium block">
                      {formatINR(t.amount)}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      UTR: {t.utr || "Direct"} &bull; {new Date(t.date).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    Completed
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
