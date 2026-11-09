import type { Db, Document } from "mongodb";

/**
 * Payment method registry, toggle resolution and live configuration.
 *
 * A method is usable only when BOTH conditions hold:
 *   1. it is switched ON, and
 *   2. its provider credentials resolve in the environment.
 *
 * EVERY knob is configurable without touching code, through three layers,
 * first hit wins:
 *
 *   L2  MongoDB `payment_method_config` — live, changed from the owner bot or
 *       this module, no redeploy, full audit trail.
 *   L1  Vercel environment variable  — the deployment baseline, needs a
 *       redeploy.
 *   L0  the built-in default in this file.
 *
 * The switch has two layers of its own for the on/off flag:
 *   L1  MongoDB `payment_method_config` (runtime override; instant)
 *   L0  Vercel env var `PAYMENT_METHOD_<ID>_ENABLED` (baseline; needs redeploy)
 *
 * Turning a method OFF blocks only the creation of NEW orders. Settlement of
 * already-created orders is never gated, so a customer mid-payment is never
 * orphaned by an operational toggle.
 *
 * The website and the Telegram bot both read this module, so the limits the
 * customer sees are exactly the limits the API enforces.
 */

export type PaymentMethodId = "direct_upi" | "famgateway_upi" | "oxapay_crypto" | "razorpay";

export const PAYMENT_METHOD_IDS: PaymentMethodId[] = [
  "famgateway_upi",
  "direct_upi",
  "oxapay_crypto",
  "razorpay",
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodId, string> = {
  direct_upi: "Direct UPI",
  famgateway_upi: "UPI Automatic",
  oxapay_crypto: "Crypto",
  razorpay: "Razorpay",
};

/** Per-method live settings, as stored in MongoDB and exposed to the UI. */
export interface PaymentMethodSettings {
  enabled: boolean;
  minAmount: number;
  maxAmount: number;
  currency: string;
  presets: number[];
  inrRate: number;
  feePayer: "merchant" | "customer";
  hostedRedirect: boolean;
  description: string;
  /** Crypto only: who pays the rail fee. */
  feePaidByPayer: 0 | 1;
  /** Crypto only: under-payment coverage percentage (0-60). */
  underPaidCoverage: number;
  /** Crypto only: invoice lifetime in minutes (15-2880). */
  invoiceLifetimeMinutes: number;
  /** Crypto only: the description shown on the provider's hosted checkout. */
  invoiceDescription: string;
  /** Crypto only: the message shown on the provider's hosted checkout. */
  thanksMessage: string;
  /** UPI Automatic only: order lifetime in minutes (5-30). */
  orderLifetimeMinutes: number;
}

export interface PaymentMethodState extends PaymentMethodSettings {
  id: PaymentMethodId;
  label: string;
  configured: boolean;
  /**
   * The raw on/off switch, BEFORE the credential gate. `enabled` is the
   * effective state a customer sees; `toggleEnabled` is what the owner
   * actually turned on, so the control panel can say "switched on, but the
   * provider key is missing" instead of a misleading "off".
   */
  toggleEnabled: boolean;
  source: "runtime_config" | "env_default";
  reason: string | null;
}

/** Public shape consumed by the website deposit UI. */
export type PaymentMethodDescriptor = Omit<
  PaymentMethodState,
  "configured" | "source" | "reason" | "toggleEnabled" | "feePaidByPayer" | "underPaidCoverage" | "invoiceLifetimeMinutes" | "orderLifetimeMinutes" | "invoiceDescription" | "thanksMessage"
>;

const CONFIG_COLLECTION = "payment_method_config";
const CONFIG_DOC_ID = "global";

// ── Built-in defaults (L0) ──────────────────────────────────────────────────
export const MIN_DIRECT_UPI_AMOUNT_INR = 10;
export const MIN_FAMGATEWAY_AMOUNT_INR = 10;
export const MIN_OXAPAY_AMOUNT_INR = 100;
export const MIN_RAZORPAY_AMOUNT_INR = 10;
export const MIN_OXAPAY_AMOUNT_USD = 1;
export const MAX_OXAPAY_AMOUNT_USD = 500;

/** $1 = ₹98 by default. Adjustable live from the bot, or via env. */
export const DEFAULT_USD_TO_INR_RATE = 98;

const INR_PRESETS = [50, 100, 250, 500, 1000, 2500, 5000, 10000];
const USD_PRESETS = [1, 5, 10, 25, 50, 100, 250, 500];

const DEFAULT_DESCRIPTIONS: Record<PaymentMethodId, string> = {
  famgateway_upi:
    "Scan a QR with any UPI app. The bank receipt is detected and your wallet is credited automatically — no UTR entry needed.",
  direct_upi:
    "A dedicated QR for GPay, PhonePe and Paytm. You confirm the deposit with the UTR from your bank alert.",
  oxapay_crypto:
    "Pay with USDT, BTC or another supported coin on a secure hosted checkout. The network fee is yours to pay.",
  razorpay:
    "A Razorpay-hosted checkout for UPI, cards, netbanking and wallets. Card and banking credentials never enter SMM UP.",
};

export function envFlag(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === null || String(raw).trim() === "") return fallback;
  const value = String(raw).trim().toLowerCase();
  if (["1", "true", "yes", "on", "enabled"].includes(value)) return true;
  if (["0", "false", "no", "off", "disabled"].includes(value)) return false;
  return fallback;
}

