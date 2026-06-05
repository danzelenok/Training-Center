"use client";

import React from "react";

interface ControlPanelProps {
  children: React.ReactNode;
  hint?: string;
  below?: React.ReactNode;
}

/**
 * Floating pill container that wraps panel control buttons for any slide type.
 * Position it directly under the card; `below` renders expandable sub-panels.
 *
 * Usage:
 *   <ControlPanel>
 *     <PanelButton ... />
 *     <PanelButton ... />
 *   </ControlPanel>
 *
 * With config-driven buttons:
 *   const enabledButtons = ['text', 'quiz', 'dialog'] as const;
 *   <ControlPanel>
 *     {enabledButtons.map(key => BUTTON_MAP[key])}
 *   </ControlPanel>
 */
export function ControlPanel({ children, hint, below }: ControlPanelProps) {
  return (
    <div className="flex flex-col items-center justify-center w-full z-20 gap-2 mb-2 mt-[-16px] animate-fade-in no-swipe">
      <div className="flex gap-3 justify-center items-center py-1.5 px-4 bg-background border border-border shadow-lg rounded-full backdrop-blur-md">
        {children}
      </div>
      {hint && (
        <p className="text-[10px] text-muted-foreground/85 font-sans tracking-wide">{hint}</p>
      )}
      {below}
    </div>
  );
}
