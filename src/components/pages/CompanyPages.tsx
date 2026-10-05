import React from "react";
import { MessageCircle, Clock, ShieldCheck, CheckCircle2, Download } from "lucide-react";
import ContentPage, { P, H2, H3, UL, Callout } from "../ContentPage";
import { SmmUpLogo } from "../icons/ExecutiveIcons";
import { RESPONSIBLE_GROWTH_FAQS } from "../../lib/faqs";

interface PageProps {
  onNavigate: (tab: string) => void;
}

/* ══════════════════════ ABOUT ══════════════════════ */
export function AboutPage({ onNavigate }: PageProps) {
  return (
    <ContentPage
      kicker="Company"
      title="About SMM UP"
      subtitle="A small, focused Indian panel built on one idea: wholesale rates with zero deposit fee."
      crumbs={[{ label: "Home", tab: "home" }, { label: "Company" }, { label: "About" }]}
      onNavigate={onNavigate}
    >
      <H2>Who owns SMM UP?</H2>
      <P>
        <strong className="text-zinc-200">SMM UP (also written as SMMUP) is founded, owned, and operated by Aryan.</strong>{" "}
        Aryan's official Telegram identity is{" "}
        <a
          href="https://t.me/thatonearyan"
          target="_blank"
          rel="me noopener noreferrer"
          className="text-white underline underline-offset-4 hover:text-zinc-300"
        >
          @thatonearyan
        </a>.
        He is the same person who builds the platform, reviews flagged deposits, and oversees its operations.
      </P>
      <div className="mb-10 p-5 sm:p-6 border border-white/12 bg-white/[0.03]">
        <span className="block text-[10px] font-mono tracking-[0.22em] uppercase text-zinc-500 mb-2">
          Official founder identity
        </span>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-base font-bold text-white">Aryan</div>
            <div className="text-xs text-zinc-500">Founder, CEO &amp; Owner of SMM UP</div>
          </div>
          <a
            href="https://t.me/thatonearyan"
            target="_blank"
            rel="me noopener noreferrer"
            className="btn-up btn-up-ghost btn-up-sm"
            aria-label="Aryan on Telegram at thatonearyan"
          >
            Telegram: @thatonearyan
          </a>
        </div>
      </div>

      <H2>Why 0% deposit fee</H2>
      <P>
        Most panels pass a 2–5% payment-gateway surcharge to users on every top-up. We thought that was broken,
        so SMM UP verifies UPI deposits directly against bank credit alerts via the 12-digit UTR number. No
        gateway means no gateway fee — a ₹500 deposit becomes exactly ₹500 of balance, every single time.
      </P>

      <H2>How delivery works</H2>
      <P>
        Orders placed on SMM UP are routed straight into the same wholesale delivery networks that large reseller
        panels use — we simply removed the retail markup in between. That's why the rates here look like what
        other panels pay, not what they charge. Every service shows a measured average delivery time from real,
        recent orders.
      </P>

      <H2>What we believe</H2>
      <UL>
        <li>Honest numbers beat big numbers. If a service says non-drop with lifetime refill, it must hold.</li>
        <li>Support is part of the product, not a cost to minimize.</li>
        <li>Your social passwords are none of our business — no order here will ever need one.</li>
        <li>If a delivery network turns unreliable, it gets removed from the catalog, not hidden by marketing.</li>
      </UL>

      <H2>Get started</H2>
      <P>
        <button onClick={() => onNavigate("auth")} className="text-white underline underline-offset-4 hover:text-zinc-300 cursor-pointer">
          Create a free account
        </button>{" "}
        in about ten seconds, or browse the{" "}
        <button onClick={() => onNavigate("catalog")} className="text-white underline underline-offset-4 hover:text-zinc-300 cursor-pointer">
          live catalog
        </button>{" "}
        first — no sign-up needed to look around.
      </P>
    </ContentPage>
  );
}