export function envInt(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(process.env[name] ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(parsed, max));
}

export function envNumber(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseFloat(String(process.env[name] ?? ""));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(parsed, max));
}

export function isPaymentMethodId(value: unknown): value is PaymentMethodId {
  return typeof value === "string" && (PAYMENT_METHOD_IDS as string[]).includes(value);
}

// ── Runtime configuration document ─────────────────────────────────────────

export interface RuntimeMethodConfig {
  enabled?: boolean;
  min_amount?: number;
  max_amount?: number;
  currency?: string;
  presets?: number[];
  usd_to_inr_rate?: number;
  fee_paid_by_payer?: 0 | 1;
  under_paid_coverage?: number;
  invoice_description?: string;
  thanks_message?: string;
  invoice_lifetime_minutes?: number;
  order_lifetime_minutes?: number;
  updated_at?: Date;
  updated_by?: string;
}

interface RuntimeConfigShape extends Document {
  _id: string;
  methods?: Record<string, RuntimeMethodConfig>;
  updated_at?: Date;
  updated_by?: string;
  note?: string;
  created_at?: Date;
}

function configCollection(db: Db) {
  return db.collection<RuntimeConfigShape>(CONFIG_COLLECTION);
}

async function readRuntimeConfig(db: Db): Promise<RuntimeConfigShape | null> {
  try {
    return await configCollection(db).findOne({ _id: CONFIG_DOC_ID });
  } catch {
    // A missing collection is not an error; it simply means no runtime override.
    return null;
  }
}

// ── Env-derived baselines (L1) ──────────────────────────────────────────────

export function oxapayInvoiceCurrency(): string {
  return String(process.env.OXAPAY_INVOICE_CURRENCY || "USD").trim().toUpperCase() || "USD";
}

export function oxapayInrRate(): number {
  if (oxapayInvoiceCurrency() === "INR") return 1;
  return envNumber("OXAPAY_USD_TO_INR_RATE", DEFAULT_USD_TO_INR_RATE, 1, 10_000);
}

export function oxapayFeePaidByPayer(): 0 | 1 {
  return envFlag("OXAPAY_FEE_PAID_BY_PAYER", true) ? 1 : 0;
}

export function oxapayUnderPaidCoverage(): number {
  return Math.round(envNumber("OXAPAY_UNDER_PAID_COVERAGE", 5, 0, 60));
}

/** The text shown on the provider's hosted checkout. Adjustable, never hardcoded. */
export function oxapayInvoiceDescription(): string {
  return String(process.env.OXAPAY_INVOICE_DESCRIPTION || "SMM UP wallet top-up").trim().slice(0, 240) || "SMM UP wallet top-up";
}

export function oxapayThanksMessage(): string {
  return String(
    process.env.OXAPAY_THANKS_MESSAGE
    || "Payment received. Your SMM UP wallet has been credited automatically — you can close this page.",
  ).trim().slice(0, 480)
    || "Payment received. Your SMM UP wallet has been credited automatically — you can close this page.";
}

export function oxapayInvoiceLifetimeMinutes(): number {
  return envInt("OXAPAY_INVOICE_LIFETIME_MINUTES", 60, 15, 2880);
}

