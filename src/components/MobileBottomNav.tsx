import React from "react";
import { ShoppingBag, ListOrdered, Wallet, Sparkles, User } from "lucide-react";

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
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-black/90 backdrop-blur-2xl border-t border-white/[0.08] px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="grid grid-cols-5 gap-1 text-center">
        <button
          onClick={() => setCurrentTab("store")}
          className={`flex flex-col items-center justify-center py-1.5 rounded-xl text-[10px] font-semibold tracking-wider transition-all cursor-pointer ${
            currentTab === "store" ? "text-white bg-white/[0.08]" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <ShoppingBag className="w-4 h-4 mb-1" />
          <span>ORDER</span>
        </button>

        <button
          onClick={() => setCurrentTab("services")}
          className={`flex flex-col items-center justify-center py-1.5 rounded-xl text-[10px] font-semibold tracking-wider transition-all cursor-pointer ${
            currentTab === "services" ? "text-white bg-white/[0.08]" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Sparkles className="w-4 h-4 mb-1" />
          <span>CATALOG</span>
        </button>

        <button
          onClick={onOpenWallet}
          className="flex flex-col items-center justify-center py-1 rounded-xl text-[10px] font-semibold tracking-wider text-emerald-400 cursor-pointer"
        >
          <div className="w-7 h-7 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-0.5 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <span>WALLET</span>
        </button>

        <button
          onClick={() => setCurrentTab("orders")}
          className={`flex flex-col items-center justify-center py-1.5 rounded-xl text-[10px] font-semibold tracking-wider transition-all cursor-pointer ${
            currentTab === "orders" ? "text-white bg-white/[0.08]" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <ListOrdered className="w-4 h-4 mb-1" />
          <span>LOGS</span>
        </button>

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
