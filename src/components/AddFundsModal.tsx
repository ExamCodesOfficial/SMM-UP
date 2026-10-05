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
  Clock,
  MessageCircle,
} from "lucide-react";
import confetti from "canvas-confetti";
import { formatINR } from "../lib/utils";

interface AddFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onDepositSuccess: (newBalance: number) => void;
  onOpenSupport?: () => void;
}

const PRESET_AMOUNTS = [50, 100, 250, 500, 1000, 2500];

export default function AddFundsModal({
  isOpen,
  onClose,
  user,
  onDepositSuccess,
  onOpenSupport,
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
  const [copiedMemo, setCopiedMemo] = React.useState(false);

  // Auto-detection polling states
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
  const pollingRef = React.useRef<any>(null);
  const timerRef = React.useRef<any>(null);

  // Past transactions
  const [transactions, setTransactions] = React.useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      loadHistory();
    } else {
      stopPolling();
      setActiveStep("select");
      setVerifyError("");
      setVerifySuccess("");
      setUtrNumber("");
      setElapsedSeconds(0);
    }
    return () => stopPolling();
  }, [isOpen]);

  // Clean polling when leaving pay step
  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Start live polling loop when QR is presented
  React.useEffect(() => {
    if (activeStep === "pay" && qrData?.memo && !verifySuccess) {
      setElapsedSeconds(0);

      // 1. Elapsed timer tick every second
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);

      // 2. Poll status endpoint every 3.5 seconds
      const pollStatus = async () => {
        try {
          const res = await fetch(`/api/payments/check-status?memo=${encodeURIComponent(qrData.memo)}`);
          const data = await res.json();
          if (res.ok && data.status === "paid") {
            stopPolling();
            setVerifySuccess(data.message || "Payment auto-detected & credited to wallet!");
            confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
            if (data.newBalance !== undefined) {
              onDepositSuccess(data.newBalance);
            }
            loadHistory();
          }
        } catch {
          // Silent catch during periodic polling
        }
      };

      // Initial check after 3 seconds
      const initialTimeout = setTimeout(pollStatus, 3000);

      pollingRef.current = setInterval(pollStatus, 3500);

      return () => {
        clearTimeout(initialTimeout);
        stopPolling();
      };
    } else {
      stopPolling();
    }
  }, [activeStep, qrData?.memo, verifySuccess]);

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
    setUtrNumber("");
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

  const handleManualVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError("");
    setVerifySuccess("");

    const cleanInput = utrNumber.trim();
    if (!cleanInput || cleanInput.length < 6) {
      setVerifyError("Please enter a valid 12-digit UTR, FamPay Transaction ID, or Bank Reference number.");
      return;
    }

    setVerifying(true);
    try {
      const res = await fetch("/api/payments/verify-identifier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: cleanInput,
          amount: qrData ? qrData.amount : amount,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setVerifyError(data.error || "Payment verification failed.");
      } else {
        stopPolling();
        setVerifySuccess(data.message || "Payment verified and credited!");
        confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
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

  const copyMemo = () => {
    if (qrData?.memo) {
      navigator.clipboard.writeText(qrData.memo);
      setCopiedMemo(true);
      setTimeout(() => setCopiedMemo(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
      <div className="relative w-full max-w-lg border border-white/10 bg-zinc-950/95 rounded-none shadow-[0_8px_40px_rgba(0,0,0,0.85)] p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-5 border-b border-white/[0.08] mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-none bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#E4E4E7]">
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
            className="p-2 text-zinc-400 hover:text-white rounded-none hover:bg-white/[0.05] transition-colors cursor-pointer"
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
                      className={`py-3 px-3 rounded-none text-sm font-semibold tracking-wide transition-all cursor-pointer ${
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
                  className="w-full bg-black/60 border border-white/15 focus:border-white focus:ring-1 focus:ring-white/20 text-white pl-9 pr-4 py-3 text-sm rounded-none outline-none transition-all placeholder:text-zinc-500"
                />
              </div>
            </div>

            {/* Fee Guarantee */}
            <div className="p-4 rounded-none border border-white/[0.06] bg-black/40 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Gateway Surcharge:</span>
                <span className="text-[#E4E4E7] font-bold">0.00% FREE</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Settlement Speed:</span>
                <span className="text-white font-medium">Auto-Detection (~15–30 sec)</span>
              </div>
            </div>

            <button
              onClick={handleGenerateQR}
              disabled={loading}
              className="w-full py-3.5 px-6 rounded-none bg-white text-black font-bold tracking-wider text-xs uppercase hover:bg-zinc-200 transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,255,255,0.3)] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              <span>{loading ? "Generating Dynamic QR..." : "Proceed to Payment QR"}</span>
            </button>
          </div>
        ) : (
          /* Step 2: Pay & Auto-Detect / Manual Submit */
          <div className="space-y-6">
            {qrData && (
              <div className="flex flex-col items-center justify-center p-5 rounded-none border border-white/10 bg-white/[0.015] text-center">
                {/* QR Code Container */}
                <div className="bg-white p-3 rounded-none shadow-[0_0_30px_rgba(255,255,255,0.15)] mb-4">
                  <img
                    src={qrData.qrUrl}
                    alt="Scan UPI QR"
                    loading="eager"
                    decoding="async"
                    className="w-48 h-48 sm:w-52 sm:h-52 object-contain"
                  />
                </div>

                <div className="text-xl font-bold text-white mb-1">
                  {formatINR(qrData.amount)}
                </div>

                <div className="text-xs text-zinc-400 flex items-center gap-2 mb-3">
                  <span>UPI ID: <strong className="text-zinc-200">{qrData.upiVpa}</strong></span>
                  <button
                    onClick={copyVpa}
                    className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    title="Copy UPI VPA"
                  >
                    {copiedVpa ? <Check className="w-3.5 h-3.5 text-zinc-100" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Mobile Intent Button */}
                <a
                  href={qrData.upiUrl}
                  className="sm:hidden w-full py-2.5 px-4 rounded-none border border-white/20 bg-white/[0.05] text-white text-xs font-semibold hover:bg-white/[0.1] transition-all flex items-center justify-center gap-2 mb-3"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Open in UPI App (GPay / PhonePe / Paytm)</span>
                </a>

                {/* Dynamic Memo Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-none bg-white/[0.04] border border-white/10 text-xs text-zinc-300">
                  <Lock className="w-3 h-3 text-[#E4E4E7]" />
                  <span>Dynamic Memo: <code className="text-[#FAF9F7] font-mono font-bold">{qrData.memo}</code></span>
                  <button
                    onClick={copyMemo}
                    className="text-zinc-400 hover:text-white transition-colors ml-1 cursor-pointer"
                    title="Copy Memo"
                  >
                    {copiedMemo ? <Check className="w-3 h-3 text-zinc-100" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            )}

            {/* Live Auto-Detection Radar / Status Bar */}
            <div className={`p-4 rounded-none border transition-all duration-300 flex items-center justify-between ${
              verifySuccess
                ? "border-white/15 bg-white/[0.06] text-zinc-100"
                : "border-white/10 bg-white/[0.02] text-zinc-300"
            }`}>
              <div className="flex items-center gap-3">
                {verifySuccess ? (
                  <CheckCircle2 className="w-5 h-5 text-zinc-100 shrink-0" />
                ) : (
                  <span className="relative flex h-3 w-3 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                  </span>
                )}
                <div>
                  <div className="text-xs font-semibold text-white">
                    {verifySuccess
                      ? "Payment Confirmed & Credited!"
                      : "Listening for bank confirmation..."}
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    {verifySuccess
                      ? "Your wallet balance has been updated."
                      : "Usually takes 15–30 seconds. Keep this screen open."}
                  </div>
                </div>
              </div>
              {!verifySuccess && (
                <div className="text-xs font-mono text-[#E4E4E7] bg-white/[0.04] px-2.5 py-1 rounded-sm border border-white/10 shrink-0">
                  {elapsedSeconds}s
                </div>
              )}
            </div>

            {/* Reassuring Delayed Payment Notification (> 60s) */}
            {elapsedSeconds >= 60 && !verifySuccess && (
              <div className="p-3.5 rounded-none border border-white/15 bg-white/[0.06] text-zinc-100 text-xs space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <Clock className="w-4 h-4 text-zinc-100 shrink-0" />
                  <span>Taking longer than 60 seconds?</span>
                </div>
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  Bank networks sometimes experience minor notification delays. You can enter your 12-digit UTR or FamPay Transaction ID below for instant clearance, or reach out to our team.
                </p>
                {onOpenSupport && (
                  <button
                    type="button"
                    onClick={onOpenSupport}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E4E4E7] hover:text-white underline underline-offset-4 cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Talk to Executive Support on Telegram</span>
                  </button>
                )}
              </div>
            )}

            {/* Manual Submission Form (Accepts 12-Digit UTR, FamPay TxID, or Ref) */}
            <form onSubmit={handleManualVerify} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-2">
                  Or Enter 12-Digit UTR / FamPay Transaction ID
                </label>
                <input
                  type="text"
                  maxLength={40}
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value.replace(/[^a-zA-Z0-9_\-]/g, ""))}
                  placeholder="e.g. 627636256497 or FMPIB6718103285"
                  disabled={verifying || Boolean(verifySuccess)}
                  className="w-full bg-black/60 border border-white/15 focus:border-white focus:ring-1 focus:ring-white/20 text-white px-4 py-3 text-sm rounded-none outline-none transition-all placeholder:text-zinc-500 tracking-wider text-center font-semibold uppercase"
                />
                <p className="text-[11px] text-zinc-400 mt-2 text-center">
                  Accepts 12-digit UPI UTR, FamPay Transaction ID (FMPIB...), or Paytm / Bank Reference ID.
                </p>
              </div>

              {verifyError && (
                <div className="p-3.5 rounded-none bg-white/[0.06] border border-white/15 text-zinc-100 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-zinc-100 mt-0.5" />
                  <span>{verifyError}</span>
                </div>
              )}

              {verifySuccess && (
                <div className="p-3.5 rounded-none bg-white/[0.06] border border-white/15 text-zinc-100 text-xs flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-zinc-100 mt-0.5" />
                  <span>{verifySuccess}</span>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    stopPolling();
                    setActiveStep("select");
                    setVerifyError("");
                    setVerifySuccess("");
                    setElapsedSeconds(0);
                  }}
                  className="py-3 px-4 rounded-none border border-white/15 text-zinc-300 hover:text-white hover:bg-white/[0.04] text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <button
                  type="submit"
                  disabled={verifying || utrNumber.trim().length < 6 || Boolean(verifySuccess)}
                  className="flex-1 py-3 px-6 rounded-none bg-white text-black font-bold tracking-wider text-xs uppercase hover:bg-zinc-200 transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,255,255,0.3)] disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {verifying ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span>Verifying Bank Records...</span>
                    </>
                  ) : (
                    <span>Verify &amp; Credit Balance</span>
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
                  className="flex items-center justify-between p-2.5 rounded-none border border-white/[0.05] bg-black/40 text-xs"
                >
                  <div>
                    <span className="text-white font-medium block">
                      {formatINR(t.amount)}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      Ref: {t.utr || t.transactionId || t.memo || "Direct"} &bull; {new Date(t.createdAt || t.created_at || Date.now()).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-100 font-semibold bg-white/[0.06] px-2 py-0.5 rounded-full">
                    {t.status === "paid" ? "Completed" : t.status || "Completed"}
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
