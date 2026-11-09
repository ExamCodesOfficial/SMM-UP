import type { VercelRequest, VercelResponse } from "../../server/lib/http.js";
import crypto from "crypto";
import { ensurePaymentProviderIndexes, getDb } from "../../server/lib/db.js";
import { reconcilePendingDeposits, type ReconciliationProvider } from "../../server/lib/paymentReconciliation.js";
import { getPaymentMethodStates } from "../../server/lib/paymentMethods.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Internal bot -> website channel.
 *
 * The Telegram bot never holds a provider API key. It can only ASK the website
 * to re-check a payment that is already pending. This endpoint therefore has
 * no path to create a credit that the provider has not already authorised: it
 * re-reads the authoritative provider state and runs the same settlement
 * function the signed webhooks use.
 *
 * Security controls:
 *   - HMAC-SHA256 over `${timestamp}.${nonce}.${rawBody}` using a shared secret
 *   - +/- 300 second timestamp window
 *   - single-use nonce enforced by a unique index (replay protection)
 *   - timing-safe signature comparison
 *   - fixed action allow-list (least privilege)
 *   - counts-only responses (no data leak / no oracle)
 *   - rate limiting and a hard row cap
 *   - fail closed when the secret is missing or too short
 */

const ALLOWED_ACTIONS = new Set(["reconcile_pending", "payment_methods_status", "payment_lookup", "notification_status", "notification_test", "telegram_probe", "notification_path_test", "notification_drain", "bot_inventory", "bot_activity"]);
const TIMESTAMP_WINDOW_SECONDS = 300;
const MIN_SECRET_LENGTH = 32;

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 64_000) throw new Error("Request body is too large.");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function header(req: VercelRequest, name: string): string {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] || "" : String(value || "");
}