/* ══════════════════════ RESPONSIBLE GROWTH ══════════════════════ */
export function ResponsibleGrowthPage({ onNavigate }: PageProps) {
  return (
    <ContentPage
      kicker="Trust & Quality"
      title="Responsible Growth & Service Quality"
      subtitle="The practical benefits, quality controls and clear expectations behind SMM UP."
      updated="October 5, 2026"
      crumbs={[{ label: "Home", tab: "home" }, { label: "Trust" }, { label: "Responsible Growth" }]}
      onNavigate={onNavigate}
    >
      <Callout>
        <strong className="text-white">The SMM UP advantage:</strong> creators, agencies and resellers can compare
        more than 2,100 services, control exact quantities, track delivery and manage campaigns from one account —
        without sharing a social-media password and without losing part of each UPI deposit to a gateway fee.
      </Callout>

      <H2>What customers gain from SMM UP</H2>
      <P>
        SMM UP turns a fragmented wholesale market into one practical workflow. Instead of negotiating with
        multiple suppliers or manually tracking scattered orders, customers get one live catalog, one wallet,
        one order history and one support route. This is especially useful for creators managing several
        campaigns, agencies serving multiple clients and resellers connecting through the standard API.
      </P>
      <UL>
        <li><strong className="text-zinc-200">Cost control:</strong> compare live rates and see the full order price before confirming.</li>
        <li><strong className="text-zinc-200">Flexible scale:</strong> choose a quantity within each service's clearly displayed minimum and maximum.</li>
        <li><strong className="text-zinc-200">Operational visibility:</strong> monitor status, start count, remains and refill eligibility from order history.</li>
        <li><strong className="text-zinc-200">Delivery protection:</strong> use the listed refill coverage, cancellation support or partial refund when applicable.</li>
        <li><strong className="text-zinc-200">Agency efficiency:</strong> place mass orders or automate repeatable workflows through the SMM v2 API.</li>
        <li><strong className="text-zinc-200">Account privacy:</strong> order with a public profile, post or channel link — never a social password.</li>
      </UL>

      <H2>Why wholesale pricing can still deliver practical value</H2>
      <P>
        SMM UP's prices are low because orders are routed to wholesale delivery networks without a large retail
        layer in between, and UPI deposits are verified directly instead of carrying a payment-gateway surcharge.
        Lower operating overhead is not presented as a promise that every service behaves identically. It means
        customers can select and test the service that fits their objective without paying unnecessary platform
        markups on top.
      </P>

      <H2>Quality controls customers can see</H2>
      <P>
        “Quality” is more useful when it is connected to visible terms instead of vague marketing labels. SMM UP
        shows the information needed to make a reasoned choice before an order is placed and provides tools to
        follow the result afterward.
      </P>
      <UL>
        <li>Service description and supported platform.</li>
        <li>Live rate, minimum quantity and maximum quantity.</li>
        <li>Measured average delivery time from recent orders.</li>
        <li>Refill duration where protection is included.</li>
        <li>Live order status and remaining quantity.</li>
        <li>Refund of the undelivered portion when an order ends as Partial.</li>
        <li>Direct support for delivery or refill issues.</li>
      </UL>

      <H2>Operational value beyond a single metric</H2>
      <P>
        The platform's value is not limited to the number delivered on one order. Customers also save time on
        supplier comparison, budgeting, dispatch, status checks, refill management and multi-client operations.
        That operational layer is particularly useful to agencies and resellers handling repeat campaigns at
        volume.
      </P>
      <P>
        SMM UP works best as one component of a broader marketing plan. Strong content, genuine audience
        relationships, customer service and lawful advertising remain responsible for durable organic growth.
        SMM UP supports the delivery workflow around defined campaign requirements so customers can spend more
        time on those long-term fundamentals.
      </P>

      <H2>Clear promises create better customer outcomes</H2>
      <P>
        SMM UP promises the controls it can actually provide: transparent rates, listed quantities, public-link-only
        ordering, trackable delivery, clearly stated refill coverage, partial-order refunds and accessible support.
        It does not use unverifiable promises about guaranteed sales, guaranteed monetization, guaranteed ranking
        or immunity from a platform's own moderation decisions.
      </P>
      <P>
        Service source, behavior and retention can differ across a catalog this large. For that reason, SMM UP
        does not apply one misleading label to every service or treat every delivered profile as a prospective
        customer. The exact listing and its visible protections are the basis for choosing responsibly.
      </P>

      <H2>A responsible way to order</H2>
      <UL>
        <li>Read the complete service description and refill terms before paying.</li>
        <li>Use an appropriate test quantity when evaluating an unfamiliar service.</li>
        <li>Keep the target public and enter the exact profile, post or channel link.</li>
        <li>Do not place overlapping orders for the same link while delivery is active.</li>
        <li>Use services only for lawful campaigns that comply with the relevant platform's rules.</li>
        <li>Track the result in Order History and contact support when delivery differs from the listing.</li>
      </UL>

      <H2>Common questions about quality and value</H2>
      {RESPONSIBLE_GROWTH_FAQS.map((faq) => (
        <React.Fragment key={faq.q}>
          <H3>{faq.q}</H3>
          <P>{faq.a}</P>
        </React.Fragment>
      ))}

      <Callout>
        Ready to compare the visible terms? Browse the{" "}
        <a href="/catalog" className="text-white underline underline-offset-4 hover:text-zinc-300">
          live services and prices
        </a>{" "}
        or read the{" "}
        <a href="/acceptable-use" className="text-white underline underline-offset-4 hover:text-zinc-300">
          Acceptable Use Policy
        </a>{" "}
        before ordering.
      </Callout>
    </ContentPage>
  );
}

