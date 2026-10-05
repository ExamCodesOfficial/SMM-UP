import React from "react";
import { User, Home } from "lucide-react";
import { pathFor } from "../lib/routes";
import {
  ExecutiveOrderIcon,
  ExecutiveCatalogIcon,
  ExecutiveWalletIcon,
  ExecutiveHistoryIcon,
} from "./icons/ExecutiveIcons";

interface MobileBottomNavProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  user: any;
}

export default function MobileBottomNav({
  currentTab,
  setCurrentTab,
  user,
}: MobileBottomNavProps) {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#090807]/92 backdrop-blur-2xl border-t border-white/[0.08] px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="grid grid-cols-5 gap-1 text-center">
        {/* Home */}
        <button
          onClick={() => {
            setCurrentTab("home");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className={`flex flex-col items-center justify-center py-1.5 rounded-none text-[10px] font-semibold tracking-wider transition-all cursor-pointer ${
            currentTab === "home" ? "text-white bg-white/[0.08]" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Home className="w-4 h-4 mb-1" />
          <span>HOME</span>
        </button>

        {/* Order Desk */}
        <button
          onClick={() => {
            setCurrentTab("order");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className={`flex flex-col items-center justify-center py-1.5 rounded-none text-[10px] font-semibold tracking-wider transition-all cursor-pointer ${
            currentTab === "order" ? "text-white bg-white/[0.08]" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <ExecutiveOrderIcon size={16} className="mb-1" />
          <span>ORDER</span>
        </button>

        {/* Wallet */}
        <a
          href={pathFor("add-funds")}
          aria-current={currentTab === "add-funds" ? "page" : undefined}
          className={`flex flex-col items-center justify-center py-1 rounded-none text-[10px] font-semibold tracking-wider text-[#E4E4E7] cursor-pointer group ${currentTab === "add-funds" ? "bg-white/[0.08]" : ""}`}
        >
          <div className="w-7 h-7 rounded-none bg-[#E4E4E7]/10 border border-[#E4E4E7]/30 flex items-center justify-center mb-0.5 shadow-[0_0_15px_rgba(255,255,255,0.2)] group-hover:scale-105 transition-transform">
            <ExecutiveWalletIcon size={14} className="text-[#E4E4E7]" />
          </div>
          <span>WALLET</span>
        </a>

        {/* Services Catalog */}
        <button
          onClick={() => {
            setCurrentTab("catalog");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className={`flex flex-col items-center justify-center py-1.5 rounded-none text-[10px] font-semibold tracking-wider transition-all cursor-pointer ${
            currentTab === "catalog" ? "text-white bg-white/[0.08]" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <ExecutiveCatalogIcon size={16} className="mb-1" />
          <span>CATALOG</span>
        </button>

        {/* User Account */}
        <a
          href={pathFor(user ? "account" : "auth")}
          aria-current={currentTab === "account" ? "page" : undefined}
          className={`flex flex-col items-center justify-center py-1.5 rounded-none text-[10px] font-semibold tracking-wider hover:text-zinc-200 transition-all cursor-pointer ${currentTab === "account" ? "text-white bg-white/[0.08]" : "text-zinc-400"}`}
        >
          <User className="w-4 h-4 mb-1" />
          <span className="truncate max-w-[50px]">{user ? "ACCOUNT" : "SIGN IN"}</span>
        </a>
      </div>
    </div>
  );
}
