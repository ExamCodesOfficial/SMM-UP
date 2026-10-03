import React from "react";
import {
  Wallet,
  ShoppingBag,
  ListOrdered,
  Layers,
  User,
  LogOut,
  Shield,
  Menu,
  X,
  Plus,
  Key,
  Globe,
  Sparkles,
} from "lucide-react";
import { formatINR } from "../lib/utils";

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  user: any;
  onOpenAuth: () => void;
  onOpenWallet: () => void;
  onOpenProfile: () => void;
  onOpenAdmin: () => void;
  onOpenTerms?: () => void;
  onLogout: () => void;
}

export default function Navbar({
  currentTab,
  setCurrentTab,
  user,
  onOpenAuth,
  onOpenWallet,
  onOpenProfile,
  onOpenAdmin,
  onOpenTerms,
  onLogout,
}: NavbarProps) {
  const [navVisible, setNavVisible] = React.useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const prevScrollY = React.useRef(0);

  // Smooth scroll hide/reveal from ExamCodes
  React.useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY <= 40) {
        setNavVisible(true);
        prevScrollY.current = currentY;
        return;
      }
      if (mobileMenuOpen) {
        setNavVisible(true);
        return;
      }

      const diff = currentY - prevScrollY.current;
      if (diff > 8) {
        setNavVisible(false);
      } else if (diff < -5) {
        setNavVisible(true);
      }
      prevScrollY.current = currentY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [mobileMenuOpen]);

  const navLinks = [
    { id: "store", label: "NEW ORDER", icon: ShoppingBag },
    { id: "services", label: "SERVICES CATALOG", icon: Sparkles },
    { id: "mass", label: "MASS ORDER", icon: Layers },
    { id: "orders", label: "ORDER HISTORY", icon: ListOrdered },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 backdrop-blur-xl bg-black/80 border-b border-white/[0.08] ${
        navVisible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
        {/* Brand Logo in ExamCodes Style */}
        <button
          onClick={() => {
            setCurrentTab("store");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="text-lg sm:text-2xl font-light tracking-[0.22em] text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.85)] flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity"
        >
          <span className="w-8 h-8 rounded-xl bg-white text-black font-bold flex items-center justify-center text-xs tracking-tight shadow-[0_0_15px_rgba(255,255,255,0.3)]">
            UP
          </span>
          <span className="whitespace-nowrap">SMM UP</span>
        </button>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-1.5 lg:gap-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = currentTab === link.id;
            return (
              <button
                key={link.id}
                onClick={() => setCurrentTab(link.id)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wider flex items-center gap-2 transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.25)]"
                    : "text-zinc-300 hover:text-white hover:bg-white/[0.05]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{link.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Balance & Actions */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {user ? (
            <>
              {/* Wallet Button */}
              <button
                onClick={onOpenWallet}
                className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-white/15 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/30 transition-all cursor-pointer shadow-[0_0_15px_rgba(255,255,255,0.05)]"
                title="Deposit Funds via Instant 0% UPI"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs sm:text-sm font-semibold text-white tracking-wide">
                  {formatINR(user.balance)}
                </span>
                <span className="text-[11px] font-semibold text-emerald-400 border-l border-white/10 pl-2 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Add</span>
                </span>
              </button>

              {/* Profile Button */}
              <button
                onClick={onOpenProfile}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] text-zinc-200 hover:text-white text-xs font-medium transition-all cursor-pointer"
                title="Account Settings & API Key"
              >
                <User className="w-3.5 h-3.5 text-zinc-400" />
                <span className="max-w-[100px] truncate">{user.username}</span>
              </button>

              {/* Admin Button */}
              {user.role === "admin" && (
                <button
                  onClick={onOpenAdmin}
                  className="px-3 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
                  title="Admin Dashboard"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Admin</span>
                </button>
              )}
            </>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-xs tracking-wider hover:bg-zinc-200 transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] cursor-pointer"
            >
              SIGN IN
            </button>
          )}

          {/* Mobile Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl border border-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-white/10 bg-black/95 backdrop-blur-2xl px-5 py-6 space-y-4">
          <div className="space-y-2">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = currentTab === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => {
                    setCurrentTab(link.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full px-4 py-3 rounded-xl text-xs font-semibold tracking-wider flex items-center gap-3 transition-all cursor-pointer ${
                    isActive
                      ? "bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                      : "text-zinc-300 hover:bg-white/[0.04]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </button>
              );
            })}
          </div>

          {user && (
            <div className="pt-4 border-t border-white/10 space-y-3">
              <button
                onClick={() => {
                  onOpenProfile();
                  setMobileMenuOpen(false);
                }}
                className="w-full px-4 py-3 rounded-xl border border-white/10 text-zinc-200 flex items-center justify-between text-xs font-semibold"
              >
                <span className="flex items-center gap-2">
                  <User className="w-4 h-4 text-zinc-400" />
                  <span>Account &amp; API Key</span>
                </span>
                <span className="text-zinc-400">{user.username}</span>
              </button>

              <button
                onClick={() => {
                  onLogout();
                  setMobileMenuOpen(false);
                }}
                className="w-full px-4 py-3 rounded-xl border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 text-xs font-semibold"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
