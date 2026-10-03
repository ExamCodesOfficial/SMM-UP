import dotenv from "dotenv";
import { Telegraf } from "telegraf";
import { MongoClient, ObjectId, Db } from "mongodb";
import { ImapFlow } from "imapflow";

// Load environment variables (from local .env or system environment)
dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const OWNER_ID = process.env.TELEGRAM_OWNER_ID || "";
const MONGODB_URI = process.env.MONGODB_URI || "";
const DB_NAME = process.env.MONGODB_DB_NAME || "smm_up";

if (!BOT_TOKEN) {
  console.error("FATAL: TELEGRAM_BOT_TOKEN is not defined in environment variables.");
  process.exit(1);
}

if (!OWNER_ID) {
  console.warn("WARNING: TELEGRAM_OWNER_ID is not set. The bot will reject all incoming commands.");
}

// ── 1. MONGODB CLIENT ───────────────────────────────────────────────
let mongoClient: MongoClient | null = null;
let db: Db | null = null;

async function getDatabase(): Promise<Db> {
  if (db) return db;
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set in environment variables");
  }
  mongoClient = new MongoClient(MONGODB_URI);
  await mongoClient.connect();
  db = mongoClient.db(DB_NAME);
  console.log(`[AdminBot] Connected to MongoDB Atlas (${DB_NAME})`);
  return db;
}

// ── 2. INITIALIZE TELEGRAF BOT ──────────────────────────────────────
const bot = new Telegraf(BOT_TOKEN);

// Strict owner-only authentication middleware
bot.use(async (ctx, next) => {
  const senderId = ctx.from?.id?.toString();
  if (!senderId || senderId !== OWNER_ID.trim()) {
    console.warn(`[SECURITY] Rejected unauthorized interaction from ID: ${senderId} (@${ctx.from?.username || "unknown"})`);
    await ctx.reply("⛔ <b>Unauthorized Access.</b>\nThis bot is strictly private and restricted to the platform owner.", {
      parse_mode: "HTML",
    });
    return;
  }
  return next();
});

// ── 3. BOT COMMANDS ────────────────────────────────────────────────

// /start or /help
bot.command(["start", "help"], async (ctx) => {
  const helpText = `
⚡ <b>SMM UP — Sovereign Admin Node</b> ⚡
Zero-Web-Surface Operations Engine

<b>Available Commands:</b>
📊 <code>/stats</code> — Live platform metrics (users, turnover, orders)
🔍 <code>/user &lt;email&gt;</code> — Inspect user balance, spent, and stats
💰 <code>/credit &lt;email&gt; &lt;amount&gt; [reason]</code> — Atomically add wallet balance
🔻 <code>/debit &lt;email&gt; &lt;amount&gt; [reason]</code> — Deduct wallet balance
⏳ <code>/pending</code> — View recent pending QR/memo deposit requests
📦 <code>/orders [limit]</code> — View latest provider orders
📑 <code>/checkmemo &lt;memo&gt;</code> — Check status of a payment memo
📡 <code>/scan</code> — Trigger an immediate IMAP Gmail settlement scan

<i>All changes execute atomically directly on MongoDB Atlas.</i>
`;
  await ctx.reply(helpText, { parse_mode: "HTML" });
});

// /stats
bot.command("stats", async (ctx) => {
  try {
    const database = await getDatabase();
    const usersCount = await database.collection("users").countDocuments();
    const ordersCount = await database.collection("orders").countDocuments();
    const transactionsCount = await database.collection("transactions").countDocuments({ status: "paid" });

    // Calculate aggregated balances
    const balanceAgg = await database.collection("users").aggregate([
      {
        $group: {
          _id: null,
          totalBalance: { $sum: "$balance" },
          totalSpent: { $sum: "$total_spent" },
        },
      },
    ]).toArray();

    const totalBalance = balanceAgg[0]?.totalBalance || 0;
    const totalSpent = balanceAgg[0]?.totalSpent || 0;

    const statsMsg = `
📊 <b>SMM UP Live Platform Telemetry</b>

👥 <b>Total Registered Users:</b> <code>${usersCount.toLocaleString()}</code>
💳 <b>Total User Balances:</b> <code>₹${totalBalance.toFixed(2)}</code>
📦 <b>Total Orders Executed:</b> <code>${ordersCount.toLocaleString()}</code>
💸 <b>Total Volume Spent:</b> <code>₹${totalSpent.toFixed(2)}</code>
✅ <b>Settled Deposits:</b> <code>${transactionsCount.toLocaleString()}</code>

<i>Telemetry synchronized from MongoDB Atlas</i>
`;
    await ctx.reply(statsMsg, { parse_mode: "HTML" });
  } catch (err: any) {
    await ctx.reply(`❌ Error fetching stats: ${err.message}`);
  }
});

