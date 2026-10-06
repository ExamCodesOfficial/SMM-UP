import React from "react";
import { pathFor } from "../lib/routes";
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
  onOpenAuth: (mode?: "login" | "register") => void;
  onLogout: () => void;
}

export default function Navbar({
  currentTab,
  setCurrentTab,
  user,
  onOpenAuth,
  onLogout,
}: NavbarProps) {
  const [navVisible, setNavVisible] = React.useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [scrollProgress, setScrollProgress] = React.useState(0);
  const prevScrollY = React.useRef(0);
  const headerRef = React.useRef<HTMLElement>(null);
  const menuButtonRef = React.useRef<HTMLButtonElement>(null);
  const drawerRef = React.useRef<HTMLDivElement>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);

  // Treat the mobile drawer as a true modal: lock scroll, isolate the page,
  // trap keyboard focus, support Escape, and restore the opener on close.
  React.useEffect(() => {
    const drawer = drawerRef.current;
    const main = document.querySelector("main");
    const footer = document.querySelector("footer");
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";

    if (!mobileMenuOpen) {
      drawer?.setAttribute("inert", "");
      headerRef.current?.removeAttribute("inert");
      main?.removeAttribute("inert");
      footer?.removeAttribute("inert");
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
      return () => { document.body.style.overflow = ""; };
    }

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    drawer?.removeAttribute("inert");
    headerRef.current?.setAttribute("inert", "");
    main?.setAttribute("inert", "");
    footer?.setAttribute("inert", "");
    requestAnimationFrame(() => closeButtonRef.current?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileMenuOpen(false);
        return;
      }
      if (event.key !== "Tab" || !drawer) return;
      const focusable = Array.from(
        drawer.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'),
      ).filter((element) => !element.hasAttribute("inert"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      headerRef.current?.removeAttribute("inert");
      main?.removeAttribute("inert");
      footer?.removeAttribute("inert");
    };
  }, [mobileMenuOpen]);

  // Champagne reading-progress line under the navbar
  React.useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        setScrollProgress(Math.min(1, (window.scrollY || 0) / max));
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

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
    { id: "order", label: "ORDER", icon: ExecutiveOrderIcon },
    { id: "catalog", label: "CATALOG", icon: ExecutiveCatalogIcon },
    { id: "mass", label: "MASS", icon: ExecutiveMassIcon },
    { id: "logs", label: "LOGS", icon: ExecutiveHistoryIcon },
    { id: "api", label: "API", icon: Terminal },
  ];

  return (
    <>
    <header
      ref={headerRef}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 backdrop-blur-xl bg-[#090807]/85 border-b border-white/[0.08] ${
        navVisible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      {/* Reading-progress line */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-transparent pointer-events-none" aria-hidden="true">
        <div
          className="h-full bg-gradient-to-r from-[#E4E4E7]/40 via-[#E4E4E7] to-[#E4E4E7]/40 shadow-[0_0_8px_rgba(255,255,255,0.5)]"
          style={{ width: `${(scrollProgress * 100).toFixed(2)}%`, transition: "width 120ms linear" }}
        />
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
        {/* Brand Logo in thatonearyan-sh / ExamCodes Style */}
        <a
          href={pathFor("home")}
          className="flex items-center gap-3 cursor-pointer group text-left"
        >
          <SmmUpLogo size={36} className="shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-transform duration-300 group-hover:scale-105" />
          <span className="text-base sm:text-lg font-light tracking-[0.3em] text-[#FAF9F7] drop-shadow-[0_0_12px_rgba(255,255,255,0.7)] leading-none">
            SMM UP
          </span>
        </a>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-1.5 lg:gap-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = currentTab === link.id;
            return (
              <a
                key={link.id}
                href={pathFor(link.id)}
                aria-current={isActive ? "page" : undefined}
                className={`px-4 py-2 rounded-none text-xs font-semibold tracking-wider flex items-center gap-2 transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-[#FAF9F7] text-black shadow-[0_0_20px_rgba(255,255,255,0.25)]"
                    : "text-zinc-300 hover:text-white hover:bg-white/[0.05]"
                }`}
              >
                <Icon size={15} />
                <span>{link.label}</span>
              </a>
            );
          })}
        </nav>

        {/* User Balance & Actions */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {user ? (
            <>
              {/* Luxury Champagne Platinum Wallet Button */}
              <a
                href={pathFor("add-funds")}
                aria-current={currentTab === "add-funds" ? "page" : undefined}
                className={`flex items-center gap-2.5 px-3.5 py-2 rounded-none border bg-[#0A0A0A]/90 hover:bg-[#151310] hover:border-[#E4E4E7]/40 transition-all cursor-pointer shadow-[0_0_20px_rgba(0,0,0,0.6)] group ${currentTab === "add-funds" ? "border-white/40" : "border-white/10"}`}
                title="Add funds via Direct UPI or Razorpay"
              >
                <ExecutiveWalletIcon size={16} className="text-[#E4E4E7] group-hover:scale-110 transition-transform" />
                <span className="text-xs sm:text-sm font-semibold text-[#FFFFFF] tracking-wide drop-shadow-[0_0_8px_rgba(255,255,255,0.25)]">
                  {formatINR(user.balance)}
                </span>
                <span className="text-[11px] font-semibold text-[#E4E4E7] border-l border-white/10 pl-2 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Add</span>
                </span>
              </a>

              {/* Account Page */}
              <a
                href={pathFor("account")}
                aria-current={currentTab === "account" ? "page" : undefined}
                className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-none border bg-white/[0.02] hover:bg-white/[0.06] text-zinc-200 hover:text-white text-xs font-medium transition-all cursor-pointer ${currentTab === "account" ? "border-white/35" : "border-white/10"}`}
                title="Account settings and API key"
              >
                <User className="w-3.5 h-3.5 text-zinc-400" />
                <span className="max-w-[100px] truncate">{user.username}</span>
              </a>

              {/* Support — plain text link (examcodes style) */}
              <a
                href={pathFor("support")}
                className="hidden sm:block text-xs sm:text-[13px] font-mono tracking-[0.24em] uppercase text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer"
                title="Get help — Support"
              >
                Support
              </a>
            </>
          ) : (
            <div className="flex items-center gap-5 sm:gap-8">
              <a
                href={pathFor("support")}
                className="hidden sm:block text-xs sm:text-[13px] font-mono tracking-[0.24em] uppercase text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer"
                title="Get help — Support"
              >
                Support
              </a>
              <button
                onClick={() => onOpenAuth("login")}
                className="text-xs sm:text-[13px] font-mono tracking-[0.24em] uppercase text-zinc-200 hover:text-white transition-colors cursor-pointer"
              >
                Sign In
              </button>
            </div>
          )}

          {/* Mobile Hamburger Button */}
          <button
            ref={menuButtonRef}
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-2.5 rounded-none border border-white/10 text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
            aria-label="Open navigation menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation-dialog"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

    </header>

      {/* ── EXAMCODES-STYLE FULLSCREEN CINEMATIC MOBILE MENU ── */}
      <div
        ref={drawerRef}
        id="mobile-navigation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-navigation-title"
        aria-hidden={!mobileMenuOpen}
        className={`md:hidden fixed inset-0 z-[70] flex flex-col transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          mobileMenuOpen
            ? "opacity-100 bg-black/95 backdrop-blur-md pointer-events-auto animate-fadeIn"
            : "opacity-0 bg-black/95 backdrop-blur-md pointer-events-none"
        }`}
          style={{
            paddingTop: "max(1rem, env(safe-area-inset-top))",
            paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
          }}
        >
          {/* Menu Top Bar */}
          <div className="w-full px-5 py-4 flex items-center justify-between border-b border-white/[0.08] shrink-0">
            <h2 id="mobile-navigation-title" className="sr-only">Site navigation</h2>
            <a
              href={pathFor("home")}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 cursor-pointer text-left"
            >
              <SmmUpLogo size={32} />
              <span className="text-base font-light tracking-[0.3em] text-[#FAF9F7]">
                SMM UP
              </span>
            </a>

            <button
              ref={closeButtonRef}
              onClick={() => setMobileMenuOpen(false)}
              className="p-2.5 rounded-none border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Menu Body */}
          <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col justify-between">
            <div className="space-y-6">
              {/* Signed-in user area OR auth buttons */}
              {user ? (
                <div className="p-4 rounded-none border border-white/10 bg-[#0A0A0A] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-none bg-white/[0.05] border border-white/10 flex items-center justify-center text-[#E4E4E7]">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-mono">
                          SIGNED IN
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
                      <span className="text-sm font-bold text-[#FFFFFF]">
                        {formatINR(user.balance)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.06]">
                    <a
                      href={pathFor("add-funds")}
                      onClick={() => setMobileMenuOpen(false)}
                      className="py-2.5 px-3 rounded-none border border-[#E4E4E7]/30 bg-[#E4E4E7]/10 text-[#E4E4E7] font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ExecutiveWalletIcon size={14} />
                      <span>Add funds</span>
                    </a>

                    <a
                      href={pathFor("account")}
                      onClick={() => setMobileMenuOpen(false)}
                      className="py-2.5 px-3 rounded-none border border-white/10 bg-white/[0.03] text-zinc-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Key className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Account</span>
                    </a>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-none border border-white/10 bg-[#0A0A0A] space-y-3">
                  <span className="text-[10px] text-zinc-400 font-mono tracking-widest uppercase block text-center">
                    ACCOUNT
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onOpenAuth("login");
                      }}
                      className="py-3 px-4 rounded-none bg-white text-black font-bold tracking-wider text-xs uppercase hover:bg-zinc-200 transition-all flex items-center justify-center cursor-pointer shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                    >
                      Sign In
                    </button>

                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onOpenAuth("register");
                      }}
                      className="py-3 px-4 rounded-none border border-white/20 bg-white/[0.03] hover:bg-white/[0.08] text-white font-semibold tracking-wider text-xs uppercase transition-all flex items-center justify-center cursor-pointer"
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
                    <a
                      key={link.id}
                      href={pathFor(link.id)}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`w-full py-4 px-4 rounded-none text-xs font-semibold tracking-[0.16em] uppercase flex items-center justify-between border-b border-white/[0.04] transition-all cursor-pointer min-h-[48px] ${
                        isActive
                          ? "bg-white text-black font-bold shadow-[0_0_15px_rgba(255,255,255,0.25)]"
                          : "text-zinc-300 hover:text-white hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={16} className={isActive ? "text-black" : "text-zinc-400"} />
                        <span>{link.label}</span>
                      </div>
                      {isActive && <span className="text-[10px] font-mono">&bull; YOU ARE HERE</span>}
                    </a>
                  );
                })}

                {/* Terms & SLA Link */}
                <a
                  href={pathFor("terms")}
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-4 px-4 rounded-none text-xs font-semibold tracking-[0.16em] uppercase flex items-center gap-3 border-b border-white/[0.04] text-zinc-400 hover:text-white transition-all cursor-pointer min-h-[48px]"
                >
                  <FileText className="w-4 h-4 text-zinc-500" />
                  <span>Terms &amp; Policies</span>
                </a>

                {/* Customer Support Link */}
                <a
                  href={pathFor("support")}
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-4 px-4 rounded-none text-xs font-semibold tracking-[0.16em] uppercase flex items-center gap-3 border-b border-white/[0.04] text-[#E4E4E7] hover:text-white transition-all cursor-pointer min-h-[48px]"
                >
                  <MessageCircle className="w-4 h-4 text-[#E4E4E7]" />
                  <span>Support</span>
                </a>
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
                  className="w-full py-3.5 rounded-none border border-white/15 text-zinc-100 hover:bg-white/[0.06] font-bold tracking-wider text-xs uppercase transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out</span>
                </button>
              )}

              <div className="text-center py-2">
                <span className="text-[9px] tracking-[0.25em] text-zinc-600 font-mono uppercase block">
                  SMM UP &bull; 0% DEPOSIT FEE
                </span>
              </div>
            </div>
          </div>
        </div>
      
    </>
  );
}
