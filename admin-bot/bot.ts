import dotenv from "dotenv";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Telegraf } from "telegraf";
import { MongoClient, ObjectId, Db } from "mongodb";
import { ImapFlow } from "imapflow";

// Load environment variables (from local .env or system environment)
dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const OWNER_ID = process.env.TELEGRAM_OWNER_ID || "";
const MONGODB_URI = process.env.MONGODB_URI || "";
const DB_NAME = process.env.MONGODB_DB_NAME || process.env.DATABASE_NAME || "smm_up_db";

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

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const pendingCustomPasswords = new Map<string, { value: string; expiresAt: number }>();

function temporaryPasswordTtlMinutes(): number {
  const parsed = Number.parseInt(String(process.env.TEMP_PASSWORD_TTL_MINUTES || "180"), 10);
  return Number.isFinite(parsed) && parsed >= 15 && parsed <= 1440 ? parsed : 180;
}

function temporaryPasswordMaxUses(): 1 | 2 {
  return Number.parseInt(String(process.env.TEMP_PASSWORD_MAX_USES || "2"), 10) === 1 ? 1 : 2;
}

function generateTemporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let output = "";
  for (let index = 0; index < 16; index += 1) {
    output += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return output;
}

function hashActionToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function reviewModerationText(review: any, status: "approved" | "hidden"): string {
  const stars = "★".repeat(Math.max(1, Math.min(5, Number(review.rating) || 1)));
  const body = String(review.text || "").slice(0, 900);
  return (
    `${status === "hidden" ? "🙈" : "✅"} <b>${escapeHtml(review.username)}</b> · ${stars}\n` +
    `<code>${review._id.toString()}</code>\n` +
    `${review.city ? `📍 ${escapeHtml(review.city)}\n` : ""}` +
    `\n${escapeHtml(body)}\n\n` +
    `<i>Status: ${status.toUpperCase()}</i>`
  );
}

function reviewModerationKeyboard(id: ObjectId, status: "approved" | "hidden") {
  return {
    inline_keyboard: [[{
      text: status === "hidden" ? "👁 Show review" : "🙈 Hide review",
      callback_data: `review-toggle:${id.toString()}`,
    }]],
  };
}

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
🔐 <code>/resetpassword &lt;email&gt; auto | reason</code> — Confirm a temporary-password reset
👁 <code>/supportaccess &lt;email&gt; | reason</code> — Create a 5-minute read-only Support Access code
💰 <code>/credit &lt;email&gt; &lt;amount&gt; [reason]</code> — Atomically add wallet balance
🔻 <code>/debit &lt;email&gt; &lt;amount&gt; [reason]</code> — Deduct wallet balance
🚨 <code>/failed</code> — View failed orders requiring manual review
↩️ <code>/refund &lt;orderId&gt; [reason]</code> — Manually refund debited order funds
⏳ <code>/pending</code> — View recent pending QR/memo deposit requests
📦 <code>/orders [limit]</code> — View latest provider orders
📑 <code>/checkmemo &lt;memo&gt;</code> — Check status of a payment memo
📡 <code>/scan</code> — Trigger an immediate IMAP Gmail settlement scan
⭐ <code>/reviews [limit]</code> — Review submissions with one-tap hide/show controls

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

// /reviews [limit] — zero-web-surface review moderation
bot.command("reviews", async (ctx) => {
  try {
    const requested = Number(ctx.message.text.trim().split(/\s+/)[1] || 8);
    const limit = Math.max(1, Math.min(Number.isFinite(requested) ? requested : 8, 12));
    const database = await getDatabase();
    const reviews = await database
      .collection("reviews")
      .find({ seed: { $ne: true } })
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray();

    if (!reviews.length) {
      return ctx.reply("⭐ No buyer-submitted reviews yet. The six permanent homepage reviews are unchanged.");
    }

    await ctx.reply(
      `⭐ <b>Latest ${reviews.length} Buyer Review${reviews.length === 1 ? "" : "s"}</b>\n` +
      `<i>Tap the button under any review to hide or restore it instantly.</i>`,
      { parse_mode: "HTML" }
    );

    for (const r of reviews) {
      const status: "approved" | "hidden" = r.status === "hidden" ? "hidden" : "approved";
      await ctx.reply(reviewModerationText(r, status), {
        parse_mode: "HTML",
        reply_markup: reviewModerationKeyboard(r._id, status),
      });
    }
  } catch (err: any) {
    await ctx.reply(`❌ Review moderation failed: ${escapeHtml(err.message)}`, { parse_mode: "HTML" });
  }
});