// /user <email>
bot.command("user", async (ctx) => {
  try {
    const text = ctx.message.text.trim();
    const parts = text.split(/\s+/);
    if (parts.length < 2) {
      return ctx.reply("⚠️ Usage: <code>/user &lt;email&gt;</code>", { parse_mode: "HTML" });
    }

    const email = parts[1].toLowerCase().trim();
    const database = await getDatabase();
    const user = await database.collection("users").findOne({ email });

    if (!user) {
      return ctx.reply(`❌ No user found with email: <code>${email}</code>`, { parse_mode: "HTML" });
    }

    const createdAt = user.created_at ? new Date(user.created_at).toLocaleString("en-IN") : "Unknown";

    const userDetails = `
👤 <b>User Profile:</b> <code>${user.email}</code>
🆔 <b>User ID:</b> <code>${user._id.toString()}</code>
💰 <b>Current Balance:</b> <code>₹${(user.balance || 0).toFixed(2)}</code>
💸 <b>Total Spent:</b> <code>₹${(user.total_spent || 0).toFixed(2)}</code>
📦 <b>Orders Placed:</b> <code>${user.total_orders || 0}</code>
🔑 <b>API Key:</b> <code>${user.api_key ? user.api_key.substring(0, 10) + "..." : "None"}</code>
📅 <b>Registered At:</b> <code>${createdAt}</code>
`;
    await ctx.reply(userDetails, { parse_mode: "HTML" });
  } catch (err: any) {
    await ctx.reply(`❌ Error: ${err.message}`);
  }
});

// /credit <email> <amount> [reason]
bot.command("credit", async (ctx) => {
  try {
    const parts = ctx.message.text.trim().split(/\s+/);
    if (parts.length < 3) {
      return ctx.reply("⚠️ Usage: <code>/credit &lt;email&gt; &lt;amount&gt; [reason]</code>", { parse_mode: "HTML" });
    }

    const email = parts[1].toLowerCase().trim();
    const amount = parseFloat(parts[2]);
    const reason = parts.slice(3).join(" ") || "Manual admin credit via Telegram";

    if (isNaN(amount) || amount <= 0) {
      return ctx.reply("❌ Amount must be a valid positive number.");
    }

    const database = await getDatabase();
    const user = await database.collection("users").findOne({ email });
    if (!user) {
      return ctx.reply(`❌ User <code>${email}</code> not found in database.`, { parse_mode: "HTML" });
    }

    // Atomically increment user balance
    const updated = await database.collection("users").findOneAndUpdate(
      { _id: user._id },
      { $inc: { balance: amount } },
      { returnDocument: "after" }
    );

    // Record transaction entry for audit trail
    await database.collection("transactions").insertOne({
      user_id: user._id,
      user_email: email,
      amount: amount,
      type: "manual_credit",
      status: "paid",
      source: "telegram_bot",
      reason: reason,
      credited_by: ctx.from?.id,
      created_at: new Date(),
    });

    const newBalance = updated?.balance ?? ((user.balance || 0) + amount);

    await ctx.reply(
      `✅ <b>Credit Successful!</b>\n` +
      `👤 User: <code>${email}</code>\n` +
      `➕ Added: <b>₹${amount.toFixed(2)}</b>\n` +
      `💳 New Balance: <b>₹${Number(newBalance).toFixed(2)}</b>\n` +
      `📝 Reason: <i>${reason}</i>`,
      { parse_mode: "HTML" }
    );
  } catch (err: any) {
    await ctx.reply(`❌ Credit operation failed: ${err.message}`);
  }
});

