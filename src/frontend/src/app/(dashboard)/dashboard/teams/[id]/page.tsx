"use client";

import { use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Users2,
  Edit,
  UserPlus,
  MoreVertical,
  Mail,
  Calendar,
  Shield,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Mock data for team details
const mockTeamDetails: Record<string, TeamDetail> = {
  "team-1": {
    id: "team-1",
    name: "Engineering",
    type: "department",
    description:
      "Core engineering team responsible for product development, infrastructure, and technical excellence. We build and maintain the core platform services.",
    memberCount: 24,
    status: "active",
    createdAt: "2024-01-15",
    members: [
      {
        id: "user-1",
        name: "Sarah Chen",
        email: "sarah.chen@example.com",
        role: "owner",
        avatar: null,
        joinedAt: "2024-01-15",
      },
      {
        id: "user-2",
        name: "Michael Rodriguez",
        email: "michael.r@example.com",
        role: "admin",
        avatar: null,
        joinedAt: "2024-01-16",
      },
      {
        id: "user-3",
        name: "Emily Watson",
        email: "emily.w@example.com",
        role: "member",
        avatar: null,
        joinedAt: "2024-01-20",
      },
      {
        id: "user-4",
        name: "James Park",
        email: "james.p@example.com",
        role: "member",
        avatar: null,
        joinedAt: "2024-02-01",
      },
      {
        id: "user-5",
        name: "Lisa Thompson",
        email: "lisa.t@example.com",
        role: "member",
        avatar: null,
        joinedAt: "2024-02-15",
      },
    ],
  },
  "team-2": {
    id: "team-2",
    name: "Marketing",
    type: "department",
    description:
      "Marketing and brand management team responsible for growth, brand awareness, and customer acquisition strategies.",
    memberCount: 12,
    status: "active",
    createdAt: "2024-02-01",
    members: [
      {
        id: "user-6",
        name: "David Kim",
        email: "david.k@example.com",
        role: "owner",
        avatar: null,
        joinedAt: "2024-02-01",
      },
      {
        id: "user-7",
        name: "Amanda Foster",
        email: "amanda.f@example.com",
        role: "admin",
        avatar: null,
        joinedAt: "2024-02-05",
      },
      {
        id: "user-8",
        name: "Robert Brown",
        email: "robert.b@example.com",
        role: "member",
        avatar: null,
        joinedAt: "2024-02-10",
      },
    ],
  },
};

// Default mock team for IDs not in our mock data
const defaultTeam: TeamDetail = {
  id: "default",
  name: "Team Not Found",
  type: "project",
  description: "This team could not be found or you do not have access to it.",
  memberCount: 0,
  status: "inactive",
  createdAt: "2024-01-01",
  members: [],
};

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
  avatar: string | null;
  joinedAt: string;
}

interface TeamDetail {
  id: string;
  name: string;
  type: string;
  description: string;
  memberCount: number;
  status: string;
  createdAt: string;
  members: TeamMember[];
}

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case "active":
      return "success";
    case "inactive":
      return "secondary";
    default:
      return "outline";
  }
}

function getTypeBadgeVariant(type: string) {
  switch (type) {
    case "department":
      return "default";
    case "project":
      return "info";
    case "functional":
      return "warning";
    default:
      return "outline";
  }
}

function getRoleBadgeVariant(role: string) {
  switch (role) {
    case "owner":
      return "destructive";
    case "admin":
      return "default";
    case "member":
      return "secondary";
    default:
      return "outline";
  }
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function TeamDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const team = mockTeamDetails[id] || { ...defaultTeam, id };

  return (
    <div className="space-y-6">
      {/* Back Navigation */}
      <Link
        href="/dashboard/teams"
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Teams
      </Link>

      {/* Team Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <Users2 className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <CardTitle className="text-2xl">{team.name}</CardTitle>
                  <Badge variant={getTypeBadgeVariant(team.type)}>
                    {team.type}
                  </Badge>
                  <Badge variant={getStatusBadgeVariant(team.status)}>
                    {team.status}
                  </Badge>
                </div>
                <p className="text-gray-500 mt-2 max-w-2xl">{team.description}</p>
                <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Users2 className="h-4 w-4" />
                    {team.members.length} members
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Created {formatDate(team.createdAt)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                Edit Team
              </Button>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Member
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Members Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Team Members</CardTitle>
            <span className="text-sm text-gray-500">
              {team.members.length} members
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {team.members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Users2 className="h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No members yet</h3>
              <p className="text-gray-500 mt-1">
                Add members to this team to get started.
              </p>
              <Button className="mt-4">
                <UserPlus className="h-4 w-4 mr-2" />
                Add Member
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {team.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      {member.avatar ? (
                        <AvatarImage src={member.avatar} alt={member.name} />
                      ) : null}
                      <AvatarFallback className="bg-blue-100 text-blue-600">
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{member.name}</p>
                        <Badge variant={getRoleBadgeVariant(member.role)}>
                          {member.role}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Mail className="h-3 w-3" />
                        {member.email}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 hidden sm:block">
                      Joined {formatDate(member.joinedAt)}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Shield className="h-4 w-4 mr-2" />
                          Change Role
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Mail className="h-4 w-4 mr-2" />
                          Send Email
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600">
                          Remove from Team
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
