import React from "react";
import {
  Wallet,
  QrCode,
  Smartphone,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  History,
  Lock,
  ArrowLeft,
  Clock,
  MessageCircle,
  CreditCard,
  ChevronRight,
  Loader2,
} from "lucide-react";
import confetti from "canvas-confetti";
import { formatINR } from "../lib/utils";

interface AddFundsPageProps {
  user: any;
  onDepositSuccess: (newBalance: number) => void;
}

const PRESET_AMOUNTS = [50, 100, 250, 500, 1000, 2500];

interface RazorpayCheckoutInstance {
  open: () => void;
  on: (event: string, handler: (response: any) => void) => void;
}

interface RazorpayConstructor {
  new (options: Record<string, any>): RazorpayCheckoutInstance;
}

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let razorpayScriptPromise: Promise<void> | null = null;

function loadRazorpayCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
    );
    const script = existing || document.createElement("script");
    const onLoad = () => window.Razorpay
      ? resolve()
      : reject(new Error("Razorpay Checkout did not initialize."));
    const onError = () => {
      razorpayScriptPromise = null;
      reject(new Error("Unable to load Razorpay Checkout."));
    };

    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    if (!existing) {
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return razorpayScriptPromise;
}

export default function AddFundsPage({
  user,
  onDepositSuccess,
}: AddFundsPageProps) {
  const [amount, setAmount] = React.useState<number | string>(250);
  const [amountError, setAmountError] = React.useState("");
  const [activeStep, setActiveStep] = React.useState<"select" | "method" | "upi-pay">("select");
  const [loading, setLoading] = React.useState(false);
  const [razorpayLoading, setRazorpayLoading] = React.useState(false);
  const [razorpayVerifying, setRazorpayVerifying] = React.useState(false);
  const [razorpayError, setRazorpayError] = React.useState("");
  const [razorpaySuccess, setRazorpaySuccess] = React.useState("");
  const [razorpayConfig, setRazorpayConfig] = React.useState<{
    loaded: boolean;
    enabled: boolean;
    mode: "test" | "live";
    testWalletCreditEnabled: boolean;
    message?: string;
  }>({ loaded: false, enabled: false, mode: "test", testWalletCreditEnabled: false });
  const [qrData, setQrData] = React.useState<{
    qrUrl: string;
    upiUrl: string;
    memo: string;
    transactionId: string;
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
    loadHistory();
    loadRazorpayConfig();
    return () => stopPolling();
  }, []);

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
    if (activeStep === "upi-pay" && qrData?.memo && !verifySuccess) {
      setElapsedSeconds(0);

      // 1. Elapsed timer tick every second
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);

      // 2. Poll status endpoint every 3.5 seconds
      const pollStatus = async () => {
        try {
          const res = await fetch(`/api/payments/check-status?transactionId=${encodeURIComponent(qrData.transactionId)}`);
          const data = await res.json();
          if (res.ok && data.status === "paid") {
            stopPolling();
            setVerifySuccess(data.message || "Payment auto-detected & credited to wallet!");
            confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
            if (data.newBalance !== undefined) {
              onDepositSuccess(data.newBalance);
            }
            loadHistory();
          } else if (res.ok && data.status === "expired") {
            stopPolling();
            setVerifyError(data.message || "This payment request expired. Generate a fresh QR.");
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

  const loadRazorpayConfig = async () => {
    setRazorpayConfig((current) => ({ ...current, loaded: false }));
    try {
      const res = await fetch("/api/razorpay/config", { cache: "no-store" });
      const data = await res.json();
      setRazorpayConfig({
        loaded: true,
        enabled: Boolean(res.ok && data.enabled),
        mode: data.mode === "live" ? "live" : "test",
        testWalletCreditEnabled: Boolean(data.testWalletCreditEnabled),
        message: data.message || data.error,
      });
    } catch {
      setRazorpayConfig({
        loaded: true,
        enabled: false,
        mode: "test",
        testWalletCreditEnabled: false,
        message: "Razorpay availability could not be checked.",
      });
    }
  };

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

  const getValidAmount = (): number | null => {
    const num = Number(amount);
    if (!Number.isFinite(num) || num < 10 || Math.abs(num * 100 - Math.round(num * 100)) > 0.0001) {
      return null;
    }
    return num;
  };

  const handleContinueToMethod = () => {
    if (getValidAmount() === null) {
      setAmountError("Enter at least ₹10 with no more than 2 decimal places.");
      return;
    }
    setAmountError("");
    setRazorpayError("");
    setRazorpaySuccess("");
    setActiveStep("method");
  };

  const handleGenerateQR = async () => {
    const num = getValidAmount();
    if (num === null) {
      setAmountError("Enter at least ₹10 with no more than 2 decimal places.");
      setActiveStep("select");
      return;
    }

    setAmountError("");
    setRazorpayError("");
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
        setActiveStep("upi-pay");
      } else {
        setRazorpayError(data.error || "Failed to generate the Direct UPI payment QR.");
      }
    } catch {
      setRazorpayError("Network error while creating the Direct UPI payment. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const applyRazorpayResult = (data: any) => {
    setRazorpayVerifying(false);
    setRazorpayError("");
    setRazorpaySuccess(data.message || "Razorpay payment verified successfully.");
    confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
    if (data.walletCredited && data.newBalance !== undefined) {
      onDepositSuccess(data.newBalance);
    }
    loadHistory();
  };

  const pollRazorpayStatus = async (internalTransactionId: string) => {
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const res = await fetch(
        `/api/razorpay/status?transactionId=${encodeURIComponent(internalTransactionId)}`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (res.ok && (data.status === "paid" || data.status === "test_paid")) {
        applyRazorpayResult(data);
        return;
      }
      if (!res.ok && res.status !== 409) {
        throw new Error(data.error || "Unable to confirm Razorpay payment.");
      }
    }
    throw new Error(
      "Razorpay is still confirming the payment. It will be reconciled automatically; check Recent Deposits shortly.",
    );
  };

  const handleRazorpayPayment = async () => {
    const num = getValidAmount();
    if (num === null) {
      setRazorpayError("Enter a valid deposit amount of at least ₹10.");
      return;
    }
    if (!razorpayConfig.enabled) {
      setRazorpayError(razorpayConfig.message || "Razorpay Checkout is awaiting activation.");
      return;
    }

    setRazorpayLoading(true);
    setRazorpayError("");
    setRazorpaySuccess("");
    try {
      await loadRazorpayCheckout();
      const orderRes = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: num }),
      });
      const order = await orderRes.json();
      if (!orderRes.ok || !order.success) {
        throw new Error(order.error || "Unable to create Razorpay order.");
      }
      if (!window.Razorpay) throw new Error("Razorpay Checkout is unavailable.");

      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency,
        name: "SMM UP",
        description: `Wallet top-up • ${formatINR(order.amount)}`,
        image: "https://smmup.co.in/logo-512x512.png",
        order_id: order.orderId,
        prefill: order.prefill,
        notes: {
          transaction: order.internalTransactionId,
        },
        theme: {
          color: "#090909",
          backdrop_color: "rgba(0, 0, 0, 0.88)",
        },
        modal: {
          escape: true,
          backdropclose: false,
          confirm_close: true,
          ondismiss: () => {
            setRazorpayLoading(false);
            setRazorpayVerifying(false);
          },
        },
        handler: async (response: any) => {
          setRazorpayVerifying(true);
          setRazorpayError("");
          try {
            const verifyRes = await fetch("/api/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                internalTransactionId: order.internalTransactionId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verified = await verifyRes.json();
            if (verifyRes.ok && verifyRes.status !== 202) {
              applyRazorpayResult(verified);
            } else if (verifyRes.status === 202) {
              await pollRazorpayStatus(order.internalTransactionId);
            } else {
              throw new Error(verified.error || "Razorpay verification failed.");
            }
          } catch (error: any) {
            setRazorpayVerifying(false);
            setRazorpayError(
              error?.message || "Payment confirmation is delayed. Check Recent Deposits shortly.",
            );
          }
        },
      });

      checkout.on("payment.failed", (response: any) => {
        setRazorpayVerifying(false);
        setRazorpayError(
          response?.error?.description
            ? `Payment was not completed: ${response.error.description}`
            : "Payment was not completed. No wallet balance was added.",
        );
      });
      checkout.open();
    } catch (error: any) {
      setRazorpayError(error?.message || "Unable to open Razorpay Checkout.");
    } finally {
      setRazorpayLoading(false);
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
          transactionId: qrData?.transactionId,
          memo: qrData?.memo,
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
    <section className="min-h-[calc(100vh-4.5rem)] py-10 sm:py-14 lg:py-18">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-7">
          <a href="/" className="hover:text-white transition-colors">Home</a>
          <span aria-hidden="true">/</span>
          <span className="text-zinc-300">Add funds</span>
        </nav>

        <header className="grid lg:grid-cols-[1fr_auto] gap-6 items-end pb-8 border-b border-white/[0.09] mb-8">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-400 mb-4">
              <ShieldCheck className="w-3.5 h-3.5" />
              Secure wallet funding
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-[0.02em] text-white">
              Add funds
            </h1>
            <p className="mt-3 max-w-2xl text-sm sm:text-base leading-relaxed text-zinc-400 font-light">
              Choose Direct UPI with a 0% deposit fee, or use the completely separate Razorpay Secure Checkout when available.
            </p>
          </div>
          <div className="lg:text-right border-l border-white/10 pl-5">
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 block mb-1">Available balance</span>
            <span className="text-2xl sm:text-3xl font-semibold text-white">{formatINR(Number(user?.balance || 0))}</span>
          </div>
        </header>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6 lg:gap-8 items-start">
          <div className="border border-white/10 bg-[#090909]/90 shadow-[0_24px_80px_rgba(0,0,0,0.35)] p-5 sm:p-7 lg:p-9">
            <div className="grid grid-cols-3 mb-8 border border-white/[0.08] bg-black/40">
              {[
                { id: "select", label: "Amount", number: "01" },
                { id: "method", label: "Method", number: "02" },
                { id: "upi-pay", label: "Payment", number: "03" },
              ].map((step) => {
                const active = activeStep === step.id;
                const complete = step.id === "select"
                  ? activeStep !== "select"
                  : step.id === "method" && activeStep === "upi-pay";
                return (
                  <div
                    key={step.id}
                    className={`px-3 py-3.5 border-r last:border-r-0 border-white/[0.08] ${active ? "bg-white text-black" : complete ? "text-white" : "text-zinc-600"}`}
                  >
                    <span className="block text-[9px] font-mono tracking-wider mb-0.5">{step.number}</span>
                    <span className="block text-[10px] sm:text-xs font-semibold uppercase tracking-wider">{step.label}</span>
                  </div>
                );
              })}
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
                      onClick={() => {
                        setAmount(amt);
                        setAmountError("");
                      }}
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
                  step="0.01"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setAmountError("");
                  }}
                  placeholder="Or enter custom INR amount"
                  className="w-full bg-black/60 border border-white/15 focus:border-white focus:ring-1 focus:ring-white/20 text-white pl-9 pr-4 py-3 text-sm rounded-none outline-none transition-all placeholder:text-zinc-500"
                />
              </div>
              {amountError && (
                <div className="mt-3 p-3 border border-white/15 bg-white/[0.04] text-xs text-zinc-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{amountError}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 border border-white/[0.08] bg-black/40">
                <span className="text-zinc-500 block mb-1">Direct UPI</span>
                <span className="text-white font-semibold">0% deposit fee</span>
              </div>
              <div className="p-3.5 border border-white/[0.08] bg-black/40">
                <span className="text-zinc-500 block mb-1">Razorpay</span>
                <span className="text-white font-semibold">Secure Checkout</span>
              </div>
            </div>

            <button
              onClick={handleContinueToMethod}
              className="w-full py-3.5 px-6 rounded-none bg-white text-black font-bold tracking-wider text-xs uppercase hover:bg-zinc-200 transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,255,255,0.3)] flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Choose Payment Method</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : activeStep === "method" ? (
          /* Step 2: Choose an entirely separate payment rail */
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4 p-4 border border-white/[0.08] bg-black/40">
              <div>
                <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 block mb-1">Deposit amount</span>
                <span className="text-xl font-bold text-white">{formatINR(Number(amount))}</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveStep("select")}
                className="text-xs text-zinc-400 hover:text-white underline underline-offset-4 cursor-pointer"
              >
                Change amount
              </button>
            </div>

            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300 block mb-3">
                Choose Payment Method
              </span>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleGenerateQR}
                  disabled={loading || razorpayVerifying}
                  className="w-full p-4 border border-white/12 bg-white/[0.025] hover:bg-white/[0.06] hover:border-white/25 transition-all text-left cursor-pointer disabled:opacity-50 group"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 border border-white/10 bg-black flex items-center justify-center shrink-0">
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <QrCode className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-bold text-white">Direct UPI</span>
                        <span className="text-[9px] font-mono tracking-wider text-zinc-200 border border-white/15 px-2 py-1">0% FEE</span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                        Dedicated QR and UPI intent for GPay, PhonePe, Paytm and other UPI apps. Confirmed through the existing UTR system.
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-white mt-3 shrink-0" />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleRazorpayPayment}
                  disabled={!razorpayConfig.loaded || !razorpayConfig.enabled || razorpayLoading || razorpayVerifying}
                  className="w-full p-4 border border-white/12 bg-white/[0.025] hover:bg-white/[0.06] hover:border-white/25 transition-all text-left cursor-pointer disabled:cursor-not-allowed disabled:opacity-55 group"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 border border-white/10 bg-black flex items-center justify-center shrink-0">
                      {razorpayLoading || razorpayVerifying
                        ? <Loader2 className="w-5 h-5 animate-spin" />
                        : <CreditCard className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-bold text-white">Razorpay Secure Checkout</span>
                        <span className="text-[9px] font-mono tracking-wider text-zinc-200 border border-white/15 px-2 py-1">
                          {!razorpayConfig.loaded
                            ? "CHECKING"
                            : !razorpayConfig.enabled
                              ? "AWAITING ACTIVATION"
                              : razorpayConfig.mode === "test"
                                ? "TEST MODE"
                                : "AVAILABLE"}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                        A separate Razorpay-hosted payment flow for enabled UPI, cards, netbanking and wallet methods. Card and banking credentials never enter SMM UP.
                      </p>
                      {razorpayConfig.loaded && !razorpayConfig.enabled && (
                        <p className="text-[10px] text-zinc-500 mt-2">
                          UI is ready. Checkout activates automatically after the Razorpay keys and webhook are configured.
                        </p>
                      )}
                      {razorpayConfig.enabled && razorpayConfig.mode === "test" && (
                        <p className="text-[10px] text-zinc-400 mt-2">
                          {razorpayConfig.testWalletCreditEnabled
                            ? "Isolated staging credit is enabled for this Test Mode environment."
                            : "Test Mode is simulated and will not add spendable wallet balance."}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-white mt-3 shrink-0" />
                  </div>
                </button>
              </div>
            </div>

            {razorpayVerifying && (
              <div className="p-3.5 border border-white/12 bg-white/[0.04] text-xs text-zinc-300 flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>Verifying Razorpay signature, captured amount and wallet settlement…</span>
              </div>
            )}
            {razorpayError && (
              <div className="p-3.5 border border-white/15 bg-white/[0.05] text-xs text-zinc-200 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{razorpayError}</span>
              </div>
            )}
            {razorpaySuccess && (
              <div className="p-3.5 border border-white/15 bg-white/[0.06] text-xs text-zinc-100 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{razorpaySuccess}</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-[10px] leading-relaxed text-zinc-500">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Both methods create separate payment records. Razorpay confirmation never depends on the Direct UPI or Paytm verification flow.</span>
            </div>
          </div>
        ) : (
          /* Step 3: Direct UPI Pay & Auto-Detect / Manual Submit */
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
                <a
                  href="/support"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E4E4E7] hover:text-white underline underline-offset-4 cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Talk to Executive Support on Telegram</span>
                </a>
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
                    setActiveStep("method");
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
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24">
            <div className="border border-white/10 bg-[#090909]/90 p-5">
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 block mb-1">Funding account</span>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-white block truncate">@{user?.username || "account"}</span>
                  <span className="text-[11px] text-zinc-500 block truncate">{user?.email || "Signed-in account"}</span>
                </div>
                <div className="w-10 h-10 border border-white/10 bg-white/[0.03] flex items-center justify-center shrink-0">
                  <Wallet className="w-4 h-4 text-zinc-200" />
                </div>
              </div>
            </div>

            {/* Deposit History */}
            <div className="border border-white/10 bg-[#090909]/90 p-5">
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
                      {t.method === "RAZORPAY" ? "Razorpay" : "Direct UPI"} &bull; Ref: {t.utr || t.transactionId || t.memo || "—"} &bull; {new Date(t.createdAt || t.created_at || Date.now()).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-100 font-semibold bg-white/[0.06] px-2 py-0.5 rounded-full">
                    {t.status === "paid"
                      ? "Completed"
                      : t.status === "test_paid"
                        ? "Test verified"
                        : t.status === "creating" || t.status === "processing" || t.status === "authorized"
                          ? "Pending"
                          : t.status || "Pending"}
                  </span>
                </div>
              ))}
            </div>
          )}
            </div>

            <div className="border border-white/10 bg-white/[0.025] p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                <Lock className="w-4 h-4" />
                Payment security
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-500">
                Direct UPI and Razorpay use separate records and verification systems. SMM UP never asks for your OTP, UPI PIN, card CVV or banking password.
              </p>
              <a href="/support" className="inline-flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white underline underline-offset-4">
                <MessageCircle className="w-3.5 h-3.5" />
                Payment support
              </a>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
