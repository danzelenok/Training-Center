"use client";

import React from "react";

interface SlideBodyProps {
  value: string;
  isActive: boolean;
  onChange: (val: string) => void;
  hasHeading?: boolean;
  hasImage?: boolean;
  placeholder?: string;
  readOnly?: boolean;
  // Theme System v2 — undefined for a legacy (non-palette) course, which
  // keeps the existing font-sans class untouched.
  fontFamily?: string;
  color?: string;
}

export function SlideBody({
  value,
  isActive,
  onChange,
  hasHeading = false,
  hasImage = false,
  placeholder = "Enter description text here...",
  readOnly = false,
  fontFamily,
  color,
}: SlideBodyProps) {
  const themeStyle: React.CSSProperties = { fontFamily, color };
  const len = value.length;

  let className =
    "font-sans font-medium text-left resize-none bg-transparent focus:outline-none leading-relaxed w-full p-0 border-0 focus:ring-0 overflow-y-auto scrollbar-none max-h-full text-foreground placeholder-muted-foreground/40 whitespace-pre-wrap";

  if (!hasHeading && !hasImage) {
    if (len < 100) className += " text-xl md:text-2xl";
    else if (len < 300) className += " text-lg md:text-xl";
    else className += " text-base md:text-lg";
  } else {
    if (len < 80) className += " text-lg md:text-xl";
    else className += " text-base md:text-lg";
  }

  if (readOnly) {
    return <p className={className} style={themeStyle}>{value}</p>;
  }

  return (
    <textarea
      ref={(node) => {
        if (node) {
          node.style.height = "auto";
          node.style.height = `${node.scrollHeight}px`;
        }
      }}
      disabled={!isActive}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={1}
      className={className}
      style={themeStyle}
    />
  );
}
