import type { VercelRequest, VercelResponse } from "../../server/lib/http.js";
import { getDb } from "../../server/lib/db.js";
import { denySupportMutation, getUserFromRequest } from "../../server/lib/auth.js";
import { getEnabledPaymentMethods } from "../../server/lib/paymentMethods.js";

/**
 * The single source of truth for which payment methods a customer may use.
 *
 * Only ENABLED and CONFIGURED methods are returned. A disabled method is
 * absent from the list entirely, so the website never renders it, never
 * includes it in the selectable amount range, and never names it in an error
 * message.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const db = await getDb();
    const authUser = await getUserFromRequest(req, db);
    if (!authUser) return res.status(401).json({ error: "Unauthorized" });
    if (denySupportMutation(authUser, res, true)) return;

    const methods = await getEnabledPaymentMethods(db);
    res.setHeader("Cache-Control", "no-store, max-age=0");
    return res.status(200).json({ success: true, methods });
  } catch (error: any) {
    console.error("Payment methods error:", error?.message || error);
    return res.status(503).json({ error: "Payment methods are temporarily unavailable." });
  }
}
