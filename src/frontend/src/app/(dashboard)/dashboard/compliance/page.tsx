"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Shield,
  FileText,
  CheckCircle,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Mock data for compliance frameworks
const complianceFrameworks = [
  {
    id: "soc2",
    name: "SOC 2 Type II",
    version: "2017",
    compliancePercentage: 94,
    status: "compliant" as const,
    lastAudit: "2024-11-15",
    nextAudit: "2025-11-15",
    controlsPassed: 47,
    controlsTotal: 50,
  },
  {
    id: "gdpr",
    name: "GDPR",
    version: "2018",
    compliancePercentage: 88,
    status: "at-risk" as const,
    lastAudit: "2024-10-20",
    nextAudit: "2025-04-20",
    controlsPassed: 44,
    controlsTotal: 50,
  },
  {
    id: "hipaa",
    name: "HIPAA",
    version: "2013",
    compliancePercentage: 72,
    status: "non-compliant" as const,
    lastAudit: "2024-09-01",
    nextAudit: "2025-03-01",
    controlsPassed: 36,
    controlsTotal: 50,
  },
  {
    id: "iso27001",
    name: "ISO 27001",
    version: "2022",
    compliancePercentage: 91,
    status: "compliant" as const,
    lastAudit: "2024-12-01",
    nextAudit: "2025-12-01",
    controlsPassed: 91,
    controlsTotal: 100,
  },
];

const statusConfig = {
  compliant: {
    label: "Compliant",
    variant: "success" as const,
    icon: CheckCircle,
  },
  "at-risk": {
    label: "At Risk",
    variant: "warning" as const,
    icon: AlertTriangle,
  },
  "non-compliant": {
    label: "Non-Compliant",
    variant: "destructive" as const,
    icon: XCircle,
  },
};

function ProgressBar({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return "bg-green-500";
    if (percentage >= 75) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className={cn("w-full bg-gray-200 rounded-full h-2.5", className)}>
      <div
        className={cn("h-2.5 rounded-full transition-all", getProgressColor(value))}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

interface FrameworkCardProps {
  framework: (typeof complianceFrameworks)[0];
}

function FrameworkCard({ framework }: FrameworkCardProps) {
  const config = statusConfig[framework.status];
  const StatusIcon = config.icon;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Shield className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg">{framework.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Version {framework.version}
              </p>
            </div>
          </div>
          <Badge variant={config.variant} className="flex items-center gap-1">
            <StatusIcon className="h-3 w-3" />
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Compliance Score
            </span>
            <span className="text-sm font-bold text-gray-900">
              {framework.compliancePercentage}%
            </span>
          </div>
          <ProgressBar value={framework.compliancePercentage} />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Controls Passed</p>
            <p className="font-medium text-gray-900">
              {framework.controlsPassed} / {framework.controlsTotal}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Next Audit</p>
            <p className="font-medium text-gray-900">
              {new Date(framework.nextAudit).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        <Link
          href={`/dashboard/compliance/${framework.id}`}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
        >
          View Details
          <span aria-hidden="true">-&gt;</span>
        </Link>
      </CardContent>
    </Card>
  );
}

export default function CompliancePage() {
  const [isGenerating, setIsGenerating] = useState(false);

  // Calculate overall compliance score
  const overallScore = Math.round(
    complianceFrameworks.reduce((acc, f) => acc + f.compliancePercentage, 0) /
      complianceFrameworks.length
  );

  const compliantCount = complianceFrameworks.filter(
    (f) => f.status === "compliant"
  ).length;
  const atRiskCount = complianceFrameworks.filter(
    (f) => f.status === "at-risk"
  ).length;
  const nonCompliantCount = complianceFrameworks.filter(
    (f) => f.status === "non-compliant"
  ).length;

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    // Simulate report generation
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsGenerating(false);
    // In a real app, this would trigger a download or open a new tab
    alert("Compliance report generated successfully!");
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Compliance Dashboard
          </h1>
          <p className="text-gray-500 mt-1">
            Monitor your organization&apos;s compliance status across all frameworks.
          </p>
        </div>
        <Button
          onClick={handleGenerateReport}
          disabled={isGenerating}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          {isGenerating ? "Generating..." : "Generate Report"}
        </Button>
      </div>

      {/* Overall Compliance Score Card */}
      <Card className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <CardContent className="py-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-1">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/20 rounded-lg">
                  <TrendingUp className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-blue-100 text-sm">Overall Score</p>
                  <p className="text-4xl font-bold">{overallScore}%</p>
                </div>
              </div>
            </div>
            <div className="md:col-span-3 grid grid-cols-3 gap-4">
              <div className="bg-white/10 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <CheckCircle className="h-4 w-4 text-green-300" />
                  <span className="text-2xl font-bold">{compliantCount}</span>
                </div>
                <p className="text-blue-100 text-sm">Compliant</p>
              </div>
              <div className="bg-white/10 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4 text-yellow-300" />
                  <span className="text-2xl font-bold">{atRiskCount}</span>
                </div>
                <p className="text-blue-100 text-sm">At Risk</p>
              </div>
              <div className="bg-white/10 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <XCircle className="h-4 w-4 text-red-300" />
                  <span className="text-2xl font-bold">{nonCompliantCount}</span>
                </div>
                <p className="text-blue-100 text-sm">Non-Compliant</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Framework Cards Grid */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Compliance Frameworks
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {complianceFrameworks.map((framework) => (
            <FrameworkCard key={framework.id} framework={framework} />
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-500" />
            Recent Compliance Activities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              {
                action: "SOC 2 control review completed",
                framework: "SOC 2",
                time: "2 hours ago",
              },
              {
                action: "GDPR data mapping updated",
                framework: "GDPR",
                time: "5 hours ago",
              },
              {
                action: "HIPAA risk assessment initiated",
                framework: "HIPAA",
                time: "1 day ago",
              },
              {
                action: "ISO 27001 audit documentation uploaded",
                framework: "ISO 27001",
                time: "2 days ago",
              },
            ].map((activity, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {activity.action}
                  </p>
                  <p className="text-xs text-gray-500">{activity.framework}</p>
                </div>
                <span className="text-xs text-gray-400">{activity.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
