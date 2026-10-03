import React from "react";
import { User, Home } from "lucide-react";
import {
  ExecutiveOrderIcon,
  ExecutiveCatalogIcon,
  ExecutiveWalletIcon,
  ExecutiveHistoryIcon,
} from "./icons/ExecutiveIcons";

interface MobileBottomNavProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenWallet: () => void;
  onOpenProfile: () => void;
  onOpenAuth: () => void;
  user: any;
}

export default function MobileBottomNav({
  currentTab,
  setCurrentTab,
  onOpenWallet,
  onOpenProfile,
  onOpenAuth,
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
          className={`flex flex-col items-center justify-center py-1.5 rounded-xl text-[10px] font-semibold tracking-wider transition-all cursor-pointer ${
            currentTab === "home" ? "text-white bg-white/[0.08]" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Home className="w-4 h-4 mb-1" />
          <span>HOME</span>
        </button>

        {/* Order Desk */}
        <button
          onClick={() => {
            setCurrentTab("store");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className={`flex flex-col items-center justify-center py-1.5 rounded-xl text-[10px] font-semibold tracking-wider transition-all cursor-pointer ${
            currentTab === "store" ? "text-white bg-white/[0.08]" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <ExecutiveOrderIcon size={16} className="mb-1" />
          <span>ORDER</span>
        </button>

        {/* Luxury Champagne Platinum Wallet */}
        <button
          onClick={onOpenWallet}
          className="flex flex-col items-center justify-center py-1 rounded-xl text-[10px] font-semibold tracking-wider text-[#F5E8D0] cursor-pointer group"
        >
          <div className="w-7 h-7 rounded-xl bg-[#F5E8D0]/10 border border-[#F5E8D0]/30 flex items-center justify-center mb-0.5 shadow-[0_0_15px_rgba(245,232,208,0.2)] group-hover:scale-105 transition-transform">
            <ExecutiveWalletIcon size={14} className="text-[#F5E8D0]" />
          </div>
          <span>WALLET</span>
        </button>

        {/* Services Catalog */}
        <button
          onClick={() => {
            setCurrentTab("services");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className={`flex flex-col items-center justify-center py-1.5 rounded-xl text-[10px] font-semibold tracking-wider transition-all cursor-pointer ${
            currentTab === "services" ? "text-white bg-white/[0.08]" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <ExecutiveCatalogIcon size={16} className="mb-1" />
          <span>CATALOG</span>
        </button>

        {/* User Account */}
        <button
          onClick={user ? onOpenProfile : onOpenAuth}
          className="flex flex-col items-center justify-center py-1.5 rounded-xl text-[10px] font-semibold tracking-wider text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer"
        >
          <User className="w-4 h-4 mb-1" />
          <span className="truncate max-w-[50px]">{user ? "ACCOUNT" : "SIGN IN"}</span>
        </button>
      </div>
    </div>
  );
}
