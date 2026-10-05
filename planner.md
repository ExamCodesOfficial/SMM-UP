# SMM UP — Master Platform Specification & Live SMM Inventory Report

> **Project Name:** SMM UP  
> **Brand Identity:** Clean, Modern, High-End Commercial SMM Platform  
> **Aesthetic Reference:** Colors, Typography, and Clean Dark Surfaces from `ExamCodes Site`  
> **Active Wholesale Provider:** Upstream SMM panel (endpoint held in `PANEL_URL` env var)  
> **Live API Key Status:** Tested & Verified (Balance: ₹32.07 INR)  
> **Total Live Services:** 2,174 Services across 331 Categories  
> **Payment Engine:** 0% Fee Automated UPI Verification via Gmail IMAP `X-GM-RAW` Search  
> **Target Deployment:** Vercel (Next.js 15 Fullstack / Vite + Vercel Serverless)

---

### 1. Live SMM Provider API Audit & Inventory Report

Direct testing was conducted against the upstream wholesale panel API using credentials stored in the `PANEL_KEY` environment variable.

#### 1.1 Account & Upstream Status
- **Endpoint:** Configured via `PANEL_URL` environment variable (never hardcoded)
- **Authentication Key:** Managed via `PANEL_KEY` environment variable
- **Account Balance:** `₹32.0675 INR`
- **Default Currency:** `INR`
- **Total Services Catalog:** **2,174 active services**
- **Total Unique Categories:** **331 categories**

#### 1.2 Platform Distribution Breakdown
| Social Network / Platform | Active Services | Dominant Capabilities & Formats |
| :--- | :---: | :--- |
| **Telegram** | **669** | Instant Post Views, Auto-Reactions (Positive/Flame/Heart), Channel/Group Members, Non-Drop Boosts |
| **Instagram** | **555** | Indian Active Likes, Targeted Followers (Indian/Global), Reels High-Speed Views, Custom Comments, Channel Members, Profile Shares |
| **YouTube** | **319** | Google AdWords Views, Indian State-Targeted Views, Native Ads Views (Non-Drop), Monetizable Watch Time, High-Speed Live Stream Viewers |
| **Facebook** | **286** | Page Likes, Post Reactions, Profile Followers, Live Stream Viewers |
| **TikTok** | **148** | Video Views, Global Followers, High-Retention Likes, Video Shares |
| **Twitter / X** | **78** | Followers, Retweets, Quote Retweets, Tweet Impressions, Poll Votes |
| **WhatsApp** | **21** | Group Members, Channel Subscribers, Post Reactions |
| **LinkedIn** | **19** | Company Page Followers, Post Reactions, Profile Connections |
| **Other / Web Traffic** | **91** | Geo-Targeted Organic Website Traffic, Direct Referrals |
| **Spotify / Snapchat / Threads** | **9** | Track Plays, Followers, Snap Score, Threads Followers |

#### 1.3 Service Attributes & Pricing Structure
- **Lowest Rate per 1,000 units:** **₹0.04** (Telegram Views / Reactions)
- **Median Rate per 1,000 units:** **₹55.10**
- **Cancellable Services:** **1,559 services (71.7%)** can be canceled via API `/api/v2?action=cancel`.
- **Refillable Services:** **553 services (25.4%)** support automated refills `/api/v2?action=refill` for dropped quantities.

---

### 2. The Strict UTR Submission Payment Architecture

#### 2.1 The Golden Rule of Crediting
> **STRICT SECURITY MANDATE:**  
> The system **NEVER** auto-credits any user balance in the background. Balance is credited **ONLY AND EXCLUSIVELY** when a user explicitly enters their 12-digit UTR and clicks **"SUBMIT UTR"**. If a user does not submit their UTR, no transaction is processed, and zero balance is added.

#### 2.2 Why the "Last 10 Emails" Flaw is Eliminated
Searching only the last 10 emails is completely broken if a user pays and enters their UTR 2 hours, 10 hours, or 23 hours later, or if 50 other transactions occurred in between.

Instead of scanning recent emails sequentially, we leverage **Gmail's native search engine via IMAP `X-GM-RAW`**:
```python
# Direct Google Full-Text Search across the ENTIRE mailbox:
query = f'X-GM-RAW "from:no-reply@famapp.in {submitted_utr}"'
status, data = mail.search(None, query)
```
- **Instant Search:** Google indexes every email on their server. Searching by the exact 12-digit UTR takes **~0.3 seconds**, regardless of whether the email arrived 1 minute ago or 24 hours ago.
- **Universal Mailbox Coverage:** Searches `INBOX`, `[Gmail]/All Mail`, and `[Gmail]/Spam` simultaneously.