/* ══════════════════════ SUPPORT ══════════════════════ */
export function SupportPage({ onNavigate }: PageProps) {
  return (
    <ContentPage
      kicker="Help"
      title="Support & Contact"
      subtitle="Real human help, 24/7. Here's the fastest way to reach it."
      crumbs={[{ label: "Home", tab: "home" }, { label: "Help" }, { label: "Support" }]}
      onNavigate={onNavigate}
    >
      <div className="grid sm:grid-cols-2 gap-4 mb-10">
        <div className="p-6 rounded-none border border-white/15 bg-white/[0.03]">
          <MessageCircle className="w-5 h-5 text-white mb-3" />
          <h3 className="text-sm font-bold text-white tracking-wide mb-1.5">Telegram Desk — 24/7</h3>
          <p className="text-xs text-zinc-400 leading-relaxed mb-4">
            The primary support channel. Include your <b className="text-zinc-300">username</b> and{" "}
            <b className="text-zinc-300">order ID</b> for instant resolution.
          </p>
          <a
            href="https://t.me/smmup_support"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-up btn-up-solid btn-up-sm"
          >
            Open Telegram
          </a>
        </div>
        <div className="p-6 rounded-none border border-white/15 bg-white/[0.03]">
          <Clock className="w-5 h-5 text-white mb-3" />
          <h3 className="text-sm font-bold text-white tracking-wide mb-1.5">Response times</h3>
          <ul className="text-xs text-zinc-400 leading-relaxed space-y-1">
            <li>— Deposit / UTR issues: usually under 1 hour</li>
            <li>— Order status questions: usually same day</li>
            <li>— Refill requests: within 24–48 hours</li>
            <li>— Night messages: answered by morning</li>
          </ul>
        </div>
      </div>

      <H2>Before you message — quick fixes</H2>
      <H3>Deposit not credited?</H3>
      <P>
        Check that the 12-digit UTR you entered matches your payment receipt exactly. A mistyped digit is the
        cause 9 times out of 10. If it's correct and 30 minutes have passed, send the UTR and a screenshot of the
        payment to the desk.
      </P>
      <H3>Order stuck on Pending?</H3>
      <P>
        Most services queue for up to an hour before starting — the start time on your service card tells you
        what's normal. Well past that? It'll be reviewed and either started or auto-refunded.
      </P>
      <H3>Numbers dropped?</H3>
      <P>
        Inside the refill window, use the Refill button on the order in Logs — it's free. The full rules are on
        the{" "}
        <button onClick={() => onNavigate("refunds")} className="text-white underline underline-offset-4 hover:text-zinc-300 cursor-pointer">
          Refund &amp; Cancellation page
        </button>.
      </P>

      <Callout>
        Common questions are answered in depth on the{" "}
        <button onClick={() => onNavigate("faq")} className="text-white underline underline-offset-4 hover:text-zinc-300 cursor-pointer">
          FAQ page
        </button>{" "}
        — worth 30 seconds before waiting on a reply.
      </Callout>
    </ContentPage>
  );
}

