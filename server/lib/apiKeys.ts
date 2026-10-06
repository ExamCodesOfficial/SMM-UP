import crypto from "crypto";
import type { ClientSession, Db } from "mongodb";
import { ObjectId } from "mongodb";
import { getMongoClient } from "./db.js";

export const API_KEY_SCOPES = [
  "services:read",
  "balance:read",
  "orders:create",
  "orders:read",
  "orders:cancel",
  "orders:refill",
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export const ACTION_SCOPE: Record<string, ApiKeyScope> = {
  services: "services:read",
  balance: "balance:read",
  add: "orders:create",
  status: "orders:read",
  refill_status: "orders:read",
  cancel: "orders:cancel",
  refill: "orders:refill",
};

const MAX_KEY_NAME_LENGTH = 40;
const MIN_KEY_NAME_LENGTH = 3;
const DEFAULT_MAX_KEYS = 10;

export class ApiKeyError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 400, code = "API_KEY_ERROR") {
    super(message);
    this.name = "ApiKeyError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

export function apiKeyCreationFeeInr(): number {
  const raw = Number(process.env.API_KEY_CREATION_FEE_INR ?? "29");
  if (!Number.isFinite(raw) || raw < 0 || raw > 100000) return 29;
  return Math.round(raw * 100) / 100;
}

export function maxApiKeysPerUser(): number {
  return boundedInteger(process.env.API_KEY_MAX_IDENTITIES, DEFAULT_MAX_KEYS, 1, 100);
}

export function hashApiKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function randomPublicId(): string {
  return crypto.randomBytes(7).toString("base64url");
}

export function generateApiKeySecret(existingPublicId?: string): {
  raw: string;
  hash: string;
  publicId: string;
  prefix: string;
  hint: string;
} {
  const publicId = existingPublicId || randomPublicId();
  const secret = crypto.randomBytes(32).toString("base64url");
  const raw = `sup_${publicId}_${secret}`;
  return {
    raw,
    hash: hashApiKey(raw),
    publicId,
    prefix: `sup_${publicId}`,
    hint: `••••${raw.slice(-4)}`,
  };
}

export function normalizeKeyName(input: unknown): { name: string; normalized: string } {
  const name = String(input || "").trim().replace(/\s+/g, " ");
  if (name.length < MIN_KEY_NAME_LENGTH || name.length > MAX_KEY_NAME_LENGTH) {
    throw new ApiKeyError(`Key name must be ${MIN_KEY_NAME_LENGTH}–${MAX_KEY_NAME_LENGTH} characters.`);
  }
  if (/[\u0000-\u001f\u007f]/.test(name)) {
    throw new ApiKeyError("Key name contains unsupported characters.");
  }
  return { name, normalized: name.toLocaleLowerCase("en-IN") };
}

export function normalizeScopes(input: unknown): ApiKeyScope[] {
  if (!Array.isArray(input)) throw new ApiKeyError("Select at least one API scope.");
  const values = [...new Set(input.map((value) => String(value)))] as string[];
  if (values.length === 0) throw new ApiKeyError("At least one API scope is required.");
  const invalid = values.filter((value) => !(API_KEY_SCOPES as readonly string[]).includes(value));
  if (invalid.length > 0) throw new ApiKeyError("One or more API scopes are invalid.");
  return API_KEY_SCOPES.filter((scope) => values.includes(scope));
}

function normalizeLimitPaise(input: unknown, label: string): number | null {
  if (input === null || input === undefined || input === "") return null;
  const amount = Number(input);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
    throw new ApiKeyError(`${label} must be a positive INR amount.`);
  }
  return Math.round(amount * 100);
}

function normalizeExpiry(input: unknown): Date | null {
  if (input === null || input === undefined || input === "") return null;
  const expiresAt = new Date(String(input));
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    throw new ApiKeyError("Expiration must be a valid future date and time.");
  }
  return expiresAt;
}