// /debit <email> <amount> [reason]
bot.command("debit", async (ctx) => {
  try {
    const parts = ctx.message.text.trim().split(/\s+/);
    if (parts.length < 3) {
      return ctx.reply("⚠️ Usage: <code>/debit &lt;email&gt; &lt;amount&gt; [reason]</code>", { parse_mode: "HTML" });
    }

    const email = parts[1].toLowerCase().trim();
    const amount = parseFloat(parts[2]);
    const reason = parts.slice(3).join(" ") || "Manual admin debit via Telegram";

    if (isNaN(amount) || amount <= 0) {
      return ctx.reply("❌ Amount must be a valid positive number.");
    }

    const database = await getDatabase();
    const user = await database.collection("users").findOne({ email });
    if (!user) {
      return ctx.reply(`❌ User <code>${email}</code> not found in database.`, { parse_mode: "HTML" });
    }

    // Atomic deduction safeguarding against negative balance
    const updated = await database.collection("users").findOneAndUpdate(
      { _id: user._id, balance: { $gte: amount } },
      { $inc: { balance: -amount } },
      { returnDocument: "after" }
    );

    if (!updated) {
      return ctx.reply(
        `❌ <b>Insufficient balance!</b>\nUser has <code>₹${(user.balance || 0).toFixed(2)}</code>, cannot debit <code>₹${amount.toFixed(2)}</code>.`,
        { parse_mode: "HTML" }
      );
    }

    // Record transaction audit
    await database.collection("transactions").insertOne({
      user_id: user._id,
      user_email: email,
      amount: -amount,
      type: "manual_debit",
      status: "completed",
      source: "telegram_bot",
      reason: reason,
      debited_by: ctx.from?.id,
      created_at: new Date(),
    });

    await ctx.reply(
      `🔻 <b>Debit Successful!</b>\n` +
      `👤 User: <code>${email}</code>\n` +
      `➖ Deducted: <b>₹${amount.toFixed(2)}</b>\n` +
      `💳 New Balance: <b>₹${Number(updated.balance).toFixed(2)}</b>\n` +
      `📝 Reason: <i>${reason}</i>`,
      { parse_mode: "HTML" }
    );
  } catch (err: any) {
    await ctx.reply(`❌ Debit operation failed: ${err.message}`);
  }
});

// /pending
bot.command("pending", async (ctx) => {
  try {
    const database = await getDatabase();
    const pendingList = await database
      .collection("transactions")
      .find({ status: "pending" })
      .sort({ created_at: -1 })
      .limit(10)
      .toArray();

    if (pendingList.length === 0) {
      return ctx.reply("✨ No pending deposits currently awaiting settlement.");
    }

    let msg = `⏳ <b>Pending Deposit Requests (${pendingList.length}):</b>\n\n`;
    for (const item of pendingList) {
      const minutesAgo = Math.round((Date.now() - new Date(item.created_at).getTime()) / 60000);
      msg += `• <b>₹${item.amount}</b> | <code>${item.memo || "NO_MEMO"}</code>\n`;
      msg += `  User: <code>${item.user_email}</code> (${minutesAgo}m ago)\n`;
      msg += `  Quick Credit: <code>/credit ${item.user_email} ${item.amount} Memo verified</code>\n\n`;
    }

    await ctx.reply(msg, { parse_mode: "HTML" });
  } catch (err: any) {
    await ctx.reply(`❌ Error fetching pending: ${err.message}`);
  }
});

// /orders [limit]
bot.command("orders", async (ctx) => {
  try {
    const parts = ctx.message.text.trim().split(/\s+/);
    const limit = Math.min(parseInt(parts[1] || "5", 10), 20);

    const database = await getDatabase();
    const orders = await database
      .collection("orders")
      .find({})
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray();

    if (orders.length === 0) {
      return ctx.reply("No orders recorded yet.");
    }

    let msg = `📦 <b>Recent ${orders.length} Orders:</b>\n\n`;
    for (const ord of orders) {
      msg += `• #${ord.provider_order_id || ord._id.toString().slice(-6)}: <b>${ord.status}</b>\n`;
      msg += `  Service: ${ord.service_name || ord.service_id}\n`;
      msg += `  User: <code>${ord.user_email}</code> | Charge: ₹${(ord.charge || 0).toFixed(2)}\n`;
      msg += `  Link: <code>${ord.link}</code>\n\n`;
    }

    await ctx.reply(msg, { parse_mode: "HTML" });
  } catch (err: any) {
    await ctx.reply(`❌ Error fetching orders: ${err.message}`);
  }
});