/* ══════════════════════ STATUS ══════════════════════ */
export function StatusPage({ onNavigate }: PageProps) {
  const systems = [
    { name: "Website & dashboard", note: "Operational" },
    { name: "Order processing", note: "Operational" },
    { name: "UPI deposit processing (UTR)", note: "Operational" },
    { name: "Reseller API (v2)", note: "Operational" },
    { name: "Telegram support desk", note: "Operational" },
  ];
  return (
    <ContentPage
      kicker="Operations"
      title="System Status"
      subtitle="Current operational state of every SMM UP component, updated after each incident review."
      crumbs={[{ label: "Home", tab: "home" }, { label: "Operations" }, { label: "Status" }]}
      onNavigate={onNavigate}
    >
      <div className="p-4 rounded-none border border-white/15 bg-white/[0.03] flex items-center gap-3 mb-8">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
        </span>
        <span className="text-sm text-white font-medium">All systems operational</span>
      </div>

      <div className="divide-y divide-white/[0.06] border-y border-white/[0.06] mb-10">
        {systems.map((s) => (
          <div key={s.name} className="py-4 flex items-center justify-between gap-4">
            <span className="text-sm text-zinc-300">{s.name}</span>
            <span className="text-xs font-mono text-zinc-400 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
              {s.note}
            </span>
          </div>
        ))}
      </div>

      <H2>Incident history</H2>
      <P>
        No unresolved incidents. When an outage or delivery-network degradation affects orders, it is listed
        here with timestamps and the fix — along with automatic refunds for affected orders.
      </P>
      <P>
        If you're seeing a problem that isn't listed, tell the desk via{" "}
        <button onClick={() => onNavigate("support")} className="text-white underline underline-offset-4 hover:text-zinc-300 cursor-pointer">
          Support
        </button>{" "}
        — user reports are how issues get caught early.
      </P>
    </ContentPage>
  );
}

