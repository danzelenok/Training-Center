"use client";

import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Trash2,
  Copy,
  GripHorizontal,
  Loader2,
  MapPin,
} from "lucide-react";
import { slideRegistry } from "./SlideFactory";
import { useCourseEditor } from "./CourseEditorContext";
import { useCardCanvas } from "./useCardCanvas";
import { getCardBgStyle, getThemeTypography, getThemeInk } from "@/lib/theme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface Slide {
  id?: string;
  type: "text" | "video" | "audio" | "quiz" | "dialogue" | "chat" | "poll";
  content: {
    heading?: string;
    body?: string;
    title?: string;
    text?: string;
    url?: string;
    imageUrl?: string;
    question?: string;
    visualKeywords?: string;
    audioScript?: string;
    dialogueLines?: { character?: string; slotIndex?: number; text: string }[];
    chatBubbles?: any[];
    chatVolume?: number;
    belowType?: "none" | "image" | "text";
    pollType?: "stars" | "emojis" | "thumbs";
    options?: string[];
    quizType?: "single" | "multiple";
    correctIndices?: number[];
    correctAnswer?: string;
    explanation?: string;
    showHeading?: boolean;
    showBody?: boolean;
    imageScale?: number;
    imageVolume?: number;
    imageAlign?: "top" | "bottom" | "full";
    fullScreenMode?: "fill" | "stretch";
    textColor?: string;
    videoMode?: "upload" | "generate";
    avatarId?: string;
    speechText?: string;
    captions?: string;
    forceCompletion?: boolean;
    audioMode?: "upload" | "generate" | "record";
    voiceId?: string;
    avatarA?: string;
    avatarB?: string;
    heygenAvatarAId?: string;
    heygenAvatarBId?: string;
    slots?: { slotIndex: number; avatarId: string; videoUrl?: string }[];
    labelA?: string;
    labelB?: string;
    scriptA?: string;
    scriptB?: string;
    instructorVideoUrl?: string;
    studentVideoUrl?: string;
    dialogueBelowType?: "none" | "quiz" | "text";
    belowQuizQuestion?: string;
    belowQuizOptions?: string[];
    belowQuizType?: "single" | "multiple";
    belowQuizCorrectIndices?: number[];
    belowQuizCorrectAnswer?: string;
    belowQuizExplanation?: string;
    belowHeading?: string;
    belowText?: string;
    belowShowHeading?: boolean;
    belowShowBody?: boolean;
    assetUrl?: string;
    showDialogueScript?: boolean;
  };
  order: number;
  language?: string;
  assetStatus?: "pending" | "generating" | "ready" | "failed";
  jurisdictionId?: string | null;
}