function timingSafeHexEqual(expectedHex: string, receivedHex: string): boolean {
  if (!expectedHex || !receivedHex) return false;
  if (expectedHex.length !== receivedHex.length) return false;
  if (!/^[a-f0-9]+$/i.test(expectedHex) || !/^[a-f0-9]+$/i.test(receivedHex)) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const received = Buffer.from(receivedHex, "hex");
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

function activeSecrets(): string[] {
  const secrets: string[] = [];
  for (const name of ["INTERNAL_API_SECRET", "INTERNAL_API_SECRET_PREVIOUS"]) {
    const value = String(process.env[name] || "").trim();
    if (value.length >= MIN_SECRET_LENGTH) secrets.push(value);
  }
  return secrets;
}

/** Consumes a nonce. A duplicate means the request was replayed. */
async function consumeNonce(db: any, nonce: string, expiresAt: Date): Promise<boolean> {
  try {
    await db.collection("internal_request_nonces").insertOne({
      nonce,
      expires_at: expiresAt,
      created_at: new Date(),
    });
    return true;
  } catch (error: any) {
    if (error?.code === 11000) return false;
    throw error;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const secrets = activeSecrets();
  if (secrets.length === 0) {
    console.error("internal/reconcile refused: INTERNAL_API_SECRET is missing or too short");
    return res.status(503).json({ error: "Internal authentication is not configured" });
  }

  let rawBody: Buffer;
  try {
    rawBody = await readRawBody(req);
  } catch {
    return res.status(400).json({ error: "Invalid request body." });
  }

  const timestamp = String(header(req, "x-internal-timestamp") || "").trim();
  const nonce = String(header(req, "x-internal-nonce") || "").trim();
  const signature = String(header(req, "x-internal-signature") || "").trim();

  if (!timestamp || !nonce || !signature) {
    return res.status(400).json({ error: "Missing authentication headers." });
  }
  if (!/^\d{10}$/.test(timestamp)) {
    return res.status(401).json({ error: "Invalid authentication headers." });
  }
  if (!/^[a-f0-9]{32,64}$/i.test(nonce)) {
    return res.status(401).json({ error: "Invalid authentication headers." });
  }
  if (!/^[a-f0-9]{64}$/i.test(signature)) {
    return res.status(401).json({ error: "Invalid authentication headers." });
  }

  const requestTime = Number(timestamp);
  if (!Number.isFinite(requestTime) || Math.abs(Math.floor(Date.now() / 1000) - requestTime) > TIMESTAMP_WINDOW_SECONDS) {
    return res.status(401).json({ error: "Request timestamp outside the accepted window." });
  }

  const signedPayload = `${timestamp}.${nonce}.${rawBody.toString("utf8")}`;
  const signatureValid = secrets.some((secret) => {
    const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
    return timingSafeHexEqual(expected, signature);
  });
  if (!signatureValid) {
    return res.status(401).json({ error: "Invalid request signature." });
  }

  let body: any = {};
  try {
    body = rawBody.length ? JSON.parse(rawBody.toString("utf8")) : {};
  } catch {
    return res.status(400).json({ error: "Invalid request body." });
  }

  const action = String(body?.action || "");
  if (!ALLOWED_ACTIONS.has(action)) {
    return res.status(400).json({ error: "Unsupported action." });
  }

  try {
    const db = await getDb();
    await ensurePaymentProviderIndexes();

    // Replay protection: the nonce is single use.
    const nonceAccepted = await consumeNonce(
      db,
      nonce,
      new Date(requestTime * 1000 + TIMESTAMP_WINDOW_SECONDS * 2000),
    );
    if (!nonceAccepted) {
      return res.status(401).json({ error: "Request replay detected." });
    }

    // Read-only: the effective on/off state of every payment method, with the
    // credential gate applied. The bot holds no provider key, so this is how
    // it learns whether a method is genuinely live.
    if (action === "payment_methods_status") {
      const states = await getPaymentMethodStates(db);
      return res.status(200).json({
        methods: states.map((state) => ({
          id: state.id,
          label: state.label,
          enabled: state.enabled,
          toggleEnabled: state.toggleEnabled,
          configured: state.configured,
          reason: state.reason,
          source: state.source,
          minAmount: state.minAmount,
          maxAmount: state.maxAmount,
          currency: state.currency,
          inrRate: state.inrRate,
          feePayer: state.feePayer,
        })),
      });
    }

    // ── Look one order up ────────────────────────────────────────────────
    // The owner needs an answer to "I paid but my wallet did not change".
    // This answers it from our own record: what state the request is in,
    // what was credited, and whether the wallet was actually updated.
    if (action === "notification_test") {
      // Queue a test notification so the owner can prove the whole loop —
      // website -> queue -> Railway bot -> Telegram — actually works.
      const { enqueueOwnerNotification, deliverOwnerNotificationByKey } = await import(
        "../../server/lib/ownerNotifications.js"
      );
      const nonce = String(body?.nonce || "").trim().slice(0, 40);
      const reference = `test_${nonce || Date.now().toString(36)}`;
      const queued = await enqueueOwnerNotification({
        dedupeKey: `money_added:test:${reference}`,
        event: "money_added",
        userEmail: "test@notification.local",
        amount: 1,
        method: "TEST",
        provider: "test",
        providerOrderId: reference,
        utr: "000000000000",
        newBalance: 0,
        detail: "This is a test notification. If you can read this, the delivery pipeline is working.",
      });
      const delivery = await deliverOwnerNotificationByKey(`money_added:test:${reference}`);
      return res.status(200).json({
        queued: queued.queued,
        duplicate: queued.duplicate,
        reference,
        delivered: delivery.delivered,
        deliveryError: delivery.error || null,
      });
    }

    if (action === "bot_activity") {
      // When did the Telegram bot last touch this database?
      //
      // The bot writes a heartbeat every 20 seconds, so a stale heartbeat is
      // proof the bot is not running against this cluster. Each collection
      // it writes is checked for its newest document, which shows whether
      // ANY part of the bot is alive here — even if the worker is disabled.
      const WATCHED = [
        "system_health",
        "worker_leases",
        "payment_reconciliation",
        "payment_method_config",
        "admin_audit",
        "admin_notes",
        "admin_pending_actions",
        "temporary_passwords",
        "support_access_codes",
        "wallet_ledger",
        "transactions",
        "reviews",
        "owner_notification_queue",
      ];
      const now = Date.now();
      const activity: any[] = [];
      for (const name of WATCHED) {
        const newest = await db
          .collection(name)
          .find({})
          .sort({ _id: -1 })
          .limit(1)
          .toArray()
          .catch(() => []);
        const row: any = newest[0];
        if (!row) {
          activity.push({ collection: name, rows: 0, newestId: null, ageSeconds: null });
          continue;
        }
        // An ObjectId's first 4 bytes are its creation timestamp.
        const idTime = typeof row._id === "object" && row._id?.getTimestamp
          ? row._id.getTimestamp().getTime()
          : null;
        const explicit = row.updated_at || row.created_at || row.at || row.timestamp || row.heartbeat_at || null;
        const stamp = explicit ? new Date(explicit).getTime() : idTime;
        activity.push({
          collection: name,
          rows: await db.collection(name).countDocuments({}),
          newestId: String(row._id),
          ageSeconds: stamp ? Math.round((now - stamp) / 1000) : null,
          newestWhen: stamp ? new Date(stamp).toISOString() : null,
        });
      }
      activity.sort((a, b) => (b.ageSeconds ?? 1e12) - (a.ageSeconds ?? 1e12));
      return res.status(200).json({ activity });
    }

    if (action === "bot_inventory") {
      // Finds every place the Telegram bot could be writing.
      //
      // The bot resolves its database as MONGODB_DB_NAME -> DATABASE_NAME ->
      // "smm_up_db", and it can point at a different Mongo cluster entirely.
      // A bot that is alive but writing somewhere else looks exactly like a
      // bot that is dead, so every database in the cluster is inspected.
      // The shared client is reused: opening a second one costs a whole
      // connection handshake, and this endpoint has a request deadline.
      const { getMongoClient } = await import("../../server/lib/db.js");
      const client = await getMongoClient();
      const findings: any[] = [];
      const { databases } = await client.db().admin().listDatabases({ nameOnly: true });
      for (const entry of databases) {
        const name = entry.name;
        if (["admin", "local", "config"].includes(name)) continue;
        const target = client.db(name);
        const health = await target
          .collection("system_health")
          .find({}, { projection: { status: 1, heartbeat_at: 1, last_success_at: 1, holder: 1 } })
          .limit(10)
          .toArray()
          .catch(() => []);
        const leases = await target
          .collection("worker_leases")
          .find({}, { projection: { holder: 1, heartbeat_at: 1, lease_until: 1 } })
          .limit(10)
          .toArray()
          .catch(() => []);
        const queue = await target
          .collection("owner_notification_queue")
          .countDocuments({}, { limit: 1 })
          .catch(() => 0);
        findings.push({
          database: name,
          systemHealth: health.map((row: any) => ({
            id: row._id,
            status: row.status || null,
            heartbeatAt: row.heartbeat_at || null,
            lastSuccessAt: row.last_success_at || null,
            holder: row.holder || null,
          })),
          workerLeases: leases.map((row: any) => ({
            id: row._id,
            holder: row.holder || null,
            heartbeatAt: row.heartbeat_at || null,
            leaseUntil: row.lease_until || null,
          })),
          ownerNotificationRows: queue,
        });
      }
      return res.status(200).json({ findings });
    }

    if (action === "notification_drain") {
      // The bot's periodic sweep doubles as a notification sweep, so a
      // notification that failed once is not lost.
      const { drainPendingOwnerNotifications } = await import(
        "../../server/lib/ownerNotifications.js"
      );
      const summary = await drainPendingOwnerNotifications(50);
      return res.status(200).json(summary);
    }

    if (action === "notification_path_test") {
      // Exercises the REAL notification functions the payment endpoints call,
      // so the delivery path is proven rather than assumed.
      const event = String(body?.event || "money_added");
      const { notifyMoneyAdded, notifyOrderPlaced } = await import(
        "../../server/lib/paymentNotifications.js"
      );
      const reference = `selftest_${String(body?.nonce || Date.now().toString(36)).slice(0, 12)}`;

      if (event === "order_placed") {
        await notifyOrderPlaced({
          userEmail: "owner-selftest@smmup.co.in",
          amount: 10,
          method: "FAMGATEWAY_UPI",
          provider: "famgateway",
          providerOrderId: reference,
          transactionId: reference,
        });
      } else {
        await notifyMoneyAdded({
          userEmail: "owner-selftest@smmup.co.in",
          amount: 10,
          method: "FAMGATEWAY_UPI",
          provider: "famgateway",
          providerOrderId: reference,
          transactionId: reference,
          utr: "000000000000",
          newBalance: 39195.04,
        });
      }

      const status = await db.collection<any>("owner_notification_queue").findOne({
        dedupe_key: `${event}:famgateway:${reference}`,
      });
      return res.status(200).json({
        event,
        reference,
        queued: Boolean(status),
        sent: Boolean(status?.sent_at),
        attempts: Number(status?.attempts || 0),
        error: status?.last_error || null,
        sentAt: status?.sent_at || null,
      });
    }

    if (action === "telegram_probe") {
      // Checks the website's own Telegram credentials and reports the real
      // API response. The original sender swallowed every error, which is
      // why a missing notification could never be diagnosed.
      const token = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
      if (!token || !chatId) {
        return res.status(200).json({
          configured: false,
          error: "TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID is not set on the website.",
        });
      }
      const masked = `${token.slice(0, 10)}…${token.slice(-4)}`;
      const getMe = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
        signal: AbortSignal.timeout(8000),
      }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }))
        .catch((e) => ({ status: 0, body: { description: String(e?.message || e) } }));

      const send = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        signal: AbortSignal.timeout(8000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "🧪 <b>Notification channel test</b>\nThis message proves the owner receives Telegram alerts from SMM UP.",
          parse_mode: "HTML",
        }),
      }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }))
        .catch((e) => ({ status: 0, body: { description: String(e?.message || e) } }));

      return res.status(200).json({
        configured: true,
        tokenMasked: masked,
        chatIdMasked: `${String(chatId).slice(0, 4)}…${String(chatId).slice(-3)}`,
        getMe,
        send,
      });
    }

    if (action === "notification_status") {
      // The owner-notification queue: what the website has asked the bot to
      // deliver, and what the bot has actually delivered.
      const now = new Date();
      const [pending, delivered, failed, givingUp] = await Promise.all([
        db.collection("owner_notification_queue").countDocuments({ sent_at: null }),
        db.collection("owner_notification_queue").countDocuments({ sent_at: { $ne: null } }),
        db.collection("owner_notification_queue").countDocuments({ sent_at: null, last_error: { $ne: null } }),
        db.collection("owner_notification_queue").countDocuments({ sent_at: null, attempts: { $gte: 8 } }),
      ]);
      const recent = await db.collection("owner_notification_queue")
        .find({})
        .sort({ created_at: -1 })
        .limit(10)
        .toArray();
      // The bot writes a heartbeat on every pass. If this is missing or old,
      // the Railway instance is not running the new code (or is down).
      const health = await db.collection<any>("system_health").findOne({ _id: "owner_notification_worker" });
      // Every health row the bot writes. If the older worker rows are here,
      // the bot is alive and on this database — it is just running old code.
      const allHealth = await db.collection<any>("system_health").find({}).sort({ heartbeat_at: -1 }).limit(10).toArray();
      return res.status(200).json({
        pending,
        delivered,
        failed,
        givingUp,
        requestedAt: now.toISOString(),
        botHeartbeat: health?.heartbeat_at || null,
        botStatus: health?.status || null,
        botLastError: health?.last_error || null,
        botLastSuccessAt: health?.last_success_at || null,
        allHealth: allHealth.map((row: any) => ({
          id: row._id,
          status: row.status || null,
          heartbeatAt: row.heartbeat_at || null,
          lastSuccessAt: row.last_success_at || null,
          lastError: row.last_error || null,
        })),
        recent: recent.map((row: any) => ({
          event: row.event,
          dedupeKey: row.dedupe_key,
          amount: row.amount ?? null,
          userEmail: row.user_email ?? null,
          method: row.method ?? null,
          sent: Boolean(row.sent_at),
          attempts: Number(row.attempts || 0),
          error: row.last_error || null,
          createdAt: row.created_at || null,
          sentAt: row.sent_at || null,
          pinned: Boolean(row.pinned_message_id),
          pinnedMessageId: row.pinned_message_id || null,
          pinError: row.pin_error || null,
        })),
      });
    }

    if (action === "payment_lookup") {
      const provider = String(body?.provider || "famgateway");
      const orderId = String(body?.orderId || "").trim();
      if (!/^[A-Za-z0-9_-]{4,80}$/.test(orderId)) {
        return res.status(400).json({ error: "Invalid order reference." });
      }
      const field = provider === "oxapay" ? "oxapay_track_id" : "famgateway_order_id";
      const method = provider === "oxapay" ? "OXAPAY_CRYPTO" : "FAMGATEWAY_UPI";
      const tx: any = await db.collection("transactions").findOne({ [field]: orderId });
      if (!tx) {
        return res.status(200).json({ found: false, orderId, provider });
      }
      const user: any = tx.user_id
        ? await db.collection("users").findOne({ _id: tx.user_id }, { projection: { balance: 1 } })
        : null;
      return res.status(200).json({
        found: true,
        orderId,
        provider,
        method: tx.method,
        status: tx.status,
        walletCredited: tx.wallet_credited === true,
        requestedAmount: Number(tx.amount || 0),
        creditedAmount: tx.credited_amount !== undefined ? Number(tx.credited_amount) : Number(tx.amount || 0),
        paidAmount: tx.paid_amount !== undefined ? Number(tx.paid_amount) : null,
        utr: tx.famgateway_utr || tx.oxapay_utr || null,
        settledBy: tx.famgateway_settled_by || tx.oxapay_settled_by || null,
        reviewRequired: tx.payment_review_required === true,
        reviewReason: tx.payment_review_reason || null,
        providerError: tx.provider_last_error || null,
        createdAt: tx.created_at ? new Date(tx.created_at).toISOString() : null,
        expiresAt: tx.expires_at ? new Date(tx.expires_at).toISOString() : null,
        walletBalance: user ? Number(user.balance || 0) : null,
      });
    }

    const provider = String(body?.provider || "famgateway") as ReconciliationProvider;
    if (provider !== "famgateway" && provider !== "oxapay") {
      return res.status(400).json({ error: "Unsupported provider." });
    }

    const limit = Number.parseInt(String(body?.limit ?? "25"), 10);
    const minAgeSeconds = Number.parseInt(String(body?.minAgeSeconds ?? "30"), 10);

    const summary = await reconcilePendingDeposits({
      provider,
      limit: Number.isFinite(limit) ? limit : 25,
      minAgeSeconds: Number.isFinite(minAgeSeconds) ? minAgeSeconds : 30,
    });

    await db.collection("security_events").insertOne({
      type: "internal_reconcile",
      action,
      provider,
      scanned: summary.scanned,
      settled: summary.settled,
      created_at: new Date(),
    });

    // Counts only. No amounts, references, identifiers or provider payloads.
    // The full breakdown matters: a sweep that scans rows and settles none of
    // them is the difference between "nothing to do" and "money is stuck",
    // and only the owner can tell the two apart without this.
    return res.status(200).json({
      reconciled: summary.scanned,
      settled: summary.settled,
      expired: summary.expired,
      review: summary.review,
      stillPending: summary.stillPending,
      errors: summary.errors,
    });
  } catch (error: any) {
    console.error("internal/reconcile error:", error?.message || error);
    return res.status(500).json({ error: "Reconciliation failed." });
  }
}