export function famgatewayOrderLifetimeMinutes(): number {
  return envInt("FAMGATEWAY_ORDER_LIFETIME_MINUTES", 5, 5, 30);
}

function envBaseline(id: PaymentMethodId): PaymentMethodSettings {
  const common = {
    feePayer: "merchant" as const,
    feePaidByPayer: 1 as 0 | 1,
    underPaidCoverage: 5,
    invoiceDescription: oxapayInvoiceDescription(),
    thanksMessage: oxapayThanksMessage(),
    invoiceLifetimeMinutes: oxapayInvoiceLifetimeMinutes(),
    orderLifetimeMinutes: famgatewayOrderLifetimeMinutes(),
    presets: INR_PRESETS,
  };

  switch (id) {
    case "famgateway_upi":
      return {
        ...common,
        enabled: envFlag("PAYMENT_METHOD_FAMGATEWAY_UPI_ENABLED", false),
        minAmount: envInt("FAMGATEWAY_MIN_DEPOSIT_INR", MIN_FAMGATEWAY_AMOUNT_INR, 1, 1_000_000),
        maxAmount: envInt("FAMGATEWAY_MAX_DEPOSIT_INR", 100_000, MIN_FAMGATEWAY_AMOUNT_INR, 1_000_000),
        currency: "INR",
        inrRate: 1,
        hostedRedirect: false,
        description: DEFAULT_DESCRIPTIONS.famgateway_upi,
      };
    case "direct_upi":
      return {
        ...common,
        enabled: envFlag("PAYMENT_METHOD_DIRECT_UPI_ENABLED", false),
        minAmount: envInt("DIRECT_UPI_MIN_DEPOSIT_INR", MIN_DIRECT_UPI_AMOUNT_INR, 1, 1_000_000),
        maxAmount: envInt("DIRECT_UPI_MAX_AMOUNT_INR", 100_000, MIN_DIRECT_UPI_AMOUNT_INR, 1_000_000),
        currency: "INR",
        inrRate: 1,
        hostedRedirect: false,
        description: DEFAULT_DESCRIPTIONS.direct_upi,
      };
    case "oxapay_crypto": {
      const currency = oxapayInvoiceCurrency();
      const isInr = currency === "INR";
      const min = isInr
        ? envInt("OXAPAY_MIN_DEPOSIT_INR", MIN_OXAPAY_AMOUNT_INR, 1, 1_000_000)
        : envInt("OXAPAY_MIN_DEPOSIT_USD", MIN_OXAPAY_AMOUNT_USD, 1, 1_000_000);
      const max = isInr
        ? envInt("OXAPAY_MAX_DEPOSIT_INR", 50_000, min, 1_000_000)
        : envInt("OXAPAY_MAX_DEPOSIT_USD", MAX_OXAPAY_AMOUNT_USD, min, 1_000_000);
      return {
        ...common,
        enabled: envFlag("PAYMENT_METHOD_OXAPAY_CRYPTO_ENABLED", false),
        minAmount: min,
        maxAmount: max,
        currency,
        presets: isInr ? INR_PRESETS : USD_PRESETS,
        inrRate: isInr ? 1 : oxapayInrRate(),
        feePayer: "customer",
        hostedRedirect: true,
        description: DEFAULT_DESCRIPTIONS.oxapay_crypto,
        feePaidByPayer: oxapayFeePaidByPayer(),
        underPaidCoverage: oxapayUnderPaidCoverage(),
      };
    }
    case "razorpay":
      return {
        ...common,
        enabled: envFlag("PAYMENT_METHOD_RAZORPAY_ENABLED", false),
        minAmount: envInt("RAZORPAY_MIN_DEPOSIT_INR", MIN_RAZORPAY_AMOUNT_INR, 1, 1_000_000),
        maxAmount: envInt("RAZORPAY_MAX_DEPOSIT_INR", 100_000, MIN_RAZORPAY_AMOUNT_INR, 1_000_000),
        currency: "INR",
        inrRate: 1,
        hostedRedirect: true,
        description: DEFAULT_DESCRIPTIONS.razorpay,
      };
  }
}

