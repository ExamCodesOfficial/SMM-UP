import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchAllServices } from "../lib/smm.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const forceRefresh = req.query.refresh === "1" || req.query.refresh === "true";
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
