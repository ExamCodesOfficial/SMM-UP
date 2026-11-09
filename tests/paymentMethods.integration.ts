import assert from "node:assert/strict";
import crypto from "node:crypto";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import { MongoClient } from "mongodb";

/**
 * Integration coverage for the upgraded payment rails:
 *   - the two-layer method toggle (env baseline + MongoDB runtime override)
 *   - the "disabled method is hidden entirely" contract
 *   - FamGateway and OxaPay webhook signature verification
 *   - provider settlement idempotency (a replayed webhook credits once)
 *   - the crypto "underpaid never auto-credits" rule
 *   - the crypto "duplicate tx_hash credits once" rule
 *   - the payment_hold guard
 */

async function run() {
  const repl = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  let dbLib: any = null;
  let wallet: any = null;
  let cryptoSettlement: any = null;
  let paymentMethods: any = null;
  let famgateway: any = null;
  let oxapay: any = null;
  let db: any = null;

  const apiKey = "fg_test_" + crypto.randomBytes(16).toString("hex");
  const merchantKey = "oxa_test_" + crypto.randomBytes(16).toString("hex");

  try {
    process.env.MONGODB_URI = repl.getUri();
    process.env.DATABASE_NAME = "payment_methods_integration";
    process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
    process.env.RATE_LIMIT_HASH_SECRET = crypto.randomBytes(32).toString("hex");
    process.env.SESSION_METADATA_HASH_SECRET = crypto.randomBytes(32).toString("hex");

    process.env.FAMGATEWAY_API_KEY = apiKey;
    process.env.OXAPAY_MERCHANT_API_KEY = merchantKey;
    process.env.UPI_VPA = "aryanok@fam";
    process.env.FAMPAY_APP_PASSWORD = "test-app-password";

    // Every method starts OFF at the environment layer.
    for (const name of [
      "PAYMENT_METHOD_DIRECT_UPI_ENABLED",
      "PAYMENT_METHOD_FAMGATEWAY_UPI_ENABLED",
      "PAYMENT_METHOD_OXAPAY_CRYPTO_ENABLED",
      "PAYMENT_METHOD_RAZORPAY_ENABLED",
    ]) {
      delete process.env[name];
    }
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;

    dbLib = await import("../server/lib/db.js");
    wallet = await import("../server/lib/wallet.js");
    cryptoSettlement = await import("../server/lib/cryptoSettlement.js");
    paymentMethods = await import("../server/lib/paymentMethods.js");
    famgateway = await import("../server/lib/famgateway.js");
    oxapay = await import("../server/lib/oxapay.js");

    db = await dbLib.getDb();
    await dbLib.ensurePaymentProviderIndexes();

    // ── 1. Toggle registry ───────────────────────────────────────────────────
    let states = await paymentMethods.getPaymentMethodStates(db);
    assert.equal(states.length, 4, "all four known methods must be reported");

    const famgatewayState = states.find((s: any) => s.id === "famgateway_upi");
    assert.equal(famgatewayState.enabled, false, "famgateway must default to OFF");
    assert.equal(famgatewayState.configured, true, "famgateway has credentials in this fixture");
    assert.equal(famgatewayState.source, "env_default");

    // A configured-but-disabled method must be absent from the public list.
    let enabledMethods = await paymentMethods.getEnabledPaymentMethods(db);
    assert.equal(enabledMethods.length, 0, "no method may be publicly listed while all are OFF");
    assert.equal(enabledMethods.some((m: any) => m.id === "razorpay"), false);

    // The runtime override wins over the environment baseline.
    await paymentMethods.setPaymentMethodEnabled(db, "famgateway_upi", true, "integration-test");
    states = await paymentMethods.getPaymentMethodStates(db);
    assert.equal(
      states.find((s: any) => s.id === "famgateway_upi").source,
      "runtime_config",
      "a runtime override must become the source of truth",
    );
    enabledMethods = await paymentMethods.getEnabledPaymentMethods(db);
    assert.equal(enabledMethods.length, 1, "only the enabled method may be listed");
    assert.equal(enabledMethods[0].id, "famgateway_upi");
    assert.equal(enabledMethods[0].minAmount, 10);
    assert.ok(enabledMethods[0].maxAmount >= 10);

    // Turning it back off removes it from the public list again.
    await paymentMethods.setPaymentMethodEnabled(db, "famgateway_upi", false, "integration-test");
    enabledMethods = await paymentMethods.getEnabledPaymentMethods(db);
    assert.equal(enabledMethods.length, 0, "a disabled method must disappear entirely");

    // A method without credentials can never be switched on, even explicitly.
    await paymentMethods.setPaymentMethodEnabled(db, "razorpay", true, "integration-test");
    states = await paymentMethods.getPaymentMethodStates(db);
    const razorpayState = states.find((s: any) => s.id === "razorpay");
    assert.equal(razorpayState.configured, false, "razorpay has no credentials in this fixture");
    assert.equal(razorpayState.enabled, false, "the credential gate must win over the override");
    assert.ok(razorpayState.reason, "a disabled method must explain itself");

    // ── 2. Provider signatures ───────────────────────────────────────────────
    const famBody = Buffer.from(JSON.stringify({ event: "payment.success", order_id: "fg_abcdef123456" }), "utf8");
    const famSignature = crypto.createHmac("sha256", apiKey).update(famBody).digest("hex");
    assert.equal(
      famgateway.verifyFamGatewayWebhookSignature(famBody, famSignature),
      true,
      "a correct FamGateway signature must verify",
    );
    assert.equal(
      famgateway.verifyFamGatewayWebhookSignature(famBody, "deadbeef"),
      false,
      "a wrong FamGateway signature must be rejected",
    );
    assert.equal(
      famgateway.verifyFamGatewayWebhookSignature(famBody, `${famSignature}00`),
      false,
      "a tampered FamGateway signature must be rejected",
    );
    assert.equal(famgateway.isFamGatewayOrderId("fg_abcdef123456"), true);
    assert.equal(famgateway.isFamGatewayOrderId("not-an-order"), false);

    const oxaBody = Buffer.from(JSON.stringify({ track_id: "12345", status: "Paid" }), "utf8");
    const oxaSignature = crypto.createHmac("sha512", merchantKey).update(oxaBody).digest("hex");
    assert.equal(
      oxapay.verifyOxaPayWebhookSignature(oxaBody, oxaSignature),
      true,
      "a correct OxaPay signature must verify",
    );
    assert.equal(
      oxapay.verifyOxaPayWebhookSignature(oxaBody, "00"),
      false,
      "a wrong OxaPay signature must be rejected",
    );
    // The webhook capitalises the status while the GET endpoint lowercases it.
    assert.equal(oxapay.normalizeOxaPayStatus("Paid"), "paid");
    assert.equal(oxapay.normalizeOxaPayStatus("manual_accept"), "manual_accept");
    assert.equal(oxapay.normalizeOxaPayStatus("something-else"), "new");

    // ── 3. FamGateway settlement is idempotent ───────────────────────────────
    const userId = new (await import("mongodb")).ObjectId();
    await db.collection("users").insertOne({
      _id: userId,
      email: "payer@example.com",
      username: "payer",
      balance: 0,
      created_at: new Date(),
    });

    const famTx = await db.collection("transactions").insertOne({
      user_id: userId,
      user_email: "payer@example.com",
      amount: 250,
      amount_paise: 25000,
      currency: "INR",
      method: "FAMGATEWAY_UPI",
      provider: "famgateway",
      environment: "live",
      status: "pending",
      wallet_credited: false,
      famgateway_order_id: "fg_abcdef123456",
      created_at: new Date(),
      updated_at: new Date(),
    });
    const famTransactionId = famTx.insertedId.toString();

    const firstSettlement = await wallet.settleFamGatewayDeposit({
      internalTransactionId: famTransactionId,
      famgatewayOrderId: "fg_abcdef123456",
      expectedUserId: userId.toString(),
      expectedAmountPaise: 25000,
      utr: "627636256497",
      transactionId: "FMPIB1234567890",
      senderName: "TEST PAYER",
      eventId: "famgateway_test_event_1",
      eventType: "payment.success",
    });
    assert.equal(firstSettlement.walletCredited, true, "the first settlement must credit the wallet");
    assert.equal(firstSettlement.alreadySettled, false);

    const secondSettlement = await wallet.settleFamGatewayDeposit({
      internalTransactionId: famTransactionId,
      famgatewayOrderId: "fg_abcdef123456",
      expectedUserId: userId.toString(),
      expectedAmountPaise: 25000,
      utr: "627636256497",
      transactionId: "FMPIB1234567890",
      senderName: "TEST PAYER",
      eventId: "famgateway_test_event_2",
      eventType: "payment.success",
    });
    assert.equal(secondSettlement.alreadySettled, true, "a replayed webhook must not credit twice");
    assert.equal(secondSettlement.newBalance, 250, "the balance must be credited exactly once");

    const creditedUser = await db.collection("users").findOne({ _id: userId });
    assert.equal(Number(creditedUser.balance), 250, "the wallet balance must be ₹250 after one credit");

    const ledgerRows = await db.collection("wallet_ledger").countDocuments({ user_id: userId });
    assert.equal(ledgerRows, 1, "exactly one ledger row per deposit");

    // ── 3b. Overpayment credits only what was ordered ───────────────────────
    // A customer who pays more than the order asked for is credited the
    // ordered amount. The surplus is never minted into the wallet.
    const overpayUserId = new (await import("mongodb")).ObjectId();
    await db.collection("users").insertOne({
      _id: overpayUserId,
      email: "overpayer@example.com",
      username: "overpayer",
      balance: 0,
      created_at: new Date(),
    });
    const overpayTx = await db.collection("transactions").insertOne({
      user_id: overpayUserId,
      user_email: "overpayer@example.com",
      amount: 250,
      amount_paise: 25000,
      currency: "INR",
      method: "FAMGATEWAY_UPI",
      provider: "famgateway",
      environment: "live",
      status: "pending",
      wallet_credited: false,
      famgateway_order_id: "fg_overpay123456",
      created_at: new Date(),
      updated_at: new Date(),
    });
    const overpayResult = await wallet.settleFamGatewayDeposit({
      internalTransactionId: overpayTx.insertedId.toString(),
      famgatewayOrderId: "fg_overpay123456",
      expectedUserId: overpayUserId.toString(),
      expectedAmountPaise: 25000,
      paidAmountPaise: 30000,
      utr: "627636256498",
      eventId: "famgateway_test_event_overpay",
      eventType: "payment.success",
    });
    assert.equal(overpayResult.amount, 250, "an overpayment credits only the ordered amount");
    assert.equal(overpayResult.partial, false, "an overpayment is not a short payment");
    assert.equal(overpayResult.overpaid, true, "an overpayment is reported as overpaid");
    const overpayUser = await db.collection("users").findOne({ _id: overpayUserId });
    assert.equal(Number(overpayUser.balance), 250, "the surplus must never reach the wallet");

    // ── 3c. Underpayment credits only what arrived ──────────────────────────
    const underpayUserId = new (await import("mongodb")).ObjectId();
    await db.collection("users").insertOne({
      _id: underpayUserId,
      email: "underpayer@example.com",
      username: "underpayer",
      balance: 0,
      created_at: new Date(),
    });
    const underpayTx = await db.collection("transactions").insertOne({
      user_id: underpayUserId,
      user_email: "underpayer@example.com",
      amount: 250,
      amount_paise: 25000,
      currency: "INR",
      method: "FAMGATEWAY_UPI",
      provider: "famgateway",
      environment: "live",
      status: "pending",
      wallet_credited: false,
      famgateway_order_id: "fg_underpay12345",
      created_at: new Date(),
      updated_at: new Date(),
    });
    const underpayResult = await wallet.settleFamGatewayDeposit({
      internalTransactionId: underpayTx.insertedId.toString(),
      famgatewayOrderId: "fg_underpay12345",
      expectedUserId: underpayUserId.toString(),
      expectedAmountPaise: 25000,
      paidAmountPaise: 12000,
      utr: "627636256499",
      eventId: "famgateway_test_event_underpay",
      eventType: "payment.success",
    });
    assert.equal(underpayResult.amount, 120, "an underpayment credits only what arrived");
    assert.equal(underpayResult.partial, true);
    const underpayUser = await db.collection("users").findOne({ _id: underpayUserId });
    assert.equal(Number(underpayUser.balance), 120, "a short payment must not be rounded up");

    // ── 3d. The FamGateway key is accepted under any known alias ────────────
    const famgatewayLib = await import("../server/lib/famgateway.js");
    const originalKey = process.env.FAMGATEWAY_API_KEY;
    const originalAlias = process.env.FAMGATEWAY_SECRET_KEY;
    try {
      delete process.env.FAMGATEWAY_API_KEY;
      process.env.FAMGATEWAY_SECRET_KEY = "fam_alias_key_0123456789";
      assert.equal(famgatewayLib.hasFamGatewayConfig(), true, "the alias env var must satisfy the credential gate");
      assert.equal(famgatewayLib.getFamGatewayConfig().apiKey, "fam_alias_key_0123456789");
      assert.equal(famgatewayLib.getFamGatewayApiKeyEnvName(), "FAMGATEWAY_SECRET_KEY");
    } finally {
      if (originalKey === undefined) delete process.env.FAMGATEWAY_API_KEY;
      else process.env.FAMGATEWAY_API_KEY = originalKey;
      if (originalAlias === undefined) delete process.env.FAMGATEWAY_SECRET_KEY;
      else process.env.FAMGATEWAY_SECRET_KEY = originalAlias;
    }

    // ── 4. Crypto settlement ─────────────────────────────────────────────────
    const cryptoTx = await db.collection("transactions").insertOne({
      user_id: userId,
      user_email: "payer@example.com",
      amount: 850,
      amount_paise: 85000,
      currency: "INR",
      method: "OXAPAY_CRYPTO",
      provider: "oxapay",
      environment: "live",
      status: "pending",
      wallet_credited: false,
      oxapay_track_id: "987654",
      oxapay_invoice_currency: "USD",
      oxapay_invoice_amount: 10,
      oxapay_fiat_rate_locked: 85,
      created_at: new Date(),
      updated_at: new Date(),
    });
    const cryptoTransactionId = cryptoTx.insertedId.toString();

    const payment = {
      trackId: "987654",
      status: "paid" as const,
      amount: 10,
      currency: "USD",
      orderId: null,
      email: "payer@example.com",
      expiredAt: null,
      transactions: [
        {
          txHash: "0xabc123",
          status: "paid",
          currency: "USD",
          network: "TRC20",
          amount: 10,
          sentAmount: 10,
          receivedAmount: 9.9,
          rate: 85,
          confirmations: 12,
          address: "TXYZ",
        },
      ],
    } as any;

    const cryptoFirst = await cryptoSettlement.settleCryptoDeposit({
      internalTransactionId: cryptoTransactionId,
      trackId: "987654",
      expectedUserId: userId.toString(),
      expectedAmountPaise: 85000,
      payment,
      eventId: "oxapay_test_event_1",
      eventType: "invoice.paid",
    });
    assert.equal(cryptoFirst.walletCredited, true, "the crypto settlement must credit the wallet");
    assert.equal(cryptoFirst.amount, 850, "the locked INR amount must be credited, not the live crypto value");

    const cryptoSecond = await cryptoSettlement.settleCryptoDeposit({
      internalTransactionId: cryptoTransactionId,
      trackId: "987654",
      expectedUserId: userId.toString(),
      expectedAmountPaise: 85000,
      payment,
      eventId: "oxapay_test_event_2",
      eventType: "invoice.paid",
    });
    assert.equal(cryptoSecond.alreadySettled, true, "a duplicate invoice must not credit twice");

    const afterCrypto = await db.collection("users").findOne({ _id: userId });
    assert.equal(Number(afterCrypto.balance), 1100, "the balance must be ₹1100 after both credits");

    // ── 5. The same on-chain hash on a second invoice credits once ───────────
    const otherTx = await db.collection("transactions").insertOne({
      user_id: userId,
      user_email: "payer@example.com",
      amount: 850,
      amount_paise: 85000,
      currency: "INR",
      method: "OXAPAY_CRYPTO",
      provider: "oxapay",
      environment: "live",
      status: "pending",
      wallet_credited: false,
      oxapay_track_id: "987655",
      oxapay_invoice_currency: "USD",
      oxapay_invoice_amount: 10,
      oxapay_fiat_rate_locked: 85,
      created_at: new Date(),
      updated_at: new Date(),
    });
    const duplicateHashPayment = {
      ...payment,
      trackId: "987655",
    } as any;
    let duplicateHashError: any = null;
    try {
      await cryptoSettlement.settleCryptoDeposit({
        internalTransactionId: otherTx.insertedId.toString(),
        trackId: "987655",
        expectedUserId: userId.toString(),
        expectedAmountPaise: 85000,
        payment: duplicateHashPayment,
        eventId: "oxapay_test_event_3",
        eventType: "invoice.paid",
      });
    } catch (error: any) {
      duplicateHashError = error;
    }
    assert.ok(duplicateHashError, "the same tx_hash must never be credited twice, even on a different invoice");
    assert.equal(duplicateHashError.code, "DUPLICATE_CHAIN_TRANSACTION");
    const afterDuplicate = await db.collection("users").findOne({ _id: userId });
    assert.equal(Number(afterDuplicate.balance), 1100, "a replayed chain hash must not change the balance");

    // ── 6. Underpaid is never auto-credited ──────────────────────────────────
    const underpaidTx = await db.collection("transactions").insertOne({
      user_id: userId,
      user_email: "payer@example.com",
      amount: 850,
      amount_paise: 85000,
      currency: "INR",
      method: "OXAPAY_CRYPTO",
      provider: "oxapay",
      environment: "live",
      status: "pending",
      wallet_credited: false,
      oxapay_track_id: "987656",
      created_at: new Date(),
      updated_at: new Date(),
    });
    let underpaidError: any = null;
    try {
      await cryptoSettlement.settleCryptoDeposit({
        internalTransactionId: underpaidTx.insertedId.toString(),
        trackId: "987656",
        expectedUserId: userId.toString(),
        expectedAmountPaise: 85000,
        payment: { ...payment, trackId: "987656", status: "underpaid" } as any,
        eventId: "oxapay_test_event_4",
        eventType: "invoice.underpaid",
      });
    } catch (error: any) {
      underpaidError = error;
    }
    assert.ok(underpaidError, "an underpaid invoice must be rejected");
    assert.equal(underpaidError.status, 409, "an underpaid invoice must surface as a conflict");
    const afterUnderpaid = await db.collection("users").findOne({ _id: userId });
    assert.equal(Number(afterUnderpaid.balance), 1100, "an underpaid invoice must never credit the wallet");

    // ── 7. The payment hold blocks a credit ───────────────────────────────────
    await db.collection("users").updateOne({ _id: userId }, { $set: { payment_hold: true } });
    const heldTx = await db.collection("transactions").insertOne({
      user_id: userId,
      user_email: "payer@example.com",
      amount: 100,
      amount_paise: 10000,
      currency: "INR",
      method: "FAMGATEWAY_UPI",
      provider: "famgateway",
      environment: "live",
      status: "pending",
      wallet_credited: false,
      famgateway_order_id: "fg_held123456",
      created_at: new Date(),
      updated_at: new Date(),
    });
    let holdError: any = null;
    try {
      await wallet.settleFamGatewayDeposit({
        internalTransactionId: heldTx.insertedId.toString(),
        famgatewayOrderId: "fg_held123456",
        expectedUserId: userId.toString(),
        expectedAmountPaise: 10000,
        utr: "627636256498",
        transactionId: "FMPIB1234567891",
        eventId: "famgateway_test_event_hold",
        eventType: "payment.success",
      });
    } catch (error: any) {
      holdError = error;
    }
    assert.ok(holdError, "a payment hold must block the credit");
    const afterHold = await db.collection("users").findOne({ _id: userId });
    assert.equal(Number(afterHold.balance), 1100, "a held account must not be credited");
    await db.collection("users").updateOne({ _id: userId }, { $set: { payment_hold: false } });

    console.log("✅ payment methods + provider settlement integration tests passed");
  } finally {
    // Close the shared client before tearing the replica set down, otherwise
    // the driver keeps the event loop alive and the process never exits.
    const client = await dbLib?.getMongoClient?.().catch(() => null);
    await client?.close?.().catch(() => {});
    await repl.stop();
  }
}

run().catch((error) => {
  console.error("❌ payment methods integration tests failed:", error);
  process.exit(1);
});
