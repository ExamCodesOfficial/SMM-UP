import React from "react";
import Navbar from "./components/Navbar";
import NewOrder from "./components/NewOrder";
import MassOrder from "./components/MassOrder";
import OrderHistory from "./components/OrderHistory";
import ServicesCatalog from "./components/ServicesCatalog";
import AuthModal from "./components/AuthModal";
import AddFundsModal from "./components/AddFundsModal";
import ProfileModal from "./components/ProfileModal";
import MobileBottomNav from "./components/MobileBottomNav";
import FaqSection from "./components/FaqSection";
import TermsModal from "./components/TermsModal";
import SupportModal from "./components/SupportModal";
import LandingHero from "./components/LandingHero";
import GuaranteesBento from "./components/GuaranteesBento";
import TestimonialsTicker from "./components/TestimonialsTicker";
import ReviewsSection from "./components/ReviewsSection";
import Footer from "./components/Footer";
import ApiDocs from "./components/ApiDocs";
import Reveal from "./components/Reveal";
import BackToTop from "./components/BackToTop";
import { SmmUpLogo } from "./components/icons/ExecutiveIcons";
import { sanitizeBrandText, cleanServiceDescription } from "./lib/utils";

function tabFromPath(): string {
  const p = window.location.pathname.replace(/\/+$/, "");
  if (p === "/api") return "api";
  return "home";
}

export default function App() {
  const [currentTab, setCurrentTab] = React.useState<string>(tabFromPath());
  const [user, setUser] = React.useState<any>(null);
  const [services, setServices] = React.useState<any[]>([]);
  const [orders, setOrders] = React.useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = React.useState<boolean>(false);
  const [preselectedServiceId, setPreselectedServiceId] = React.useState<number | string | null>(null);

  // Modals
  const [authModalOpen, setAuthModalOpen] = React.useState(false);
  const [walletModalOpen, setWalletModalOpen] = React.useState(false);
  const [profileModalOpen, setProfileModalOpen] = React.useState(false);
  const [termsModalOpen, setTermsModalOpen] = React.useState(false);
  const [supportModalOpen, setSupportModalOpen] = React.useState(false);

  // Sync tab state <-> URL so /api is a real, shareable, indexable route
  React.useEffect(() => {
    const onPop = () => setCurrentTab(tabFromPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = React.useCallback((tab: string) => {
    setCurrentTab(tab);
    const url = tab === "api" ? "/api" : "/";
    if (window.location.pathname !== url) {
      window.history.pushState({}, "", url);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  React.useEffect(() => {
    checkAuth();
    loadServices();
  }, []);

  React.useEffect(() => {
    if (user) {
      loadOrders();
    }
  }, [user]);

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
    navigate("store");
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white relative flex flex-col font-sans selection:bg-white selection:text-black">
      {/* 40px grid pattern from ExamCodes */}
      <div className="absolute inset-0 bg-grid-pattern opacity-100 pointer-events-none z-0" />

      {/* Top Ambient Light Orb */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[70vw] h-[350px] bg-white/[0.02] rounded-full blur-[140px] pointer-events-none z-0" />

      {/* Header */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={navigate}
        user={user}
        onOpenAuth={() => setAuthModalOpen(true)}
        onOpenWallet={() => {
          if (!user) setAuthModalOpen(true);
          else setWalletModalOpen(true);
        }}
        onOpenProfile={() => setProfileModalOpen(true)}
        onOpenTerms={() => setTermsModalOpen(true)}
        onOpenSupport={() => setSupportModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <main className="flex-1 pt-18 pb-20 md:pb-12 relative z-10">
        {/* Home: Spacious ExamCodes-Style Landing Experience */}
        {currentTab === "home" && (
          <>
            <LandingHero
              user={user}
              onNavigateTab={navigate}
              onOpenAuth={() => setAuthModalOpen(true)}
              onOpenWallet={() => {
                if (!user) setAuthModalOpen(true);
                else setWalletModalOpen(true);
              }}
              onOpenTerms={() => setTermsModalOpen(true)}
              totalServices={services.length || 2177}
            />
            <Reveal>
              <GuaranteesBento
                onOpenTerms={() => setTermsModalOpen(true)}
                onOpenWallet={() => {
                  if (!user) setAuthModalOpen(true);
                  else setWalletModalOpen(true);
                }}
              />
            </Reveal>
            <Reveal>
              <TestimonialsTicker />
            </Reveal>
            <ReviewsSection />
            <Reveal>
              <FaqSection />
            </Reveal>
          </>
        )}

        {/* Tab Views */}
        {currentTab === "store" && (
          <div className="pt-6">
            <NewOrder
              services={services}
              user={user}
              onOrderSuccess={handleOrderSuccess}
              onOpenWallet={() => setWalletModalOpen(true)}
              onOpenAuth={() => setAuthModalOpen(true)}
              onOpenTerms={() => setTermsModalOpen(true)}
              preselectedServiceId={preselectedServiceId}
            />
            <FaqSection />
          </div>
        )}

        {currentTab === "services" && (
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
              onOpenAuth={() => setAuthModalOpen(true)}
              onOpenWallet={() => setWalletModalOpen(true)}
              onOrderSuccess={handleOrderSuccess}
            />
          </div>
        )}

        {currentTab === "api" && (
          <ApiDocs
            user={user}
            onOpenAuth={() => setAuthModalOpen(true)}
            onOpenProfile={() => setProfileModalOpen(true)}
            onBack={() => navigate("home")}
          />
        )}

        {currentTab === "orders" && (
          <div className="pt-6">
            <OrderHistory
              orders={orders}
              onRefresh={loadOrders}
              loading={loadingOrders}
            />
          </div>
        )}
      </main>

      {/* Grand ExamCodes-Style Multi-Column Architectural Footer */}
      <Footer
        onNavigateTab={navigate}
        onOpenTerms={() => setTermsModalOpen(true)}
        onOpenWallet={() => {
          if (!user) setAuthModalOpen(true);
          else setWalletModalOpen(true);
        }}
        onOpenSupport={() => setSupportModalOpen(true)}
      />

      {/* Floating Back-To-Top with scroll progress ring */}
      <BackToTop />

      {/* Mobile Bottom Thumb Navigation */}
      <MobileBottomNav
        currentTab={currentTab}
        setCurrentTab={navigate}
        onOpenWallet={() => {
          if (!user) setAuthModalOpen(true);
          else setWalletModalOpen(true);
        }}
        onOpenProfile={() => setProfileModalOpen(true)}
        onOpenAuth={() => setAuthModalOpen(true)}
        user={user}
      />

      {/* Modals */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={(userData) => {
          setUser(userData);
          loadOrders();
        }}
      />

      <AddFundsModal
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        user={user}
        onDepositSuccess={handleDepositSuccess}
        onOpenSupport={() => setSupportModalOpen(true)}
      />

      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        user={user}
        onLogout={handleLogout}
        onUserUpdate={(patch) => setUser((prev: any) => ({ ...prev, ...patch }))}
      />

      <TermsModal
        isOpen={termsModalOpen}
        onClose={() => setTermsModalOpen(false)}
      />

      <SupportModal
        isOpen={supportModalOpen}
        onClose={() => setSupportModalOpen(false)}
        user={user}
      />
    </div>
  );
}