bot.action(/^review-toggle:([a-f0-9]{24})$/, async (ctx) => {
  try {
    const database = await getDatabase();
    const id = new ObjectId(ctx.match[1]);
    const review = await database.collection("reviews").findOne({ _id: id, seed: { $ne: true } });
    if (!review) {
      await ctx.answerCbQuery("Review no longer exists.", { show_alert: true });
      return;
    }

    const nextStatus: "approved" | "hidden" = review.status === "hidden" ? "approved" : "hidden";
    await database.collection("reviews").updateOne(
      { _id: id },
      { $set: { status: nextStatus, moderated_at: new Date(), moderated_via: "telegram_bot" } }
    );

    await ctx.editMessageText(reviewModerationText(review, nextStatus), {
      parse_mode: "HTML",
      reply_markup: reviewModerationKeyboard(id, nextStatus),
    });
    await ctx.answerCbQuery(nextStatus === "hidden" ? "Review hidden from the site." : "Review restored on the site.");
  } catch (err: any) {
    await ctx.answerCbQuery(`Failed: ${String(err.message).slice(0, 120)}`, { show_alert: true });
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
    const dedicatedApiKeyCount = await database.collection("api_keys").countDocuments({
      user_id: user._id,
      status: { $ne: "archived" },
    });
    const apiKeyCount = dedicatedApiKeyCount || (user.api_key || user.api_key_hash ? 1 : 0);

    const userDetails = `
👤 <b>User Profile:</b> <code>${user.email}</code>
🆔 <b>User ID:</b> <code>${user._id.toString()}</code>
💰 <b>Current Balance:</b> <code>₹${(user.balance || 0).toFixed(2)}</code>
💸 <b>Total Spent:</b> <code>₹${(user.total_spent || 0).toFixed(2)}</code>
📦 <b>Orders Placed:</b> <code>${user.total_orders || 0}</code>
🔑 <b>API Keys:</b> <code>${apiKeyCount > 0 ? `${apiKeyCount} active/paused identities` : "None"}</code>
📅 <b>Registered At:</b> <code>${createdAt}</code>
`;
    await ctx.reply(userDetails, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🖥 Active Sessions", callback_data: `user-sessions:${user._id.toString()}` },
            { text: "👁 Support Access", callback_data: `user-support:${user._id.toString()}` },
          ],
          [{ text: "🚫 Revoke All Sessions", callback_data: `sessions-revoke-prompt:${user._id.toString()}` }],
        ],
      },
    });
  } catch (err: any) {
    await ctx.reply(`❌ Error: ${err.message}`);
  }
});

bot.action(/^user-sessions:([a-f0-9]{24})$/, async (ctx) => {
  try {
    const database = await getDatabase();
    const userId = new ObjectId(ctx.match[1]);
    const user: any = await database.collection("users").findOne({ _id: userId });
    if (!user) return ctx.answerCbQuery("User no longer exists.", { show_alert: true });
    const now = new Date();
    const sessions: any[] = await database.collection("sessions").find({
      $or: [{ user_id: userId }, { actor_admin_id: userId }],
      revoked_at: null,
      expires_at: { $gt: now },
    }).sort({ last_activity_at: -1 }).limit(20).toArray();
    const restrictedCount = await database.collection("restricted_sessions").countDocuments({
      user_id: userId,
      invalidated_at: null,
      expires_at: { $gt: now },
    });
    await ctx.answerCbQuery(`${sessions.length} active website session${sessions.length === 1 ? "" : "s"}.`);
    if (!sessions.length && !restrictedCount) {
      return ctx.reply(`🖥 No active website sessions for <code>${escapeHtml(user.email)}</code>.`, { parse_mode: "HTML" });
    }
    await ctx.reply(
      `🖥 <b>Active Sessions</b>\nUser: <code>${escapeHtml(user.email)}</code>\n` +
      `Normal/support: <code>${sessions.length}</code> · Restricted recovery: <code>${restrictedCount}</code>`,
      { parse_mode: "HTML" },
    );
    for (const session of sessions) {
      const device = session.device || {};
      const type = session.purpose === "admin_impersonation"
        ? `Owner Support viewing @${escapeHtml(session.username || "user")} (read-only)`
        : "Normal login";
      await ctx.reply(
        `🔹 <b>${type}</b>\n` +
        `Session: <code>${session._id.toString()}</code>\n` +
        `Created: <code>${new Date(session.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</code>\n` +
        `Last activity: <code>${new Date(session.last_activity_at || session.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</code>\n` +
        `Expires: <code>${new Date(session.expires_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</code>\n` +
        `Device: <code>${escapeHtml(String(device.platform || device.user_agent || "Unknown").slice(0, 160))}</code>`,
        {
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: [[{ text: "Revoke this session", callback_data: `session-revoke-prompt:${session._id.toString()}` }]] },
        },
      );
    }
  } catch (error: any) {
    await ctx.answerCbQuery(`Failed: ${String(error.message).slice(0, 120)}`, { show_alert: true });
  }
});

bot.action(/^user-support:([a-f0-9]{24})$/, async (ctx) => {
  try {
    const database = await getDatabase();
    const user: any = await database.collection("users").findOne({ _id: new ObjectId(ctx.match[1]) });
    if (!user) return ctx.answerCbQuery("User no longer exists.", { show_alert: true });
    await ctx.answerCbQuery("Add the verified support reason before issuing access.");
    await ctx.reply(
      `👁 <b>Create read-only Support Access</b>\n\n` +
      `Send:\n<code>/supportaccess ${escapeHtml(user.email)} | describe the verified support reason</code>\n\n` +
      `<i>The one-time code lasts five minutes; the resulting website session lasts 15 minutes.</i>`,
      { parse_mode: "HTML" },
    );
  } catch (error: any) {
    await ctx.answerCbQuery(`Failed: ${String(error.message).slice(0, 120)}`, { show_alert: true });
  }
});

bot.action(/^session-revoke-prompt:([a-f0-9]{24})$/, async (ctx) => {
  await ctx.answerCbQuery("Confirm session revocation.");
  await ctx.reply("⚠️ Revoke this website session now?", {
    reply_markup: {
      inline_keyboard: [[
        { text: "✅ Revoke", callback_data: `session-revoke-confirm:${ctx.match[1]}` },
        { text: "Cancel", callback_data: "session-revoke-cancel" },
      ]],
    },
  });
});

