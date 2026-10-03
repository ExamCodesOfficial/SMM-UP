import React from "react";
import Navbar from "./components/Navbar";
import HeroStats from "./components/HeroStats";
import NewOrder from "./components/NewOrder";
import MassOrder from "./components/MassOrder";
import OrderHistory from "./components/OrderHistory";
import ServicesCatalog from "./components/ServicesCatalog";
import AddFundsModal from "./components/AddFundsModal";
import AuthModal from "./components/AuthModal";
import ProfileModal from "./components/ProfileModal";
import AdminModal from "./components/AdminModal";
import MobileBottomNav from "./components/MobileBottomNav";
import { formatINR } from "./lib/utils";

export default function App() {
  const [currentTab, setCurrentTab] = React.useState<string>("store");
  const [user, setUser] = React.useState<any>(null);
  const [services, setServices] = React.useState<any[]>([]);
  const [orders, setOrders] = React.useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = React.useState(false);
  const [preselectedServiceId, setPreselectedServiceId] = React.useState<number | string | null>(null);

  // Modals state
  const [authModalOpen, setAuthModalOpen] = React.useState(false);
  const [walletModalOpen, setWalletModalOpen] = React.useState(false);
  const [profileModalOpen, setProfileModalOpen] = React.useState(false);
  const [adminModalOpen, setAdminModalOpen] = React.useState(false);

  // Bootstrap user session & services
  React.useEffect(() => {
    checkAuth();
    loadServices();
  }, []);

  // When user is authenticated, load their orders
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
      {/* 40px grid background pattern from ExamCodes */}
      <div className="absolute inset-0 bg-grid-pattern opacity-100 pointer-events-none z-0" />

      {/* Top Ambient Lighting Orb */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[70vw] h-[300px] bg-white/[0.02] rounded-full blur-[140px] pointer-events-none z-0" />

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
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
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
            preselectedServiceId={preselectedServiceId}
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

        {currentTab === "services" && (
          <ServicesCatalog
            services={services}
            onSelectService={handleSelectFromCatalog}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/80 py-8 relative z-10 text-center font-mono text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-white font-bold tracking-widest text-sm">
            <span>SMM UP</span>
            <span className="text-[10px] text-white/40">❖</span>
            <span className="text-[10px] font-normal text-gray-500">PROTOCOL V2.0</span>
          </div>

          <div className="text-[11px] text-gray-500">
            Automated FamPay UPI Clearing &bull; Zero Gateway Fees &bull; Instant Provisioning
          </div>

          <div className="text-[10px] text-gray-600">
            &copy; {new Date().getFullYear()} SMM UP. All Rights Reserved.
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
    </div>
  );
}
