import { ObjectId, type Db } from "mongodb";
import { getMongoClient } from "./db.js";

export class OrderReservationError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 400, code = "ORDER_RESERVATION_FAILED") {
    super(message);
    this.name = "OrderReservationError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

interface ReserveWebsiteOrderInput {
  userId: ObjectId;
  userEmail: string;
  amountInr: number;
  draft: Record<string, unknown>;
}

/**
 * Atomically reserves wallet funds and creates the durable local order before
 * any non-transactional provider request is attempted.
 */
export async function reserveWebsiteOrder(db: Db, input: ReserveWebsiteOrderInput) {
  const amountPaise = Math.round(Number(input.amountInr) * 100);
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
    throw new OrderReservationError("Invalid order charge.", 400, "INVALID_CHARGE");
  }

  const amount = amountPaise / 100;
  const orderId = new ObjectId();
  const ledgerId = new ObjectId();
  const now = new Date();
  const client = await getMongoClient();
  const session = client.startSession();
  let newBalance = 0;

  try {
    await session.withTransaction(async () => {
      const user: any = await db.collection("users").findOneAndUpdate(
        {
          _id: input.userId,
          balance: { $gte: amount },
          payment_hold: { $ne: true },
          ordering_hold: { $ne: true },
        },
        {
          $inc: { balance: -amount, total_spent: amount, total_orders: 1 },
          $set: { updated_at: now },
        },
        { returnDocument: "after", session },
      );

      if (!user) {
        const current = await db.collection("users").findOne(
          { _id: input.userId },
          { projection: { payment_hold: 1, ordering_hold: 1 }, session },
        );
        if (current?.ordering_hold) {
          throw new OrderReservationError(
            "Ordering is temporarily paused on this account. Please contact support.",
            403,
            "ORDERING_HOLD",
          );
        }
        if (current?.payment_hold) {
          throw new OrderReservationError(
            "Ordering is temporarily paused while a payment refund or dispute is reviewed. Please contact support.",
            403,
            "PAYMENT_HOLD",
          );
        }
        throw new OrderReservationError(
          "Insufficient funds. Please add money to your wallet.",
          400,
          "INSUFFICIENT_BALANCE",
        );
      }
      newBalance = Number(user.balance || 0);

      await db.collection("wallet_ledger").insertOne({
        _id: ledgerId,
        settlement_key: `web_order_charge:${orderId.toString()}`,
        type: "web_order_charge",
        user_id: input.userId,
        order_id: orderId,
        amount: -amount,
        amount_paise: -amountPaise,
        currency: "INR",
        balance_after: newBalance,
        created_at: now,
      }, { session });

      await db.collection("orders").insertOne({
        ...input.draft,
        _id: orderId,
        user_id: input.userId,
        user_email: input.userEmail,
        charge: amount,
        provider_order_id: null,
        provider_error: null,
        status: "Submitting",
        refund_status: null,
        wallet_ledger_id: ledgerId,
        source: "website",
        created_at: now,
        updated_at: now,
      }, { session });
    }, {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
    });
  } finally {
    await session.endSession();
  }

  return { orderId, ledgerId, newBalance, amount, amountPaise };
}
