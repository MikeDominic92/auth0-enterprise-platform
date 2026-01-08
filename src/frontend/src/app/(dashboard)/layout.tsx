"use client";

import { UserProvider } from "@auth0/nextjs-auth0/client";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <UserProvider>
      <div className="min-h-screen bg-gray-50">
        <div className="flex">
          {/* Sidebar */}
          <Sidebar />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-h-screen">
            {/* Header */}
            <Header />

            {/* Page Content */}
            <main className="flex-1 p-4 lg:p-6">
              <div className="max-w-7xl mx-auto">{children}</div>
            </main>

            {/* Footer */}
            <footer className="border-t border-gray-200 bg-white px-4 lg:px-6 py-4">
              <div className="max-w-7xl mx-auto">
                <p className="text-sm text-gray-500 text-center">
                  Admin Portal - Built with Next.js and Auth0
                </p>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </UserProvider>
  );
}
