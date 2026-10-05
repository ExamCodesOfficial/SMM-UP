import React from "react";
import ContentPage, { P, H2, UL, Callout } from "../ContentPage";

interface PageProps {
  onNavigate: (tab: string) => void;
}

/* ══════════════════════ TERMS OF SERVICE ══════════════════════ */
export function TermsPage({ onNavigate }: PageProps) {
  return (
    <ContentPage
      kicker="Legal"
      title="Terms of Service"
      subtitle="The agreement between you and SMM UP. Plain language, no traps — please read it once before ordering."
      updated="October 5, 2026"
      crumbs={[{ label: "Home", tab: "home" }, { label: "Legal" }, { label: "Terms of Service" }]}
      onNavigate={onNavigate}
    >
      <H2>1. Who we are</H2>
      <P>
        SMM UP ("we", "us", "the panel") is a wholesale social-media marketing panel operated from India by its
        founder, Aryan, reachable at smmup.co.in. When you create an account, add funds, or place an order, you
        accept these Terms in full. If you don't agree, please don't use the service.
      </P>

      <H2>2. What SMM UP does</H2>
      <P>
        SMM UP sells social-media engagement services — followers, members, views, likes, watch time and similar
        metrics — delivered to public links you provide. We act as a wholesale storefront: orders are routed to
        vetted upstream delivery networks and you pay per unit at the rate shown when you order.
      </P>
      <Callout>
        We never work on private accounts, never need your social-media password, and never access any account —
        delivery happens entirely against public links and usernames.
      </Callout>

      <H2>3. Your account</H2>
      <UL>
        <li>You must provide a valid email address and choose a unique username.</li>
        <li>You are responsible for keeping your password and API key confidential.</li>
        <li>One person may hold one account. Duplicate or throwaway accounts can be merged or closed.</li>
        <li>You must be at least 13 years old (or the minimum digital-consent age in your state).</li>
        <li>We may suspend accounts involved in fraud, payment disputes, or abuse of the service.</li>
      </UL>

      <H2>4. Wallet, deposits and payments</H2>
      <UL>
        <li>All purchases are prepaid through your SMM UP wallet balance, denominated in INR.</li>
        <li>Deposits are accepted via UPI only and are credited after the 12-digit UTR reference is verified against the bank credit alert. Verification is fully automated and typically completes within minutes.</li>
        <li>We charge 0% deposit fee — 100% of your payment becomes spendable balance.</li>
        <li>Wallet balance is not cash, can't be withdrawn, and isn't transferable between users.</li>
        <li>Submitting a false, reused or someone else's UTR is fraud and leads to permanent account closure.</li>
      </UL>

      <H2>5. Orders</H2>
      <UL>
        <li>Each order is charged at the live rate displayed in the order form at the moment you place it — no hidden fees, no post-order repricing.</li>
        <li>Delivery speed varies by service; each service card lists a measured average completion time.</li>
        <li>We may refuse or reverse orders that target private, deleted, or non-existent links.</li>
        <li>Quantity limits (minimum / maximum) are enforced per service and shown on the order form.</li>
        <li>You confirm the link is correct before paying. Orders sent to a wrong-but-valid link you supplied are final.</li>
      </UL>

      <H2>6. Refill guarantee</H2>
      <P>
        Every service carries a stated refill window — from 7 days up to lifetime, shown on its card. If delivered
        quantity drops within that window, we replace the lost amount free of charge on request (via order history
        or the API). Drops caused by you changing your username, deleting posts, or making the account private are
        not covered. The full rules are in our{" "}
        <button onClick={() => onNavigate("refunds")} className="text-white underline underline-offset-4 hover:text-zinc-300 cursor-pointer">
          Refund &amp; Cancellation Policy
        </button>.
      </P>

      <H2>7. Refunds</H2>
      <P>
        Failed orders are refunded to wallet balance automatically and in full. Partially-delivered orders are
        refunded proportionally for the undelivered remainder. Deposits themselves (money added to the wallet)
        are non-withdrawable but never expire and can be used on any service, any time.
      </P>

      <H2>8. Acceptable use</H2>
      <P>
        You may not use SMM UP for anything unlawful, deceptive or platform-prohibited — including illegal
        content, impersonation, scams, hate content, spam, or political manipulation. The short version: don't
        use engagement tools to harm people or deceive voters and consumers. The full list lives in the{" "}
        <button onClick={() => onNavigate("acceptable-use")} className="text-white underline underline-offset-4 hover:text-zinc-300 cursor-pointer">
          Acceptable Use Policy
        </button>.
      </P>

      <H2>9. Realistic expectations</H2>
      <P>
        Social platforms continuously audit engagement. We design delivery to be gradual and natural-looking, but
        no panel can guarantee a metric will stay forever or that a platform will never act. By ordering you
        accept platform-side risk inherent to all third-party engagement services.
      </P>

      <H2>10. Liability</H2>
      <P>
        To the maximum extent permitted by law, SMM UP's total liability for any claim is limited to the amount
        you paid for the specific order in question. We are not liable for indirect losses — lost revenue, lost
        accounts, reputational damage, or platform enforcement actions.
      </P>

      <H2>11. Changes and contact</H2>
      <P>
        We may update these Terms; material changes are announced on the changelog and, where practical, by email.
        Continued use after an update means acceptance. Questions: the 24/7 Telegram support desk is the fastest
        channel — see{" "}
        <button onClick={() => onNavigate("support")} className="text-white underline underline-offset-4 hover:text-zinc-300 cursor-pointer">
          Support
        </button>.
      </P>
    </ContentPage>
  );
}

