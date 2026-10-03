import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ObjectId } from "mongodb";
import { getDb } from "../lib/db";
import { getUserFromRequest } from "../lib/auth";
import { fetchAllServices, calculateOrderTotal, addProviderOrder } from "../lib/smm";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authUser = getUserFromRequest(req);
  if (!authUser) {
    return res.status(401).json({ error: "Unauthorized. Please sign in." });
  }

  const {
    serviceId,
    link,
    quantity,
    comments,
    usernames,
    hashtags,
    username,
    answer_number,
    runs,
    interval,
  } = req.body || {};

  if (!serviceId || !link) {
    return res.status(400).json({ error: "Service and target link are required" });
  }

  const sId = parseInt(serviceId, 10);
  const cleanLink = String(link).trim();

  try {
    const services = await fetchAllServices();
    const service = services.find((s) => Number(s.service) === sId);

    if (!service) {
      return res.status(404).json({ error: "Service not found or currently offline" });
    }

    // Determine effective quantity
    let effQuantity = 0;
    if (service.type === "Custom Comments" && comments) {
      const lines = String(comments).split("\n").filter((l) => l.trim().length > 0);
      effQuantity = lines.length;
    } else if (service.type === "Package") {
      effQuantity = 1;
    } else {
      effQuantity = parseInt(quantity, 10);
      if (isNaN(effQuantity) || effQuantity < service.min || effQuantity > service.max) {
        return res.status(400).json({
          error: `Quantity must be between ${service.min.toLocaleString()} and ${service.max.toLocaleString()}`,
        });
      }
    }

    // Calculate total charge and wholesale cost
    const { totalCharge, wholesaleCost, profit } = calculateOrderTotal(
      service.wholesale_rate,
      effQuantity
    );

    const db = await getDb();
    const users = db.collection("users");
    const userObjectId = new ObjectId(authUser.userId);

    // ── ATOMIC BALANCE DEBIT ──
    const debitResult = await users.findOneAndUpdate(
      { _id: userObjectId, balance: { $gte: totalCharge } },
      {
        $inc: {
          balance: -totalCharge,
          total_spent: totalCharge,
          total_orders: 1,
        },
      },
      { returnDocument: "after" }
    );

    if (!debitResult) {
      return res.status(400).json({
        error: "Insufficient funds. Please add money to your wallet.",
        required: totalCharge,
      });
    }

    // Forward to SMM provider
    const providerRes = await addProviderOrder({
      serviceId: sId,
      link: cleanLink,
      quantity: effQuantity,
      comments,
      usernames,
      hashtags,
      username,
      answer_number,
      runs,
      interval,
    });

    if (providerRes.error || !providerRes.orderId) {
      // ── AUTOMATIC REFUND IF UPSTREAM FAILS ──
      await users.updateOne(
        { _id: userObjectId },
        {
          $inc: {
            balance: totalCharge,
            total_spent: -totalCharge,
            total_orders: -1,
          },
        }
      );

      return res.status(400).json({
        error: `Provider rejected order: ${providerRes.error || "Unknown error"}. Your balance was not deducted.`,
      });
    }

    // Save order record in MongoDB
    const newOrder = {
      user_id: userObjectId,
      user_email: authUser.email,
      service_id: sId,
      service_name: service.name,
      category: service.category,
      link: cleanLink,
      quantity: effQuantity,
      charge: totalCharge,
      wholesale_cost: wholesaleCost,
      profit: profit,
      provider_order_id: providerRes.orderId,
      status: "In progress",
      refill_available: service.refill,
      cancel_available: service.cancel,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const orderInsert = await db.collection("orders").insertOne(newOrder);

    return res.status(201).json({
      success: true,
      orderId: orderInsert.insertedId.toString(),
      providerOrderId: providerRes.orderId,
      charge: totalCharge,
      balance: debitResult.balance,
      serviceName: service.name,
    });
  } catch (err: any) {
    console.error("Order creation error:", err);
    return res.status(500).json({ error: "Order execution failed. Please try again." });
  }
}
