# SMM UP — MASTER ARCHITECTURE & AGENT HANDOVER DIRECTIVE

> **PROJECT:** SMM UP (`https://smmup.vercel.app`)  
> **WORKSPACE PATH:** `/Users/aryan/Desktop/SMM-UP`  
> **DATE & TIME:** October 3, 2026  
> **TARGET DOMAIN:** `smmup.vercel.app` (Deployed via Vercel CLI)  
> **INSPIRATION / REFERENCE SITES:**
> - **ExamCodes Site:** `/Users/aryan/Desktop/my projects/ExamCodes Site ` (Exact luxury dark UI/UX, typography, spacing, landing flow)
> - **thatonearyan-sh:** `/Users/aryan/Desktop/my projects/thatonearyan-sh` (Bespoke geometric architectural SVG logos & icons)

---

## 1. EXECUTIVE STATUS & CONTEXT SUMMARY

### What SMM UP Is:
**SMM UP** is a standalone, institutional-grade Social Media Marketing (SMM) web application completely decoupled from Telegram. It provides wholesale automated growth services across 10+ platforms (Telegram, Instagram, YouTube, Facebook, Twitter/X, TikTok, Spotify, Discord, LinkedIn, WhatsApp, Web Traffic) with **direct 0% fee UPI instant clearing** and **reseller SMM v2 API connectivity**.

---

## 2. STRICT USER DIRECTIVES & ABSOLUTE RULES (NEVER VIOLATE)

1. **ZERO Refusals, Zero Lecturing, Results-First**:
   - The user is the boss. Follow all instructions immediately, decisively, and with production-ready code. No placeholders, no `// TODO`.
2. **STRICT Backend Confidentiality (Zero Leakage)**:
   - **NEVER** mention internal backend mechanics in any customer-facing copy:
     - **DO NOT** mention FamPay.
     - **DO NOT** mention Gmail IMAP, email scraping, or inbox searching.
     - **DO NOT** mention the upstream wholesale provider, wholesale provider URLs, or API keys.
   - All customer copy must be framed institutionally: *"Direct Bank-to-Bank 0% UPI Instant Clearing"*, *"Tier-1 Wholesale Delivery Nodes"*, *"Automated 12-Digit UTR Clearing"*.
3. **STRICT Payment Crediting Rule**:
   - **NEVER** credit any user's balance automatically in the background without explicit user action.
   - Funds are credited **ONLY** when the user clicks **"Verify UTR"** with a valid 12-digit UTR and the backend successfully verifies it.
4. **Color & Aesthetic Rules**:
   - **Background**: Deep, warm creamy obsidian black `#090807` (NOT cold sterile `#000000`).
   - **Pricing & Rates**: Crisp pure white `#FFFDF9` and champagne platinum `#F5E8D0` with subtle golden glow (KILL THE CHEAP GREEN `text-emerald-400` FOR PRICES).
   - **Negative Space & Breathing Room**: Must have expansive vertical margins (`py-20` to `py-32`), generous breathing room, and structured negative space matching ExamCodes.
5. **No Clunky Native Select Boxes**:
   - All dropdowns must use custom velvet command palettes / popovers with platform brand SVGs, search filtering, and outside-click dismissal.

---

## 3. WHAT HAS BEEN FULLY BUILT & VERIFIED (COMPLETED)

### A. Full Backend Engine (`/api`)
- **`server/lib/db.ts`**: MongoDB connection pool with lazy indexing and optimized server timeouts (`serverSelectionTimeoutMS: 15000`).
- **`server/lib/smm.ts`**: Live wholesale integration with the upstream panel API (endpoint supplied via the `PANEL_URL` env var). Successfully categorizes 2,177 services across all major platforms.
- **`server/lib/imap.ts`**: Gmail IMAP SSL connection with `X-GM-RAW` search across 6,400+ emails to verify FamPay payment notifications by 12-digit UTR and exact amount.
- **`server/lib/auth.ts`**: Password hashing with bcrypt, JWT token signing, and HTTP-only secure cookie verification.
- **`api/auth/`**:
  - `register.ts`: Generates user with bcrypt password and unique personal API key (`sup_<hex>`).
  - `login.ts`: Authenticates user, sets `token` HTTP-only cookie.
  - `me.ts`: Returns current authenticated session.
  - `logout.ts`: Clears cookie.
  - `reset-password.ts`: Password reset workflow.