export function normalizeKeySettings(input: any): {
  scopes: ApiKeyScope[];
  dailyLimitPaise: number | null;
  monthlyLimitPaise: number | null;
  expiresAt: Date | null;
} {
  const dailyLimitPaise = normalizeLimitPaise(input?.dailyLimitInr, "Daily limit");
  const monthlyLimitPaise = normalizeLimitPaise(input?.monthlyLimitInr, "Monthly limit");
  if (dailyLimitPaise !== null && monthlyLimitPaise !== null && dailyLimitPaise > monthlyLimitPaise) {
    throw new ApiKeyError("Daily limit cannot exceed the monthly limit.");
  }
  return {
    scopes: normalizeScopes(input?.scopes),
    dailyLimitPaise,
    monthlyLimitPaise,
    expiresAt: normalizeExpiry(input?.expiresAt),
  };
}

function legacyHint(raw: string | null): string {
  return raw && raw.length >= 4 ? `••••${raw.slice(-4)}` : "Legacy key";
}

function legacyPrefix(raw: string | null): string {
  if (!raw) return "sup_legacy";
  return raw.slice(0, Math.min(14, raw.length));
}

export function serializeApiKey(key: any) {
  const daily = key.daily_limit_paise === null || key.daily_limit_paise === undefined
    ? null
    : Number(key.daily_limit_paise) / 100;
  const monthly = key.monthly_limit_paise === null || key.monthly_limit_paise === undefined
    ? null
    : Number(key.monthly_limit_paise) / 100;
  return {
    id: key._id.toString(),
    name: key.name,
    publicId: key.public_id,
    prefix: key.prefix,
    hint: key.secret_hint,
    status: key.status,
    scopes: Array.isArray(key.scopes) ? key.scopes : [],
    fullAccess: API_KEY_SCOPES.every((scope) => key.scopes?.includes(scope)),
    dailyLimitInr: daily,
    monthlyLimitInr: monthly,
    expiresAt: key.expires_at || null,
    createdAt: key.created_at,
    updatedAt: key.updated_at,
    lastUsedAt: key.last_used_at || null,
    lastRotatedAt: key.last_rotated_at || null,
    currentVersion: Number(key.current_version || 1),
    legacyMigrated: Boolean(key.legacy_migrated),
    ownerReissueRequired: Boolean(key.owner_reissue_required),
  };
}

/**
 * Moves the old users.api_key/api_key_hash credential into the dedicated key
 * collections without changing the raw credential, charging a fee, or revealing it.
 */