bot.action("session-revoke-cancel", async (ctx) => {
  await ctx.answerCbQuery("Cancelled.");
  await ctx.editMessageText("Revocation cancelled.");
});

bot.action(/^session-revoke-confirm:([a-f0-9]{24})$/, async (ctx) => {
  try {
    const database = await getDatabase();
    const sessionId = new ObjectId(ctx.match[1]);
    const now = new Date();
    const websiteSession: any = await database.collection("sessions").findOne({ _id: sessionId });
    if (!websiteSession) return ctx.answerCbQuery("Session no longer exists.", { show_alert: true });
    const result = await database.collection("sessions").updateOne(
      { _id: sessionId, revoked_at: null },
      { $set: { revoked_at: now, revoked_reason: "owner_telegram_revoke" } },
    );
    if (websiteSession.support_access_code_id) {
      await database.collection("support_access_codes").updateOne(
        { _id: websiteSession.support_access_code_id },
        {
          $set: {
            support_session_status: "revoked",
            support_session_ended_at: now,
            telegram_status_retry_required: true,
          },
        },
      );
    }
    await database.collection("security_events").insertOne({
      user_id: websiteSession.user_id,
      session_id: sessionId,
      type: "session_revoked_by_owner",
      owner_telegram_id: ctx.from?.id,
      created_at: now,
    });
    await ctx.answerCbQuery(result.modifiedCount ? "Session revoked." : "Session was already inactive.");
    await ctx.editMessageText(result.modifiedCount ? "✅ Website session revoked." : "ℹ️ Session was already inactive.");
  } catch (error: any) {
    await ctx.answerCbQuery(`Failed: ${String(error.message).slice(0, 120)}`, { show_alert: true });
  }
});

bot.action(/^sessions-revoke-prompt:([a-f0-9]{24})$/, async (ctx) => {
  await ctx.answerCbQuery("Confirm global session revocation.");
  await ctx.reply("⚠️ Revoke every normal, recovery and Support Access session connected to this account?", {
    reply_markup: {
      inline_keyboard: [[
        { text: "✅ Revoke all", callback_data: `sessions-revoke-confirm:${ctx.match[1]}` },
        { text: "Cancel", callback_data: "session-revoke-cancel" },
      ]],
    },
  });
});

bot.action(/^sessions-revoke-confirm:([a-f0-9]{24})$/, async (ctx) => {
  try {
    const database = await getDatabase();
    if (!mongoClient) throw new Error("Database client unavailable");
    const userId = new ObjectId(ctx.match[1]);
    const now = new Date();
    const mongoSession = mongoClient.startSession();
    let revokedCount = 0;
    try {
      await mongoSession.withTransaction(async () => {
        const user: any = await database.collection("users").findOne({ _id: userId }, { session: mongoSession });
        if (!user) throw new Error("User no longer exists.");
        const affectedSupportSessions: any[] = await database.collection("sessions").find({
          $or: [{ user_id: userId }, { actor_admin_id: userId }],
          purpose: "admin_impersonation",
          revoked_at: null,
        }, { session: mongoSession }).project({ support_access_code_id: 1 }).toArray();
        const result = await database.collection("sessions").updateMany(
          { $or: [{ user_id: userId }, { actor_admin_id: userId }], revoked_at: null },
          { $set: { revoked_at: now, revoked_reason: "owner_telegram_global_revoke" } },
          { session: mongoSession },
        );
        revokedCount = result.modifiedCount;
        await database.collection("restricted_sessions").updateMany(
          { user_id: userId, invalidated_at: null },
          { $set: { invalidated_at: now, invalidation_reason: "owner_telegram_global_revoke" } },
          { session: mongoSession },
        );
        await database.collection("users").updateOne(
          { _id: userId },
          { $set: { sessions_revoked_before: now, updated_at: now } },
          { session: mongoSession },
        );
        const codeIds = affectedSupportSessions.map((item) => item.support_access_code_id).filter(Boolean);
        if (codeIds.length) {
          await database.collection("support_access_codes").updateMany(
            { _id: { $in: codeIds } },
            {
              $set: {
                support_session_status: "revoked",
                support_session_ended_at: now,
                telegram_status_retry_required: true,
              },
            },
            { session: mongoSession },
          );
        }
        await database.collection("security_events").insertOne({
          user_id: userId,
          type: "all_sessions_revoked_by_owner",
          owner_telegram_id: ctx.from?.id,
          revoked_count: revokedCount,
          created_at: now,
        }, { session: mongoSession });
      });
    } finally {
      await mongoSession.endSession();
    }
    await ctx.answerCbQuery(`${revokedCount} session${revokedCount === 1 ? "" : "s"} revoked.`);
    await ctx.editMessageText(`✅ Revoked ${revokedCount} active website session${revokedCount === 1 ? "" : "s"}.`);
  } catch (error: any) {
    await ctx.answerCbQuery(`Failed: ${String(error.message).slice(0, 120)}`, { show_alert: true });
  }
});