/* ══════════════════════ CHANGELOG ══════════════════════ */
export function ChangelogPage({ onNavigate }: PageProps) {
  const entries = [
    {
      date: "October 2026",
      items: [
        "Full platform page suite launched — dedicated pages for Telegram, Instagram, YouTube, X, TikTok and Spotify services.",
        "New help centre: expanded FAQ, guides, security and refund documentation.",
        "Order form: quantity field now enforces each service's min/max live, and category picker remembers your position.",
        "Public API docs rebuilt with cURL, PHP and Python examples, plus an in-browser API playground.",
        "Order status auto-sync every 15 minutes — statuses and refill windows update in near-real time.",
      ],
    },
    {
      date: "September 2026",
      items: [
        "Mobile experience overhaul: full-screen navigation drawer, bottom thumb bar, safe-area support.",
        "Automatic UTR deposit verification upgraded — most deposits credit within minutes, 24/7.",
        "Added refill request and cancel support directly from order history.",
      ],
    },
    {
      date: "August 2026",
      items: [
        "SMM UP launches publicly with 0% UPI deposit fee and direct wholesale rates.",
        "Reseller API v2 available to all accounts: services, add, status, refill, cancel.",
      ],
    },
  ];
  return (
    <ContentPage
      kicker="Operations"
      title="Changelog"
      subtitle="Everything we ship, in plain language. Newest first."
      crumbs={[{ label: "Home", tab: "home" }, { label: "Operations" }, { label: "Changelog" }]}
      onNavigate={onNavigate}
    >
      <div className="space-y-10">
        {entries.map((e) => (
          <div key={e.date} className="relative pl-6 border-l border-white/15">
            <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 bg-white" />
            <h3 className="text-sm font-bold tracking-[0.15em] text-white uppercase mb-3 font-mono">{e.date}</h3>
            <ul className="space-y-2">
              {e.items.map((it, i) => (
                <li key={i} className="text-sm text-zinc-400 leading-relaxed font-light flex gap-2.5">
                  <span className="text-zinc-600 shrink-0">—</span>
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </ContentPage>
  );
}

/* ══════════════════════ SECURITY ══════════════════════ */
export function SecurityPage({ onNavigate }: PageProps) {
  return (
    <ContentPage
      kicker="Trust"
      title="Security"
      subtitle="How your account, sessions and money are protected on SMM UP."
      updated="October 5, 2026"
      crumbs={[{ label: "Home", tab: "home" }, { label: "Trust" }, { label: "Security" }]}
      onNavigate={onNavigate}
    >
      <H2>Your password</H2>
      <UL>
        <li>Passwords are hashed with bcrypt at cost factor 12 before they touch the database. We never store, log, or see your actual password — a database leak would expose only hashes.</li>
        <li>Minimum length and reset-by-support flows are enforced; we never email passwords.</li>
      </UL>

      <H2>Your session</H2>
      <UL>
        <li>Sign-in uses a signed, httpOnly cookie — JavaScript (and therefore most XSS attacks) cannot read it.</li>
        <li>Logging out invalidates the server-side session, not just the browser copy.</li>
      </UL>

      <H2>Your API key</H2>
      <UL>
        <li>API keys are stored hashed (SHA-256) and shown in full only once — at creation.</li>
        <li>Every key is rate-limited, so a leaked key can't be hammered quietly.</li>
        <li>You can regenerate the key instantly from your account page; the old one dies immediately.</li>
      </UL>

      <H2>Your money</H2>
      <UL>
        <li>Deposits move over UPI bank rails directly — no card or gateway processor ever sees your credentials.</li>
        <li>Each deposit is confirmed by matching its unique 12-digit UTR against the actual bank credit alert; fake or reused UTRs can't credit a wallet.</li>
        <li>Order charges debit the wallet inside a single guarded database operation — a failed order can never silently hold funds.</li>
      </UL>

      <H2>Your social accounts</H2>
      <Callout>
        No order on SMM UP can ever ask for a social-media password — the order form physically has no such
        field. Anything requesting your Telegram/Instagram login on our behalf is a scam in our name. Report it.
      </Callout>

      <H2>Reporting a vulnerability</H2>
      <P>
        Found a security issue? Please report it privately via the{" "}
        <button onClick={() => onNavigate("support")} className="text-white underline underline-offset-4 hover:text-zinc-300 cursor-pointer">
          support desk
        </button>{" "}
        before any public disclosure. Good-faith reports are fixed fast and always credited (with permission).
      </P>
    </ContentPage>
  );
}

/* ══════════════════════ REPORT ABUSE ══════════════════════ */
export function AbusePage({ onNavigate }: PageProps) {
  return (
    <ContentPage
      kicker="Trust"
      title="Report Abuse"
      subtitle="Seen content promoted through SMM UP that shouldn't be? This page is how to stop it."
      crumbs={[{ label: "Home", tab: "home" }, { label: "Trust" }, { label: "Report Abuse" }]}
      onNavigate={onNavigate}
    >
      <H2>What to report</H2>
      <UL>
        <li>Orders promoting illegal content, scams or phishing.</li>
        <li>Impersonation of you, your brand, or your organization.</li>
        <li>Harassment, hate, or coordinated targeting of an individual.</li>
        <li>Any use of SMM UP violating our{" "}
          <button onClick={() => onNavigate("acceptable-use")} className="text-white underline underline-offset-4 hover:text-zinc-300 cursor-pointer">
            Acceptable Use Policy
          </button>.
        </li>
      </UL>

      <H2>How to report</H2>
      <P>
        Message the Telegram support desk with the word <b className="text-zinc-300">ABUSE</b> in the first line,
        then include:
      </P>
      <UL>
        <li>The link or username of the content being promoted.</li>
        <li>Why it violates the policy (one or two lines is enough).</li>
        <li>Any evidence you have — screenshots help but aren't required.</li>
        <li>Your contact if you want an update (optional; anonymous reports are accepted).</li>
      </UL>

      <H2>What happens next</H2>
      <UL>
        <li>Every report is reviewed by a human within 24 hours — no auto-closures.</li>
        <li>If an active order violates policy, it is cancelled immediately and the balance forfeited.</li>
        <li>Illegal content is preserved as evidence and reported to cybercrime.gov.in where required.</li>
        <li>If you asked for an update, you'll get a decision either way.</li>
      </UL>
      <P>
        SMM UP is an Indian service; urgent threats to life should always go to emergency services (112) first.
      </P>
    </ContentPage>
  );
}

/* ══════════════════════ PRESS & BRAND KIT ══════════════════════ */
export function PressPage({ onNavigate }: PageProps) {
  const boiler =
    "SMM UP (SMMUP) is an Indian wholesale SMM panel founded, owned and operated by Aryan, whose official Telegram identity is @thatonearyan. It provides Telegram, Instagram, YouTube, TikTok, Spotify and X marketing services at direct wholesale rates with a 0% UPI deposit fee, refill guarantees up to lifetime, and a standard reseller API used by agencies and panels across India.";
  return (
    <ContentPage
      kicker="Company"
      title="Press & Brand Kit"
      subtitle="Logos, spelling, palette and an official description — for partners, resellers and media."
      crumbs={[{ label: "Home", tab: "home" }, { label: "Company" }, { label: "Press & Brand Kit" }]}
      onNavigate={onNavigate}
    >
      <H2>Name and spelling</H2>
      <UL>
        <li>Correct: <strong className="text-zinc-200">SMM UP</strong> (two words, "SMM" and "UP" in caps).</li>
        <li>Domain: <strong className="text-zinc-200">smmup.co.in</strong> — searchable as "smmup".</li>
        <li>Incorrect: SmmUp, SMM-UP, Smmup.io — please don't use these.</li>
      </UL>

      <H2>Logo</H2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 my-6">
        <div className="aspect-square rounded-none border border-white/15 bg-black flex items-center justify-center">
          <SmmUpLogo size={64} />
        </div>
        <div className="aspect-square rounded-none border border-white/15 bg-white flex items-center justify-center">
          <svg viewBox="0 0 64 64" width="64" height="64" aria-label="SMM UP mark, inverted">
            <rect width="64" height="64" rx="12" fill="#FFFFFF" />
            <path d="M 17 40 L 32 15 L 47 40 L 40.5 40 L 32 25.5 L 23.5 40 Z" fill="#050505" />
            <line x1="19" y1="48" x2="45" y2="48" stroke="#050505" strokeWidth="3" opacity="0.9" />
          </svg>
        </div>
        <div className="p-4 rounded-none border border-white/15 bg-white/[0.03] flex flex-col justify-center gap-1.5">
          <a href="/favicon.svg" download="smm-up-logo.svg" className="text-xs text-white underline underline-offset-4 hover:text-zinc-300 flex items-center gap-1.5">
            <Download className="w-3 h-3" /> SVG (vector)
          </a>
          <span className="text-[11px] text-zinc-500">Use on dark backgrounds. Keep clear space around the mark.</span>
        </div>
      </div>

      <H2>Palette</H2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
        {[
          { hex: "#050505", name: "Base Black" },
          { hex: "#FFFFFF", name: "White" },
          { hex: "#A1A1AA", name: "Zinc Grey" },
          { hex: "#65E0AD", name: "Soft Mint (hover only)" },
        ].map((c) => (
          <div key={c.hex} className="border border-white/15 rounded-none overflow-hidden">
            <div className="h-14" style={{ backgroundColor: c.hex, border: c.hex === "#FFFFFF" ? "1px solid #222" : "none" }} />
            <div className="p-2.5">
              <div className="text-[11px] font-mono text-zinc-300">{c.hex}</div>
              <div className="text-[10px] text-zinc-500">{c.name}</div>
            </div>
          </div>
        ))}
      </div>

      <H2>Official description</H2>
      <div className="relative my-4 p-4 rounded-none border border-white/15 bg-white/[0.03]">
        <p className="text-sm text-zinc-300 leading-relaxed pr-8">{boiler}</p>
        <button
          onClick={() => navigator.clipboard.writeText(boiler)}
          className="absolute top-3 right-3 text-[10px] font-mono text-zinc-400 hover:text-white border border-white/15 px-2 py-1 cursor-pointer transition-colors"
        >
          COPY
        </button>
      </div>

      <H2>Usage</H2>
      <UL>
        <li>Partners and resellers may use these assets to reference SMM UP accurately.</li>
        <li>Don't imply endorsement, partnership or affiliation beyond factual reference.</li>
        <li>Media enquiries: via the{" "}
          <button onClick={() => onNavigate("support")} className="text-white underline underline-offset-4 hover:text-zinc-300 cursor-pointer">
            support desk
          </button>.
        </li>
      </UL>
    </ContentPage>
  );
}
