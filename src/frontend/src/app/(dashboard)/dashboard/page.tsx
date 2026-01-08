"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import {
  Users,
  Users2,
  FileText,
  Shield,
  TrendingUp,
  Clock,
} from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
  trendUp?: boolean;
}

function StatCard({ title, value, icon: Icon, trend, trendUp }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {trend && (
            <p
              className={`text-sm mt-1 flex items-center gap-1 ${
                trendUp ? "text-green-600" : "text-red-600"
              }`}
            >
              <TrendingUp
                className={`h-3 w-3 ${!trendUp && "rotate-180"}`}
              />
              {trend}
            </p>
          )}
        </div>
        <div className="p-3 bg-blue-50 rounded-lg">
          <Icon className="h-6 w-6 text-blue-600" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, isLoading } = useUser();

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {isLoading
            ? "Loading..."
            : `Welcome back, ${user?.name?.split(" ")[0] || "User"}`}
        </h1>
        <p className="text-gray-500 mt-1">
          Here&apos;s what&apos;s happening with your organization today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value="2,543"
          icon={Users}
          trend="+12.5% from last month"
          trendUp={true}
        />
        <StatCard
          title="Active Teams"
          value="48"
          icon={Users2}
          trend="+3 new teams"
          trendUp={true}
        />
        <StatCard
          title="Audit Events"
          value="12,847"
          icon={FileText}
          trend="Last 30 days"
        />
        <StatCard
          title="Compliance Score"
          value="94%"
          icon={Shield}
          trend="+2% improvement"
          trendUp={true}
        />
      </div>

      {/* Recent Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Users
            </h2>
            <a
              href="/dashboard/users"
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              View all
            </a>
          </div>
          <div className="space-y-3">
            {[
              { name: "John Doe", email: "john@example.com", role: "Admin" },
              { name: "Jane Smith", email: "jane@example.com", role: "User" },
              { name: "Bob Johnson", email: "bob@example.com", role: "Manager" },
            ].map((user, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium text-sm">
                    {user.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {user.name}
                    </p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                </div>
                <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                  {user.role}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Activity
            </h2>
            <a
              href="/dashboard/audit-logs"
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              View all
            </a>
          </div>
          <div className="space-y-3">
            {[
              { action: "User login", user: "john@example.com", time: "2m ago" },
              { action: "Team created", user: "jane@example.com", time: "15m ago" },
              { action: "Role updated", user: "admin@example.com", time: "1h ago" },
              { action: "User invited", user: "bob@example.com", time: "3h ago" },
            ].map((activity, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Clock className="h-4 w-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {activity.action}
                    </p>
                    <p className="text-xs text-gray-500">{activity.user}</p>
                  </div>
                </div>
                <span className="text-xs text-gray-400">{activity.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