/* ══════════════════════ PRIVACY POLICY ══════════════════════ */
export function PrivacyPage({ onNavigate }: PageProps) {
  return (
    <ContentPage
      kicker="Legal"
      title="Privacy Policy"
      subtitle="What we collect, why, and how it's protected. Short enough to actually read."
      updated="October 5, 2026"
      crumbs={[{ label: "Home", tab: "home" }, { label: "Legal" }, { label: "Privacy Policy" }]}
      onNavigate={onNavigate}
    >
      <H2>What we collect</H2>
      <UL>
        <li><strong className="text-zinc-200">Account data</strong> — username, email address, bcrypt-hashed password.</li>
        <li><strong className="text-zinc-200">Order data</strong> — the public links you submit, quantities, and order status history.</li>
        <li><strong className="text-zinc-200">Payment references</strong> — UPI amounts and 12-digit UTR numbers you submit for wallet top-ups. We never see your bank account, card, or UPI PIN.</li>
        <li><strong className="text-zinc-200">Technical data</strong> — IP address and basic device information, used for security and rate-limiting.</li>
      </UL>

      <H2>What we never collect</H2>
      <UL>
        <li>Your social-media passwords — impossible by design, the order form has no field for them.</li>
        <li>Bank credentials, card numbers, or UPI PINs.</li>
        <li>Advertising profiles — we run zero ad trackers, zero analytics resale.</li>
      </UL>

      <H2>How your data is used</H2>
      <UL>
        <li>Delivering your orders and keeping their status history accurate.</li>
        <li>Verifying UPI deposits against bank credit alerts (UTR matching).</li>
        <li>Security: fraud detection, session management, rate limiting.</li>
        <li>Service email: deposit confirmations, critical account or policy notices. No marketing spam.</li>
      </UL>

      <H2>Who it is shared with</H2>
      <P>
        Order links are passed to upstream delivery networks to fulfil your order — that is the sole purpose of
        sharing. We do not sell, rent, or trade personal data to anyone. Data may be disclosed only if required by
        Indian law or a valid court order.
      </P>

      <H2>Storage and protection</H2>
      <UL>
        <li>Passwords are hashed with bcrypt (cost 12) — we cannot read them ourselves.</li>
        <li>Sessions use signed, httpOnly cookies; API keys are stored hashed.</li>
        <li>Database access is restricted to the application; no public exposure.</li>
        <li>UTR references are retained for payment-dispute resolution and accounting.</li>
      </UL>

      <H2>Your controls</H2>
      <UL>
        <li>View your data anytime on the account page.</li>
        <li>Regenerate your API key instantly if it leaks.</li>
        <li>Request account deletion via the support desk — orders and accounting records are anonymized then removed as far as law allows.</li>
      </UL>

      <H2>Contact</H2>
      <P>
        Privacy questions go to the same 24/7 Telegram support desk listed on the{" "}
        <button onClick={() => onNavigate("support")} className="text-white underline underline-offset-4 hover:text-zinc-300 cursor-pointer">
          Support page
        </button>. Also see the{" "}
        <button onClick={() => onNavigate("cookie-policy")} className="text-white underline underline-offset-4 hover:text-zinc-300 cursor-pointer">
          Cookie Policy
        </button>.
      </P>
    </ContentPage>
  );
}