// /resetpassword <email> <auto|custom-password> | <mandatory reason>
bot.command("resetpassword", async (ctx) => {
  try {
    const rawInput = ctx.message.text.replace(/^\/resetpassword(?:@\w+)?\s*/i, "").trim();
    const separator = rawInput.indexOf("|");
    if (separator < 0) {
      return ctx.reply(
        "⚠️ Usage:\n<code>/resetpassword user@example.com auto | verified recent order and deposit</code>\n\n" +
        "For an owner-selected value, replace <code>auto</code> with the temporary password.",
        { parse_mode: "HTML" },
      );
    }
    const commandPart = rawInput.slice(0, separator).trim();
    const reason = rawInput.slice(separator + 1).trim();
    const [emailRaw, modeRaw] = commandPart.split(/\s+/, 2);
    const email = String(emailRaw || "").trim().toLowerCase();
    const mode = String(modeRaw || "").trim();
    if (!email || !mode || reason.length < 5) {
      return ctx.reply("❌ Email, auto/custom temporary password and a meaningful reason are required.");
    }

    const database = await getDatabase();
    const user: any = await database.collection("users").findOne({ email });
    if (!user) return ctx.reply("❌ No user exists with that email.");

    const generatedMode = mode.toLowerCase() === "auto";
    if (!generatedMode) {
      if (mode.length < 10 || mode.length > 128) {
        return ctx.reply("❌ A custom temporary password must be 10–128 characters.");
      }
      const categories = [/[a-z]/.test(mode), /[A-Z]/.test(mode), /\d/.test(mode), /[^A-Za-z0-9]/.test(mode)]
        .filter(Boolean).length;
      if (categories < 3) return ctx.reply("❌ Custom temporary password must use at least three character categories.");
    }

    const rawActionToken = crypto.randomBytes(16).toString("hex");
    const tokenHash = hashActionToken(rawActionToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60_000);
    await Promise.all([
      database.collection("admin_action_tokens").createIndex({ token_hash: 1 }, { unique: true }),
      database.collection("admin_action_tokens").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
    ]);
    await database.collection("admin_action_tokens").insertOne({
      token_hash: tokenHash,
      action: "password_reset",
      actor_telegram_id: ctx.from?.id,
      user_id: user._id,
      user_email: user.email,
      username: user.username,
      mode: generatedMode ? "generated" : "owner_selected",
      custom_password_hash: generatedMode ? null : await bcrypt.hash(mode, 12),
      reason,
      created_at: now,
      expires_at: expiresAt,
      consumed_at: null,
      cancelled_at: null,
    });
    if (!generatedMode) pendingCustomPasswords.set(tokenHash, { value: mode, expiresAt: expiresAt.getTime() });

    await ctx.reply(
      `⚠️ <b>Confirm Temporary-Password Reset</b>\n\n` +
      `User: <code>@${escapeHtml(user.username)}</code>\n` +
      `Email: <code>${escapeHtml(user.email)}</code>\n` +
      `Mode: <code>${generatedMode ? "Generate automatically" : "Owner-selected"}</code>\n` +
      `Lifetime: <code>${temporaryPasswordTtlMinutes()} minutes</code>\n` +
      `Maximum uses: <code>${temporaryPasswordMaxUses()}</code>\n` +
      `Reason: ${escapeHtml(reason)}\n\n` +
      `<b>Identity checklist — verify at least two:</b>\n` +
      `□ Registered email\n□ Recent internal order + target\n□ Recent service/quantity\n□ Deposit amount + UTR/reference\n□ Approximate balance/registration date\n\n` +
      `<i>Confirming attests that the private recovery evidence was checked. Confirmation expires in 5 minutes; existing sessions will be revoked.</i>`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ Confirm reset", callback_data: `pwdreset-confirm:${rawActionToken}` },
            { text: "✖ Cancel", callback_data: `pwdreset-cancel:${rawActionToken}` },
          ]],
        },
      },
    );
  } catch (error: any) {
    console.error("[AdminBot] Reset preparation failed:", error);
    await ctx.reply("❌ Could not prepare the reset safely.");
  }
});

