import React from "react";
import { Zap, Search, Clock, RotateCcw, ArrowRight } from "lucide-react";
import { formatINR, formatNumber } from "../lib/utils";

interface Service {
  service: number | string;
  name: string;
  type: string;
  category: string;
  rate: number;
  min: number;
  max: number;
  dripfeed: boolean;
  refill: boolean;
  cancel: boolean;
  average_time: string;
  description: string;
}

interface ServicesCatalogProps {
  services: Service[];
  onSelectService: (serviceId: number | string) => void;
}

export default function ServicesCatalog({ services, onSelectService }: ServicesCatalogProps) {
  const [search, setSearch] = React.useState("");
  const [selectedCat, setSelectedCat] = React.useState("All");

  const categories = React.useMemo(() => {
    const set = new Set<string>();
    services.forEach((s) => set.add(s.category));
    return ["All", ...Array.from(set).sort()];
  }, [services]);

  const filtered = React.useMemo(() => {
    return services.filter((s) => {
      const matchCat = selectedCat === "All" || s.category === selectedCat;
      const matchSearch =
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        String(s.service) === search.trim() ||
        s.category.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [services, selectedCat, search]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-base sm:text-lg font-bold tracking-[0.14em] text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span>SERVICES & TARIFF CATALOG</span>
            <span className="text-[10px] text-white/40">❖</span>
          </h2>
          <p className="text-[11px] text-gray-500 font-mono tracking-wider">
            WHOLESALE PROVISIONING PRICE DIRECTORY ({services.length} ACTIVE)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Category Dropdown */}
          <select
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
            className="bg-black/60 border border-white/10 text-white px-3 py-1.5 text-xs font-mono rounded-sm outline-none max-w-xs"
          >
            {categories.map((c) => (
              <option key={c} value={c} className="bg-neutral-900 text-white">
                {c}
              </option>
            ))}
          </select>

          {/* Search Box */}
          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search services or ID..."
              className="w-full bg-black/60 border border-white/10 focus:border-white/40 text-white pl-8 pr-3 py-1.5 text-xs font-mono rounded-sm outline-none placeholder:text-gray-600"
            />
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2.5" />
          </div>
        </div>
      </div>

      {/* Services Table */}
      <div className="border border-white/10 bg-white/[0.01] rounded-sm overflow-hidden shadow-[0_0_30px_rgba(255,255,255,0.02)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-black/80 border-b border-white/10 text-gray-500 uppercase tracking-widest text-[10px]">
              <tr>
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">SERVICE</th>
                <th className="py-3 px-4">RATE / 1K</th>
                <th className="py-3 px-4">MIN / MAX</th>
                <th className="py-3 px-4">REFILL</th>
                <th className="py-3 px-4">SPEED</th>
                <th className="py-3 px-4 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {filtered.slice(0, 100).map((s) => (
                <tr key={s.service} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4 font-bold text-white whitespace-nowrap">
                    #{s.service}
                  </td>
                  <td className="py-3 px-4 max-w-sm text-gray-300">
                    <div className="font-semibold text-white truncate">{s.name}</div>
                    <div className="text-[10px] text-gray-500 truncate">{s.category}</div>
                  </td>
                  <td className="py-3 px-4 font-bold text-emerald-400 whitespace-nowrap">
                    {formatINR(s.rate)}
                  </td>
                  <td className="py-3 px-4 text-gray-400 whitespace-nowrap">
                    {formatNumber(s.min)} – {formatNumber(s.max)}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {s.refill ? (
                      <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                        <RotateCcw className="w-2.5 h-2.5" /> REFILL
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-600">NO</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-gray-400 whitespace-nowrap">
                    <span className="flex items-center gap-1 text-[11px]">
                      <Clock className="w-3 h-3 text-gray-500" />
                      {s.average_time || "Instant"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      onClick={() => onSelectService(s.service)}
                      className="px-2.5 py-1 bg-white hover:bg-neutral-200 text-black font-bold text-[10px] tracking-wider rounded-sm transition-all inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>ORDER</span>
                      <ArrowRight className="w-2.5 h-2.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {filtered.length > 100 && (
        <div className="text-center text-xs font-mono text-gray-500 mt-4">
          Showing top 100 of {filtered.length} services. Use search to refine.
        </div>
      )}
    </div>
  );
}