#### 2.3 End-to-End Payment Flow
1. **Deposit Request:** User selects an amount (e.g. ₹100, ₹250, ₹500, ₹1000) on the Add Funds page.
2. **Dynamic QR & Memo:** System renders a QR code with pre-filled amount and unique memo. Mobile users have a 1-tap "Pay via UPI App" button.
3. **Customer Transfer:** Customer transfers funds via their UPI app (PhonePe, GPay, Paytm, FamPay). FamPay sends a confirmation email to Gmail from `no-reply@famapp.in`.
4. **Customer Submits UTR:** Customer copies the 12-digit UTR from their UPI transaction receipt, pastes it into SMM UP, and clicks **"SUBMIT UTR"**.
5. **Backend Verification Routine:**
   - Serverless endpoint `/api/payments/verify-utr` receives `{ amount, utr }`.
   - Checks MongoDB `processed_transactions` collection to ensure this UTR has **never** been credited before (Unique Index on `utr`). If already used, reject immediately.
   - Executes IMAP search: `X-GM-RAW "from:no-reply@famapp.in {utr}"`.
   - If found: Parses email body, verifies `email_amount == requested_amount`.
   - Atomic Database Operation:
     1. Inserts UTR into `processed_transactions`.
     2. Atomically increments `user.balance += amount` in MongoDB.
     3. Creates completed transaction ledger entry.
   - Response: Returns updated balance to the frontend with an instant confirmation screen.

---

### 3. Professional UI/UX Design System (Colors & Typography from `ExamCodes Site`)

The design discards childish "hacker/terminal/operative" labels. It strictly adopts the **clean, elegant, luxury commercial dark theme** from `ExamCodes Site`.

#### 3.1 Color Palette & Contrast
- **Canvas Background:** Pure Obsidian `#000000` with subtle zinc gradients (`from-zinc-950 to-black`).
- **Cards & Containers:** `bg-white/[0.02]` hovering to `bg-white/[0.04]` with micro-borders: `border border-white/10` transitioning to `border-white/20`.
- **Text & Contrast:**
  - Headings: Crisp `text-white font-light tracking-[0.12em] sm:tracking-[0.16em]`.
  - Body & Labels: Neutral `text-gray-400` / `text-gray-500` for clear hierarchy without eye strain.
  - Accent / Primary Buttons: High-contrast pure white (`bg-white text-black font-medium hover:bg-neutral-200 transition-all`).
  - Secondary / Ghost Buttons: `border border-white/15 hover:border-white/30 text-white bg-transparent`.
- **Subtle Surface Texture:**
  - 40px × 40px linear grid pattern at `opacity-[0.03]`.
  - Soft ambient blur orb in header background (`bg-white/[0.02] blur-[120px]`).

#### 3.2 Typography & Layout Standards
- **Font Stack:** Clean, modern geometric sans-serif (Inter / Geist / SF Pro Display) paired with standard tabular numerals for monetary rates.
- **Header:** Sticky navigation bar with clean brand title **SMM UP**, live user balance (`₹0.00`), and quick-action navigation.
- **Mobile Responsiveness:**
  - Touch-first inputs with minimum 44px tap targets.
  - Quick-select deposit pills (`₹50`, `₹100`, `₹250`, `₹500`, `₹1,000`, `₹2,500`).
  - Mobile bottom navigation bar for one-thumb access to Store, Orders, and Wallet.

---

### 4. Zero-Trust Security Protocol

1. **Zero Client Secrets:** The SMM provider API key, MongoDB connection string, and Gmail App Password exist solely in backend environment variables. The frontend bundle contains zero sensitive strings.
2. **Backend Price Enforcement:** When a user places an order, the frontend only sends `{ service_id, link, quantity }`. The backend looks up the real wholesale rate from the cached catalog, calculates retail charge with the markup formula, checks user balance atomically, debits the user, and only then forwards the request to the upstream provider.
3. **Password Security & Sessions:** Passwords hashed with `bcrypt` (cost factor 12). Sessions managed via `HttpOnly; Secure; SameSite=Strict` cookies.

---

### 5. Implementation Roadmap

1. **Phase 1: Project Scaffolding & Setup**
   - Clean Next.js 15 / Vite + React 19 structure inside `/Users/aryan/Desktop/SMM-UP`.
   - Configure Tailwind CSS, fonts, and base color tokens matching `ExamCodes Site`.
2. **Phase 2: Backend API & Service Engine**
   - MongoDB connection helper (clean fresh database).
   - `/api/auth` (Register, Login, Logout, Session check).
   - `/api/services` (Direct cached sync with the upstream provider, dynamic markups).
   - `/api/orders` (Atomic balance debit, forward to upstream API).
   - `/api/payments/verify-utr` (Gmail IMAP `X-GM-RAW` search, anti-replay UTR indexing).
3. **Phase 3: Frontend Interface Development**
   - Clean Navbar with Live Balance.
   - New Order store with category filters and dynamic total calculator.
   - Mass Order textarea with line syntax parser.
   - Order History table with live status pills and Refill buttons.
   - Add Funds page with Dynamic QR, UPI Intent button, and 12-digit UTR submission box.
4. **Phase 4: Verification & Vercel Deployment**
   - Test UTR search with real transactions.
   - Configure environment variables and push to Vercel.
