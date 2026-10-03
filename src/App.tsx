import React from "react";
import Navbar from "./components/Navbar";
import HeroStats from "./components/HeroStats";
import NewOrder from "./components/NewOrder";
import MassOrder from "./components/MassOrder";
import OrderHistory from "./components/OrderHistory";
import ServicesCatalog from "./components/ServicesCatalog";
import AuthModal from "./components/AuthModal";
import AddFundsModal from "./components/AddFundsModal";
import ProfileModal from "./components/ProfileModal";
import AdminModal from "./components/AdminModal";
import MobileBottomNav from "./components/MobileBottomNav";
import FaqSection from "./components/FaqSection";
import TermsModal from "./components/TermsModal";

export default function App() {
  const [currentTab, setCurrentTab] = React.useState<string>("store");
  const [user, setUser] = React.useState<any>(null);
  const [services, setServices] = React.useState<any[]>([]);
  const [orders, setOrders] = React.useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = React.useState<boolean>(false);
  const [preselectedServiceId, setPreselectedServiceId] = React.useState<number | string | null>(null);

  // Modals
  const [authModalOpen, setAuthModalOpen] = React.useState(false);
  const [walletModalOpen, setWalletModalOpen] = React.useState(false);
  const [profileModalOpen, setProfileModalOpen] = React.useState(false);
  const [adminModalOpen, setAdminModalOpen] = React.useState(false);
  const [termsModalOpen, setTermsModalOpen] = React.useState(false);

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
        setServices(data.services);
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
        setOrders(data.orders);
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
    setCurrentTab("store");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-black text-white relative flex flex-col font-sans selection:bg-white selection:text-black">
      {/* 40px grid pattern from ExamCodes */}
      <div className="absolute inset-0 bg-grid-pattern opacity-100 pointer-events-none z-0" />

      {/* Top Ambient Light Orb */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[70vw] h-[350px] bg-white/[0.02] rounded-full blur-[140px] pointer-events-none z-0" />

      {/* Header */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        user={user}
        onOpenAuth={() => setAuthModalOpen(true)}
        onOpenWallet={() => {
          if (!user) setAuthModalOpen(true);
          else setWalletModalOpen(true);
        }}
        onOpenProfile={() => setProfileModalOpen(true)}
        onOpenAdmin={() => setAdminModalOpen(true)}
        onOpenTerms={() => setTermsModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <main className="flex-1 pt-18 pb-20 md:pb-12 relative z-10">
        {/* Animated Hero Counters */}
        <HeroStats totalServices={services.length || 2174} />

        {/* Tab Views */}
        {currentTab === "store" && (
          <NewOrder
            services={services}
            user={user}
            onOrderSuccess={handleOrderSuccess}
            onOpenWallet={() => setWalletModalOpen(true)}
            onOpenAuth={() => setAuthModalOpen(true)}
            onOpenTerms={() => setTermsModalOpen(true)}
            preselectedServiceId={preselectedServiceId}
          />
        )}

        {currentTab === "services" && (
          <ServicesCatalog
            services={services}
            onSelectService={handleSelectFromCatalog}
          />
        )}

        {currentTab === "mass" && (
          <MassOrder
            services={services}
            user={user}
            onOpenAuth={() => setAuthModalOpen(true)}
            onOpenWallet={() => setWalletModalOpen(true)}
            onOrderSuccess={handleOrderSuccess}
          />
        )}

        {currentTab === "orders" && (
          <OrderHistory
            orders={orders}
            onRefresh={loadOrders}
            loading={loadingOrders}
          />
        )}

        {/* Executive FAQ Section */}
        <FaqSection />
      </main>

      {/* Luxury Minimal Footer */}
      <footer className="border-t border-white/[0.08] bg-black/90 py-10 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-lg bg-white text-black font-bold flex items-center justify-center text-[10px]">
              UP
            </span>
            <span className="text-white font-light tracking-[0.2em] text-sm">
              SMM UP
            </span>
            <span className="text-zinc-600 text-xs">&bull;</span>
            <span className="text-zinc-400 text-xs">Automated Growth Engine</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-zinc-400">
            <button
              onClick={() => setTermsModalOpen(true)}
              className="text-zinc-400 hover:text-white transition-colors cursor-pointer underline"
            >
              Terms of Service &amp; SLA
            </button>
            <span>&bull;</span>
            <span>Direct 0% UPI Instant Clearing</span>
            <span>&bull;</span>
            <span>SMM v2 API Ready</span>
          </div>

          <div className="text-xs text-zinc-500">
            &copy; {new Date().getFullYear()} SMM UP. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Thumb Navigation */}
      <MobileBottomNav
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
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
      />

      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        user={user}
        onLogout={handleLogout}
      />

      {user?.role === "admin" && (
        <AdminModal
          isOpen={adminModalOpen}
          onClose={() => setAdminModalOpen(false)}
        />
      )}

      <TermsModal
        isOpen={termsModalOpen}
        onClose={() => setTermsModalOpen(false)}
      />
    </div>
  );
}
