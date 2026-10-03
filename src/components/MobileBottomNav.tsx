import React from "react";
import { ShoppingBag, ListOrdered, Wallet, Zap, User } from "lucide-react";

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
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-black/90 backdrop-blur-lg border-t border-white/10 px-2 py-2">
      <div className="grid grid-cols-5 gap-1">
        <button
          onClick={() => setCurrentTab("store")}
          className={`flex flex-col items-center justify-center py-1 rounded-sm text-[10px] tracking-wider transition-all ${
            currentTab === "store" ? "text-white font-bold" : "text-gray-500"
          }`}
        >
          <ShoppingBag className="w-4 h-4 mb-0.5" />
          <span>STORE</span>
        </button>

        <button
          onClick={() => setCurrentTab("orders")}
          className={`flex flex-col items-center justify-center py-1 rounded-sm text-[10px] tracking-wider transition-all ${
            currentTab === "orders" ? "text-white font-bold" : "text-gray-500"
          }`}
        >
          <ListOrdered className="w-4 h-4 mb-0.5" />
          <span>ORDERS</span>
        </button>

        <button
          onClick={onOpenWallet}
          className="flex flex-col items-center justify-center py-1 rounded-sm text-[10px] tracking-wider text-emerald-400 font-bold"
        >
          <div className="w-4 h-4 rounded-full bg-emerald-400/20 flex items-center justify-center mb-0.5">
            <Wallet className="w-3 h-3 text-emerald-400" />
          </div>
          <span>WALLET</span>
        </button>

        <button
          onClick={() => setCurrentTab("services")}
          className={`flex flex-col items-center justify-center py-1 rounded-sm text-[10px] tracking-wider transition-all ${
            currentTab === "services" ? "text-white font-bold" : "text-gray-500"
          }`}
        >
          <Zap className="w-4 h-4 mb-0.5" />
          <span>RATES</span>
        </button>

        <button
          onClick={user ? onOpenProfile : onOpenAuth}
          className="flex flex-col items-center justify-center py-1 rounded-sm text-[10px] tracking-wider text-gray-500 hover:text-white"
        >
          <User className="w-4 h-4 mb-0.5" />
          <span>{user ? "PROFILE" : "LOGIN"}</span>
        </button>
      </div>
    </div>
  );
}