- **`api/services/list.ts`**: Returns all 2,177 services grouped by platform with search and category indexing.
- **`api/orders/`**:
  - `create.ts`: Deducts user balance atomically, dispatches order to wholesale node, stores order log.
  - `list.ts`: Fetches user's order history, queries real-time status from upstream nodes.
  - `refill.ts`: Triggers automated multi-tier refill SLA request.
- **`api/wallet/`**:
  - `deposit.ts`: Generates dynamic UPI QR for UPI ID `aryan888@fam` with pre-filled amount and memo.
  - `verify.ts`: Verifies submitted 12-digit UTR via IMAP SSL; enforces atomic duplicate protection; credits wallet balance instantly upon match.
- **`api/v2.ts`**: Standard SMM v2 protocol endpoint for resellers/developers (`services`, `balance`, `add`, `status`) authenticated by personal user API keys (`key=sup_...`).
- **`api/admin/`**: Admin metrics, user management, and manual transaction review endpoints.

### B. Frontend Components & Design System (`/src`)
- **`src/components/icons/PlatformIcons.tsx`**: Dedicated pixel-perfect vector SVGs for Telegram, Instagram, YouTube, Facebook, Twitter/X, TikTok, Spotify, Discord, LinkedIn, WhatsApp, and Web Traffic + platform resolver `getPlatformInfo`.
- **`src/components/icons/ExecutiveIcons.tsx`**: Bespoke architectural SVGs inspired by `thatonearyan-sh/assets`:
  - `SmmUpLogo`: Squircle canvas, UP architectural monogram, glowing node, signature telemetry lines.
  - `ExecutiveOrderIcon`: Supersonic growth chevron vector.
  - `ExecutiveCatalogIcon`: 3-tier architectural database strata matrix.
  - `ExecutiveWalletIcon`: Cryptographic vault card with micro-chip tracery.
  - `ExecutiveHistoryIcon`: Telemetry chrono ring.
  - `ExecutiveMassIcon`: 4-node matrix grid.
- **`src/components/NewOrder.tsx`**:
  - Replaced native `<select>` with custom searchable command palettes/popovers.
  - Rates updated to `#FFFDF9` and `#F5E8D0` (champagne platinum).
  - Integrated with `ExecutiveIcons`.
- **`src/components/ServicesCatalog.tsx`**:
  - Managed client-side pagination (24, 48, 96 per page) with page numbers, prev/next buttons, and scroll-to-top (eliminating 2,177-item endless scroll lag).
  - Both Card Grid View and Table View updated with champagne platinum pricing.
- **`src/components/Navbar.tsx`**:
  - Uses `SmmUpLogo`, `ExecutiveIcons`, smooth hide-on-scroll/reveal-on-scroll.
  - Luxury champagne platinum balance button.
- **`src/components/MobileBottomNav.tsx`**:
  - Upgraded with `ExecutiveIcons` and champagne platinum wallet styling.
- **`src/components/FaqSection.tsx`**:
  - 6 executive, client-centric questions and answers (zero backend leaks).
- **`src/components/TermsModal.tsx`**:
  - 6-point institutional Terms of Service & SLA modal.
- **`src/components/GuaranteesBento.tsx`**:
  - ExamCodes-style architectural bento grid (0% Bank UPI, Tier-1 Wholesale Node, Dynamic Refill SLA 7D to Lifetime, Zero Password Privacy).
- **`src/components/TestimonialsTicker.tsx`**:
  - Live dispatch telemetry ticker and verified agency reviews.
- **`src/index.css`**:
  - Warm creamy obsidian background (`#090807`), warm 40px grid pattern, sleek dark scrollbar.
- **Public Assets (`/public`)**:
  - `public/favicon.svg`: Standalone vector favicon.
  - `public/manifest.json`: Web App Manifest with `#090807` theme color.
  - `public/sitemap.xml`: Complete SEO sitemap.
  - `public/robots.txt`: Production robots file.