bot.action(/^pwdreset-(confirm|cancel):([a-f0-9]{32})$/, async (ctx) => {
  const mode = ctx.match[1];
  const rawToken = ctx.match[2];
  const tokenHash = hashActionToken(rawToken);
  try {
    const database = await getDatabase();
    const action: any = await database.collection("admin_action_tokens").findOne({
      token_hash: tokenHash,
      action: "password_reset",
      actor_telegram_id: ctx.from?.id,
      consumed_at: null,
      cancelled_at: null,
      expires_at: { $gt: new Date() },
    });
    if (!action) {
      await ctx.answerCbQuery("This confirmation expired or was already used.", { show_alert: true });
      return;
    }
    if (mode === "cancel") {
      await database.collection("admin_action_tokens").updateOne(
        { _id: action._id, consumed_at: null },
        { $set: { cancelled_at: new Date() } },
      );
      pendingCustomPasswords.delete(tokenHash);
      await ctx.editMessageText("✖ Temporary-password reset cancelled.");
      await ctx.answerCbQuery("Cancelled");
      return;
    }

    const temporaryPassword = action.mode === "generated"
      ? generateTemporaryPassword()
      : pendingCustomPasswords.get(tokenHash)?.value;
    if (!temporaryPassword) {
      await ctx.answerCbQuery("Custom value expired from secure memory. Start again.", { show_alert: true });
      return;
    }
    const passwordHash = action.custom_password_hash || await bcrypt.hash(temporaryPassword, 12);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + temporaryPasswordTtlMinutes() * 60_000);
    const maxUses = temporaryPasswordMaxUses();
    const message: any = ctx.callbackQuery.message;
    const chatId = message?.chat?.id;
    const messageId = message?.message_id;
    if (!chatId || !messageId || !mongoClient) throw new Error("Reset message or database client unavailable");

    const session = mongoClient.startSession();
    let temporaryId: ObjectId | null = null;
    try {
      await session.withTransaction(async () => {
        const claimed: any = await database.collection("admin_action_tokens").findOneAndUpdate(
          {
            _id: action._id,
            consumed_at: null,
            cancelled_at: null,
            expires_at: { $gt: now },
          },
          { $set: { consumed_at: now, identity_checklist_attested: true } },
          { returnDocument: "after", session },
        );
        if (!claimed) throw new Error("RESET_TOKEN_ALREADY_USED");

        await database.collection("temporary_passwords").updateMany(
          { user_id: action.user_id, invalidated_at: null },
          { $set: { status: "superseded", invalidated_at: now, invalidation_reason: "new_reset" } },
          { session },
        );
        const inserted = await database.collection("temporary_passwords").insertOne({
          user_id: action.user_id,
          user_email: action.user_email,
          username: action.username,
          password_hash: passwordHash,
          status: "active",
          used_count: 0,
          max_uses: maxUses,
          created_at: now,
          expires_at: expiresAt,
          invalidated_at: null,
          invalidation_reason: null,
          reason: action.reason,
          created_by_telegram_id: ctx.from?.id,
          action_token_id: action._id,
          telegram_chat_id: chatId,
          telegram_message_id: messageId,
          usage_events: [],
        }, { session });
        temporaryId = inserted.insertedId;

        const affectedSupportSessions: any[] = await database.collection("sessions").find({
          $or: [{ user_id: action.user_id }, { actor_admin_id: action.user_id }],
          purpose: "admin_impersonation",
          revoked_at: null,
        }, { session }).project({ support_access_code_id: 1 }).toArray();
        await database.collection("sessions").updateMany(
          {
            $or: [{ user_id: action.user_id }, { actor_admin_id: action.user_id }],
            revoked_at: null,
          },
          { $set: { revoked_at: now, revoked_reason: "owner_password_reset" } },
          { session },
        );
        const supportCodeIds = affectedSupportSessions.map((item) => item.support_access_code_id).filter(Boolean);
        if (supportCodeIds.length) {
          await database.collection("support_access_codes").updateMany(
            { _id: { $in: supportCodeIds } },
            {
              $set: {
                support_session_status: "revoked",
                support_session_ended_at: now,
                telegram_status_retry_required: true,
              },
            },
            { session },
          );
        }
        await database.collection("restricted_sessions").updateMany(
          { user_id: action.user_id, invalidated_at: null },
          { $set: { invalidated_at: now, invalidation_reason: "owner_password_reset" } },
          { session },
        );
        await database.collection("users").updateOne(
          { _id: action.user_id },
          { $set: { sessions_revoked_before: now, updated_at: now } },
          { session },
        );
        await database.collection("security_events").insertOne({
          user_id: action.user_id,
          type: "temporary_password_created",
          temporary_password_id: inserted.insertedId,
          actor_telegram_id: ctx.from?.id,
          reason: action.reason,
          identity_checklist_attested: true,
          expires_at: expiresAt,
          max_uses: maxUses,
          created_at: now,
        }, { session });
      });
    } finally {
      await session.endSession();
      pendingCustomPasswords.delete(tokenHash);
    }

    try {
      await ctx.editMessageText(
        `🔐 <b>Temporary Password Created</b>\n\n` +
        `User: <code>@${escapeHtml(action.username)}</code>\n` +
        `Email: <code>${escapeHtml(action.user_email)}</code>\n` +
        `Temporary password: <code>${escapeHtml(temporaryPassword)}</code>\n` +
        `Expires: <code>${expiresAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</code>\n` +
        `Uses: <code>0/${maxUses}</code>\n` +
        `Status: ⏳ Waiting for user\n` +
        `Reason: ${escapeHtml(action.reason)}\n\n` +
        `<i>Credential ID: ${temporaryId?.toString() || "recorded"}. The permanent password remains unreadable.</i>`,
        { parse_mode: "HTML" },
      );
    } catch (deliveryError) {
      if (temporaryId) {
        await database.collection("temporary_passwords").updateOne(
          { _id: temporaryId },
          {
            $set: {
              status: "delivery_failed",
              invalidated_at: new Date(),
              invalidation_reason: "telegram_delivery_failed",
            },
          },
        );
      }
      throw deliveryError;
    }
    await ctx.answerCbQuery("Temporary password created; sessions revoked.");
  } catch (error: any) {
    console.error("[AdminBot] Password reset failed:", error);
    await ctx.answerCbQuery("Reset failed safely. Check logs.", { show_alert: true });
  }
});