export default function CardCanvas() {
  const seenSlideIdsRef = React.useRef<Set<string>>(new Set());
  const {
    slidesList,
    activeSlideIndex,
    setActiveSlideIndex,
    setSlidesList,
    deleteSlide,
    duplicateSlide,
    updateActiveSlideContent,
    openMediaPicker,
    course,
    jurisdictionsList,
    isReadOnly,
  } = useCourseEditor();

  const {
    emblaRef,
    emblaApi,
    draggedIdx,
    dragOverIdx,
    isCardDraggable,
    setIsCardDraggable,
    imageToolsOpen,
    setImageToolsOpen,
    chatBubblesToolsOpen,
    setChatBubblesToolsOpen,
    selectedChatBubbleIdx,
    setSelectedChatBubbleIdx,
    isVideoConfigOpen,
    setIsVideoConfigOpen,
    videoToolsOpen,
    setVideoToolsOpen,
    captionsToolsOpen,
    setCaptionsToolsOpen,
    audioToolsOpen,
    setAudioToolsOpen,
    audioTranscriptToolsOpen,
    setAudioTranscriptToolsOpen,
    handleResizeStart,
    handleChatResizeStart,
    handlePrev,
    handleNext,
    handleHandleMouseDown,
    handleViewportDragOver,
    handleDragStart,
    handleDragOver,
    handleViewportDragLeave,
    handleViewportDrop,
    handleDrop,
    handleDragEnd,
  } = useCardCanvas({
    slidesList,
    activeSlideIndex,
    setActiveSlideIndex,
    onReorderSlides: setSlidesList,
    onUpdateSlideContent: updateActiveSlideContent,
  });

  const themeTypography = getThemeTypography(course ?? {});
  // Keeps the selection ring/shadow wrapper's rounded corners in step with
  // the palette's cardRadius, so a sharp-cornered theme (e.g. Safety
  // Orange, radius 8) doesn't show a mismatched 24px-rounded ring around
  // an 8px-rounded card.
  const wrapperRadius = course?.themePalette?.cardRadius ?? 24;

  return (
    <div className="flex flex-col items-center gap-4 w-full select-none justify-center">
      <style>{`
        @keyframes card-premium-mount {
          0% {
            opacity: 0;
            transform: scale(0.86) translateY(28px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-card-mount {
          animation: card-premium-mount 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>

      {/* 1. HORIZONTAL CAROUSEL VIEWPORT */}
      <div className="w-full relative overflow-hidden px-4 md:px-12">
        <div
          ref={emblaRef}
          className="overflow-hidden w-full h-[570px] md:h-[625px] lg:h-[660px] relative"
          onDragOver={handleViewportDragOver}
          onDragLeave={handleViewportDragLeave}
          onDrop={handleViewportDrop}
        >
          <div
            className={`flex select-none items-center transition-[padding,gap] duration-300 ${
              draggedIdx !== null ? "gap-4 pt-10 pb-5 pl-[8%] pr-[8%]" : "gap-8 pt-5 pb-5 pl-[20%] pr-[20%]"
            }`}
          >
            {slidesList.map((slide, index) => {
              const isActive = activeSlideIndex === index;
              const isDragged = draggedIdx === index;

              const slideId = slide.id || `temp-${index}`;
              const isNew = !seenSlideIdsRef.current.has(slideId);
              if (slide.id) {
                seenSlideIdsRef.current.add(slide.id);
              }

              return (
                <div
                  key={slide.id || index}
                  data-card-index={index}
                  draggable={!isReadOnly && !!isCardDraggable[index]}
                  onDragStart={(e) => handleDragStart(index, e)}
                  onDragOver={(e) => handleDragOver(index, e)}
                  onDrop={(e) => handleDrop(index, e)}
                  onDragEnd={handleDragEnd}
                  onClick={() => {
                    if (!isActive && emblaApi) {
                      emblaApi.scrollTo(index);
                    }
                  }}
                  style={{ borderRadius: wrapperRadius }}
                  className={`flex-shrink-0 relative transition-[width,height,transform,opacity,filter,box-shadow] duration-300 ease-out snap-center ${
                    isNew ? "animate-card-mount" : ""
                  }
                    ${
                      draggedIdx !== null
                        ? "w-[110px] md:w-[130px] h-[196px] md:h-[231px] opacity-80"
                        : "w-[300px] md:w-[330px] lg:w-[350px] h-[530px] md:h-[585px] lg:h-[620px]"
                    }
                    ${
                      isActive && draggedIdx === null
                        ? "scale-100 opacity-100 z-10 ring-2 ring-[#C8D400] shadow-[0_15px_35px_-8px_rgba(200,212,0,0.22)]"
                        : "scale-95 opacity-45 blur-[0.3px] hover:opacity-65 cursor-pointer"
                    }
                    ${
                      isDragged
                        ? dragOverIdx === index
                          ? "opacity-90 border-2 border-solid border-[#C8D400] shadow-[0_0_20px_#C8D400] scale-[0.93]"
                          : "opacity-30 border-2 border-dashed border-[#C8D400]/60 scale-90"
                        : ""
                    }
                  `}
                >
                  {/* Neon Drag-Indicator Line showing destination */}
                  {dragOverIdx === index && draggedIdx !== null && draggedIdx !== index && (
                    <div
                      className={`absolute top-0 bottom-0 w-1.5 bg-[#C8D400] shadow-[0_0_12px_#C8D400] rounded-full z-40 pointer-events-none animate-pulse ${
                        draggedIdx < index ? "right-[-18px]" : "left-[-18px]"
                      }`}
                    />
                  )}

                  {/* Jurisdiction badge — always visible so admins can scan which
                      slides are base vs. state-specific at a glance. */}
                  <div className="absolute bottom-2 left-2.5 z-40 select-none no-swipe">
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${
                        slide.jurisdictionId
                          ? "bg-[#C8D400]/15 border-[#C8D400]/40 text-[#8a9400] dark:text-[#C8D400]"
                          : "bg-background/80 border-border text-muted-foreground"
                      }`}
                    >
                      {slide.jurisdictionId
                        ? jurisdictionsList.find((j) => j.id === slide.jurisdictionId)?.code ?? "?"
                        : "Base"}
                    </span>
                  </div>

                  {/* Everything below edits slide content/order — inert-blocked as a
                      genuine visual+functional read-only lock (not just the 403 the
                      API already enforces): no clicks, no keyboard focus, no drag
                      start. Carousel navigation above stays fully interactive so a
                      read-only viewer can still browse the deck. */}
                  <div inert={isReadOnly}>
                  {/* Actions at top-left corner of the card */}
                  {isActive && (
                    <div className="absolute top-2 left-2.5 z-40 flex items-center gap-1.5 select-none no-swipe animate-fade-in">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicateSlide(index);
                        }}
                        className="p-1.5 rounded-lg border bg-background/80 hover:bg-accent text-foreground transition-colors cursor-pointer shrink-0 border-border"
                        title="Duplicate slide"
                      >
                        <Copy className="h-3 w-3 shrink-0" />
                      </button>
                      {jurisdictionsList.length > 0 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 rounded-lg border bg-background/80 hover:bg-accent text-foreground transition-colors cursor-pointer shrink-0 border-border"
                              title="Add state variant"
                            >
                              <MapPin className="h-3 w-3 shrink-0" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="start"
                            className="bg-card border border-border text-foreground rounded-xl shadow-lg p-1 z-50"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {jurisdictionsList.map((j) => (
                              <DropdownMenuItem
                                key={j.id}
                                onClick={() => duplicateSlide(index, j.id)}
                                className="text-xs cursor-pointer rounded-lg"
                              >
                                Add {j.code} variant
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      {slidesList.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const isCurrentActive = activeSlideIndex === index;
                            if (isCurrentActive && emblaApi) {
                              const targetIndex = index === 0 ? 1 : index - 1;
                              emblaApi.scrollTo(targetIndex);
                              setTimeout(() => {
                                deleteSlide(index);
                              }, 450);
                            } else {
                              deleteSlide(index);
                            }
                          }}
                          className="p-1.5 rounded-lg border bg-background/80 hover:bg-destructive/10 text-foreground hover:text-destructive transition-colors cursor-pointer shrink-0 border-border"
                          title="Delete slide"
                        >
                          <Trash2 className="h-3 w-3 shrink-0" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Grab handle at top of active slide */}
                  {isActive && (
                    <div
                      onMouseDown={handleHandleMouseDown}
                      onMouseEnter={() => setIsCardDraggable((prev) => ({ ...prev, [index]: true }))}
                      onMouseLeave={() => setIsCardDraggable((prev) => ({ ...prev, [index]: false }))}
                      className="absolute top-2 right-2.5 z-40 p-1.5 rounded-lg border bg-background/80 hover:bg-accent text-foreground cursor-grab active:cursor-grabbing no-swipe select-none transition-colors border-border"
                      title="Drag handle to reorder slide"
                    >
                      <GripHorizontal className="h-3 w-3 shrink-0" />
                    </div>
                  )}

                  {(() => {
                    const SlideCard = slideRegistry[slide.type]?.Card;
                    return SlideCard ? (
                      <SlideCard
                        slide={slide}
                        isActive={isActive}
                        index={index}
                        onUpdateSlideContent={updateActiveSlideContent}
                        onOpenMediaPicker={openMediaPicker}
                        draggedIdx={draggedIdx}
                        cardStyle={getCardBgStyle(course ?? {}, { cover: index === 0 })}
                        themeTypography={themeTypography}
                        themeInk={getThemeInk(course ?? {}, { cover: index === 0 })}
                        handleResizeStart={handleResizeStart}
                        handleChatResizeStart={handleChatResizeStart}
                        audioTranscriptToolsOpen={audioTranscriptToolsOpen}
                        setAudioTranscriptToolsOpen={setAudioTranscriptToolsOpen}
                        audioToolsOpen={audioToolsOpen}
                        setAudioToolsOpen={setAudioToolsOpen}
                        isVideoConfigOpen={isVideoConfigOpen}
                        setIsVideoConfigOpen={setIsVideoConfigOpen}
                        onDisableDrag={() => emblaApi?.reInit({ watchDrag: false })}
                        onEnableDrag={() => emblaApi?.reInit({ watchDrag: true })}
                        selectedBubbleIdx={selectedChatBubbleIdx}
                        setSelectedBubbleIdx={setSelectedChatBubbleIdx}
                        chatBubblesToolsOpen={chatBubblesToolsOpen}
                      />
                    ) : null;
                  })()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Swipe arrows overlays for large desktop */}
        <button
          type="button"
          onClick={handlePrev}
          disabled={activeSlideIndex === 0}
          className="absolute left-0 top-1/2 -translate-y-1/2 p-2 bg-neutral-900/90 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white rounded-full z-20 cursor-pointer disabled:opacity-20 shrink-0"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={activeSlideIndex === slidesList.length - 1}
          className="absolute right-0 top-1/2 -translate-y-1/2 p-2 bg-neutral-900/90 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white rounded-full z-20 cursor-pointer disabled:opacity-20 shrink-0"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* 2. DYNAMIC LAYOUT DRAWER (Renders right under the card deck for active slide) —
          pure editing tool panel, nothing for a read-only viewer to see, so skip it
          entirely rather than rendering an inert-but-visible unusable panel. */}
      {!isReadOnly && activeSlideIndex !== null && (() => {
        const slide = slidesList[activeSlideIndex];
        if (!slide) return null;

        const SlideToolbar = slideRegistry[slide.type]?.Toolbar;
        return SlideToolbar ? (
          <SlideToolbar
            slide={slide}
            index={activeSlideIndex}
            onUpdateSlideContent={updateActiveSlideContent}
            onOpenMediaPicker={openMediaPicker}
            imageToolsOpen={imageToolsOpen}
            setImageToolsOpen={setImageToolsOpen}
            audioToolsOpen={audioToolsOpen}
            setAudioToolsOpen={setAudioToolsOpen}
            audioTranscriptToolsOpen={audioTranscriptToolsOpen}
            setAudioTranscriptToolsOpen={setAudioTranscriptToolsOpen}
            isVideoConfigOpen={isVideoConfigOpen}
            setIsVideoConfigOpen={setIsVideoConfigOpen}
            videoToolsOpen={videoToolsOpen}
            setVideoToolsOpen={setVideoToolsOpen}
            captionsToolsOpen={captionsToolsOpen}
            setCaptionsToolsOpen={setCaptionsToolsOpen}
            chatBubblesToolsOpen={chatBubblesToolsOpen}
            setChatBubblesToolsOpen={setChatBubblesToolsOpen}
            selectedBubbleIdx={selectedChatBubbleIdx}
            setSelectedBubbleIdx={setSelectedChatBubbleIdx}
          />
        ) : null;
      })()}

      {/* 3. PERSISTENT TIMELINE NAVIGATION JUMP SEQUENCE (< 1 2 3 4 5 >) */}
      <div className="flex items-center gap-2 pt-2 bg-neutral-900/40 p-2.5 rounded-full border border-border/80 shrink-0">
        <button
          type="button"
          disabled={activeSlideIndex === 0}
          onClick={handlePrev}
          className="p-1 rounded-full text-muted-foreground hover:text-foreground disabled:opacity-20 cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex gap-1.5 flex-wrap">
          {slidesList.map((slide, sIdx) => {
            const isActive = activeSlideIndex === sIdx;
            const status = slide.assetStatus || "ready";
            const isMedia = slide.type === "audio";

            let statusIcon = null;
            if (isMedia) {
              if (status === "pending" || status === "generating") {
                statusIcon = <Loader2 className="h-2.5 w-2.5 animate-spin text-blue-400 shrink-0 ml-0.5" />;
              } else if (status === "failed") {
                statusIcon = <span className="text-red-500 text-[10px] ml-0.5">✗</span>;
              } else if (status === "ready") {
                statusIcon = <span className="text-emerald-500 text-[10px] ml-0.5">✓</span>;
              }
            }

            return (
              <button
                key={slide.id || sIdx}
                type="button"
                onClick={() => {
                  if (emblaApi) emblaApi.scrollTo(sIdx);
                }}
                className={`h-6 min-w-[28px] px-2 flex items-center justify-center rounded-full text-xs font-black transition-all cursor-pointer gap-0.5
                  ${
                    isActive
                      ? "bg-[#C8D400] text-[#1B2A6B] scale-105"
                      : "bg-background/80 hover:bg-muted text-muted-foreground"
                  }`}
              >
                <span>{sIdx + 1}</span>
                {statusIcon}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          disabled={activeSlideIndex === slidesList.length - 1}
          onClick={handleNext}
          className="p-1 rounded-full text-muted-foreground hover:text-foreground disabled:opacity-20 cursor-pointer"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
