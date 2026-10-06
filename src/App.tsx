import React from "react";
import Navbar from "./components/Navbar";
import NewOrder from "./components/NewOrder";
import MassOrder from "./components/MassOrder";
import OrderHistory from "./components/OrderHistory";
import ServicesCatalog from "./components/ServicesCatalog";
import AuthPage from "./components/AuthPage";
import PasswordChangePage from "./components/PasswordChangePage";
import SupportAccessPage from "./components/SupportAccessPage";
import AddFundsPage from "./components/AddFundsPage";
import MobileBottomNav from "./components/MobileBottomNav";
import FaqSection from "./components/FaqSection";
import LandingHero from "./components/LandingHero";
import GuaranteesBento from "./components/GuaranteesBento";
import ReviewsSection from "./components/ReviewsSection";
import Footer from "./components/Footer";
import ApiDocs from "./components/ApiDocs";
import ApiPlayground from "./components/ApiPlayground";
import FaqPage from "./components/FaqPage";
import Reveal from "./components/Reveal";
import BackToTop from "./components/BackToTop";
import {
  TermsPage,
  PrivacyPage,
  RefundsPage,
  AcceptableUsePage,
  CookiePolicyPage,
} from "./components/pages/LegalPages";
import {
  AboutPage,
  ResponsibleGrowthPage,
  SupportPage,
  StatusPage,
  ChangelogPage,
  SecurityPage,
  AbusePage,
  PressPage,
} from "./components/pages/CompanyPages";
import {
  AccountPage,
  TransactionsPage,
  NotFoundPage,
  SitemapPage,
} from "./components/pages/AccountPages";
import PlatformPage, { PLATFORM_PAGES } from "./components/pages/PlatformPage";
import ReviewsPage from "./components/pages/ReviewsPage";
import { sanitizeBrandText, cleanServiceDescription } from "./lib/utils";
import { applySeo, applyStructuredData } from "./lib/seo";
import { TAB_PATHS, PATH_TABS } from "./lib/routes";

// Pages that require a signed-in user
const GUARDED = new Set(["logs", "account", "transactions", "add-funds", "support-access"]);

function tabFromPath(): string {
  const p = window.location.pathname.replace(/\/+$/, "") || "/";
  return PATH_TABS[p] || "notfound";
}

