"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Mail,
  Shield,
  Clock,
  Calendar,
  Hash,
  CheckCircle,
  XCircle,
  AlertCircle,
  LogIn,
  UserPlus,
  Key,
  Settings,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, formatDate, formatRelativeTime } from "@/lib/utils";
import type { User, UserRole, UserStatus, AuditLog, AuditEventType, AuditSeverity } from "@/types";

// Mock user data
const mockUsers: Record<string, User> = {
  "1": {
    id: "1",
    auth0_id: "auth0|user1",
    email: "john.doe@example.com",
    name: "John Doe",
    picture: "https://api.dicebear.com/7.x/avataaars/svg?seed=john",
    roles: ["admin"],
    status: "active",
    email_verified: true,
    last_login: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    login_count: 156,
    metadata: {
      department: "Engineering",
      employee_id: "EMP-001",
      phone: "+1 (555) 123-4567",
    },
    created_at: "2024-01-15T10:30:00Z",
    updated_at: "2024-03-10T14:22:00Z",
  },
  "2": {
    id: "2",
    auth0_id: "auth0|user2",
    email: "jane.smith@example.com",
    name: "Jane Smith",
    picture: "https://api.dicebear.com/7.x/avataaars/svg?seed=jane",
    roles: ["manager"],
    status: "active",
    email_verified: true,
    last_login: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    login_count: 89,
    metadata: {
      department: "Marketing",
      employee_id: "EMP-002",
    },
    created_at: "2024-02-20T09:15:00Z",
    updated_at: "2024-03-08T11:45:00Z",
  },
  "3": {
    id: "3",
    auth0_id: "auth0|user3",
    email: "bob.wilson@example.com",
    name: "Bob Wilson",
    roles: ["member"],
    status: "inactive",
    email_verified: true,
    last_login: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    login_count: 23,
    created_at: "2024-01-05T16:20:00Z",
    updated_at: "2024-02-28T09:30:00Z",
  },
  "4": {
    id: "4",
    auth0_id: "auth0|user4",
    email: "sarah.johnson@example.com",
    name: "Sarah Johnson",
    picture: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah",
    roles: ["super_admin"],
    status: "active",
    email_verified: true,
    last_login: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    login_count: 312,
    metadata: {
      department: "IT",
      employee_id: "EMP-004",
      phone: "+1 (555) 987-6543",
    },
    created_at: "2023-11-10T08:00:00Z",
    updated_at: "2024-03-10T16:00:00Z",
  },
  "5": {
    id: "5",
    auth0_id: "auth0|user5",
    email: "mike.brown@example.com",
    name: "Mike Brown",
    roles: ["viewer"],
    status: "pending",
    email_verified: false,
    login_count: 0,
    created_at: "2024-03-09T14:30:00Z",
    updated_at: "2024-03-09T14:30:00Z",
  },
  "6": {
    id: "6",
    auth0_id: "auth0|user6",
    email: "emily.davis@example.com",
    name: "Emily Davis",
    picture: "https://api.dicebear.com/7.x/avataaars/svg?seed=emily",
    roles: ["member"],
    status: "blocked",
    email_verified: true,
    last_login: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
    login_count: 45,
    created_at: "2024-01-20T11:00:00Z",
    updated_at: "2024-03-05T10:15:00Z",
  },
  "7": {
    id: "7",
    auth0_id: "auth0|user7",
    email: "alex.turner@example.com",
    name: "Alex Turner",
    picture: "https://api.dicebear.com/7.x/avataaars/svg?seed=alex",
    roles: ["manager", "member"],
    status: "active",
    email_verified: true,
    last_login: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    login_count: 78,
    metadata: {
      department: "Sales",
      employee_id: "EMP-007",
    },
    created_at: "2024-02-01T13:45:00Z",
    updated_at: "2024-03-10T08:20:00Z",
  },
  "8": {
    id: "8",
    auth0_id: "auth0|user8",
    email: "lisa.anderson@example.com",
    name: "Lisa Anderson",
    roles: ["admin"],
    status: "active",
    email_verified: true,
    last_login: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    login_count: 134,
    metadata: {
      department: "HR",
      employee_id: "EMP-008",
    },
    created_at: "2023-12-15T09:30:00Z",
    updated_at: "2024-03-09T17:00:00Z",
  },
};

