import React from "react";
import { readApiPayload } from "../lib/apiResponse";
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
  Zap,
  Bitcoin,
} from "lucide-react";
import confetti from "canvas-confetti";
import QRCode from "qrcode";
import { formatINR } from "../lib/utils";
import { pathFor } from "../lib/routes";

interface AddFundsPageProps {
  user: any;
  onDepositSuccess: (newBalance: number) => void;
}

type PaymentMethodId = "direct_upi" | "famgateway_upi" | "oxapay_crypto" | "razorpay";
type FlowStep = "method" | "amount" | "pay";

/**
 * Shape returned by `GET /api/payments/methods`. Only ENABLED and CONFIGURED
 * methods are ever returned by the server, so anything missing here is a
 * method the customer must not see at all.
 */
interface PaymentMethodDescriptor {
  id: PaymentMethodId;
  label: string;
  enabled: boolean;
  minAmount: number;
  maxAmount: number;
  currency: string;
  presets: number[];
  inrRate: number;
  feePayer: "merchant" | "customer";
  hostedRedirect: boolean;
  description: string;
}

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
    if (document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) {
      const check = setInterval(() => {
        if (window.Razorpay) {
          clearInterval(check);
          resolve();
        }
      }, 100);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => window.Razorpay
      ? resolve()
      : reject(new Error("Razorpay Checkout did not initialize."));
    script.onerror = () => {
      razorpayScriptPromise = null;
      reject(new Error("Unable to load Razorpay Checkout."));
    };
    document.body.appendChild(script);
  });
  return razorpayScriptPromise;
}

