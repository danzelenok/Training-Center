"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const settingsTabs = [
  { name: "Team", href: "/admin/settings/team" },
  { name: "Reminders", href: "/admin/settings/reminders" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <nav className="flex gap-1.5 border-b border-border pb-3">
        {settingsTabs.map((tab) => {
          const isActive = pathname?.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-[#1B2A6B]/10 text-[#1B2A6B] dark:text-[#C8D400] shadow-sm border border-[#1B2A6B]/15"
                  : "text-muted-foreground hover:bg-[#1B2A6B]/5 hover:text-[#1B2A6B] dark:hover:text-[#C8D400]"
              )}
            >
              {tab.name}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
