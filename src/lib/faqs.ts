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
    a: "SMM UP is an Indian wholesale SMM panel. You can order social media services — Telegram members, Instagram followers, YouTube views and 2,100+ more — at direct wholesale rates. Individuals, agencies and reseller panels all use the same rates.",
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
    a: "Start and completion times vary by service and supplier load. Review the current estimate shown on the service card, then use Order History to request the latest supplier status after acceptance.",
  },
  {
    q: "What does the refill guarantee mean?",
    a: "If a service includes refill coverage, its listing shows the applicable window. You can request a refill from Order History or the API; supplier eligibility and final refill status are confirmed after the request.",
  },
  {
    q: "Why did my follower count drop after ordering?",
    a: "Platforms can remove accounts or interactions, so delivered counts may change. Compare the listing and choose a service with a stated refill window when that protection matters; refill requests remain subject to the stored terms and supplier status.",
  },
  {
    q: "Can I cancel an order?",
    a: "If the service supports cancellation, you can submit a request from Order History or the API. Supplier acceptance is not final cancellation or refund proof; any eligible wallet adjustment follows reconciliation of the final supplier state.",
  },
  {
    q: "What happens if I paste a wrong or private link?",
    a: "Orders need public targets. An invalid, private or deleted target can produce a failed or uncertain supplier submission. The local order and wallet debit remain recorded while the outcome is reconciled; no automatic refund or blind retry occurs when duplicate fulfillment is possible.",
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
    a: "Yes, a standard SMM v2 API is available at /api/v2. It supports services, balance, add, status, refill and cancel actions. Create a named, scoped key from Account and follow the API page, especially its no-blind-retry rule for uncertain order submissions.",
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