// /checkmemo <memo>
bot.command("checkmemo", async (ctx) => {
  try {
    const parts = ctx.message.text.trim().split(/\s+/);
    if (parts.length < 2) {
      return ctx.reply("⚠️ Usage: <code>/checkmemo &lt;memo&gt;</code>", { parse_mode: "HTML" });
    }

    const memo = parts[1].toUpperCase().trim();
    const database = await getDatabase();
    const txn = await database.collection("transactions").findOne({ memo });

    if (!txn) {
      return ctx.reply(`❌ Memo <code>${memo}</code> not found in database.`, { parse_mode: "HTML" });
    }

    const msg = `
📑 <b>Memo Details:</b> <code>${memo}</code>
👤 <b>User:</b> <code>${txn.user_email}</code>
💰 <b>Amount:</b> <code>₹${txn.amount}</code>
🚦 <b>Status:</b> <b>${txn.status}</b>
📅 <b>Created:</b> <code>${new Date(txn.created_at).toLocaleString("en-IN")}</code>
${txn.utr ? `🔗 <b>UTR:</b> <code>${txn.utr}</code>\n` : ""}${txn.transaction_id ? `💳 <b>TxID:</b> <code>${txn.transaction_id}</code>\n` : ""}
`;
    await ctx.reply(msg, { parse_mode: "HTML" });
  } catch (err: any) {
    await ctx.reply(`❌ Error checking memo: ${err.message}`);
  }
});

// /scan (Manual trigger for IMAP scan)
bot.command("scan", async (ctx) => {
  await ctx.reply("📡 Running manual IMAP settlement scan...");
  try {
    const result = await scanAndSettlePayments();
    await ctx.reply(result);
  } catch (err: any) {
    await ctx.reply(`❌ IMAP scan failed: ${err.message}`);
  }
});

// ── 4. PERSISTENT GMAIL IMAP SETTLEMENT ENGINE ─────────────────────
// Runs on Railway as a single persistent/periodic scanner
// Matches incoming FamPay emails against pending memos in MongoDB