export async function migrateLegacyApiKey(db: Db, userOrId: any): Promise<any | null> {
  const userId = userOrId?._id instanceof ObjectId ? userOrId._id : new ObjectId(String(userOrId));
  const suppliedUser = userOrId?._id instanceof ObjectId ? userOrId : null;
  const initialUser = suppliedUser || await db.collection("users").findOne({ _id: userId });
  if (!initialUser) return null;

  const existing = await db.collection("api_keys").findOne({ user_id: userId, legacy_migrated: true });
  if (!initialUser.api_key && !initialUser.api_key_hash) return existing;

  const client = await getMongoClient();
  const session = client.startSession();
  let migrated: any | null = existing;

  try {
    await session.withTransaction(async () => {
      const user: any = await db.collection("users").findOne({ _id: userId }, { session });
      if (!user) return;

      const already = await db.collection("api_keys").findOne(
        { user_id: userId, legacy_migrated: true },
        { session },
      );
      if (already) {
        migrated = already;
        await db.collection("users").updateOne(
          { _id: userId },
          { $unset: { api_key: "", api_key_hash: "" }, $set: { updated_at: new Date() } },
          { session },
        );
        return;
      }

      const raw = typeof user.api_key === "string" ? user.api_key : null;
      const secretHash = typeof user.api_key_hash === "string"
        ? user.api_key_hash
        : raw
          ? hashApiKey(raw)
          : null;
      if (!secretHash) return;

      const now = new Date();
      const keyId = new ObjectId();
      const publicId = `legacy_${crypto.randomBytes(6).toString("hex")}`;
      const baseName = "Legacy key";
      const conflicting = await db.collection("api_keys").findOne(
        { user_id: userId, active_name_normalized: "legacy key" },
        { session },
      );
      const name = conflicting ? `Legacy key ${publicId.slice(-4)}` : baseName;
      const normalized = name.toLocaleLowerCase("en-IN");
      const key = {
        _id: keyId,
        user_id: userId,
        name,
        active_name_normalized: normalized,
        public_id: publicId,
        prefix: legacyPrefix(raw),
        secret_hint: legacyHint(raw),
        status: "active",
        scopes: [...API_KEY_SCOPES],
        daily_limit_paise: null,
        monthly_limit_paise: null,
        expires_at: null,
        current_version: 1,
        legacy_migrated: true,
        creation_fee_inr: 0,
        created_at: user.api_key_created_at || user.created_at || now,
        updated_at: now,
        last_used_at: user.api_key_last_used_at || null,
      };

      await db.collection("api_keys").insertOne(key, { session });
      await db.collection("api_key_versions").insertOne(
        {
          key_id: keyId,
          user_id: userId,
          version: 1,
          secret_hash: secretHash,
          secret_hint: key.secret_hint,
          status: "current",
          created_at: key.created_at,
          revoked_at: null,
        },
        { session },
      );
      await db.collection("api_key_audit").insertOne(
        {
          user_id: userId,
          api_key_id: keyId,
          api_key_version: 1,
          action: "legacy_migrated",
          actor_type: "user",
          charged_inr: 0,
          created_at: now,
        },
        { session },
      );
      await db.collection("users").updateOne(
        { _id: userId },
        {
          $unset: { api_key: "", api_key_hash: "" },
          $inc: { api_key_count: 1 },
          $set: { api_key_migrated_at: now, updated_at: now },
        },
        { session },
      );
      migrated = key;
    });
  } finally {
    await session.endSession();
  }
  return migrated;
}

export interface CreateApiKeyInput {
  name: unknown;
  scopes: unknown;
  dailyLimitInr?: unknown;
  monthlyLimitInr?: unknown;
  expiresAt?: unknown;
  idempotencyKey: unknown;
}