/* ══════════════════════ REFUND & CANCELLATION ══════════════════════ */
export function RefundsPage({ onNavigate }: PageProps) {
  return (
    <ContentPage
      kicker="Legal"
      title="Refund & Cancellation Policy"
      subtitle="Exactly when money comes back, how partials settle, and how refill windows work."
      updated="October 5, 2026"
      crumbs={[{ label: "Home", tab: "home" }, { label: "Legal" }, { label: "Refund & Cancellation" }]}
      onNavigate={onNavigate}
    >
      <H2>Automatic refunds — no ticket needed</H2>
      <UL>
        <li><strong className="text-zinc-200">Failed order</strong> — the provider rejects or cannot start the order (invalid link, private account, offline service): 100% of the charge returns to your wallet automatically.</li>
        <li><strong className="text-zinc-200">Cancelled order</strong> — when a service supports cancellation and you cancel before completion: the undelivered remainder returns automatically.</li>
        <li><strong className="text-zinc-200">Duplicate deposit alert</strong> — if a UTR mismatch is flagged and verified as a system error, the deposit is corrected to your wallet after manual review.</li>
      </UL>

      <H2>Partial orders</H2>
      <P>
        Sometimes a service can only deliver part of the requested quantity (the target hits platform-side caps).
        These orders close with status <em>Partial</em>: you keep everything that was delivered, and the proportional
        charge for the undelivered quantity is refunded to your wallet automatically.
      </P>

      <H2>Refill windows — what "guarantee" covers</H2>
      <UL>
        <li>Every service card shows its refill window: 7D, 15D, 30D, 60D, 90D, or Lifetime.</li>
        <li>If delivered quantity drops below the ordered amount inside that window, request a refill from order history or the API — the lost quantity is redelivered free.</li>
        <li>Refills cover natural platform cleanups. They do not cover drops caused by you: renaming the account, deleting the post, going private, or violating platform rules.</li>
        <li>"Lifetime" means for the operational life of the service — if a service is retired by the platform itself, remaining refill is credited proportionally as balance.</li>
      </UL>

      <H2>Cancelling an order</H2>
      <UL>
        <li>Where the service allows it, a cancel button appears on the order in Logs while it is still running.</li>
        <li>Already-delivered quantity is charged; the remainder is refunded to your wallet.</li>
        <li>Completed orders can't be cancelled or reversed.</li>
      </UL>

      <H2>What is not refundable</H2>
      <UL>
        <li>Completed orders that delivered exactly what was ordered.</li>
        <li>Orders sent to a wrong-but-valid link you pasted (always re-check the preview).</li>
        <li>Wallet top-ups themselves — deposits don't withdraw back to bank, but never expire and work on every service.</li>
        <li>Accounts closed for fraud or abuse.</li>
      </UL>

      <H2>Disputes</H2>
      <P>
        If something looks wrong with a refund, message the 24/7 Telegram desk with your username and order ID.
        Genuine errors are corrected — usually same day. Chargebacks raised with your bank while a valid deposit
        was already credited inevitably lead to account closure.
      </P>
    </ContentPage>
  );
}

