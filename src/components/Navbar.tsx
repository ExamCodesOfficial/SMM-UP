import React from "react";
import {
  Zap,
  Wallet,
  ShoppingBag,
  ListOrdered,
  Layers,
  User,
  LogOut,
  Shield,
  Menu,
  X,
  PlusCircle,
  Copy,
  Check,
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
  onLogout,
}: NavbarProps) {
  const [navVisible, setNavVisible] = React.useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const prevScrollY = React.useRef(0);

  // Smart hide-on-scroll logic from ExamCodes
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
      if (diff > 6) {
        setNavVisible(false);
      } else if (diff < -4) {
        setNavVisible(true);
      }
      prevScrollY.current = currentY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [mobileMenuOpen]);

  const navLinks = [
    { id: "store", label: "NEW ORDER", icon: ShoppingBag },
    { id: "mass", label: "MASS ORDER", icon: Layers },
    { id: "orders", label: "ORDERS", icon: ListOrdered },
    { id: "services", label: "SERVICES", icon: Zap },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 backdrop-blur-md bg-black/85 border-b border-white/10 ${
        navVisible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentTab("store")}
            className="flex items-center gap-2 text-left group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-sm bg-white text-black font-black flex items-center justify-center text-sm tracking-tighter group-hover:bg-neutral-200 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.2)]">
              UP
            </div>
            <div>
              <div className="text-base font-bold tracking-[0.18em] text-white flex items-center gap-1.5 leading-none">
                <span>SMM UP</span>
                <span className="text-[10px] text-white/40">❖</span>
              </div>
              <div className="text-[8px] tracking-[0.25em] text-gray-500 font-mono mt-0.5">
                INSTITUTIONAL GROWTH
              </div>
            </div>
          </button>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = currentTab === link.id;
            return (
              <button
                key={link.id}
                onClick={() => setCurrentTab(link.id)}
                className={`px-3 py-1.5 rounded-sm text-[11px] font-medium tracking-[0.14em] flex items-center gap-1.5 transition-all cursor-pointer ${
                  isActive
                    ? "bg-white text-black font-semibold shadow-[0_0_15px_rgba(255,255,255,0.15)]"
                    : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{link.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Section: Balance Pill & User Controls */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {user ? (
            <>
              {/* Wallet Balance Pill */}
              <button
                onClick={onOpenWallet}
                className="flex items-center gap-2 px-3 py-1.5 border border-white/15 bg-white/[0.03] hover:border-white/40 hover:bg-white/[0.06] rounded-sm transition-all cursor-pointer shadow-[0_0_15px_rgba(255,255,255,0.05)]"
                title="Click to Add Funds via Instant UPI"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] sm:text-xs font-mono font-semibold tracking-wider text-white">
                  {formatINR(user.balance)}
                </span>
                <span className="text-[9px] tracking-wider text-emerald-400 font-semibold flex items-center gap-0.5 border-l border-white/10 pl-2">
                  <PlusCircle className="w-3 h-3" />
                  <span className="hidden sm:inline">ADD</span>
                </span>
              </button>

              {/* Profile / Codename */}
              <button
                onClick={onOpenProfile}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 border border-white/10 bg-white/[0.02] hover:border-white/30 text-gray-300 hover:text-white text-xs font-mono rounded-sm transition-all cursor-pointer"
              >
                <User className="w-3.5 h-3.5 text-gray-400" />
                <span className="max-w-[100px] truncate uppercase">{user.username || "OPERATIVE"}</span>
              </button>

              {/* Admin Button (if admin) */}
              {user.role === "admin" && (
                <button
                  onClick={onOpenAdmin}
                  className="px-2.5 py-1.5 border border-amber-500/30 bg-amber-500/10 hover:border-amber-500/60 text-amber-400 text-xs font-mono rounded-sm transition-all cursor-pointer flex items-center gap-1"
                  title="Admin Dashboard"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">ADMIN</span>
                </button>
              )}
            </>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-4 py-1.5 bg-white text-black font-semibold text-xs tracking-[0.15em] rounded-sm hover:bg-neutral-200 transition-all cursor-pointer shadow-[0_0_15px_rgba(255,255,255,0.2)]"
            >
              SIGN IN
            </button>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 text-gray-400 hover:text-white border border-white/10 rounded-sm cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-white/10 bg-black/95 backdrop-blur-xl px-4 py-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
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
                  className={`p-3 border rounded-sm text-left flex items-center gap-2.5 text-xs tracking-wider transition-all cursor-pointer ${
                    isActive
                      ? "border-white/40 bg-white/10 text-white font-bold"
                      : "border-white/10 bg-white/[0.02] text-gray-400"
                  }`}
                >
                  <Icon className="w-4 h-4 text-white" />
                  <span>{link.label}</span>
                </button>
              );
            })}
          </div>

          {user && (
            <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
              <button
                onClick={() => {
                  onOpenWallet();
                  setMobileMenuOpen(false);
                }}
                className="w-full py-2.5 px-3 bg-white text-black font-bold text-xs tracking-[0.15em] rounded-sm flex items-center justify-center gap-2"
              >
                <Wallet className="w-4 h-4" />
                ADD FUNDS (INSTANT 0% UPI)
              </button>

              <button
                onClick={() => {
                  onOpenProfile();
                  setMobileMenuOpen(false);
                }}
                className="w-full py-2.5 px-3 border border-white/15 text-gray-300 text-xs font-mono rounded-sm flex items-center justify-center gap-2"
              >
                <User className="w-4 h-4" />
                MY PROFILE & API KEY
              </button>

              {user.role === "admin" && (
                <button
                  onClick={() => {
                    onOpenAdmin();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full py-2.5 px-3 border border-amber-500/40 text-amber-400 text-xs font-mono rounded-sm flex items-center justify-center gap-2"
                >
                  <Shield className="w-4 h-4" />
                  ADMIN CONTROL PANEL
                </button>
              )}

              <button
                onClick={() => {
                  onLogout();
                  setMobileMenuOpen(false);
                }}
                className="w-full py-2 text-gray-500 hover:text-red-400 text-xs font-mono tracking-wider flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                LOGOUT
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
