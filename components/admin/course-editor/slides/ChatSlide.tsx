import React, { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import {
  Crop,
  Expand,
  FileText,
  GripHorizontal,
  Image as ImageIcon,
  Maximize2,
  PanelBottom,
  PanelTop,
  RefreshCw,
  Trash2,
  ZoomIn,
  ZoomOut,
  MessageSquare,
  Plus,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { Slide } from "../CardCanvas";
import { ImageContainer } from "../ImageContainer";
import { ControlPanel } from "../ControlPanel";
import { PanelButton } from "../PanelButton";

interface ChatCardProps {
  slide: Slide;
  index: number;
  isActive: boolean;
  onUpdateSlideContent: (idx: number, updatedFields: any) => void;
  onOpenMediaPicker: () => void;
  draggedIdx: number | null;
  cardStyle?: React.CSSProperties;
  handleChatResizeStart: (
    e: React.MouseEvent | React.TouchEvent,
    idx: number,
    currentVolume: number
  ) => void;
  selectedBubbleIdx?: number | null;
  setSelectedBubbleIdx?: (idx: number | null) => void;
  chatBubblesToolsOpen?: boolean;
  mode?: "edit" | "play";
  onCompleted?: () => void;
}

export function ChatCard({
  slide,
  index,
  isActive,
  onUpdateSlideContent,
  onOpenMediaPicker,
  draggedIdx,
  cardStyle,
  handleChatResizeStart,
  selectedBubbleIdx,
  setSelectedBubbleIdx,
  chatBubblesToolsOpen = false,
  mode,
  onCompleted,
}: ChatCardProps) {
  const content = slide.content || {};

  const [visibleCount, setVisibleCount] = useState(0);
  const bubblesRef = useRef<any[]>([]);

  useEffect(() => {
    if (mode !== "play") return;
    const bubbles = content.chatBubbles || [];
    bubblesRef.current = bubbles;
    setVisibleCount(0);

    bubbles.forEach((_: any, i: number) => {
      setTimeout(() => {
        setVisibleCount(i + 1);

        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 880;
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.12);
        } catch {}

        if (i === bubbles.length - 1) {
          setTimeout(() => onCompleted?.(), 1500);
        }
      }, i * 900);
    });
  }, [mode]);

  const chatVolume = content.chatVolume ?? 100;
  const belowType = content.belowType || "none";
  const hasBelow = chatVolume < 98;
  const imageAlign = content.imageAlign ?? "bottom";
  const hasImageUrl = !!(content.imageUrl || content.url);
  const isFullBg = imageAlign === "full" && belowType === "image";
  const isImageTop = imageAlign === "top" && belowType === "image";

  const updateContent = (fields: any) => {
    onUpdateSlideContent(index, fields);
  };

  const dragHandle = isActive && mode !== "play" && belowType === "text" && !isFullBg ? (
    <div
      onMouseDown={(e) => handleChatResizeStart(e, index, chatVolume)}
      onTouchStart={(e) => handleChatResizeStart(e, index, chatVolume)}
      className="shrink-0 h-7 flex items-center justify-center cursor-ns-resize z-30 select-none no-swipe bg-gradient-to-t from-black/10 to-transparent hover:from-black/25 transition-all"
    >
      <div className="text-[7px] font-black tracking-wider px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 border bg-popover border-border text-popover-foreground">
        <GripHorizontal className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
        DRAG TO RESIZE
      </div>
    </div>
  ) : null;

  const imageSection = (
    <ImageContainer
      imageUrl={content.imageUrl || content.url}
      imageScale={content.imageScale ?? 1.0}
      fullScreenMode={content.fullScreenMode}
      isActive={isActive}
      showResizeHandle={isActive && belowType === "image" && mode !== "play"}
      imageAlign={isImageTop ? "top" : "bottom"}
      borderRadiusClass={isImageTop ? "rounded-none" : "rounded-xl"}
      borderClass={isImageTop ? "border-none" : "border border-border"}
      onResizeStart={(e) => handleChatResizeStart(e, index, chatVolume)}
      onOpenMediaPicker={onOpenMediaPicker}
      className="w-full h-full"
    />
  );

  const chatBubbles = mode === "play" ? (
    <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 px-2.5 pt-4 pb-4 scrollbar-none min-h-0">
      {(content.chatBubbles || []).slice(0, visibleCount).map((bubble: any, bIdx: number) => {
        const isLeft = bubble.align === "left";
        return (
          <div
            key={bubble.id || bIdx}
            className={`flex flex-col max-w-[78%] ${isLeft ? "self-start" : "self-end ml-auto"}`}
            style={{ animation: "bubblePop 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards" }}
          >
            {bubble.type === "text" && (
              <div className={`px-3 py-2 text-[10px] md:text-xs leading-snug rounded-2xl shadow-sm select-none ${
                isLeft
                  ? "bg-card text-card-foreground border border-border"
                  : "bg-primary text-primary-foreground"
              }`}>
                {bubble.text}
              </div>
            )}
            {bubble.type === "image" && bubble.url && (
              <div className={`p-0.5 rounded-2xl overflow-hidden shadow-sm ${isLeft ? "bg-card border border-border" : "bg-primary"}`}>
                <img src={bubble.url} alt="" className="w-[110px] aspect-video object-cover rounded-xl" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  ) : (
    <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 px-2.5 pt-4 pb-4 scrollbar-none min-h-0">
      {(content.chatBubbles || []).map((bubble: any, bIdx: number) => {
        const isLeft = bubble.align === "left";
        return (
          <div
            key={bubble.id || bIdx}
            className={`flex flex-col max-w-[78%] relative group/chatbubble ${
              isLeft ? "self-start" : "self-end ml-auto"
            }`}
          >
            {bubble.type === "text" && (
              <textarea
                readOnly={chatBubblesToolsOpen}
                disabled={!isActive}
                value={bubble.text || ""}
                onClick={() => setSelectedBubbleIdx?.(bIdx)}
                onFocus={() => setSelectedBubbleIdx?.(bIdx)}
                onChange={(e) => {
                  e.target.style.height = "0px";
                  e.target.style.height = `${e.target.scrollHeight}px`;
                  const updatedBubbles = [...(content.chatBubbles || [])];
                  updatedBubbles[bIdx] = { ...updatedBubbles[bIdx], text: e.target.value };
                  updateContent({ chatBubbles: updatedBubbles });
                }}
                placeholder="Type message..."
                rows={1}
                ref={(node) => {
                  if (node) {
                    node.style.height = "0px";
                    node.style.height = `${node.scrollHeight}px`;
                  }
                }}
                className={`px-3 py-2 text-[10px] md:text-xs leading-snug focus:outline-none resize-none overflow-hidden w-full shadow-sm rounded-2xl transition-all duration-200 ${
                  isLeft
                    ? "bg-card text-card-foreground placeholder-muted-foreground/40 border border-border focus:ring-1 focus:ring-primary/50"
                    : "bg-primary text-primary-foreground placeholder-primary-foreground/45 border border-primary/20 focus:ring-1 focus:ring-white/55"
                } ${
                  chatBubblesToolsOpen ? "cursor-pointer select-none" : ""
                } ${
                  selectedBubbleIdx === bIdx
                    ? "ring-2 ring-[#C8D400] shadow-[0_0_10px_rgba(200,212,0,0.5)] border-[#C8D400] animate-bubble-select scale-[1.01]"
                    : ""
                }`}
              />
            )}

            {bubble.type === "image" && (
              <div
                onClick={() => setSelectedBubbleIdx?.(bIdx)}
                className={`p-0.5 rounded-2xl overflow-hidden shadow-sm transition-all duration-200 cursor-pointer ${
                  isLeft ? "bg-card border border-border" : "bg-primary text-primary-foreground"
                } ${
                  chatBubblesToolsOpen ? "cursor-pointer" : ""
                } ${
                  selectedBubbleIdx === bIdx
                    ? "ring-2 ring-[#C8D400] shadow-[0_0_10px_rgba(200,212,0,0.5)] border-[#C8D400] animate-bubble-select scale-[1.01]"
                    : ""
                }`}
              >
                {bubble.url ? (
                  <img src={bubble.url} alt="chat image" className="w-[110px] aspect-video object-cover rounded-xl" />
                ) : (
                  <div className="w-[110px] h-12 bg-muted rounded-xl flex items-center justify-center">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <Card
      style={cardStyle}
      className={`rounded-[24px] overflow-hidden flex flex-col px-7 py-4 ${mode === "play" ? "relative w-full h-full" : "absolute top-0 left-0 w-[300px] md:w-[330px] lg:w-[350px] h-[530px] md:h-[585px] lg:h-[620px]"} origin-top-left border border-border/80 shadow-md transition-all duration-300 z-0 ${
        !isActive && draggedIdx === null ? "pointer-events-none" : ""
      } ${draggedIdx !== null ? "scale-[0.37] pointer-events-none" : "scale-100"}`}
    >
      <style>{`
        @keyframes bubble-select-pop {
          0% { transform: scale(1); }
          50% { transform: scale(1.04); }
          100% { transform: scale(1); }
        }
        .animate-bubble-select {
          animation: bubble-select-pop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @keyframes bubblePop {
          0% { opacity: 0; transform: scale(0.85) translateY(6px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
      {/* FULL: image as absolute background — direct child of Card for true inset-0 */}
      {isFullBg && hasImageUrl && (
        <ImageContainer
          imageUrl={content.imageUrl || content.url}
          imageScale={content.imageScale ?? 1.0}
          fullScreenMode={content.fullScreenMode}
          isActive={isActive}
          showResizeHandle={false}
          imageAlign="full"
        />
      )}

      <div className="flex-1 flex flex-col min-h-0 -mx-7 -mb-4 overflow-hidden relative">

        {/* TOP: image section at top — replaces old full-bg code that was here */}
        {isImageTop && hasBelow && (
          <div className="shrink-0 overflow-hidden border-b border-border" style={{ height: `${100 - chatVolume}%` }}>
            {imageSection}
          </div>
        )}

        {/* Chat section */}
        <div
          className={`flex flex-col overflow-hidden relative ${
            isFullBg ? "flex-1 min-h-0 z-10" :
            hasBelow && !isImageTop ? "shrink-0 border-b border-border" : "flex-1 min-h-0"
          } ${isFullBg ? "bg-transparent" : "bg-muted/20"}`}
          style={hasBelow && !isImageTop ? { height: `${chatVolume}%` } : {}}
        >
          {chatBubbles}
          {/* Drag handle at bottom of chat (bottom layout) */}
          {!isImageTop && belowType === "text" && dragHandle}
        </div>

        {/* BOTTOM: content zone below chat */}
        {hasBelow && !isImageTop && !isFullBg && (
          <div className="flex-1 flex flex-col justify-center px-6 py-4 min-h-0">
            {belowType === "image" && imageSection}
            {belowType === "text" && (
              <textarea
                disabled={!isActive}
                value={content.body || content.text || ""}
                onChange={(e) => updateContent({ body: e.target.value, text: e.target.value })}
                placeholder="Enter description text here..."
                rows={1}
                ref={(node) => {
                  if (node) {
                    node.style.height = "auto";
                    node.style.height = `${node.scrollHeight}px`;
                  }
                }}
                className="font-sans font-medium text-left resize-none bg-transparent focus:outline-none leading-relaxed w-full p-0 border-0 focus:ring-0 overflow-y-auto scrollbar-none text-base md:text-lg text-foreground placeholder-muted-foreground/45"
              />
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

interface ChatToolbarProps {
  slide: Slide;
  index: number;
  onUpdateSlideContent: (idx: number, updatedFields: any) => void;
  onOpenMediaPicker: () => void;
  imageToolsOpen: boolean;
  setImageToolsOpen: (val: boolean) => void;
  chatBubblesToolsOpen?: boolean;
  setChatBubblesToolsOpen?: (val: boolean) => void;
  selectedBubbleIdx?: number | null;
  setSelectedBubbleIdx?: (idx: number | null) => void;
}

export function ChatToolbar({
  slide,
  index,
  onUpdateSlideContent,
  onOpenMediaPicker,
  imageToolsOpen,
  setImageToolsOpen,
  chatBubblesToolsOpen = false,
  setChatBubblesToolsOpen,
  selectedBubbleIdx = null,
  setSelectedBubbleIdx,
}: ChatToolbarProps) {
  const content = slide.content || {};
  const chatVolume = content.chatVolume ?? 100;
  const belowType = content.belowType || "none";
  const hasBelow = chatVolume < 98;
  const hasImage = !!(content.imageUrl || content.url);
  const imageScale = content.imageScale ?? 1.0;
  const imageAlign = content.imageAlign ?? "top";
  const fullScreenMode = content.fullScreenMode ?? "fill";

  const updateContent = (fields: any) => onUpdateSlideContent(index, fields);

  return (
    <ControlPanel
      below={
        chatBubblesToolsOpen ? (
          <div className="w-full max-w-xs border rounded-2xl p-3 shadow-2xl z-20 mt-1.5 animate-slide-up flex flex-col justify-center items-center no-swipe backdrop-blur-md bg-popover text-popover-foreground border-border">
            <div className="flex items-center justify-center gap-2.5">
              <button
                type="button"
                disabled={selectedBubbleIdx === null || (content.chatBubbles || [])[selectedBubbleIdx]?.align === "left"}
                onClick={() => {
                  if (selectedBubbleIdx === null) return;
                  const updatedBubbles = [...(content.chatBubbles || [])];
                  updatedBubbles[selectedBubbleIdx] = { ...updatedBubbles[selectedBubbleIdx], align: "left" };
                  updateContent({ chatBubbles: updatedBubbles });
                }}
                className="p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center shrink-0 w-9 h-9 border-border bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                title="Align Left"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" />
              </button>
              <button
                type="button"
                disabled={selectedBubbleIdx === null || (content.chatBubbles || [])[selectedBubbleIdx]?.align === "right"}
                onClick={() => {
                  if (selectedBubbleIdx === null) return;
                  const updatedBubbles = [...(content.chatBubbles || [])];
                  updatedBubbles[selectedBubbleIdx] = { ...updatedBubbles[selectedBubbleIdx], align: "right" };
                  updateContent({ chatBubbles: updatedBubbles });
                }}
                className="p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center shrink-0 w-9 h-9 border-border bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                title="Align Right"
              >
                <ArrowRight className="h-4 w-4 shrink-0" />
              </button>
              <div className="h-6 w-[1px] bg-border mx-1" />
              <button
                type="button"
                onClick={() => {
                  const bubbles = [...(content.chatBubbles || [])];
                  bubbles.push({ id: Math.random().toString(36).substring(7), align: "left", type: "text", text: "" });
                  updateContent({ chatBubbles: bubbles });
                  setSelectedBubbleIdx?.(bubbles.length - 1);
                }}
                className="p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center shrink-0 w-9 h-9 border-border bg-card hover:bg-accent text-card-foreground hover:text-accent-foreground"
                title="Add Bubble"
              >
                <Plus className="h-4 w-4 shrink-0" />
              </button>
              <div className="h-6 w-[1px] bg-border mx-1" />
              <button
                type="button"
                disabled={selectedBubbleIdx === null}
                onClick={() => {
                  if (selectedBubbleIdx === null) return;
                  const bubbles = (content.chatBubbles || []).filter((_: any, i: number) => i !== selectedBubbleIdx);
                  updateContent({ chatBubbles: bubbles });
                  setSelectedBubbleIdx?.(bubbles.length > 0 ? Math.max(0, selectedBubbleIdx - 1) : null);
                }}
                className="p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center shrink-0 w-9 h-9 border-destructive/30 bg-destructive/10 hover:bg-destructive/20 text-destructive disabled:opacity-40 disabled:cursor-not-allowed"
                title="Delete Bubble"
              >
                <Trash2 className="h-4 w-4 shrink-0" />
              </button>
            </div>
          </div>
        ) : belowType === "image" && hasImage && imageToolsOpen ? (
          <div className="w-full max-w-xs border rounded-2xl p-3 shadow-2xl z-20 gap-3 mt-1.5 animate-slide-up flex flex-col no-swipe backdrop-blur-md bg-popover text-popover-foreground border-border">
            <div className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl border bg-muted border-border">
              <ZoomOut className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={imageScale}
                onChange={(e) => updateContent({ imageScale: parseFloat(e.target.value) })}
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
                <button type="button" onClick={() => updateContent({ imageAlign: "top" })} className={`p-1.5 rounded-lg transition-all cursor-pointer ${imageAlign === "top" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`} title="Align Top">
                  <PanelTop className="h-4 w-4 shrink-0" />
                </button>
                <button type="button" onClick={() => updateContent({ imageAlign: "bottom" })} className={`p-1.5 rounded-lg transition-all cursor-pointer ${imageAlign === "bottom" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`} title="Align Bottom">
                  <PanelBottom className="h-4 w-4 shrink-0" />
                </button>
                <button type="button" onClick={() => updateContent({ imageAlign: "full" })} className={`p-1.5 rounded-lg transition-all cursor-pointer ${imageAlign === "full" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`} title="Full Screen">
                  <Maximize2 className="h-4 w-4 shrink-0" />
                </button>
              </div>
              <div className={`flex items-center gap-1 p-1 rounded-xl border bg-muted border-border ${imageAlign !== "full" ? "invisible" : ""}`}>
                <button type="button" onClick={() => updateContent({ fullScreenMode: "fill" })} className={`p-1.5 rounded-lg transition-all cursor-pointer ${fullScreenMode === "fill" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`} title="Cover">
                  <Crop className="h-4 w-4 shrink-0" />
                </button>
                <button type="button" onClick={() => updateContent({ fullScreenMode: "stretch" })} className={`p-1.5 rounded-lg transition-all cursor-pointer ${fullScreenMode === "stretch" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`} title="Stretch">
                  <Expand className="h-4 w-4 shrink-0" />
                </button>
              </div>
              <div className="flex items-center gap-1.5 ml-auto">
                <button type="button" onClick={onOpenMediaPicker} className="p-1.5 border border-border rounded-xl bg-card hover:bg-accent text-card-foreground transition-all cursor-pointer" title="Replace Image">
                  <RefreshCw className="h-4 w-4 shrink-0" />
                </button>
                <button type="button" onClick={() => { updateContent({ belowType: "none", chatVolume: 100, imageUrl: undefined, url: undefined, imageScale: undefined, imageAlign: undefined, fullScreenMode: undefined }); setImageToolsOpen(false); }} className="p-1.5 border border-destructive/30 bg-destructive/10 hover:bg-destructive/20 rounded-xl text-destructive transition-all cursor-pointer" title="Remove Image">
                  <Trash2 className="h-4 w-4 shrink-0" />
                </button>
              </div>
            </div>
          </div>
        ) : null
      }
    >
      <PanelButton
        icon={<FileText className="h-4.5 w-4.5 shrink-0" />}
        label={belowType === "text" ? "Remove text below chat" : "Add text below chat"}
        isActive={belowType === "text"}
        onClick={() => {
          setChatBubblesToolsOpen?.(false);
          if (belowType === "text") {
            updateContent({ belowType: "none", chatVolume: 100, body: "", text: "" });
          } else {
            updateContent({ belowType: "text", chatVolume: hasBelow ? chatVolume : 65 });
            setImageToolsOpen(false);
          }
        }}
        variant="primary"
      />
      <PanelButton
        icon={<ImageIcon className="h-4.5 w-4.5 shrink-0" />}
        label={belowType === "image" ? "Toggle image settings" : "Add image below chat"}
        isActive={imageToolsOpen}
        onClick={() => {
          setChatBubblesToolsOpen?.(false);
          if (belowType === "image") {
            if (hasImage) {
              setImageToolsOpen(!imageToolsOpen);
            } else {
              onOpenMediaPicker();
            }
          } else {
            updateContent({ belowType: "image", chatVolume: hasBelow ? chatVolume : 65 });
            setImageToolsOpen(false);
            onOpenMediaPicker();
          }
        }}
        variant="primary"
      />
      <PanelButton
        icon={<MessageSquare className="h-4.5 w-4.5 shrink-0" />}
        label="Manage chat bubbles"
        isActive={chatBubblesToolsOpen}
        onClick={() => {
          setChatBubblesToolsOpen?.(!chatBubblesToolsOpen);
          setImageToolsOpen(false);
        }}
        variant="primary"
      />
    </ControlPanel>
  );
}
