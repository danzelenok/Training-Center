"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import useEmblaCarousel from "embla-carousel-react";
import {
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  HelpCircle,
  MessageSquare,
  Users,
  BarChart3,
  GripHorizontal,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Copy,
  Play,
  Star,
  Check,
  Upload,
  FolderOpen,
  X,
  Plus,
  ArrowUpRight,
  Loader2,
  Type,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  PanelTop,
  PanelBottom,
  Maximize2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export interface Slide {
  id?: string;
  type: "text" | "image" | "video" | "audio" | "quiz" | "dialogue" | "chat" | "poll";
  content: {
    heading?: string;
    body?: string;
    title?: string;
    text?: string;
    url?: string;
    imageUrl?: string;
    question?: string;
    imageKitFileId?: string;
    visualKeywords?: string;
    audioScript?: string;
    dialogueLines?: { character: string; text: string }[];
    chatBubbles?: any[];
    pollType?: "stars" | "emojis" | "options";
    options?: string[];
    correctIndex?: number;
    correctAnswer?: string;
    explanation?: string;
    showHeading?: boolean;
    showBody?: boolean;
    imageScale?: number;
    imageVolume?: number;
    imageAlign?: "top" | "bottom" | "full";
    fullScreenMode?: "fill" | "stretch";
    textColor?: string;
  };
  order: number;
  language?: string;
  assetStatus?: "pending" | "ready" | "failed";
}

interface CardCanvasProps {
  slidesList: Slide[];
  activeSlideIndex: number | null;
  setActiveSlideIndex: (idx: number) => void;
  onReorderSlides: (newList: Slide[]) => void;
  onDeleteSlide: (idx: number) => void;
  onDuplicateSlide: (idx: number) => void;
  onUpdateSlideContent: (idx: number, updatedFields: any) => void;
  onOpenMediaPicker: () => void;
  onDirectUpload: (file: File) => void;
  slideUploading: boolean;
  themeType: string;
  themeValue: string;
}

export default function CardCanvas({
  slidesList,
  activeSlideIndex,
  setActiveSlideIndex,
  onReorderSlides,
  onDeleteSlide,
  onDuplicateSlide,
  onUpdateSlideContent,
  onOpenMediaPicker,
  onDirectUpload,
  slideUploading,
  themeType,
  themeValue,
}: CardCanvasProps) {
  // Embla hook
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "center",
    containScroll: false,
    dragFree: false,
    watchSlides: true,
  });

  const getCardBgStyle = () => {
    if (themeType === "preset") {
      return { backgroundImage: themeValue };
    } else if (themeType === "color") {
      return { backgroundColor: themeValue };
    } else if (themeType === "image") {
      return {
        backgroundImage: `url(${themeValue})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      };
    }
    return { backgroundImage: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)" };
  };

  const isDarkTheme = () => {
    if (themeType === "preset") {
      return themeValue.includes("#0f2027") || themeValue.includes("#11998e");
    }
    if (themeType === "color") {
      const hex = themeValue.replace("#", "");
      if (hex.length !== 6) return false;
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      return brightness < 128;
    }
    if (themeType === "image") {
      return true; // We overlay dark transparent layer so white text always pops!
    }
    return false;
  };

  const isDark = isDarkTheme();

  const textColor = isDark ? "text-white" : "text-[#0B1B4F]";
  const mutedTextColor = isDark ? "text-white/80" : "text-[#0B1B4F]/80";
  const titleColor = isDark ? "text-[#C8D400]" : "text-[#0B1B4F]";
  const inputBorder = isDark ? "border-white/20 hover:border-white/40 focus:border-white" : "border-[#0B1B4F]/20 hover:border-[#0B1B4F]/40 focus:border-[#0B1B4F]";
  const placeholderColor = isDark ? "placeholder-white/40" : "placeholder-[#0B1B4F]/40";

  // Track drag & drop states
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [isCardDraggable, setIsCardDraggable] = useState<{ [key: number]: boolean }>({});

  // Auto-scroll on drag refs
  const scrollAnimationRef = useRef<number | null>(null);
  const scrollDirectionRef = useRef<"left" | "right" | null>(null);

  // Media popover overlay
  const [activeMediaOverlayOpen, setActiveMediaOverlayOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reusable minimalist media picker floating menu
  const renderMinimalistMediaPicker = (slideType: string) => {
    const pickerBg = isDark
      ? "bg-neutral-950/95 border-neutral-800 text-white"
      : "bg-white/95 border-neutral-200 text-[#0B1B4F]";
    const pickerBtn = isDark
      ? "bg-neutral-900 border-neutral-800/80 hover:bg-[#C8D400] hover:text-[#1B2A6B] hover:border-[#C8D400] text-neutral-200"
      : "bg-neutral-50 border-neutral-200 hover:bg-[#C8D400] hover:text-[#1B2A6B] hover:border-[#C8D400] text-[#0B1B4F]";
    const pickerClose = isDark
      ? "text-neutral-400 hover:text-white hover:bg-neutral-800"
      : "text-neutral-400 hover:text-[#0B1B4F] hover:bg-neutral-100";
    return (
      <div className={`border rounded-full px-2 py-1.5 shadow-2xl flex items-center gap-1.5 z-50 animate-fade-in no-swipe backdrop-blur-md whitespace-nowrap ${pickerBg}`}>
        {/* Option 1: Select from Library */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenMediaPicker();
            setActiveMediaOverlayOpen(false);
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all cursor-pointer text-[10px] font-black uppercase tracking-wider ${pickerBtn}`}
          title="Choose from Library"
        >
          <FolderOpen className="h-3.5 w-3.5 shrink-0" />
          <span>Library</span>
        </button>

        {/* Option 2: Upload from Device */}
        <label className="flex items-center" onClick={(e) => e.stopPropagation()}>
          <input
            ref={fileInputRef}
            type="file"
            accept={slideType === "image" || slideType === "text" ? "image/*" : slideType === "video" ? "video/*" : "audio/*"}
            onChange={handleLocalFileChange}
            className="hidden"
          />
          <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all cursor-pointer text-[10px] font-black uppercase tracking-wider ${pickerBtn}`}>
            {slideUploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            <span>Upload</span>
          </span>
        </label>

        {/* Close button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setActiveMediaOverlayOpen(false);
          }}
          className={`p-1 rounded-full cursor-pointer transition-colors ${pickerClose}`}
          title="Close panel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };

  // New States and Refs for Card Resizing and Image Settings
  const [imageToolsOpen, setImageToolsOpen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  // Tooltip overflow warning states
  const [warningCollapsed, setWarningCollapsed] = useState(false);
  const resizeRef = useRef<{
    startY: number;
    startVolume: number;
    slideIndex: number;
    align: "top" | "bottom";
  } | null>(null);

  // Close tools on slide change
  useEffect(() => {
    setImageToolsOpen(false);
    setWarningCollapsed(false);
  }, [activeSlideIndex]);



  // Resizer pointer/touch handlers
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

      // Clamp between 10% and 80%
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

  // Split overflowing text in half and insert duplicate slide with second half
  const handleSplitSlideText = (idx: number, heading: string, body: string) => {
    if (!body || body.length <= 10) {
      toast.error("Text is too short to split!");
      return;
    }

    const mid = Math.floor(body.length / 2);
    let splitIdx = body.indexOf(". ", mid);
    if (splitIdx === -1) splitIdx = body.indexOf("? ", mid);
    if (splitIdx === -1) splitIdx = body.indexOf("! ", mid);
    if (splitIdx === -1) splitIdx = body.indexOf(" ", mid);
    if (splitIdx === -1) splitIdx = mid;

    const actualSplitPoint = splitIdx !== mid ? splitIdx + 1 : splitIdx;
    const firstHalf = body.substring(0, actualSplitPoint).trim();
    const secondHalf = body.substring(actualSplitPoint).trim();

    if (!firstHalf || !secondHalf) {
      toast.error("Could not find a clean split point!");
      return;
    }

    const currentSlide = slidesList[idx];
    const nextSlide: Slide = {
      ...currentSlide,
      id: undefined,
      order: currentSlide.order + 1,
      content: {
        ...currentSlide.content,
        heading: heading || "Continued...",
        title: heading || "Continued...",
        body: secondHalf,
        text: secondHalf,
      }
    };

    const updatedList = [...slidesList];
    updatedList[idx] = {
      ...currentSlide,
      content: {
        ...currentSlide.content,
        body: firstHalf,
        text: firstHalf,
      }
    };
    updatedList.splice(idx + 1, 0, nextSlide);

    const finalizedList = updatedList.map((slide, orderIdx) => ({
      ...slide,
      order: orderIdx + 1,
    }));

    onReorderSlides(finalizedList);
    toast.success("Slide split successfully!");

    setTimeout(() => {
      if (emblaApi) emblaApi.scrollTo(idx + 1);
    }, 150);
  };

  // Clamp current slide text and move overflow text to a new succeeding slide
  const handleMoveTextToNext = (idx: number, heading: string, body: string, limit: number) => {
    if (body.length <= limit) return;

    const firstHalf = body.substring(0, limit).trim();
    const secondHalf = body.substring(limit).trim();

    const currentSlide = slidesList[idx];
    const nextSlide: Slide = {
      type: "text",
      order: currentSlide.order + 1,
      content: {
        heading: heading || "Continued...",
        title: heading || "Continued...",
        body: secondHalf,
        text: secondHalf,
        showHeading: true,
        showBody: true,
      }
    };

    const updatedList = [...slidesList];
    updatedList[idx] = {
      ...currentSlide,
      content: {
        ...currentSlide.content,
        body: firstHalf,
        text: firstHalf,
      }
    };
    updatedList.splice(idx + 1, 0, nextSlide);

    const finalizedList = updatedList.map((slide, orderIdx) => ({
      ...slide,
      order: orderIdx + 1,
    }));

    onReorderSlides(finalizedList);
    toast.success("Overflow text moved to new slide!");

    setTimeout(() => {
      if (emblaApi) emblaApi.scrollTo(idx + 1);
    }, 150);
  };

  // Sync index change from outside into Embla
  useEffect(() => {
    if (emblaApi && activeSlideIndex !== null) {
      emblaApi.scrollTo(activeSlideIndex);
    }
  }, [emblaApi, activeSlideIndex]);

  // Handle snapping focus state from Embla swipes
  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    const selectedIdx = emblaApi.selectedScrollSnap();
    if (selectedIdx !== activeSlideIndex) {
      setActiveSlideIndex(selectedIdx);
    }
  }, [emblaApi, activeSlideIndex, setActiveSlideIndex]);

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

  // Temporarily disable Embla swipe pan when clicking Grip reorder handle
  const handleHandleMouseDown = () => {
    if (emblaApi) {
      emblaApi.reInit({ watchDrag: false });
    }
  };

  // Auto-scroll when dragging cards near viewport edges using requestAnimationFrame for continuous, silky-smooth gliding
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
        // Speed: 8 pixels per frame (buttery-smooth scrolling at 60fps/120fps)
        // Corrected Embla coordinates: left scrolling is positive offset, right scrolling is negative offset
        const speed = scrollDirectionRef.current === "left" ? 8 : -8;

        engine.target.add(speed);
        engine.animation.start();
      } catch (err) {
        // Fallback to high-level scrollTo snap in case internal engine throws
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

    const threshold = 140; // Pixels from viewport edges to trigger scroll
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

    // Create a beautifully sized miniature drag ghost that matches the shrunk card size (130x231px)
    try {
      const target = e.currentTarget as HTMLElement;
      const clone = target.cloneNode(true) as HTMLElement;

      // Sync form values (inputs/textareas) to the clone as cloneNode doesn't copy dynamic values natively
      const originalInputs = target.querySelectorAll("input, textarea");
      const clonedInputs = clone.querySelectorAll("input, textarea");
      originalInputs.forEach((input, index) => {
        const clonedInput = clonedInputs[index] as HTMLInputElement | HTMLTextAreaElement;
        if (clonedInput) {
          clonedInput.value = (input as HTMLInputElement | HTMLTextAreaElement).value;
        }
      });

      // Style the clone exactly to match the shrunk card width and height (130x231px)
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
      clone.style.overflow = "hidden"; // Clip the scaled inner content perfectly!

      // Find the inner card layout container inside the clone and vector-scale it perfectly
      const innerCard = clone.querySelector(".rounded-\\[24px\\]") as HTMLElement
        || clone.querySelector("div[style*='background']") as HTMLElement
        || (clone.children[clone.children.length - 1] as HTMLElement);

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
      e.dataTransfer.setDragImage(clone, 65, 115); // Place the cursor exactly in the center of the 130x231px mini ghost

      // Clean up the temporary clone after the browser has captured the drag image
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

    // Correct orders indexes
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
    e.stopPropagation(); // Prevent duplicate trigger from bubbling up to viewport drop handler
    clearAutoScroll();
    if (draggedIdx === null || draggedIdx === idx) return;

    const reorderedList = [...slidesList];
    const [draggedItem] = reorderedList.splice(draggedIdx, 1);
    reorderedList.splice(idx, 0, draggedItem);

    // Correct orders indexes
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
    }
  };

  // Local helper to handle direct card uploading
  const handleLocalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onDirectUpload(file);
      setActiveMediaOverlayOpen(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full select-none justify-center">

      {/* 1. HORIZONTAL CAROUSEL VIEWPORT */}
      <div className="w-full relative overflow-hidden px-4 md:px-12">
        <div
          ref={emblaRef}
          className="overflow-hidden w-full h-[570px] md:h-[625px] lg:h-[660px] relative"
          onDragOver={handleViewportDragOver}
          onDragLeave={handleViewportDragLeave}
          onDrop={handleViewportDrop}
        >
          <div className={`flex select-none items-center transition-[padding,gap] duration-300 ${
            draggedIdx !== null
              ? "gap-4 pt-10 pb-5 pl-[8%] pr-[8%]"
              : "gap-8 pt-5 pb-5 pl-[20%] pr-[20%]"
          }`}>
            {slidesList.map((slide, index) => {
              const isActive = activeSlideIndex === index;
              const isDragged = draggedIdx === index;
              const content = slide.content || {};

              // Calculate text overflow at the card level for top-level alerts
              const isOverflow = (() => {
                if (slide.type !== "text") return false;
                const showHeading = content.showHeading !== false;
                const showBody = content.showBody !== false;
                const hasImage = !!content.imageUrl || !!content.url;
                const imageVolume = content.imageVolume ?? 40;

                let headingLimit = 280;
                let bodyLimit = 600;
                if (hasImage) {
                  const textPercent = 100 - imageVolume;
                  if (showHeading && showBody) {
                    headingLimit = Math.max(40, Math.round(textPercent * 1.2));
                    bodyLimit = Math.max(100, Math.round(textPercent * 3.5));
                  } else if (showHeading) {
                    headingLimit = Math.max(60, Math.round(textPercent * 2.5));
                  } else if (showBody) {
                    bodyLimit = Math.max(120, Math.round(textPercent * 6.0));
                  }
                } else {
                  if (showHeading && showBody) {
                    headingLimit = 120;
                    bodyLimit = 450;
                  } else if (showHeading) {
                    headingLimit = 320;
                  } else if (showBody) {
                    bodyLimit = 700;
                  }
                }
                const headingText = content.heading || content.title || "";
                const bodyText = content.body || content.text || "";
                return headingText.length > headingLimit || bodyText.length > bodyLimit;
              })();

              // Type specific inline updates helper
              const updateContent = (fields: any) => {
                onUpdateSlideContent(index, fields);
              };

              return (
                <div
                  key={index}
                  data-card-index={index}
                  draggable={!!isCardDraggable[index]}
                  onDragStart={(e) => handleDragStart(index, e)}
                  onDragOver={(e) => handleDragOver(index, e)}
                  onDrop={(e) => handleDrop(index, e)}
                  onDragEnd={handleDragEnd}
                  onClick={() => {
                    if (!isActive && emblaApi) {
                      emblaApi.scrollTo(index);
                    }
                  }}
                  className={`flex-shrink-0 relative transition-all duration-300 snap-center rounded-[24px]
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
                      className={`absolute top-0 bottom-0 w-1.5 bg-[#C8D400] shadow-[0_0_12px_#C8D400] rounded-full z-40 pointer-events-none animate-pulse
                        ${draggedIdx < index ? "right-[-18px]" : "left-[-18px]"}
                      `}
                    />
                  )}

                  {/* NO PHONE BEZEL CHASSIS — CLEAN CARD SHELL ONLY */}
                  <div
                    style={getCardBgStyle()}
                    className={`rounded-[24px] overflow-hidden flex flex-col p-4 absolute top-0 left-0 w-[300px] md:w-[330px] lg:w-[350px] h-[530px] md:h-[585px] lg:h-[620px] origin-top-left select-none border border-border/80 shadow-md transition-all duration-300 z-0 ${
                      !isActive && draggedIdx === null ? "pointer-events-none" : ""
                    } ${
                      draggedIdx !== null
                        ? "scale-[0.37] pointer-events-none"
                        : "scale-100"
                    }`}
                  >
                    {/* True Full Screen Background Image Cover for Text Slide Types */}
                    {slide.type === "text" && (content.imageUrl || content.url) && content.imageAlign === "full" && (() => {
                      const imageScale = content.imageScale ?? 1.0;
                      const fullScreenMode = content.fullScreenMode ?? "fill";
                      const activeImageUrl = content.imageUrl || content.url || "";
                      return (
                        <div className="absolute inset-0 z-0 overflow-hidden rounded-[24px] pointer-events-none">
                          <img
                            src={activeImageUrl}
                            alt="fullscreen backdrop"
                            style={{ transform: `scale(${imageScale})` }}
                            className={`w-full h-full transition-transform duration-105 ${fullScreenMode === "stretch" ? "object-fill" : "object-cover"
                              }`}
                          />
                          <div className="absolute inset-0 bg-black/45 backdrop-blur-[0.5px]" />
                        </div>
                      );
                    })()}
                    {/* Dark overlay for image themes to make text readable */}
                    {themeType === "image" && (
                      <div className="absolute inset-0 bg-black/35 z-0 pointer-events-none" />
                    )}

                    {/* Actions at top-left corner of the card */}
                    {isActive && (
                      <div className="absolute top-2 left-2.5 z-40 flex items-center gap-1.5 select-none no-swipe animate-fade-in">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDuplicateSlide(index);
                          }}
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer shrink-0 ${isDark
                              ? "bg-black/40 hover:bg-black/60 border-white/10 text-white/60 hover:text-white hover:border-[#C8D400]"
                              : "bg-white/80 hover:bg-white/95 border-neutral-200/50 text-[#0B1B4F]/60 hover:text-[#0B1B4F] hover:border-[#C8D400]"
                            }`}
                          title="Duplicate slide"
                        >
                          <Copy className="h-3 w-3 shrink-0" />
                        </button>
                        {slidesList.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteSlide(index);
                            }}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer shrink-0 ${isDark
                                ? "bg-black/40 hover:bg-red-500/10 border-white/10 text-white/60 hover:text-red-500 hover:border-red-500/40"
                                : "bg-white/80 hover:bg-red-500/10 border-neutral-200/50 text-[#0B1B4F]/60 hover:text-red-500 hover:border-red-500/40"
                              }`}
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
                        onMouseEnter={() =>
                          setIsCardDraggable((prev) => ({ ...prev, [index]: true }))
                        }
                        onMouseLeave={() =>
                          setIsCardDraggable((prev) => ({ ...prev, [index]: false }))
                        }
                        className={`absolute top-2 right-2.5 z-40 p-1.5 rounded-lg border cursor-grab active:cursor-grabbing no-swipe select-none transition-colors ${isDark
                            ? "bg-black/40 hover:bg-black/60 border-white/10 text-white/60 hover:text-white"
                            : "bg-white/80 hover:bg-white/95 border-neutral-200/50 text-[#0B1B4F]/60 hover:text-[#0B1B4F]"
                          }`}
                        title="Drag handle to reorder slide"
                      >
                        <GripHorizontal className="h-3 w-3 shrink-0" />
                      </div>
                    )}

                    {/* Premium top-level UX Caution warning popover & icon */}
                    {isActive && isOverflow && (
                      <>
                        {/* Collapsed Alert Icon - solid bright amber, extremely high contrast, symmetrical to tools */}
                        <button
                          type="button"
                          onClick={() => setWarningCollapsed(false)}
                          className={`absolute top-2 right-[42px] z-45 p-1.5 rounded-lg border transition-all duration-300 active:scale-90 hover:scale-105 cursor-pointer no-swipe select-none
                            bg-amber-500 border-amber-400 text-neutral-950 hover:bg-amber-600
                            ${warningCollapsed ? "scale-100 opacity-100" : "scale-0 opacity-0 pointer-events-none"}
                          `}
                          title="Expand Layout Caution"
                        >
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                        </button>

                        {/* Expanded Popout warning card with transition animation */}
                        <div className={`absolute top-11 inset-x-3.5 z-50 p-4 rounded-2xl shadow-2xl border backdrop-blur-md select-none no-swipe transition-all duration-300 origin-top text-left
                          ${isDark
                            ? "bg-[#090D1A]/95 border-amber-500/30 text-neutral-200 shadow-black/80"
                            : "bg-white/95 border-amber-200 text-neutral-700 shadow-neutral-200"
                          }
                          ${!warningCollapsed ? "scale-100 opacity-100" : "scale-0 opacity-0 pointer-events-none"}
                        `}>
                          {/* Manual Close Button */}
                          <button
                            type="button"
                            onClick={() => setWarningCollapsed(true)}
                            className={`absolute top-2.5 right-3 p-1 rounded-lg cursor-pointer transition-colors duration-150 shrink-0
                              ${isDark
                                ? "text-neutral-400 hover:text-white hover:bg-white/10"
                                : "text-neutral-500 hover:text-black hover:bg-black/5"
                              }`}
                            title="Collapse Warning"
                          >
                            <X className="h-3 w-3" />
                          </button>

                          <div className="flex items-center gap-2 mb-1.5 pr-6">
                            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                            <span className="text-[10px] font-black text-amber-500 tracking-wider uppercase">
                              UX Caution
                            </span>
                          </div>
                          <p className={`text-[9px] leading-relaxed font-sans ${isDark ? "text-neutral-300" : "text-neutral-600"} pr-1`}>
                            This content exceeds the Stories layout vertical limits. Shorten your text or split it into a new slide to prevent clipping on mobile devices.
                          </p>
                        </div>
                      </>
                    )}



                    {/* ACTIVE CARD CORE INLINE EDIT SCREEN */}
                    <div className="flex-1 flex flex-col min-h-0 relative z-10 font-sans mt-1">

                      {/* slide type: TEXT */}
                      {slide.type === "text" && (() => {
                        const showHeading = content.showHeading !== false;
                        const showBody = content.showBody !== false;
                        const imageScale = content.imageScale ?? 1.0;
                        const imageVolume = content.imageVolume ?? 40;
                        const imageAlign = content.imageAlign ?? "top";
                        const fullScreenMode = content.fullScreenMode ?? "fill";
                        const hasImage = !!content.imageUrl || !!content.url;
                        const activeImageUrl = content.imageUrl || content.url || "";

                        // Dynamic text volume limit calculators (Adaptive Capacity Model)
                        let headingLimit = 280;
                        let bodyLimit = 600;

                        if (hasImage) {
                          const textPercent = 100 - imageVolume; // space left for text
                          if (showHeading && showBody) {
                            headingLimit = Math.max(40, Math.round(textPercent * 1.2)); // e.g. 72 chars
                            bodyLimit = Math.max(100, Math.round(textPercent * 3.5)); // e.g. 210 chars
                          } else if (showHeading) {
                            headingLimit = Math.max(60, Math.round(textPercent * 2.5)); // e.g. 150 chars
                          } else if (showBody) {
                            bodyLimit = Math.max(120, Math.round(textPercent * 6.0)); // e.g. 360 chars
                          }
                        } else {
                          if (showHeading && showBody) {
                            headingLimit = 120;
                            bodyLimit = 450;
                          } else if (showHeading) {
                            headingLimit = 320;
                          } else if (showBody) {
                            bodyLimit = 700;
                          }
                        }

                        // Symmetrical centering and font scaling
                        const headingText = content.heading || content.title || "";
                        const headingLen = headingText.length;
                        const bodyText = content.body || content.text || "";
                        const bodyLen = bodyText.length;                        // Estimate line wrapping to dynamically set rows for vertical centering
                        const headingLines = headingText.split("\n");
                        let headingRows = 0;
                        headingLines.forEach(line => {
                          headingRows += Math.max(1, Math.ceil(line.length / 14));
                        });
                        headingRows = Math.max(1, headingRows);

                        const bodyLines = bodyText.split("\n");
                        let bodyRows = 0;
                        bodyLines.forEach(line => {
                          bodyRows += Math.max(1, Math.ceil(line.length / 19));
                        });
                        bodyRows = Math.max(2, bodyRows);

                        const isHeadingOverflow = headingLen > headingLimit;
                        const isBodyOverflow = bodyLen > bodyLimit;
                        const isOverflow = isHeadingOverflow || isBodyOverflow;

                        let headingClass = "font-black text-center resize-none bg-transparent focus:outline-none leading-snug shrink-0 w-full p-0 border-0 focus:ring-0 overflow-y-auto scrollbar-none max-h-full";
                        let bodyClass = "font-sans text-center resize-none bg-transparent focus:outline-none leading-relaxed w-full p-0 border-0 focus:ring-0 overflow-y-auto scrollbar-none max-h-full";
 
                        const activeTextColorClass = content.textColor ? "" : textColor;
                        const activeTitleColorClass = content.textColor ? "" : titleColor;
                        const customStyle = content.textColor ? { color: content.textColor } : {};
 
                        if (!showBody && !hasImage) {
                          // Only Heading: takes up whole card
                          if (headingLen < 40) {
                            headingClass += ` text-4xl md:text-5xl ${activeTitleColorClass}`;
                          } else if (headingLen < 120) {
                            headingClass += ` text-3xl md:text-4xl ${activeTitleColorClass}`;
                          } else {
                            headingClass += ` text-2xl md:text-3xl ${activeTitleColorClass}`;
                          }
                        } else {
                          // Stacked with Body or Image
                          if (headingLen < 30) {
                            headingClass += ` text-2xl md:text-3xl ${activeTitleColorClass}`;
                          } else {
                            headingClass += ` text-xl md:text-2xl ${activeTitleColorClass}`;
                          }
                        }
 
                        if (!showHeading && !hasImage) {
                          // Only Body: takes up whole card
                          if (bodyLen < 100) {
                            bodyClass += ` text-xl md:text-2xl ${activeTextColorClass}`;
                          } else if (bodyLen < 300) {
                            bodyClass += ` text-lg md:text-xl ${activeTextColorClass}`;
                          } else {
                            bodyClass += ` text-base md:text-lg ${activeTextColorClass}`;
                          }
                        } else {
                          // Stacked
                          if (bodyLen < 80) {
                            bodyClass += ` text-lg md:text-xl ${activeTextColorClass}`;
                          } else {
                            bodyClass += ` text-base md:text-lg ${activeTextColorClass}`;
                          }
                        }

                        // Text elements template (renders title & body textareas)
                        const textElements = (
                          <div className="flex-1 flex flex-col justify-center items-center text-center px-1 pt-8 pb-4 space-y-1 min-h-0 w-full z-10">
                            {showHeading && (
                              <div className="w-full flex flex-col items-center shrink-0">
                                <textarea
                                  disabled={!isActive}
                                  value={headingText}
                                  style={customStyle}
                                  onChange={(e) => updateContent({ heading: e.target.value, title: e.target.value })}
                                  placeholder="Enter Slide Title"
                                  rows={headingRows}
                                  className={`${headingClass} ${placeholderColor}`}
                                />
                              </div>
                            )}
                            {showBody && (
                              <div className="w-full flex flex-col items-center min-h-0">
                                <textarea
                                  disabled={!isActive}
                                  value={bodyText}
                                  style={customStyle}
                                  onChange={(e) => updateContent({ body: e.target.value, text: e.target.value })}
                                  placeholder="Enter description text here..."
                                  rows={bodyRows}
                                  className={`${bodyClass} ${placeholderColor}`}
                                />
                              </div>
                            )}
                          </div>
                        );

                        // Image/GIF rendering template
                        const mediaElement = hasImage && (
                          <div
                            className="w-full relative shrink-0 group overflow-hidden rounded-xl"
                            style={{ height: `${imageVolume}%` }}
                          >
                            <div className="w-full h-full overflow-hidden flex items-center justify-center relative bg-black/10 rounded-xl">
                              <img
                                src={activeImageUrl}
                                alt="slide media"
                                style={{ transform: `scale(${imageScale})` }}
                                className={`transition-transform duration-105 ${fullScreenMode === "stretch"
                                    ? "w-full h-full object-fill"
                                    : "w-full h-full object-contain"
                                  }`}
                              />
                            </div>

                            {/* Drag to Resize handle element */}
                            {isActive && (
                              <div
                                onMouseDown={(e) => handleResizeStart(e, index, imageAlign as "top" | "bottom", imageVolume)}
                                onTouchStart={(e) => handleResizeStart(e, index, imageAlign as "top" | "bottom", imageVolume)}
                                className={`absolute left-0 right-0 h-8 flex items-center justify-center cursor-ns-resize group/resizer z-35 select-none no-swipe
                                  ${imageAlign === "top" ? "bottom-0 bg-gradient-to-t" : "top-0 bg-gradient-to-b"}
                                  from-black/50 to-transparent hover:from-black/70 transition-all`}
                              >
                                <div className="bg-white/95 backdrop-blur-xs text-[8px] font-black tracking-wider text-neutral-900 px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 select-none border border-neutral-200 animate-fade-in">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#C8D400] animate-pulse shrink-0" />
                                  DRAG TO RESIZE
                                </div>
                              </div>
                            )}
                          </div>
                        );

                        return (
                          <div className="flex-1 flex flex-col min-h-0 relative h-full">
                            {hasImage && imageAlign === "full" ? (
                              /* Full screen text overlay overlaying top-level cover */
                              <div className="flex-1 flex flex-col justify-center items-center p-2 relative z-10 h-full w-full">
                                {textElements}
                              </div>
                            ) : (
                              /* Normal stacked layouts (Align Top or Align Bottom) */
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
                        );
                      })()}

                      {/* slide type: IMAGE */}
                      {slide.type === "image" && (
                        <div className="flex-1 flex flex-col justify-between py-1 min-h-0 space-y-2.5">
                          {content.url ? (
                            <div className={`w-full aspect-video rounded-xl overflow-hidden shrink-0 relative group border ${isDark ? "bg-black/40 border-white/10" : "bg-black/5 border-black/5"
                              }`}>
                              <img
                                src={content.url}
                                alt="preview"
                                className="w-full h-full object-cover"
                              />
                              {isActive && (
                                <button
                                  type="button"
                                  onClick={() => setActiveMediaOverlayOpen(true)}
                                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] text-white font-bold transition-opacity cursor-pointer gap-1"
                                >
                                  <ImageIcon className="h-3.5 w-3.5" /> Change Image
                                </button>
                              )}

                            </div>
                          ) : (
                            <div className={`w-full aspect-video rounded-xl border border-dashed flex flex-col items-center justify-center text-center p-3 gap-2 shrink-0 relative ${isDark ? "bg-black/40 border-white/15" : "bg-black/5 border-black/10"
                              }`}>
                              <ImageIcon className={`h-6 w-6 ${isDark ? "text-white/40" : "text-[#0B1B4F]/40"}`} />
                              {isActive ? (
                                <button
                                  type="button"
                                  onClick={() => setActiveMediaOverlayOpen(true)}
                                  className="bg-white hover:bg-neutral-100 text-black font-extrabold text-[10px] py-1.5 px-4 rounded-full shadow-md transition-all active:scale-95 cursor-pointer no-swipe"
                                >
                                  + Add Image
                                </button>
                              ) : (
                                <span className={`text-[8px] font-bold ${isDark ? "text-white/40" : "text-[#0B1B4F]/40"}`}>Image pending</span>
                              )}

                            </div>
                          )}
                          <div className="flex-1 flex flex-col min-h-0 text-left space-y-1.5">
                            <input
                              type="text"
                              disabled={!isActive}
                              value={content.heading || content.title || ""}
                              onChange={(e) => updateContent({ heading: e.target.value, title: e.target.value })}
                              placeholder="Image Card Title"
                              className={`bg-transparent border-b border-dashed font-extrabold text-lg md:text-xl focus:outline-none w-full pb-0.5 ${titleColor} ${inputBorder} ${placeholderColor}`}
                            />
                            <textarea
                              disabled={!isActive}
                              value={content.body || content.text || ""}
                              onChange={(e) => updateContent({ body: e.target.value, text: e.target.value })}
                              placeholder="Enter caption text..."
                              className={`bg-transparent border-none text-base md:text-lg focus:outline-none w-full min-h-[90px] resize-none leading-relaxed ${textColor} ${placeholderColor}`}
                            />
                          </div>
                        </div>
                      )}

                      {/* slide type: AUDIO */}
                      {slide.type === "audio" && (
                        <div className="flex-1 flex flex-col justify-between py-1 min-h-0 space-y-2.5">
                          {content.url ? (
                            <div className={`w-full aspect-video rounded-xl shrink-0 relative flex items-center justify-center p-3 group border ${isDark ? "bg-black/40 border-white/10" : "bg-black/5 border-black/5"
                              }`}>
                              <Music className="h-6 w-6 text-[#C8D400]" />
                              {isActive && (
                                <button
                                  type="button"
                                  onClick={() => setActiveMediaOverlayOpen(true)}
                                  className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] text-white font-bold transition-opacity cursor-pointer gap-1"
                                >
                                  <Music className="h-3.5 w-3.5" /> Change Audio
                                </button>
                              )}

                            </div>
                          ) : (
                            <div className={`w-full aspect-video rounded-xl border border-dashed flex flex-col items-center justify-center text-center p-3 gap-2 shrink-0 relative ${isDark ? "bg-black/40 border-white/15" : "bg-black/5 border-black/10"
                              }`}>
                              <Music className={`h-6 w-6 animate-pulse ${isDark ? "text-white/40" : "text-[#0B1B4F]/40"}`} />
                              {isActive ? (
                                <button
                                  type="button"
                                  onClick={() => setActiveMediaOverlayOpen(true)}
                                  className="bg-white hover:bg-neutral-100 text-black font-extrabold text-[10px] py-1.5 px-4 rounded-full shadow-md transition-all active:scale-95 cursor-pointer no-swipe"
                                >
                                  + Add Audio
                                </button>
                              ) : (
                                <span className={`text-[8px] font-bold ${isDark ? "text-white/40" : "text-[#0B1B4F]/40"}`}>Audio pending</span>
                              )}

                            </div>
                          )}
                          <div className="flex-1 flex flex-col min-h-0 text-left space-y-1.5">
                            <input
                              type="text"
                              disabled={!isActive}
                              value={content.heading || content.title || ""}
                              onChange={(e) => updateContent({ heading: e.target.value, title: e.target.value })}
                              placeholder="Audio Card Title"
                              className={`bg-transparent border-b border-dashed font-extrabold text-lg md:text-xl focus:outline-none w-full pb-0.5 ${titleColor} ${inputBorder} ${placeholderColor}`}
                            />
                            <textarea
                              disabled={!isActive}
                              value={content.body || content.text || ""}
                              onChange={(e) => updateContent({ body: e.target.value, text: e.target.value })}
                              placeholder="Enter caption description..."
                              className={`bg-transparent border-none text-base md:text-lg focus:outline-none w-full min-h-[90px] resize-none leading-relaxed ${textColor} ${placeholderColor}`}
                            />
                          </div>
                        </div>
                      )}

                      {/* slide type: VIDEO */}
                      {slide.type === "video" && (
                        <div className="flex-1 flex flex-col justify-between py-1 min-h-0 space-y-2.5">
                          {content.url ? (
                            <div className={`w-full aspect-video rounded-xl overflow-hidden shrink-0 relative group border ${isDark ? "bg-black/40 border-white/10" : "bg-black/5 border-black/5"
                              }`}>
                              <video
                                src={content.url}
                                className="w-full h-full object-cover"
                                muted
                                playsInline
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <Play className="h-6 w-6 text-white/80" />
                              </div>
                              {isActive && (
                                <button
                                  type="button"
                                  onClick={() => setActiveMediaOverlayOpen(true)}
                                  className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] text-white font-bold transition-opacity cursor-pointer gap-1"
                                >
                                  <Film className="h-3.5 w-3.5" /> Change Video
                                </button>
                              )}

                            </div>
                          ) : (
                            <div className={`w-full aspect-video rounded-xl border border-dashed flex flex-col items-center justify-center text-center p-3 gap-2 shrink-0 relative ${isDark ? "bg-black/40 border-white/15" : "bg-black/5 border-black/10"
                              }`}>
                              <Film className={`h-6 w-6 ${isDark ? "text-white/40" : "text-[#0B1B4F]/40"}`} />
                              {isActive ? (
                                <button
                                  type="button"
                                  onClick={() => setActiveMediaOverlayOpen(true)}
                                  className="bg-white hover:bg-neutral-100 text-black font-extrabold text-[10px] py-1.5 px-4 rounded-full shadow-md transition-all active:scale-95 cursor-pointer no-swipe"
                                >
                                  + Add Video
                                </button>
                              ) : (
                                <span className={`text-[8px] font-bold ${isDark ? "text-white/40" : "text-[#0B1B4F]/40"}`}>Video pending</span>
                              )}

                            </div>
                          )}
                          <div className="flex-1 flex flex-col min-h-0 text-left space-y-1.5">
                            <input
                              type="text"
                              disabled={!isActive}
                              value={content.heading || content.title || ""}
                              onChange={(e) => updateContent({ heading: e.target.value, title: e.target.value })}
                              placeholder="Video Card Title"
                              className={`bg-transparent border-b border-dashed font-extrabold text-lg md:text-xl focus:outline-none w-full pb-0.5 ${titleColor} ${inputBorder} ${placeholderColor}`}
                            />
                            <textarea
                              disabled={!isActive}
                              value={content.body || content.text || ""}
                              onChange={(e) => updateContent({ body: e.target.value, text: e.target.value })}
                              placeholder="Enter caption description..."
                              className={`bg-transparent border-none text-base md:text-lg focus:outline-none w-full min-h-[90px] resize-none leading-relaxed ${textColor} ${placeholderColor}`}
                            />
                          </div>
                        </div>
                      )}
                      {/* slide type: QUIZ */}
                      {slide.type === "quiz" && (
                        <div className="flex-1 flex flex-col justify-start min-h-0 pt-1 space-y-3">
                          <div className={`p-2 rounded-xl text-center shrink-0 border ${isDark ? "bg-[#1B2A6B]/30 border-[#1B2A6B]/40 text-white" : "bg-[#0B1B4F]/10 border-[#0B1B4F]/20 text-[#0B1B4F]"
                            }`}>
                            <span className="text-[6.5px] font-black text-[#C8D400] uppercase tracking-wider block">Evaluation Question</span>
                            <textarea
                              disabled={!isActive}
                              value={content.heading || content.question || content.title || ""}
                              onChange={(e) => updateContent({ heading: e.target.value, question: e.target.value, title: e.target.value })}
                              placeholder="Enter Question Prompt"
                              className={`bg-transparent border-none text-center font-bold text-xs md:text-[14px] focus:outline-none w-full resize-none leading-snug mt-0.5 ${isDark ? "text-white placeholder-white/40" : "text-[#0B1B4F] placeholder-[#0B1B4F]/40"
                                }`}
                            />
                          </div>

                          <div className="flex-1 overflow-hidden space-y-2 px-0.5 min-h-0 scrollbar-none">
                            {(content.options || ["", "", "", ""]).map((option, optIdx) => {
                              const isCorrect = (content.correctIndex ?? 0) === optIdx;
                              return (
                                <div
                                  key={optIdx}
                                  className={`w-full p-2 rounded-xl border text-[9px] font-bold flex items-center justify-between gap-1.5 transition-all bg-white/90 backdrop-blur-xs text-[#0B1B4F] border-neutral-200/50 shadow-sm
                                    ${isCorrect
                                      ? "ring-2 ring-[#C8D400] border-[#C8D400]"
                                      : ""
                                    }`}
                                >
                                  <input
                                    type="text"
                                    disabled={!isActive}
                                    value={option}
                                    onChange={(e) => {
                                      const updatedOptions = [...(content.options || [])];
                                      updatedOptions[optIdx] = e.target.value;
                                      updateContent({ options: updatedOptions });
                                    }}
                                    placeholder={`Choice option ${optIdx + 1}`}
                                    className="bg-transparent border-none focus:outline-none text-xs text-[#0B1B4F] placeholder-[#0B1B4F]/40 flex-1 truncate py-0 font-bold"
                                  />
                                  {isActive && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        updateContent({
                                          correctIndex: optIdx,
                                          correctAnswer: option || `Option ${String.fromCharCode(65 + optIdx)}`,
                                        });
                                      }}
                                      className={`h-4 w-4 rounded-full flex items-center justify-center font-black text-[7.5px] shrink-0 transition-colors cursor-pointer border
                                        ${isCorrect
                                          ? "bg-[#C8D400] border-[#C8D400] text-[#0B1B4F]"
                                          : "border-neutral-300 bg-neutral-105 hover:border-[#C8D400] text-[#0B1B4F]/60 hover:text-[#0B1B4F]"
                                        }`}
                                      title="Set as correct answer"
                                    >
                                      ✓
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* slide type: ROLEPLAY (dialogue) — REDESIGNED PODCAST STYLE */}
                      {slide.type === "dialogue" && (
                        <div className="flex-1 flex flex-col justify-start min-h-0 pt-1 space-y-3">

                          {/* Podcast Overlapping Avatars Header */}
                          <div className="flex items-center justify-center shrink-0 py-1.5 relative select-none">
                            {/* Avatar A (Supervisor) */}
                            <div className="w-[68px] h-[68px] bg-neutral-850 border-[3px] border-[#C8D400] rounded-full shadow-xl flex flex-col items-center justify-center relative overflow-hidden group shrink-0">
                              <span className="text-[32px]">👩‍💼</span>
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-70 group-hover:opacity-90">
                                <span className="text-[7.5px] font-bold text-white tracking-widest uppercase">Foreman</span>
                              </div>
                            </div>

                            {/* Avatar B (Worker) */}
                            <div className="w-[68px] h-[68px] bg-neutral-850 border-[3px] border-blue-500 rounded-full shadow-xl flex flex-col items-center justify-center relative overflow-hidden group shrink-0 -ml-4 z-10">
                              <span className="text-[32px]">👷‍♂️</span>
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-70 group-hover:opacity-90">
                                <span className="text-[7.5px] font-bold text-white tracking-widest uppercase">Worker</span>
                              </div>
                            </div>
                          </div>

                          {/* Inline-Editable Heading */}
                          <textarea
                            disabled={!isActive}
                            value={content.heading || ""}
                            onChange={(e) => updateContent({ heading: e.target.value })}
                            placeholder="Dialogue Conversation title..."
                            rows={1}
                            className={`bg-transparent border-b border-dashed text-center font-extrabold text-base md:text-lg focus:outline-none w-full pb-0.5 shrink-0 leading-tight resize-none ${titleColor} ${inputBorder} ${placeholderColor}`}
                          />

                          {/* Dialogue conversation lines list scroll viewport */}
                          <div className="flex-1 overflow-hidden space-y-2 px-1 py-1 flex flex-col min-h-0 scrollbar-none">
                            {(content.dialogueLines || []).map((line, idx) => {
                              const charName = line.character.toLowerCase();
                              const isSupervisor =
                                charName.includes("supervisor") ||
                                charName.includes("foreman") ||
                                charName.includes("inspector") ||
                                charName.includes("chief");
                              return (
                                <div
                                  key={idx}
                                  className={`flex flex-col max-w-[85%] relative group/row ${isSupervisor ? "items-start self-start" : "items-end self-end ml-auto"
                                    }`}
                                >
                                  <div className="flex items-center gap-1.5 mb-0.5 px-0.5">
                                    <input
                                      type="text"
                                      disabled={!isActive}
                                      value={line.character}
                                      onChange={(e) => {
                                        const updatedLines = [...(content.dialogueLines || [])];
                                        updatedLines[idx] = { ...updatedLines[idx], character: e.target.value };
                                        updateContent({ dialogueLines: updatedLines });
                                      }}
                                      className={`bg-transparent border-none text-[11px] font-bold focus:outline-none w-20 ${isDark ? "text-white/60" : "text-[#0B1B4F]/60"
                                        }`}
                                    />
                                    {isActive && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updatedLines = (content.dialogueLines || []).filter((_, i) => i !== idx);
                                          updateContent({ dialogueLines: updatedLines });
                                        }}
                                        className={`h-3.5 w-3.5 rounded-full flex items-center justify-center text-[8px] opacity-0 group-hover/row:opacity-100 transition-opacity ${isDark
                                            ? "bg-black/35 hover:bg-red-500/10 text-white/50 hover:text-red-500"
                                            : "bg-black/5 hover:bg-red-500/10 text-[#0B1B4F]/50 hover:text-red-500"
                                          }`}
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>
                                  <textarea
                                    disabled={!isActive}
                                    value={line.text}
                                    onChange={(e) => {
                                      const updatedLines = [...(content.dialogueLines || [])];
                                      updatedLines[idx] = { ...updatedLines[idx], text: e.target.value };
                                      updateContent({ dialogueLines: updatedLines });
                                    }}
                                    placeholder="Enter dialogue script line..."
                                    className={`p-2 rounded-xl text-xs md:text-sm leading-snug resize-none w-full min-h-[40px] focus:outline-none focus:ring-1
                                      ${isSupervisor
                                        ? "bg-white/90 backdrop-blur-xs text-[#0B1B4F] rounded-tl-none border border-neutral-200/50 shadow-sm focus:ring-[#C8D400] placeholder-[#0B1B4F]/50 font-medium"
                                        : "bg-blue-600/90 backdrop-blur-xs text-white rounded-tr-none border border-blue-500/20 focus:ring-blue-500 placeholder-white/50 font-medium"
                                      }`}
                                  />
                                </div>
                              );
                            })}

                            {isActive && (
                              <button
                                type="button"
                                onClick={() => {
                                  const lines = [...(content.dialogueLines || [])];
                                  lines.push({ character: "Worker", text: "" });
                                  updateContent({ dialogueLines: lines });
                                }}
                                className={`w-full border border-dashed text-[10px] py-1.5 rounded-lg gap-1 flex items-center justify-center shrink-0 cursor-pointer transition-colors ${isDark
                                    ? "border-white/20 hover:border-[#C8D400]/40 text-white/60 hover:text-white"
                                    : "border-[#0B1B4F]/20 hover:border-[#C8D400]/40 text-[#0B1B4F]/60 hover:text-[#0B1B4F]"
                                  }`}
                              >
                                + Add Dialogue script line
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* slide type: CHAT (simulated iMessage/Telegram layout) */}
                      {slide.type === "chat" && (
                        <div className={`flex-1 flex flex-col justify-start min-h-0 pt-0.5 rounded-xl relative border ${isDark ? "bg-black/45 border-white/5" : "bg-black/5 border-black/5"
                          }`}>
                          {/* Chat bubble header */}
                          <div className={`py-1.5 px-2 rounded-t-xl text-center shrink-0 mb-1 border-b ${isDark ? "bg-black/35 border-white/5" : "bg-black/10 border-black/5"
                            }`}>
                            <input
                              type="text"
                              disabled={!isActive}
                              value={content.heading || ""}
                              onChange={(e) => updateContent({ heading: e.target.value })}
                              placeholder="Chat Scenario title"
                              className={`bg-transparent border-none text-center font-extrabold text-xs md:text-sm focus:outline-none w-full ${isDark ? "text-white placeholder-white/40" : "text-[#0B1B4F] placeholder-[#0B1B4F]/40"
                                }`}
                            />
                          </div>

                          <div className="flex-1 overflow-hidden space-y-2 px-1.5 pb-2 flex flex-col min-h-0 scrollbar-none">
                            {(content.chatBubbles || []).map((bubble: any, bIdx: number) => {
                              const alignLeft = bubble.align === "left";
                              return (
                                <div
                                  key={bubble.id || bIdx}
                                  className={`flex flex-col max-w-[85%] relative group/chatbubble ${alignLeft ? "self-start items-start" : "self-end items-end ml-auto"
                                    }`}
                                >
                                  {/* Align & type triggers visible on hover when active */}
                                  {isActive && (
                                    <div className={`absolute top-[-10px] right-0 flex items-center border rounded-md p-0.5 gap-1 opacity-0 group-hover/chatbubble:opacity-100 transition-opacity z-20 shadow-lg ${isDark ? "bg-neutral-900 border-neutral-800 text-white" : "bg-white border-neutral-200 text-[#0B1B4F]"
                                      }`}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updatedBubbles = [...(content.chatBubbles || [])];
                                          updatedBubbles[bIdx] = {
                                            ...updatedBubbles[bIdx],
                                            align: alignLeft ? "right" : "left",
                                          };
                                          updateContent({ chatBubbles: updatedBubbles });
                                        }}
                                        className="text-[6.5px] font-bold uppercase text-[#C8D400] hover:scale-105 px-1 rounded transition-transform"
                                        title="Toggle side"
                                      >
                                        Flip
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updatedBubbles = (content.chatBubbles || []).filter((_, i) => i !== bIdx);
                                          updateContent({ chatBubbles: updatedBubbles });
                                        }}
                                        className="text-red-500 hover:scale-105 text-[6.5px] px-1 transition-transform"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  )}

                                  {bubble.type === "text" && (
                                    <textarea
                                      disabled={!isActive}
                                      value={bubble.text || ""}
                                      onChange={(e) => {
                                        const updatedBubbles = [...(content.chatBubbles || [])];
                                        updatedBubbles[bIdx] = { ...updatedBubbles[bIdx], text: e.target.value };
                                        updateContent({ chatBubbles: updatedBubbles });
                                      }}
                                      placeholder="Type speech bubble..."
                                      className={`px-2 py-1.5 rounded-2xl text-[10px] md:text-xs leading-tight focus:outline-none resize-none min-h-[36px] w-full
                                        ${alignLeft
                                          ? "bg-white/90 backdrop-blur-xs text-[#0B1B4F] rounded-tl-none border border-neutral-200/50 shadow-sm focus:ring-1 focus:ring-[#C8D400] placeholder-[#0B1B4F]/50 font-bold"
                                          : "bg-blue-600/90 backdrop-blur-xs text-white rounded-tr-none border border-blue-500/20 focus:ring-1 focus:ring-blue-400 placeholder-white/50"
                                        }`}
                                    />
                                  )}

                                  {bubble.type === "image" && (
                                    <div
                                      className={`p-0.5 rounded-xl overflow-hidden border shadow-sm ${alignLeft ? "bg-white/95 border-neutral-200/50" : "bg-blue-600/90 border-blue-500/20"
                                        }`}
                                    >
                                      {bubble.url ? (
                                        <img
                                          src={bubble.url}
                                          alt="bubble"
                                          className="w-[100px] aspect-video object-cover rounded-lg"
                                        />
                                      ) : (
                                        <div className="w-[100px] h-10 bg-neutral-900 rounded-lg flex items-center justify-center">
                                          <ImageIcon className="h-3.5 w-3.5 text-neutral-500" />
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            {isActive && (
                              <button
                                type="button"
                                onClick={() => {
                                  const bubbles = [...(content.chatBubbles || [])];
                                  bubbles.push({
                                    id: Math.random().toString(36).substring(7),
                                    align: "left",
                                    type: "text",
                                    text: "",
                                  });
                                  updateContent({ chatBubbles: bubbles });
                                }}
                                className={`w-full border border-dashed text-[8px] py-1 rounded-lg gap-1 flex items-center justify-center shrink-0 cursor-pointer transition-colors ${isDark
                                    ? "border-white/20 hover:border-[#C8D400]/40 text-white/60 hover:text-white"
                                    : "border-[#0B1B4F]/20 hover:border-[#C8D400]/40 text-[#0B1B4F]/60 hover:text-[#0B1B4F]"
                                  }`}
                              >
                                + Add message bubble
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* slide type: POLL / RATE */}
                      {slide.type === "poll" && (
                        <div className="flex-1 flex flex-col justify-start min-h-0 pt-1 space-y-3">
                          <div className={`p-2 rounded-xl text-center shrink-0 border ${isDark ? "bg-black/35 border-white/5" : "bg-black/10 border-black/5"
                            }`}>
                            <span className="text-[6.5px] font-bold text-[#C8D400] uppercase block">Feedback Poll</span>
                            <input
                              type="text"
                              disabled={!isActive}
                              value={content.heading || ""}
                              onChange={(e) => updateContent({ heading: e.target.value })}
                              placeholder="Enter Rating/CSAT question"
                              className={`bg-transparent border-none text-center font-extrabold text-xs md:text-sm focus:outline-none w-full ${isDark ? "text-white placeholder-white/40" : "text-[#0B1B4F] placeholder-[#0B1B4F]/40"
                                }`}
                            />
                          </div>

                          {/* Poll Rating widget render */}
                          <div className="flex-1 flex flex-col justify-center items-center px-1 space-y-3">

                            {/* Star Selection widget configure */}
                            {content.pollType === "stars" && (
                              <div className="flex gap-1.5 items-center py-2 shrink-0">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star
                                    key={s}
                                    onClick={() => {
                                      if (isActive) {
                                        toast.success(`Star Rating set to ${s}!`);
                                      }
                                    }}
                                    className="h-6 w-6 text-amber-500 fill-amber-500/20 hover:scale-110 transition-transform cursor-pointer shrink-0"
                                  />
                                ))}
                              </div>
                            )}

                            {/* Emoji selector CSAT widget configure */}
                            {content.pollType === "emojis" && (
                              <div className="flex gap-2.5 items-center py-2 text-xl shrink-0">
                                <span className={`p-1 rounded-full hover:scale-110 transition-transform cursor-pointer shrink-0 ${isDark ? "bg-white/10 hover:bg-white/20" : "bg-black/5 hover:bg-black/10"
                                  }`}>😠</span>
                                <span className={`p-1 rounded-full hover:scale-110 transition-transform cursor-pointer shrink-0 ${isDark ? "bg-white/10 hover:bg-white/20" : "bg-black/5 hover:bg-black/10"
                                  }`}>🙁</span>
                                <span className={`p-1 rounded-full hover:scale-110 transition-transform cursor-pointer shrink-0 ${isDark ? "bg-white/10 hover:bg-white/20" : "bg-black/5 hover:bg-black/10"
                                  }`}>😐</span>
                                <span className={`p-1 rounded-full hover:scale-110 transition-transform cursor-pointer shrink-0 ${isDark ? "bg-white/10 hover:bg-white/20" : "bg-black/5 hover:bg-black/10"
                                  }`}>🙂</span>
                                <span className="p-1.5 rounded-full bg-[#C8D400]/20 text-[#C8D400] font-bold hover:scale-110 transition-transform cursor-pointer shrink-0">🤩</span>
                              </div>
                            )}

                            {/* Custom Choice option list inline editing */}
                            {content.pollType === "options" && (
                              <div className="w-full space-y-2 max-h-[170px] overflow-hidden pr-0.5 scrollbar-none">
                                {(content.options || ["Choice 1", "Choice 2"]).map((opt, oIdx) => {
                                  const percentages = [58, 28, 14, 0, 0, 0];
                                  const mockPct = percentages[oIdx] ?? 0;
                                  return (
                                    <div
                                      key={oIdx}
                                      className="relative w-full h-6 rounded-lg overflow-hidden border flex items-center justify-between px-2 text-[7.5px] bg-white/90 backdrop-blur-xs border-neutral-200/50 shadow-sm"
                                    >
                                      <div
                                        className="absolute left-0 top-0 bottom-0 bg-[#C8D400]/30 transition-all"
                                        style={{ width: `${mockPct}%` }}
                                      />
                                      <input
                                        type="text"
                                        disabled={!isActive}
                                        value={opt}
                                        onChange={(e) => {
                                          const updatedOptions = [...(content.options || [])];
                                          updatedOptions[oIdx] = e.target.value;
                                          updateContent({ options: updatedOptions });
                                        }}
                                        placeholder={`Choice option ${oIdx + 1}`}
                                        className="bg-transparent border-none text-[8px] text-[#0B1B4F] focus:outline-none flex-1 truncate font-semibold z-10 py-0 placeholder-[#0B1B4F]/40"
                                      />
                                      <span className="font-extrabold text-[#0B1B4F] z-10 shrink-0 select-none ml-1">
                                        {mockPct}%
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Selector to switch poll configuration right on the active card */}
                            {isActive && (
                              <div className={`flex gap-1.5 border p-1 rounded-xl justify-center shrink-0 w-full ${isDark ? "border-white/10 bg-black/45" : "border-black/5 bg-black/5"
                                }`}>
                                <button
                                  type="button"
                                  onClick={() => updateContent({ pollType: "stars" })}
                                  className={`text-[8px] px-2 py-1 rounded-lg font-bold border transition-colors cursor-pointer ${content.pollType === "stars"
                                      ? "bg-[#C8D400]/25 border-[#C8D400]/40 text-[#C8D400]"
                                      : (isDark ? "bg-transparent border-transparent text-white/60 hover:text-white" : "bg-transparent border-transparent text-[#0B1B4F]/60 hover:text-[#0B1B4F]")
                                    }`}
                                >
                                  Stars
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateContent({ pollType: "emojis" })}
                                  className={`text-[8px] px-2 py-1 rounded-lg font-bold border transition-colors cursor-pointer ${content.pollType === "emojis"
                                      ? "bg-[#C8D400]/25 border-[#C8D400]/40 text-[#C8D400]"
                                      : (isDark ? "bg-transparent border-transparent text-white/60 hover:text-white" : "bg-transparent border-transparent text-[#0B1B4F]/60 hover:text-[#0B1B4F]")
                                    }`}
                                >
                                  Emojis
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    updateContent({
                                      pollType: "options",
                                      options: content.options?.length ? content.options : ["Agree", "Disagree"],
                                    });
                                  }}
                                  className={`text-[8px] px-2 py-1 rounded-lg font-bold border transition-colors cursor-pointer ${content.pollType === "options"
                                      ? "bg-[#C8D400]/25 border-[#C8D400]/40 text-[#C8D400]"
                                      : (isDark ? "bg-transparent border-transparent text-white/60 hover:text-white" : "bg-transparent border-transparent text-[#0B1B4F]/60 hover:text-[#0B1B4F]")
                                    }`}
                                >
                                  Choices
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                    </div>
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

      {/* 2. DYNAMIC TEXT CARD LAYOUT DRAWER (Renders right under the card deck for active slide) */}
      {activeSlideIndex !== null && slidesList[activeSlideIndex]?.type === "text" && (() => {
        const slide = slidesList[activeSlideIndex];
        const content = slide.content || {};
        const showHeading = content.showHeading !== false;
        const showBody = content.showBody !== false;
        const imageScale = content.imageScale ?? 1.0;
        const imageVolume = content.imageVolume ?? 40;
        const imageAlign = content.imageAlign ?? "top";
        const fullScreenMode = content.fullScreenMode ?? "fill";
        const hasImage = !!content.imageUrl || !!content.url;

        const updateContent = (fields: any) => {
          onUpdateSlideContent(activeSlideIndex, fields);
        };

        const controlBtnClass = `p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center shrink-0 w-9 h-9 ${isDark
            ? "bg-black/40 hover:bg-black/60 border-white/10 text-white/60 hover:text-white hover:border-[#C8D400]"
            : "bg-white/80 hover:bg-white/95 border-neutral-200/50 text-[#0B1B4F]/60 hover:text-[#0B1B4F] hover:border-[#C8D400]"
          }`;

        return (
          <div className="flex flex-col items-center justify-center w-full z-20 gap-2 mb-2 mt-[-16px] animate-fade-in no-swipe">

            {/* Row 1: Premium Icon-Only Toggle Buttons */}
            <div className="flex gap-3 justify-center items-center py-1">
              <button
                type="button"
                onClick={() => updateContent({ showHeading: !showHeading })}
                className={`${controlBtnClass} ${showHeading ? "border-[#C8D400] text-[#C8D400] bg-[#C8D400]/10" : ""}`}
                title={showHeading ? "Disable Title (Heading)" : "Enable Title (Heading)"}
              >
                <Type className="h-4.5 w-4.5 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => updateContent({ showBody: !showBody })}
                className={`${controlBtnClass} ${showBody ? "border-[#C8D400] text-[#C8D400] bg-[#C8D400]/10" : ""}`}
                title={showBody ? "Disable Text (Body)" : "Enable Text (Body)"}
              >
                <FileText className="h-4.5 w-4.5 shrink-0" />
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (hasImage) {
                      setImageToolsOpen(!imageToolsOpen);
                    } else {
                      setActiveMediaOverlayOpen(true);
                    }
                  }}
                  className={`${controlBtnClass} ${hasImage
                      ? imageToolsOpen
                        ? "bg-[#C8D400] text-black border-[#C8D400] hover:bg-[#C8D400]/90"
                        : "border-[#C8D400] text-[#C8D400] bg-[#C8D400]/10"
                      : ""
                    }`}
                  title={hasImage ? "Toggle Image Config Options" : "Add Image / animated GIF"}
                >
                  <ImageIcon className="h-4.5 w-4.5 shrink-0" />
                </button>
              </div>
            </div>

            {/* Row 2: Sub-panel when image is loaded and tools are active */}
            {hasImage && imageToolsOpen && (() => {
              const panelBg = isDark
                ? "bg-neutral-950/95 border-neutral-800 text-white"
                : "bg-white/95 border-neutral-200 text-[#0B1B4F]";
              const rowBg = isDark
                ? "bg-neutral-900/60 border-neutral-800/80"
                : "bg-neutral-50/80 border-neutral-200";
              const mutedIcon = isDark ? "text-neutral-400" : "text-[#0B1B4F]/50";
              const inactiveBtn = isDark ? "text-neutral-400 hover:text-white" : "text-[#0B1B4F]/50 hover:text-[#0B1B4F]";
              const changeBtn = isDark
                ? "bg-neutral-900 hover:bg-[#C8D400]/10 border-neutral-800 hover:border-[#C8D400]/40 text-neutral-200 hover:text-white"
                : "bg-neutral-100 hover:bg-[#C8D400]/10 border-neutral-200 hover:border-[#C8D400]/40 text-[#0B1B4F]/70 hover:text-[#0B1B4F]";
              return (
                <div className={`w-full max-w-xs border rounded-2xl p-3 shadow-2xl z-20 gap-3 mt-1.5 animate-slide-up flex flex-col no-swipe backdrop-blur-md ${panelBg}`}>

                  {/* Row A: Zoom Slider with ZoomOut / ZoomIn icons */}
                  <div className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-xl border ${rowBg}`}>
                    <ZoomOut className={`h-3.5 w-3.5 shrink-0 ${mutedIcon}`} />
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.05"
                      value={imageScale}
                      onChange={(e) => updateContent({ imageScale: parseFloat(e.target.value) })}
                      className={`flex-1 h-1 rounded-lg appearance-none cursor-pointer accent-[#C8D400] ${isDark ? "bg-neutral-800" : "bg-neutral-200"}`}
                      title="Zoom"
                    />
                    <ZoomIn className={`h-3.5 w-3.5 shrink-0 ${mutedIcon}`} />
                    <span className="text-[10px] font-black text-[#C8D400] w-8 text-right shrink-0">{Math.round(imageScale * 100)}%</span>
                  </div>

                  {/* Row B: Alignment and Actions in a single horizontal row! */}
                  <div className="flex items-center gap-2 justify-between w-full">
                    {/* Alignments group */}
                    <div className={`flex items-center gap-1 p-1 rounded-xl border ${rowBg}`}>
                      <button
                        type="button"
                        onClick={() => updateContent({ imageAlign: "top" })}
                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${imageAlign === "top"
                            ? "bg-[#C8D400] text-[#1B2A6B]"
                            : inactiveBtn
                          }`}
                        title="Image at Top"
                      >
                        <PanelTop className="h-4 w-4 shrink-0" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateContent({ imageAlign: "bottom" })}
                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${imageAlign === "bottom"
                            ? "bg-[#C8D400] text-[#1B2A6B]"
                            : inactiveBtn
                          }`}
                        title="Image at Bottom"
                      >
                        <PanelBottom className="h-4 w-4 shrink-0" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateContent({ imageAlign: "full" })}
                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${imageAlign === "full"
                            ? "bg-[#C8D400] text-[#1B2A6B]"
                            : inactiveBtn
                          }`}
                        title="Full Screen"
                      >
                        <Maximize2 className="h-4 w-4 shrink-0" />
                      </button>
                    </div>

                    {/* Fill/Stretch mode selector if "full" is selected */}
                    {imageAlign === "full" && (
                      <div className={`flex items-center gap-1 p-1 rounded-xl border animate-fade-in ${rowBg}`}>
                        <button
                          type="button"
                          onClick={() => updateContent({ fullScreenMode: "fill" })}
                          className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase transition-all cursor-pointer ${fullScreenMode === "fill"
                              ? "bg-[#C8D400]/25 text-[#C8D400]"
                              : inactiveBtn
                            }`}
                          title="Fill Screen (Aspect Cover)"
                        >
                          Cover
                        </button>
                        <button
                          type="button"
                          onClick={() => updateContent({ fullScreenMode: "stretch" })}
                          className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase transition-all cursor-pointer ${fullScreenMode === "stretch"
                              ? "bg-[#C8D400]/25 text-[#C8D400]"
                              : inactiveBtn
                            }`}
                          title="Stretch Screen"
                        >
                          Stretch
                        </button>
                      </div>
                    )}

                    {/* Actions: Change and Remove */}
                    <div className="flex items-center gap-1.5 ml-auto">
                      <button
                        type="button"
                        onClick={() => setActiveMediaOverlayOpen(true)}
                        className={`p-1.5 border rounded-xl transition-all cursor-pointer ${changeBtn}`}
                        title="Change Image"
                      >
                        <Upload className="h-4 w-4 shrink-0" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateContent({
                            imageUrl: undefined,
                            url: undefined,
                            imageScale: undefined,
                            imageVolume: undefined,
                            imageAlign: undefined,
                            fullScreenMode: undefined,
                          })
                        }
                        className="p-1.5 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 hover:border-red-500/40 rounded-xl text-red-400 hover:text-red-300 transition-all cursor-pointer"
                        title="Remove Image"
                      >
                        <Trash2 className="h-4 w-4 shrink-0" />
                      </button>
                    </div>
                  </div>

                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* Media picker — between icon controls / image-tools panel and numbers bar */}
      {activeMediaOverlayOpen && (
        <div className="flex justify-center w-full animate-slide-up no-swipe">
          {renderMinimalistMediaPicker(slidesList[activeSlideIndex ?? 0]?.type || 'text')}
        </div>
      )}

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

        <div className="flex gap-1.5">
          {slidesList.map((_, sIdx) => {
            const isActive = activeSlideIndex === sIdx;
            return (
              <button
                key={sIdx}
                type="button"
                onClick={() => {
                  if (emblaApi) emblaApi.scrollTo(sIdx);
                }}
                className={`h-6 min-w-[24px] px-1.5 flex items-center justify-center rounded-full text-xs font-black transition-all cursor-pointer
                  ${isActive
                    ? "bg-[#C8D400] text-[#1B2A6B] scale-105"
                    : "bg-background/80 hover:bg-muted text-muted-foreground"
                  }`}
              >
                {sIdx + 1}
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