export async function createApiKey(db: Db, userId: ObjectId, input: CreateApiKeyInput) {
  const { name, normalized } = normalizeKeyName(input.name);
  const settings = normalizeKeySettings(input);
  const idempotencyKey = String(input.idempotencyKey || "").trim();
  if (!/^[A-Za-z0-9:_-]{8,128}$/.test(idempotencyKey)) {
    throw new ApiKeyError("A valid idempotency key is required.");
  }

  const requestFingerprint = crypto.createHash("sha256").update(JSON.stringify({
    name: normalized,
    scopes: settings.scopes,
    daily: settings.dailyLimitPaise,
    monthly: settings.monthlyLimitPaise,
    expires: settings.expiresAt?.toISOString() || null,
  })).digest("hex");
  const generated = generateApiKeySecret();
  const fee = apiKeyCreationFeeInr();
  const now = new Date();
  const client = await getMongoClient();
  const session = client.startSession();
  let output: { key: any; raw: string | null; created: boolean; balance: number } | null = null;

  try {
    await session.withTransaction(async () => {
      const existing: any = await db.collection("api_keys").findOne(
        { user_id: userId, creation_idempotency_key: idempotencyKey },
        { session },
      );
      if (existing) {
        if (existing.creation_request_fingerprint !== requestFingerprint) {
          throw new ApiKeyError("This idempotency key was already used for a different request.", 409, "IDEMPOTENCY_CONFLICT");
        }
        const user = await db.collection("users").findOne({ _id: userId }, { session, projection: { balance: 1 } });
        output = { key: existing, raw: null, created: false, balance: Number(user?.balance || 0) };
        return;
      }

      const count = await db.collection("api_keys").countDocuments(
        { user_id: userId, status: { $ne: "archived" } },
        { session },
      );
      if (count >= maxApiKeysPerUser()) {
        throw new ApiKeyError(`Maximum ${maxApiKeysPerUser()} non-archived API keys reached.`, 409, "KEY_LIMIT_REACHED");
      }

      const user: any = await db.collection("users").findOneAndUpdate(
        { _id: userId, balance: { $gte: fee } },
        {
          $inc: { balance: -fee, api_key_count: 1 },
          $set: { updated_at: now },
        },
        { returnDocument: "after", session },
      );
      if (!user) throw new ApiKeyError(`Insufficient wallet balance. Creating a new key costs ₹${fee.toFixed(2)}.`, 402, "INSUFFICIENT_BALANCE");

      const keyId = new ObjectId();
      const key = {
        _id: keyId,
        user_id: userId,
        name,
        active_name_normalized: normalized,
        public_id: generated.publicId,
        prefix: generated.prefix,
        secret_hint: generated.hint,
        status: "active",
        scopes: settings.scopes,
        daily_limit_paise: settings.dailyLimitPaise,
        monthly_limit_paise: settings.monthlyLimitPaise,
        expires_at: settings.expiresAt,
        current_version: 1,
        legacy_migrated: false,
        creation_fee_inr: fee,
        creation_idempotency_key: idempotencyKey,
        creation_request_fingerprint: requestFingerprint,
        created_at: now,
        updated_at: now,
        last_used_at: null,
        last_rotated_at: null,
      };
      await db.collection("api_keys").insertOne(key, { session });
      await db.collection("api_key_versions").insertOne(
        {
          key_id: keyId,
          user_id: userId,
          version: 1,
          secret_hash: generated.hash,
          secret_hint: generated.hint,
          status: "current",
          created_at: now,
          revoked_at: null,
        },
        { session },
      );
      await db.collection("wallet_ledger").insertOne(
        {
          settlement_key: `api_key_creation:${userId.toString()}:${idempotencyKey}`,
          type: "api_key_creation_fee",
          user_id: userId,
          api_key_id: keyId,
          amount: -fee,
          amount_paise: -Math.round(fee * 100),
          currency: "INR",
          created_at: now,
        },
        { session },
      );
      await db.collection("api_key_audit").insertOne(
        {
          user_id: userId,
          api_key_id: keyId,
          api_key_version: 1,
          action: "created",
          actor_type: "user",
          charged_inr: fee,
          scopes: settings.scopes,
          created_at: now,
        },
        { session },
      );
      output = { key, raw: generated.raw, created: true, balance: Number(user.balance || 0) };
    });
  } catch (error: any) {
    if (error instanceof ApiKeyError) throw error;
    if (error?.code === 11000) {
      const duplicateName = error?.keyPattern?.active_name_normalized;
      throw new ApiKeyError(
        duplicateName ? "An active API key already uses that name." : "API key request conflicts with an existing record.",
        409,
        "DUPLICATE_KEY",
      );
    }
    throw error;
  } finally {
    await session.endSession();
  }

  if (!output) throw new ApiKeyError("API key could not be created.", 500);
  return output;
}

async function ownedKey(db: Db, userId: ObjectId, keyId: unknown, session?: ClientSession): Promise<any> {
  if (!ObjectId.isValid(String(keyId || ""))) throw new ApiKeyError("Invalid API key ID.");
  const key = await db.collection("api_keys").findOne(
    { _id: new ObjectId(String(keyId)), user_id: userId },
    session ? { session } : undefined,
  );
  if (!key) throw new ApiKeyError("API key not found.", 404, "NOT_FOUND");
  return key;
}

