"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { User, UserRole, UserStatus } from "@/types";

// Mock data for users
const mockUsers: User[] = [
  {
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
    created_at: "2024-01-15T10:30:00Z",
    updated_at: "2024-03-10T14:22:00Z",
  },
  {
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
    created_at: "2024-02-20T09:15:00Z",
    updated_at: "2024-03-08T11:45:00Z",
  },
  {
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
  {
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
    created_at: "2023-11-10T08:00:00Z",
    updated_at: "2024-03-10T16:00:00Z",
  },
  {
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
  {
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
  {
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
    created_at: "2024-02-01T13:45:00Z",
    updated_at: "2024-03-10T08:20:00Z",
  },
  {
    id: "8",
    auth0_id: "auth0|user8",
    email: "lisa.anderson@example.com",
    name: "Lisa Anderson",
    roles: ["admin"],
    status: "active",
    email_verified: true,
    last_login: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    login_count: 134,
    created_at: "2023-12-15T09:30:00Z",
    updated_at: "2024-03-09T17:00:00Z",
  },
];

const statusConfig: Record<UserStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" }> = {
  active: { label: "Active", variant: "success" },
  inactive: { label: "Inactive", variant: "secondary" },
  blocked: { label: "Blocked", variant: "destructive" },
  pending: { label: "Pending", variant: "warning" },
};

const roleConfig: Record<UserRole, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" }> = {
  super_admin: { label: "Super Admin", variant: "destructive" },
  admin: { label: "Admin", variant: "default" },
  manager: { label: "Manager", variant: "info" },
  member: { label: "Member", variant: "secondary" },
  viewer: { label: "Viewer", variant: "outline" },
};

const PAGE_SIZE = 5;

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "all">("all");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Filter users based on search query and filters
  const filteredUsers = useMemo(() => {
    return mockUsers.filter((user) => {
      const matchesSearch =
        searchQuery === "" ||
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || user.status === statusFilter;

      const matchesRole =
        roleFilter === "all" || user.roles.includes(roleFilter);

      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [searchQuery, statusFilter, roleFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE);
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredUsers.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredUsers, currentPage]);

  // Reset to first page when filters change
  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-500 mt-1">
            Manage user accounts and permissions
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Filters Section */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search users by name or email..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  handleFilterChange();
                }}
                className="pl-10"
              />
            </div>

            {/* Status Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="min-w-[140px]">
                  <Filter className="h-4 w-4 mr-2" />
                  {statusFilter === "all" ? "All Status" : statusConfig[statusFilter].label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setStatusFilter("all");
                    handleFilterChange();
                  }}
                >
                  All Status
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {(Object.keys(statusConfig) as UserStatus[]).map((status) => (
                  <DropdownMenuItem
                    key={status}
                    onClick={() => {
                      setStatusFilter(status);
                      handleFilterChange();
                    }}
                  >
                    {statusConfig[status].label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Role Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="min-w-[140px]">
                  <Filter className="h-4 w-4 mr-2" />
                  {roleFilter === "all" ? "All Roles" : roleConfig[roleFilter].label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setRoleFilter("all");
                    handleFilterChange();
                  }}
                >
                  All Roles
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {(Object.keys(roleConfig) as UserRole[]).map((role) => (
                  <DropdownMenuItem
                    key={role}
                    onClick={() => {
                      setRoleFilter(role);
                      handleFilterChange();
                    }}
                  >
                    {roleConfig[role].label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Users ({filteredUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                    Name
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                    Email
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                    Role
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                    Last Login
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium text-sm overflow-hidden">
                          {user.picture ? (
                            <img
                              src={user.picture}
                              alt={user.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            user.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <span className="font-medium text-gray-900">
                          {user.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-gray-600">{user.email}</span>
                    </td>
                    <td className="py-4 px-4">
                      <Badge variant={statusConfig[user.status].variant}>
                        {statusConfig[user.status].label}
                      </Badge>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((role) => (
                          <Badge
                            key={role}
                            variant={roleConfig[role].variant}
                            className="text-xs"
                          >
                            {roleConfig[role].label}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-gray-500 text-sm">
                        {user.last_login
                          ? formatRelativeTime(user.last_login)
                          : "Never"}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/users/${user.id}`}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
                {paginatedUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <p className="text-gray-500">No users found</p>
                      <p className="text-gray-400 text-sm mt-1">
                        Try adjusting your search or filter criteria
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Showing {(currentPage - 1) * PAGE_SIZE + 1} to{" "}
                {Math.min(currentPage * PAGE_SIZE, filteredUsers.length)} of{" "}
                {filteredUsers.length} users
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "ghost"}
                        size="sm"
                        className="w-8 h-8 p-0"
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </Button>
                    )
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
