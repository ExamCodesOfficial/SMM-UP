import type { VercelRequest, VercelResponse } from "../../server/lib/http.js";
import { ObjectId } from "mongodb";
import { denySupportMutation, getUserFromRequest } from "../../server/lib/auth.js";
import { getDb } from "../../server/lib/db.js";
import { checkRateLimit } from "../../server/lib/rateLimit.js";
import { sanitizeBrandText } from "../../server/lib/sanitize.js";

const MAX_FAVORITES = 50;
const MAX_TEMPLATES = 25;

async function ensureIndexes(db: any) {
  await Promise.all([
    db.collection("service_favorites").createIndex({ user_id: 1, service_id: 1 }, { unique: true, name: "user_service_unique" }),
    db.collection("order_templates").createIndex({ user_id: 1, created_at: -1 }, { name: "user_templates_recent" }),
  ]);
}

function cleanServiceId(value: unknown) {
  const result = String(value ?? "").trim().slice(0, 80);
  return result && /^[A-Za-z0-9._:-]+$/.test(result) ? result : "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  const action = String(req.query.action || "");
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : "";
  const host = typeof req.headers.host === "string" ? req.headers.host : "";
  if (!["GET", "HEAD", "OPTIONS"].includes(String(req.method || "GET").toUpperCase()) && origin) {
    try {
      if (new URL(origin).host !== host) return res.status(403).json({ error: "Invalid request origin." });
    } catch {
      return res.status(403).json({ error: "Invalid request origin." });
    }
  }
  const db = await getDb();
  const authUser = await getUserFromRequest(req, db);
  if (!authUser) return res.status(401).json({ error: "Unauthorized" });
  const userId = new ObjectId(authUser.userId);
  await ensureIndexes(db);

  if (action === "list") {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    const [favoriteDocs, templateDocs] = await Promise.all([
      db.collection("service_favorites").find({ user_id: userId }).sort({ created_at: -1 }).limit(MAX_FAVORITES).toArray(),
      db.collection("order_templates").find({ user_id: userId }).sort({ created_at: -1 }).limit(MAX_TEMPLATES).toArray(),
    ]);
    return res.status(200).json({
      favorites: favoriteDocs.map((item: any) => String(item.service_id)),
      templates: templateDocs.map((item: any) => ({
        id: item._id.toString(),
        name: item.name,
        serviceId: String(item.service_id),
        quantity: item.quantity ?? null,
        createdAt: item.created_at,
      })),
      privacy: "Templates never store targets, comments, usernames or links.",
    });
  }

  if (denySupportMutation(authUser, res, false)) return;
  const rate = await checkRateLimit(`presets_${authUser.userId}`, 60, 3600, db);
  if (!rate.allowed) return res.status(429).json({ error: `Too many preset changes. Try again in ${rate.remainingSec}s.` });

  if (action === "toggle-favorite") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const serviceId = cleanServiceId(req.body?.serviceId);
    if (!serviceId) return res.status(400).json({ error: "Valid service ID required." });
    const collection = db.collection("service_favorites");
    const existing = await collection.findOne({ user_id: userId, service_id: serviceId });
    if (existing) {
      await collection.deleteOne({ _id: existing._id, user_id: userId });
      return res.status(200).json({ success: true, favorite: false, serviceId });
    }
    const count = await collection.countDocuments({ user_id: userId });
    if (count >= MAX_FAVORITES) return res.status(409).json({ error: `You can save up to ${MAX_FAVORITES} favourites.` });
    try {
      await collection.insertOne({ user_id: userId, service_id: serviceId, created_at: new Date() });
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
    }
    return res.status(200).json({ success: true, favorite: true, serviceId });
  }

  if (action === "save-template") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const serviceId = cleanServiceId(req.body?.serviceId);
    const name = sanitizeBrandText(String(req.body?.name || "").trim()).slice(0, 60);
    const quantityValue = req.body?.quantity === "" || req.body?.quantity == null ? null : Number(req.body.quantity);
    const quantity = Number.isSafeInteger(quantityValue) && quantityValue > 0 ? quantityValue : null;
    if (!serviceId || name.length < 2) return res.status(400).json({ error: "Template name and valid service ID are required." });
    const collection = db.collection("order_templates");
    const count = await collection.countDocuments({ user_id: userId });
    if (count >= MAX_TEMPLATES) return res.status(409).json({ error: `You can save up to ${MAX_TEMPLATES} templates.` });
    const result = await collection.insertOne({ user_id: userId, service_id: serviceId, name, quantity, created_at: new Date(), updated_at: new Date() });
    return res.status(201).json({
      success: true,
      message: "Template saved without the target or comments.",
      template: { id: result.insertedId.toString(), name, serviceId, quantity },
    });
  }

  if (action === "delete-template") {
    if (req.method !== "POST" && req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });
    const templateId = String(req.body?.templateId || "");
    if (!ObjectId.isValid(templateId)) return res.status(400).json({ error: "Valid template ID required." });
    const result = await db.collection("order_templates").deleteOne({ _id: new ObjectId(templateId), user_id: userId });
    if (!result.deletedCount) return res.status(404).json({ error: "Template not found." });
    return res.status(200).json({ success: true });
  }

  return res.status(404).json({ error: "Not found" });
}
