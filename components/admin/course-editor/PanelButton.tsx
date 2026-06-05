"use client";

import React from "react";

type PanelButtonVariant = "brand" | "primary" | "dark";

interface PanelButtonProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  badge?: number | string;
  variant?: PanelButtonVariant;
}

const ACTIVE_CLASSES: Record<PanelButtonVariant, string> = {
  brand: "bg-[#C8D400] text-[#1B2A6B] border-[#C8D400]",
  primary: "bg-primary text-primary-foreground border-primary",
  dark: "bg-[#1B2A6B] text-white border-[#1B2A6B]",
};

export function PanelButton({
  icon,
  label,
  isActive,
  onClick,
  badge,
  variant = "brand",
}: PanelButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`relative h-9 w-9 rounded-full flex items-center justify-center transition-all border-2 shrink-0 cursor-pointer ${
        isActive
          ? ACTIVE_CLASSES[variant]
          : "border-border text-foreground hover:bg-accent hover:text-accent-foreground"
      }`}
    >
      {icon}
      {badge != null && (
        <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center bg-black text-white text-[9px] font-black border border-background">
          {badge}
        </span>
      )}
    </button>
  );
}

export function PanelDivider() {
  return <div className="w-px h-5 bg-border shrink-0" />;
}