// Mock activity/audit history for users
const generateMockActivityForUser = (userId: string): AuditLog[] => {
  const baseActivities: Array<{
    event_type: AuditEventType;
    severity: AuditSeverity;
    success: boolean;
    details?: Record<string, unknown>;
  }> = [
    { event_type: "user.login", severity: "info", success: true },
    { event_type: "user.login", severity: "info", success: true },
    { event_type: "user.updated", severity: "low", success: true, details: { field: "name" } },
    { event_type: "user.password_changed", severity: "medium", success: true },
    { event_type: "user.role_assigned", severity: "medium", success: true, details: { role: "admin" } },
    { event_type: "user.login", severity: "info", success: false, details: { reason: "Invalid password" } },
    { event_type: "user.mfa_enabled", severity: "medium", success: true },
    { event_type: "user.login", severity: "info", success: true },
  ];

  return baseActivities.map((activity, index) => ({
    id: `activity-${userId}-${index}`,
    event_type: activity.event_type,
    severity: activity.severity,
    actor_id: userId,
    actor_email: mockUsers[userId]?.email,
    actor_name: mockUsers[userId]?.name,
    target_type: "user",
    target_id: userId,
    target_name: mockUsers[userId]?.name,
    ip_address: "192.168.1." + (100 + index),
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    location: {
      country: "United States",
      city: "San Francisco",
      region: "California",
    },
    details: activity.details,
    success: activity.success,
    error_message: activity.success ? undefined : "Authentication failed",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * index).toISOString(),
  }));
};

const statusConfig: Record<UserStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info"; icon: typeof CheckCircle }> = {
  active: { label: "Active", variant: "success", icon: CheckCircle },
  inactive: { label: "Inactive", variant: "secondary", icon: XCircle },
  blocked: { label: "Blocked", variant: "destructive", icon: XCircle },
  pending: { label: "Pending", variant: "warning", icon: AlertCircle },
};

const roleConfig: Record<UserRole, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" }> = {
  super_admin: { label: "Super Admin", variant: "destructive" },
  admin: { label: "Admin", variant: "default" },
  manager: { label: "Manager", variant: "info" },
  member: { label: "Member", variant: "secondary" },
  viewer: { label: "Viewer", variant: "outline" },
};

const activityIconMap: Partial<Record<AuditEventType, typeof LogIn>> = {
  "user.login": LogIn,
  "user.logout": LogIn,
  "user.created": UserPlus,
  "user.updated": Pencil,
  "user.password_changed": Key,
  "user.mfa_enabled": Shield,
  "user.mfa_disabled": Shield,
  "user.role_assigned": Shield,
  "user.role_removed": Shield,
  "user.blocked": XCircle,
  "user.unblocked": CheckCircle,
  "system.config_changed": Settings,
};

const activityLabelMap: Partial<Record<AuditEventType, string>> = {
  "user.login": "Logged in",
  "user.logout": "Logged out",
  "user.created": "Account created",
  "user.updated": "Profile updated",
  "user.password_changed": "Password changed",
  "user.mfa_enabled": "MFA enabled",
  "user.mfa_disabled": "MFA disabled",
  "user.role_assigned": "Role assigned",
  "user.role_removed": "Role removed",
  "user.blocked": "Account blocked",
  "user.unblocked": "Account unblocked",
};