export async function updateApiKey(db: Db, userId: ObjectId, keyId: unknown, input: any) {
  const current = await ownedKey(db, userId, keyId);
  if (current.status === "archived") throw new ApiKeyError("Archived API keys cannot be changed.", 409);
  const { name, normalized } = normalizeKeyName(input.name);
  const settings = normalizeKeySettings(input);
  const now = new Date();
  try {
    const updated = await db.collection("api_keys").findOneAndUpdate(
      { _id: current._id, user_id: userId, status: { $ne: "archived" } },
      {
        $set: {
          name,
          active_name_normalized: normalized,
          scopes: settings.scopes,
          daily_limit_paise: settings.dailyLimitPaise,
          monthly_limit_paise: settings.monthlyLimitPaise,
          expires_at: settings.expiresAt,
          updated_at: now,
        },
      },
      { returnDocument: "after" },
    );
    if (!updated) throw new ApiKeyError("API key changed concurrently. Refresh and retry.", 409);
    await db.collection("api_key_audit").insertOne({
      user_id: userId,
      api_key_id: updated._id,
      api_key_version: updated.current_version,
      action: "settings_updated",
      actor_type: "user",
      name: updated.name,
      scopes: updated.scopes,
      daily_limit_paise: updated.daily_limit_paise,
      monthly_limit_paise: updated.monthly_limit_paise,
      expires_at: updated.expires_at,
      created_at: now,
    });
    return updated;
  } catch (error: any) {
    if (error instanceof ApiKeyError) throw error;
    if (error?.code === 11000) throw new ApiKeyError("An active API key already uses that name.", 409);
    throw error;
  }
}

export async function setApiKeyPaused(db: Db, userId: ObjectId, keyId: unknown, paused: boolean) {
  const current = await ownedKey(db, userId, keyId);
  if (current.status === "archived") throw new ApiKeyError("Archived API keys cannot be resumed.", 409);
  const now = new Date();
  const updated = await db.collection("api_keys").findOneAndUpdate(
    { _id: current._id, user_id: userId, status: { $ne: "archived" } },
    { $set: { status: paused ? "paused" : "active", updated_at: now } },
    { returnDocument: "after" },
  );
  if (!updated) throw new ApiKeyError("API key changed concurrently. Refresh and retry.", 409);
  await db.collection("api_key_audit").insertOne({
    user_id: userId,
    api_key_id: updated._id,
    api_key_version: updated.current_version,
    action: paused ? "paused" : "resumed",
    actor_type: "user",
    created_at: now,
  });
  return updated;
}

