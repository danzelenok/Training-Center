"use client";

import React from "react";

interface SlideHeadingProps {
  value: string;
  isActive: boolean;
  onChange: (val: string) => void;
  hasBody?: boolean;
  hasImage?: boolean;
  placeholder?: string;
  readOnly?: boolean;
}

export function SlideHeading({
  value,
  isActive,
  onChange,
  hasBody = false,
  hasImage = false,
  placeholder = "Enter Slide Title",
  readOnly = false,
}: SlideHeadingProps) {
  const len = value.length;

  let className =
    "font-black text-left resize-none bg-transparent focus:outline-none leading-snug shrink-0 w-full p-0 border-0 focus:ring-0 overflow-y-auto scrollbar-none max-h-full text-foreground placeholder-muted-foreground/40";

  if (!hasBody && !hasImage) {
    if (len < 40) className += " text-4xl md:text-5xl";
    else if (len < 120) className += " text-3xl md:text-4xl";
    else className += " text-2xl md:text-3xl";
  } else {
    if (len < 30) className += " text-2xl md:text-3xl";
    else className += " text-xl md:text-2xl";
  }

  if (readOnly) {
    return <p className={className}>{value}</p>;
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
    />
  );
}