export default function UserDetailPage() {
  const params = useParams();
  const userId = params.id as string;

  const user = mockUsers[userId];
  const activities = useMemo(() => generateMockActivityForUser(userId), [userId]);

  if (!user) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/users">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Users
            </Button>
          </Link>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">User not found</p>
            <p className="text-gray-400 text-sm mt-1">
              The user you are looking for does not exist or has been deleted.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const StatusIcon = statusConfig[user.status].icon;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/users">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Users
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Profile Card */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="pt-6">
              {/* Avatar and Basic Info */}
              <div className="flex flex-col items-center text-center">
                <Avatar className="h-24 w-24 mb-4">
                  <AvatarImage src={user.picture} alt={user.name} />
                  <AvatarFallback className="text-2xl bg-blue-100 text-blue-600">
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-xl font-semibold text-gray-900">
                  {user.name}
                </h2>
                <p className="text-gray-500 text-sm mt-1">{user.email}</p>

                {/* Status */}
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant={statusConfig[user.status].variant}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {statusConfig[user.status].label}
                  </Badge>
                </div>

                {/* Role Badges */}
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {user.roles.map((role) => (
                    <Badge key={role} variant={roleConfig[role].variant}>
                      {roleConfig[role].label}
                    </Badge>
                  ))}
                </div>

                {/* Edit Button */}
                <Button className="mt-6 w-full">
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit User
                </Button>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-200 my-6" />

              {/* User Details */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-gray-500">Email</p>
                    <p className="text-gray-900">{user.email}</p>
                  </div>
                  {user.email_verified ? (
                    <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-500 ml-auto" />
                  )}
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <Shield className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-gray-500">Auth0 ID</p>
                    <p className="text-gray-900 font-mono text-xs">{user.auth0_id}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-gray-500">Last Login</p>
                    <p className="text-gray-900">
                      {user.last_login
                        ? formatRelativeTime(user.last_login)
                        : "Never"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <Hash className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-gray-500">Login Count</p>
                    <p className="text-gray-900">{user.login_count} logins</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-gray-500">Created</p>
                    <p className="text-gray-900">{formatDate(user.created_at)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-gray-500">Last Updated</p>
                    <p className="text-gray-900">{formatDate(user.updated_at)}</p>
                  </div>
                </div>
              </div>

              {/* Metadata Section */}
              {user.metadata && Object.keys(user.metadata).length > 0 && (
                <>
                  <div className="border-t border-gray-200 my-6" />
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-3">
                      Additional Information
                    </h3>
                    <div className="space-y-3">
                      {Object.entries(user.metadata).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-3 text-sm">
                          <Settings className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="text-gray-500 capitalize">
                              {key.replace(/_/g, " ")}
                            </p>
                            <p className="text-gray-900">{String(value)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Activity/Audit History */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Activity History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activities.map((activity, index) => {
                  const ActivityIcon = activityIconMap[activity.event_type] || Clock;
                  const activityLabel = activityLabelMap[activity.event_type] || activity.event_type;

                  return (
                    <div
                      key={activity.id}
                      className={cn(
                        "flex items-start gap-4 pb-4",
                        index !== activities.length - 1 && "border-b border-gray-100"
                      )}
                    >
                      {/* Icon */}
                      <div
                        className={cn(
                          "p-2 rounded-lg shrink-0",
                          activity.success
                            ? "bg-blue-50 text-blue-600"
                            : "bg-red-50 text-red-600"
                        )}
                      >
                        <ActivityIcon className="h-4 w-4" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-gray-900">
                            {activityLabel}
                            {!activity.success && (
                              <span className="text-red-600 ml-2">(Failed)</span>
                            )}
                          </p>
                          <span className="text-sm text-gray-400 shrink-0">
                            {formatRelativeTime(activity.created_at)}
                          </span>
                        </div>

                        {/* Details */}
                        {activity.details && (
                          <p className="text-sm text-gray-500 mt-1">
                            {Object.entries(activity.details)
                              .map(([key, value]) => `${key}: ${value}`)
                              .join(", ")}
                          </p>
                        )}

                        {/* Error message */}
                        {activity.error_message && (
                          <p className="text-sm text-red-500 mt-1">
                            {activity.error_message}
                          </p>
                        )}

                        {/* Location/IP */}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          {activity.ip_address && (
                            <span className="flex items-center gap-1">
                              <Globe className="h-3 w-3" />
                              {activity.ip_address}
                            </span>
                          )}
                          {activity.location?.city && activity.location?.country && (
                            <span>
                              {activity.location.city}, {activity.location.country}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Severity Badge */}
                      <Badge
                        variant={
                          activity.severity === "critical" || activity.severity === "high"
                            ? "destructive"
                            : activity.severity === "medium"
                            ? "warning"
                            : activity.severity === "low"
                            ? "info"
                            : "secondary"
                        }
                        className="shrink-0"
                      >
                        {activity.severity}
                      </Badge>
                    </div>
                  );
                })}

                {activities.length === 0 && (
                  <div className="py-12 text-center">
                    <p className="text-gray-500">No activity recorded</p>
                    <p className="text-gray-400 text-sm mt-1">
                      Activity will appear here as the user interacts with the system.
                    </p>
                  </div>
                )}
              </div>

              {/* View All Link */}
              {activities.length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <Link
                    href={`/dashboard/audit-logs?user_id=${userId}`}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    View all activity in audit logs
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