export async function rotateApiKey(db: Db, userId: ObjectId, keyId: unknown) {
  const client = await getMongoClient();
  const session = client.startSession();
  let updated: any = null;
  let generated: ReturnType<typeof generateApiKeySecret> | null = null;
  try {
    await session.withTransaction(async () => {
      const current = await ownedKey(db, userId, keyId, session);
      if (current.status === "archived") throw new ApiKeyError("Archived API keys cannot be rotated.", 409);
      generated = generateApiKeySecret(current.public_id);
      const now = new Date();
      const nextVersion = Number(current.current_version || 1) + 1;
      await db.collection("api_key_versions").updateOne(
        { key_id: current._id, version: current.current_version, status: "current" },
        { $set: { status: "revoked", revoked_at: now } },
        { session },
      );
      await db.collection("api_key_versions").insertOne(
        {
          key_id: current._id,
          user_id: userId,
          version: nextVersion,
          secret_hash: generated.hash,
          secret_hint: generated.hint,
          status: "current",
          created_at: now,
          revoked_at: null,
        },
        { session },
      );
      updated = await db.collection("api_keys").findOneAndUpdate(
        { _id: current._id, user_id: userId, current_version: current.current_version },
        {
          $set: {
            current_version: nextVersion,
            public_id: generated.publicId,
            prefix: generated.prefix,
            secret_hint: generated.hint,
            last_rotated_at: now,
            owner_reissue_required: false,
            owner_reissue_completed_at: now,
            updated_at: now,
          },
        },
        { returnDocument: "after", session },
      );
      if (!updated) throw new ApiKeyError("API key changed concurrently. Refresh and retry.", 409);
      await db.collection("api_key_audit").insertOne(
        {
          user_id: userId,
          api_key_id: current._id,
          api_key_version: nextVersion,
          previous_version: current.current_version,
          action: "secret_rotated",
          actor_type: "user",
          charged_inr: 0,
          created_at: now,
        },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
  if (!generated) throw new ApiKeyError("API key could not be rotated.", 500);
  return { key: updated, raw: generated.raw };
}

export async function archiveApiKey(db: Db, userId: ObjectId, keyId: unknown, confirmationName: unknown) {
  const current = await ownedKey(db, userId, keyId);
  if (current.status === "archived") throw new ApiKeyError("API key is already archived.", 409);
  if (String(confirmationName || "") !== current.name) {
    throw new ApiKeyError("Type the exact API key name to archive it.", 400, "NAME_CONFIRMATION_REQUIRED");
  }
  const client = await getMongoClient();
  const session = client.startSession();
  let updated: any = null;
  try {
    await session.withTransaction(async () => {
      const now = new Date();
      updated = await db.collection("api_keys").findOneAndUpdate(
        { _id: current._id, user_id: userId, status: { $ne: "archived" } },
        {
          $set: { status: "archived", archived_at: now, updated_at: now },
          $unset: { active_name_normalized: "" },
        },
        { returnDocument: "after", session },
      );
      if (!updated) throw new ApiKeyError("API key changed concurrently. Refresh and retry.", 409);
      await db.collection("api_key_versions").updateMany(
        { key_id: current._id, status: "current" },
        { $set: { status: "revoked", revoked_at: now } },
        { session },
      );
      await db.collection("users").updateOne(
        { _id: userId, api_key_count: { $gt: 0 } },
        { $inc: { api_key_count: -1 }, $set: { updated_at: now } },
        { session },
      );
      await db.collection("api_key_audit").insertOne(
        {
          user_id: userId,
          api_key_id: current._id,
          api_key_version: current.current_version,
          action: "archived",
          actor_type: "user",
          charged_inr: 0,
          name_confirmation: true,
          created_at: now,
        },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
  return updated;
}

export interface AuthenticatedApiKey {
  key: any;
  version: any;
  user: any;
}

export async function authenticateApiKey(db: Db, raw: string): Promise<AuthenticatedApiKey> {
  const secretHash = hashApiKey(raw);
  let version: any = await db.collection("api_key_versions").findOne({ secret_hash: secretHash });

  if (!version) {
    const legacyUser: any = await db.collection("users").findOne({
      $or: [{ api_key_hash: secretHash }, { api_key: raw }],
    });
    if (legacyUser) {
      await migrateLegacyApiKey(db, legacyUser);
      version = await db.collection("api_key_versions").findOne({ secret_hash: secretHash });
    }
  }

  if (!version || version.status !== "current") {
    throw new ApiKeyError("Invalid API key.", 401, "INVALID_KEY");
  }
  const [key, user] = await Promise.all([
    db.collection("api_keys").findOne({ _id: version.key_id }),
    db.collection("users").findOne({ _id: version.user_id }),
  ]);
  if (!key || !user) throw new ApiKeyError("Invalid API key.", 401, "INVALID_KEY");
  if (key.status === "paused") throw new ApiKeyError("This API key is paused.", 403, "KEY_PAUSED");
  if (key.status === "archived") throw new ApiKeyError("This API key is archived.", 401, "KEY_ARCHIVED");
  if (key.expires_at && new Date(key.expires_at).getTime() <= Date.now()) {
    throw new ApiKeyError("This API key has expired.", 401, "KEY_EXPIRED");
  }
  return { key, version, user };
}

export function requireApiKeyScope(key: any, action: unknown): ApiKeyScope {
  const scope = ACTION_SCOPE[String(action || "")];
  if (!scope) throw new ApiKeyError("Invalid action parameter.", 400, "INVALID_ACTION");
  if (!Array.isArray(key.scopes) || !key.scopes.includes(scope)) {
    throw new ApiKeyError(`This API key does not have the required scope: ${scope}.`, 403, "INSUFFICIENT_SCOPE");
  }
  return scope;
}

function istPeriodKeys(now: Date): { day: string; month: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value || "";
  const day = `${value("year")}-${value("month")}-${value("day")}`;
  return { day, month: day.slice(0, 7) };
}

async function reserveBucket(
  db: Db,
  session: ClientSession,
  key: any,
  type: "daily" | "monthly",
  periodKey: string,
  amountPaise: number,
  limitPaise: number,
  now: Date,
) {
  const bucketId = `${key._id.toString()}:${type}:${periodKey}`;
  const bucket: any = await db.collection("api_key_spend_buckets").findOneAndUpdate(
    { _id: bucketId as any },
    [
      {
        $set: {
          key_id: { $ifNull: ["$key_id", key._id] },
          user_id: { $ifNull: ["$user_id", key.user_id] },
          period_type: { $ifNull: ["$period_type", type] },
          period_key: { $ifNull: ["$period_key", periodKey] },
          created_at: { $ifNull: ["$created_at", now] },
          updated_at: now,
          limit_paise: limitPaise,
          spent_paise: { $add: [{ $ifNull: ["$spent_paise", 0] }, amountPaise] },
          order_count: { $add: [{ $ifNull: ["$order_count", 0] }, 1] },
        },
      },
    ],
    { upsert: true, returnDocument: "after", session },
  );
  if (!bucket || Number(bucket.spent_paise) > limitPaise) {
    // Throwing aborts the containing transaction, so an over-limit increment,
    // wallet debit and ledger write can never commit independently.
    throw new ApiKeyError(
      `${type === "daily" ? "Daily" : "Monthly"} API-key spend limit reached.`,
      403,
      "SPEND_LIMIT_REACHED",
    );
  }
}

/** Atomically enforces key limits, debits the wallet and writes a key-attributed ledger entry. */
export async function reserveApiKeyOrderSpend(
  db: Db,
  auth: AuthenticatedApiKey,
  amountInr: number,
  operationId: string,
  orderDraft?: Record<string, unknown>,
) {
  const amountPaise = Math.round(amountInr * 100);
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
    throw new ApiKeyError("Invalid order charge.", 400, "INVALID_CHARGE");
  }
  const client = await getMongoClient();
  const session = client.startSession();
  let newBalance = 0;
  let ledgerId: ObjectId | null = null;
  const orderId = orderDraft ? new ObjectId() : null;

  try {
    await session.withTransaction(async () => {
      const [key, version] = await Promise.all([
        db.collection("api_keys").findOne({ _id: auth.key._id }, { session }),
        db.collection("api_key_versions").findOne({ _id: auth.version._id }, { session }),
      ]);
      if (!key || key.status !== "active" || !version || version.status !== "current" || version.version !== key.current_version) {
        throw new ApiKeyError("API key is no longer active.", 403, "KEY_INACTIVE");
      }
      if (!key.scopes?.includes("orders:create")) {
        throw new ApiKeyError("This API key cannot create orders.", 403, "INSUFFICIENT_SCOPE");
      }
      if (key.expires_at && new Date(key.expires_at).getTime() <= Date.now()) {
        throw new ApiKeyError("This API key has expired.", 401, "KEY_EXPIRED");
      }

      const now = new Date();
      const periods = istPeriodKeys(now);
      if (key.daily_limit_paise !== null && key.daily_limit_paise !== undefined) {
        await reserveBucket(db, session, key, "daily", periods.day, amountPaise, Number(key.daily_limit_paise), now);
      }
      if (key.monthly_limit_paise !== null && key.monthly_limit_paise !== undefined) {
        await reserveBucket(db, session, key, "monthly", periods.month, amountPaise, Number(key.monthly_limit_paise), now);
      }

      const user: any = await db.collection("users").findOneAndUpdate(
        {
          _id: auth.user._id,
          balance: { $gte: amountInr },
          payment_hold: { $ne: true },
          ordering_hold: { $ne: true },
        },
        {
          $inc: { balance: -amountInr, total_spent: amountInr, total_orders: 1 },
          $set: { updated_at: now },
        },
        { returnDocument: "after", session },
      );
      if (!user) {
        const current = await db.collection("users").findOne(
          { _id: auth.user._id },
          { session, projection: { payment_hold: 1, ordering_hold: 1 } },
        );
        if (current?.payment_hold || current?.ordering_hold) {
          throw new ApiKeyError(
            current?.ordering_hold ? "Ordering is paused on this account." : "Ordering is paused while a payment refund or dispute is reviewed.",
            403,
            current?.ordering_hold ? "ORDERING_HOLD" : "PAYMENT_HOLD",
          );
        }
        throw new ApiKeyError("Insufficient balance.", 400, "INSUFFICIENT_BALANCE");
      }

      const ledger = await db.collection("wallet_ledger").insertOne(
        {
          settlement_key: `api_order_charge:${operationId}`,
          type: "api_order_charge",
          user_id: auth.user._id,
          api_key_id: key._id,
          api_key_version: version.version,
          amount: -amountInr,
          amount_paise: -amountPaise,
          currency: "INR",
          operation_id: operationId,
          created_at: now,
        },
        { session },
      );
      ledgerId = ledger.insertedId;
      newBalance = Number(user.balance || 0);

      if (orderId && orderDraft) {
        await db.collection("orders").insertOne({
          ...orderDraft,
          _id: orderId,
          user_id: auth.user._id,
          user_email: auth.user.email,
          charge: amountInr,
          provider_order_id: null,
          provider_error: null,
          status: "Submitting",
          refund_status: null,
          source: "v2_api",
          api_key_id: key._id,
          api_key_version: version.version,
          api_operation_id: operationId,
          wallet_ledger_id: ledger.insertedId,
          created_at: now,
          updated_at: now,
        }, { session });
      }
    });
  } finally {
    await session.endSession();
  }
  return { newBalance, ledgerId, amountPaise, orderId };
}

export async function recordApiKeyActivity(
  db: Db,
  auth: AuthenticatedApiKey,
  input: {
    action: string;
    scope: string;
    httpStatus: number;
    result: string;
    requestId: string;
    orderId?: ObjectId | string | null;
    orderIds?: Array<ObjectId | string>;
    serviceId?: number | string | null;
    serviceName?: string | null;
    target?: string | null;
    quantity?: number | null;
    grossChargeInr?: number | null;
    refundInr?: number | null;
    netChargeInr?: number | null;
    ipHash?: string | null;
    startedAt: Date;
  },
) {
  const now = new Date();
  await Promise.all([
    db.collection("api_key_activity").insertOne({
      user_id: auth.user._id,
      api_key_id: auth.key._id,
      api_key_version: auth.version.version,
      action: input.action,
      scope: input.scope,
      http_status: input.httpStatus,
      result: input.result,
      request_id: input.requestId,
      order_id: input.orderId || null,
      order_ids: input.orderIds || [],
      service_id: input.serviceId ?? null,
      service_name: input.serviceName ? String(input.serviceName).slice(0, 160) : null,
      target: input.target ? String(input.target).slice(0, 2048) : null,
      quantity: input.quantity ?? null,
      gross_charge_inr: input.grossChargeInr ?? null,
      refund_inr: input.refundInr ?? 0,
      net_charge_inr: input.netChargeInr ?? input.grossChargeInr ?? null,
      ip_hash: input.ipHash || null,
      started_at: input.startedAt,
      completed_at: now,
      duration_ms: Math.max(0, now.getTime() - input.startedAt.getTime()),
    }),
    db.collection("api_keys").updateOne(
      { _id: auth.key._id },
      { $set: { last_used_at: now } },
    ),
  ]);
}