function decodeQuotedPrintable(str: string): string {
  return str
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

async function scanAndSettlePayments(): Promise<string> {
  const imapUser = process.env.IMAP_USER || "";
  const imapPass = process.env.IMAP_PASSWORD || "";
  const senderFilter = process.env.FAMPAY_SENDER_FILTER || "no-reply@famapp.in";

  if (!imapUser || !imapPass) {
    return "⚠️ IMAP credentials (IMAP_USER, IMAP_PASSWORD) are not set. Worker is dormant.";
  }

  const database = await getDatabase();
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: imapUser, pass: imapPass },
    logger: false,
  });

  let settledCount = 0;
  let matchesChecked = 0;

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      // Find emails received in the last 2 days from the sender
      const sinceDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const searchResults = await client.search({
        from: senderFilter,
        since: sinceDate,
      });

      if (!searchResults || searchResults.length === 0) {
        return "ℹ️ IMAP scan completed. No recent FamPay emails found in the last 48 hours.";
      }

      // Fetch the latest 30 matching emails
      const targetIds = searchResults.slice(-30);

      for await (const message of client.fetch(targetIds, {
        envelope: true,
        source: true,
        internalDate: true,
      })) {
        matchesChecked++;
        const rawContent = message.source ? message.source.toString("utf8") : "";
        const decodedText = decodeQuotedPrintable(rawContent);

        // 1. Extract Memo (SUP + 5 alphanumeric characters)
        const memoMatch = decodedText.match(/\b(SUP[A-Z0-9]{5})\b/i);
        const memo = memoMatch ? memoMatch[1].toUpperCase() : null;

        // 2. Extract UTR (12 digits)
        const utrMatch = decodedText.match(/(?:UTR|Ref|rrn|upi\s*ref(?:erence)?\s*(?:no|number)?)\s*[:#-]?\s*(\d{12})\b/i);
        const utr = utrMatch ? utrMatch[1] : null;

        // 3. Extract FamPay TxID
        const txMatch = decodedText.match(/\b(FMPIB[A-Z0-9]+)\b/i);
        const txId = txMatch ? txMatch[1] : null;

        // 4. Extract Amount
        const amountMatch = decodedText.match(/(?:received|credited|deposit(?:ed)?|paid)\s*(?:of)?\s*(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/i)
          || (message.envelope.subject ? message.envelope.subject.match(/(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/i) : null);
        const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, "")) : 0;

        // If we found a memo, try to auto-settle the pending transaction
        if (memo) {
          // Check if already processed
          const alreadyProcessed = await database.collection("processed_transactions").findOne({
            $or: [
              { memo: memo },
              ...(utr ? [{ utr: utr }] : []),
              ...(txId ? [{ transaction_id: txId }] : []),
            ],
          });

          if (!alreadyProcessed) {
            // Find matching pending transaction in MongoDB
            const pendingTxn = await database.collection("transactions").findOne({
              memo: memo,
              status: "pending",
            });

            if (pendingTxn) {
              const creditAmount = amount > 0 ? amount : pendingTxn.amount;

              // Atomically credit user
              const userUpdate = await database.collection("users").findOneAndUpdate(
                { _id: pendingTxn.user_id },
                { $inc: { balance: creditAmount } },
                { returnDocument: "after" }
              );

              // Update transaction record
              await database.collection("transactions").updateOne(
                { _id: pendingTxn._id },
                {
                  $set: {
                    status: "paid",
                    paid_at: new Date(),
                    utr: utr || undefined,
                    transaction_id: txId || undefined,
                    verified_amount: creditAmount,
                    settled_by: "railway_imap_worker",
                  },
                }
              );

              // Insert into processed_transactions with sparse unique keys
              await database.collection("processed_transactions").insertOne({
                memo: memo,
                utr: utr || undefined,
                transaction_id: txId || undefined,
                amount: creditAmount,
                user_id: pendingTxn.user_id,
                user_email: pendingTxn.user_email,
                credited_at: new Date(),
                source: "railway_imap_worker",
              });

              settledCount++;

              // Notify platform owner via Telegram
              if (OWNER_ID) {
                const alertMsg = `
🎉 <b>[AUTOMATIC ZERO-CLICK SETTLEMENT]</b> 🎉
User: <code>${pendingTxn.user_email}</code>
Credited: <b>₹${creditAmount.toFixed(2)}</b>
New Balance: <b>₹${Number(userUpdate?.balance || 0).toFixed(2)}</b>
Memo: <code>${memo}</code>
UTR: <code>${utr || "N/A"}</code>
TxID: <code>${txId || "N/A"}</code>
Time: <code>${new Date().toLocaleTimeString("en-IN")}</code>
`;
                await bot.telegram.sendMessage(OWNER_ID, alertMsg, { parse_mode: "HTML" }).catch(console.error);
              }
            }
          }
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }

  return `✅ IMAP scan finished. Checked ${matchesChecked} emails. Auto-settled ${settledCount} pending deposits.`;
}

// Background scheduler for Railway (executes every 20 seconds cleanly)
let workerActive = false;

function startBackgroundWorker() {
  const isEnabled = process.env.ENABLE_IMAP_WORKER !== "false";
  if (!isEnabled) {
    console.log("[Worker] Background IMAP worker is disabled via ENABLE_IMAP_WORKER=false.");
    return;
  }

  console.log("[Worker] Starting Railway background IMAP settlement worker (interval: 20s)...");

  setInterval(async () => {
    if (workerActive) return; // Prevent overlapping runs
    workerActive = true;
    try {
      await scanAndSettlePayments();
    } catch (err: any) {
      console.error("[Worker Error]", err.message);
    } finally {
      workerActive = false;
    }
  }, 20000);
}

// ── 5. START BOT & WORKER ──────────────────────────────────────────
async function main() {
  try {
    await getDatabase();

    // Launch Telegram Long-Polling
    await bot.launch();
    console.log("🚀 SMM UP Sovereign Admin Bot launched successfully via Telegram MTProto.");

    // Start background settlement worker
    startBackgroundWorker();

    // Graceful shutdown handling
    process.once("SIGINT", () => {
      bot.stop("SIGINT");
      if (mongoClient) mongoClient.close();
      process.exit(0);
    });
    process.once("SIGTERM", () => {
      bot.stop("SIGTERM");
      if (mongoClient) mongoClient.close();
      process.exit(0);
    });
  } catch (err: any) {
    console.error("FATAL: Failed to start Admin Bot:", err.message);
    process.exit(1);
  }
}

main();