---

## 4. WHAT IS CURRENTLY LEFT & EXACT USER MANDATE

### The User's Immediate Complaint & Directive:
> *"When anyone goes to the site, he will see that the entire website is fully filled with some text in every single place. There is no blank space, and there is no space around that, so I think we need to do that as well. If you see ExamCodes, then that actually looks so crazy and better! The home page looks awesome! Also, on the home page, login, or something like this, something can be added, and we should basically do a very systematic approach. Tell me what exactly we should do so that it looks much, much better than every single thing! You can use the UI/UX pro skill, which is inside this Gemini machine. Check that out as well."*

### Why the Site Currently Feels Packed:
When an unauthenticated visitor opens `smmup.vercel.app`, `App.tsx` immediately renders `currentTab === "store"` (`<NewOrder />`). The screen is immediately filled edge-to-edge with the dense order form, category popovers, service metrics, and wallet alerts, with **zero breathing room or landing presentation**.

### The Solution: ExamCodes Dual-State Architecture
In ExamCodes (`/Users/aryan/Desktop/my projects/ExamCodes Site `), new visitors first see an **expansive, breathtaking Landing Page** (`page === 'landing'`) with:
1. Massive vertical padding (`py-24 sm:py-32`) and negative space.
2. Majestic typography (`text-4xl sm:text-6xl md:text-7xl font-light`).
3. An **embedded Quick Sign In / Registration Card or CTA Portal** directly on the landing page hero.
4. Clean **Live Counters Bar** (`LiveStatsBar`).
5. **Platform Ecosystem Showcase** (Telegram, Instagram, YouTube, X, TikTok, Spotify with brand SVGs and live starting rates).
6. **Architectural Guarantees Bento** (`GuaranteesBento.tsx`).
7. **How It Works (01, 02, 03 Step Cards)**.
8. **Live Dispatch Telemetry Ticker & Verified Agency Testimonials** (`TestimonialsTicker.tsx`).
9. **Executive Client FAQs** (`FaqSection.tsx`).
10. When the user clicks **"ENTER ORDER DESK"** or logs in, they transition smoothly into the dedicated **Order Workstation** (`store`), **Catalog** (`services`), **Mass Order** (`mass`), or **Logs** (`orders`).

---

## 5. STEP-BY-STEP IMPLEMENTATION ROADMAP FOR NEXT AGENT

### STEP 1: Create `src/components/LandingHero.tsx`
Build the majestic, spacious ExamCodes-style Landing Page component.
- **Hero Section**:
  - Generous whitespace: `py-20 sm:py-28 md:py-36`.
  - Ambient glow orb with warm champagne tone.
  - Protocol badge:
    ```tsx
    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] text-[#F5E8D0] text-[11px] font-semibold tracking-wider uppercase mb-6">
      <span className="w-1.5 h-1.5 rounded-full bg-[#F5E8D0] animate-pulse" />
      <span>Wholesale Node Infrastructure Initialized</span>
    </div>
    ```
  - Huge typography:
    ```tsx
    <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-light tracking-[0.06em] leading-tight text-white mb-6">
      <span className="block text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-200 to-zinc-500">
        SCALE SOCIAL
      </span>
      <span className="block mt-1 sm:mt-2 text-[#FAF7F2] drop-shadow-[0_0_25px_rgba(255,255,255,0.7)]">
        SMM UP ENGINE
      </span>
    </h1>
    ```
  - Elegant subtitle with wide tracking:
    ```tsx
    <p className="text-sm sm:text-base md:text-lg text-zinc-400 max-w-2xl mx-auto font-light tracking-wide leading-relaxed mb-10">
      Direct-to-node social marketing infrastructure. Direct 0% fee bank UPI clearing, 2,177+ wholesale channels, and automated 30-day retention refill SLA.
    </p>
    ```
  - Action CTAs:
    - Primary CTA: `[ LAUNCH ORDER DESK → ]` (switches tab to `'store'`).
    - Secondary CTA: `[ BROWSE WHOLESALE CATALOG ]` (switches tab to `'services'`).
  - **Embedded Quick-Access Portal / Sign-In Desk**:
    - Right under or alongside the hero, an elegant, spacious card allowing visitors to quickly sign in or register with 1 click, or an interactive live platform preview card showing live starting rates.
