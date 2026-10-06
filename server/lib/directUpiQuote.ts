import crypto from "crypto";
import { ObjectId, type Db } from "mongodb";

export interface DirectUpiAmountReservation {
  pendingId: ObjectId;
  amountPaise: number;
  amount: number;
  requestedAmountPaise: number;
  expiresAt: Date;
}

/**
 * Produces non-zero paise adjustments in randomized order. Higher quotes are
 * preferred so the full payment (including the uniqueness paise) is credited;
 * lower quotes remain available near the configured maximum.
 */
export function buildUniquePayableCandidates(
  requestedAmountPaise: number,
  minAmountPaise: number,
  maxAmountPaise: number,
  startOffset = crypto.randomInt(0, 99),
): number[] {
  if (![requestedAmountPaise, minAmountPaise, maxAmountPaise].every(Number.isSafeInteger)) return [];
  if (requestedAmountPaise < minAmountPaise || requestedAmountPaise > maxAmountPaise) return [];

  const positive: number[] = [];
  const negative: number[] = [];
  for (let index = 0; index < 99; index += 1) {
    const delta = ((startOffset + index) % 99) + 1;
    const above = requestedAmountPaise + delta;
    const below = requestedAmountPaise - delta;
    // Never reserve a whole-rupee value: legacy receipts used whole amounts
    // without a reservation, so `.00` must never become an automatic fallback.
    if (above <= maxAmountPaise && above % 100 !== 0) positive.push(above);
    if (below >= minAmountPaise && below % 100 !== 0) negative.push(below);
  }
  return [...positive, ...negative];
}

/**
 * Atomically reserves one globally unique payable amount for the full late
 * verification window. MongoDB's unique index resolves concurrent allocators;
 * expired reservation cleanup only improves availability and is not trusted as
 * the concurrency guard.
 */
export async function reserveUniqueDirectUpiAmount(
  db: Db,
  input: {
    pendingId: ObjectId;
    requestedAmountPaise: number;
    minAmountPaise: number;
    maxAmountPaise: number;
    reservedUntil: Date;
  },
): Promise<DirectUpiAmountReservation> {
  await db.collection("direct_upi_amount_reservations").deleteMany({ expires_at: { $lte: new Date() } });
  const candidates = buildUniquePayableCandidates(
    input.requestedAmountPaise,
    input.minAmountPaise,
    input.maxAmountPaise,
  );
  if (candidates.length === 0) throw new Error("UNIQUE_PAYABLE_AMOUNT_UNAVAILABLE");

  for (const amountPaise of candidates) {
    try {
      await db.collection("direct_upi_amount_reservations").insertOne({
        _id: input.pendingId,
        pending_transaction_id: input.pendingId,
        amount_paise: amountPaise,
        requested_amount_paise: input.requestedAmountPaise,
        created_at: new Date(),
        expires_at: input.reservedUntil,
      });
      return {
        pendingId: input.pendingId,
        amountPaise,
        amount: amountPaise / 100,
        requestedAmountPaise: input.requestedAmountPaise,
        expiresAt: input.reservedUntil,
      };
    } catch (error: any) {
      if (error?.code === 11000) continue;
      throw error;
    }
  }
  throw new Error("UNIQUE_PAYABLE_AMOUNT_UNAVAILABLE");
}

export async function releaseDirectUpiAmountReservation(db: Db, pendingId: ObjectId): Promise<void> {
  await db.collection("direct_upi_amount_reservations").deleteOne({ _id: pendingId });
}
