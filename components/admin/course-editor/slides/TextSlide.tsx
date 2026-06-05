import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { AlertTriangle, X, ZoomIn, ZoomOut, PanelTop, PanelBottom, Maximize2, RefreshCw, Trash2, Type, FileText, Image as ImageIcon, Crop, Expand } from "lucide-react";
import { Slide } from "../CardCanvas";
import { ImageContainer } from "../ImageContainer";
import { SlideHeading } from "../SlideHeading";
import { SlideBody } from "../SlideBody";
import { ControlPanel } from "../ControlPanel";
import { PanelButton } from "../PanelButton";

interface TextCardProps {
  slide: Slide;
  isActive: boolean;
  index: number;
  onUpdateSlideContent: (idx: number, updatedFields: any) => void;
  draggedIdx: number | null;
  cardStyle?: React.CSSProperties;
  handleResizeStart: (
    e: React.MouseEvent | React.TouchEvent,
    idx: number,
    align: "top" | "bottom",
    currentVolume: number
  ) => void;
}

export function TextCard({
  slide,
  isActive,
  index,
  onUpdateSlideContent,
  draggedIdx,
  cardStyle,
  handleResizeStart,
}: TextCardProps) {
  const content = slide.content || {};
  const showHeading = content.showHeading !== false;
  const showBody = content.showBody !== false;
  const imageScale = content.imageScale ?? 1.0;
  const imageVolume = content.imageVolume ?? 40;
  const imageAlign = content.imageAlign ?? "top";
  const fullScreenMode = content.fullScreenMode ?? "fill";
  const hasImage = !!content.imageUrl || !!content.url;
  const activeImageUrl = content.imageUrl || content.url || "";

  const headingText = content.heading || content.title || "";
  const bodyText = content.body || content.text || "";

  const [warningCollapsed, setWarningCollapsed] = useState(false);

  useEffect(() => {
    if (!isActive) setWarningCollapsed(false);
  }, [isActive]);

  // Overflow limits (Adaptive Capacity Model)
  let headingLimit = showHeading && showBody ? 120 : showHeading ? 320 : 280;
  let bodyLimit = showHeading && showBody ? 450 : showBody ? 700 : 600;
  if (hasImage) {
    const t = 100 - imageVolume;
    if (showHeading && showBody) { headingLimit = Math.max(40, Math.round(t * 1.2)); bodyLimit = Math.max(100, Math.round(t * 3.5)); }
    else if (showHeading) { headingLimit = Math.max(60, Math.round(t * 2.5)); }
    else if (showBody) { bodyLimit = Math.max(120, Math.round(t * 6.0)); }
  }
  const isOverflow = headingText.length > headingLimit || bodyText.length > bodyLimit;

  const textElements = (
    <div className="flex-1 flex flex-col justify-center items-center text-center px-1 pt-8 pb-4 space-y-1.5 min-h-0 w-full z-10 relative">
      {isActive && isOverflow && (
        <>
          <button
            type="button"
            onClick={() => setWarningCollapsed(false)}
            className={`absolute top-2 right-[42px] z-45 p-1.5 rounded-lg border border-amber-500 bg-amber-500 hover:bg-amber-600 text-neutral-900 transition-all duration-300 active:scale-90 hover:scale-105 cursor-pointer no-swipe select-none ${warningCollapsed ? "scale-100 opacity-100" : "scale-0 opacity-0 pointer-events-none"}`}
            title="Expand Layout Caution"
          >
            <AlertTriangle className="h-3 w-3 shrink-0" />
          </button>
          <div className={`absolute top-11 inset-x-3.5 z-50 p-4 rounded-2xl shadow-2xl border border-amber-500/30 bg-popover text-popover-foreground backdrop-blur-md select-none no-swipe transition-all duration-300 origin-top text-left ${!warningCollapsed ? "scale-100 opacity-100" : "scale-0 opacity-0 pointer-events-none"}`}>
            <button type="button" onClick={() => setWarningCollapsed(true)} className="absolute top-2.5 right-3 p-1 rounded-lg cursor-pointer transition-colors duration-150 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted" title="Collapse Warning">
              <X className="h-3 w-3" />
            </button>
            <div className="flex items-center gap-2 mb-1.5 pr-6">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <span className="text-[10px] font-black text-amber-500 tracking-wider uppercase">UX Caution</span>
            </div>
            <p className="text-[9px] leading-relaxed font-sans text-muted-foreground pr-1">
              This content exceeds the Stories layout vertical limits. Shorten your text or split it into a new slide to prevent clipping on mobile devices.
            </p>
          </div>
        </>
      )}
      {showHeading && (
        <div className="w-full flex flex-col items-center shrink-0">
          <SlideHeading
            value={headingText}
            isActive={isActive}
            onChange={(val) => onUpdateSlideContent(index, { heading: val, title: val })}
            hasBody={showBody}
            hasImage={hasImage}
          />
        </div>
      )}
      {showBody && (
        <div className="w-full flex flex-col items-center min-h-0">
          <SlideBody
            value={bodyText}
            isActive={isActive}
            onChange={(val) => onUpdateSlideContent(index, { body: val, text: val })}
            hasHeading={showHeading}
            hasImage={hasImage}
          />
        </div>
      )}
    </div>
  );

  const mediaElement = hasImage && (
    <ImageContainer
      imageUrl={activeImageUrl}
      imageScale={imageScale}
      fullScreenMode={fullScreenMode}
      isActive={isActive}
      showResizeHandle={isActive}
      imageAlign={imageAlign as "top" | "bottom" | "full"}
      onResizeStart={(e) => handleResizeStart(e, index, imageAlign as "top" | "bottom", imageVolume)}
      style={{ height: `${imageVolume}%` }}
    />
  );

  return (
    <Card
      style={cardStyle}
      className={`rounded-[24px] overflow-hidden flex flex-col px-7 py-4 absolute top-0 left-0 w-[300px] md:w-[330px] lg:w-[350px] h-[530px] md:h-[585px] lg:h-[620px] origin-top-left select-none border border-border/80 shadow-md transition-all duration-300 z-0 relative ${
        !isActive && draggedIdx === null ? "pointer-events-none" : ""
      } ${draggedIdx !== null ? "scale-[0.37] pointer-events-none" : "scale-100"}`}
    >
      {hasImage && imageAlign === "full" && (
        <ImageContainer
          imageUrl={activeImageUrl}
          imageScale={imageScale}
          fullScreenMode={fullScreenMode}
          isActive={isActive}
          showResizeHandle={false}
          imageAlign="full"
        />
      )}

      <div className="flex-1 flex flex-col min-h-0 relative z-20 font-sans mt-1">
        {hasImage && imageAlign === "full" ? (
          <div className="flex-1 flex flex-col justify-center items-center p-2 relative z-10 h-full w-full">
            {textElements}
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-between min-h-0 py-1 space-y-2 relative z-10">
            {imageAlign === "top" ? (
              <>
                {mediaElement}
                {textElements}
              </>
            ) : (
              <>
                {textElements}
                {mediaElement}
              </>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

interface TextToolbarProps {
  slide: Slide;
  index: number;
  onUpdateSlideContent: (idx: number, updatedFields: any) => void;
  onOpenMediaPicker: () => void;
  imageToolsOpen: boolean;
  setImageToolsOpen: (val: boolean) => void;
}

export function TextToolbar({
  slide,
  index,
  onUpdateSlideContent,
  onOpenMediaPicker,
  imageToolsOpen,
  setImageToolsOpen,
}: TextToolbarProps) {
  const content = slide.content || {};
  const showHeading = content.showHeading !== false;
  const showBody = content.showBody !== false;
  const imageScale = content.imageScale ?? 1.0;
  const imageAlign = content.imageAlign ?? "top";
  const fullScreenMode = content.fullScreenMode ?? "fill";
  const hasImage = !!content.imageUrl || !!content.url;

  return (
    <ControlPanel
      below={hasImage && imageToolsOpen ? (
        <div className="w-full max-w-xs border rounded-2xl p-3 shadow-2xl z-20 gap-3 mt-1.5 animate-slide-up flex flex-col no-swipe backdrop-blur-md bg-popover text-popover-foreground border-border">
          <div className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl border bg-muted border-border">
            <ZoomOut className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={imageScale}
              onChange={(e) => onUpdateSlideContent(index, { imageScale: parseFloat(e.target.value) })}
              className="flex-1 h-1 rounded-lg appearance-none cursor-pointer accent-primary bg-muted-foreground/30"
              title="Zoom"
            />
            <ZoomIn className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="text-[10px] font-black text-primary w-8 text-right shrink-0">
              {Math.round(imageScale * 100)}%
            </span>
          </div>

          <div className="flex items-center gap-2 justify-between w-full">
            <div className="flex items-center gap-1 p-1 rounded-xl border bg-muted border-border">
              <button
                type="button"
                onClick={() => onUpdateSlideContent(index, { imageAlign: "top" })}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  imageAlign === "top" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                title="Image at Top"
              >
                <PanelTop className="h-4 w-4 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => onUpdateSlideContent(index, { imageAlign: "bottom" })}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  imageAlign === "bottom" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                title="Image at Bottom"
              >
                <PanelBottom className="h-4 w-4 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => onUpdateSlideContent(index, { imageAlign: "full" })}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  imageAlign === "full" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                title="Full Screen"
              >
                <Maximize2 className="h-4 w-4 shrink-0" />
              </button>
            </div>

            <div className={`flex items-center gap-1 p-1 rounded-xl border bg-muted border-border ${imageAlign !== "full" ? "invisible" : ""}`}>
              <button
                type="button"
                onClick={() => onUpdateSlideContent(index, { fullScreenMode: "fill" })}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  fullScreenMode === "fill" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                title="Cover"
              >
                <Crop className="h-4 w-4 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => onUpdateSlideContent(index, { fullScreenMode: "stretch" })}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  fullScreenMode === "stretch" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                title="Stretch"
              >
                <Expand className="h-4 w-4 shrink-0" />
              </button>
            </div>

            <div className="flex items-center gap-1.5 ml-auto">
              <button
                type="button"
                onClick={onOpenMediaPicker}
                className="p-1.5 border border-border rounded-xl bg-card hover:bg-accent text-card-foreground transition-all cursor-pointer"
                title="Change Image"
              >
                <RefreshCw className="h-4 w-4 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateSlideContent(index, {
                    imageUrl: undefined,
                    url: undefined,
                    imageScale: undefined,
                    imageVolume: undefined,
                    imageAlign: undefined,
                    fullScreenMode: undefined,
                  })
                }
                className="p-1.5 border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 rounded-xl text-destructive transition-all cursor-pointer"
                title="Remove Image"
              >
                <Trash2 className="h-4 w-4 shrink-0" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    >
      <PanelButton
        icon={<Type className="h-4.5 w-4.5 shrink-0" />}
        label={showHeading ? "Disable Title" : "Enable Title"}
        isActive={showHeading}
        onClick={() => onUpdateSlideContent(index, { showHeading: !showHeading })}
        variant="primary"
      />
      <PanelButton
        icon={<FileText className="h-4.5 w-4.5 shrink-0" />}
        label={showBody ? "Disable Text" : "Enable Text"}
        isActive={showBody}
        onClick={() => onUpdateSlideContent(index, { showBody: !showBody })}
        variant="primary"
      />
      <PanelButton
        icon={<ImageIcon className="h-4.5 w-4.5 shrink-0" />}
        label={hasImage ? "Toggle Image Config Options" : "Add Image / animated GIF"}
        isActive={imageToolsOpen}
        onClick={() => {
          if (hasImage) {
            setImageToolsOpen(!imageToolsOpen);
          } else {
            onOpenMediaPicker();
          }
        }}
        variant="primary"
      />
    </ControlPanel>
  );
}
