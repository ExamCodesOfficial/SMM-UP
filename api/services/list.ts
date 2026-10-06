import type { VercelRequest, VercelResponse } from "../../server/lib/http.js";
import { fetchAllServices } from "../../server/lib/smm.js";
import { getDb } from "../../server/lib/db.js";
import { getUserFromRequest } from "../../server/lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const refreshRequested = req.query.refresh === "1" || req.query.refresh === "true";
    let forceRefresh = false;
    if (refreshRequested) {
      if (req.method !== "POST") return res.status(405).json({ error: "Catalog refresh requires POST." });
      const db = await getDb();
      const actor = await getUserFromRequest(req, db);
      if (!actor || actor.role !== "admin" || actor.purpose !== "normal") {
        return res.status(403).json({ error: "Owner authentication is required for catalog refresh." });
      }
      forceRefresh = true;
    } else if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }
    const services = await fetchAllServices(forceRefresh);

    const categoriesMap: { [cat: string]: number } = {};
    const platformMap: { [p: string]: number } = {};
    for (const s of services) {
      categoriesMap[s.category] = (categoriesMap[s.category] || 0) + 1;
      const p = s.platform || "Other";
      platformMap[p] = (platformMap[p] || 0) + 1;
    }

    const categories = Object.keys(categoriesMap).sort((a, b) => a.localeCompare(b));

    res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=300");

    // Strip wholesale_rate / profit — never expose supplier cost to visitors
    const publicServices = services.map((s) => {
      const { wholesale_rate: _w, ...rest } = s as any;
      return rest;
    });

    return res.status(200).json({
      success: true,
      total: publicServices.length,
      platformCounts: platformMap,
      categories,
      services: publicServices,
    });
  } catch (err: any) {
    console.error("Fetch services error:", err);
    return res.status(500).json({ error: "Failed to load services catalog" });
  }
}
