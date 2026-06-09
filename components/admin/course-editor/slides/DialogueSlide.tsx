import React, { useState, useRef, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { AlertTriangle, GripVertical, Loader2, Play, X, Sparkles, FileText } from "lucide-react";
import { toast } from "sonner";
import { Slide } from "../CardCanvas";
import { SlideBody } from "../SlideBody";
import { QuizContainer } from "../QuizContainer";
import { ControlPanel } from "../ControlPanel";
import { PanelButton, PanelDivider } from "../PanelButton";

const CHAD_FALLBACK_IMAGE = "https://files2.heygen.ai/avatar/v3/ac048b34f66c4526a396842915c438c8_34900/preview_talk_2.webp";
const FLORIN_FALLBACK_IMAGE = "https://files2.heygen.ai/avatar/v3/6010f06908ef489cbd83bbb25363e9c2_47220/preview_talk_1.webp";

let globalAvatars: any[] | null = null;
let globalAvatarsPromise: Promise<any[]> | null = null;

function fetchAvatarsList() {
  if (globalAvatars) return Promise.resolve(globalAvatars);
  if (globalAvatarsPromise) return globalAvatarsPromise;

  globalAvatarsPromise = fetch("/api/avatars")
    .then((r) => r.json())
    .then((data) => {
      if (Array.isArray(data)) {
        globalAvatars = data;
        return data;
      }
      throw new Error("Invalid response");
    })
    .catch((err) => {
      console.error("Failed to load avatars in client:", err);
      return [];
    });
  return globalAvatarsPromise;
}

interface DialogueCardProps {
  slide: Slide;
  index: number;
  isActive: boolean;
  onUpdateSlideContent: (idx: number, updatedFields: any, slideFields?: any) => void;
  draggedIdx: number | null;
  cardStyle?: React.CSSProperties;
  onDisableDrag?: () => void;
  onEnableDrag?: () => void;
  mode?: "edit" | "play";
  onCompleted?: () => void;
}

// 1. Silhouettes & Soundwave Icons
function InstructorSilhouette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20,90 C20,70 30,60 50,60 C70,60 80,70 80,90" fill="currentColor" />
      <rect x="46" y="48" width="8" height="15" fill="currentColor" />
      <circle cx="50" cy="32" r="18" fill="currentColor" />
      <path d="M42,58 L50,66 L58,58" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WorkerSilhouette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20,90 C20,70 30,60 50,60 C70,60 80,70 80,90" fill="currentColor" />
      <rect x="46" y="48" width="8" height="15" fill="currentColor" />
      <circle cx="50" cy="32" r="18" fill="currentColor" />
      <path d="M30,28 C30,16 40,12 50,12 C60,12 70,16 70,28 L72,28 C74,28 75,29 75,31 L75,32 C75,33 74,34 72,34 L28,34 C26,34 25,33 25,32 L25,31 C25,29 26,28 28,28 L30,28 Z" fill="currentColor" />
      <path d="M48,12 C48,12 50,10 50,12 C50,14 48,18 48,22" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function PlaceholderSilhouette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20,90 C20,70 30,60 50,60 C70,60 80,70 80,90" fill="currentColor" />
      <rect x="46" y="48" width="8" height="15" fill="currentColor" />
      <circle cx="50" cy="32" r="18" fill="currentColor" />
    </svg>
  );
}

function SoundwaveDots() {
  return (
    <div className="flex items-center gap-1 py-2 px-0.5 select-none opacity-60">
      <span className="w-0.5 h-1.5 rounded-full bg-muted-foreground/30" />
      <span className="w-0.5 h-3.5 rounded-full bg-muted-foreground/50" />
      <span className="w-0.5 h-1.5 rounded-full bg-muted-foreground/30" />
    </div>
  );
}

// 2. AvatarSelector component
interface AvatarSelectorProps {
  onSelect: (avatarType: "instructor" | "worker") => void;
  onClose: () => void;
  sideName: string;
  className?: string;
  chadImage?: string;
  florinImage?: string;
}

