import React from "react";
import {
  User,
  LogOut,
  Shield,
  Menu,
  X,
  Plus,
  Key,
  Globe,
  FileText,
  Home,
  MessageCircle,
  Terminal,
} from "lucide-react";
import { formatINR } from "../lib/utils";
import {
  SmmUpLogo,
  ExecutiveOrderIcon,
  ExecutiveCatalogIcon,
  ExecutiveMassIcon,
  ExecutiveHistoryIcon,
  ExecutiveWalletIcon,
} from "./icons/ExecutiveIcons";

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  user: any;
  onOpenAuth: () => void;
  onOpenWallet: () => void;
  onOpenProfile: () => void;
  onOpenTerms?: () => void;
  onOpenSupport?: () => void;
  onLogout: () => void;
}

export default function Navbar({
  currentTab,
  setCurrentTab,
  user,
  onOpenAuth,
  onOpenWallet,
  onOpenProfile,
  onOpenTerms,
  onOpenSupport,
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
    { id: "home", label: "HOME", icon: Home },
    { id: "store", label: "ORDER", icon: ExecutiveOrderIcon },
    { id: "services", label: "CATALOG", icon: ExecutiveCatalogIcon },
    { id: "mass", label: "MASS", icon: ExecutiveMassIcon },
    { id: "orders", label: "LOGS", icon: ExecutiveHistoryIcon },
    { id: "api", label: "API", icon: Terminal },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 backdrop-blur-xl bg-[#090807]/85 border-b border-white/[0.08] ${
        navVisible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
        {/* Brand Logo in thatonearyan-sh / ExamCodes Style */}
        <button
          onClick={() => {
            setCurrentTab("home");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="flex items-center gap-3 cursor-pointer group text-left"
        >
          <SmmUpLogo size={36} className="shadow-[0_0_20px_rgba(245,232,208,0.15)] transition-transform duration-300 group-hover:scale-105" />
          <div className="flex flex-col">
            <span className="text-base sm:text-lg font-light tracking-[0.2em] text-[#FAF7F2] drop-shadow-[0_0_12px_rgba(255,255,255,0.7)] leading-none">
              SMM UP
            </span>
            <span className="text-[9px] tracking-[0.25em] text-[#8E877B] uppercase font-mono mt-1">
              Wholesale Node
            </span>
          </div>
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
                    ? "bg-[#FAF7F2] text-black shadow-[0_0_20px_rgba(255,255,255,0.25)]"
                    : "text-zinc-300 hover:text-white hover:bg-white/[0.05]"
                }`}
              >
                <Icon size={15} />
                <span>{link.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Balance & Actions */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {user ? (
            <>
              {/* Luxury Champagne Platinum Wallet Button */}
              <button
                onClick={onOpenWallet}
                className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-white/10 bg-[#0E0D0B]/90 hover:bg-[#151310] hover:border-[#F5E8D0]/40 transition-all cursor-pointer shadow-[0_0_20px_rgba(0,0,0,0.6)] group"
                title="Deposit Funds via Direct 0% UPI"
              >
                <ExecutiveWalletIcon size={16} className="text-[#F5E8D0] group-hover:scale-110 transition-transform" />
                <span className="text-xs sm:text-sm font-semibold text-[#FFFDF9] tracking-wide drop-shadow-[0_0_8px_rgba(255,255,255,0.25)]">
                  {formatINR(user.balance)}
                </span>
                <span className="text-[11px] font-semibold text-[#F5E8D0] border-l border-white/10 pl-2 flex items-center gap-1">
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
            </>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-xs tracking-wider hover:bg-zinc-200 transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] cursor-pointer"
            >
              SIGN IN
            </button>
          )}

          {/* Telegram Customer Support Button */}
          {onOpenSupport && (
            <button
              onClick={onOpenSupport}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] text-zinc-300 hover:text-white text-xs font-medium transition-all cursor-pointer"
              title="24/7 Telegram Customer Support"
            >
              <MessageCircle className="w-3.5 h-3.5 text-[#F5E8D0]" />
              <span className="hidden md:inline">Support</span>
            </button>
          )}

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-2.5 rounded-xl border border-white/10 text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── EXAMCODES-STYLE FULLSCREEN CINEMATIC MOBILE MENU ── */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/98 backdrop-blur-2xl z-50 flex flex-col animate-fadeIn"
          style={{
            paddingTop: "max(1rem, env(safe-area-inset-top))",
            paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
          }}
        >
          {/* Menu Top Bar */}
          <div className="w-full px-5 py-4 flex items-center justify-between border-b border-white/[0.08] shrink-0">
            <button
              onClick={() => {
                setCurrentTab("home");
                setMobileMenuOpen(false);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="flex items-center gap-3 cursor-pointer text-left"
            >
              <SmmUpLogo size={32} />
              <div className="flex flex-col">
                <span className="text-base font-light tracking-[0.2em] text-[#FAF7F2]">
                  SMM UP
                </span>
                <span className="text-[9px] tracking-[0.2em] text-[#8E877B] uppercase font-mono">
                  Wholesale Node
                </span>
              </div>
            </button>

            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2.5 rounded-xl border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Menu Body */}
          <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col justify-between">
            <div className="space-y-6">
              {/* User Operative Section OR Quick Friendly Auth Buttons */}
              {user ? (
                <div className="p-4 rounded-2xl border border-white/10 bg-[#0E0D0B] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-[#F5E8D0]">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-mono">
                          ACTIVE OPERATIVE
                        </span>
                        <h4 className="text-sm font-bold text-white truncate max-w-[150px]">
                          {user.username}
                        </h4>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[9px] text-zinc-500 uppercase tracking-wider block">
                        Balance
                      </span>
                      <span className="text-sm font-bold text-[#FFFDF9]">
                        {formatINR(user.balance)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.06]">
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onOpenWallet();
                      }}
                      className="py-2.5 px-3 rounded-xl border border-[#F5E8D0]/30 bg-[#F5E8D0]/10 text-[#F5E8D0] font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ExecutiveWalletIcon size={14} />
                      <span>Deposit 0%</span>
                    </button>

                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onOpenProfile();
                      }}
                      className="py-2.5 px-3 rounded-xl border border-white/10 bg-white/[0.03] text-zinc-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Key className="w-3.5 h-3.5 text-zinc-400" />
                      <span>API Key</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl border border-white/10 bg-[#0E0D0B] space-y-3">
                  <span className="text-[10px] text-zinc-400 font-mono tracking-widest uppercase block text-center">
                    CLIENT ACCESS
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onOpenAuth();
                      }}
                      className="py-3 px-4 rounded-xl bg-white text-black font-bold tracking-wider text-xs uppercase hover:bg-zinc-200 transition-all flex items-center justify-center cursor-pointer shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                    >
                      Sign In
                    </button>

                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onOpenAuth();
                      }}
                      className="py-3 px-4 rounded-xl border border-white/20 bg-white/[0.03] hover:bg-white/[0.08] text-white font-semibold tracking-wider text-xs uppercase transition-all flex items-center justify-center cursor-pointer"
                    >
                      Sign Up
                    </button>
                  </div>
                </div>
              )}

              {/* Navigation Links (ExamCodes Staggered Style) */}
              <div className="space-y-1">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = currentTab === link.id;
                  return (
                    <button
                      key={link.id}
                      onClick={() => {
                        setCurrentTab(link.id);
                        setMobileMenuOpen(false);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className={`w-full py-4 px-4 rounded-xl text-xs font-semibold tracking-[0.16em] uppercase flex items-center justify-between border-b border-white/[0.04] transition-all cursor-pointer min-h-[48px] ${
                        isActive
                          ? "bg-white text-black font-bold shadow-[0_0_15px_rgba(255,255,255,0.25)]"
                          : "text-zinc-300 hover:text-white hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={16} className={isActive ? "text-black" : "text-zinc-400"} />
                        <span>{link.label}</span>
                      </div>
                      {isActive && <span className="text-[10px] font-mono">&bull; ACTIVE</span>}
                    </button>
                  );
                })}

                {/* Terms & SLA Link */}
                {onOpenTerms && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenTerms();
                    }}
                    className="w-full py-4 px-4 rounded-xl text-xs font-semibold tracking-[0.16em] uppercase flex items-center gap-3 border-b border-white/[0.04] text-zinc-400 hover:text-white transition-all cursor-pointer min-h-[48px]"
                  >
                    <FileText className="w-4 h-4 text-zinc-500" />
                    <span>Terms &amp; SLA Policy</span>
                  </button>
                )}

                {/* Customer Support Link */}
                {onOpenSupport && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenSupport();
                    }}
                    className="w-full py-4 px-4 rounded-xl text-xs font-semibold tracking-[0.16em] uppercase flex items-center gap-3 border-b border-white/[0.04] text-[#F5E8D0] hover:text-white transition-all cursor-pointer min-h-[48px]"
                  >
                    <MessageCircle className="w-4 h-4 text-[#F5E8D0]" />
                    <span>Customer Support (Telegram)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Menu Footer */}
            <div className="pt-6 space-y-4">
              {user && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full py-3.5 rounded-xl border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 font-bold tracking-wider text-xs uppercase transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out</span>
                </button>
              )}

              <div className="text-center py-2">
                <span className="text-[9px] tracking-[0.25em] text-zinc-600 font-mono uppercase block">
                  SMM UP WHOLESALE INFRASTRUCTURE &bull; 0% UPI
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
