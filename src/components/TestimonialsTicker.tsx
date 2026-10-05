import React from "react";
import { Activity } from "lucide-react";

interface DispatchEvent {
  id: number;
  service: string;
  quantity: string;
  status: "Completed" | "Processing" | "Verified" | "Refilled" | "In Progress";
  time: string;
  category: "order" | "deposit" | "refill";
}

const RECENT_EVENTS: DispatchEvent[] = [
  {
    id: 1,
    service: "Instagram Followers & Likes",
    quantity: "2,500 Units",
    status: "Completed",
    time: "Just now",
    category: "order",
  },
  {
    id: 2,
    service: "Direct 0% UPI Wallet Deposit",
    quantity: "₹1,500 Added",
    status: "Verified",
    time: "1m ago",
    category: "deposit",
  },
  {
    id: 3,
    service: "Telegram Channel Members",
    quantity: "10,000 Members",
    status: "In Progress",
    time: "3m ago",
    category: "order",
  },
  {
    id: 4,
    service: "YouTube AdWords Video Views",
    quantity: "5,000 Views",
    status: "Processing",
    time: "4m ago",
    category: "order",
  },
  {
    id: 5,
    service: "Direct 0% UPI Wallet Deposit",
    quantity: "₹3,000 Added",
    status: "Verified",
    time: "6m ago",
    category: "deposit",
  },
  {
    id: 6,
    service: "Twitter / X Post Impressions",
    quantity: "20,000 Impressions",
    status: "Completed",
    time: "8m ago",
    category: "order",
  },
  {
    id: 7,
    service: "30-Day Auto Retention Replenish",
    quantity: "450 Refilled",
    status: "Refilled",
    time: "11m ago",
    category: "refill",
  },
  {
    id: 8,
    service: "Spotify Playlist Audio Streams",
    quantity: "15,000 Streams",
    status: "Completed",
    time: "14m ago",
    category: "order",
  },
];

export default function TestimonialsTicker() {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [fade, setFade] = React.useState(true);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % RECENT_EVENTS.length);
        setFade(true);
      }, 250);
    }, 3500);

    return () => clearInterval(timer);
  }, []);

  const event = RECENT_EVENTS[currentIndex];

  const getStatusBadge = (status: DispatchEvent["status"]) => {
    switch (status) {
      case "Completed":
      case "Verified":
        return "text-[#FAF9F7] border-white/20 bg-white/[0.04]";
      case "In Progress":
      case "Processing":
        return "text-[#E4E4E7] border-[#E4E4E7]/30 bg-[#E4E4E7]/10";
      case "Refilled":
        return "text-[#FAF9F7] border-white/20 bg-white/[0.04]";
      default:
        return "text-zinc-400 border-white/10 bg-white/[0.02]";
    }
  };

  return (
    <section className="border-y border-white/[0.08] bg-[#0A0A0A]/60 py-6 sm:py-8 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-3.5 sm:p-4 rounded-none border border-white/[0.08] bg-black/60 backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
          {/* Header Label */}
          <div className="flex items-center gap-2.5 text-xs text-[#E4E4E7] font-semibold tracking-wider uppercase shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E4E4E7] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E4E4E7]" />
            </span>
            <Activity className="w-3.5 h-3.5" />
            <span>Live Activity Stream</span>
          </div>

          {/* Smooth Dynamic Rotating Event Stream */}
          <div className="w-full sm:w-auto flex-1 sm:pl-6 overflow-hidden">
            <div
              className={`transition-all duration-300 flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-mono ${
                fade ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"
              }`}
            >
              <span className="text-white font-semibold truncate max-w-[200px] sm:max-w-none">
                {event.service}
              </span>
              <span className="text-zinc-500 hidden sm:inline">&bull;</span>
              <span className="text-[#FFFFFF] font-bold">
                {event.quantity}
              </span>
              <span className="text-zinc-500 hidden sm:inline">&bull;</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded border uppercase font-medium ${getStatusBadge(
                  event.status
                )}`}
              >
                {event.status}
              </span>
              <span className="text-zinc-500 text-[11px] ml-auto sm:ml-0 font-normal">
                {event.time}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
