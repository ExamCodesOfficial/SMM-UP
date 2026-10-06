export interface Faq {
  q: string;
  a: string;
}

/** FAQs shared by the responsible-growth page, FAQ page and JSON-LD. */
export const RESPONSIBLE_GROWTH_FAQS: Faq[] = [
  {
    q: "What practical value does SMM UP provide?",
    a: "SMM UP gives creators, agencies and resellers one place to compare live wholesale rates, choose exact quantities, place multi-platform orders, track delivery and use listed refill terms and request review of eligible undelivered quantities. It reduces the time and cost of sourcing and managing campaign delivery, while your content, offers and customer relationships continue to drive genuine long-term growth.",
  },
  {
    q: "How does SMM UP address service-quality concerns?",
    a: "Quality is managed through transparent service descriptions, minimum and maximum quantities, measured delivery times, service-specific refill windows, order tracking and reconciliation of eligible undelivered quantities. Because service characteristics differ, customers can compare the visible terms and start with a small order before choosing what fits their campaign.",
  },
  {
    q: "Are SMM UP services bots or real users?",
    a: "Service source, behavior and retention vary by listing, so SMM UP does not apply one misleading label to more than 2,100 different services. The useful comparison is the exact service description, delivery pattern, retention or refill coverage and intended campaign use. Delivered profiles should not automatically be treated as prospective customers or a promise of future organic interaction.",
  },
  {
    q: "Can SMM UP guarantee algorithm safety, monetization or sales?",
    a: "No responsible provider controls a social platform's algorithms, moderation, monetization decisions or a customer's sales. SMM UP instead provides practical safeguards it can control: public-link-only ordering, no social passwords, clear service limits, visible refill terms, delivery tracking, responsible-use rules and direct support.",
  },
];

/** Shared FAQ data — home shows a slice, /faq shows everything. */
export const FAQS: Faq[] = [
  {
    q: "What is SMM UP?",
    a: "SMM UP is an Indian wholesale SMM panel. You can order social media services — Telegram members, Instagram followers, YouTube views and 2,000+ more — at direct wholesale rates. Individuals, agencies and reseller panels all use the same rates.",
  },
  {
    q: "Who owns SMM UP (SMMUP)?",
    a: "SMM UP is founded, owned and operated by Aryan. His official Telegram identity is @thatonearyan, available at t.me/thatonearyan. Aryan builds the platform and oversees its operations.",
  },
  {
    q: "Do I need to share my social media password?",
    a: "Never. We only need a public link or username — for example a channel link, a post URL or a profile handle. Any service that asks for your password is unsafe; we will never ask for one.",
  },
  {
    q: "How do I add money to my wallet?",
    a: "Open Wallet, enter the amount, then choose a method. Direct UPI remains the 0% option: pay its QR or UPI intent and use the 12-digit UTR if automatic confirmation is delayed. Razorpay Secure Checkout is a separate option when activated; it creates and verifies its own provider order without using the Direct UPI or Paytm verification flow.",
  },
  {
    q: "What is a UTR number and where do I find it?",
    a: "UTR is the 12-digit Unique Transaction Reference every UPI payment gets. After paying, open your UPI app, open the payment details, and copy the number labelled UTR / UPI Ref / Transaction Ref. Paste that number in the deposit form.",
  },
  {
    q: "Why is there 0% deposit fee? What's the catch?",
    a: "The 0% promise applies to Direct UPI, which is confirmed through the existing UTR and bank-alert flow rather than Razorpay. Razorpay is a separate hosted-checkout choice; any payable amount and wallet credit are shown before you confirm. Direct UPI stays available if you prefer the 0% route.",
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
    a: "SMM UP protects account access by requiring only a public target link — never your social password or login code — and gives you visible service limits, delivery information and refill terms before purchase. Social-platform rules still differ, so no third-party provider can guarantee zero moderation risk. Use services only for lawful campaigns that comply with the relevant platform's rules.",
  },
  {
    q: "Is using an SMM panel legal in India?",
    a: "Social-media marketing services are not automatically unlawful in India; legality depends on how a service is used and the content being promoted. Platform terms are a separate consideration. SMM UP prohibits fraud, impersonation, harassment, election manipulation, illegal content and other abusive campaigns, while customers remain responsible for following each platform's rules.",
  },
  {
    q: "Are SMM panels legit? How do I choose a trustworthy one?",
    a: "A legitimate panel shows the exact service, live rate, minimum quantity, refill window and support route before you pay. It should need only a public profile or post link — never your social password. Test a small order first, check whether delivery matches the listing, and avoid panels promising guaranteed platform verification or guaranteed monetization approval.",
  },
  {
    q: "Do prices change?",
    a: "Rates are wholesale and can move slightly with supply. The catalog, rate board and order form always show the current live rate — you're charged exactly what you saw when placing the order.",
  },
  {
    q: "Which payment methods do you support?",
    a: "Direct UPI supports GPay, PhonePe, Paytm, BHIM and other UPI apps with a 0% deposit fee. Razorpay Secure Checkout is a distinct second option when activated and can show the payment methods enabled on our Razorpay account, such as UPI, cards, netbanking or wallets. Availability appears inside Checkout.",
  },
  {
    q: "How do I contact support?",
    a: "Open the Telegram support desk from the menu or footer. Include your username, internal order ID and the relevant payment reference so the request can be investigated efficiently. Response time varies with queue and incident volume.",
  },
  {
    q: "Do you offer child panels or white-label reselling?",
    a: "We're focused on the wholesale API and panel right now. Resellers connect their own panels to our API — full docs are on the API page.",
  },
  ...RESPONSIBLE_GROWTH_FAQS,
];
