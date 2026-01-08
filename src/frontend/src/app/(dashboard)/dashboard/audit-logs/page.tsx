"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";

// Types
type Severity = "info" | "low" | "medium" | "high" | "critical";
type EventType = "auth" | "user" | "team" | "permission" | "system" | "security";

interface AuditLog {
  id: string;
  event: string;
  eventType: EventType;
  actor: string;
  actorEmail: string;
  target: string;
  targetType: string;
  severity: Severity;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
}

// Mock data
const mockAuditLogs: AuditLog[] = [
  {
    id: "1",
    event: "User Login Success",
    eventType: "auth",
    actor: "John Doe",
    actorEmail: "john@example.com",
    target: "Authentication Service",
    targetType: "service",
    severity: "info",
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    ipAddress: "192.168.1.100",
    userAgent: "Chrome/120.0.0.0",
  },
  {
    id: "2",
    event: "Failed Login Attempt",
    eventType: "auth",
    actor: "Unknown",
    actorEmail: "unknown@attacker.com",
    target: "Authentication Service",
    targetType: "service",
    severity: "high",
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
    ipAddress: "203.0.113.50",
    userAgent: "Python-requests/2.28.0",
  },
  {
    id: "3",
    event: "Role Permission Updated",
    eventType: "permission",
    actor: "Admin User",
    actorEmail: "admin@example.com",
    target: "Manager Role",
    targetType: "role",
    severity: "medium",
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    ipAddress: "192.168.1.1",
    userAgent: "Firefox/121.0",
  },
  {
    id: "4",
    event: "User Account Created",
    eventType: "user",
    actor: "Jane Smith",
    actorEmail: "jane@example.com",
    target: "bob.wilson@example.com",
    targetType: "user",
    severity: "low",
    timestamp: new Date(Date.now() - 1000 * 60 * 60),
    ipAddress: "192.168.1.50",
    userAgent: "Safari/17.2",
  },
  {
    id: "5",
    event: "Team Member Removed",
    eventType: "team",
    actor: "Jane Smith",
    actorEmail: "jane@example.com",
    target: "Engineering Team",
    targetType: "team",
    severity: "medium",
    timestamp: new Date(Date.now() - 1000 * 60 * 90),
    ipAddress: "192.168.1.50",
    userAgent: "Safari/17.2",
  },
  {
    id: "6",
    event: "Suspicious Activity Detected",
    eventType: "security",
    actor: "System",
    actorEmail: "system@internal",
    target: "user-session-abc123",
    targetType: "session",
    severity: "critical",
    timestamp: new Date(Date.now() - 1000 * 60 * 120),
    ipAddress: "0.0.0.0",
    userAgent: "System",
  },
  {
    id: "7",
    event: "API Key Generated",
    eventType: "security",
    actor: "Developer Account",
    actorEmail: "dev@example.com",
    target: "Production API Key",
    targetType: "api_key",
    severity: "high",
    timestamp: new Date(Date.now() - 1000 * 60 * 180),
    ipAddress: "192.168.1.75",
    userAgent: "Chrome/120.0.0.0",
  },
  {
    id: "8",
    event: "System Configuration Changed",
    eventType: "system",
    actor: "Admin User",
    actorEmail: "admin@example.com",
    target: "MFA Settings",
    targetType: "config",
    severity: "high",
    timestamp: new Date(Date.now() - 1000 * 60 * 240),
    ipAddress: "192.168.1.1",
    userAgent: "Firefox/121.0",
  },
  {
    id: "9",
    event: "User Password Reset",
    eventType: "user",
    actor: "John Doe",
    actorEmail: "john@example.com",
    target: "john@example.com",
    targetType: "user",
    severity: "info",
    timestamp: new Date(Date.now() - 1000 * 60 * 300),
    ipAddress: "192.168.1.100",
    userAgent: "Chrome/120.0.0.0",
  },
  {
    id: "10",
    event: "Bulk User Import",
    eventType: "user",
    actor: "Admin User",
    actorEmail: "admin@example.com",
    target: "25 users imported",
    targetType: "bulk_operation",
    severity: "medium",
    timestamp: new Date(Date.now() - 1000 * 60 * 360),
    ipAddress: "192.168.1.1",
    userAgent: "Firefox/121.0",
  },
  {
    id: "11",
    event: "Team Created",
    eventType: "team",
    actor: "Manager User",
    actorEmail: "manager@example.com",
    target: "Marketing Team",
    targetType: "team",
    severity: "low",
    timestamp: new Date(Date.now() - 1000 * 60 * 420),
    ipAddress: "192.168.1.60",
    userAgent: "Edge/120.0.0.0",
  },
  {
    id: "12",
    event: "Permission Escalation Blocked",
    eventType: "security",
    actor: "Malicious User",
    actorEmail: "hacker@example.com",
    target: "Admin Role",
    targetType: "role",
    severity: "critical",
    timestamp: new Date(Date.now() - 1000 * 60 * 480),
    ipAddress: "203.0.113.100",
    userAgent: "curl/7.88.1",
  },
];

// Severity badge configuration
const severityConfig: Record<
  Severity,
  { label: string; className: string }
