"use client";

import { useState, useRef, useEffect } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { LogOut, User, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Breadcrumb } from "./breadcrumb";

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  const { user, isLoading } = useUser();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Get user initials for avatar fallback
  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-30 h-16 bg-white border-b border-gray-200 px-4 lg:px-6",
        className
      )}
    >
      <div className="flex items-center justify-between h-full">
        {/* Breadcrumb Area */}
        <div className="flex items-center pl-12 lg:pl-0">
          <Breadcrumb />
        </div>

        {/* User Menu */}
        <div className="relative" ref={dropdownRef}>
          {isLoading ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
              <div className="hidden sm:block w-24 h-4 bg-gray-200 rounded animate-pulse" />
            </div>
          ) : user ? (
            <>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {user.picture ? (
                  <img
                    src={user.picture}
                    alt={user.name || "User avatar"}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
                    {getInitials(user.name)}
                  </div>
                )}
                <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-[150px] truncate">
                  {user.name || user.email}
                </span>
                <ChevronDown
                  className={cn(
                    "hidden sm:block h-4 w-4 text-gray-400 transition-transform",
                    isDropdownOpen && "rotate-180"
                  )}
                />
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  {/* User Info */}
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user.name || "User"}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {user.email}
                    </p>
                  </div>

                  {/* Menu Items */}
                  <div className="py-1">
                    <a
                      href="/dashboard/settings"
                      className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <User className="h-4 w-4 text-gray-400" />
                      <span>Profile Settings</span>
                    </a>
                  </div>

                  {/* Logout */}
                  <div className="border-t border-gray-100 py-1">
                    <a
                      href="/api/auth/logout"
                      className="flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Log out</span>
                    </a>
                  </div>
                </div>
              )}
            </>
          ) : (
            <a
              href="/api/auth/login"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Log in
            </a>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
