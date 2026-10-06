import React from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Check,
  Copy,
  ExternalLink,
  EyeOff,
  IndianRupee,
  Key,
  Loader2,
  LogOut,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  Trash2,
  User,
  X,
} from "lucide-react";
import ContentPage from "../ContentPage";
import { formatINR, formatNumber } from "../../lib/utils";

interface PageProps {
  onNavigate: (tab: string) => void;
}

interface ApiKeyRecord {
  id: string;
  name: string;
  publicId: string;
  prefix: string;
  hint: string;
  status: "active" | "paused" | "archived";
  scopes: string[];
  fullAccess: boolean;
  dailyLimitInr: number | null;
  monthlyLimitInr: number | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  lastRotatedAt: string | null;
  currentVersion: number;
  legacyMigrated: boolean;
}

interface ApiKeyForm {
  name: string;
  scopes: string[];
  dailyLimitInr: string;
  monthlyLimitInr: string;
  expiresAt: string;
}

const FALLBACK_SCOPES = [
  "services:read",
  "balance:read",
  "orders:create",
  "orders:read",
  "orders:cancel",
  "orders:refill",
];

const SCOPE_LABELS: Record<string, string> = {
  "services:read": "View services",
  "balance:read": "View balance",
  "orders:create": "Create orders",
  "orders:read": "View orders",
  "orders:cancel": "Cancel orders",
  "orders:refill": "Request refills",
};

function freshIdempotencyKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `key_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function dateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/* ══════════════════════ ACCOUNT ══════════════════════ */
interface AccountPageProps extends PageProps {
  user: any;
  onLogout: () => void;
  onUserUpdate?: (patch: any) => void;
}

export function AccountPage({ onNavigate, user, onLogout, onUserUpdate }: AccountPageProps) {
  const [keys, setKeys] = React.useState<ApiKeyRecord[] | null>(null);
  const [scopes, setScopes] = React.useState<string[]>(FALLBACK_SCOPES);
  const [creationFee, setCreationFee] = React.useState(29);
  const [maxKeys, setMaxKeys] = React.useState(10);
  const [formMode, setFormMode] = React.useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<ApiKeyForm>({
    name: "",
    scopes: [...FALLBACK_SCOPES],
    dailyLimitInr: "",
    monthlyLimitInr: "",
    expiresAt: "",
  });
  const [idempotencyKey, setIdempotencyKey] = React.useState(freshIdempotencyKey);
  const [revealed, setRevealed] = React.useState<{ name: string; secret: string } | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [confirmRotateId, setConfirmRotateId] = React.useState<string | null>(null);
  const [archive, setArchive] = React.useState<{ id: string; name: string; value: string } | null>(null);
  const [activityKeyId, setActivityKeyId] = React.useState<string | null>(null);
  const [activity, setActivity] = React.useState<any[] | null>(null);
  const [activityFilters, setActivityFilters] = React.useState({
    action: "",
    outcome: "",
    from: "",
    to: "",
    serviceId: "",
    orderId: "",
    minAmount: "",
    maxAmount: "",
  });
  const [reports, setReports] = React.useState<Record<string, any>>({});
  const [sessions, setSessions] = React.useState<{ items: any[]; legacyCurrent: boolean } | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");

  const formatDate = (value?: string | null) => {
    if (!value) return "Never";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString("en-IN");
  };

  const loadKeys = React.useCallback(async () => {
    try {
      const response = await fetch("/api/auth/list-api-keys", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Failed to load API keys.");
      const nextKeys = Array.isArray(data.keys) ? data.keys : [];
      setKeys(nextKeys);
      setScopes(Array.isArray(data.scopes) && data.scopes.length ? data.scopes : FALLBACK_SCOPES);
      setCreationFee(Number(data.creationFeeInr ?? 29));
      setMaxKeys(Number(data.maxKeys ?? 10));
      onUserUpdate?.({
        balance: Number(data.balance ?? 0),
        hasApiKey: nextKeys.some((key: ApiKeyRecord) => key.status !== "archived"),
        apiKeyCount: nextKeys.filter((key: ApiKeyRecord) => key.status !== "archived").length,
      });

      // Reporting is non-blocking: key lifecycle controls remain available even
      // if an aggregate query is temporarily unavailable.
      fetch("/api/auth/api-key-report", { cache: "no-store" })
        .then(async (reportResponse) => ({
          ok: reportResponse.ok,
          data: await reportResponse.json().catch(() => ({})),
        }))
        .then(({ ok, data: reportData }) => {
          if (!ok || !Array.isArray(reportData.summaries)) return;
          setReports(Object.fromEntries(
            reportData.summaries.map((summary: any) => [summary.key.id, summary]),
          ));
        })
        .catch(() => {});

      fetch("/api/auth/list-sessions", { cache: "no-store" })
        .then(async (sessionResponse) => ({
          ok: sessionResponse.ok,
          data: await sessionResponse.json().catch(() => ({})),
        }))
        .then(({ ok, data: sessionData }) => {
          if (!ok) return;
          setSessions({
            items: Array.isArray(sessionData.sessions) ? sessionData.sessions : [],
            legacyCurrent: Boolean(sessionData.legacyCurrentSession),
          });
        })
        .catch(() => {});
    } catch (loadError: any) {
      setKeys([]);
      setError(loadError?.message || "Failed to load API keys.");
    }
  }, [onUserUpdate]);

  React.useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const request = async (action: string, body?: Record<string, unknown>) => {
    const response = await fetch(`/api/auth/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request failed.");
    return data;
  };

  const reloadSessions = async () => {
    const response = await fetch("/api/auth/list-sessions", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Failed to load sessions.");
    setSessions({
      items: Array.isArray(data.sessions) ? data.sessions : [],
      legacyCurrent: Boolean(data.legacyCurrentSession),
    });
  };

  const resetMessages = () => {
    setError("");
    setSuccess("");
  };

  const beginCreate = () => {
    resetMessages();
    setEditingId(null);
    setFormMode("create");
    setIdempotencyKey(freshIdempotencyKey());
    setForm({ name: "", scopes: [...scopes], dailyLimitInr: "", monthlyLimitInr: "", expiresAt: "" });
    setArchive(null);
    setConfirmRotateId(null);
  };

  const beginEdit = (key: ApiKeyRecord) => {
    resetMessages();
    setFormMode("edit");
    setEditingId(key.id);
    setForm({
      name: key.name,
      scopes: [...key.scopes],
      dailyLimitInr: key.dailyLimitInr === null ? "" : String(key.dailyLimitInr),
      monthlyLimitInr: key.monthlyLimitInr === null ? "" : String(key.monthlyLimitInr),
      expiresAt: dateTimeLocal(key.expiresAt),
    });
    setArchive(null);
    setConfirmRotateId(null);
  };

  const cancelForm = () => {
    setFormMode(null);
    setEditingId(null);
  };

  const toggleFullAccess = (checked: boolean) => {
    setForm((current) => ({ ...current, scopes: checked ? [...scopes] : [] }));
  };

  const toggleScope = (scope: string) => {
    setForm((current) => ({
      ...current,
      scopes: current.scopes.includes(scope)
        ? current.scopes.filter((item) => item !== scope)
        : [...current.scopes, scope],
    }));
  };

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    resetMessages();
    if (form.scopes.length === 0) {
      setError("Select at least one API scope.");
      return;
    }
    const operation = formMode === "create" ? "create" : `edit:${editingId}`;
    setBusy(operation);
    try {
      const payload = {
        name: form.name,
        scopes: form.scopes,
        dailyLimitInr: form.dailyLimitInr || null,
        monthlyLimitInr: form.monthlyLimitInr || null,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      };
      if (formMode === "create") {
        const data = await request("create-api-key", { ...payload, idempotencyKey });
        if (data.apiKey) {
          setRevealed({ name: data.key.name, secret: data.apiKey });
          setSuccess("Key created. Copy its secret now; SMM UP will never display it again.");
        } else {
          setSuccess(data.message || "The idempotent creation request was already completed.");
        }
        if (typeof data.balance === "number") onUserUpdate?.({ balance: data.balance });
      } else {
        await request("update-api-key", { ...payload, keyId: editingId });
        setSuccess("API key settings saved. No fee was charged.");
      }
      cancelForm();
      await loadKeys();
    } catch (submitError: any) {
      setError(submitError?.message || "API key operation failed.");
    } finally {
      setBusy(null);
    }
  };

  const pauseOrResume = async (key: ApiKeyRecord) => {
    resetMessages();
    setBusy(`status:${key.id}`);
    try {
      const pausing = key.status === "active";
      await request(pausing ? "pause-api-key" : "resume-api-key", { keyId: key.id });
      setSuccess(`${key.name} ${pausing ? "paused" : "resumed"}. No fee was charged.`);
      await loadKeys();
    } catch (statusError: any) {
      setError(statusError?.message || "Status change failed.");
    } finally {
      setBusy(null);
    }
  };

  const rotate = async (key: ApiKeyRecord) => {
    if (confirmRotateId !== key.id) {
      resetMessages();
      setConfirmRotateId(key.id);
      setArchive(null);
      return;
    }
    setBusy(`rotate:${key.id}`);
    resetMessages();
    try {
      const data = await request("rotate-api-key", { keyId: key.id, confirm: true });
      setRevealed({ name: key.name, secret: data.apiKey });
      setConfirmRotateId(null);
      setSuccess("Secret rotated for free. The old secret is permanently revoked; copy the new one now.");
      await loadKeys();
    } catch (rotateError: any) {
      setError(rotateError?.message || "Secret rotation failed.");
    } finally {
      setBusy(null);
    }
  };

  const archiveKey = async () => {
    if (!archive) return;
    setBusy(`archive:${archive.id}`);
    resetMessages();
    try {
      await request("archive-api-key", {
        keyId: archive.id,
        confirmationName: archive.value,
      });
      setArchive(null);
      setSuccess("Key permanently archived. Access is revoked, attribution is retained and no fee is refunded.");
      await loadKeys();
    } catch (archiveError: any) {
      setError(archiveError?.message || "Archive failed.");
    } finally {
      setBusy(null);
    }
  };

  const loadActivity = async (keyId: string, filters = activityFilters) => {
    setActivity(null);
    try {
      const params = new URLSearchParams({ keyId, limit: "100" });
      if (filters.action) params.set("actionFilter", filters.action);
      if (filters.outcome) params.set("outcome", filters.outcome);
      if (filters.from) params.set("from", new Date(filters.from).toISOString());
      if (filters.to) params.set("to", new Date(filters.to).toISOString());
      if (filters.serviceId) params.set("serviceId", filters.serviceId);
      if (filters.orderId) params.set("orderId", filters.orderId);
      if (filters.minAmount) params.set("minAmount", filters.minAmount);
      if (filters.maxAmount) params.set("maxAmount", filters.maxAmount);
      const response = await fetch(`/api/auth/api-key-activity?${params.toString()}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Failed to load activity.");
      setActivity(Array.isArray(data.activity) ? data.activity : []);
    } catch (activityError: any) {
      setActivity([]);
      setError(activityError?.message || "Failed to load activity.");
    }
  };

  const showActivity = async (key: ApiKeyRecord) => {
    if (activityKeyId === key.id) {
      setActivityKeyId(null);
      setActivity(null);
      return;
    }
    setActivityKeyId(key.id);
    resetMessages();
    await loadActivity(key.id);
  };

  const revokeSession = async (session: any) => {
    resetMessages();
    setBusy(`session:${session.id}`);
    try {
      const data = await request("revoke-session", { sessionId: session.id });
      if (data.revokedCurrent) {
        onLogout();
        return;
      }
      setSuccess("Session revoked.");
      await reloadSessions();
    } catch (sessionError: any) {
      setError(sessionError?.message || "Session revocation failed.");
    } finally {
      setBusy(null);
    }
  };

  const revokeOtherSessions = async () => {
    resetMessages();
    setBusy("sessions:others");
    try {
      const data = await request("revoke-other-sessions");
      setSuccess(`${data.revokedCount || 0} other session${data.revokedCount === 1 ? "" : "s"} revoked.`);
      await reloadSessions();
    } catch (sessionError: any) {
      setError(sessionError?.message || "Session revocation failed.");
    } finally {
      setBusy(null);
    }
  };

  const copySecret = async () => {
    if (!revealed) return;
    await navigator.clipboard.writeText(revealed.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const activeKeyCount = keys?.filter((key) => key.status !== "archived").length || 0;
  const readOnlySupport = Boolean(user?.supportSession?.active);
  const fullAccess = scopes.length > 0 && scopes.every((scope) => form.scopes.includes(scope));

  return (
    <ContentPage
      kicker="Account"
      title="My Account"
      subtitle="Identity, wallet activity, named developer credentials and account security in one permanent workspace."
      crumbs={[{ label: "Home", tab: "home" }, { label: "Account" }]}
      onNavigate={onNavigate}
      wide
    >
      <div className="space-y-6">
        <section className="grid lg:grid-cols-[1fr_auto] gap-5 items-center p-5 sm:p-6 border border-white/12 bg-white/[0.025]">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 border border-white/10 bg-white/[0.04] flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-zinc-200" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 block mb-1">Signed-in account</span>
              <h2 className="text-lg font-semibold text-white truncate">@{user?.username}</h2>
              <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 lg:justify-end">
            <span className="px-2.5 py-1 border border-white/10 bg-black/40 text-[10px] uppercase tracking-wider text-zinc-300">{user?.role || "user"}</span>
            <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-400"><span className="w-1.5 h-1.5 rounded-full bg-white" /> Active session</span>
          </div>
        </section>

        {readOnlySupport && (
          <section className="p-4 border border-white/20 bg-white text-black text-xs flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span><strong>Read-only Support Session.</strong> Account, orders, deposits, key metadata and security state are visible; spending, deposits, password changes and API-key mutations are blocked server-side.</span>
          </section>
        )}

        <section className="grid sm:grid-cols-3 gap-3">
          <div className="p-4 border border-white/[0.08] bg-black/35"><span className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Wallet balance</span><span className="text-xl font-semibold text-white">{formatINR(user?.balance || 0)}</span></div>
          <div className="p-4 border border-white/[0.08] bg-black/35"><span className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Total spent</span><span className="text-xl font-semibold text-white">{formatINR(user?.total_spent || 0)}</span></div>
          <div className="p-4 border border-white/[0.08] bg-black/35"><span className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">Orders placed</span><span className="text-xl font-semibold text-white">{formatNumber(user?.total_orders || 0)}</span></div>
        </section>

        <section className="grid sm:grid-cols-3 gap-3">
          {readOnlySupport
            ? <span className="btn-up btn-up-ghost w-full justify-between opacity-45 cursor-not-allowed"><span className="flex items-center gap-2"><IndianRupee className="w-4 h-4" /> Add funds blocked</span><span>×</span></span>
            : <a href="/add-funds" className="btn-up btn-up-solid w-full justify-between"><span className="flex items-center gap-2"><IndianRupee className="w-4 h-4" /> Add funds</span><span>→</span></a>}
          <a href="/transactions" className="btn-up btn-up-ghost w-full justify-between"><span className="flex items-center gap-2"><IndianRupee className="w-4 h-4" /> Deposit history</span><span>→</span></a>
          <a href="/logs" className="btn-up btn-up-ghost w-full justify-between"><span className="flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Order history</span><span>→</span></a>
        </section>

        <div className="grid xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
          <div className="space-y-5">
            <section className="p-5 sm:p-6 border border-white/12 bg-white/[0.02] space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-white/[0.08]">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-white"><Key className="w-4 h-4" /> Named API keys</div>
                  <p className="text-xs text-zinc-500 mt-1">{activeKeyCount}/{maxKeys} non-archived identities · new identity fee {formatINR(creationFee)}</p>
                </div>
                <button type="button" onClick={beginCreate} disabled={readOnlySupport || activeKeyCount >= maxKeys || formMode === "create"} className="btn-up btn-up-solid btn-up-sm disabled:opacity-40">
                  <Plus className="w-3.5 h-3.5" /> Create key
                </button>
              </div>

              {revealed && (
                <div className="p-4 border border-white/25 bg-white/[0.06] space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="text-xs font-semibold text-white">Copy {revealed.name} now</p><p className="text-[11px] text-zinc-400 mt-1">This full secret is shown once. It cannot be recovered later.</p></div>
                    <button type="button" onClick={() => setRevealed(null)} aria-label="Hide secret" className="text-zinc-500 hover:text-white"><EyeOff className="w-4 h-4" /></button>
                  </div>
                  <code className="block p-3 bg-black/70 border border-white/10 text-xs text-zinc-200 break-all">{revealed.secret}</code>
                  <button type="button" onClick={copySecret} className="btn-up btn-up-solid btn-up-sm">{copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? "Copied" : "Copy secret"}</button>
                </div>
              )}

              {error && <div className="p-3.5 border border-white/15 bg-white/[0.05] text-xs text-zinc-200 flex items-start gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}</div>}
              {success && <div className="p-3.5 border border-white/15 bg-white/[0.05] text-xs text-zinc-200 flex items-start gap-2"><Check className="w-4 h-4 shrink-0 mt-0.5" /> {success}</div>}

              {formMode && (
                <form onSubmit={submitForm} className="p-4 border border-white/12 bg-black/35 space-y-4">
                  <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-white">{formMode === "create" ? "Create named key" : "Edit key settings"}</p><p className="text-[11px] text-zinc-500 mt-1">{formMode === "create" ? `${formatINR(creationFee)} is charged once after confirmation.` : "Renaming and configuration changes are free."}</p></div><button type="button" onClick={cancelForm} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button></div>
                  <label className="block"><span className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1.5">Unique key name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} minLength={3} maxLength={40} required className="w-full bg-black/70 border border-white/10 px-3 py-2.5 text-xs text-white outline-none focus:border-white/30" placeholder="Production panel" /></label>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between"><span className="text-[10px] uppercase tracking-wider text-zinc-500">Permissions</span><label className="flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={fullAccess} onChange={(event) => toggleFullAccess(event.target.checked)} /> Full Access</label></div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {scopes.map((scope) => <label key={scope} className="flex items-center gap-2 p-2.5 border border-white/[0.08] bg-black/30 text-xs text-zinc-300"><input type="checkbox" checked={form.scopes.includes(scope)} onChange={() => toggleScope(scope)} /><span>{SCOPE_LABELS[scope] || scope}</span></label>)}
                    </div>
                    {form.scopes.length === 0 && <p className="text-[11px] text-zinc-500">A key cannot be saved with zero permissions.</p>}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <label><span className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1.5">Daily spend limit (INR)</span><input type="number" min="0.01" step="0.01" value={form.dailyLimitInr} onChange={(event) => setForm({ ...form, dailyLimitInr: event.target.value })} className="w-full bg-black/70 border border-white/10 px-3 py-2.5 text-xs text-white outline-none focus:border-white/30" placeholder="No limit" /></label>
                    <label><span className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1.5">Monthly spend limit (INR)</span><input type="number" min="0.01" step="0.01" value={form.monthlyLimitInr} onChange={(event) => setForm({ ...form, monthlyLimitInr: event.target.value })} className="w-full bg-black/70 border border-white/10 px-3 py-2.5 text-xs text-white outline-none focus:border-white/30" placeholder="No limit" /></label>
                  </div>
                  <label className="block"><span className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1.5">Expiration (optional)</span><input type="datetime-local" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} className="w-full bg-black/70 border border-white/10 px-3 py-2.5 text-xs text-white outline-none focus:border-white/30" /><span className="text-[10px] text-zinc-600 mt-1 block">Leave empty for Never.</span></label>
                  <button type="submit" disabled={readOnlySupport || busy !== null || form.scopes.length === 0} className="btn-up btn-up-solid w-full sm:w-auto disabled:opacity-40">{busy === (formMode === "create" ? "create" : `edit:${editingId}`) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {formMode === "create" ? `Create for ${formatINR(creationFee)}` : "Save settings"}</button>
                </form>
              )}

              {keys === null ? (
                <div className="space-y-3">{[0, 1].map((item) => <div key={item} className="skeleton h-36" />)}</div>
              ) : keys.length === 0 ? (
                <div className="p-8 text-center border border-white/[0.08]"><Key className="w-5 h-5 text-zinc-500 mx-auto mb-3" /><p className="text-sm text-zinc-300">No API keys yet</p><p className="text-xs text-zinc-600 mt-1">Create a named identity with only the permissions it needs.</p></div>
              ) : (
                <div className="space-y-3">
                  {keys.map((key) => (
                    <article key={key.id} className={`p-4 border ${key.status === "archived" ? "border-white/[0.05] opacity-60" : "border-white/10"} bg-black/30 space-y-3`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-white">{key.name}</h3>{key.legacyMigrated && <span className="text-[9px] px-1.5 py-0.5 border border-white/10 text-zinc-500">MIGRATED FREE</span>}<span className="text-[9px] px-1.5 py-0.5 border border-white/10 text-zinc-400 uppercase">{key.status}</span></div><code className="text-[11px] text-zinc-500 mt-1 block">{key.prefix}…{key.hint}</code></div>
                        <div className="text-right text-[10px] text-zinc-600"><span className="block">Version {key.currentVersion}</span><span>{key.fullAccess ? "Full Access" : `${key.scopes.length} scopes`}</span></div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">{key.scopes.map((scope) => <span key={scope} className="px-2 py-1 bg-white/[0.03] border border-white/[0.07] text-[9px] text-zinc-500">{SCOPE_LABELS[scope] || scope}</span>)}</div>
                      <div className="grid sm:grid-cols-4 gap-2 text-[10px]"><div><span className="text-zinc-600 block">Created</span><span className="text-zinc-400">{formatDate(key.createdAt)}</span></div><div><span className="text-zinc-600 block">Last used</span><span className="text-zinc-400">{formatDate(key.lastUsedAt)}</span></div><div><span className="text-zinc-600 block">Daily limit</span><span className="text-zinc-400">{key.dailyLimitInr === null ? "None" : formatINR(key.dailyLimitInr)}</span></div><div><span className="text-zinc-600 block">Expires</span><span className="text-zinc-400">{formatDate(key.expiresAt)}</span></div></div>

                      {reports[key.id] && (
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 border border-white/[0.06] bg-black/30 text-[10px]">
                          <div><span className="text-zinc-600 block">Requests (90d)</span><span className="text-zinc-300">{formatNumber(reports[key.id].requestCount || 0)}</span></div>
                          <div><span className="text-zinc-600 block">Error rate</span><span className="text-zinc-300">{((reports[key.id].errorRate || 0) * 100).toFixed(1)}%</span></div>
                          <div><span className="text-zinc-600 block">Lifetime orders</span><span className="text-zinc-300">{formatNumber(reports[key.id].orderCount || 0)}</span></div>
                          <div><span className="text-zinc-600 block">Gross spend</span><span className="text-zinc-300">{formatINR(reports[key.id].grossChargeInr || 0)}</span></div>
                          <div><span className="text-zinc-600 block">Net spend</span><span className="text-zinc-300">{formatINR(reports[key.id].netChargeInr || 0)}</span></div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-1">
                        {key.status !== "archived" && (
                          <>
                            <button type="button" onClick={() => beginEdit(key)} disabled={readOnlySupport} className="btn-up btn-up-ghost btn-up-sm disabled:opacity-40"><Settings className="w-3.5 h-3.5" /> Settings</button>
                            <button type="button" onClick={() => pauseOrResume(key)} disabled={readOnlySupport || busy !== null} className="btn-up btn-up-ghost btn-up-sm disabled:opacity-40">{key.status === "active" ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />} {key.status === "active" ? "Pause" : "Resume"}</button>
                            <button type="button" onClick={() => rotate(key)} disabled={readOnlySupport || busy !== null} className={`btn-up btn-up-ghost btn-up-sm disabled:opacity-40 ${confirmRotateId === key.id ? "border-white/30 bg-white/[0.06]" : ""}`}>{busy === `rotate:${key.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} {confirmRotateId === key.id ? "Confirm permanent rotation" : "Rotate secret"}</button>
                            <button type="button" onClick={() => { setArchive({ id: key.id, name: key.name, value: "" }); setConfirmRotateId(null); }} disabled={readOnlySupport} className="btn-up btn-up-ghost btn-up-sm disabled:opacity-40"><Trash2 className="w-3.5 h-3.5" /> Archive</button>
                          </>
                        )}
                        <button type="button" onClick={() => showActivity(key)} className="btn-up btn-up-ghost btn-up-sm"><Activity className="w-3.5 h-3.5" /> Activity</button>
                      </div>

                      {archive?.id === key.id && (
                        <div className="p-3 border border-white/15 bg-white/[0.04] space-y-2"><p className="text-[11px] text-zinc-300">Permanent action. Type <strong className="text-white">{key.name}</strong> exactly. There is no refund.</p><div className="flex flex-col sm:flex-row gap-2"><input value={archive.value} onChange={(event) => setArchive({ ...archive, value: event.target.value })} className="flex-1 bg-black/70 border border-white/10 px-3 py-2 text-xs text-white outline-none" /><button type="button" onClick={archiveKey} disabled={readOnlySupport || archive.value !== key.name || busy !== null} className="btn-up btn-up-solid btn-up-sm disabled:opacity-40">Archive permanently</button><button type="button" onClick={() => setArchive(null)} className="btn-up btn-up-ghost btn-up-sm">Cancel</button></div></div>
                      )}

                      {activityKeyId === key.id && (
                        <div className="border-t border-white/[0.07] pt-3">
                          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Recent key activity · 90-day detail</p>
                          <form
                            onSubmit={(event) => { event.preventDefault(); loadActivity(key.id); }}
                            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-3"
                          >
                            <select value={activityFilters.action} onChange={(event) => setActivityFilters({ ...activityFilters, action: event.target.value })} className="bg-black/70 border border-white/10 px-2 py-2 text-[10px] text-zinc-300 outline-none">
                              <option value="">All actions</option>
                              <option value="services">Services</option><option value="balance">Balance</option><option value="add">Add order</option><option value="status">Status</option><option value="cancel">Cancel</option><option value="refill">Refill</option><option value="refill_status">Refill status</option><option value="refund">Refund</option>
                            </select>
                            <select value={activityFilters.outcome} onChange={(event) => setActivityFilters({ ...activityFilters, outcome: event.target.value })} className="bg-black/70 border border-white/10 px-2 py-2 text-[10px] text-zinc-300 outline-none">
                              <option value="">All outcomes</option><option value="success">Success</option><option value="error">Error</option>
                            </select>
                            <input type="datetime-local" aria-label="Activity from" value={activityFilters.from} onChange={(event) => setActivityFilters({ ...activityFilters, from: event.target.value })} className="bg-black/70 border border-white/10 px-2 py-2 text-[10px] text-zinc-300 outline-none" />
                            <input type="datetime-local" aria-label="Activity to" value={activityFilters.to} onChange={(event) => setActivityFilters({ ...activityFilters, to: event.target.value })} className="bg-black/70 border border-white/10 px-2 py-2 text-[10px] text-zinc-300 outline-none" />
                            <input aria-label="Service ID filter" value={activityFilters.serviceId} onChange={(event) => setActivityFilters({ ...activityFilters, serviceId: event.target.value })} placeholder="Service ID" className="bg-black/70 border border-white/10 px-2 py-2 text-[10px] text-zinc-300 outline-none" />
                            <input aria-label="Order ID filter" value={activityFilters.orderId} onChange={(event) => setActivityFilters({ ...activityFilters, orderId: event.target.value })} placeholder="Order ID" className="bg-black/70 border border-white/10 px-2 py-2 text-[10px] text-zinc-300 outline-none" />
                            <input type="number" min="0" step="0.01" aria-label="Minimum amount" value={activityFilters.minAmount} onChange={(event) => setActivityFilters({ ...activityFilters, minAmount: event.target.value })} placeholder="Min INR" className="bg-black/70 border border-white/10 px-2 py-2 text-[10px] text-zinc-300 outline-none" />
                            <input type="number" min="0" step="0.01" aria-label="Maximum amount" value={activityFilters.maxAmount} onChange={(event) => setActivityFilters({ ...activityFilters, maxAmount: event.target.value })} placeholder="Max INR" className="bg-black/70 border border-white/10 px-2 py-2 text-[10px] text-zinc-300 outline-none" />
                            <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
                              <button type="submit" className="btn-up btn-up-ghost btn-up-sm">Apply filters</button>
                              <button type="button" onClick={() => { const empty = { action: "", outcome: "", from: "", to: "", serviceId: "", orderId: "", minAmount: "", maxAmount: "" }; setActivityFilters(empty); loadActivity(key.id, empty); }} className="btn-up btn-up-ghost btn-up-sm">Reset</button>
                            </div>
                          </form>
                          {activity === null ? <Loader2 className="w-4 h-4 animate-spin text-zinc-500" /> : activity.length === 0 ? <p className="text-[11px] text-zinc-600">No activity recorded yet.</p> : (
                            <div className="space-y-1.5">
                              {activity.map((item) => (
                                <div key={item.id} className="p-2.5 bg-black/40 text-[10px] space-y-1">
                                  <div className="flex flex-wrap justify-between gap-2">
                                    <span className="text-zinc-300">{item.action} · v{item.keyVersion}{item.serviceName ? ` · ${item.serviceName}` : ""}</span>
                                    <span className={item.httpStatus < 400 ? "text-zinc-400" : "text-zinc-200"}>{item.httpStatus} · {item.durationMs || 0}ms</span>
                                  </div>
                                  <div className="flex flex-wrap justify-between gap-2 text-zinc-600">
                                    <span>{item.orderId ? `Order ${item.orderId}` : item.result}{item.grossChargeInr != null ? ` · ${formatINR(item.grossChargeInr)}` : ""}</span>
                                    <span>{formatDate(item.completedAt)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}

              <a href="/api" className="inline-flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white underline underline-offset-4">Open API documentation <ExternalLink className="w-3.5 h-3.5" /></a>
            </section>
          </div>

          <aside className="p-5 border border-white/12 bg-white/[0.02] space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><ShieldCheck className="w-4 h-4" /> Account security</div>
            <ul className="space-y-3 text-xs leading-relaxed text-zinc-400">
              <li className="flex gap-2"><Check className="w-3.5 h-3.5 text-zinc-300 shrink-0 mt-0.5" /> Raw API secrets are stored only as hashes and shown once.</li>
              <li className="flex gap-2"><Check className="w-3.5 h-3.5 text-zinc-300 shrink-0 mt-0.5" /> Pause is reversible; rotation and archive are permanent.</li>
              <li className="flex gap-2"><CalendarClock className="w-3.5 h-3.5 text-zinc-300 shrink-0 mt-0.5" /> Limits use IST calendar periods; expiration is optional.</li>
              <li className="flex gap-2"><Check className="w-3.5 h-3.5 text-zinc-300 shrink-0 mt-0.5" /> SMM UP never asks for a social-media password, OTP or UPI PIN.</li>
            </ul>
            <div className="text-[10px] text-zinc-600 border-t border-white/[0.07] pt-3 space-y-1"><p>Creation: {formatINR(creationFee)} per new identity.</p><p>Rotation, pause, resume and settings: free.</p><p>Legacy migration: free.</p></div>
            <button type="button" onClick={onLogout} className="btn-up btn-up-ghost w-full"><LogOut className="w-4 h-4" /> Sign out</button>
          </aside>
        </div>

        <section className="p-5 sm:p-6 border border-white/12 bg-white/[0.02] space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-white/[0.08]">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-white"><ShieldCheck className="w-4 h-4" /> Devices and sessions</div>
              <p className="text-xs text-zinc-500 mt-1">Opaque, hash-only server sessions can be revoked immediately.</p>
            </div>
            <button type="button" onClick={revokeOtherSessions} disabled={readOnlySupport || busy !== null} className="btn-up btn-up-ghost btn-up-sm disabled:opacity-40">
              {busy === "sessions:others" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />} Revoke other sessions
            </button>
          </div>
          {sessions?.legacyCurrent && (
            <div className="p-3 border border-white/10 bg-white/[0.03] text-[11px] text-zinc-400">This is a migration-era signed session. Signing in again upgrades this browser to an individually revocable MongoDB session.</div>
          )}
          {sessions === null ? (
            <div className="skeleton h-16" />
          ) : sessions.items.length === 0 ? (
            <p className="text-xs text-zinc-600">No active MongoDB sessions are recorded yet.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-2">
              {sessions.items.map((session) => (
                <div key={session.id} className="p-3 border border-white/[0.08] bg-black/30 flex items-start justify-between gap-3">
                  <div className="min-w-0 text-[10px]">
                    <div className="flex items-center gap-2"><span className="text-zinc-300 font-semibold">{session.device?.platform || (session.device?.mobile ? "Mobile device" : "Browser session")}</span>{session.current && <span className="px-1.5 py-0.5 border border-white/10 text-zinc-400">CURRENT</span>}</div>
                    <p className="text-zinc-600 mt-1 truncate" title={session.device?.userAgent}>{session.device?.userAgent || "Unknown device"}</p>
                    <p className="text-zinc-600 mt-1">Last active {formatDate(session.lastActivityAt)} · expires {formatDate(session.expiresAt)}</p>
                  </div>
                  <button type="button" onClick={() => revokeSession(session)} disabled={readOnlySupport || busy !== null} className="btn-up btn-up-ghost btn-up-sm shrink-0 disabled:opacity-40">{busy === `session:${session.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Revoke"}</button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </ContentPage>
  );
}

/* ══════════════════════ TRANSACTIONS ══════════════════════ */
export function TransactionsPage({ onNavigate, user }: PageProps & { user: any }) {
  const [txns, setTxns] = React.useState<any[] | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/payments/history");
        const data = await res.json();
        if (!alive) return;
        if (res.ok && Array.isArray(data.transactions)) setTxns(data.transactions);
        else setTxns([]);
      } catch {
        if (alive) setError("Couldn't load transactions right now.");
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <ContentPage
      kicker="Account"
      title="Deposit History"
      subtitle="Every Direct UPI and Razorpay wallet deposit with its reference and settlement status."
      crumbs={[{ label: "Home", tab: "home" }, { label: "Account", tab: "account" }, { label: "Transactions" }]}
      onNavigate={onNavigate}
      wide
    >
      {error && <div className="p-3 rounded-none bg-white/[0.04] border border-white/15 text-zinc-200 text-xs mb-4">{error}</div>}
      {txns === null ? (
        <div className="space-y-3">{[0,1,2].map(i => <div key={i} className="skeleton h-14 rounded-none" />)}</div>
      ) : txns.length === 0 ? (
        <div className="p-10 text-center border border-white/10 rounded-none">
          <p className="text-sm text-zinc-400 mb-1">No deposits yet{user ? "" : " — or you're not signed in"}.</p>
          <p className="text-xs text-zinc-600 mb-5">Direct UPI and Razorpay payment records will appear here.</p>
          <a href="/add-funds" className="btn-up btn-up-solid btn-up-sm">Add funds</a>
        </div>
      ) : (
        <div className="overflow-x-auto border border-white/10 rounded-none">
          <table className="w-full text-left text-xs">
            <thead className="bg-black/80 border-b border-white/10 text-zinc-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Method / Reference</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {txns.map((t: any, i: number) => (
                <tr key={i} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-zinc-400">{t.createdAt || t.created_at ? new Date(t.createdAt || t.created_at).toLocaleString("en-IN") : "—"}</td>
                  <td className="px-4 py-3 text-zinc-300">
                    <span className="block text-[10px] uppercase tracking-wider text-zinc-500">{t.method === "RAZORPAY" ? "Razorpay" : "Direct UPI"}</span>
                    <span className="font-mono">{t.utr || t.transactionId || t.memo || "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-white font-semibold">{formatINR(t.amount || 0)}</td>
                  <td className="px-4 py-3 text-zinc-300">{t.status === "paid" ? "Completed" : t.status === "test_paid" ? "Test verified" : t.status || "Pending"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ContentPage>
  );
}

/* ══════════════════════ 404 ══════════════════════ */
export function NotFoundPage({ onNavigate }: PageProps) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-[96px] sm:text-[140px] leading-none font-light font-mono text-white/[0.06] select-none">404</div>
        <h1 className="text-xl sm:text-2xl font-light tracking-[0.12em] text-white uppercase -mt-6 mb-4">
          Page not found
        </h1>
        <p className="text-sm text-zinc-500 max-w-sm mx-auto mb-8">
          This link doesn't lead anywhere on SMM UP — it may have moved, or never existed.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button onClick={() => onNavigate("home")} className="btn-up btn-up-solid">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to home</span>
          </button>
          <button onClick={() => onNavigate("catalog")} className="btn-up btn-up-ghost">
            <span>Browse services</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════ HTML SITEMAP ══════════════════════ */
export function SitemapPage({ onNavigate }: PageProps) {
  const groups: { title: string; links: { path: string; label: string }[] }[] = [
    {
      title: "Main",
      links: [
        { path: "/", label: "Home" },
        { path: "/order", label: "Place an Order" },
        { path: "/catalog", label: "Services & Prices" },
        { path: "/mass", label: "Mass Order" },
        { path: "/logs", label: "Order History" },
        { path: "/auth", label: "Sign In / Create Account" },
        { path: "/account", label: "My Account" },
        { path: "/add-funds", label: "Add Funds" },
        { path: "/transactions", label: "Deposit History" },
      ],
    },
    {
      title: "Platforms",
      links: [
        { path: "/telegram-smm-panel", label: "Telegram SMM Panel" },
        { path: "/instagram-smm-panel", label: "Instagram SMM Panel" },
        { path: "/youtube-smm-panel", label: "YouTube SMM Panel" },
        { path: "/twitter-smm-panel", label: "Twitter / X SMM Panel" },
        { path: "/tiktok-smm-panel", label: "TikTok SMM Panel" },
        { path: "/spotify-smm-panel", label: "Spotify SMM Panel" },
      ],
    },
    {
      title: "Developers",
      links: [
        { path: "/api", label: "API Documentation" },
        { path: "/playground", label: "API Playground" },
      ],
    },
    {
      title: "Help & Company",
      links: [
        { path: "/faq", label: "FAQ" },
        { path: "/support", label: "Support & Contact" },
        { path: "/about", label: "About" },
        { path: "/responsible-growth", label: "Responsible Growth & Service Quality" },
        { path: "/review", label: "Leave a Review" },
        { path: "/status", label: "System Status" },
        { path: "/changelog", label: "Changelog" },
        { path: "/press", label: "Press & Brand Kit" },
      ],
    },
    {
      title: "Legal & Trust",
      links: [
        { path: "/terms", label: "Terms of Service" },
        { path: "/privacy", label: "Privacy Policy" },
        { path: "/refunds", label: "Refund & Cancellation" },
        { path: "/acceptable-use", label: "Acceptable Use" },
        { path: "/cookie-policy", label: "Cookie Policy" },
        { path: "/security", label: "Security" },
        { path: "/abuse", label: "Report Abuse" },
      ],
    },
  ];
  return (
    <ContentPage
      kicker="Index"
      title="Sitemap"
      subtitle="Every page on SMM UP, organized."
      crumbs={[{ label: "Home", tab: "home" }, { label: "Sitemap" }]}
      onNavigate={onNavigate}
      wide
    >
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {groups.map((g) => (
          <div key={g.title}>
            <h3 className="text-xs font-bold tracking-[0.2em] text-white uppercase mb-3 pb-2 border-b border-white/10">
              {g.title}
            </h3>
            <ul className="space-y-2">
              {g.links.map((l) => (
                <li key={l.path}>
                  <a
                    href={l.path}
                    className="text-sm text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </ContentPage>
  );
}
