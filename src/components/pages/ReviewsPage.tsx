import React from "react";
import { readApiPayload } from "../../lib/apiResponse";
import { Star, BadgeCheck, MapPin, PenLine, Lock, CheckCircle2, Loader2 } from "lucide-react";
import Reveal from "../Reveal";
import ContentPage from "../ContentPage";

interface ReviewItem {
  id: string;
  username: string;
  role: string | null;
  city: string | null;
  rating: number;
  text: string;
  date: string;
  status?: "approved" | "hidden";
}

interface Eligibility {
  eligible: boolean;
  reason: string | null;
  order_count?: number;
  my_review?: ReviewItem | null;
}

interface ReviewsPageProps {
  user: { username: string } | null;
  onNavigate: (tab: string) => void;
  onOpenAuth: () => void;
}

function Stars({ n, size = "w-3.5 h-3.5" }: { n: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`${size} ${i <= n ? "fill-white text-white" : "text-zinc-700"}`} />
      ))}
    </div>
  );
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { month: "short", year: "numeric" });

export default function ReviewsPage({ user, onNavigate, onOpenAuth }: ReviewsPageProps) {
  const [communityReviews, setCommunityReviews] = React.useState<ReviewItem[]>([]);
  const [elig, setElig] = React.useState<Eligibility | null>(null);
  const [listLoading, setListLoading] = React.useState(true);
  const [listError, setListError] = React.useState("");
  const [rating, setRating] = React.useState(5);
  const [text, setText] = React.useState("");
  const [city, setCity] = React.useState("");
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const loadReviews = React.useCallback(async () => {
    setListLoading(true);
    setListError("");
    try {
      const r = await fetch("/api/reviews/list");
      const d = await readApiPayload(r);
      if (!r.ok || !Array.isArray(d.reviews)) throw new Error(d.error || "Could not load community reviews.");
      setCommunityReviews(d.reviews);
    } catch (error: any) {
      setListError(error?.message || "Could not load community reviews.");
    } finally {
      setListLoading(false);
    }
  }, []);

  const loadEligibility = React.useCallback(async () => {
    if (!user) {
      setElig(null);
      return;
    }
    try {
      const r = await fetch("/api/reviews/eligibility", { credentials: "include" });
      const d = await readApiPayload(r);
      if (!r.ok || typeof d.eligible !== "boolean") {
        setElig(null);
        return;
      }
      const eligibility: Eligibility = {
        eligible: d.eligible,
        reason: typeof d.reason === "string" ? d.reason : null,
        order_count: Number.isFinite(Number(d.order_count)) ? Number(d.order_count) : undefined,
        my_review: d.my_review || null,
      };
      setElig(eligibility);
      if (eligibility.my_review && !editing) {
        setRating(eligibility.my_review.rating);
        setText(eligibility.my_review.text);
        setCity(eligibility.my_review.city || "");
      }
    } catch {
      setElig(null);
    }
  }, [user, editing]);

  React.useEffect(() => { loadReviews(); }, [loadReviews]);
  React.useEffect(() => { loadEligibility(); }, [loadEligibility]);

  const submit = async () => {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await fetch("/api/reviews/submit", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, text, city: city || undefined }),
      });
      const d = await readApiPayload(r);
      if (!r.ok) {
        setErr(d.error || "Could not save review.");
      } else {
        setMsg(d.message || "Thank you — your review is live.");
        setEditing(false);
        await Promise.all([loadReviews(), loadEligibility()]);
      }
    } catch {
      setErr("Network error — try again.");
    }
    setSaving(false);
  };

  const startEdit = () => {
    if (elig?.my_review) {
      setRating(elig.my_review.rating);
      setText(elig.my_review.text);
      setCity(elig.my_review.city || "");
    }
    setEditing(true);
    setMsg(null);
    setErr(null);
  };

  return (
    <ContentPage
      kicker="Verified Buyer Reviews"
      title="Share your experience"
      subtitle="Reviews are unlocked by a real past order. One buyer, one editable review — no anonymous entries and no purchased feedback."
      crumbs={[{ label: "Home", tab: "home" }, { label: "Review" }]}
      onNavigate={onNavigate}
    >
      {/* Submission panel: this page is deliberately not a paginated review directory. */}
      <Reveal>
        <div className="mb-12 p-6 sm:p-8 rounded-none border border-white/12 bg-[#0a0a0a]/85">
          <div className="flex items-center gap-2.5 mb-4">
            <PenLine className="w-4 h-4 text-zinc-300" />
            <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
              {elig?.my_review && !editing ? "Your review" : "Write your review"}
            </h2>
          </div>

          {err && <p role="alert" className="mb-4 p-3 border border-red-400/25 bg-red-950/25 text-xs text-red-200">{err}</p>}
          {msg && (
            <p role="status" aria-live="polite" className="mb-4 p-3 border border-emerald-400/25 bg-emerald-950/20 text-xs text-emerald-200 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> {msg}
            </p>
          )}

          {!user ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <p className="text-xs sm:text-sm text-zinc-400 font-light flex-1">
                Reviews are reserved for verified buyers — accounts with at least one valid paid order.
                Sign in to check your eligibility.
              </p>
              <button onClick={onOpenAuth} className="btn-up btn-up-solid shrink-0">
                <span>Sign in</span>
              </button>
            </div>
          ) : !elig ? (
            <div className="text-xs text-zinc-600 font-mono flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> CHECKING ELIGIBILITY…
            </div>
          ) : !elig.eligible ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-start gap-2.5 flex-1">
                <Lock className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
                <p className="text-xs sm:text-sm text-zinc-400 font-light">
                  {elig.reason} Any service and any order size counts.
                </p>
              </div>
              <button onClick={() => onNavigate("order")} className="btn-up btn-up-ghost shrink-0">
                <span>Browse services</span>
              </button>
            </div>
          ) : elig.my_review && !editing ? (
            <div>
              <div className="p-5 border border-white/10 bg-white/[0.02] mb-4">
                <div className="flex items-center justify-between gap-3 mb-2.5">
                  <Stars n={elig.my_review.rating} />
                  <span className="text-[10px] font-mono text-zinc-600 uppercase">
                    {elig.my_review.status === "hidden" ? "Not publicly visible" : `Live since ${fmtDate(elig.my_review.date)}`}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-zinc-300 font-light leading-relaxed">
                  {elig.my_review.text}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={startEdit} className="btn-up btn-up-ghost text-xs px-4 py-2">
                  <span>Edit</span>
                </button>
                <span className="ml-auto text-[10px] font-mono text-zinc-600 uppercase">
                  One review per account
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-zinc-500">
                  Your rating
                </span>
                <div className="flex items-center gap-1" role="radiogroup" aria-label="Review rating">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <button key={i} type="button" role="radio" aria-checked={rating === i} onClick={() => setRating(i)} aria-label={`${i} star`}>
                      <Star
                        className={`w-6 h-6 transition ${
                          i <= rating ? "fill-white text-white" : "text-zinc-700 hover:text-zinc-500"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="review-text" className="block text-xs font-semibold text-zinc-300 mb-2">Your review</label>
                <textarea
                  id="review-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={4}
                  minLength={40}
                  maxLength={1200}
                  aria-describedby="review-text-help"
                  placeholder="What did you order, how did it go, and would you return?"
                  className="w-full bg-white/[0.03] border border-white/10 px-4 py-3 text-sm text-zinc-200 font-light placeholder-zinc-600 focus:outline-none focus:border-white/30 transition resize-y"
                />
                <p id="review-text-help" className="mt-1.5 flex justify-between gap-3 text-[10px] text-zinc-500 font-mono">
                  <span>Minimum 40 characters</span>
                  <span>{text.length}/1200</span>
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="w-full sm:w-56">
                  <label htmlFor="review-city" className="block text-xs font-semibold text-zinc-300 mb-2">City <span className="font-normal text-zinc-600">(optional)</span></label>
                  <input
                    id="review-city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    maxLength={40}
                    autoComplete="address-level2"
                    placeholder="Your city"
                    className="w-full bg-white/[0.03] border border-white/10 px-4 py-2.5 text-sm text-zinc-200 font-light placeholder-zinc-600 focus:outline-none focus:border-white/30 transition"
                  />
                </div>
                <div className="flex-1" />
                <button
                  onClick={submit}
                  disabled={saving || text.trim().length < 40}
                  className="btn-up btn-up-solid"
                >
                  <span>{saving ? "Saving…" : elig.my_review ? "Update review" : "Publish review"}</span>
                </button>
              </div>
              <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">
                Published under @{user.username} • {elig.order_count ?? 1} verified order{(elig.order_count ?? 1) === 1 ? "" : "s"}
              </p>
            </div>
          )}
        </div>
      </Reveal>

      {/* Only recent community submissions — no inflated counter, aggregate, or pagination. */}
        <section>
          <Reveal>
            <div className="mb-5">
              <span className="text-[10px] font-mono tracking-[0.22em] uppercase text-zinc-600">
                Community notes
              </span>
              <h2 className="mt-1.5 text-lg sm:text-xl font-bold text-white">Recently submitted</h2>
            </div>
          </Reveal>

          {listLoading ? (
            <div role="status" aria-live="polite" className="text-xs text-zinc-600 font-mono py-8">LOADING COMMUNITY REVIEWS…</div>
          ) : listError ? (
            <div role="alert" className="border border-red-400/20 bg-red-950/20 p-5 text-sm text-red-200 flex flex-col sm:flex-row sm:items-center gap-4">
              <span className="flex-1">{listError}</span>
              <button type="button" onClick={loadReviews} className="btn-up btn-up-ghost btn-up-sm">Try again</button>
            </div>
          ) : communityReviews.length === 0 ? (
            <div className="border border-white/[0.08] bg-white/[0.02] p-6 text-sm text-zinc-400">
              No community reviews have been submitted yet. Verified buyers can publish the first one above.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {communityReviews.map((r, idx) => (
                <Reveal key={r.id} delay={Math.min(idx, 7) * 50}>
                  <article className="h-full p-5 sm:p-6 rounded-none border border-white/[0.08] bg-white/[0.02] flex flex-col">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <Stars n={r.rating} />
                      <span className="text-[10px] font-mono text-zinc-600 uppercase">{fmtDate(r.date)}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-light flex-1">{r.text}</p>
                    <div className="pt-4 mt-5 border-t border-white/[0.06] flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-white/[0.05] border border-white/10 flex items-center justify-center text-[10px] font-bold text-zinc-300 shrink-0">
                        {r.username.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-white truncate">{r.username}</span>
                          <BadgeCheck className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-zinc-500">
                          <span>{r.role || "Verified buyer"}</span>
                          {r.city && <><span>•</span><MapPin className="w-3 h-3" /><span>{r.city}</span></>}
                        </div>
                      </div>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          )}
        </section>
    </ContentPage>
  );
}