function SupportSessionBanner({ user, onExit }: { user: any; onExit: () => void }) {
  const [remaining, setRemaining] = React.useState(0);
  const expired = React.useRef(false);
  React.useEffect(() => {
    const update = () => {
      const milliseconds = new Date(user.supportSession.expiresAt).getTime() - Date.now();
      setRemaining(Math.max(0, Math.ceil(milliseconds / 1000)));
      if (milliseconds <= 0 && !expired.current) {
        expired.current = true;
        onExit();
      }
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [user.supportSession.expiresAt, onExit]);
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return (
    <div className="fixed top-[72px] inset-x-0 z-40 border-y border-white/20 bg-white text-black px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
        <div><strong>Support Session · Read-only</strong><span className="ml-2">Viewing @{user.username} as owner · actor and subject are audited separately.</span></div>
        <div className="flex items-center gap-3 font-mono"><span>{minutes}:{String(seconds).padStart(2, "0")}</span><button type="button" onClick={onExit} className="px-3 py-1 border border-black/30 hover:bg-black hover:text-white">Exit support</button></div>
      </div>
    </div>
  );
}

export default function App() {
  const [currentTab, setCurrentTab] = React.useState<string>(tabFromPath());
  const [user, setUser] = React.useState<any>(null);
  const [services, setServices] = React.useState<any[]>([]);
  const [orders, setOrders] = React.useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = React.useState<boolean>(false);
  const [preselectedServiceId, setPreselectedServiceId] = React.useState<number | string | null>(null);

  // Auth page mode
  const [authPageMode, setAuthPageMode] = React.useState<"login" | "register">("login");
  const navigate = React.useCallback((tab: string) => {
    setCurrentTab(tab);
    const url = TAB_PATHS[tab] || "/";
    if (window.location.pathname !== url) {
      window.history.pushState({}, "", url);
    }
    applySeo(tab);
    applyStructuredData(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  /* Global SPA anchor interceptor: any same-origin <a href="/..."> becomes
     router navigation (real hrefs stay crawlable for Googlebot; modifier
     clicks and target attributes still open normally). */
  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";
      if (!href.startsWith("/") || href.startsWith("//") || anchor.target === "_blank") return;
      const path = href.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
      const tab = PATH_TABS[path];
      if (!tab) return; // let unknown paths load normally (assets, downloads)
      e.preventDefault();
      navigate(tab);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [navigate]);

  // Back/forward buttons + initial SEO
  React.useEffect(() => {
    const onPop = () => {
      const tab = tabFromPath();
      setCurrentTab(tab);
      applySeo(tab);
      applyStructuredData(tab);
    };
    window.addEventListener("popstate", onPop);
    applySeo(tabFromPath());
    applyStructuredData(tabFromPath());
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const openAuth = React.useCallback(
    (mode: "login" | "register" = "login") => {
      setAuthPageMode(mode);
      navigate("auth");
    },
    [navigate]
  );

  React.useEffect(() => {
    checkAuth();
    loadServices();
  }, []);

  React.useEffect(() => {
    if (user) {
      loadOrders();
    }
  }, [user]);

  React.useEffect(() => {
    if (!user?.supportSession?.active) return;
    fetch("/api/auth/support-page-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {});
  }, [currentTab, user?.supportSession?.active]);

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (res.ok && data.authenticated) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  };

  const handleAuthSuccess = React.useCallback((forcedDestination?: string) => {
    if (forcedDestination === "password-change") {
      navigate("password-change");
      return;
    }
    const destination = GUARDED.has(currentTab) ? currentTab : "home";
    checkAuth().then(() => {
      loadOrders();
      navigate(destination);
    });
  }, [currentTab, navigate]);

  const handlePasswordRecoveryCompleted = React.useCallback((recoveredUser: any) => {
    setUser(recoveredUser);
    loadOrders();
    navigate("account");
  }, [navigate]);

  const handleSupportAccessActivated = React.useCallback(() => {
    checkAuth().then(() => {
      loadOrders();
      navigate("account");
    });
  }, [navigate]);

  const exitSupportAccess = React.useCallback(async () => {
    try {
      await fetch("/api/auth/exit-support-access", { method: "POST" });
    } finally {
      await checkAuth();
      navigate("support-access");
    }
  }, [navigate]);

  const handleUserUpdate = React.useCallback((patch: any) => {
    setUser((previous: any) => ({ ...previous, ...patch }));
  }, []);

  const loadServices = async () => {
    try {
      const res = await fetch("/api/services/list");
      const data = await res.json();
      if (res.ok && data.services) {
        setServices(
          data.services.map((s: any) => ({
            ...s,
            name: sanitizeBrandText(s.name),
            category: sanitizeBrandText(s.category),
            description: cleanServiceDescription(s.description),
          }))
        );
      }
    } catch (err) {
      console.error("Failed to load services:", err);
    }
  };

  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch("/api/orders/list");
      const data = await res.json();
      if (res.ok && data.orders) {
        setOrders(
          data.orders.map((o: any) => ({
            ...o,
            serviceName: sanitizeBrandText(o.serviceName),
            category: sanitizeBrandText(o.category),
          }))
        );
      }
    } catch (err) {
      console.error("Failed to load orders:", err);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    setUser(null);
    setOrders([]);
    navigate("home");
  };

  const handleOrderSuccess = (newOrderData: any) => {
    if (user) {
      setUser((prev: any) => ({
        ...prev,
        balance: newOrderData.balance ?? prev.balance,
        total_orders: (prev.total_orders || 0) + 1,
        total_spent: (prev.total_spent || 0) + (newOrderData.charge || 0),
      }));
    }
    loadOrders();
  };

  const handleDepositSuccess = (newBalance: number) => {
    if (user) {
      setUser((prev: any) => ({
        ...prev,
        balance: newBalance,
      }));
    }
  };

  const handleSelectFromCatalog = (serviceId: number | string) => {
    setPreselectedServiceId(serviceId);
    navigate("order");
  };

  const platformConfig = PLATFORM_PAGES.find((p) => p.tab === currentTab);
  const guardedBlocked = GUARDED.has(currentTab) && !user;

  return (
    <div className="min-h-screen bg-[#050505] text-white relative flex flex-col font-sans selection:bg-white selection:text-black">
      {/* Top Ambient Light Orb */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[70vw] h-[350px] bg-white/[0.02] rounded-full blur-[140px] pointer-events-none z-0" />

      <Navbar
        currentTab={currentTab}
        setCurrentTab={navigate}
        user={user}
        onOpenAuth={(mode) => openAuth(mode || "login")}
        onLogout={handleLogout}
      />

      {user?.supportSession?.active && <SupportSessionBanner user={user} onExit={exitSupportAccess} />}

      <main className={`flex-1 ${user?.supportSession?.active ? "pt-28" : "pt-18"} pb-20 md:pb-12 relative z-10`}>
        {/* ── Home: landing experience ── */}
        {currentTab === "home" && (
          <>
            <LandingHero
              user={user}
              services={services}
              onNavigateTab={navigate}
              onOpenAuth={() => openAuth("login")}
              totalServices={services.length || 2000}
            />
            <Reveal>
              <GuaranteesBento />
            </Reveal>
            <ReviewsSection />
            <Reveal>
              <FaqSection onSeeAll={() => navigate("faq")} />
            </Reveal>
          </>
        )}

        {/* ── App views ── */}
        {currentTab === "order" && (
          <div className="pt-6">
            <NewOrder
              services={services}
              user={user}
              onOrderSuccess={handleOrderSuccess}
              onOpenAuth={() => openAuth("login")}
                    preselectedServiceId={preselectedServiceId}
            />
            <FaqSection onSeeAll={() => navigate("faq")} />
          </div>
        )}

        {currentTab === "catalog" && (
          <ServicesCatalog
            services={services}
            onSelectService={handleSelectFromCatalog}
          />
        )}

        {currentTab === "mass" && (
          <div className="pt-6">
            <MassOrder
              services={services}
              user={user}
              onOpenAuth={() => openAuth("login")}
              onOrderSuccess={handleOrderSuccess}
            />
          </div>
        )}

        {currentTab === "api" && (
          <ApiDocs user={user} />
        )}

        {currentTab === "playground" && (
          <ApiPlayground user={user} onNavigate={navigate} />
        )}

        {!guardedBlocked && currentTab === "logs" && (
          <div className="pt-6">
            <OrderHistory
              orders={orders}
              onRefresh={loadOrders}
              loading={loadingOrders}
            />
          </div>
        )}

        {!guardedBlocked && currentTab === "account" && (
          <AccountPage
            user={user}
            onNavigate={navigate}
            onLogout={handleLogout}
            onUserUpdate={handleUserUpdate}
          />
        )}

        {!guardedBlocked && currentTab === "transactions" && (
          <TransactionsPage user={user} onNavigate={navigate} />
        )}

        {!guardedBlocked && currentTab === "add-funds" && (
          <AddFundsPage
            user={user}
            onDepositSuccess={handleDepositSuccess}
          />
        )}

        {currentTab === "password-change" && (
          <PasswordChangePage
            onNavigate={navigate}
            onCompleted={handlePasswordRecoveryCompleted}
          />
        )}

        {!guardedBlocked && currentTab === "support-access" && (
          <SupportAccessPage
            user={user}
            onNavigate={navigate}
            onActivated={handleSupportAccessActivated}
          />
        )}

        {/* ── Auth page (also the guard landing) ── */}
        {(currentTab === "auth" || guardedBlocked) && (
          <AuthPage
            initialMode={authPageMode}
            onAuthSuccess={handleAuthSuccess}
          />
        )}

        {/* ── Platform pages ── */}
        {platformConfig && (
          <PlatformPage
            config={platformConfig}
            services={services}
            onNavigate={navigate}
          />
        )}

        {/* ── Content pages ── */}
        {currentTab === "faq" && <FaqPage onNavigate={navigate} />}
        {currentTab === "support" && <SupportPage onNavigate={navigate} />}
        {currentTab === "about" && <AboutPage onNavigate={navigate} />}
        {currentTab === "responsible-growth" && <ResponsibleGrowthPage onNavigate={navigate} />}
        {currentTab === "status" && <StatusPage onNavigate={navigate} />}
        {currentTab === "changelog" && <ChangelogPage onNavigate={navigate} />}
        {currentTab === "security" && <SecurityPage onNavigate={navigate} />}
        {currentTab === "abuse" && <AbusePage onNavigate={navigate} />}
        {currentTab === "press" && <PressPage onNavigate={navigate} />}
        {currentTab === "terms" && <TermsPage onNavigate={navigate} />}
        {currentTab === "privacy" && <PrivacyPage onNavigate={navigate} />}
        {currentTab === "refunds" && <RefundsPage onNavigate={navigate} />}
        {currentTab === "acceptable-use" && <AcceptableUsePage onNavigate={navigate} />}
        {currentTab === "cookie-policy" && <CookiePolicyPage onNavigate={navigate} />}
        {currentTab === "sitemap" && <SitemapPage onNavigate={navigate} />}
        {currentTab === "reviews" && (
          <ReviewsPage
            user={user}
            onNavigate={navigate}
            onOpenAuth={() => openAuth("login")}
          />
        )}
        {currentTab === "notfound" && <NotFoundPage onNavigate={navigate} />}
      </main>

      <Footer />

      <BackToTop />

      <MobileBottomNav
        currentTab={currentTab}
        setCurrentTab={navigate}
        user={user}
      />

    </div>
  );
}
