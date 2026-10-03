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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-lg border border-white/15 bg-black rounded-sm shadow-[0_0_50px_rgba(255,255,255,0.06)] p-6 sm:p-7 max-h-[90vh] overflow-y-auto font-sans">
        {/* Subtle corner bracket markings from ExamCodes */}
        <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-white/40 pointer-events-none" />
        <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-white/40 pointer-events-none" />
        <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-white/40 pointer-events-none" />
        <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-white/40 pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
          <div>
            <h2 className="text-base font-bold tracking-[0.16em] text-white flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-400" />
              <span>INSTANT 0% UPI DEPOSIT</span>
            </h2>
            <p className="text-[10px] text-gray-500 font-mono tracking-wider">
              AUTOMATED FAMPAY UPI CLEARING &bull; 0% FEES
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-white rounded-sm transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {activeStep === "select" ? (
          /* Step 1: Select Amount */
          <div className="space-y-5">
            <div>
              <label className="block text-[10px] tracking-[0.2em] text-gray-400 font-bold mb-2">
                SELECT TOP-UP AMOUNT (INR)
              </label>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {PRESET_AMOUNTS.map((amt) => {
                  const isSelected = Number(amount) === amt;
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAmount(amt)}
                      className={`py-2.5 px-3 border rounded-sm text-xs font-mono font-bold tracking-wider transition-all cursor-pointer ${
                        isSelected
                          ? "border-white bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.3)]"
                          : "border-white/10 bg-white/[0.02] text-gray-300 hover:border-white/30"
                      }`}
                    >
                      ₹{amt}
                    </button>
                  );
                })}
              </div>

              {/* Custom amount */}
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-gray-500 font-mono text-sm">₹</span>
                <input
                  type="number"
                  min="10"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Or enter custom INR amount"
                  className="w-full bg-black/60 border border-white/10 focus:border-white/40 text-white pl-8 pr-4 py-2.5 text-xs font-mono rounded-sm outline-none transition-all"
                />
              </div>
            </div>

            <div className="p-3 border border-white/[0.06] bg-white/[0.01] rounded-sm text-xs font-mono space-y-1.5 text-gray-400">
              <div className="flex justify-between">
                <span>Direct Gateway Fee:</span>
                <span className="text-emerald-400 font-bold">0.00% (FREE)</span>
              </div>
              <div className="flex justify-between">
                <span>Settlement Speed:</span>
                <span className="text-white">Instant Automated</span>
              </div>
            </div>

            <button
              onClick={handleGenerateQR}
              disabled={loading}
              className="w-full py-3 bg-white text-black font-bold text-xs tracking-[0.2em] rounded-sm hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.3)] disabled:opacity-50"
            >
              <QrCode className="w-4 h-4" />
              <span>{loading ? "GENERATING QR..." : "GENERATE PAYMENT QR"}</span>
            </button>
          </div>
        ) : (
          /* Step 2: Pay & Submit 12-Digit UTR */
          <div className="space-y-6">
            {qrData && (
              <div className="flex flex-col items-center justify-center p-4 border border-white/10 bg-white/[0.01] rounded-sm text-center">
                {/* QR Code Container with high contrast */}
                <div className="bg-white p-3 rounded-sm shadow-[0_0_30px_rgba(255,255,255,0.15)] mb-3">
                  <img
                    src={qrData.qrUrl}
                    alt="Scan UPI QR"
                    className="w-48 h-48 sm:w-52 sm:h-52 object-contain"
                  />
                </div>

                <div className="text-sm font-bold font-mono text-white mb-1">
                  AMOUNT: {formatINR(qrData.amount)}
                </div>
                <div className="text-[10px] font-mono text-gray-400 flex items-center gap-1.5 mb-3">
                  <span>UPI ID: {qrData.upiVpa}</span>
                  <button onClick={copyVpa} className="text-gray-400 hover:text-white cursor-pointer">
                    {copiedVpa ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>

                {/* 1-Tap Mobile UPI Intent Button */}
                <a
                  href={qrData.upiUrl}
                  className="sm:hidden w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs tracking-wider rounded-sm flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(52,211,153,0.3)] mb-2"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>PAY VIA ANY UPI APP (GPAY / PHONEPE / FAMPAY)</span>
                </a>

                <div className="text-[10px] text-gray-500 font-mono">
                  Scan QR with any UPI App or tap the button on your phone.
                </div>
              </div>
            )}

            {/* Strict 12-Digit UTR Input Box */}
            <form onSubmit={handleVerifyUTR} className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[10px] tracking-[0.2em] text-gray-400 font-bold">
                    ENTER 12-DIGIT UTR / REFERENCE NO.
                  </label>
                  <span className="text-[10px] font-mono text-gray-500">
                    {utrNumber.length} / 12 digits
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={12}
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 423985123456"
                  className="w-full bg-black/80 border border-white/20 focus:border-white text-white px-4 py-2.5 text-sm font-mono tracking-widest rounded-sm outline-none transition-all placeholder:text-gray-600"
                  required
                />
              </div>

              {verifyError && (
                <div className="p-3 border border-red-500/40 bg-red-500/10 text-red-400 text-xs font-mono rounded-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{verifyError}</span>
                </div>
              )}

              {verifySuccess && (
                <div className="p-3 border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-xs font-mono rounded-sm flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{verifySuccess}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={verifying || utrNumber.length !== 12}
                className="w-full py-3 bg-white text-black font-bold text-xs tracking-[0.2em] rounded-sm hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.3)] disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{verifying ? "VERIFYING BANK RECORD..." : "SUBMIT UTR & RECONCILE"}</span>
              </button>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveStep("select");
                    setVerifyError("");
                    setVerifySuccess("");
                  }}
                  className="text-xs font-mono text-gray-500 hover:text-white cursor-pointer"
                >
                  &larr; Change Amount
                </button>
                <span className="text-[9px] text-gray-500 font-mono flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Anti-Replay Indexed
                </span>
              </div>
            </form>
          </div>
        )}

        {/* Deposit Ledger History */}
        {transactions.length > 0 && (
          <div className="mt-8 pt-6 border-t border-white/10">
            <h4 className="text-xs font-bold font-mono tracking-widest text-gray-400 mb-3 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" />
              <span>RECENT DEPOSITS</span>
            </h4>
            <div className="space-y-1.5 max-h-36 overflow-y-auto font-mono text-xs">
              {transactions.map((t) => (
                <div
                  key={t.id}
                  className="p-2 border border-white/[0.06] bg-black/40 rounded-sm flex justify-between items-center"
                >
                  <div>
                    <span className="font-bold text-white">{formatINR(t.amount)}</span>
                    <span className="text-[10px] text-gray-500 ml-2">UTR: {t.utr}</span>
                  </div>
                  <div>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-sm ${
                        t.status === "paid"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30"
                      }`}
                    >
                      {t.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