function AvatarSelector({ onSelect, onClose, sideName, className = "", chadImage, florinImage }: AvatarSelectorProps) {
  return (
    <div className={`absolute border border-border p-3 rounded-2xl bg-popover/95 backdrop-blur-md text-popover-foreground shadow-2xl z-50 flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
          Select Avatar ({sideName})
        </span>
        <button
          type="button"
          onClick={onClose}
          className="h-4 w-4 rounded-full flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <div className="flex gap-3 mt-1">
        <button
          type="button"
          onClick={() => onSelect("instructor")}
          className="flex-1 flex flex-col items-center gap-1.5 p-2 rounded-xl border border-border bg-card hover:bg-accent/50 hover:border-primary transition-all cursor-pointer"
        >
          <div className="w-11 h-11 rounded-full border-2 border-primary bg-[#E2E5E9] text-[#7A8A00] flex items-center justify-center overflow-hidden">
            <img src={chadImage || CHAD_FALLBACK_IMAGE} className="w-full h-full object-cover" style={{ transform: "scale(2.1) translateY(5%)", transformOrigin: "center 15%" }} alt="Chad" />
          </div>
          <span className="text-[9px] font-bold uppercase tracking-wider">Chad</span>
        </button>

        <button
          type="button"
          onClick={() => onSelect("worker")}
          className="flex-1 flex flex-col items-center gap-1.5 p-2 rounded-xl border border-border bg-card hover:bg-accent/50 hover:border-blue-500 transition-all cursor-pointer"
        >
          <div className="w-11 h-11 rounded-full border-2 border-blue-500 bg-[#E2E5E9] text-[#1D4ED8] flex items-center justify-center overflow-hidden">
            <img src={florinImage || FLORIN_FALLBACK_IMAGE} className="w-full h-full object-cover" style={{ transform: "scale(2.1) translateY(-5%)", transformOrigin: "center 15%" }} alt="Florin" />
          </div>
          <span className="text-[9px] font-bold uppercase tracking-wider">Florin</span>
        </button>
      </div>
    </div>
  );
}

// 3. CreationModeSelector component
interface CreationModeSelectorProps {
  onSelect: (type: "text" | "quiz") => void;
}

function CreationModeSelector({ onSelect }: CreationModeSelectorProps) {
  return (
    <div className="flex-1 flex flex-col justify-center items-center gap-4 px-4 py-8 text-center select-none">
      <div className="flex flex-col items-center gap-1">
        <h3 className="text-sm font-black uppercase tracking-wider text-foreground">Select Content Type</h3>
        <p className="text-[10px] text-muted-foreground max-w-[200px] leading-normal">
          Choose the content type to render inside this roleplay card
        </p>
      </div>
      <div className="flex gap-3.5 w-full max-w-[280px]">
        <button
          type="button"
          onClick={() => onSelect("text")}
          className="flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border border-border bg-card hover:bg-accent/40 hover:border-primary/50 text-card-foreground shadow-sm hover:shadow-md transition-all cursor-pointer"
        >
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 7 4 4 20 4 20 7"></polyline>
              <line x1="9" y1="20" x2="15" y2="20"></line>
              <line x1="12" y1="4" x2="12" y2="20"></line>
            </svg>
          </div>
          <span className="text-[11px] font-black uppercase tracking-wider">Text</span>
        </button>

        <button
          type="button"
          onClick={() => onSelect("quiz")}
          className="flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border border-border bg-card hover:bg-accent/40 hover:border-primary/50 text-card-foreground shadow-sm hover:shadow-md transition-all cursor-pointer"
        >
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          <span className="text-[11px] font-black uppercase tracking-wider">Quiz</span>
        </button>
      </div>
    </div>
  );
}

// 4. DialogueScriptOverlay component
interface DialogueScriptOverlayProps {
  linesList: any[];
  labelA: string;
  labelB: string;
  isActive: boolean;
  onUpdateLines: (lines: any[]) => void;
  onRegenerateVideo: () => void;
  onDisableDrag?: () => void;
  onEnableDrag?: () => void;
  onClose: () => void;
  isInstructorLoading: boolean;
  isStudentLoading: boolean;
}

function DialogueScriptOverlay({
  linesList,
  labelA,
  labelB,
  isActive,
  onUpdateLines,
  onRegenerateVideo,
  onDisableDrag,
  onEnableDrag,
  onClose,
  isInstructorLoading,
  isStudentLoading,
}: DialogueScriptOverlayProps) {
  const [draggedLineIdx, setDraggedLineIdx] = useState<number | null>(null);
  const draggedLineIdxRef = useRef<number | null>(null);

  const handleLineDragStart = (idx: number, e: React.DragEvent) => {
    e.stopPropagation();
    setDraggedLineIdx(idx);
    draggedLineIdxRef.current = idx;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", idx.toString());

    const rowEl = e.currentTarget.closest("[data-line-index]");
    if (rowEl) {
      rowEl.classList.add("shadow-2xl", "scale-[1.02]", "border-primary/80", "ring-2", "ring-primary/25");
      e.dataTransfer.setDragImage(rowEl, 20, 24);
      setTimeout(() => {
        rowEl.classList.remove("shadow-2xl", "scale-[1.02]", "border-primary/80", "ring-2", "ring-primary/25");
      }, 0);
    }
  };

  const handleLineDragOver = (idx: number, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const currentDraggedIdx = draggedLineIdxRef.current;
    if (currentDraggedIdx !== null && currentDraggedIdx !== idx) {
      const updatedLines = [...linesList];
      const [draggedItem] = updatedLines.splice(currentDraggedIdx, 1);
      updatedLines.splice(idx, 0, draggedItem);

      onUpdateLines(updatedLines);
      draggedLineIdxRef.current = idx;
      setDraggedLineIdx(idx);
    }
  };

  const handleLineDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedLineIdx(null);
    draggedLineIdxRef.current = null;
    onEnableDrag?.();
  };

  const handleLineDragEnd = (e: React.DragEvent) => {
    e.stopPropagation();
    setDraggedLineIdx(null);
    draggedLineIdxRef.current = null;
    onEnableDrag?.();
  };

  return (
    <div className="absolute inset-x-4 bottom-4 top-[185px] bg-background border border-border rounded-2xl shadow-2xl z-30 flex flex-col p-4 animate-in fade-in slide-in-from-bottom-4 duration-200 no-swipe">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          Dialogue Script
        </span>
        <button
          type="button"
          onClick={onClose}
          className="h-5 w-5 rounded-full flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none pb-2 pr-0.5">
        {linesList.map((line: any, lineIdx: number) => {
          const isLineDragged = isActive && draggedLineIdx === lineIdx;
          const slotIdx = line.slotIndex !== undefined ? line.slotIndex : (line.character === "student" ? 1 : 0);

          return (
            <div
              key={`line-${lineIdx}`}
              data-line-index={lineIdx}
              onDragOver={isActive ? (e) => handleLineDragOver(lineIdx, e) : undefined}
              onDrop={isActive ? handleLineDrop : undefined}
              className={`flex items-center gap-2 mb-2.5 relative group/line transition-all duration-200 ${
                isLineDragged ? "opacity-30 scale-[0.98]" : ""
              }`}
            >
              {isActive && (
                <div
                  draggable={isActive}
                  onDragStart={(e) => handleLineDragStart(lineIdx, e)}
                  onDragEnd={handleLineDragEnd}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    onDisableDrag?.();
                  }}
                  onMouseUp={() => {
                    if (draggedLineIdx === null) onEnableDrag?.();
                  }}
                  onMouseLeave={() => {
                    if (draggedLineIdx === null) onEnableDrag?.();
                  }}
                  className="h-6 w-6 flex items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0 transition-transform hover:scale-110"
                  title="Drag to reorder"
                >
                  <GripVertical className="h-3.5 w-3.5" />
                </div>
              )}

              <button
                type="button"
                disabled={!isActive}
                onClick={() => {
                  const nextSlot = slotIdx === 0 ? 1 : 0;
                  const updatedLines = [...linesList];
                  updatedLines[lineIdx] = {
                    ...line,
                    slotIndex: nextSlot,
                    character: nextSlot === 1 ? "student" : "instructor",
                  };
                  onUpdateLines(updatedLines);
                }}
                className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-all border-2 shadow-xs ${
                  slotIdx === 0
                    ? "bg-[#FDFEE6] border-[#C8D400] text-[#7A8A00] hover:bg-yellow-100/50"
                    : "bg-[#EFF6FF] border-[#3B82F6] text-[#1D4ED8] hover:bg-blue-100/50"
                }`}
                title={slotIdx === 0 ? `Switch to ${labelB || "Florin"}` : `Switch to ${labelA || "Chad"}`}
              >
                {slotIdx === 0 ? "I" : "W"}
              </button>

              <input
                type="text"
                disabled={!isActive}
                value={line.text}
                onChange={(e) => {
                  const updatedLines = [...linesList];
                  updatedLines[lineIdx] = { ...line, text: e.target.value };
                  onUpdateLines(updatedLines);
                }}
                placeholder="Enter dialogue text..."
                className="flex-1 rounded-lg border border-border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary bg-card text-foreground placeholder-muted-foreground/30"
              />

              {isActive && linesList.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const updatedLines = linesList.filter((_, i) => i !== lineIdx);
                    onUpdateLines(updatedLines);
                  }}
                  className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0 cursor-pointer"
                  title="Delete line"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {(isInstructorLoading || isStudentLoading) && (
        <div className="mb-2 rounded-xl px-3 py-1.5 text-[9px] text-center shrink-0 bg-muted text-muted-foreground animate-pulse">
          Rendering videos… this takes 2–5 min
        </div>
      )}

      <div className="flex gap-2 mt-1 border-t border-border pt-3 shrink-0">
        <button
          type="button"
          onClick={() => {
            const updated = [...linesList];
            updated.push({ slotIndex: 1, character: "student", text: "" });
            onUpdateLines(updated);
          }}
          className="flex-1 py-2 border border-dashed border-border rounded-xl text-xs font-bold transition-all cursor-pointer bg-card hover:bg-accent text-foreground flex items-center justify-center gap-1.5 hover:border-primary/50"
        >
          + Add Line
        </button>
        <button
          type="button"
          onClick={onRegenerateVideo}
          className="flex-1 py-2 bg-[#1B2A6B] hover:bg-[#1B2A6B]/90 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
        >
          <Sparkles className="h-3.5 w-3.5" /> Generate
        </button>
      </div>
    </div>
  );
}

