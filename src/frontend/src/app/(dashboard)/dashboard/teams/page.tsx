"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Plus, Users2, ChevronDown, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Mock data for teams
const mockTeams = [
  {
    id: "team-1",
    name: "Engineering",
    type: "department",
    description: "Core engineering team responsible for product development",
    memberCount: 24,
    status: "active",
    createdAt: "2024-01-15",
  },
  {
    id: "team-2",
    name: "Marketing",
    type: "department",
    description: "Marketing and brand management team",
    memberCount: 12,
    status: "active",
    createdAt: "2024-02-01",
  },
  {
    id: "team-3",
    name: "Project Alpha",
    type: "project",
    description: "Cross-functional team for Project Alpha initiative",
    memberCount: 8,
    status: "active",
    createdAt: "2024-03-10",
  },
  {
    id: "team-4",
    name: "Customer Success",
    type: "department",
    description: "Customer support and success team",
    memberCount: 15,
    status: "active",
    createdAt: "2024-01-20",
  },
  {
    id: "team-5",
    name: "Design System",
    type: "project",
    description: "Team responsible for the company design system",
    memberCount: 6,
    status: "inactive",
    createdAt: "2024-02-15",
  },
  {
    id: "team-6",
    name: "Security",
    type: "functional",
    description: "Information security and compliance team",
    memberCount: 5,
    status: "active",
    createdAt: "2024-01-05",
  },
  {
    id: "team-7",
    name: "Data Analytics",
    type: "functional",
    description: "Business intelligence and data analytics team",
    memberCount: 9,
    status: "active",
    createdAt: "2024-03-01",
  },
  {
    id: "team-8",
    name: "Legacy Migration",
    type: "project",
    description: "Team handling legacy system migration",
    memberCount: 4,
    status: "inactive",
    createdAt: "2023-11-01",
  },
];

const teamTypes = ["all", "department", "project", "functional"] as const;
type TeamType = (typeof teamTypes)[number];

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

export default function TeamsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TeamType>("all");

  const filteredTeams = useMemo(() => {
    return mockTeams.filter((team) => {
      const matchesSearch =
        team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        team.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === "all" || team.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [searchQuery, typeFilter]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teams</h1>
          <p className="text-gray-500 mt-1">
            Manage and organize your teams and their members.
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Team
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search teams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto">
              <Filter className="h-4 w-4 mr-2" />
              {typeFilter === "all" ? "All Types" : typeFilter.charAt(0).toUpperCase() + typeFilter.slice(1)}
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {teamTypes.map((type) => (
              <DropdownMenuItem
                key={type}
                onClick={() => setTypeFilter(type)}
                className={cn(typeFilter === type && "bg-accent")}
              >
                {type === "all" ? "All Types" : type.charAt(0).toUpperCase() + type.slice(1)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Teams Grid */}
      {filteredTeams.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users2 className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No teams found</h3>
            <p className="text-gray-500 mt-1">
              {searchQuery || typeFilter !== "all"
                ? "Try adjusting your search or filter criteria."
                : "Get started by creating your first team."}
            </p>
            {!searchQuery && typeFilter === "all" && (
              <Button className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Create Team
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeams.map((team) => (
            <Link key={team.id} href={`/dashboard/teams/${team.id}`}>
              <Card className="hover:border-blue-300 hover:shadow-md transition-all cursor-pointer h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <Users2 className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{team.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={getTypeBadgeVariant(team.type)}>
                            {team.type}
                          </Badge>
                          <Badge variant={getStatusBadgeVariant(team.status)}>
                            {team.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-500 line-clamp-2 mb-4">
                    {team.description}
                  </p>
                  <div className="flex items-center text-sm text-gray-600">
                    <Users2 className="h-4 w-4 mr-1" />
                    {team.memberCount} {team.memberCount === 1 ? "member" : "members"}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Results summary */}
      {filteredTeams.length > 0 && (
        <p className="text-sm text-gray-500">
          Showing {filteredTeams.length} of {mockTeams.length} teams
        </p>
      )}
    </div>
  );
}