// /supportaccess <email> | <mandatory reason>
bot.command("supportaccess", async (ctx) => {
  let insertedId: ObjectId | null = null;
  try {
    const rawInput = ctx.message.text.replace(/^\/supportaccess(?:@\w+)?\s*/i, "").trim();
    const separator = rawInput.indexOf("|");
    if (separator < 0) {
      return ctx.reply(
        "⚠️ Usage: <code>/supportaccess user@example.com | investigate reported order display</code>",
        { parse_mode: "HTML" },
      );
    }
    const email = rawInput.slice(0, separator).trim().toLowerCase();
    const reason = rawInput.slice(separator + 1).trim();
    if (!email || reason.length < 5) return ctx.reply("❌ Email and a meaningful support reason are required.");
    if (reason.length > 500) return ctx.reply("❌ Support reason must be 500 characters or fewer.");

    const database = await getDatabase();
    const user: any = await database.collection("users").findOne({ email });
    if (!user) return ctx.reply("❌ No user exists with that email.");
    if (user.account_locked === true) return ctx.reply("❌ Support Access is unavailable while this account is locked.");
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const part = () => Array.from({ length: 4 }, () => alphabet[crypto.randomInt(0, alphabet.length)]).join("");
    const rawCode = `SUP-${part()}-${part()}-${part()}-${part()}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60_000);

    await Promise.all([
      database.collection("support_access_codes").createIndex({ code_hash: 1 }, { unique: true }),
      database.collection("support_access_codes").createIndex(
        { subject_user_id: 1 },
        {
          unique: true,
          partialFilterExpression: { consumed_at: null, invalidated_at: null },
          name: "one_active_support_code_per_subject",
        },
      ),
      database.collection("support_access_codes").createIndex({ expires_at: 1 }, { expireAfterSeconds: 60 * 60 * 24 }),
    ]);
    await database.collection("support_access_codes").updateMany(
      { subject_user_id: user._id, consumed_at: null, invalidated_at: null },
      {
        $set: {
          invalidated_at: now,
          invalidation_reason: "new_code_issued",
          telegram_status_retry_required: true,
        },
      },
    );
    const inserted = await database.collection("support_access_codes").insertOne({
      code_hash: hashActionToken(rawCode),
      subject_user_id: user._id,
      subject_username: user.username,
      subject_email: user.email,
      reason,
      created_by_telegram_id: ctx.from?.id,
      created_at: now,
      expires_at: expiresAt,
      consumed_at: null,
      invalidated_at: null,
    });
    insertedId = inserted.insertedId;

    const sent: any = await ctx.reply(
      `👁 <b>Support Access Code Created</b>\n\n` +
      `User: <code>@${escapeHtml(user.username)}</code>\n` +
      `Email: <code>${escapeHtml(user.email)}</code>\n` +
      `Code: <code>${rawCode}</code>\n` +
      `Exchange by: <code>${expiresAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</code>\n` +
      `Website session: <code>15 minutes</code>\n` +
      `Permissions: <b>Read-only</b>\n` +
      `Reason: ${escapeHtml(reason)}\n\n` +
      `<i>Enter this once at https://smmup.co.in/support-access while signed in as owner. The code is stored only as a hash.</i>`,
      { parse_mode: "HTML" },
    );
    await database.collection("support_access_codes").updateOne(
      { _id: inserted.insertedId },
      {
        $set: {
          telegram_chat_id: sent.chat?.id || ctx.chat?.id,
          telegram_message_id: sent.message_id,
        },
      },
    );
  } catch (error: any) {
    console.error("[AdminBot] Support Access creation failed:", error);
    if (insertedId) {
      const database = await getDatabase().catch(() => null);
      await database?.collection("support_access_codes").updateOne(
        { _id: insertedId },
        { $set: { invalidated_at: new Date(), invalidation_reason: "telegram_delivery_failed" } },
      ).catch(() => {});
    }
    await ctx.reply("❌ Could not create Support Access safely.");
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

// /failed
bot.command("failed", async (ctx) => {
  try {
    const database = await getDatabase();
    const failedOrders = await database
      .collection("orders")
      .find({
        $or: [
          { refund_status: "requires_admin_review" },
          { status: "Failed" },
        ],
      })
      .sort({ created_at: -1 })
      .limit(10)
      .toArray();

    if (failedOrders.length === 0) {
      return ctx.reply("✨ No failed orders currently requiring admin review!");
    }

    let msg = `🚨 <b>Failed Orders Requiring Manual Review (${failedOrders.length}):</b>\n\n`;
    for (const ord of failedOrders) {
      const isRefunded = ord.refund_status === "refunded";
      const id = ord._id.toString();
      msg += `• <b>ID:</b> <code>${id}</code>\n`;
      msg += `  👤 User: <code>${ord.user_email}</code>\n`;
      msg += `  📦 Service: ${ord.service_name || ord.service_id}\n`;
      msg += `  💵 Charge: <b>₹${(ord.charge || 0).toFixed(2)}</b>\n`;
      msg += `  ⚠️ Reason: <i>${ord.provider_error || "Unknown"}</i>\n`;
      msg += `  🚦 Status: <b>${ord.status}</b> (${ord.refund_status || "held"})\n`;
      if (!isRefunded) {
        msg += `  ↩️ <b>Quick Refund:</b> <code>/refund ${id} Manual review approval</code>\n\n`;
      } else {
        msg += `  ✅ <i>Already refunded manually</i>\n\n`;
      }
    }

    await ctx.reply(msg, { parse_mode: "HTML" });
  } catch (err: any) {
    await ctx.reply(`❌ Error fetching failed orders: ${err.message}`);
  }
});

// /refund <orderId> [reason]
bot.command("refund", async (ctx) => {
  try {
    const parts = ctx.message.text.trim().split(/\s+/);
    if (parts.length < 2) {
      return ctx.reply("⚠️ Usage: <code>/refund &lt;orderId&gt; [reason]</code>", { parse_mode: "HTML" });
    }

    const orderIdStr = parts[1].trim();
    const reason = parts.slice(2).join(" ") || "Manual refund approved by admin via Telegram";

    if (!ObjectId.isValid(orderIdStr)) {
      return ctx.reply("❌ Invalid MongoDB Order ID format.");
    }

    const orderId = new ObjectId(orderIdStr);
    const database = await getDatabase();
    if (!mongoClient) throw new Error("MongoDB client is unavailable");

    // The uniqueness index is a hard prerequisite for an idempotent refund.
    await database.collection("wallet_ledger").createIndex(
      { settlement_key: 1 },
      {
        unique: true,
        partialFilterExpression: { settlement_key: { $type: "string" } },
      },
    );

    const session = mongoClient.startSession();
    let summary: { email: string; refundAmount: number; newBalance: number } | null = null;
    try {
      await session.withTransaction(async () => {
        const order: any = await database.collection("orders").findOne({ _id: orderId }, { session });
        if (!order) throw new Error("ORDER_NOT_FOUND");
        if (order.refund_status === "refunded") throw new Error("ALREADY_REFUNDED");

        const refundAmount = Number(order.charge || 0);
        if (!Number.isFinite(refundAmount) || refundAmount <= 0) throw new Error("INVALID_REFUND_AMOUNT");
        const now = new Date();
        const settlementKey = `order_refund:${order._id.toString()}`;

        await database.collection("wallet_ledger").insertOne(
          {
            settlement_key: settlementKey,
            type: "api_order_refund",
            user_id: order.user_id,
            order_id: order._id,
            api_key_id: order.api_key_id || null,
            api_key_version: order.api_key_version || null,
            amount: refundAmount,
            amount_paise: Math.round(refundAmount * 100),
            currency: "INR",
            source: "telegram_bot",
            refunded_by: ctx.from?.id,
            created_at: now,
          },
          { session },
        );

        const orderUpdate = await database.collection("orders").updateOne(
          { _id: order._id, refund_status: { $ne: "refunded" } },
          {
            $set: {
              status: "Refunded",
              refund_status: "refunded",
              refunded_at: now,
              refunded_by: ctx.from?.id,
              refund_reason: reason,
              updated_at: now,
            },
          },
          { session },
        );
        if (orderUpdate.modifiedCount !== 1) throw new Error("ALREADY_REFUNDED");

        const userUpdate: any = await database.collection("users").findOneAndUpdate(
          { _id: order.user_id },
          [
            {
              $set: {
                balance: { $add: [{ $ifNull: ["$balance", 0] }, refundAmount] },
                total_spent: {
                  $max: [0, { $subtract: [{ $ifNull: ["$total_spent", 0] }, refundAmount] }],
                },
                total_orders: {
                  $max: [0, { $subtract: [{ $ifNull: ["$total_orders", 0] }, 1] }],
                },
                updated_at: now,
              },
            },
          ],
          { returnDocument: "after", session },
        );
        if (!userUpdate) throw new Error("REFUND_USER_NOT_FOUND");

        await database.collection("transactions").insertOne(
          {
            user_id: order.user_id,
            user_email: order.user_email,
            amount: refundAmount,
            type: "manual_refund",
            status: "completed",
            order_id: order._id,
            api_key_id: order.api_key_id || null,
            api_key_version: order.api_key_version || null,
            wallet_settlement_key: settlementKey,
            source: "telegram_bot",
            reason,
            refunded_by: ctx.from?.id,
            created_at: now,
          },
          { session },
        );

        if (order.api_key_id) {
          await database.collection("api_key_activity").insertOne(
            {
              user_id: order.user_id,
              api_key_id: order.api_key_id,
              api_key_version: order.api_key_version || null,
              action: "refund",
              scope: "financial:refund",
              http_status: 200,
              result: "refunded_by_owner",
              request_id: `telegram-refund:${order._id.toString()}`,
              order_id: order._id,
              service_id: order.service_id || null,
              service_name: order.service_name || null,
              target: order.link || null,
              quantity: order.quantity || null,
              gross_charge_inr: refundAmount,
              refund_inr: refundAmount,
              net_charge_inr: 0,
              started_at: now,
              completed_at: now,
              duration_ms: 0,
            },
            { session },
          );
        }

        summary = {
          email: String(order.user_email || "unknown"),
          refundAmount,
          newBalance: Number(userUpdate.balance || 0),
        };
      });
    } finally {
      await session.endSession();
    }

    if (!summary) throw new Error("Refund transaction did not complete");
    await ctx.reply(
      `✅ <b>Order Refunded Successfully!</b>\n\n` +
      `🆔 Order ID: <code>${orderIdStr}</code>\n` +
      `👤 Client: <code>${escapeHtml(summary.email)}</code>\n` +
      `💵 Refunded: <b>₹${summary.refundAmount.toFixed(2)} INR</b>\n` +
      `💳 New Balance: <b>₹${summary.newBalance.toFixed(2)}</b>\n` +
      `📝 Reason: <i>${escapeHtml(reason)}</i>`,
      { parse_mode: "HTML" }
    );
  } catch (err: any) {
    if (err?.message === "ORDER_NOT_FOUND") {
      return ctx.reply("❌ Order not found.");
    }
    if (err?.message === "ALREADY_REFUNDED" || err?.code === 11000) {
      return ctx.reply("⚠️ This order has already been refunded.");
    }
    if (err?.message === "INVALID_REFUND_AMOUNT") {
      return ctx.reply("❌ This order does not have a refundable charge.");
    }
    console.error("[AdminBot] Refund failed:", err);
    await ctx.reply("❌ Refund operation failed safely. No partial refund was committed.");
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

async function syncPendingTemporaryPasswordMessages() {
  const database = await getDatabase();
  const now = new Date();
  const records: any[] = await database.collection("temporary_passwords").find({
    telegram_chat_id: { $exists: true },
    telegram_message_id: { $exists: true },
    $or: [
      { telegram_status_retry_required: true },
      { status: "active", expires_at: { $lte: now } },
    ],
  }).sort({ created_at: 1 }).limit(20).toArray();

  for (const temporary of records) {
    const usedCount = Number(temporary.used_count || 0);
    const maxUses = Number(temporary.max_uses || 1);
    const expired = temporary.status === "active" && new Date(temporary.expires_at) <= now;
    const state = expired ? "expired" : temporary.telegram_status_state || temporary.status;
    if (expired) {
      await database.collection("temporary_passwords").updateOne(
        { _id: temporary._id, status: "active" },
        { $set: { status: "expired", invalidated_at: now, invalidation_reason: "expired" } },
      );
    }
    const remaining = Math.max(0, maxUses - usedCount);
    const statusLine = state === "completed"
      ? "✅ Permanent password created · Temporary credential invalidated"
      : state === "expired"
        ? `⌛ Expired after ${usedCount}/${maxUses} uses`
        : `✅ Used ${usedCount}/${maxUses} · ${remaining} use${remaining === 1 ? "" : "s"} remaining`;
    const text = [
      "🔐 <b>Temporary Password Reset</b>",
      "",
      `User: <code>@${escapeHtml(temporary.username)}</code>`,
      `Email: <code>${escapeHtml(temporary.user_email)}</code>`,
      "Temporary password: <i>hidden after initial creation</i>",
      `Expires: <code>${new Date(temporary.expires_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</code>`,
      `Uses: <code>${usedCount}/${maxUses}</code>`,
      `Status: ${statusLine}`,
      `Reason: ${escapeHtml(temporary.reason || "Owner recovery")}`,
    ].join("\n");
    try {
      await bot.telegram.editMessageText(
        temporary.telegram_chat_id,
        temporary.telegram_message_id,
        undefined,
        text,
        { parse_mode: "HTML" },
      );
      await database.collection("temporary_passwords").updateOne(
        { _id: temporary._id },
        {
          $set: { telegram_status_synced: true, telegram_status_updated_at: new Date() },
          $unset: { telegram_status_retry_required: "" },
        },
      );
    } catch (error: any) {
      console.error("[AdminBot] Temporary-password status sync failed:", error?.message || error);
    }
  }

  const supportRecords: any[] = await database.collection("support_access_codes").find({
    telegram_chat_id: { $exists: true },
    telegram_message_id: { $exists: true },
    $or: [
      { telegram_status_retry_required: true },
      { consumed_at: null, invalidated_at: null, expires_at: { $lte: now } },
      { consumed_at: { $ne: null }, support_session_status: "active", support_session_expires_at: { $lte: now } },
    ],
  }).sort({ created_at: 1 }).limit(20).toArray();
  for (const access of supportRecords) {
    const consumed = Boolean(access.consumed_at);
    const sessionExpired = consumed && access.support_session_status === "active" && new Date(access.support_session_expires_at) <= now;
    const status = access.support_session_status === "exited"
      ? "✅ Session exited"
      : access.support_session_status === "revoked"
        ? "🚫 Session revoked by owner"
        : sessionExpired
        ? "⌛ Website support session expired"
        : consumed
          ? "✅ Exchanged · session active"
          : access.invalidation_reason === "new_code_issued"
            ? "♻️ Replaced by a newer code"
            : access.invalidation_reason === "telegram_delivery_failed"
              ? "❌ Invalidated after delivery failure"
              : "⌛ Expired unused";
    const text = [
      "👁 <b>Support Access</b>",
      "",
      `User: <code>@${escapeHtml(access.subject_username)}</code>`,
      `Email: <code>${escapeHtml(access.subject_email)}</code>`,
      "Code: <i>consumed or hidden</i>",
      `Status: ${status}`,
      `Permissions: <b>Read-only</b>`,
      `Reason: ${escapeHtml(access.reason || "Owner support")}`,
    ].join("\n");
    try {
      await bot.telegram.editMessageText(
        access.telegram_chat_id,
        access.telegram_message_id,
        undefined,
        text,
        { parse_mode: "HTML" },
      );
      await database.collection("support_access_codes").updateOne(
        { _id: access._id },
        {
          $set: {
            ...(consumed || access.invalidated_at ? {} : {
              invalidated_at: now,
              invalidation_reason: "expired",
            }),
            ...(sessionExpired ? {
              support_session_status: "expired",
              support_session_ended_at: now,
            } : {}),
            telegram_status_synced: true,
            telegram_status_updated_at: now,
          },
          $unset: { telegram_status_retry_required: "" },
        },
      );
    } catch (error: any) {
      console.error("[AdminBot] Support Access status sync failed:", error?.message || error);
    }
  }
}

function startTemporaryPasswordStatusWorker() {
  syncPendingTemporaryPasswordMessages().catch((error) => console.error("[Recovery Worker]", error));
  setInterval(() => {
    syncPendingTemporaryPasswordMessages().catch((error) => console.error("[Recovery Worker]", error));
  }, 60_000);
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
    console.log("🚀 SMM UP Sovereign Admin Bot launched successfully via Telegram Bot API long polling.");

    // Start independent settlement and recovery-status workers.
    startBackgroundWorker();
    startTemporaryPasswordStatusWorker();

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