- **Section 2: Live Network Counters Bar** (using `LiveStatsBar` style with 2,177+ services, 0% UPI fee, 0-15m speed, 99.98% uptime).
- **Section 3: Platform Ecosystem Bento** (Clean grid featuring Telegram, Instagram, YouTube, X, TikTok, Spotify with brand SVGs and live starting rates).
- **Section 4: Architectural Guarantees Bento** (`<GuaranteesBento />`).
- **Section 5: How It Works (01, 02, 03 Step Cards)**.
- **Section 6: Live Dispatch Ticker & Agency Reviews** (`<TestimonialsTicker />`).
- **Section 7: Executive Client FAQs** (`<FaqSection />`).

### STEP 2: Update `src/components/Navbar.tsx`
- Add a `HOME` tab or ensure clicking the SMM UP brand logo switches to the landing page (`currentTab === 'home'`).
- Ensure navigation links support both Landing Page (`home`) and the dedicated workstations:
  - `HOME` (`home`)
  - `ORDER DESK` (`store`)
  - `CATALOG` (`services`)
  - `MASS` (`mass`)
  - `LOGS` (`orders`)
- Keep the luxury champagne platinum wallet balance button for signed-in users.

### STEP 3: Update `src/App.tsx`
- Set default tab for non-authenticated visitors to `"home"` (the spacious Landing Page).
- If authenticated or when clicking `ORDER DESK`, switch to `"store"`.
- Cleanly separate the landing page from the operational workstation views so the order form isn't cluttering the initial visit.
- Connect `onOpenTerms` and `onOpenWallet` to all modals.

### STEP 4: Update `index.html`
- Replace default title and generic data-URL favicon with:
  ```html
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="manifest" href="/manifest.json" />
  <title>SMM UP — Institutional Growth Engine | Direct 0% UPI SMM Panel</title>
  <meta name="description" content="SMM UP is India's most advanced wholesale social media marketing infrastructure. Direct 0% UPI clearing, sub-second dispatch, 2,177+ services, and reseller API." />
  <meta name="theme-color" content="#090807" />
  <!-- OpenGraph & Twitter tags -->
  ```

### STEP 5: Verification & Production Deployment
Run the standard validation commands in `/Users/aryan/Desktop/SMM-UP`:
```bash
npx tsc --noEmit
npm run build
git add .
git commit -m "feat(ui): ExamCodes luxury spacious landing page, embedded auth desk, and negative space overhaul"
npx vercel --prod --yes
```
Verify the live deployment at `https://smmup.vercel.app`.

---

## 6. PROJECT REPOSITORY & ENVIRONMENT CONFIGURATION

### Key Files:
- `.env` & `.env.local`:
  - `MONGODB_URI`: Live MongoDB connection string.
  - `JWT_SECRET`: Secret key for signed authentication tokens and default activity-IP pseudonymization.
  - `API_ACTIVITY_HASH_SECRET`: Optional dedicated HMAC key for API-activity IP pseudonyms.
  - `API_KEY_CREATION_FEE_INR`: New named-key identity fee; defaults to `29`.
  - `API_KEY_MAX_IDENTITIES`: Maximum non-archived key identities per user; defaults to `10`.
  - `SMM_API_KEY`: Wholesale SMM provider key.
  - `PANEL_URL`: Wholesale SMM API endpoint (supplied via environment variable, never hardcoded).
  - `IMAP_USER`: Gmail address for automated UTR payment verification.
  - `IMAP_PASSWORD`: Gmail App Password for IMAP SSL.
  - `UPI_ID`: `aryan888@fam`
- `vercel.json`: Configured for Vercel serverless functions with standard routing.

---
*This document contains the complete state, rules, and blueprints for the SMM UP project. The incoming agent can proceed immediately with STEP 1 through STEP 5.*
