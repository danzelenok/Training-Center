import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures";
import { Slide } from "./CardCanvas";

interface UseCardCanvasProps {
  slidesList: Slide[];
  activeSlideIndex: number | null;
  setActiveSlideIndex: (idx: number) => void;
  onReorderSlides: (newList: Slide[]) => void;
  onUpdateSlideContent: (idx: number, updatedFields: any, slideFields?: any) => void;
}

export function useCardCanvas({
  slidesList,
  activeSlideIndex,
  setActiveSlideIndex,
  onReorderSlides,
  onUpdateSlideContent,
}: UseCardCanvasProps) {
  const options = useMemo(() => ({
    align: "center" as const,
    containScroll: false as const,
    dragFree: false,
    watchSlides: true,
    skipSnaps: true,
  }), []);

  const plugins = useMemo(() => [WheelGesturesPlugin()], []);
  const [emblaRef, emblaApi] = useEmblaCarousel(options, plugins);

  // Prevent trackpad rubber-band bounce overshoot at boundaries
  useEffect(() => {
    if (!emblaApi) return;
    const viewportNode = emblaApi.rootNode();

    const handleBoundaryWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        const isAtFirst = activeSlideIndex === 0;
        const isAtLast = activeSlideIndex === slidesList.length - 1;

        if ((isAtFirst && e.deltaX < 0) || (isAtLast && e.deltaX > 0)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    viewportNode.addEventListener("wheel", handleBoundaryWheel, { passive: false, capture: true });
    return () => {
      viewportNode.removeEventListener("wheel", handleBoundaryWheel, { capture: true });
    };
  }, [emblaApi, activeSlideIndex, slidesList.length]);

  // State definitions
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [isCardDraggable, setIsCardDraggable] = useState<{ [key: number]: boolean }>({});

  const [imageToolsOpen, setImageToolsOpen] = useState(false);
  const [chatBubblesToolsOpen, setChatBubblesToolsOpen] = useState(false);
  const [selectedChatBubbleIdx, setSelectedChatBubbleIdx] = useState<number | null>(null);
  const [isVideoConfigOpen, setIsVideoConfigOpen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [videoToolsOpen, setVideoToolsOpen] = useState(false);
  const [captionsToolsOpen, setCaptionsToolsOpen] = useState(false);

  const resizeRef = useRef<{
    startY: number;
    startVolume: number;
    slideIndex: number;
    align: "top" | "bottom";
  } | null>(null);

  const [isChatResizing, setIsChatResizing] = useState(false);
  const chatResizeRef = useRef<{
    startY: number;
    startVolume: number;
    slideIndex: number;
  } | null>(null);

  const [audioToolsOpen, setAudioToolsOpen] = useState(false);
  const [audioTranscriptToolsOpen, setAudioTranscriptToolsOpen] = useState(false);

  // Auto-scroll on drag refs
  const scrollAnimationRef = useRef<number | null>(null);
  const scrollDirectionRef = useRef<"left" | "right" | null>(null);

  // Close tools on slide change
  useEffect(() => {
    setImageToolsOpen(false);
    setIsVideoConfigOpen(false);
    setVideoToolsOpen(false);
    setCaptionsToolsOpen(false);
    setAudioToolsOpen(false);
    setAudioTranscriptToolsOpen(false);
    setChatBubblesToolsOpen(false);
    setSelectedChatBubbleIdx(null);
  }, [activeSlideIndex]);

  // Resizer handlers
  const handleResizeStart = (
    e: React.MouseEvent | React.TouchEvent,
    slideIdx: number,
    align: "top" | "bottom",
    currentVolume: number
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    resizeRef.current = {
      startY: clientY,
      startVolume: currentVolume,
      slideIndex: slideIdx,
      align: align,
    };
    setIsResizing(true);
    if (emblaApi) {
      emblaApi.reInit({ watchDrag: false });
    }
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!resizeRef.current) return;
      const { startY, startVolume, slideIndex, align } = resizeRef.current;

      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const deltaY = clientY - startY;

      const cardEl = document.querySelector(`[data-card-index="${slideIndex}"]`);
      const cardHeight = cardEl ? cardEl.getBoundingClientRect().height : 450;

      const deltaPercent = (deltaY / cardHeight) * 100;
      let newVolume = startVolume + (align === "top" ? deltaPercent : -deltaPercent);
      newVolume = Math.max(10, Math.min(80, Math.round(newVolume)));

      onUpdateSlideContent(slideIndex, { imageVolume: newVolume });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeRef.current = null;
      if (emblaApi) {
        emblaApi.reInit({ watchDrag: true });
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleMouseMove, { passive: false });
    window.addEventListener("touchend", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleMouseMove);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [isResizing, emblaApi, onUpdateSlideContent]);

  const handleChatResizeStart = (
    e: React.MouseEvent | React.TouchEvent,
    slideIdx: number,
    currentVolume: number
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    chatResizeRef.current = {
      startY: clientY,
      startVolume: currentVolume,
      slideIndex: slideIdx,
    };
    setIsChatResizing(true);
    if (emblaApi) {
      emblaApi.reInit({ watchDrag: false });
    }
  };

  useEffect(() => {
    if (!isChatResizing) return;

    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!chatResizeRef.current) return;
      const { startY, startVolume, slideIndex } = chatResizeRef.current;

      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const deltaY = clientY - startY;

      const cardEl = document.querySelector(`[data-card-index="${slideIndex}"]`);
      const cardHeight = cardEl ? cardEl.getBoundingClientRect().height : 450;

      const deltaPercent = (deltaY / cardHeight) * 100;
      let newVolume = startVolume + deltaPercent;
      newVolume = Math.max(25, Math.min(90, Math.round(newVolume)));

      onUpdateSlideContent(slideIndex, { chatVolume: newVolume });
    };

    const handleMouseUp = () => {
      setIsChatResizing(false);
      chatResizeRef.current = null;
      if (emblaApi) {
        emblaApi.reInit({ watchDrag: true });
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleMouseMove, { passive: false });
    window.addEventListener("touchend", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleMouseMove);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [isChatResizing, emblaApi, onUpdateSlideContent]);

  // Sync index change from outside into Embla
  useEffect(() => {
    if (!emblaApi || activeSlideIndex === null) return;
    if (emblaApi.selectedScrollSnap() !== activeSlideIndex) {
      emblaApi.scrollTo(activeSlideIndex);
    }
  }, [emblaApi, activeSlideIndex]);

  // Auto-scroll and focus newly added slides smoothly after Embla re-initialization
  const prevLengthRef = useRef(slidesList.length);
  useEffect(() => {
    if (!emblaApi) return;
    if (slidesList.length > prevLengthRef.current) {
      emblaApi.reInit();
      if (activeSlideIndex !== null) {
        setTimeout(() => {
          emblaApi.scrollTo(activeSlideIndex, false);
        }, 120);
      }
    }
    prevLengthRef.current = slidesList.length;
  }, [emblaApi, slidesList.length, activeSlideIndex]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    const selectedIdx = emblaApi.selectedScrollSnap();
    setActiveSlideIndex(selectedIdx);
  }, [emblaApi, setActiveSlideIndex]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  const handlePrev = () => {
    if (emblaApi) emblaApi.scrollPrev();
  };

  const handleNext = () => {
    if (emblaApi) emblaApi.scrollNext();
  };

  const handleHandleMouseDown = () => {
    if (emblaApi) {
      emblaApi.reInit({ watchDrag: false });
    }
  };

  const clearAutoScroll = () => {
    scrollDirectionRef.current = null;
    if (scrollAnimationRef.current) {
      cancelAnimationFrame(scrollAnimationRef.current);
      scrollAnimationRef.current = null;
    }
  };

  const startAutoScroll = (direction: "left" | "right") => {
    scrollDirectionRef.current = direction;
    if (scrollAnimationRef.current) return;

    const scrollLoop = () => {
      if (!emblaApi || !scrollDirectionRef.current) {
        scrollAnimationRef.current = null;
        return;
      }

      try {
        const engine = emblaApi.internalEngine();
        const speed = scrollDirectionRef.current === "left" ? 8 : -8;
        engine.target.add(speed);
        engine.animation.start();
      } catch (err) {
        if (scrollDirectionRef.current === "left") {
          if (emblaApi.canScrollPrev()) emblaApi.scrollPrev();
        } else {
          if (emblaApi.canScrollNext()) emblaApi.scrollNext();
        }
      }

      scrollAnimationRef.current = requestAnimationFrame(scrollLoop);
    };

    scrollAnimationRef.current = requestAnimationFrame(scrollLoop);
  };

  const handleViewportDragOver = (e: React.DragEvent) => {
    if (draggedIdx === null || !emblaApi) return;
    e.preventDefault();

    const viewport = emblaApi.rootNode();
    const rect = viewport.getBoundingClientRect();
    const clientX = e.clientX;

    const threshold = 140;
    const distLeft = clientX - rect.left;
    const distRight = rect.right - clientX;

    let targetDir: "left" | "right" | null = null;
    if (distLeft < threshold && distLeft > 0) {
      targetDir = "left";
    } else if (distRight < threshold && distRight > 0) {
      targetDir = "right";
    }

    if (targetDir !== scrollDirectionRef.current) {
      if (targetDir) {
        startAutoScroll(targetDir);
      } else {
        clearAutoScroll();
      }
    }
  };

  const handleDragStart = (idx: number, e: React.DragEvent) => {
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = "move";

    try {
      const target = e.currentTarget as HTMLElement;
      const clone = target.cloneNode(true) as HTMLElement;

      const originalInputs = target.querySelectorAll("input, textarea");
      const clonedInputs = clone.querySelectorAll("input, textarea");
      originalInputs.forEach((input, index) => {
        const clonedInput = clonedInputs[index] as HTMLInputElement | HTMLTextAreaElement;
        if (clonedInput) {
          clonedInput.value = (input as HTMLInputElement | HTMLTextAreaElement).value;
        }
      });

      clone.style.width = "130px";
      clone.style.height = "231px";
      clone.style.position = "absolute";
      clone.style.top = "-9999px";
      clone.style.left = "-9999px";
      clone.style.opacity = "0.95";
      clone.style.transform = "none";
      clone.style.borderRadius = "24px";
      clone.style.pointerEvents = "none";
      clone.style.boxShadow = "0 20px 25px -5px rgba(0,0,0,0.4), 0 10px 10px -5px rgba(0,0,0,0.4)";
      clone.style.overflow = "hidden";

      const innerCard =
        clone.querySelector(".rounded-\\[24px\\]") as HTMLElement ||
        clone.querySelector("div[style*='background']") as HTMLElement ||
        (clone.children[clone.children.length - 1] as HTMLElement);

      if (innerCard) {
        innerCard.style.position = "absolute";
        innerCard.style.top = "0";
        innerCard.style.left = "0";
        innerCard.style.width = target.clientWidth ? `${target.clientWidth}px` : "350px";
        innerCard.style.height = target.clientHeight ? `${target.clientHeight}px` : "620px";
        innerCard.style.transformOrigin = "top left";
        innerCard.style.transform = "scale(0.37)";
        innerCard.style.pointerEvents = "none";
      }

      document.body.appendChild(clone);
      e.dataTransfer.setDragImage(clone, 65, 115);

      setTimeout(() => {
        if (document.body.contains(clone)) {
          document.body.removeChild(clone);
        }
      }, 0);
    } catch (err) {
      console.error("Failed to generate mini drag image:", err);
    }
  };

  const handleDragOver = (idx: number, e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIdx !== null) {
      setDragOverIdx(idx);
    }
  };

  const handleViewportDragLeave = (e: React.DragEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverIdx(null);
      clearAutoScroll();
    }
  };

  const handleViewportDrop = (e: React.DragEvent) => {
    e.preventDefault();
    clearAutoScroll();
    if (draggedIdx === null || dragOverIdx === null || draggedIdx === dragOverIdx) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }

    const reorderedList = [...slidesList];
    const [draggedItem] = reorderedList.splice(draggedIdx, 1);
    reorderedList.splice(dragOverIdx, 0, draggedItem);

    const updated = reorderedList.map((slide, orderIdx) => ({
      ...slide,
      order: orderIdx + 1,
    }));

    onReorderSlides(updated);
    setActiveSlideIndex(dragOverIdx);

    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleDrop = (idx: number, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    clearAutoScroll();
    if (draggedIdx === null || draggedIdx === idx) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }

    const reorderedList = [...slidesList];
    const [draggedItem] = reorderedList.splice(draggedIdx, 1);
    reorderedList.splice(idx, 0, draggedItem);

    const updated = reorderedList.map((slide, orderIdx) => ({
      ...slide,
      order: orderIdx + 1,
    }));

    onReorderSlides(updated);
    setActiveSlideIndex(idx);

    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    clearAutoScroll();
    setDraggedIdx(null);
    setDragOverIdx(null);
    setIsCardDraggable({});
    if (emblaApi) {
      emblaApi.reInit({ watchDrag: true });
      if (activeSlideIndex !== null) {
        emblaApi.scrollTo(activeSlideIndex, true);
      }

      setTimeout(() => {
        if (emblaApi) {
          emblaApi.reInit();
          if (activeSlideIndex !== null) {
            emblaApi.scrollTo(activeSlideIndex, false);
          }
        }
      }, 350);
    }
  };

  return {
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
    isResizing,
    videoToolsOpen,
    setVideoToolsOpen,
    captionsToolsOpen,
    setCaptionsToolsOpen,
    isChatResizing,
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
  };
}