function credentialsResolve(id: PaymentMethodId): boolean {
  switch (id) {
    case "famgateway_upi":
      return Boolean(String(process.env.FAMGATEWAY_API_KEY || "").trim());
    case "direct_upi":
      return Boolean(String(process.env.UPI_VPA || "").trim())
        && Boolean(String(process.env.FAMPAY_APP_PASSWORD || "").trim());
    case "oxapay_crypto":
      return Boolean(String(process.env.OXAPAY_MERCHANT_API_KEY || "").trim());
    case "razorpay":
      return Boolean(String(process.env.RAZORPAY_KEY_ID || "").trim())
        && Boolean(String(process.env.RAZORPAY_KEY_SECRET || "").trim());
  }
}

function clampPositive(value: unknown, fallback: number, max = 1_000_000): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

/**
 * Resolves the effective settings for one method: Mongo override, then env,
 * then the built-in default.
 */
export function resolveMethodSettings(
  id: PaymentMethodId,
  runtime: RuntimeMethodConfig | undefined,
): { settings: PaymentMethodSettings; hasRuntimeOverride: boolean } {
  const baseline = envBaseline(id);
  if (!runtime) return { settings: baseline, hasRuntimeOverride: false };

  const settings: PaymentMethodSettings = { ...baseline };
  let hasRuntimeOverride = false;

  if (typeof runtime.enabled === "boolean") {
    settings.enabled = runtime.enabled;
    hasRuntimeOverride = true;
  }
  if (runtime.min_amount !== undefined) {
    settings.minAmount = clampPositive(runtime.min_amount, baseline.minAmount);
    hasRuntimeOverride = true;
  }
  if (runtime.max_amount !== undefined) {
    settings.maxAmount = clampPositive(runtime.max_amount, baseline.maxAmount);
    hasRuntimeOverride = true;
  }
  if (typeof runtime.currency === "string" && runtime.currency.trim()) {
    settings.currency = runtime.currency.trim().toUpperCase();
    hasRuntimeOverride = true;
  }
  if (Array.isArray(runtime.presets) && runtime.presets.length) {
    const presets = runtime.presets.map((p) => Number(p)).filter((p) => Number.isFinite(p) && p > 0);
    if (presets.length) {
      settings.presets = presets;
      hasRuntimeOverride = true;
    }
  }
  if (runtime.usd_to_inr_rate !== undefined) {
    settings.inrRate = clampPositive(runtime.usd_to_inr_rate, baseline.inrRate, 10_000);
    hasRuntimeOverride = true;
  }
  if (runtime.fee_paid_by_payer === 0 || runtime.fee_paid_by_payer === 1) {
    settings.feePaidByPayer = runtime.fee_paid_by_payer;
    settings.feePayer = runtime.fee_paid_by_payer === 1 ? "customer" : "merchant";
    hasRuntimeOverride = true;
  }
  if (runtime.under_paid_coverage !== undefined) {
    const coverage = Math.round(Number(runtime.under_paid_coverage));
    if (Number.isFinite(coverage)) {
      settings.underPaidCoverage = Math.max(0, Math.min(coverage, 60));
      hasRuntimeOverride = true;
    }
  }
  if (typeof runtime.invoice_description === "string" && runtime.invoice_description.trim()) {
    settings.invoiceDescription = runtime.invoice_description.trim().slice(0, 240);
    hasRuntimeOverride = true;
  }
  if (typeof runtime.thanks_message === "string" && runtime.thanks_message.trim()) {
    settings.thanksMessage = runtime.thanks_message.trim().slice(0, 480);
    hasRuntimeOverride = true;
  }
  if (runtime.invoice_lifetime_minutes !== undefined) {
    settings.invoiceLifetimeMinutes = Math.max(15, Math.min(Math.round(Number(runtime.invoice_lifetime_minutes) || 60), 2880));
    hasRuntimeOverride = true;
  }
  if (runtime.order_lifetime_minutes !== undefined) {
    settings.orderLifetimeMinutes = Math.max(5, Math.min(Math.round(Number(runtime.order_lifetime_minutes) || 5), 30));
    hasRuntimeOverride = true;
  }

  if (settings.maxAmount < settings.minAmount) settings.maxAmount = settings.minAmount;
  if (settings.currency === "INR") settings.inrRate = 1;
  return { settings, hasRuntimeOverride };
}

/**
 * Full state for every known method, including disabled ones. Used by the
 * owner control panel and the admin bot. The website UI consumes only the
 * enabled subset via `getEnabledPaymentMethods`.
 */