// 5. DialogueCard Component
export function DialogueCard({
  slide,
  index,
  isActive,
  onUpdateSlideContent,
  draggedIdx,
  cardStyle,
  onDisableDrag,
  onEnableDrag,
  mode,
  onCompleted,
}: DialogueCardProps) {
  const content = slide.content || {};
  const [chadImage, setChadImage] = useState(CHAD_FALLBACK_IMAGE);
  const [florinImage, setFlorinImage] = useState(FLORIN_FALLBACK_IMAGE);

  useEffect(() => {
    fetchAvatarsList().then((list) => {
      const chad = list.find((a: any) => a.name.toLowerCase() === "chad");
      const florin = list.find((a: any) => a.name.toLowerCase() === "florin");
      if (chad?.preview_image_url) setChadImage(chad.preview_image_url);
      if (florin?.preview_image_url) setFlorinImage(florin.preview_image_url);
    });
  }, []);
  const labelA = content.labelA ?? "";
  const labelB = content.labelB ?? "";
  const heygenAvatarAId = content.heygenAvatarAId || "";
  const heygenAvatarBId = content.heygenAvatarBId || "";
  const slots = content.slots || [
    { slotIndex: 0, avatarId: heygenAvatarAId },
    { slotIndex: 1, avatarId: heygenAvatarBId }
  ];
  const instructorVideoUrl = slots[0]?.videoUrl || content.instructorVideoUrl || "";
  const studentVideoUrl = slots[1]?.videoUrl || content.studentVideoUrl || "";
  const isInstructorLoading = !instructorVideoUrl && (slide.assetStatus === "generating" || slide.assetStatus === "pending");
  const isStudentLoading = !studentVideoUrl && (slide.assetStatus === "generating" || slide.assetStatus === "pending");

  const linesList = content.dialogueLines || [];

  const [avatarPickerOpen, setAvatarPickerOpen] = useState<{ side: "A" | "B" } | null>(null);
  const [activePlayer, setActivePlayer] = useState<"instructor" | "student" | null>(null);
  const [dialogueCompleted, setDialogueCompleted] = useState(false);
  const instructorVideoRef = useRef<HTMLVideoElement>(null);
  const studentVideoRef = useRef<HTMLVideoElement>(null);
  const secondVideoPlayedRef = useRef(false);

  const firstSpeaker = useMemo(() => {
    if (linesList.length === 0) return "instructor";
    const first = linesList[0];
    return (first.slotIndex === 1 || first.character === "student") ? "student" : "instructor";
  }, [linesList]);

  useEffect(() => {
    if (mode !== "play") return;
    if (!instructorVideoUrl && !studentVideoUrl) return;

    const startWith = (instructorVideoUrl && firstSpeaker === "instructor") ? "instructor"
      : (studentVideoUrl && firstSpeaker === "student") ? "student"
      : instructorVideoUrl ? "instructor" : "student";

    secondVideoPlayedRef.current = false;
    setDialogueCompleted(false);
    setActivePlayer(startWith);
    const ref = startWith === "instructor" ? instructorVideoRef : studentVideoRef;
    if (ref.current) {
      ref.current.currentTime = 0;
      ref.current.play().catch(() => {});
    }
  }, [mode, instructorVideoUrl, studentVideoUrl, firstSpeaker]);

  const handleVideoEnded = (who: "instructor" | "student") => {
    if (secondVideoPlayedRef.current) {
      setActivePlayer(null);
      setDialogueCompleted(true);
      return;
    }

    const other = who === "instructor" ? "student" : "instructor";
    const otherUrl = other === "instructor" ? instructorVideoUrl : studentVideoUrl;
    const otherRef = other === "instructor" ? instructorVideoRef : studentVideoRef;

    if (otherUrl && otherRef.current) {
      secondVideoPlayedRef.current = true;
      setActivePlayer(other);
      otherRef.current.currentTime = 0;
      otherRef.current.play().catch(() => {});
    } else {
      setActivePlayer(null);
      setDialogueCompleted(true);
    }
  };

  const isFailed = slide.assetStatus === "failed";

  // Reset local picker state if deactivated
  useEffect(() => {
    if (!isActive) {
      const timer = setTimeout(() => {
        setAvatarPickerOpen(null);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  const updateContent = (fields: any) => {
    onUpdateSlideContent(index, fields);
  };

  const handleRegenerateVideo = async () => {
    if (!slide.id) return;
    onUpdateSlideContent(index, {}, { assetStatus: "generating" });
    try {
      const res = await fetch(`/api/slides/${slide.id}/regenerate?asset=video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dialogueLines: content.dialogueLines,
          heygenAvatarAId: content.heygenAvatarAId || undefined,
          heygenAvatarBId: content.heygenAvatarBId || undefined,
          slots,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${res.status}`);
      }
      toast.success("HeyGen dialogue video generation triggered in background.");
    } catch (err: any) {
      toast.error("Failed to regenerate video: " + err.message);
      onUpdateSlideContent(index, {}, { assetStatus: "failed" });
    }
  };

  // Helper to map avatars to standard types
  const getAvatarType = (val: string | undefined) => {
    if (!val) return null;
    if (val === "instructor" || val === "👩‍💼" || val === "👩‍🏫") return "instructor";
    if (val === "worker" || val === "👷‍♂️" || val === "🧑‍💻") return "worker";
    return null;
  };

  const typeA = getAvatarType(content.avatarA);
  const typeB = getAvatarType(content.avatarB);

  const isPickerOpenA = avatarPickerOpen?.side === "A";
  const isPickerOpenB = avatarPickerOpen?.side === "B";

  if (isFailed) {
    return (
      <Card
        style={cardStyle}
        className={`rounded-[24px] overflow-hidden flex flex-col px-7 py-4 ${mode === "play" ? "relative w-full h-full" : "absolute top-0 left-0 w-[300px] md:w-[330px] lg:w-[350px] h-[530px] md:h-[585px] lg:h-[620px]"} origin-top-left border-[0.11px] border-border/80 justify-center items-center text-center p-6 gap-3 z-0 ${
          draggedIdx !== null ? "scale-[0.37] pointer-events-none" : "scale-100"
        }`}
      >
        <div className="p-3 bg-destructive/10 text-destructive rounded-full border border-destructive/20">
          <AlertTriangle className="h-8 w-8 text-destructive animate-bounce" />
        </div>
        <h3 className="text-base font-bold text-destructive font-sans">Video Generation Failed</h3>
        <p className="text-xs max-w-[200px] leading-normal text-muted-foreground">
          We encountered an error while calling the HeyGen API.
        </p>
        {isActive && (
          <button
            type="button"
            onClick={handleRegenerateVideo}
            className="mt-2 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground py-2 px-5 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer no-swipe font-sans"
          >
            Retry Generation
          </button>
        )}
      </Card>
    );
  }

  const renderContentContainer = () => {
    if (!content.dialogueBelowType || content.dialogueBelowType === "none") {
      return (
        <CreationModeSelector
          onSelect={(type) => {
            updateContent({ dialogueBelowType: type });
          }}
        />
      );
    }

    if (content.dialogueBelowType === "text") {
      const showB = !!content.belowShowBody;
      return (
        <div className="flex-1 flex flex-col justify-center items-center text-center px-1 pt-4 pb-4 space-y-1.5 min-h-0 w-full z-10">
          {showB && (
            <div className="w-full flex flex-col items-center min-h-0">
              <SlideBody
                value={content.belowText || ""}
                isActive={isActive}
                onChange={(val) => updateContent({ belowText: val })}
              />
            </div>
          )}
        </div>
      );
    }

    if (content.dialogueBelowType === "quiz") {
      return (
        <QuizContainer
          questionText={content.belowQuizQuestion || ""}
          options={content.belowQuizOptions || ["", ""]}
          correctIndex={content.belowQuizCorrectIndex ?? 0}
          explanation={content.belowQuizExplanation || ""}
          isActive={isActive}
          mode={mode}
          onAnswered={onCompleted}
          onUpdateContent={(fields) => {
            const updated: any = {};
            if (fields.question !== undefined) updated.belowQuizQuestion = fields.question;
            if (fields.options !== undefined) updated.belowQuizOptions = fields.options;
            if (fields.correctIndex !== undefined) updated.belowQuizCorrectIndex = fields.correctIndex;
            if (fields.correctAnswer !== undefined) updated.belowQuizCorrectAnswer = fields.correctAnswer;
            if (fields.explanation !== undefined) updated.belowQuizExplanation = fields.explanation;
            updateContent(updated);
          }}
          onDisableDrag={onDisableDrag}
          onEnableDrag={onEnableDrag}
        />
      );
    }

    return null;
  };

  return (
    <Card
      style={cardStyle}
      className={`rounded-[24px] overflow-hidden flex flex-col px-7 py-4 ${mode === "play" ? "relative w-full h-full" : "absolute top-0 left-0 w-[300px] md:w-[330px] lg:w-[350px] h-[530px] md:h-[585px] lg:h-[620px]"} origin-top-left border-[0.11px] border-border/80 transition-all duration-300 z-0 ${
        !isActive && draggedIdx === null ? "pointer-events-none" : ""
      } ${draggedIdx !== null ? "scale-[0.37] pointer-events-none" : "scale-100"}`}
    >
      <div
        style={{ marginLeft: "-28px", marginRight: "-28px", paddingLeft: "28px", paddingRight: "28px", width: "calc(100% + 56px)" }}
        className="flex-1 flex flex-col min-h-0 pt-1 relative"
      >
        {/* Avatars Header */}
        <div className="flex items-center justify-between shrink-0 pt-6 pb-2 mx-[-28px] px-5 md:px-6 relative">
          {/* Character A — Instructor */}
          <div className="flex flex-col items-center">
            <button
              type="button"
              disabled={!isActive}
              onClick={() => {
                if (!isActive) return;
                setAvatarPickerOpen(isPickerOpenA ? null : { side: "A" });
              }}
              className={`w-[110px] h-[110px] md:w-[125px] md:h-[125px] lg:w-[130px] lg:h-[130px] rounded-full border-[3px] border-primary shadow-lg overflow-hidden flex items-center justify-center relative group shrink-0 transition-all duration-200 ${
                typeA === "instructor"
                  ? "bg-[#E2E5E9] text-[#7A8A00]"
                  : typeA === "worker"
                  ? "bg-[#E2E5E9] text-[#1D4ED8]"
                  : "bg-muted text-muted-foreground/45"
              } ${isActive ? "cursor-pointer" : "cursor-default"} ${
                isPickerOpenA ? "ring-2 ring-offset-2 ring-primary/60 scale-105" : isActive ? "hover:scale-105 hover:shadow-xl" : ""
              } ${mode === "play" && activePlayer !== null && activePlayer !== "instructor" ? "opacity-40" : ""}`}
            >
              {instructorVideoUrl ? (
                <div className="w-full h-full relative">
                  <video
                    ref={instructorVideoRef}
                    src={instructorVideoUrl}
                    playsInline
                    preload={mode === "play" ? "auto" : "metadata"}
                    className="w-full h-full object-cover"
                    style={
                      typeA === "instructor"
                        ? { transform: "scale(2.1) translateY(5%)", transformOrigin: "center 15%" }
                        : typeA === "worker"
                        ? { transform: "scale(2.1) translateY(-5%)", transformOrigin: "center 15%" }
                        : undefined
                    }
                    onEnded={mode === "play" ? () => handleVideoEnded("instructor") : undefined}
                  />
                  {mode !== "play" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <Play className="h-6 w-6 text-white drop-shadow" />
                    </div>
                  )}
                </div>
              ) : isInstructorLoading ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              ) : typeA === "instructor" ? (
                <img src={chadImage} className="w-full h-full object-cover" style={{ transform: "scale(2.1) translateY(5%)", transformOrigin: "center 15%" }} alt="Chad" />
              ) : typeA === "worker" ? (
                <img src={florinImage} className="w-full h-full object-cover" style={{ transform: "scale(2.1) translateY(-5%)", transformOrigin: "center 15%" }} alt="Florin" />
              ) : (
                <PlaceholderSilhouette className="w-20 h-20 md:w-24 md:h-24" />
              )}
              {isActive && !instructorVideoUrl && (
                <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-all">
                  <span className="text-white text-[9px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                    Edit
                  </span>
                </div>
              )}
            </button>
          </div>

          {/* Soundwave Dots connecting characters */}
          <div className="flex items-center justify-center">
            <SoundwaveDots />
          </div>

          {/* Character B — Student / Worker */}
          <div className="flex flex-col items-center">
            <button
              type="button"
              disabled={!isActive}
              onClick={() => {
                if (!isActive) return;
                setAvatarPickerOpen(isPickerOpenB ? null : { side: "B" });
              }}
              className={`w-[110px] h-[110px] md:w-[125px] md:h-[125px] lg:w-[130px] lg:h-[130px] rounded-full border-[3px] border-blue-500 shadow-lg overflow-hidden flex items-center justify-center relative group shrink-0 transition-all duration-200 ${
                typeB === "instructor"
                  ? "bg-[#E2E5E9] text-[#7A8A00]"
                  : typeB === "worker"
                  ? "bg-[#E2E5E9] text-[#1D4ED8]"
                  : "bg-muted text-muted-foreground/45"
              } ${isActive ? "cursor-pointer" : "cursor-default"} ${
                isPickerOpenB ? "ring-2 ring-offset-2 ring-blue-500/60 scale-105" : isActive ? "hover:scale-105 hover:shadow-xl" : ""
              } ${mode === "play" && activePlayer !== null && activePlayer !== "student" ? "opacity-40" : ""}`}
            >
              {studentVideoUrl ? (
                <div className="w-full h-full relative">
                  <video
                    ref={studentVideoRef}
                    src={studentVideoUrl}
                    playsInline
                    preload={mode === "play" ? "auto" : "metadata"}
                    className="w-full h-full object-cover"
                    style={
                      typeB === "instructor"
                        ? { transform: "scale(2.1) translateY(5%)", transformOrigin: "center 15%" }
                        : typeB === "worker"
                        ? { transform: "scale(2.1) translateY(-5%)", transformOrigin: "center 15%" }
                        : undefined
                    }
                    onEnded={mode === "play" ? () => handleVideoEnded("student") : undefined}
                  />
                  {mode !== "play" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <Play className="h-6 w-6 text-white drop-shadow" />
                    </div>
                  )}
                </div>
              ) : isStudentLoading ? (
                <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
              ) : typeB === "instructor" ? (
                <img src={chadImage} className="w-full h-full object-cover" style={{ transform: "scale(2.1) translateY(5%)", transformOrigin: "center 15%" }} alt="Chad" />
              ) : typeB === "worker" ? (
                <img src={florinImage} className="w-full h-full object-cover" style={{ transform: "scale(2.1) translateY(-5%)", transformOrigin: "center 15%" }} alt="Florin" />
              ) : (
                <PlaceholderSilhouette className="w-20 h-20 md:w-24 md:h-24" />
              )}
              {isActive && !studentVideoUrl && (
                <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-all">
                  <span className="text-white text-[9px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                    Edit
                  </span>
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Absolute Floating Avatar Selector */}
        {avatarPickerOpen && (
          <AvatarSelector
            sideName={avatarPickerOpen.side === "A" ? labelA || "Chad" : labelB || "Florin"}
            className={avatarPickerOpen.side === "A" ? "left-4 top-[170px]" : "right-4 top-[170px]"}
            chadImage={chadImage}
            florinImage={florinImage}
            onSelect={(avatarType) => {
              if (avatarPickerOpen.side === "A") {
                const slotsUpdated = [...slots];
                slotsUpdated[0] = { ...slotsUpdated[0], slotIndex: 0, avatarId: avatarType === "instructor" ? "Chad_Maintenance_Front" : "Florin_Maintain_Front_2_public" };
                updateContent({ avatarA: avatarType, slots: slotsUpdated });
              } else {
                const slotsUpdated = [...slots];
                slotsUpdated[1] = { ...slotsUpdated[1], slotIndex: 1, avatarId: avatarType === "instructor" ? "Chad_Maintenance_Front" : "Florin_Maintain_Front_2_public" };
                updateContent({ avatarB: avatarType, slots: slotsUpdated });
              }
              setAvatarPickerOpen(null);
            }}
            onClose={() => setAvatarPickerOpen(null)}
          />
        )}

        {/* Main Card Content Container (Text Content or Quiz Content) */}
        <div className={`flex-1 flex flex-col min-h-0 overflow-y-auto scrollbar-none pb-4 px-[16px] ${
          mode === "play" && !dialogueCompleted && (instructorVideoUrl || studentVideoUrl)
            ? "opacity-0 pointer-events-none"
            : dialogueCompleted
            ? "animate-in fade-in slide-in-from-bottom-4 duration-500"
            : ""
        }`}>
          {renderContentContainer()}
        </div>

        {/* Dialogue Script Overlay */}
        {content.showDialogueScript === true && (
          <DialogueScriptOverlay
            linesList={linesList}
            labelA={labelA || "Chad"}
            labelB={labelB || "Florin"}
            isActive={isActive}
            onUpdateLines={(updatedLines) => updateContent({ dialogueLines: updatedLines })}
            onRegenerateVideo={handleRegenerateVideo}
            onDisableDrag={onDisableDrag}
            onEnableDrag={onEnableDrag}
            onClose={() => updateContent({ showDialogueScript: false })}
            isInstructorLoading={isInstructorLoading}
            isStudentLoading={isStudentLoading}
          />
        )}
      </div>
    </Card>
  );
}

// 6. DialogueToolbar component
interface DialogueToolbarProps {
  slide: Slide;
  index: number;
  onUpdateSlideContent: (idx: number, updatedFields: any, slideFields?: any) => void;
}

const ScriptIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

export function DialogueToolbar({
  slide,
  index,
  onUpdateSlideContent,
}: DialogueToolbarProps) {
  const content = slide.content || {};
  const dialogueBelowType = content.dialogueBelowType;
  const showDialogueScript = content.showDialogueScript === true;
  const linesList = content.dialogueLines || [];

  const updateContent = (fields: any) => onUpdateSlideContent(index, fields);

  const belowShowBody = content.belowShowBody === true;

  return (
    <ControlPanel>
      <PanelButton
        icon={<FileText className="h-4 w-4 shrink-0" />}
        label={belowShowBody ? "Hide Body" : "Show Body"}
        isActive={dialogueBelowType === "text" && belowShowBody && !showDialogueScript}
        onClick={() => {
          if (dialogueBelowType !== "text") {
            updateContent({ dialogueBelowType: "text", belowShowBody: true, showDialogueScript: false });
          } else {
            updateContent({ dialogueBelowType: "none", belowShowBody: false, showDialogueScript: false });
          }
        }}
      />
      <PanelButton
        icon={<span className="text-sm font-bold leading-none">?</span>}
        label="Switch to Quiz content"
        isActive={dialogueBelowType === "quiz" && !showDialogueScript}
        onClick={() => {
          if (dialogueBelowType === "quiz") {
            updateContent({ dialogueBelowType: "none", showDialogueScript: false });
          } else {
            updateContent({ dialogueBelowType: "quiz", showDialogueScript: false });
          }
        }}
      />
      <PanelDivider />
      <PanelButton
        icon={<ScriptIcon />}
        label="Toggle Dialogue Script editor"
        isActive={showDialogueScript}
        onClick={() => updateContent({ showDialogueScript: !showDialogueScript })}
        badge={linesList.length > 0 ? linesList.length : undefined}
        variant="dark"
      />
    </ControlPanel>
  );
}
