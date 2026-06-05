import React from "react";
import { Image as ImageIcon } from "lucide-react";

interface ImageContainerProps {
  imageUrl?: string;
  imageScale?: number;
  fullScreenMode?: "fill" | "stretch";
  isActive: boolean;
  showResizeHandle: boolean;
  imageAlign: "top" | "bottom" | "full";
  borderRadiusClass?: string; // e.g., "rounded-xl"
  borderClass?: string;       // e.g., "border border-border"
  onResizeStart?: (e: React.MouseEvent | React.TouchEvent) => void;
  onOpenMediaPicker?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function ImageContainer({
  imageUrl,
  imageScale = 1.0,
  fullScreenMode = "fill",
  isActive,
  showResizeHandle,
  imageAlign,
  borderRadiusClass = "rounded-xl",
  borderClass = "border border-border",
  onResizeStart,
  onOpenMediaPicker,
  className = "",
  style = {},
}: ImageContainerProps) {
  const hasImageUrl = !!imageUrl;

  if (!hasImageUrl) {
    if (isActive && onOpenMediaPicker) {
      return (
        <div 
          className={`w-full h-full overflow-hidden relative shrink-0 ${borderRadiusClass} ${borderClass} ${className}`}
          style={style}
        >
          <button
            type="button"
            onClick={onOpenMediaPicker}
            className="w-full h-full flex items-center justify-center gap-1.5 text-[9px] font-bold border border-dashed border-border bg-card hover:bg-accent text-muted-foreground transition-colors rounded-none"
          >
            <ImageIcon className="h-3.5 w-3.5" /> Add Image
          </button>
        </div>
      );
    }
    return null;
  }

  // Full Screen layout is rendered differently as a background backdrop
  if (imageAlign === "full") {
    return (
      <div 
        className={`absolute inset-0 z-0 pointer-events-none ${className}`} 
        style={style}
      >
        <img
          src={imageUrl}
          alt="fullscreen backdrop"
          style={{ transform: `scale(${imageScale})` }}
          className={`w-full h-full transition-transform duration-105 ${
            fullScreenMode === "stretch" ? "object-fill" : "object-cover"
          }`}
        />
        <div className="absolute inset-0 bg-black/45 backdrop-blur-[0.5px]" />
      </div>
    );
  }

  return (
    <div
      className={`w-full relative shrink-0 group overflow-hidden ${borderRadiusClass} ${borderClass} ${className}`}
      style={style}
    >
      <div className={`w-full h-full overflow-hidden flex items-center justify-center relative bg-muted ${borderRadiusClass}`}>
        <img
          src={imageUrl}
          alt="slide media"
          style={{ transform: `scale(${imageScale})` }}
          className={`transition-transform duration-105 ${
            fullScreenMode === "stretch" ? "w-full h-full object-fill" : "w-full h-full object-contain"
          }`}
        />
      </div>

      {isActive && showResizeHandle && onResizeStart && (
        <div
          onMouseDown={onResizeStart}
          onTouchStart={onResizeStart}
          className={`absolute left-0 right-0 h-8 flex items-center justify-center cursor-ns-resize group/resizer z-35 select-none no-swipe ${
            imageAlign === "top"
              ? "bottom-0 bg-gradient-to-t from-background/80 to-transparent"
              : "top-0 bg-gradient-to-b from-background/80 to-transparent"
          } hover:from-background transition-all`}
        >
          <div className="bg-popover text-[8px] font-black tracking-wider text-popover-foreground px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 select-none border border-border animate-fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
            DRAG TO RESIZE
          </div>
        </div>
      )}
    </div>
  );
}