export async function getPaymentMethodStates(db: Db): Promise<PaymentMethodState[]> {
  const runtime = await readRuntimeConfig(db);
  const runtimeMethods = runtime?.methods || {};

  return PAYMENT_METHOD_IDS.map((id) => {
    const runtimeEntry = runtimeMethods[id];
    const { settings, hasRuntimeOverride } = resolveMethodSettings(id, runtimeEntry);
    const configured = credentialsResolve(id);
    const source: PaymentMethodState["source"] = hasRuntimeOverride ? "runtime_config" : "env_default";

    let reason: string | null = null;
    if (!configured) {
      reason = "Provider credentials are not configured.";
    } else if (!settings.enabled) {
      reason = source === "runtime_config"
        ? "Disabled by the owner control panel."
        : "Disabled by environment configuration.";
    }

    return {
      id,
      label: PAYMENT_METHOD_LABELS[id],
      ...settings,
      // The credential gate always wins: a method without credentials is off.
      enabled: settings.enabled && configured,
      toggleEnabled: settings.enabled,
      configured,
      source,
      reason,
    };
  });
}

/**
 * Descriptors for the methods a customer may actually use right now.
 * A disabled or unconfigured method is absent from this list entirely.
 */
export async function getEnabledPaymentMethods(db: Db): Promise<PaymentMethodDescriptor[]> {
  const states = await getPaymentMethodStates(db);
  return states
    .filter((state) => state.enabled && state.configured)
    .map((state) => {
      const {
        configured: _configured,
        source: _source,
        reason: _reason,
        toggleEnabled: _toggleEnabled,
        feePaidByPayer: _feePaidByPayer,
        underPaidCoverage: _underPaidCoverage,
        invoiceLifetimeMinutes: _invoiceLifetimeMinutes,
        orderLifetimeMinutes: _orderLifetimeMinutes,
        invoiceDescription: _invoiceDescription,
        thanksMessage: _thanksMessage,
        ...descriptor
      } = state;
      return descriptor;
    });
}

/** Effective settings for one method (Mongo override > env > default). */
export async function getPaymentMethodSettings(
  db: Db,
  id: PaymentMethodId,
): Promise<PaymentMethodSettings> {
  const runtime = await readRuntimeConfig(db);
  const { settings } = resolveMethodSettings(id, runtime?.methods?.[id]);
  return settings;
}

export async function isPaymentMethodEnabled(db: Db, id: PaymentMethodId): Promise<boolean> {
  const states = await getPaymentMethodStates(db);
  const state = states.find((item) => item.id === id);
  return Boolean(state && state.enabled && state.configured);
}

/**
 * Runtime override write. Creates the singleton document on first write.
 * The document is also the audit trail of who changed what.
 */
export async function setPaymentMethodEnabled(
  db: Db,
  id: PaymentMethodId,
  enabled: boolean,
  actor: string,
): Promise<void> {
  await configCollection(db).updateOne(
    { _id: CONFIG_DOC_ID },
    {
      $set: {
        [`methods.${id}.enabled`]: enabled,
        [`methods.${id}.updated_at`]: new Date(),
        [`methods.${id}.updated_by`]: actor,
        updated_at: new Date(),
        updated_by: actor,
      },
      $setOnInsert: { created_at: new Date() },
    },
    { upsert: true },
  );
}

/**
 * Live settings write for anything else the owner wants to change without a
 * redeploy (limits, currency, rate, fee payer, lifetimes).
 */
export async function setPaymentMethodSettings(
  db: Db,
  id: PaymentMethodId,
  patch: RuntimeMethodConfig,
  actor: string,
): Promise<void> {
  const set: Record<string, any> = {
    updated_at: new Date(),
    updated_by: actor,
  };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    set[`methods.${id}.${key}`] = value;
  }
  set[`methods.${id}.updated_at`] = new Date();
  set[`methods.${id}.updated_by`] = actor;

  await configCollection(db).updateOne(
    { _id: CONFIG_DOC_ID },
    { $set: set, $setOnInsert: { created_at: new Date() } },
    { upsert: true },
  );
}

/** The whole runtime configuration document, for the owner panel. */
export async function readPaymentMethodConfigDocument(db: Db): Promise<RuntimeConfigShape | null> {
  return readRuntimeConfig(db);
}
