"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href: string;
  isCurrentPage: boolean;
}

// Map route segments to human-readable labels
const routeLabels: Record<string, string> = {
  dashboard: "Dashboard",
  users: "Users",
  teams: "Teams",
  "audit-logs": "Audit Logs",
  compliance: "Compliance",
  settings: "Settings",
  edit: "Edit",
  create: "Create",
  new: "New",
  profile: "Profile",
  security: "Security",
  notifications: "Notifications",
};

interface BreadcrumbProps {
  className?: string;
}

export function Breadcrumb({ className }: BreadcrumbProps) {
  const pathname = usePathname();

  const breadcrumbs = useMemo((): BreadcrumbItem[] => {
    // Remove leading slash and split into segments
    const segments = pathname.split("/").filter(Boolean);

    if (segments.length === 0) {
      return [];
    }

    // Build breadcrumb items
    const items: BreadcrumbItem[] = [];
    let currentPath = "";

    segments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === segments.length - 1;

      // Try to get a human-readable label, or format the segment
      let label = routeLabels[segment];

      if (!label) {
        // Check if it's a UUID or ID (skip or label as "Details")
        if (
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            segment
          )
        ) {
          label = "Details";
        } else if (/^\d+$/.test(segment)) {
          label = "Details";
        } else {
          // Convert kebab-case or snake_case to Title Case
          label = segment
            .replace(/[-_]/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());
        }
      }

      items.push({
        label,
        href: currentPath,
        isCurrentPage: isLast,
      });
    });

    return items;
  }, [pathname]);

  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center", className)}>
      <ol className="flex items-center gap-1 text-sm">
        {/* Home link */}
        <li>
          <Link
            href="/dashboard"
            className="flex items-center text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Home"
          >
            <Home className="h-4 w-4" />
          </Link>
        </li>

        {/* Breadcrumb items */}
        {breadcrumbs.map((item, index) => (
          <li key={item.href} className="flex items-center">
            <ChevronRight className="h-4 w-4 text-gray-300 mx-1" />
            {item.isCurrentPage ? (
              <span
                className="font-medium text-gray-900"
                aria-current="page"
              >
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default Breadcrumb;
