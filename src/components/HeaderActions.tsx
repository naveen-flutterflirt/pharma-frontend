"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Plus, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";

interface HeaderActionsProps {
  selectedRange?: string;
  onRangeChange?: (range: string) => void;
  onSearch?: (query: string) => void;
}

export function HeaderActions({
  selectedRange: externalRange,
  onRangeChange,
  onSearch
}: HeaderActionsProps = {}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [internalRange, setInternalRange] = useState("Today");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const selectedRange = externalRange || internalRange;

  const ranges = ["Today", "Yesterday", "Last 7 days", "This month", "Custom range"];

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectRange = (range: string) => {
    setInternalRange(range);
    setIsDropdownOpen(false);
    if (onRangeChange) {
      onRangeChange(range);
    }
  };

  return (
    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full sm:w-auto">
      {/* Search Input */}
      <div className="relative flex items-center group flex-1 sm:flex-initial min-w-[180px] sm:w-60 md:w-72">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none group-focus-within:text-[#178582] transition-colors" />
        <input 
          id="header-search-input"
          type="text" 
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (onSearch) onSearch(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && searchQuery.trim()) {
              router.push(`/order-desk?search=${encodeURIComponent(searchQuery.trim())}`);
            }
          }}
          placeholder="Search product, party, bill..." 
          className="pl-9 pr-8 py-2 w-full rounded-md border border-gray-200 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#178582] focus:border-[#178582] transition-all bg-white text-gray-900 placeholder:text-gray-400 font-medium shadow-xs"
        />
        {searchQuery && (
          <button 
            id="clear-header-search-btn"
            onClick={() => {
              setSearchQuery("");
              if (onSearch) onSearch("");
            }}
            className="absolute right-2 text-gray-400 hover:text-gray-600 focus:outline-none p-1 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Date Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button 
            id="dashboard-date-range-btn"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            aria-haspopup="true"
            aria-expanded={isDropdownOpen}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-md text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-[#178582] transition-all min-w-[95px] sm:min-w-[105px] justify-between cursor-pointer shadow-xs"
          >
            <span>{selectedRange}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {isDropdownOpen && (
            <div className="absolute right-0 mt-1.5 w-44 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-30 animate-in fade-in slide-in-from-top-2 duration-150">
              {ranges.map((range) => (
                <button
                  key={range}
                  id={`date-range-opt-${range.toLowerCase().replace(/\s+/g, "-")}`}
                  onClick={() => handleSelectRange(range)}
                  className={`w-full text-left px-3.5 py-2 text-xs sm:text-sm transition-colors cursor-pointer ${
                    selectedRange === range 
                      ? 'bg-teal-50 text-[#178582] font-semibold' 
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* New Order Button */}
        <button 
          id="header-new-order-btn"
          onClick={() => router.push('/order-desk')}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-[#178582] text-white rounded-md text-xs sm:text-sm font-semibold hover:bg-[#126b68] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#178582] transition-colors shadow-xs active:scale-95 cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>New order</span>
        </button>
      </div>
    </div>
  );
}
