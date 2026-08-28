"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Users2,
  FileBarChart2,
  FolderOpen,
  Menu,
  Settings,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { QueryProvider } from "@/providers/query-provider";
import { useMeQuery } from "@/hooks/admin/useMeQuery";

const baseNavigation = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Courses", href: "/admin/courses", icon: BookOpen },
  { name: "Media Library", href: "/admin/media", icon: FolderOpen },
  { name: "Workers", href: "/admin/workers", icon: Users },
  { name: "Teams", href: "/admin/teams", icon: Users2 },
  { name: "Reports", href: "/admin/reports", icon: FileBarChart2 },
];
// Team management (invite/remove admins, assign roles) is org_admin-only —
// see app/api/admin/team/route.ts. The page 403s for jurisdiction_admin
// rather than rendering anything useful, so don't link to it for them.
const settingsNavItem = { name: "Settings", href: "/admin/settings/team", icon: Settings };

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isCourseEditor = pathname?.startsWith("/admin/courses/") && pathname !== "/admin/courses";

  if (isCourseEditor) {
    return (
      <QueryProvider>
        <div className="min-h-screen bg-background text-foreground font-sans transition-colors duration-300">
          <main className="w-full min-h-screen bg-background p-4 sm:p-6 transition-colors duration-300">
            <div className="w-full max-w-[1600px] mx-auto">
              {children}
            </div>
          </main>
        </div>
      </QueryProvider>
    );
  }

  return (
    <QueryProvider>
      <AdminLayoutContent pathname={pathname}>{children}</AdminLayoutContent>
    </QueryProvider>
  );
}

// useMeQuery() needs a QueryClientProvider ancestor, which only exists
// inside <QueryProvider> above — split out so this runs as its child,
// not alongside it in AdminLayout itself.
function AdminLayoutContent({
  pathname,
  children,
}: {
  pathname: string | null;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: me } = useMeQuery();
  const navigation = me?.role === "jurisdiction_admin" ? baseNavigation : [...baseNavigation, settingsNavItem];

  return (
      <div className="flex h-screen overflow-hidden bg-background text-foreground font-sans transition-colors duration-300">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-zinc-950/80 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Mobile Sidebar Container */}
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-[#E5E7EB] transition-all duration-300 ease-in-out lg:static lg:translate-x-0",
            "bg-[#F8F9FA] text-[#1B2A6B]", // Sidebar background is light gray, text color is brand navy
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {/* Sidebar Header */}
          <div className="flex h-24 items-center justify-between px-6 border-b border-[#E5E7EB]">
            <Link href="/admin" className="flex items-center gap-3">
              <Image
                src="/cool-cat_logo-color.svg"
                alt="Cool Cat Logo"
                width={72}
                height={72}
                className="object-contain"
              />
              <span className="text-lg font-bold tracking-tight text-[#1B2A6B]">
                Cool Cat Training
              </span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-1.5 text-[#1B2A6B]/60 hover:bg-[#1B2A6B]/5 hover:text-[#1B2A6B] lg:hidden cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Sidebar Nav */}
          <nav className="flex-1 space-y-1.5 px-4 py-6 overflow-y-auto">
            {navigation.map((item) => {
              const isActive =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname?.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-[#1B2A6B]/10 text-[#1B2A6B] shadow-sm border border-[#1B2A6B]/15"
                      : "text-[#1B2A6B]/70 hover:bg-[#1B2A6B]/5 hover:text-[#1B2A6B]"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 transition-transform duration-200",
                      isActive ? "text-[#1B2A6B]" : "text-[#1B2A6B]/60"
                    )}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="border-t border-[#E5E7EB] p-4 bg-[#1B2A6B]/5">
            <div className="flex items-center gap-3 px-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[#1B2A6B]/60 uppercase tracking-wider">
                  Role
                </p>
                <p className="text-sm font-bold text-[#1B2A6B] truncate">Safety Administrator</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Body */}
        <div className="flex flex-1 flex-col overflow-hidden bg-background">
          {/* Top Header - Seamless with Sidebar Header */}
          <header className="flex h-24 items-center justify-between border-b border-[#E5E7EB] bg-white px-6 transition-colors duration-300">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-[#1B2A6B] hover:bg-[#F8F9FA] lg:hidden cursor-pointer"
            >
              <Menu className="h-6 w-6" />
            </button>

            <div className="flex items-center gap-4 ml-auto">
              {/* Clerk User Button */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground hidden sm:block">
                  Admin Panel
                </span>
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: "h-9 w-9 border border-border hover:scale-105 transition-transform duration-200",
                    },
                  }}
                />
              </div>
            </div>
          </header>

          {/* Content Outlet */}
          <main className="flex-1 overflow-y-auto bg-background p-6 sm:p-8 transition-colors duration-300">
            <div className="max-w-7xl mx-auto space-y-6">
              {children}
            </div>
          </main>
        </div>
      </div>
  );
}