> = {
  info: {
    label: "Info",
    className: "bg-blue-100 text-blue-700 border-blue-200",
  },
  low: {
    label: "Low",
    className: "bg-green-100 text-green-700 border-green-200",
  },
  medium: {
    label: "Medium",
    className: "bg-yellow-100 text-yellow-700 border-yellow-200",
  },
  high: {
    label: "High",
    className: "bg-orange-100 text-orange-700 border-orange-200",
  },
  critical: {
    label: "Critical",
    className: "bg-red-100 text-red-700 border-red-200",
  },
};

// Event type labels
const eventTypeLabels: Record<EventType, string> = {
  auth: "Authentication",
  user: "User Management",
  team: "Team",
  permission: "Permission",
  system: "System",
  security: "Security",
};

// Date range options
const dateRangeOptions = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "week", label: "Last 7 Days" },
  { value: "month", label: "Last 30 Days" },
  { value: "quarter", label: "Last 90 Days" },
];

const ITEMS_PER_PAGE = 10;

export default function AuditLogsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState<EventType | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  const [dateRangeFilter, setDateRangeFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Filter audit logs based on current filters
  const filteredLogs = useMemo(() => {
    return mockAuditLogs.filter((log) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          log.event.toLowerCase().includes(query) ||
          log.actor.toLowerCase().includes(query) ||
          log.actorEmail.toLowerCase().includes(query) ||
          log.target.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Event type filter
      if (eventTypeFilter !== "all" && log.eventType !== eventTypeFilter) {
        return false;
      }

      // Severity filter
      if (severityFilter !== "all" && log.severity !== severityFilter) {
        return false;
      }

      // Date range filter
      if (dateRangeFilter !== "all") {
        const now = new Date();
        const logDate = new Date(log.timestamp);
        let cutoffDate: Date;

        switch (dateRangeFilter) {
          case "today":
            cutoffDate = new Date(now.setHours(0, 0, 0, 0));
            break;
          case "week":
            cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case "month":
            cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case "quarter":
            cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
          default:
            cutoffDate = new Date(0);
        }

        if (logDate < cutoffDate) return false;
      }

      return true;
    });
  }, [searchQuery, eventTypeFilter, severityFilter, dateRangeFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset to page 1 when filters change
  const handleFilterChange = (
    setter: (value: string) => void,
    value: string
  ) => {
    setter(value);
    setCurrentPage(1);
  };

  // Export functionality (mock)
  const handleExport = () => {
    // In a real app, this would generate and download a CSV/JSON file
    const data = filteredLogs.map((log) => ({
      Event: log.event,
      Actor: log.actor,
      ActorEmail: log.actorEmail,
      Target: log.target,
      Severity: log.severity,
      Timestamp: formatDate(log.timestamp),
      IPAddress: log.ipAddress,
    }));
    console.log("Exporting audit logs:", data);
    alert(`Export initiated for ${filteredLogs.length} records`);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-500 mt-1">
            Monitor and review all system activities and security events
          </p>
        </div>
        <Button onClick={handleExport} className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search events, actors, targets..."
                value={searchQuery}
                onChange={(e) =>
                  handleFilterChange(setSearchQuery, e.target.value)
                }
                className="pl-10"
              />
            </div>

            {/* Event Type Filter */}
            <select
              value={eventTypeFilter}
              onChange={(e) =>
                handleFilterChange(
                  setEventTypeFilter as (value: string) => void,
                  e.target.value
                )
              }
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="all">All Event Types</option>
              {Object.entries(eventTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            {/* Severity Filter */}
            <select
              value={severityFilter}
              onChange={(e) =>
                handleFilterChange(
                  setSeverityFilter as (value: string) => void,
                  e.target.value
                )
              }
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="all">All Severities</option>
              {Object.entries(severityConfig).map(([value, config]) => (
                <option key={value} value={value}>
                  {config.label}
                </option>
              ))}
            </select>

            {/* Date Range Filter */}
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <select
                value={dateRangeFilter}
                onChange={(e) =>
                  handleFilterChange(setDateRangeFilter, e.target.value)
                }
                className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {dateRangeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          Showing {paginatedLogs.length} of {filteredLogs.length} results
        </span>
        {filteredLogs.length !== mockAuditLogs.length && (
          <button
            onClick={() => {
              setSearchQuery("");
              setEventTypeFilter("all");
              setSeverityFilter("all");
              setDateRangeFilter("all");
              setCurrentPage(1);
            }}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Audit Logs Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                    Event
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                    Actor
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                    Target
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                    Severity
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                    Timestamp
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {paginatedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <AlertCircle className="h-8 w-8 text-gray-400" />
                        <p className="text-gray-500 font-medium">
                          No audit logs found
                        </p>
                        <p className="text-gray-400 text-sm">
                          Try adjusting your filters or search query
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">
                            {log.event}
                          </span>
                          <span className="text-xs text-gray-500">
                            {eventTypeLabels[log.eventType]}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">
                            {log.actor}
                          </span>
                          <span className="text-xs text-gray-500">
                            {log.actorEmail}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm text-gray-900">
                            {log.target}
                          </span>
                          <span className="text-xs text-gray-500 capitalize">
                            {log.targetType.replace("_", " ")}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          className={cn(
                            "font-medium",
                            severityConfig[log.severity].className
                          )}
                        >
                          {severityConfig[log.severity].label}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm text-gray-900">
                            {formatDate(log.timestamp)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {log.ipAddress}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className="w-9"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="gap-1"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