/** Formats an amount in the currency the customer picked it in. */
function formatMoney(value: number, currency: string): string {
  const amount = Number.isFinite(value) ? value : 0;
  if (currency === "INR") return formatINR(amount);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * The pending deposit is mirrored into localStorage so a refresh, an
 * accidental tab close, or a phone locking the screen never destroys a QR the
 * customer is about to pay. The QR image itself is NOT stored — it is
 * regenerated in the browser from the stored UPI intent, so nothing sensitive
 * is written to disk.
 */
const PENDING_STORAGE_KEY = "smmup_pending_deposit_v2";

interface PendingDeposit {
  method: PaymentMethodId;
  transactionId: string;
  /** The amount credited to the wallet, always INR. */
  amount: number;
  /** The amount in the method's own currency. */
  displayAmount: number;
  currency: string;
  createdAt: number;
  upiIntent?: string;
  upiVpa?: string;
  upiUrl?: string;
  checkoutUrl?: string;
  memo?: string;
  requestedAmount?: number;
  paymentUrl?: string;
  trackId?: string;
}

/**
 * The three states a deposit moves through, shown as a timeline so the
 * customer can tell "the provider has not told us yet" apart from "the
 * provider confirmed it and we credited it". The last step is the only one
 * that means money is in the wallet.
 */
function PaymentTimeline({ stage }: { stage: "created" | "paid" | "credited" }) {
  const steps = [
    { id: "created", label: "Order created", hint: "We opened the order with our payment partner" },
    { id: "paid", label: "Payment received", hint: "Your bank or wallet confirmed the transfer" },
    { id: "credited", label: "Credited to wallet", hint: "Your SMM UP balance is updated" },
  ];
  const reached = steps.findIndex((step) => step.id === stage);
  return (
    <ol className="border border-white/[0.08] bg-black/30 px-4 py-3.5">
      {steps.map((step, index) => {
        const done = index <= reached;
        const current = index === reached;
        return (
          <li key={step.id} className="flex items-start gap-3">
            <div className="flex flex-col items-center shrink-0">
              <span
                className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                  done
                    ? "border-emerald-400/60 bg-emerald-400/15"
                    : "border-white/15 bg-transparent"
                }`}
              >
                {done ? (
                  <Check className="w-3 h-3 text-emerald-300" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                )}
              </span>
              {index < steps.length - 1 && (
                <span className={`w-px flex-1 min-h-5 ${index < reached ? "bg-emerald-400/40" : "bg-white/10"}`} />
              )}
            </div>
            <div className="pb-3 last:pb-0 min-w-0">
              <p className={`text-[11px] font-semibold ${done ? "text-white" : "text-zinc-500"}`}>
                {step.label}
                {current && !done ? "…" : ""}
              </p>
              <p className="text-[10px] text-zinc-600 mt-0.5 leading-relaxed">{step.hint}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function readPendingDeposit(): PendingDeposit | null {
  try {
    const raw = window.localStorage.getItem(PENDING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingDeposit;
    if (!parsed || typeof parsed.transactionId !== "string" || !parsed.method) return null;
    // Anything older than 24 hours is meaningless.
    if (Date.now() - Number(parsed.createdAt || 0) > 24 * 60 * 60 * 1000) {
      window.localStorage.removeItem(PENDING_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writePendingDeposit(value: PendingDeposit) {
  try {
    window.localStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // A full or blocked storage must never break the payment flow.
  }
}

function clearPendingDeposit() {
  try {
    window.localStorage.removeItem(PENDING_STORAGE_KEY);
  } catch {
    // Ignore.
  }
}

const METHOD_ICONS: Record<PaymentMethodId, React.ReactNode> = {
  famgateway_upi: <Zap className="w-5 h-5" />,
  direct_upi: <QrCode className="w-5 h-5" />,
  oxapay_crypto: <Bitcoin className="w-5 h-5" />,
  razorpay: <CreditCard className="w-5 h-5" />,
};

export default function AddFundsPage({
  user,
  onDepositSuccess,
}: AddFundsPageProps) {
  // ── Flow state ────────────────────────────────────────────────────────────
  const [activeStep, setActiveStep] = React.useState<FlowStep>("method");
  const [selectedMethodId, setSelectedMethodId] = React.useState<PaymentMethodId | null>(null);
  const [amount, setAmount] = React.useState<number | string>("");
  const [amountError, setAmountError] = React.useState("");

  // ── Available methods (the single source of truth) ───────────────────────
  const [methods, setMethods] = React.useState<PaymentMethodDescriptor[]>([]);
  const [methodsLoaded, setMethodsLoaded] = React.useState(false);
  const [methodsError, setMethodsError] = React.useState("");

  // ── Shared UI feedback ────────────────────────────────────────────────────
  const [pageError, setPageError] = React.useState("");
  const [pageSuccess, setPageSuccess] = React.useState("");

  // ── Razorpay ──────────────────────────────────────────────────────────────
  const [razorpayLoading, setRazorpayLoading] = React.useState(false);
  const [razorpayVerifying, setRazorpayVerifying] = React.useState(false);
  const [razorpayConfig, setRazorpayConfig] = React.useState<{
    loaded: boolean;
    mode: "test" | "live";
    testWalletCreditEnabled: boolean;
  }>({ loaded: false, mode: "test", testWalletCreditEnabled: false });

  // ── Direct UPI ────────────────────────────────────────────────────────────
  const [qrData, setQrData] = React.useState<{
    qrUrl: string;
    upiUrl: string;
    memo: string;
    transactionId: string;
    requestedAmount: number;
    amount: number;
    upiVpa: string;
  } | null>(null);
  const [utrNumber, setUtrNumber] = React.useState("");
  const [verifying, setVerifying] = React.useState(false);
  const [verifyError, setVerifyError] = React.useState("");
  const [verifySuccess, setVerifySuccess] = React.useState("");
  const [copiedVpa, setCopiedVpa] = React.useState(false);
  const [copiedMemo, setCopiedMemo] = React.useState(false);

  // ── UPI Automatic (FamGateway) ────────────────────────────────────────────
  const [famOrder, setFamOrder] = React.useState<{
    qrUrl: string;
    upiUrl: string;
    upiVpa: string;
    amount: number;
    transactionId: string;
    orderId: string;
    checkoutUrl?: string;
  } | null>(null);

  // ── Crypto (OxaPay) ───────────────────────────────────────────────────────
  const [cryptoOrder, setCryptoOrder] = React.useState<{
    trackId: string;
    paymentUrl: string;
    amount: number;
    transactionId: string;
  } | null>(null);

  // ── Pending deposit (mirrored to localStorage) ───────────────────────────
  const [pendingDeposit, setPendingDeposit] = React.useState<PendingDeposit | null>(null);
  const [expiresInSeconds, setExpiresInSeconds] = React.useState<number>(0);
  const [copiedAmount, setCopiedAmount] = React.useState(false);
  const [copiedLink, setCopiedLink] = React.useState(false);
  const [restoring, setRestoring] = React.useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = React.useState(false);
  const [cancelling, setCancelling] = React.useState(false);
  /**
   * True while the provider is building the order/invoice.
   *
   * The step changes to "pay" the instant the button is pressed, so the
   * customer never stares at a frozen amount screen. The screen that appears
   * is the real one, with the amount already known, and it fills in the QR or
   * the checkout link the moment the provider answers.
   */
  const [creatingOrder, setCreatingOrder] = React.useState(false);
  // "created" → "paid" → "credited". The customer can see exactly where
  // their payment is, instead of guessing from a spinner.
  const [timelineStage, setTimelineStage] = React.useState<"created" | "paid" | "credited">("created");

  // ── Live status ───────────────────────────────────────────────────────────
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
  const pollingRef = React.useRef<any>(null);
  const timerRef = React.useRef<any>(null);

  // ── History ───────────────────────────────────────────────────────────────
  const [transactions, setTransactions] = React.useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = React.useState(false);

  React.useEffect(() => {
    loadHistory();
    loadPaymentMethods();
    // Warm the provider routes while the customer is still reading the page.
    //
    // A serverless function that has been idle has to boot before it can
    // answer, and that boot is what makes a "Pay" button feel slow. Asking
    // each provider's config route in the background, in parallel with the
    // method list, means the route is already warm by the time the customer
    // has picked an amount. It costs nothing the customer can see.
    const warm = () => {
      fetch("/api/famgateway/config", { cache: "no-store" }).catch(() => undefined);
      fetch("/api/oxapay/config", { cache: "no-store" }).catch(() => undefined);
    };
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const handle = (window as any).requestIdleCallback(warm, { timeout: 2500 });
      return () => {
        (window as any).cancelIdleCallback?.(handle);
        stopPolling();
      };
    }
    const timer = setTimeout(warm, 600);
    return () => {
      clearTimeout(timer);
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const methodById = (id: PaymentMethodId) => methods.find((m) => m.id === id);
  const selectedMethod = selectedMethodId ? methodById(selectedMethodId) : undefined;
  const selectedAmount = Number(amount);

  const isEligible = (method?: PaymentMethodDescriptor) => Boolean(
    method
    && Number.isFinite(selectedAmount)
    && selectedAmount >= method.minAmount
    && selectedAmount <= method.maxAmount
    && Math.abs(selectedAmount * 100 - Math.round(selectedAmount * 100)) < 0.0001,
  );

  /**
   * Single source of truth for what the customer may use. The server returns
   * only enabled + configured methods, so the absence of a method here means
   * it must not be shown at all.
   */
  const loadPaymentMethods = async () => {
    setMethodsLoaded(false);
    setMethodsError("");
    try {
      const res = await fetch("/api/payments/methods", { cache: "no-store" });
      const data = await readApiPayload(res);
      if (!res.ok || !data.success || !Array.isArray(data.methods)) {
        throw new Error(data.error || "Payment methods are unavailable.");
      }
      const safe: PaymentMethodDescriptor[] = data.methods
        .filter((m: any) => m && typeof m.id === "string" && m.enabled === true)
        .map((m: any): PaymentMethodDescriptor => ({
          id: m.id as PaymentMethodId,
          label: String(m.label || m.id),
          enabled: true,
          minAmount: Number(m.minAmount) || 0,
          maxAmount: Number(m.maxAmount) || 0,
          currency: String(m.currency || "INR").toUpperCase(),
          presets: Array.isArray(m.presets) && m.presets.length
            ? m.presets.map((p: any) => Number(p)).filter((p: number) => Number.isFinite(p) && p > 0)
            : [],
          inrRate: Number(m.inrRate) || 1,
          feePayer: m.feePayer === "customer" ? "customer" : "merchant",
          hostedRedirect: Boolean(m.hostedRedirect),
          description: String(m.description || ""),
        }))
        .filter((m: PaymentMethodDescriptor) => m.minAmount > 0 && m.maxAmount >= m.minAmount);

      setMethods(safe);
      setMethodsLoaded(true);

      // Razorpay needs one extra read for the Checkout mode (test vs live).
      if (safe.some((m) => m.id === "razorpay")) loadRazorpayConfig();
    } catch (error: any) {
      setMethods([]);
      setMethodsLoaded(true);
      setMethodsError(error?.message || "Payment methods are unavailable.");
    }
  };

  const loadRazorpayConfig = async () => {
    setRazorpayConfig((current) => ({ ...current, loaded: false }));
    try {
      const res = await fetch("/api/razorpay/config", { cache: "no-store" });
      const data = await readApiPayload(res);
      setRazorpayConfig({
        loaded: true,
        mode: data.mode === "live" ? "live" : "test",
        testWalletCreditEnabled: Boolean(data.testWalletCreditEnabled),
      });
    } catch {
      setRazorpayConfig({ loaded: true, mode: "test", testWalletCreditEnabled: false });
    }
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/payments/history");
      const data = await readApiPayload(res);
      if (res.ok && data.transactions) {
        setTransactions(data.transactions);
      }
    } catch { /* history is best-effort */ }
    setLoadingHistory(false);
  };

  // ── Pending deposit: remember, restore, cancel ────────────────────────────

  const rememberPending = (value: PendingDeposit) => {
    setPendingDeposit(value);
    writePendingDeposit(value);
  };

  const forgetPending = () => {
    setPendingDeposit(null);
    clearPendingDeposit();
  };

  /**
   * Restores an in-flight payment after a refresh or an accidental tab close.
   * The provider order is still live, so the customer must be able to keep
   * paying — and the QR must still be on screen.
   */
  const restorePendingDeposit = React.useCallback(async () => {
    const stored = readPendingDeposit();
    if (!stored) return;

    setRestoring(true);
    try {
      const method = methods.find((m) => m.id === stored.method);
      if (!method) {
        // The method was switched off while the payment was in flight.
        forgetPending();
        return;
      }

      if (stored.method === "famgateway_upi") {
        const res = await fetch(`/api/famgateway/status?transactionId=${encodeURIComponent(stored.transactionId)}`, { cache: "no-store" });
        const data = await readApiPayload(res);
        if (!res.ok) { forgetPending(); return; }
        if (data.status === "paid" || data.status === "test_paid") {
          forgetPending();
          setSelectedMethodId("famgateway_upi");
          setPageSuccess(data.message || "Your payment was already confirmed and credited.");
      setTimelineStage("credited");
          if (data.newBalance !== undefined) onDepositSuccess(data.newBalance);
          loadHistory();
          setActiveStep("pay");
          return;
        }
        if (data.status !== "pending" || !stored.upiIntent) { forgetPending(); return; }
        const qrUrl = await QRCode.toDataURL(stored.upiIntent, { errorCorrectionLevel: "M", margin: 2, width: 600, color: { dark: "#000000", light: "#ffffff" } });
        setSelectedMethodId("famgateway_upi");
        setPendingDeposit(stored);
        setExpiresInSeconds(Math.max(0, 300 - Math.floor((Date.now() - stored.createdAt) / 1000)));
        setFamOrder({
          qrUrl,
          upiUrl: stored.upiIntent,
          upiVpa: stored.upiVpa || "",
          amount: stored.amount,
          transactionId: stored.transactionId,
          orderId: "",
          checkoutUrl: stored.checkoutUrl,
        });
        setActiveStep("pay");
        return;
      }

      if (stored.method === "direct_upi") {
        const res = await fetch(`/api/payments/check-status?transactionId=${encodeURIComponent(stored.transactionId)}`, { cache: "no-store" });
        const data = await readApiPayload(res);
        if (!res.ok) { forgetPending(); return; }
        if (data.status === "paid") {
          forgetPending();
          setSelectedMethodId("direct_upi");
          setVerifySuccess(data.message || "Your payment was already confirmed and credited.");
          if (data.newBalance !== undefined) onDepositSuccess(data.newBalance);
          loadHistory();
          setActiveStep("pay");
          return;
        }
        if (data.status !== "pending" || !stored.upiUrl) { forgetPending(); return; }
        const qrUrl = await QRCode.toDataURL(stored.upiUrl, { errorCorrectionLevel: "M", margin: 2, width: 600, color: { dark: "#000000", light: "#ffffff" } });
        setSelectedMethodId("direct_upi");
        setPendingDeposit(stored);
        setExpiresInSeconds(Math.max(0, 1800 - Math.floor((Date.now() - stored.createdAt) / 1000)));
        setQrData({
          qrUrl,
          upiUrl: stored.upiUrl,
          memo: stored.memo || "",
          transactionId: stored.transactionId,
          requestedAmount: stored.requestedAmount ?? stored.amount,
          amount: stored.amount,
          upiVpa: stored.upiVpa || "",
        });
        setActiveStep("pay");
        return;
      }

      if (stored.method === "oxapay_crypto") {
        const res = await fetch(`/api/oxapay/status?transactionId=${encodeURIComponent(stored.transactionId)}`, { cache: "no-store" });
        const data = await readApiPayload(res);
        if (!res.ok) { forgetPending(); return; }
        if (data.status === "paid" || data.status === "test_paid") {
          forgetPending();
          setSelectedMethodId("oxapay_crypto");
          setPageSuccess(data.message || "Your payment was already confirmed and credited.");
      setTimelineStage("credited");
          if (data.newBalance !== undefined) onDepositSuccess(data.newBalance);
          loadHistory();
          setActiveStep("pay");
          return;
        }
        if (data.status === "review") {
          forgetPending();
          setSelectedMethodId("oxapay_crypto");
          setPageSuccess(data.message || "Your payment is being reviewed by our team.");
          setActiveStep("pay");
          return;
        }
        setSelectedMethodId("oxapay_crypto");
        setPendingDeposit(stored);
        setExpiresInSeconds(Math.max(0, 3600 - Math.floor((Date.now() - stored.createdAt) / 1000)));
        setCryptoOrder({
          trackId: stored.trackId || "",
          paymentUrl: stored.paymentUrl || data.paymentUrl || "",
          amount: stored.amount,
          transactionId: stored.transactionId,
        });
        setActiveStep("pay");
        return;
      }
    } catch {
      // A failed restore must never block a fresh payment.
    } finally {
      setRestoring(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [methods]);

  /** Cancels the pending request so the customer can create a correct one. */
  const cancelPendingDeposit = async () => {
    if (!pendingDeposit) return;
    setCancelling(true);
    try {
      const res = await fetch("/api/payments/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: pendingDeposit.transactionId }),
      });
      const data = await readApiPayload(res);
      if (!res.ok) {
        setPageError(data.error || "Unable to cancel this payment request.");
        setCancelConfirmOpen(false);
        return;
      }
      forgetPending();
      setFamOrder(null);
      setQrData(null);
      setCryptoOrder(null);
      setCancelConfirmOpen(false);
      setPageError("");
      setPageSuccess("Payment request cancelled. Pick the correct amount and generate a new one.");
      setActiveStep("amount");
      loadHistory();
    } catch {
      setPageError("Network error while cancelling. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

  // ── Step navigation ───────────────────────────────────────────────────────

  const chooseMethod = (method: PaymentMethodDescriptor) => {
    setSelectedMethodId(method.id);
    setAmountError("");
    setPageError("");
    setPageSuccess("");
    setTimelineStage("created");
    // Preset the amount so the customer only has to adjust if they want to.
    const presets = method.presets.length ? method.presets : [method.minAmount];
    const preferred = method.currency === "INR" ? 500 : 10;
    const closest = presets.reduce((best, value) =>
      Math.abs(value - preferred) < Math.abs(best - preferred) ? value : best, presets[0]);
    setAmount(closest);
    setActiveStep("amount");
  };

  const backToMethods = () => {
    stopPolling();
    setPageError("");
    setPageSuccess("");
    setActiveStep("method");
  };

  const backToAmount = () => {
    stopPolling();
    setPageError("");
    setPageSuccess("");
    setActiveStep("amount");
  };

  // ── Direct UPI ────────────────────────────────────────────────────────────

  const handleGenerateQR = async () => {
    if (!selectedMethod) return;
    const num = Number(amount);
    if (!isEligible(selectedMethod)) {
      setAmountError(
        `${selectedMethod.label} accepts ${formatMoney(selectedMethod.minAmount, selectedMethod.currency)}–${formatMoney(selectedMethod.maxAmount, selectedMethod.currency)} with no more than 2 decimal places.`,
      );
      setActiveStep("amount");
      return;
    }

    setAmountError("");
    setPageError("");
    setPageSuccess("");
    setVerifyError("");
    setVerifySuccess("");
    setUtrNumber("");
    try {
      const res = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: num }),
      });
      const data = await readApiPayload(res);
      if (
        res.ok
        && data.success
        && typeof data.upiUrl === "string"
        && typeof data.memo === "string"
        && typeof data.transactionId === "string"
        && typeof data.upiVpa === "string"
        && Number.isFinite(Number(data.amount))
      ) {
        const qrUrl = await QRCode.toDataURL(data.upiUrl, {
          errorCorrectionLevel: "M",
          margin: 2,
          width: 600,
          color: { dark: "#000000", light: "#ffffff" },
        });
        setQrData({
          qrUrl,
          upiUrl: data.upiUrl,
          memo: data.memo,
          transactionId: data.transactionId,
          requestedAmount: Number(data.requestedAmount ?? num),
          amount: Number(data.amount),
          upiVpa: data.upiVpa,
        });
        setExpiresInSeconds(Number(data.expiresInSeconds || 0));
        rememberPending({
          method: "direct_upi",
          transactionId: String(data.transactionId || ""),
          amount: Number(data.amount),
          displayAmount: num,
          currency: selectedMethod.currency,
          createdAt: Date.now(),
          upiUrl: data.upiUrl,
          upiVpa: data.upiVpa,
          memo: data.memo,
          requestedAmount: Number(data.requestedAmount ?? num),
        });
        setActiveStep("pay");
      } else {
        setPageError(data.error || "Failed to generate the Direct UPI payment QR.");
        setActiveStep("amount");
      }
    } catch {
      setPageError("Network error while creating the Direct UPI payment. Try again.");
      setActiveStep("amount");
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

      const data = await readApiPayload(res);
      if (!res.ok || data.error) {
        const supportCode = typeof data.errorCode === "string" && data.errorCode
          ? ` Reference: ${data.errorCode}.`
          : "";
        setVerifyError(`${data.error || "Payment verification failed."}${supportCode}`);
      } else {
        stopPolling();
        forgetPending();
        setVerifySuccess(data.message || "Payment verified and credited!");
      setTimelineStage("credited");
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

  const copyAmount = () => {
    const value = famOrder?.amount ?? qrData?.amount ?? cryptoOrder?.amount;
    if (!value) return;
    navigator.clipboard.writeText(String(value));
    setCopiedAmount(true);
    setTimeout(() => setCopiedAmount(false), 2000);
  };

  const copyCheckoutLink = () => {
    const link = cryptoOrder?.paymentUrl;
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyMemo = () => {
    if (qrData?.memo) {
      navigator.clipboard.writeText(qrData.memo);
      setCopiedMemo(true);
      setTimeout(() => setCopiedMemo(false), 2000);
    }
  };

  // ── UPI Automatic (FamGateway) ────────────────────────────────────────────

  const handleFamGatewayPayment = async () => {
    if (!selectedMethod) return;
    const num = Number(amount);
    if (!isEligible(selectedMethod)) {
      setAmountError(
        `${selectedMethod.label} accepts ${formatMoney(selectedMethod.minAmount, selectedMethod.currency)}–${formatMoney(selectedMethod.maxAmount, selectedMethod.currency)}.`,
      );
      setActiveStep("amount");
      return;
    }

    setAmountError("");
    setPageError("");
    setPageSuccess("");
    // Move first, ask second. The screen changes instantly; the QR arrives
    // a moment later. A cold provider call is a slow network, not a slow UI.
    setCreatingOrder(true);
    setActiveStep("pay");
    try {
      const res = await fetch("/api/famgateway/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: num }),
      });
      const data = await readApiPayload(res);
      if (!res.ok || !data.success || typeof data.upiIntent !== "string" || !data.upiIntent) {
        throw new Error(data.error || "Unable to start a UPI Automatic payment.");
      }
      const qrUrl = await QRCode.toDataURL(data.upiIntent, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 600,
        color: { dark: "#000000", light: "#ffffff" },
      });
      setFamOrder({
        qrUrl,
        upiUrl: data.upiIntent,
        upiVpa: String(data.upiId || ""),
        amount: Number(data.amount ?? num),
        transactionId: String(data.transactionId || ""),
        orderId: String(data.orderId || ""),
        checkoutUrl: typeof data.checkoutUrl === "string" ? data.checkoutUrl : undefined,
      });
      setExpiresInSeconds(Number(data.expiresInSeconds || 0));
      setCreatingOrder(false);
      rememberPending({
        method: "famgateway_upi",
        transactionId: String(data.transactionId || ""),
        amount: Number(data.amount ?? num),
        displayAmount: num,
        currency: selectedMethod.currency,
        createdAt: Date.now(),
        upiIntent: data.upiIntent,
        upiVpa: String(data.upiId || ""),
        checkoutUrl: typeof data.checkoutUrl === "string" ? data.checkoutUrl : undefined,
      });
    } catch (error: any) {
      setCreatingOrder(false);
      setPageError(error?.message || "Unable to start a UPI Automatic payment. Please try again.");
      setActiveStep("amount");
    }
  };

  // ── Crypto (OxaPay) ───────────────────────────────────────────────────────

  const handleCryptoPayment = async () => {
    if (!selectedMethod) return;
    const num = Number(amount);
    if (!isEligible(selectedMethod)) {
      setAmountError(
        `${selectedMethod.label} accepts ${formatMoney(selectedMethod.minAmount, selectedMethod.currency)}–${formatMoney(selectedMethod.maxAmount, selectedMethod.currency)}.`,
      );
      setActiveStep("amount");
      return;
    }

    setAmountError("");
    setPageError("");
    setPageSuccess("");
    // Move first, ask second.
    setCreatingOrder(true);
    setActiveStep("pay");
    try {
      const res = await fetch("/api/oxapay/create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: num, currency: selectedMethod.currency }),
      });
      const data = await readApiPayload(res);
      if (!res.ok || !data.success || typeof data.paymentUrl !== "string" || !data.paymentUrl) {
        throw new Error(data.error || "Unable to start a crypto payment.");
      }
      setCryptoOrder({
        trackId: String(data.trackId || ""),
        paymentUrl: data.paymentUrl,
        amount: Number(data.amount ?? num),
        transactionId: String(data.transactionId || ""),
      });
      setExpiresInSeconds(Number(data.expiresInSeconds || 0));
      setCreatingOrder(false);
      rememberPending({
        method: "oxapay_crypto",
        transactionId: String(data.transactionId || ""),
        amount: Number(data.amount ?? num),
        displayAmount: num,
        currency: selectedMethod.currency,
        createdAt: Date.now(),
        paymentUrl: data.paymentUrl,
        trackId: String(data.trackId || ""),
      });
    } catch (error: any) {
      setCreatingOrder(false);
      setPageError(error?.message || "Unable to start a crypto payment. Please try again.");
      setActiveStep("amount");
    }
  };

  /** Re-checks a crypto invoice after the customer returns from the provider. */
  const verifyCryptoPayment = async (transactionId: string) => {
    const res = await fetch("/api/oxapay/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId }),
    });
    const data = await readApiPayload(res);
    if (!res.ok) throw new Error(data.error || "Unable to verify the crypto payment.");
    if (data.status === "paid" || data.status === "test_paid") {
      forgetPending();
      setPageSuccess(data.message || "Payment confirmed and credited to your wallet.");
      setTimelineStage("credited");
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
      if (data.walletCredited && data.newBalance !== undefined) onDepositSuccess(data.newBalance);
      loadHistory();
      return true;
    }
    if (data.status === "review") {
      setPageSuccess(data.message || "Your payment is being reviewed by our team. Please do not pay again.");
      loadHistory();
      return true;
    }
    return false;
  };

  // ── Razorpay ──────────────────────────────────────────────────────────────

  const applyRazorpayResult = (data: any) => {
    setRazorpayVerifying(false);
    forgetPending();
    setPageError("");
    setPageSuccess(data.message || "Razorpay payment verified successfully.");
    setTimelineStage("credited");
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
      const data = await readApiPayload(res);
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
    if (!selectedMethod) return;
    const num = Number(amount);
    if (!isEligible(selectedMethod)) {
      setAmountError(
        `${selectedMethod.label} accepts ${formatMoney(selectedMethod.minAmount, selectedMethod.currency)}–${formatMoney(selectedMethod.maxAmount, selectedMethod.currency)}.`,
      );
      setActiveStep("amount");
      return;
    }

    setPageError("");
    setPageSuccess("");
    setRazorpayLoading(true);
    try {
      await loadRazorpayCheckout();
      const orderRes = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: num }),
      });
      const order = await readApiPayload(orderRes);
      if (!orderRes.ok || !order.success) {
        throw new Error(order.error || "Unable to create Razorpay order.");
      }
      if (!window.Razorpay) throw new Error("Razorpay Checkout is unavailable.");

      setActiveStep("pay");

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
          setPageError("");
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
            const verified = await readApiPayload(verifyRes);
            if (verifyRes.ok && verifyRes.status !== 202) {
              applyRazorpayResult(verified);
            } else if (verifyRes.status === 202) {
              await pollRazorpayStatus(order.internalTransactionId);
            } else {
              throw new Error(verified.error || "Razorpay verification failed.");
            }
          } catch (error: any) {
            setRazorpayVerifying(false);
            setPageError(
              error?.message || "Payment confirmation is delayed. Check Recent Deposits shortly.",
            );
          }
        },
      });

      checkout.on("payment.failed", (response: any) => {
        setRazorpayVerifying(false);
        setPageError(
          response?.error?.description
            ? `Payment was not completed: ${response.error.description}`
            : "Payment was not completed. No wallet balance was added.",
        );
      });
      checkout.open();
    } catch (error: any) {
      setPageError(error?.message || "Unable to open Razorpay Checkout.");
      setActiveStep("amount");
    } finally {
      setRazorpayLoading(false);
    }
  };

  /** Single entry point for the "Pay" button. */
  const handlePay = async () => {
    if (!selectedMethod) return;
    setPageError("");
    setPageSuccess("");
    setTimelineStage("created");
    if (selectedMethod.id === "direct_upi") return handleGenerateQR();
    if (selectedMethod.id === "famgateway_upi") return handleFamGatewayPayment();
    if (selectedMethod.id === "oxapay_crypto") return handleCryptoPayment();
    if (selectedMethod.id === "razorpay") return handleRazorpayPayment();
  };

  // ── Live polling ──────────────────────────────────────────────────────────

  /** Direct UPI: watch our own record for the auto-detection result. */
  React.useEffect(() => {
    if (activeStep !== "pay" || selectedMethodId !== "direct_upi" || !qrData?.memo || verifySuccess) {
      stopPolling();
      return;
    }

    setElapsedSeconds(0);
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    const pollStatus = async () => {
      try {
        const res = await fetch(`/api/payments/check-status?transactionId=${encodeURIComponent(qrData.transactionId)}`);
        const data = await readApiPayload(res);
        if (res.ok && data.status === "paid") {
          stopPolling();
          forgetPending();
          setVerifySuccess(data.message || "Payment auto-detected & credited to wallet!");
          confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
          if (data.newBalance !== undefined) {
            onDepositSuccess(data.newBalance);
          }
          loadHistory();
        } else if (res.ok && data.status === "expired") {
          stopPolling();
          forgetPending();
          setVerifyError(data.message || "This payment request expired. Generate a fresh QR.");
        }
      } catch {
        // Silent catch during periodic polling
      }
    };

    const initialTimeout = setTimeout(pollStatus, 3000);
    pollingRef.current = setInterval(pollStatus, 3500);

    return () => {
      clearTimeout(initialTimeout);
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep, selectedMethodId, qrData?.memo, verifySuccess]);

  /**
   * UPI Automatic live status.
   *
   * The webhook does the crediting; this poll only reflects our own record so
   * the customer sees the wallet update without refreshing. If the local order
   * window closes while the provider still reports a payment, one final
   * authoritative verify is attempted before giving up.
   */
  React.useEffect(() => {
    if (activeStep !== "pay" || selectedMethodId !== "famgateway_upi" || !famOrder?.transactionId || pageSuccess) {
      stopPolling();
      return;
    }

    setElapsedSeconds(0);
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    let cancelled = false;
    let finalVerifyDone = false;

    const runFinalVerify = async () => {
      if (finalVerifyDone || cancelled) return;
      finalVerifyDone = true;
      try {
        const res = await fetch("/api/famgateway/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactionId: famOrder.transactionId }),
        });
        const data = await readApiPayload(res);
        if (!res.ok) return;
        if (data.status === "paid" || data.status === "test_paid") {
          stopPolling();
          setPageSuccess(data.message || "Payment confirmed and credited to your wallet.");
      setTimelineStage("credited");
          confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
          if (data.newBalance !== undefined) onDepositSuccess(data.newBalance);
          loadHistory();
        } else if (data.status === "expired") {
          stopPolling();
          setPageError("This payment request expired. Please start a new payment.");
        }
      } catch {
        // Silent — the reconciliation sweep will settle it if it was paid.
      }
    };

    const pollStatus = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(
          `/api/famgateway/status?transactionId=${encodeURIComponent(famOrder.transactionId)}`,
          { cache: "no-store" },
        );
        const data = await readApiPayload(res);
        if (!res.ok) return;
        if (data.status === "paid" || data.status === "test_paid") {
          stopPolling();
          forgetPending();
          setPageSuccess(data.message || "Payment confirmed and credited to your wallet.");
      setTimelineStage("credited");
          confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
          if (data.newBalance !== undefined) onDepositSuccess(data.newBalance);
          loadHistory();
        } else if (data.status === "expired") {
          stopPolling();
          await runFinalVerify();
        }
      } catch {
        // Silent catch during periodic polling
      }
    };

    const initialTimeout = setTimeout(pollStatus, 3000);
    pollingRef.current = setInterval(pollStatus, 3500);

    return () => {
      cancelled = true;
      clearTimeout(initialTimeout);
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep, selectedMethodId, famOrder?.transactionId, pageSuccess]);

  /**
   * The customer returns from the crypto provider's hosted page. We re-check
   * the invoice once, then keep polling for the webhook.
   */
  React.useEffect(() => {
    if (activeStep !== "pay" || selectedMethodId !== "oxapay_crypto" || !cryptoOrder?.transactionId) return;
    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        const done = await verifyCryptoPayment(cryptoOrder.transactionId);
        if (done) return;
      } catch {
        // Silent — keep polling until the attempt budget runs out.
      }
      if (attempts >= 20) {
        setPageSuccess(
          "Your payment is still being confirmed on the network. It is safe — your wallet is credited automatically once it clears.",
        );
        return;
      }
      setTimeout(poll, 4000);
    };

    const kickoff = setTimeout(poll, 1500);
    return () => {
      cancelled = true;
      clearTimeout(kickoff);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep, selectedMethodId, cryptoOrder?.transactionId]);

  /**
   * Restore an in-flight payment once the method list is known, and pick up
   * the customer coming back from the crypto provider (the return URL carries
   * the transaction id).
   */
  React.useEffect(() => {
    if (!methodsLoaded || pendingDeposit) return;
    void restorePendingDeposit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [methodsLoaded]);

  /**
   * The crypto provider returns the customer to `/add-funds?paid=1&tx=<id>`.
   * If localStorage was cleared, the transaction id in the URL is enough to
   * resume the check.
   */
  React.useEffect(() => {
    if (!methodsLoaded) return;
    const params = new URLSearchParams(window.location.search);
    const returnedTx = params.get("tx");
    if (!returnedTx || pendingDeposit) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/oxapay/status?transactionId=${encodeURIComponent(returnedTx)}`, { cache: "no-store" });
        const data = await readApiPayload(res);
        if (cancelled || !res.ok) return;
        setSelectedMethodId("oxapay_crypto");
        setCryptoOrder({
          trackId: "",
          paymentUrl: data.paymentUrl || "",
          amount: Number(data.amount || 0),
          transactionId: returnedTx,
        });
        setActiveStep("pay");
        if (data.status === "paid" || data.status === "test_paid") {
          setPageSuccess(data.message || "Payment confirmed and credited to your wallet.");
      setTimelineStage("credited");
          if (data.newBalance !== undefined) onDepositSuccess(data.newBalance);
          loadHistory();
        }
      } catch {
        // The customer landed back without a resolvable transaction.
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [methodsLoaded]);

  /** Counts the remaining life of the payment request. */
  React.useEffect(() => {
    if (!expiresInSeconds) return;
    const timer = setInterval(() => {
      setExpiresInSeconds((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresInSeconds > 0]);

  /** Warn the customer before they close a tab with a live payment. */
  React.useEffect(() => {
    if (!pendingDeposit || activeStep !== "pay") return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [pendingDeposit, activeStep]);

  // ── Render ────────────────────────────────────────────────────────────────

  const stepIndex = activeStep === "method" ? 0 : activeStep === "amount" ? 1 : 2;
  const steps = [
    { id: "method", label: "Method", number: "01" },
    { id: "amount", label: "Amount", number: "02" },
    { id: "pay", label: "Pay", number: "03" },
  ];

  return (
    <section className="min-h-[calc(100vh-4.5rem)] py-10 sm:py-14 lg:py-18">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-7">
          <a href="/" className="hover:text-white transition-colors">Home</a>
          <span aria-hidden="true">/</span>
          <span className="text-zinc-300">Add funds</span>
        </nav>

        <header className="grid lg:grid-cols-[minmax(0,1fr)_auto] gap-6 items-end pb-8 border-b border-white/[0.09] mb-8">
          <div>
            <div className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-400 mb-4">
              <ShieldCheck className="w-3.5 h-3.5" />
              Secure wallet funding
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-[0.02em] text-white">
              Add funds
            </h1>
            <p className="mt-3 max-w-2xl text-sm sm:text-base leading-relaxed text-zinc-400 font-light">
              {methods.length === 0
                ? "Payment methods are loading. Please refresh in a moment."
                : "Choose how you want to pay, then how much. Your wallet is credited only after that payment is confirmed."}
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
              {steps.map((step, index) => {
                const active = index === stepIndex;
                const complete = index < stepIndex;
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

            {/* ── STEP 1: CHOOSE THE METHOD ─────────────────────────────────── */}
            {activeStep === "method" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">How do you want to pay?</h2>
                  <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
                    Only methods that are live and fully configured are listed.
                  </p>
                </div>

                {/* A payment already in flight must never be forgotten. */}
                {pendingDeposit && (
                  <div className="p-4 border border-amber-400/30 bg-amber-400/[0.06] flex items-start gap-3">
                    <Clock className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-amber-200">
                        You have a payment request in progress · {formatINR(pendingDeposit.amount)}
                      </p>
                      <p className="text-[11px] leading-relaxed text-amber-200/70 mt-1">
                        Finish or cancel it before starting another one, so we never have two live requests at once.
                      </p>
                      <button
                        type="button"
                        onClick={() => { setActiveStep("pay"); }}
                        className="mt-2 text-[11px] text-amber-200 underline underline-offset-4 hover:text-white cursor-pointer"
                      >
                        Go back to it
                      </button>
                    </div>
                  </div>
                )}

                {!methodsLoaded ? (
                  <div className="p-4 border border-white/12 bg-white/[0.025] text-xs text-zinc-400 flex items-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading payment methods…
                  </div>
                ) : methods.length === 0 ? (
                  <div className="p-4 border border-white/15 bg-white/[0.04] text-xs text-zinc-300">
                    {methodsError || "No payment method is currently available. Please contact support."}
                    <button type="button" onClick={loadPaymentMethods} className="ml-2 underline underline-offset-2 text-zinc-100">Retry</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {methods.map((method) => (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => chooseMethod(method)}
                        className="w-full p-4 border border-white/12 bg-white/[0.025] hover:bg-white/[0.06] hover:border-white/25 transition-all text-left cursor-pointer group"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-11 h-11 border border-white/10 bg-black flex items-center justify-center shrink-0">
                            {METHOD_ICONS[method.id]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-sm font-bold text-white">{method.label}</span>
                              <span className="text-[9px] font-mono tracking-wider text-zinc-200 border border-white/15 px-2 py-1">
                                {method.feePayer === "customer" ? "NETWORK FEE BY YOU" : "0% FEE"}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">{method.description}</p>
                            <p className="text-[10px] text-zinc-500 mt-2">
                              {formatMoney(method.minAmount, method.currency)}–{formatMoney(method.maxAmount, method.currency)}
                              {method.currency !== "INR" && method.inrRate > 0 && (
                                <> · ≈ {formatINR(method.minAmount * method.inrRate)}–{formatINR(method.maxAmount * method.inrRate)}</>
                              )}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-white mt-3 shrink-0" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 text-[10px] leading-relaxed text-zinc-500">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Every method creates its own payment record with its own confirmation system. SMM UP never asks for your OTP, UPI PIN, card CVV, banking password or seed phrase.</span>
                </div>
              </div>
            )}

            {/* ── STEP 2: CHOOSE THE AMOUNT ─────────────────────────────────── */}
            {activeStep === "amount" && selectedMethod && (
              <div className="space-y-6">
                <button
                  type="button"
                  onClick={backToMethods}
                  className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-white underline underline-offset-4 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Change payment method
                </button>

                <div className="flex items-center justify-between gap-4 p-4 border border-white/[0.08] bg-black/40">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 border border-white/10 bg-black flex items-center justify-center shrink-0">
                      {METHOD_ICONS[selectedMethod.id]}
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 block mb-0.5">Paying with</span>
                      <span className="text-sm font-bold text-white block truncate">{selectedMethod.label}</span>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono tracking-wider text-zinc-200 border border-white/15 px-2 py-1 shrink-0">
                    {selectedMethod.feePayer === "customer" ? "NETWORK FEE BY YOU" : "0% FEE"}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-3">
                    How much do you want to add? ({selectedMethod.currency})
                  </label>

                  {selectedMethod.presets.length > 0 && (
                    <div className="grid grid-cols-4 gap-2.5 mb-4">
                      {selectedMethod.presets.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => { setAmount(preset); setAmountError(""); }}
                          className={`py-2.5 px-2 border text-xs font-semibold transition-all cursor-pointer ${
                            Number(amount) === preset
                              ? "bg-white text-black border-white"
                              : "border-white/12 bg-black/40 text-zinc-300 hover:border-white/30 hover:text-white"
                          }`}
                        >
                          {formatMoney(preset, selectedMethod.currency)}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-semibold pointer-events-none">
                      {selectedMethod.currency === "INR" ? "₹" : "$"}
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={selectedMethod.minAmount}
                      max={selectedMethod.maxAmount}
                      step="0.01"
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value);
                        setAmountError("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (isEligible(selectedMethod)) void handlePay();
                        }
                      }}
                      placeholder={`${selectedMethod.minAmount}–${selectedMethod.maxAmount}`}
                      className="w-full bg-black/60 border border-white/15 focus:border-white focus:ring-1 focus:ring-white/20 text-white pl-9 pr-4 py-3 text-sm rounded-none outline-none transition-all placeholder:text-zinc-500"
                    />
                    {/* Max — the ceiling this method allows, in one tap. */}
                    <button
                      type="button"
                      onClick={() => {
                        setAmount(String(selectedMethod.maxAmount));
                        setAmountError("");
                      }}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-300 border border-white/15 hover:border-white/40 hover:text-white transition-colors cursor-pointer"
                    >
                      Max
                    </button>
                  </div>

                  <p className="text-[11px] text-zinc-500 mt-2">
                    {formatMoney(selectedMethod.minAmount, selectedMethod.currency)} – {formatMoney(selectedMethod.maxAmount, selectedMethod.currency)}
                    {selectedMethod.currency !== "INR" && selectedMethod.inrRate > 0 && (
                      <> · credited as {formatINR(selectedMethod.minAmount * selectedMethod.inrRate)} – {formatINR(selectedMethod.maxAmount * selectedMethod.inrRate)}</>
                    )}
                  </p>

                  {!amountError && Number.isFinite(selectedAmount) && selectedAmount > 0 && !isEligible(selectedMethod) && (
                    <p className="text-[11px] text-amber-300/80 mt-1">
                      That amount is outside the range for this method.
                    </p>
                  )}
                  {isEligible(selectedMethod) && selectedMethod.currency !== "INR" && (
                    <p className="text-[11px] text-zinc-500 mt-1">
                      You will be credited <strong className="text-zinc-300">{formatINR(selectedAmount * selectedMethod.inrRate)}</strong> to your wallet.
                    </p>
                  )}
                </div>

                {selectedMethod.currency !== "INR" && selectedMethod.inrRate > 0 && (
                  <div className="p-3.5 border border-white/12 bg-white/[0.04] text-[11px] text-zinc-300 leading-relaxed">
                    The crypto network fee is paid by you on top of this amount. Your wallet is credited the full {selectedMethod.currency === "USD" ? `₹${(selectedMethod.inrRate).toFixed(0)}` : ""} equivalent shown above, at the rate locked when the invoice was created.
                  </div>
                )}

                {amountError && (
                  <div role="alert" className="p-3.5 border border-white/15 bg-white/[0.05] text-xs text-zinc-200 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{amountError}</span>
                  </div>
                )}
                {pageError && (
                  <div role="alert" className="p-3.5 border border-white/15 bg-white/[0.05] text-xs text-zinc-200 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{pageError}</span>
                  </div>
                )}

                {/* ── Summary rail ───────────────────────────────────────────
                    Everything the customer is agreeing to, in one place, so
                    nobody has to guess what will be charged or what will
                    land in the wallet. */}
                <div className="border border-white/[0.08] bg-black/30 divide-y divide-white/[0.07]">
                  <div className="flex items-center justify-between gap-4 px-4 py-3">
                    <span className="text-[11px] uppercase tracking-wider text-zinc-500">You will pay</span>
                    <span className="text-sm font-bold text-white">
                      {isEligible(selectedMethod) ? formatMoney(selectedAmount, selectedMethod.currency) : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 px-4 py-3">
                    <span className="text-[11px] uppercase tracking-wider text-zinc-500">Credited to wallet</span>
                    <span className="text-sm font-bold text-emerald-400">
                      {isEligible(selectedMethod)
                        ? formatINR(selectedMethod.currency === "INR"
                          ? selectedAmount
                          : selectedAmount * selectedMethod.inrRate)
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 px-4 py-3">
                    <span className="text-[11px] uppercase tracking-wider text-zinc-500">Network fee</span>
                    <span className="text-xs font-semibold text-zinc-300">
                      {selectedMethod.feePayer === "customer"
                        ? "Paid by you on top"
                        : "Included — 0%"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 px-4 py-3">
                    <span className="text-[11px] uppercase tracking-wider text-zinc-500">Order valid for</span>
                    <span className="text-xs font-semibold text-zinc-300">
                      {selectedMethod.id === "oxapay_crypto" ? "60 minutes" : "5 minutes"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 px-4 py-3">
                    <span className="text-[11px] uppercase tracking-wider text-zinc-500">Allowed range</span>
                    <span className="text-xs font-semibold text-zinc-300">
                      {formatMoney(selectedMethod.minAmount, selectedMethod.currency)} – {formatMoney(selectedMethod.maxAmount, selectedMethod.currency)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePay}
                  disabled={!isEligible(selectedMethod) || razorpayLoading}
                  className="w-full py-3.5 px-6 rounded-none bg-white text-black font-bold disabled:opacity-50 disabled:cursor-not-allowed tracking-wider text-xs uppercase hover:bg-zinc-200 transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,255,255,0.3)] flex items-center justify-center gap-2 cursor-pointer"
                >
                  {razorpayLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>Pay {isEligible(selectedMethod) ? formatMoney(selectedAmount, selectedMethod.currency) : ""}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* ── STEP 3: COMPLETE THE PAYMENT ─────────────────────────────── */}
            {activeStep === "pay" && (
              <div className="space-y-6">
                {/* The customer must stay here until the payment lands. */}
                {!pageSuccess && (
                  <div role="alert" className="p-4 border border-red-500/40 bg-red-500/[0.07] flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-red-300">
                        Do not go back or close this page
                      </p>
                      <p className="text-[11px] leading-relaxed text-red-200/70 mt-1">
                        Your payment is only approved after the bank confirms it. Stay on this page until the status below turns green — you can refresh safely, the QR stays here.
                      </p>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={backToAmount}
                  className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-white underline underline-offset-4 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to amount
                </button>

                {pageSuccess && (
                  <div role="status" aria-live="polite" className="p-3.5 border border-white/15 bg-white/[0.06] text-xs text-zinc-100 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{pageSuccess}</span>
                  </div>
                )}

                {/* Where the payment is right now. */}
                <PaymentTimeline stage={timelineStage} />

                {/* The order is being built. The customer already knows the
                    amount and the method, so the screen is never blank and
                    never appears to hang — the QR simply resolves into it. */}
                {creatingOrder && (
                  <div role="status" aria-live="polite" className="p-6 border border-white/12 bg-white/[0.03] flex flex-col items-center gap-4 text-center">
                    <div className="w-40 h-40 border border-white/10 bg-black/40 flex items-center justify-center">
                      <Loader2 className="w-7 h-7 animate-spin text-zinc-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {selectedMethodId === "oxapay_crypto" ? "Opening your secure checkout…" : "Creating your secure QR…"}
                      </p>
                      <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed max-w-sm">
                        {selectedMethodId === "oxapay_crypto"
                          ? "We are asking OxaPay for a one-time payment link. This takes a second or two — do not close the page."
                          : "We are opening one order with our payment partner. This takes a second or two — do not close the page."}
                      </p>
                    </div>
                    {selectedMethod && (
                      <p className="text-[11px] text-zinc-400 font-mono">
                        {formatMoney(Number(amount), selectedMethod.currency)}
                        {selectedMethod.currency !== "INR" && selectedMethod.inrRate > 0
                          ? ` · credited as ${formatINR(Number(amount) * selectedMethod.inrRate)}`
                          : ""}
                      </p>
                    )}
                  </div>
                )}
                {pageError && (
                  <div role="alert" className="p-3.5 border border-white/15 bg-white/[0.05] text-xs text-zinc-200 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{pageError}</span>
                  </div>
                )}

                {/* Wrong amount? Cancel this request and create a correct one. */}
                {pendingDeposit && !pageSuccess && !cancelConfirmOpen && (
                  <div className="border border-white/10 bg-white/[0.02] p-3.5">
                    <button
                      type="button"
                      onClick={() => setCancelConfirmOpen(true)}
                      className="text-[11px] text-zinc-400 hover:text-white underline underline-offset-4 cursor-pointer"
                    >
                      Wrong amount? Cancel this payment request
                    </button>
                  </div>
                )}

                {pendingDeposit && cancelConfirmOpen && (
                  <div className="p-4 border border-white/15 bg-white/[0.05] space-y-3">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-zinc-300" />
                      <div>
                        <p className="text-xs font-bold text-white">Cancel this payment request?</p>
                        <p className="text-[11px] leading-relaxed text-zinc-400 mt-1">
                          The QR for {formatINR(pendingDeposit.amount)} will stop working here and you can create a new one with the correct amount.
                          If you have already paid, do not cancel — contact support so we can credit you properly.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setCancelConfirmOpen(false)}
                        disabled={cancelling}
                        className="py-2.5 px-4 border border-white/15 text-zinc-300 hover:text-white hover:bg-white/[0.04] text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-50"
                      >
                        Keep it
                      </button>
                      <button
                        type="button"
                        onClick={cancelPendingDeposit}
                        disabled={cancelling}
                        className="flex-1 py-2.5 px-4 bg-white text-black text-[11px] font-bold uppercase tracking-wider hover:bg-zinc-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        Yes, cancel it
                      </button>
                    </div>
                  </div>
                )}

                {/* UPI Automatic */}
                {selectedMethodId === "famgateway_upi" && famOrder && (
                  <>
                    <div className="flex flex-col items-center justify-center p-5 border border-white/10 bg-white/[0.015] text-center">
                      <div className="bg-white p-3 shadow-[0_0_30px_rgba(255,255,255,0.15)] mb-4">
                        <img
                          src={famOrder.qrUrl}
                          alt="UPI payment QR"
                          loading="eager"
                          decoding="async"
                          className="w-48 h-48 sm:w-52 sm:h-52 object-contain"
                        />
                      </div>

                      <div className="text-[10px] tracking-[0.22em] uppercase text-zinc-500 mb-1">Pay this exact amount</div>
                      <div className="text-xl font-bold text-white mb-1 inline-flex items-center gap-2">
                        {formatINR(famOrder.amount)}
                        <button
                          onClick={copyAmount}
                          className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                          title="Copy amount"
                        >
                          {copiedAmount ? <Check className="w-3.5 h-3.5 text-zinc-100" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <p className="max-w-md text-[11px] leading-relaxed text-zinc-400 mb-3">
                        Scan with GPay, PhonePe, Paytm or any UPI app. As soon as the bank receipt arrives, your wallet is credited automatically — there is nothing to submit.
                      </p>

                      {famOrder.upiVpa && (
                        <div className="text-xs text-zinc-400 mb-3">
                          UPI ID: <strong className="text-zinc-200">{famOrder.upiVpa}</strong>
                        </div>
                      )}

                      {/* Two ways to pay: the QR above, or the provider's own page. */}
                      <div className="w-full grid gap-2.5 sm:grid-cols-2">
                        <a
                          href={famOrder.upiUrl}
                          className="py-2.5 px-4 border border-white/20 bg-white/[0.05] text-white text-xs font-semibold hover:bg-white/[0.1] transition-all flex items-center justify-center gap-2"
                        >
                          <Smartphone className="w-4 h-4" />
                          <span>Pay with a UPI app</span>
                        </a>
                        {famOrder.checkoutUrl && (
                          <a
                            href={famOrder.checkoutUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="py-2.5 px-4 border border-white/20 bg-white/[0.05] text-white text-xs font-semibold hover:bg-white/[0.1] transition-all flex items-center justify-center gap-2"
                          >
                            <ChevronRight className="w-4 h-4" />
                            <span>Open the checkout page</span>
                          </a>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (!famOrder) return;
                          fetch("/api/famgateway/verify", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ transactionId: famOrder.transactionId }),
                          })
                            .then((res) => readApiPayload(res))
                            .then((data) => {
                              if (data.status === "paid" || data.status === "test_paid") {
                                forgetPending();
                                setPageSuccess(data.message || "Payment confirmed and credited to your wallet.");
      setTimelineStage("credited");
                                if (data.newBalance !== undefined) onDepositSuccess(data.newBalance);
                                loadHistory();
                              } else if (data.status === "expired") {
                                setPageError("This payment request expired. Please create a new one.");
                              }
                            })
                            .catch(() => {});
                        }}
                        className="mt-4 w-full py-2.5 px-4 border border-white/15 text-[11px] font-semibold uppercase tracking-wider text-zinc-200 hover:bg-white/[0.05] transition-all cursor-pointer"
                      >
                        I have paid — check now
                      </button>

                      <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 border border-white/10 bg-black/40 text-[10px] font-mono tracking-wider text-zinc-300">
                        {!pageSuccess && !pageError ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            WAITING FOR CONFIRMATION · {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, "0")}
                            {expiresInSeconds > 0 ? ` · EXPIRES IN ${Math.floor(expiresInSeconds / 60)}:${String(expiresInSeconds % 60).padStart(2, "0")}` : " · EXPIRED"}
                          </>
                        ) : pageSuccess ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            CONFIRMED · CREDITED TO WALLET
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3.5 h-3.5" />
                            NOT CONFIRMED
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] leading-relaxed text-zinc-500">
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                      <span>The QR is generated in your browser from the provider's UPI intent. Our payment credentials never reach your device, and your wallet is credited only after the bank confirms the transfer.</span>
                    </div>
                  </>
                )}

                {/* Direct UPI */}
                {selectedMethodId === "direct_upi" && qrData && (
                  <>
                    <div className="flex flex-col items-center justify-center p-5 border border-white/10 bg-white/[0.015] text-center">
                      <div className="bg-white p-3 shadow-[0_0_30px_rgba(255,255,255,0.15)] mb-4">
                        <img
                          src={qrData.qrUrl}
                          alt="Scan UPI QR"
                          loading="eager"
                          decoding="async"
                          className="w-48 h-48 sm:w-52 sm:h-52 object-contain"
                        />
                      </div>

                      <div className="text-[10px] tracking-[0.22em] uppercase text-zinc-500 mb-1">Pay this exact unique amount</div>
                      <div className="text-xl font-bold text-white mb-1 inline-flex items-center gap-2">
                        {formatINR(qrData.amount)}
                        <button
                          onClick={copyAmount}
                          className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                          title="Copy amount"
                        >
                          {copiedAmount ? <Check className="w-3.5 h-3.5 text-zinc-100" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <p className="max-w-md text-[11px] leading-relaxed text-zinc-400 mb-3">
                        You requested {formatINR(qrData.requestedAmount)}. The small paise adjustment is not a fee — the full {formatINR(qrData.amount)} is credited to your wallet and safely identifies this receipt if the UPI app removes the note.
                      </p>

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

                      <a
                        href={qrData.upiUrl}
                        className="sm:hidden w-full py-2.5 px-4 border border-white/20 bg-white/[0.05] text-white text-xs font-semibold hover:bg-white/[0.1] transition-all flex items-center justify-center gap-2 mb-3"
                      >
                        <Smartphone className="w-4 h-4" />
                        <span>Open in UPI App (GPay / PhonePe / Paytm)</span>
                      </a>

                      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] border border-white/10 text-xs text-zinc-300">
                        <Lock className="w-3 h-3" />
                        <span>Payment Reference: <code className="text-[#FAF9F7] font-mono font-bold">{qrData.memo}</code></span>
                        <button
                          onClick={copyMemo}
                          className="text-zinc-400 hover:text-white transition-colors ml-1 cursor-pointer"
                          title="Copy payment reference"
                        >
                          {copiedMemo ? <Check className="w-3 h-3 text-zinc-100" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <p className="mt-2 max-w-md text-[11px] leading-relaxed text-zinc-500">
                        This exact reference binds the incoming bank receipt to your pending deposit. Keep it unchanged in the UPI app.
                      </p>
                    </div>

                    <div className={`p-4 border transition-all duration-300 flex items-center justify-between ${
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
                            {verifySuccess ? "Payment Confirmed & Credited!" : "Listening for bank confirmation..."}
                          </div>
                          <div className="text-[11px] text-zinc-400">
                            {verifySuccess ? "Your wallet balance has been updated." : "Usually takes 15–30 seconds. Keep this screen open."}
                          </div>
                        </div>
                      </div>
                      {!verifySuccess && (
                        <div className="text-xs font-mono text-[#E4E4E7] bg-white/[0.04] px-2.5 py-1 rounded-sm border border-white/10 shrink-0">
                          {elapsedSeconds}s
                        </div>
                      )}
                    </div>

                    {elapsedSeconds >= 60 && !verifySuccess && (
                      <div className="p-3.5 border border-white/15 bg-white/[0.06] text-zinc-100 text-xs space-y-2">
                        <div className="flex items-center gap-2 font-medium">
                          <Clock className="w-4 h-4 text-zinc-100 shrink-0" />
                          <span>Taking longer than 60 seconds?</span>
                        </div>
                        <p className="text-[11px] text-zinc-300 leading-relaxed">
                          Bank notifications can be delayed. Enter any one exact receipt identifier — UTR, bank/UPI reference number, or FMPIB transaction ID — or contact support if the bank record is not available yet.
                        </p>
                        <a
                          href={pathFor("support")}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E4E4E7] hover:text-white underline underline-offset-4 cursor-pointer"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Talk to Executive Support on Telegram</span>
                        </a>
                      </div>
                    )}

                    <form onSubmit={handleManualVerify} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-2">
                          Enter UTR / Reference No. / FMPIB ID
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
                        <p className="text-[11px] text-zinc-400 mt-2 text-center leading-relaxed">
                          The website checks the trusted receipt using the exact identifier, amount and time, then binds it to an eligible request owned by this account.
                        </p>
                      </div>

                      {verifyError && (
                        <div role="alert" className="p-3.5 bg-white/[0.06] border border-white/15 text-zinc-100 text-xs flex items-start gap-2.5">
                          <AlertCircle className="w-4 h-4 shrink-0 text-zinc-100 mt-0.5" />
                          <span>{verifyError}</span>
                        </div>
                      )}

                      {verifySuccess && (
                        <div role="status" aria-live="polite" className="p-3.5 bg-white/[0.06] border border-white/15 text-zinc-100 text-xs flex items-start gap-2.5">
                          <CheckCircle2 className="w-4 h-4 shrink-0 text-zinc-100 mt-0.5" />
                          <span>{verifySuccess}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={verifying || utrNumber.trim().length < 6 || Boolean(verifySuccess)}
                        className="w-full py-3 px-6 rounded-none bg-white text-black font-bold tracking-wider text-xs uppercase hover:bg-zinc-200 transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,255,255,0.3)] disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
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
                    </form>
                  </>
                )}

                {/* Crypto */}
                {selectedMethodId === "oxapay_crypto" && cryptoOrder && (
                  <>
                    <div className="p-5 border border-white/10 bg-white/[0.015] space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="w-11 h-11 border border-white/10 bg-black flex items-center justify-center shrink-0">
                          <Bitcoin className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-bold text-white block">
                            Crypto deposit · {formatINR(cryptoOrder.amount)}
                          </span>
                          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                            Continue to the secure checkout, choose your coin and network, and pay the exact quoted amount.
                          </p>
                        </div>
                      </div>

                      <a
                        href={cryptoOrder.paymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3.5 px-6 rounded-none bg-white text-black font-bold tracking-wider text-xs uppercase hover:bg-zinc-200 transition-all duration-300 flex items-center justify-center gap-2"
                      >
                        <span>Open Secure Crypto Checkout</span>
                        <ChevronRight className="w-4 h-4" />
                      </a>

                      <p className="text-[10px] leading-relaxed text-zinc-500 text-center">
                        Keep this page open and press the button below when you have paid — or simply wait, the confirmation arrives automatically.
                      </p>

                      <div className="flex items-center justify-center gap-3 text-[10px] font-mono tracking-wider text-zinc-400">
                        {expiresInSeconds > 0 ? (
                          <span>INVOICE EXPIRES IN {Math.floor(expiresInSeconds / 60)}:{String(expiresInSeconds % 60).padStart(2, "0")}</span>
                        ) : (
                          <span>INVOICE EXPIRED</span>
                        )}
                        {cryptoOrder.paymentUrl && (
                          <button
                            type="button"
                            onClick={copyCheckoutLink}
                            className="underline underline-offset-2 hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1"
                          >
                            {copiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            copy link
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => verifyCryptoPayment(cryptoOrder.transactionId).catch(() => {})}
                        className="w-full py-2.5 px-6 border border-white/15 text-[11px] font-semibold uppercase tracking-wider text-zinc-200 hover:bg-white/[0.05] transition-all cursor-pointer"
                      >
                        I have paid — check now
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] leading-relaxed text-zinc-500">
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                      <span>The checkout runs on the provider's own secure page. We credit your wallet only after the provider's signed confirmation matches this exact request.</span>
                    </div>
                  </>
                )}

                {/* Razorpay */}
                {selectedMethodId === "razorpay" && (
                  <>
                    <div className="p-5 border border-white/10 bg-white/[0.015] flex items-center gap-4">
                      <div className="w-11 h-11 border border-white/10 bg-black flex items-center justify-center shrink-0">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-bold text-white block">
                          Razorpay Secure Checkout
                        </span>
                        <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                          {razorpayVerifying
                            ? "Verifying the Razorpay signature, captured amount and wallet settlement…"
                            : "The Razorpay checkout window should be open on your screen."}
                        </p>
                      </div>
                      {razorpayVerifying && <Loader2 className="w-5 h-5 animate-spin shrink-0" />}
                    </div>

                    {razorpayConfig.loaded && razorpayConfig.mode === "test" && (
                      <div className="p-3.5 border border-white/12 bg-white/[0.04] text-[11px] text-zinc-400 leading-relaxed">
                        {razorpayConfig.testWalletCreditEnabled
                          ? "Isolated staging credit is enabled for this Test Mode environment."
                          : "Test Mode is simulated and will not add spendable wallet balance."}
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-[10px] leading-relaxed text-zinc-500">
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                      <span>Card and banking credentials never enter SMM UP. The wallet is credited only after Razorpay's signature and captured amount are verified.</span>
                    </div>
                  </>
                )}
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
                          {t.method === "RAZORPAY"
                            ? "Razorpay"
                            : t.method === "FAMGATEWAY_UPI"
                              ? "UPI (Auto)"
                              : t.method === "OXAPAY_CRYPTO"
                                ? "Crypto"
                                : t.method === "FAMPAY_UPI"
                                  ? "Direct UPI"
                                  : "Payment"} &bull; Ref: {t.utr || t.transactionId || t.memo || "—"} &bull; {new Date(t.createdAt || t.created_at || Date.now()).toLocaleDateString()}
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
                Every payment method uses a separate record and its own confirmation system. SMM UP never asks for your OTP, UPI PIN, card CVV, banking password or seed phrase.
              </p>
              <a href={pathFor("support")} className="inline-flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white underline underline-offset-4">
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
