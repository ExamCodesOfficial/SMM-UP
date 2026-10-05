export interface Faq {
  q: string;
  a: string;
}

/** Shared FAQ data — home shows a slice, /faq shows everything. */
export const FAQS: Faq[] = [
  {
    q: "What is SMM UP?",
    a: "SMM UP is an Indian wholesale SMM panel. You can order social media services — Telegram members, Instagram followers, YouTube views and 2,000+ more — at direct wholesale rates. Individuals, agencies and reseller panels all use the same rates.",
  },
  {
    q: "Do I need to share my social media password?",
    a: "Never. We only need a public link or username — for example a channel link, a post URL or a profile handle. Any service that asks for your password is unsafe; we will never ask for one.",
  },
  {
    q: "How do I add money to my wallet?",
    a: "Open Wallet from the top bar or the bottom navigation. Enter the amount, pay the QR with any UPI app (GPay, PhonePe, Paytm), then submit the 12-digit UTR number from your payment receipt. The system verifies the UTR against bank credit alerts and credits your wallet automatically — usually within a few minutes, with 0% gateway fee.",
  },
  {
    q: "What is a UTR number and where do I find it?",
    a: "UTR is the 12-digit Unique Transaction Reference every UPI payment gets. After paying, open your UPI app, open the payment details, and copy the number labelled UTR / UPI Ref / Transaction Ref. Paste that number in the deposit form.",
  },
  {
    q: "Why is there 0% deposit fee? What's the catch?",
    a: "No catch. Payment gateways charge 2–5% per transaction; instead of a gateway, deposits are confirmed directly against bank credit alerts using your UTR. So 100% of what you pay lands in your wallet, and the savings are real for every user.",
  },
  {
    q: "How fast do orders start?",
    a: "Most orders start within 0–60 minutes, many within minutes. Each service card shows an average completion time based on recent deliveries, so you always know what to expect before you pay.",
  },
  {
    q: "What does the refill guarantee mean?",
    a: "If followers, members or views drop after delivery within the service's refill window (between 7 days and lifetime depending on the service), we redeliver the lost quantity free. You can request a refill from your order history or the API.",
  },
  {
    q: "Why did my follower count drop after ordering?",
    a: "Platforms routinely remove inactive accounts, so small drops are normal across the industry. Quality services drop less, and any drop inside the refill window is replaced free. Choose non-drop or refill-guaranteed services for important accounts.",
  },
  {
    q: "Can I cancel an order?",
    a: "If the service supports cancellation and delivery hasn't progressed too far, you can cancel from order history or the API — the remaining charge returns to your wallet. Completed orders can't be cancelled or reversed.",
  },
  {
    q: "What happens if I paste a wrong or private link?",
    a: "Orders need public targets. If a link is invalid, private or deleted, the order fails and the full charge returns to your wallet automatically. Double-check that accounts and channels are public before ordering.",
  },
  {
    q: "Is there a minimum order?",
    a: "Each service shows its minimum and maximum quantity on the order form (for example, Min 100 — Max 50,000). The quantity box won't accept values outside that range.",
  },
  {
    q: "Can I order for someone else's account?",
    a: "Yes — you only need their public link or username. Agencies use SMM UP for client accounts every day.",
  },
  {
    q: "Do you have an API for resellers?",
    a: "Yes, a standard SMM v2 API at /api/v2. It supports services, add, status, refill and cancel actions, so most reseller panels and scripts can connect in minutes. Your API key is in your account page, and full docs are on the API page.",
  },
  {
    q: "Is it safe? Will my account get banned?",
    a: "We deliver gradually from real-looking sources and never touch your login, which is the primary risk factor. That said, no third-party service can guarantee zero risk against a platform's own rules — keep your quantities sensible and your account will be fine.",
  },
  {
    q: "Do prices change?",
    a: "Rates are wholesale and can move slightly with supply. The catalog, rate board and order form always show the current live rate — you're charged exactly what you saw when placing the order.",
  },
  {
    q: "Which payment methods do you support?",
    a: "UPI only — GPay, PhonePe, Paytm, BHIM and every UPI app work. Deposits clear automatically via UTR verification with 0% fee.",
  },
  {
    q: "How do I contact support?",
    a: "The Telegram support desk runs 24/7 — open Support from the menu or footer. Include your username and order ID for the fastest help. Most messages get a reply within an hour, day or night.",
  },
  {
    q: "Do you offer child panels or white-label reselling?",
    a: "We're focused on the wholesale API and panel right now. Resellers connect their own panels to our API — full docs are on the API page.",
  },
];