/* ══════════════════════ ACCEPTABLE USE ══════════════════════ */
export function AcceptableUsePage({ onNavigate }: PageProps) {
  return (
    <ContentPage
      kicker="Legal"
      title="Acceptable Use Policy"
      subtitle="What SMM UP will not deliver, under any circumstances."
      updated="October 5, 2026"
      crumbs={[{ label: "Home", tab: "home" }, { label: "Legal" }, { label: "Acceptable Use" }]}
      onNavigate={onNavigate}
    >
      <P>
        Engagement tools are powerful. SMM UP exists to grow legitimate creators, brands and communities — not to
        deceive, harm, or manipulate. Orders matching the categories below are refused, reversed, or reported.
      </P>

      <H2>Strictly prohibited</H2>
      <UL>
        <li><strong className="text-zinc-200">Illegal content</strong> — anything unlawful under Indian law or the law of the target's country.</li>
        <li><strong className="text-zinc-200">Impersonation</strong> — boosting fake accounts posing as real people, brands, journalists or public officials.</li>
        <li><strong className="text-zinc-200">Scams and fraud</strong> — fake giveaways, phishing, crypto/doubling scams, counterfeit stores, loan-app fraud.</li>
        <li><strong className="text-zinc-200">Hate and harassment</strong> — coordinated targeting of individuals, caste/communal hate, doxxing.</li>
        <li><strong className="text-zinc-200">Adult exploitation</strong> — any sexual content involving minors, non-consensual imagery, or trafficking-adjacent promotion. Zero tolerance; reported to authorities.</li>
        <li><strong className="text-zinc-200">Election manipulation</strong> — coordinated inauthentic behavior around elections, candidates or ECI-regulated campaigning.</li>
        <li><strong className="text-zinc-200">Malware and spam</strong> — links that install software, steal data, or promote unsolicited bulk messaging.</li>
        <li><strong className="text-zinc-200">Terror and extremism</strong> — recruitment, praise, or fundraising for proscribed organizations.</li>
      </UL>

      <H2>Platform rules</H2>
      <P>
        Each social platform has its own terms. You are responsible for ensuring your use of engagement services
        complies with the rules of the platform you order for. SMM UP is not affiliated with Telegram, Instagram,
        YouTube, TikTok, Spotify, Meta, or X Corp.
      </P>

      <H2>Enforcement</H2>
      <UL>
        <li>Prohibited orders are cancelled and refunded, or refused at review.</li>
        <li>Repeat attempts lead to account closure without refund of abuse-related funds.</li>
        <li>Illegal content may be reported to Indian cyber-crime authorities (cybercrime.gov.in) with preserved records.</li>
      </UL>

      <H2>Reporting</H2>
      <P>
        See content promoted through SMM UP that violates this policy? Report it on the{" "}
        <button onClick={() => onNavigate("abuse")} className="text-white underline underline-offset-4 hover:text-zinc-300 cursor-pointer">
          Report Abuse page
        </button>{" "}
        — every report is reviewed by a human.
      </P>
    </ContentPage>
  );
}

/* ══════════════════════ COOKIE POLICY ══════════════════════ */
export function CookiePolicyPage({ onNavigate }: PageProps) {
  return (
    <ContentPage
      kicker="Legal"
      title="Cookie Policy"
      subtitle="The honest version: we use almost none."
      updated="October 5, 2026"
      crumbs={[{ label: "Home", tab: "home" }, { label: "Legal" }, { label: "Cookie Policy" }]}
      onNavigate={onNavigate}
    >
      <H2>Cookies we set</H2>
      <UL>
        <li>
          <strong className="text-zinc-200">smm_up_session</strong> (strictly necessary) — a signed, httpOnly
          session cookie that keeps you signed in. It expires when you log out or after its natural lifetime. The
          site cannot function for signed-in users without it.
        </li>
      </UL>
      <P>That's the complete list of cookies set by SMM UP itself.</P>

      <H2>What we don't use</H2>
      <UL>
        <li>No advertising or retargeting cookies.</li>
        <li>No third-party analytics trackers.</li>
        <li>No social-media pixels or fingerprinting scripts.</li>
      </UL>

      <H2>Local storage</H2>
      <P>
        The app stores small interface preferences (for example, your last visited tab) in your browser's local
        storage. This data never leaves your device and can be cleared from your browser settings at any time.
      </P>

      <H2>Managing cookies</H2>
      <P>
        Every browser lets you block or delete cookies (Settings → Privacy). Blocking the session cookie means you
        can't stay signed in, but browsing the public pages — catalog, FAQ, platform pages — works regardless.
        More detail about data handling lives in the{" "}
        <button onClick={() => onNavigate("privacy")} className="text-white underline underline-offset-4 hover:text-zinc-300 cursor-pointer">
          Privacy Policy
        </button>.
      </P>
    </ContentPage>
  );
}
