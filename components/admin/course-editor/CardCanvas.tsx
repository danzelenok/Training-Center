"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures";
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
  GripVertical,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Copy,
  Play,
  Pause,
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
  Sparkles,
  RefreshCw,
  Mic,
  SlidersHorizontal,
  ArrowLeft,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const DIALOGUE_AVATARS = [
  "👩‍💼","👷‍♂️","👨‍💼","👩‍🔬","👨‍🔬","👩‍🏭","👨‍🏭","👮‍♀️","👮‍♂️",
  "🧑‍⚕️","👩‍⚕️","👨‍⚕️","🧑‍🏫","👩‍🏫","👷‍♀️","👩‍🚒","👨‍🚒","🧑‍✈️",
];

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
    chatVolume?: number;
    belowType?: "none" | "image" | "text";
    pollType?: "stars" | "emojis" | "thumbs";
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
    videoMode?: "upload" | "generate";
    avatarId?: string;
    speechText?: string;
    captions?: string;
    forceCompletion?: boolean;
    audioMode?: "upload" | "generate" | "record";
    voiceId?: string;
    avatarA?: string;
    avatarB?: string;
    labelA?: string;
    labelB?: string;
    scriptA?: string;
    scriptB?: string;
    dialogueBelowType?: "none" | "quiz" | "text";
    belowQuizQuestion?: string;
    belowQuizOptions?: string[];
    belowQuizCorrectIndex?: number;
    belowQuizCorrectAnswer?: string;
    belowQuizExplanation?: string;
    belowHeading?: string;
    belowText?: string;
    assetUrl?: string;
  };
  order: number;
  language?: string;
  assetStatus?: "pending" | "generating" | "ready" | "failed";
}

interface CardCanvasProps {
  slidesList: Slide[];
  activeSlideIndex: number | null;
  setActiveSlideIndex: (idx: number) => void;
  onReorderSlides: (newList: Slide[]) => void;
  onDeleteSlide: (idx: number) => void;
  onDuplicateSlide: (idx: number) => void;
  onUpdateSlideContent: (idx: number, updatedFields: any, slideFields?: any) => void;
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
  const options = useMemo(() => ({
    align: "center",
    containScroll: false,
    dragFree: false,
    watchSlides: true,
    skipSnaps: true, // Allow skipping snaps for a smooth drum-like spin across multiple slides!
  } as const), []);

  const plugins = useMemo(() => [WheelGesturesPlugin()], []);

  const [emblaRef, emblaApi] = useEmblaCarousel(options, plugins);

  // Prevent trackpad rubber-band bounce overshoot at boundaries
  useEffect(() => {
    if (!emblaApi) return;
    const viewportNode = emblaApi.rootNode();

    const handleBoundaryWheel = (e: WheelEvent) => {
      // Focus solely on horizontal swiping
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        const isAtFirst = activeSlideIndex === 0;
        const isAtLast = activeSlideIndex === slidesList.length - 1;

        // e.deltaX < 0: swiping left-to-right (trying to go before the first card)
        // e.deltaX > 0: swiping right-to-left (trying to go beyond the last card)
        if ((isAtFirst && e.deltaX < 0) || (isAtLast && e.deltaX > 0)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    // Intercept in capture phase before WheelGesturesPlugin receives the event
    viewportNode.addEventListener("wheel", handleBoundaryWheel, { passive: false, capture: true });

    return () => {
      viewportNode.removeEventListener("wheel", handleBoundaryWheel, { capture: true });
    };
  }, [emblaApi, activeSlideIndex, slidesList.length]);

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

  // Quiz Option drag & drop states
  const [draggedOptIdx, setDraggedOptIdx] = useState<number | null>(null);
  const draggedOptIdxRef = useRef<number | null>(null);
  const optionKeysRef = useRef<{ [slideIdOrIndex: string]: string[] }>({});
  const [dragOverOptIdx, setDragOverOptIdx] = useState<number | null>(null);

  // Dialogue Line drag & drop states
  const [draggedLineIdx, setDraggedLineIdx] = useState<number | null>(null);
  const draggedLineIdxRef = useRef<number | null>(null);
  const lineKeysRef = useRef<{ [slideIdOrIndex: string]: string[] }>({});

  // Auto-scroll on drag refs
  const scrollAnimationRef = useRef<number | null>(null);
  const scrollDirectionRef = useRef<"left" | "right" | null>(null);



  // New States and Refs for Card Resizing and Image Settings
  const [imageToolsOpen, setImageToolsOpen] = useState(false);
  const [isVideoConfigOpen, setIsVideoConfigOpen] = useState(false);
  const [playingSlides, setPlayingSlides] = useState<{ [slideId: string]: boolean }>({});
  const [isGeneratingCaptions, setIsGeneratingCaptions] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [videoToolsOpen, setVideoToolsOpen] = useState(false);
  const [captionsToolsOpen, setCaptionsToolsOpen] = useState(false);
  // Tooltip overflow warning states
  const [warningCollapsed, setWarningCollapsed] = useState(false);
  const resizeRef = useRef<{
    startY: number;
    startVolume: number;
    slideIndex: number;
    align: "top" | "bottom";
  } | null>(null);

  // Chat slide resize
  const [isChatResizing, setIsChatResizing] = useState(false);
  const chatResizeRef = useRef<{
    startY: number;
    startVolume: number;
    slideIndex: number;
  } | null>(null);

  // Dialogue avatar picker state
  const [avatarPickerOpen, setAvatarPickerOpen] = useState<{ slideId: string; side: "A" | "B" } | null>(null);

  // Audio slide specific states & refs
  const [audioToolsOpen, setAudioToolsOpen] = useState(false);
  const [audioTranscriptToolsOpen, setAudioTranscriptToolsOpen] = useState(false);
  const [isAudioGenerating, setIsAudioGenerating] = useState(false);
  
  // Custom audio player playback states (mapped by slide ID)
  const [audioPlaying, setAudioPlaying] = useState<{ [slideId: string]: boolean }>({});
  const [audioCurrentTime, setAudioCurrentTime] = useState<{ [slideId: string]: number }>({});
  const [audioDuration, setAudioDuration] = useState<{ [slideId: string]: number }>({});
  const [audioSpeed, setAudioSpeed] = useState<{ [slideId: string]: number }>({});
  const [isCCActive, setIsCCActive] = useState<{ [slideId: string]: boolean }>({});

  // Direct microphone recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Close tools on slide change
  useEffect(() => {
    setAvatarPickerOpen(null);
    setImageToolsOpen(false);
    setWarningCollapsed(false);
    setIsVideoConfigOpen(false);
    setVideoToolsOpen(false);
    setCaptionsToolsOpen(false);
    setAudioToolsOpen(false);
    setAudioTranscriptToolsOpen(false);

    // Stop recording if active and user changes slide
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch (err) {}
      }
      setIsRecording(false);
    }
    setRecordingTime(0);
    setAudioBlobUrl(null);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
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

  // Handle snapping focus state from Embla swipes
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

  const handleOptDragStart = (idx: number, e: React.DragEvent) => {
    e.stopPropagation();
    setDraggedOptIdx(idx);
    draggedOptIdxRef.current = idx;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", idx.toString());

    // Use e.currentTarget to find the local option container, avoiding global document queries
    const rowEl = e.currentTarget.closest("[data-opt-index]");
    if (rowEl) {
      // Temporarily style rowEl to have elevated shadow for the captured drag image
      rowEl.classList.add("shadow-2xl", "scale-[1.02]", "border-[#C8D400]/80", "ring-2", "ring-[#C8D400]/25");

      e.dataTransfer.setDragImage(rowEl, 20, 24);

      // Instantly restore original styling so the in-place placeholder doesn't look lifted
      setTimeout(() => {
        rowEl.classList.remove("shadow-2xl", "scale-[1.02]", "border-[#C8D400]/80", "ring-2", "ring-[#C8D400]/25");
      }, 0);
    }
  };

  const handleOptDragOver = (
    idx: number,
    e: React.DragEvent,
    currentOptions: string[],
    correctIndex: number,
    updateContentFn: (fields: any) => void,
    slideKey: string
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const currentDraggedIdx = draggedOptIdxRef.current;
    if (currentDraggedIdx !== null && currentDraggedIdx !== idx) {
      const updatedOptions = [...currentOptions];
      const [draggedItem] = updatedOptions.splice(currentDraggedIdx, 1);
      updatedOptions.splice(idx, 0, draggedItem);

      // Reorder stable keys synchronously alongside options to maintain React element identity
      const slideKeys = optionKeysRef.current[slideKey];
      if (slideKeys && slideKeys[currentDraggedIdx] !== undefined) {
        const updatedKeys = [...slideKeys];
        const [draggedKey] = updatedKeys.splice(currentDraggedIdx, 1);
        updatedKeys.splice(idx, 0, draggedKey);
        optionKeysRef.current[slideKey] = updatedKeys;
      }

      let newCorrectIdx = correctIndex;
      if (correctIndex === currentDraggedIdx) {
        newCorrectIdx = idx;
      } else {
        if (currentDraggedIdx < correctIndex && correctIndex <= idx) {
          newCorrectIdx = correctIndex - 1;
        } else if (idx <= correctIndex && correctIndex < currentDraggedIdx) {
          newCorrectIdx = correctIndex + 1;
        }
      }

      updateContentFn({
        options: updatedOptions,
        correctIndex: newCorrectIdx,
        correctAnswer: updatedOptions[newCorrectIdx] || `Option ${String.fromCharCode(65 + newCorrectIdx)}`
      });

      draggedOptIdxRef.current = idx;
      setDraggedOptIdx(idx);
    }
  };

  const handleOptDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedOptIdx(null);
    draggedOptIdxRef.current = null;
    setDragOverOptIdx(null);
    if (emblaApi) {
      emblaApi.reInit({ watchDrag: true });
    }
  };

  const handleOptDragEnd = (e: React.DragEvent) => {
    e.stopPropagation();
    setDraggedOptIdx(null);
    draggedOptIdxRef.current = null;
    setDragOverOptIdx(null);
    if (emblaApi) {
      emblaApi.reInit({ watchDrag: true });
    }
  };

  const handleLineDragStart = (idx: number, e: React.DragEvent) => {
    e.stopPropagation();
    setDraggedLineIdx(idx);
    draggedLineIdxRef.current = idx;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", idx.toString());

    const rowEl = e.currentTarget.closest("[data-line-index]");
    if (rowEl) {
      rowEl.classList.add("shadow-2xl", "scale-[1.02]", "border-[#C8D400]/80", "ring-2", "ring-[#C8D400]/25");
      e.dataTransfer.setDragImage(rowEl, 20, 24);
      setTimeout(() => {
        rowEl.classList.remove("shadow-2xl", "scale-[1.02]", "border-[#C8D400]/80", "ring-2", "ring-[#C8D400]/25");
      }, 0);
    }
  };

  const handleLineDragOver = (
    idx: number,
    e: React.DragEvent,
    currentLines: { character: string; text: string }[],
    updateContentFn: (fields: any) => void,
    slideKey: string
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const currentDraggedIdx = draggedLineIdxRef.current;
    if (currentDraggedIdx !== null && currentDraggedIdx !== idx) {
      const updatedLines = [...currentLines];
      const [draggedItem] = updatedLines.splice(currentDraggedIdx, 1);
      updatedLines.splice(idx, 0, draggedItem);

      // Reorder stable keys
      const slideKeys = lineKeysRef.current[slideKey];
      if (slideKeys && slideKeys[currentDraggedIdx] !== undefined) {
        const updatedKeys = [...slideKeys];
        const [draggedKey] = updatedKeys.splice(currentDraggedIdx, 1);
        updatedKeys.splice(idx, 0, draggedKey);
        lineKeysRef.current[slideKey] = updatedKeys;
      }

      updateContentFn({
        dialogueLines: updatedLines
      });

      draggedLineIdxRef.current = idx;
      setDraggedLineIdx(idx);
    }
  };

  const handleLineDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedLineIdx(null);
    draggedLineIdxRef.current = null;
    if (emblaApi) {
      emblaApi.reInit({ watchDrag: true });
    }
  };

  const handleLineDragEnd = (e: React.DragEvent) => {
    e.stopPropagation();
    setDraggedLineIdx(null);
    draggedLineIdxRef.current = null;
    if (emblaApi) {
      emblaApi.reInit({ watchDrag: true });
    }
  };



  return (
    <div className="flex flex-col items-center gap-4 w-full select-none justify-center">
      {/* Decoupled premium card animations stylesheet */}
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
          <div className={`flex select-none items-center transition-[padding,gap] duration-300 ${draggedIdx !== null
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
                  key={slide.id || index}
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
                  className={`flex-shrink-0 relative transition-[width,height,opacity,filter,box-shadow] duration-300 ease-out snap-center rounded-[24px] animate-card-mount
                    ${draggedIdx !== null
                      ? "w-[110px] md:w-[130px] h-[196px] md:h-[231px] opacity-80"
                      : "w-[300px] md:w-[330px] lg:w-[350px] h-[530px] md:h-[585px] lg:h-[620px]"
                    }
                    ${isActive && draggedIdx === null
                      ? "scale-100 opacity-100 z-10 ring-2 ring-[#C8D400] shadow-[0_15px_35px_-8px_rgba(200,212,0,0.22)]"
                      : "scale-95 opacity-45 blur-[0.3px] hover:opacity-65 cursor-pointer"
                    }
                    ${isDragged
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
                    className={`rounded-[24px] overflow-hidden flex flex-col px-7 py-4 absolute top-0 left-0 w-[300px] md:w-[330px] lg:w-[350px] h-[530px] md:h-[585px] lg:h-[620px] origin-top-left select-none border border-border/80 shadow-md transition-all duration-300 z-0 ${!isActive && draggedIdx === null ? "pointer-events-none" : ""
                      } ${draggedIdx !== null
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

                    {/* True Full Screen Background Video Cover for Video Slide Types */}
                    {slide.type === "video" && slide.content?.url && (() => {
                       const isPlaying = (slide.id && playingSlides[slide.id]) || false;
                       const content = slide.content || {};
                       const captions = content.captions || "";
                       return (
                         <div className="absolute inset-0 z-10 overflow-hidden rounded-[24px] pointer-events-auto select-none">
                           <div
                             onClick={(e) => {
                               const video = e.currentTarget.querySelector("video");
                               if (video) {
                                 if (video.paused) {
                                   video.play().catch(() => {});
                                   setPlayingSlides(prev => ({ ...prev, [slide.id || ""]: true }));
                                 } else {
                                   video.pause();
                                   setPlayingSlides(prev => ({ ...prev, [slide.id || ""]: false }));
                                 }
                               }
                             }}
                             className="w-full h-full relative group cursor-pointer"
                           >
                             <video
                               src={content.url}
                               className="w-full h-full object-cover pointer-events-none"
                               controls={false}
                               muted
                               playsInline
                               onEnded={() => {
                                 setPlayingSlides(prev => ({ ...prev, [slide.id || ""]: false }));
                               }}
                             />
                             <div className="absolute inset-0 flex items-center justify-center bg-black/15 group-hover:bg-black/35 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
                               <div className="p-3.5 bg-white/90 dark:bg-black/90 rounded-full shadow-2xl scale-90 group-hover:scale-100 transition-transform duration-300">
                                 {isPlaying ? (
                                   <Pause className="h-6 w-6 text-[#0B1B4F] dark:text-[#C8D400]" />
                                 ) : (
                                   <Play className="h-6 w-6 text-[#0B1B4F] dark:text-[#C8D400]" />
                                 )}
                               </div>
                             </div>
                             {captions && (
                               <div className="absolute bottom-8 inset-x-6 flex justify-center text-center pointer-events-none z-10 animate-fade-in">
                                 <div className="max-w-[90%] bg-black/75 border border-white/10 px-3 py-1.5 rounded-xl shadow-lg backdrop-blur-md">
                                   <p className="text-[10px] text-white leading-normal font-sans font-medium">
                                     {captions}
                                   </p>
                                 </div>
                               </div>
                             )}
                           </div>
                         </div>
                       );
                     })()}

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
                              const isCurrentActive = activeSlideIndex === index;
                              if (isCurrentActive && emblaApi) {
                                // 1. Scroll smoothly to the neighboring card first (off-screen)
                                const targetIndex = index === 0 ? 1 : index - 1;
                                emblaApi.scrollTo(targetIndex);

                                // 2. Wait for the smooth scroll to finish, then delete
                                setTimeout(() => {
                                  onDeleteSlide(index);
                                }, 450);
                              } else {
                                // Already off-screen, delete immediately
                                onDeleteSlide(index);
                              }
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
                    <div className={`flex-1 flex flex-col min-h-0 relative z-20 font-sans mt-1 ${slide.type === "video" && content.url ? "pointer-events-none" : ""}`}>

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

                        let headingClass = "font-black text-left resize-none bg-transparent focus:outline-none leading-snug shrink-0 w-full p-0 border-0 focus:ring-0 overflow-y-auto scrollbar-none max-h-full";
                        let bodyClass = "font-sans font-medium text-left resize-none bg-transparent focus:outline-none leading-relaxed w-full p-0 border-0 focus:ring-0 overflow-y-auto scrollbar-none max-h-full";

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
                          <div className="flex-1 flex flex-col justify-center items-center text-center px-1 pt-8 pb-4 space-y-1.5 min-h-0 w-full z-10">
                            {showHeading && (
                              <div className="w-full flex flex-col items-center shrink-0">
                                <textarea
                                  ref={(node) => {
                                    if (node) {
                                      node.style.height = "auto";
                                      node.style.height = `${node.scrollHeight}px`;
                                    }
                                  }}
                                  disabled={!isActive}
                                  value={headingText}
                                  style={customStyle}
                                  onChange={(e) => updateContent({ heading: e.target.value, title: e.target.value })}
                                  placeholder="Enter Slide Title"
                                  rows={1}
                                  className={`${headingClass} ${placeholderColor}`}
                                />
                              </div>
                            )}
                            {showBody && (
                              <div className="w-full flex flex-col items-center min-h-0">
                                <textarea
                                  ref={(node) => {
                                    if (node) {
                                      node.style.height = "auto";
                                      node.style.height = `${node.scrollHeight}px`;
                                    }
                                  }}
                                  disabled={!isActive}
                                  value={bodyText}
                                  style={customStyle}
                                  onChange={(e) => updateContent({ body: e.target.value, text: e.target.value })}
                                  placeholder="Enter description text here..."
                                  rows={1}
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
                      {slide.type === "image" && (() => {
                        const isGenerating = slide.assetStatus === "pending" || slide.assetStatus === "generating";
                        const isFailed = slide.assetStatus === "failed";

                        // Trigger image regenerate API
                        const handleRegenerateImage = async () => {
                          if (!slide.id) return;
                          onUpdateSlideContent(index, {}, { assetStatus: "generating" });
                          try {
                            const res = await fetch(`/api/slides/${slide.id}/regenerate?asset=image`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ visualKeywords: content.visualKeywords }),
                            });
                            if (!res.ok) {
                              throw new Error("Failed to trigger image search");
                            }
                            toast.success("Pexels image search triggered in background.");
                          } catch (err: any) {
                            toast.error("Failed to regenerate image: " + err.message);
                            onUpdateSlideContent(index, {}, { assetStatus: "failed" });
                          }
                        };

                        return (
                          <div className="flex-1 flex flex-col justify-between py-1 min-h-0 space-y-2.5">
                            {isGenerating ? (
                              <div className={`w-full aspect-video rounded-xl border border-dashed flex flex-col items-center justify-center text-center p-3 gap-2 shrink-0 relative ${isDark ? "bg-black/40 border-white/15" : "bg-black/5 border-black/10"}`}>
                                <Loader2 className="h-6 w-6 animate-spin text-[#C8D400]" />
                                <span className="text-[10px] font-bold text-muted-foreground animate-pulse">Searching Pexels photo...</span>
                              </div>
                            ) : isFailed ? (
                              <div className="w-full aspect-video rounded-xl border border-red-500/20 flex flex-col items-center justify-center text-center p-3 gap-2 bg-red-500/5 shrink-0 relative">
                                <AlertTriangle className="h-6 w-6 text-red-500 animate-bounce" />
                                <span className="text-[10px] font-bold text-red-500 font-sans">Failed to fetch image</span>
                                {isActive && (
                                  <button
                                    type="button"
                                    onClick={handleRegenerateImage}
                                    className="text-[9px] font-bold bg-red-500 hover:bg-red-600 text-white py-1.5 px-3 rounded-lg transition-all cursor-pointer no-swipe font-sans"
                                  >
                                    Retry
                                  </button>
                                )}
                              </div>
                            ) : content.url ? (
                              <div className={`w-full aspect-video rounded-xl overflow-hidden shrink-0 relative group border ${isDark ? "bg-black/40 border-white/10" : "bg-black/5 border-black/5"}`}>
                                <img
                                  src={content.url}
                                  alt="preview"
                                  className="w-full h-full object-cover"
                                />
                                {isActive && (
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity gap-2">
                                    <button
                                      type="button"
                                      onClick={() => onOpenMediaPicker()}
                                      className="bg-white hover:bg-neutral-100 text-black font-extrabold text-[10px] py-1 px-3 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer no-swipe flex items-center gap-1 font-sans"
                                    >
                                      <ImageIcon className="h-3.5 w-3.5" /> Change Image
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleRegenerateImage}
                                      className="bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-extrabold text-[10px] py-1 px-3 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer no-swipe flex items-center gap-1 font-sans"
                                      title="Regenerate photo via Pexels"
                                    >
                                      <RefreshCw className="h-3 w-3" /> Regenerate
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className={`w-full aspect-video rounded-xl border border-dashed flex flex-col items-center justify-center text-center p-3 gap-2 shrink-0 relative ${isDark ? "bg-black/40 border-white/15" : "bg-black/5 border-black/10"}`}>
                                <ImageIcon className={`h-6 w-6 ${isDark ? "text-white/40" : "text-[#0B1B4F]/40"}`} />
                                {isActive ? (
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => onOpenMediaPicker()}
                                      className="bg-white hover:bg-neutral-100 text-black font-extrabold text-[10px] py-1.5 px-4 rounded-full shadow-md transition-all active:scale-95 cursor-pointer no-swipe font-sans"
                                    >
                                      + Add Image
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleRegenerateImage}
                                      className="bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] font-extrabold text-[10px] py-1.5 px-4 rounded-full shadow-md transition-all active:scale-95 cursor-pointer no-swipe font-sans"
                                    >
                                      Search Pexels
                                    </button>
                                  </div>
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
                                className={`bg-transparent border-none font-medium text-base md:text-lg focus:outline-none w-full flex-1 resize-none leading-relaxed ${textColor} ${placeholderColor}`}
                              />
                              {/* Editable visual keywords for Pexels search */}
                              <div className="pt-1.5 border-t border-dashed border-border/40 select-none no-swipe">
                                <span className={`text-[8.5px] font-bold uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#0B1B4F]/40"}`}>Pexels Search Keywords</span>
                                <input
                                  type="text"
                                  disabled={!isActive}
                                  value={content.visualKeywords || ""}
                                  onChange={(e) => updateContent({ visualKeywords: e.target.value })}
                                  placeholder="Keywords (e.g. factory floor, safety glasses)"
                                  className={`bg-transparent border-b border-dashed font-bold text-xs focus:outline-none w-full pb-0.5 mt-0.5 ${textColor} ${inputBorder} ${placeholderColor}`}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* slide type: AUDIO */}
                      {slide.type === "audio" && (() => {
                        const audioMode = content.audioMode;
                        const speechText = content.speechText || "";
                        const voiceId = content.voiceId || "anna";
                        const captions = content.captions || "";

                        const mockVoices = [
                          { id: "anna", name: "Anna (Female)", emoji: "👩" },
                          { id: "james", name: "James (Male)", emoji: "👨" },
                          { id: "sofia", name: "Sofia (Pro)", emoji: "👩‍🦰" },
                          { id: "alex", name: "Alex (Kid)", emoji: "🧑" },
                        ];

                        const selectedVoice = mockVoices.find(v => v.id === voiceId) || mockVoices[0];

                        const isGenerating = slide.assetStatus === "pending" || slide.assetStatus === "generating";
                        const isFailed = slide.assetStatus === "failed";

                        // Trigger audio regenerate API
                        const handleRegenerateAudio = async (overrideScript?: string) => {
                          if (!slide.id) return;
                          onUpdateSlideContent(index, {}, { assetStatus: "generating" });
                          try {
                            const scriptToUse = overrideScript !== undefined ? overrideScript : (content.audioScript || content.text || content.body || "");
                            const res = await fetch(`/api/slides/${slide.id}/regenerate?asset=audio`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ audioScript: scriptToUse }),
                            });
                            if (!res.ok) {
                              const body = await res.json().catch(() => ({}));
                              throw new Error(body.error || `Server error ${res.status}`);
                            }
                            toast.success("AI audio generation triggered in background.");
                          } catch (err: any) {
                            toast.error("Failed to regenerate audio: " + err.message);
                            onUpdateSlideContent(index, {}, { assetStatus: "failed" });
                          }
                        };

                        if (isGenerating) {
                          return (
                            <div className="flex-1 flex flex-col justify-center items-center text-center p-6 gap-3 min-h-0 w-full z-10 font-sans">
                              <Loader2 className="h-10 w-10 animate-spin text-[#C8D400]" />
                              <h3 className={`text-base font-bold ${titleColor}`}>Generating AI Voiceover...</h3>
                              <p className={`text-xs max-w-[200px] leading-normal ${mutedTextColor}`}>
                                Please wait while we generate speech audio from your script.
                              </p>
                            </div>
                          );
                        }

                        if (isFailed) {
                          return (
                            <div className="flex-1 flex flex-col justify-center items-center text-center p-6 gap-3 min-h-0 w-full z-10 font-sans">
                              <div className="p-3 bg-red-500/10 text-red-500 rounded-full border border-red-500/20">
                                <AlertTriangle className="h-8 w-8 text-red-500 animate-bounce" />
                              </div>
                              <h3 className="text-base font-bold text-red-500 font-sans">Audio Generation Failed</h3>
                              <p className={`text-xs max-w-[200px] leading-normal ${mutedTextColor}`}>
                                We encountered an error while calling the OpenAI Text-to-Speech API.
                              </p>
                              {isActive && (
                                <button
                                  type="button"
                                  onClick={() => handleRegenerateAudio()}
                                  className="mt-2 text-xs font-bold bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] py-2 px-5 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer no-swipe font-sans"
                                >
                                  Retry Generation
                                </button>
                              )}
                            </div>
                          );
                        }

                        // Recording helper controls
                        const startRecording = async () => {
                          try {
                            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                            audioChunksRef.current = [];
                            
                            // Fallback check for safari/chrome codecs
                            let recorder;
                            try {
                              recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
                            } catch (e) {
                              recorder = new MediaRecorder(stream);
                            }
                            
                            mediaRecorderRef.current = recorder;
                            
                            recorder.ondataavailable = (event) => {
                              if (event.data && event.data.size > 0) {
                                audioChunksRef.current.push(event.data);
                              }
                            };
                            
                            recorder.onstop = () => {
                              const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
                              const audioUrl = URL.createObjectURL(audioBlob);
                              setAudioBlobUrl(audioUrl);
                              
                              // Stop mic stream
                              stream.getTracks().forEach((track) => track.stop());
                            };
                            
                            recorder.start(100);
                            setIsRecording(true);
                            setRecordingTime(0);
                            
                            recordingIntervalRef.current = setInterval(() => {
                              setRecordingTime((prev) => prev + 1);
                            }, 1000);
                          } catch (err: any) {
                            console.error("Microphone access failed", err);
                            toast.error("Failed to access microphone: " + err.message);
                          }
                        };

                        const stopRecording = () => {
                          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
                            mediaRecorderRef.current.stop();
                          }
                          setIsRecording(false);
                          if (recordingIntervalRef.current) {
                            clearInterval(recordingIntervalRef.current);
                          }
                        };

                        const saveRecording = () => {
                          if (audioBlobUrl) {
                            updateContent({ url: audioBlobUrl, audioMode: "record" });
                            toast.success("Voice recording applied successfully!");
                            setAudioBlobUrl(null);
                          }
                        };

                        const discardRecording = () => {
                          setAudioBlobUrl(null);
                          setRecordingTime(0);
                        };

                        // Custom Audio Player Actions
                        const curTime = audioCurrentTime[slide.id || ""] || 0;
                        const dur = audioDuration[slide.id || ""] || 0.1;
                        const percent = (curTime / dur) * 100;
                        const isPlaying = audioPlaying[slide.id || ""] || false;
                        const activeCC = isCCActive[slide.id || ""] || false;
                        const speed = audioSpeed[slide.id || ""] || 1;

                        const formatTime = (secs: number) => {
                          const m = Math.floor(secs / 60);
                          const s = Math.floor(secs % 60);
                          return `${m}:${s < 10 ? "0" : ""}${s}`;
                        };

                        const togglePlay = () => {
                          const audioEl = document.getElementById(`audio-player-${slide.id}`) as HTMLAudioElement;
                          if (audioEl) {
                            if (audioEl.paused) {
                              audioEl.play().catch(() => {});
                              setAudioPlaying((prev) => ({ ...prev, [slide.id || ""]: true }));
                            } else {
                              audioEl.pause();
                              setAudioPlaying((prev) => ({ ...prev, [slide.id || ""]: false }));
                            }
                          }
                        };

                        const changeSpeed = () => {
                          const speeds = [1, 1.25, 1.5, 2];
                          const nextIdx = (speeds.indexOf(speed) + 1) % speeds.length;
                          const nextSpeed = speeds[nextIdx];
                          setAudioSpeed((prev) => ({ ...prev, [slide.id || ""]: nextSpeed }));
                          
                          const audioEl = document.getElementById(`audio-player-${slide.id}`) as HTMLAudioElement;
                          if (audioEl) {
                            audioEl.playbackRate = nextSpeed;
                          }
                        };

                        const handleScrub = (val: number) => {
                          const audioEl = document.getElementById(`audio-player-${slide.id}`) as HTMLAudioElement;
                          if (audioEl) {
                            audioEl.currentTime = val;
                            setAudioCurrentTime((prev) => ({ ...prev, [slide.id || ""]: val }));
                          }
                        };

                        // Mode 1: Active loaded state (renders description comment and pill audio player)
                        if (content.url) {
                          return (
                            <div className="flex-1 flex flex-col justify-between pt-10 pb-16 min-h-0 w-full z-10">
                              {/* Invisible audio player element with multiple duration listeners to ensure perfect sync */}
                              <audio
                                ref={(node) => {
                                  if (node) {
                                    node.playbackRate = speed;
                                  }
                                }}
                                id={`audio-player-${slide.id}`}
                                src={content.url}
                                onTimeUpdate={(e) => {
                                  const el = e.currentTarget;
                                  setAudioCurrentTime((prev) => ({ ...prev, [slide.id || ""]: el.currentTime }));
                                  if (el.duration && el.duration !== dur) {
                                    setAudioDuration((prev) => ({ ...prev, [slide.id || ""]: el.duration }));
                                  }
                                }}
                                onLoadedMetadata={(e) => {
                                  const el = e.currentTarget;
                                  if (el.duration) {
                                    setAudioDuration((prev) => ({ ...prev, [slide.id || ""]: el.duration }));
                                  }
                                }}
                                onDurationChange={(e) => {
                                  const el = e.currentTarget;
                                  if (el.duration) {
                                    setAudioDuration((prev) => ({ ...prev, [slide.id || ""]: el.duration }));
                                  }
                                }}
                                onCanPlay={(e) => {
                                  const el = e.currentTarget;
                                  if (el.duration) {
                                    setAudioDuration((prev) => ({ ...prev, [slide.id || ""]: el.duration }));
                                  }
                                }}
                                onEnded={() => {
                                  setAudioPlaying((prev) => ({ ...prev, [slide.id || ""]: false }));
                                  setAudioCurrentTime((prev) => ({ ...prev, [slide.id || ""]: 0 }));
                                }}
                              />

                              {/* Top description input field shifted lower for perfect balance */}
                              <div className="w-full text-left shrink-0 mt-8 px-4">
                                <textarea
                                  disabled={!isActive}
                                  value={content.body || content.text || ""}
                                  onChange={(e) => updateContent({ body: e.target.value, text: e.target.value })}
                                  placeholder="Enter a short description or information about the audio file"
                                  rows={3}
                                  className={`bg-transparent border-none font-medium text-base md:text-lg focus:outline-none w-full min-h-[70px] resize-none leading-relaxed text-center ${textColor} ${placeholderColor} focus:ring-0`}
                                />
                              </div>

                              {/* Custom Subtitles Overlay positioned cleanly in the middle above the player */}
                              {activeCC && captions && (
                                <div className="w-full flex justify-center text-center animate-fade-in z-25 my-auto pointer-events-none px-4">
                                  <div className="max-w-[90%] bg-black/85 border border-white/10 px-3.5 py-2 rounded-xl shadow-lg backdrop-blur-md">
                                    <p className="text-[10px] text-white leading-normal font-sans font-medium">
                                      {captions}
                                    </p>
                                  </div>
                                </div>
                              )}

                              {/* Custom pill-shaped audio player panel positioned slightly higher */}
                              <div className="w-full shrink-0 px-0.5 mt-auto mb-6">
                                <div className="w-full bg-[#030b35]/95 border border-white/10 rounded-2xl p-2.5 flex items-center justify-between gap-3 shadow-2xl backdrop-blur-md text-white no-swipe">
                                  {/* Play/Pause Button in a rounded square border */}
                                  <button
                                    type="button"
                                    onClick={togglePlay}
                                    className="h-8 w-8 rounded-lg border border-white/90 flex items-center justify-center bg-transparent transition-all hover:scale-105 active:scale-95 cursor-pointer shrink-0"
                                  >
                                    {isPlaying ? (
                                      <Pause className="h-4.5 w-4.5 fill-white text-white shrink-0" />
                                    ) : (
                                      <Play className="h-4.5 w-4.5 fill-white text-white shrink-0 translate-x-[1px]" />
                                    )}
                                  </button>

                                  {/* Timeline Slider Progress Bar */}
                                  <div className="flex-1 flex items-center min-w-0">
                                    <input
                                      type="range"
                                      min="0"
                                      max={dur}
                                      step="0.05"
                                      value={curTime}
                                      onChange={(e) => handleScrub(parseFloat(e.target.value))}
                                      className="w-full h-[3.5px] rounded-lg appearance-none cursor-pointer accent-white bg-white/20 hover:accent-[#C8D400] transition-colors"
                                      style={{
                                        background: `linear-gradient(to right, #ffffff 0%, #ffffff ${percent}%, rgba(255,255,255,0.2) ${percent}%, rgba(255,255,255,0.2) 100%)`
                                      }}
                                    />
                                  </div>

                                  {/* Right side controls grouped in flex container with spacing to eliminate overlapping */}
                                  <div className="flex items-center gap-2.5 shrink-0 pl-1 select-none">
                                    {/* Transcript Toggle Button */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAudioTranscriptToolsOpen(!audioTranscriptToolsOpen);
                                        setAudioToolsOpen(false);
                                      }}
                                      className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer shrink-0
                                        ${audioTranscriptToolsOpen ? "text-[#C8D400] bg-white/10" : "text-white/70 hover:text-white"}`}
                                      title="Toggle Transcript"
                                    >
                                      <FileText className="h-4.5 w-4.5" />
                                    </button>

                                    {/* CC (Closed Captions) Button */}
                                    <button
                                      type="button"
                                      onClick={() => setIsCCActive((prev) => ({ ...prev, [slide.id || ""]: !activeCC }))}
                                      className={`h-8 w-8 border rounded-lg flex items-center justify-center text-[9px] font-black tracking-tighter transition-all cursor-pointer shrink-0
                                        ${activeCC 
                                          ? "border-[#C8D400] text-[#C8D400] bg-[#C8D400]/10 font-extrabold shadow-sm shadow-[#C8D400]/25" 
                                          : "border-white/20 text-white/70 hover:text-white"
                                        }`}
                                      title="Toggle Captions"
                                    >
                                      cc
                                    </button>

                                    {/* Playback speed control */}
                                    <button
                                      type="button"
                                      onClick={changeSpeed}
                                      className="text-[10px] font-black text-white hover:text-[#C8D400] px-1 h-8 flex items-center justify-center min-w-[28px] cursor-pointer transition-colors shrink-0"
                                      title="Playback Speed"
                                    >
                                      {speed}x
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // Mode 2: Empty Selector Choice
                        if (!audioMode) {
                          return (
                            <div className="flex-1 flex flex-col justify-center items-stretch gap-6 px-1 pt-6 pb-4 w-full z-10">
                              <div className="flex flex-col items-center text-center gap-1.5 mb-1 shrink-0">
                                <div className="p-3 rounded-2xl bg-[#C8D400]/10 border border-[#C8D400]/20 text-[#C8D400] animate-pulse">
                                  <Music className="h-7 w-7" />
                                </div>
                                <h3 className={`text-base md:text-lg font-bold tracking-tight ${titleColor}`}>Add Audio Block</h3>
                                <p className={`text-xs max-w-[220px] leading-normal ${mutedTextColor}`}>
                                  Upload an audio file, generate with AI text-to-speech, or record with your microphone.
                                </p>
                              </div>

                              <div className="flex flex-col gap-3 w-full shrink-0">
                                {/* Upload Button Card */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateContent({ audioMode: "upload" });
                                    onOpenMediaPicker();
                                  }}
                                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer text-left no-swipe
                                    ${isDark
                                      ? "bg-white/5 border-white/10 hover:border-[#C8D400]/60 hover:bg-[#C8D400]/5 text-white shadow-md shadow-black/20"
                                      : "bg-white border-neutral-200 hover:border-[#C8D400]/60 hover:bg-[#C8D400]/5 text-[#0B1B4F] shadow-sm hover:shadow-md"
                                    }`}
                                >
                                  <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 shrink-0">
                                    <Upload className="h-5 w-5" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold uppercase tracking-wider">Upload Audio</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">Import an MP3, WAV, or OGG file from your device</p>
                                  </div>
                                </button>

                                {/* Generate Button Card */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateContent({ audioMode: "generate", voiceId: "anna" });
                                  }}
                                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer text-left no-swipe
                                    ${isDark
                                      ? "bg-white/5 border-white/10 hover:border-[#C8D400]/60 hover:bg-[#C8D400]/5 text-white shadow-md shadow-black/20"
                                      : "bg-white border-neutral-200 hover:border-[#C8D400]/60 hover:bg-[#C8D400]/5 text-[#0B1B4F] shadow-sm hover:shadow-md"
                                    }`}
                                >
                                  <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500 shrink-0">
                                    <Sparkles className="h-5 w-5" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold uppercase tracking-wider">Generate with AI</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">Convert written scripts into natural spoken voices</p>
                                  </div>
                                </button>

                                {/* Record Microphone Button Card */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateContent({ audioMode: "record" });
                                  }}
                                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer text-left no-swipe
                                    ${isDark
                                      ? "bg-white/5 border-white/10 hover:border-[#C8D400]/60 hover:bg-[#C8D400]/5 text-white shadow-md shadow-black/20"
                                      : "bg-white border-neutral-200 hover:border-[#C8D400]/60 hover:bg-[#C8D400]/5 text-[#0B1B4F] shadow-sm hover:shadow-md"
                                    }`}
                                >
                                  <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500 shrink-0">
                                    <Mic className="h-5 w-5" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold uppercase tracking-wider">Record from Mic</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">Record your own voice in high quality right now</p>
                                  </div>
                                </button>
                              </div>
                            </div>
                          );
                        }

                        // Mode 3: Upload mode selected, but no URL yet
                        if (audioMode === "upload") {
                          return (
                            <div className="flex-1 flex flex-col justify-center items-stretch gap-4 px-1 py-4 w-full z-10">
                              <div
                                onClick={() => onOpenMediaPicker()}
                                className={`w-full aspect-video rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center p-6 gap-3 shrink-0 cursor-pointer transition-all hover:bg-neutral-100/5 hover:border-[#C8D400]/55
                                  ${isDark ? "bg-black/30 border-white/15" : "bg-black/5 border-black/10"}`}
                              >
                                <div className="p-3 rounded-full bg-blue-500/10 text-blue-500 animate-bounce">
                                  <Upload className="h-6 w-6" />
                                </div>
                                <div>
                                  <p className={`text-xs font-bold ${textColor}`}>Select Audio File</p>
                                  <p className="text-[10px] text-muted-foreground mt-1">Supports MP3, WAV, OGG, M4A</p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => updateContent({ audioMode: undefined })}
                                className={`text-xs font-semibold flex items-center justify-center gap-1.5 self-center cursor-pointer hover:underline ${isDark ? "text-white/40 hover:text-white" : "text-[#0B1B4F]/40 hover:text-[#0B1B4F]"}`}
                              >
                                <ArrowLeft className="h-3.5 w-3.5" /> Back to Choice
                              </button>
                            </div>
                          );
                        }

                        // Mode 4: AI Generate Mode
                        if (audioMode === "generate") {
                          return (
                            <div className="flex-1 flex flex-col justify-between py-1 min-h-0 gap-3">
                              {/* Glowing Voice Waveform viewport */}
                              <div className={`w-full aspect-video rounded-2xl overflow-hidden shrink-0 relative border flex flex-col items-center justify-center bg-gradient-to-b from-neutral-800 to-neutral-950 shadow-inner group
                                ${isDark ? "border-white/10" : "border-black/5"}`}
                              >
                                <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/45 px-2 py-0.5 rounded-full backdrop-blur-xs select-none">
                                  <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse" />
                                  <span className="text-[7px] font-black uppercase text-purple-400 tracking-wider">AI Voice Studio</span>
                                </div>

                                <div className="flex flex-col items-center gap-2">
                                  <div className="h-14 w-14 rounded-full bg-gradient-to-tr from-purple-500/20 to-[#C8D400]/20 border border-white/20 flex items-center justify-center shadow-lg hover:scale-105 transition-transform duration-300">
                                    <span className="text-2.5xl leading-none">{selectedVoice.emoji}</span>
                                  </div>
                                  <span className="text-[9px] font-black text-white/90 uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded-md backdrop-blur-xs">
                                    {selectedVoice.name}
                                  </span>
                                </div>

                                {/* Animated soundwaves */}
                                <div className="absolute bottom-3 inset-x-6 flex items-center justify-center gap-1 select-none opacity-45">
                                  {[0.3, 0.6, 0.4, 0.8, 0.5, 0.7, 0.4].map((h, i) => (
                                    <div key={i} style={{ height: `${h * 20}px` }} className="w-[2px] bg-purple-400 rounded-full" />
                                  ))}
                                </div>
                              </div>

                              {/* Generator Script Editor input */}
                              <div className="w-full flex flex-col gap-2">
                                <div className="text-left">
                                  <span className={`text-[8.5px] font-bold uppercase tracking-wider select-none ${isDark ? "text-white/40" : "text-[#0B1B4F]/40"}`}>AI Voice script</span>
                                  <textarea
                                    value={speechText}
                                    onChange={(e) => {
                                      const text = e.target.value;
                                      updateContent({ speechText: text, captions: text });
                                    }}
                                    placeholder="Enter script text for the AI voice to read..."
                                    rows={2}
                                    className={`w-full rounded-xl border px-2 py-1.5 text-[9px] mt-1 leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-[#C8D400] transition-colors
                                      ${isDark
                                        ? "bg-white/5 border-white/10 text-white placeholder-white/25"
                                        : "bg-black/5 border-black/10 text-[#0B1B4F] placeholder-[#0B1B4F]/25"
                                      }`}
                                  />
                                </div>

                                <div className="flex gap-2 w-full mt-1">
                                  <button
                                    type="button"
                                    onClick={() => updateContent({ audioMode: undefined, voiceId: undefined, speechText: undefined, captions: undefined })}
                                    className={`flex-1 py-2 rounded-xl border flex items-center justify-center gap-1 text-[10px] font-bold transition-all cursor-pointer no-swipe
                                      ${isDark
                                        ? "bg-white/5 border-white/10 text-white/60 hover:text-white hover:border-white/20"
                                        : "bg-black/5 border-black/10 text-[#0B1B4F]/60 hover:text-[#0B1B4F] hover:border-black/20"
                                      }`}
                                  >
                                    <ArrowLeft className="h-3 w-3" /> Back
                                  </button>
                                  
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!speechText.trim()) {
                                        toast.error("Please enter script text to synthesize");
                                        return;
                                      }
                                      handleRegenerateAudio(speechText);
                                    }}
                                    className={`flex-1 py-2 rounded-xl border flex items-center justify-center gap-1 text-[10px] font-bold transition-all cursor-pointer no-swipe
                                      ${isAudioGenerating ? "opacity-50 cursor-not-allowed" : ""}
                                      ${isDark
                                        ? "bg-[#C8D400]/10 border-[#C8D400]/25 text-[#C8D400] hover:bg-[#C8D400]/20"
                                        : "bg-[#0B1B4F]/5 border-[#C8D400]/20 text-[#1B2A6B] hover:bg-[#C8D400]/10"
                                      }`}
                                  >
                                    {isAudioGenerating ? (
                                      <>
                                        <Loader2 className="h-3 w-3 animate-spin" /> Generating...
                                      </>
                                    ) : (
                                      <>
                                        <Sparkles className="h-3 w-3 text-[#C8D400]" /> Generate voice
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // Mode 5: Live Microphone Recorder
                        return (
                          <div className="flex-1 flex flex-col justify-between py-1 min-h-0 gap-3">
                            <div className={`w-full aspect-video rounded-2xl overflow-hidden shrink-0 relative border flex flex-col items-center justify-center bg-gradient-to-b from-neutral-800 to-neutral-950 shadow-inner group
                              ${isDark ? "border-white/10" : "border-black/5"}`}
                            >
                              {/* Recording Badge */}
                              <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/45 px-2.5 py-0.5 rounded-full backdrop-blur-xs select-none">
                                <span className={`h-1.5 w-1.5 rounded-full bg-red-500 ${isRecording ? "animate-ping" : ""}`} />
                                <span className="text-[7.5px] font-black uppercase text-red-500 tracking-wider">
                                  {isRecording ? "Live Mic Recording" : "Voice Recorder"}
                                </span>
                              </div>

                              {/* Timer or Status */}
                              <div className="text-center flex flex-col items-center gap-1">
                                {isRecording ? (
                                  <>
                                    <span className="text-3xl font-black text-white tracking-widest font-mono select-none">
                                      {formatTime(recordingTime)}
                                    </span>
                                    <span className="text-[8px] text-white/50 uppercase tracking-widest select-none">Recording in progress</span>
                                  </>
                                ) : audioBlobUrl ? (
                                  <>
                                    <span className="text-base font-bold text-white mb-2">Recording ready!</span>
                                    <audio src={audioBlobUrl} controls className="max-w-[200px] h-8 bg-transparent" />
                                  </>
                                ) : (
                                  <>
                                    <div className="p-3.5 rounded-full bg-red-500/10 text-red-500 mb-1 border border-red-500/10 shrink-0">
                                      <Mic className="h-6 w-6" />
                                    </div>
                                    <span className="text-[9px] text-white/60 uppercase tracking-widest select-none">Ready to record</span>
                                  </>
                                )}
                              </div>

                              {/* Recording glowing waves */}
                              {isRecording && (
                                <div className="absolute bottom-3 inset-x-6 flex items-center justify-center gap-1 select-none">
                                  {[0.4, 0.8, 0.5, 0.9, 0.6, 0.8, 0.3, 0.7, 0.5, 0.9, 0.4].map((h, i) => (
                                    <div
                                      key={i}
                                      style={{
                                        height: `${h * 24}px`,
                                        animationDelay: `${i * 0.05}s`
                                      }}
                                      className="w-[2.5px] bg-red-500 rounded-full animate-pulse"
                                    />
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Controls */}
                            <div className="w-full flex flex-col gap-2">
                              {isRecording ? (
                                <button
                                  type="button"
                                  onClick={stopRecording}
                                  className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold flex items-center justify-center gap-2 cursor-pointer no-swipe text-xs animate-pulse"
                                >
                                  <div className="h-2 w-2 rounded-xs bg-white shrink-0" />
                                  Stop Recording
                                </button>
                              ) : audioBlobUrl ? (
                                <div className="flex gap-2 w-full">
                                  <button
                                    type="button"
                                    onClick={discardRecording}
                                    className={`flex-1 py-2.5 rounded-xl border flex items-center justify-center gap-1 text-[10px] font-bold transition-all cursor-pointer no-swipe
                                      ${isDark
                                        ? "bg-white/5 border-white/10 text-white/60 hover:text-white hover:border-white/20"
                                        : "bg-black/5 border-black/10 text-[#0B1B4F]/60 hover:text-[#0B1B4F] hover:border-black/20"
                                      }`}
                                  >
                                    Record Again
                                  </button>
                                  <button
                                    type="button"
                                    onClick={saveRecording}
                                    className="flex-1 py-2.5 rounded-xl bg-[#C8D400] text-[#1B2A6B] font-extrabold flex items-center justify-center gap-1.5 cursor-pointer no-swipe text-[10px] hover:bg-[#C8D400]/90 transition-colors"
                                  >
                                    <Check className="h-3.5 w-3.5" /> Use Recording
                                  </button>
                                </div>
                              ) : (
                                <div className="flex gap-2 w-full">
                                  <button
                                    type="button"
                                    onClick={() => updateContent({ audioMode: undefined })}
                                    className={`flex-1 py-2 rounded-xl border flex items-center justify-center gap-1 text-[10px] font-bold transition-all cursor-pointer no-swipe
                                      ${isDark
                                        ? "bg-white/5 border-white/10 text-white/60 hover:text-white"
                                        : "bg-black/5 border-black/10 text-[#0B1B4F]/60 hover:text-[#0B1B4F]"
                                      }`}
                                  >
                                    <ArrowLeft className="h-3 w-3" /> Back
                                  </button>
                                  <button
                                    type="button"
                                    onClick={startRecording}
                                    className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer no-swipe text-[10px]"
                                  >
                                    <Mic className="h-3.5 w-3.5" /> Start Recording
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* slide type: VIDEO */}
                      {slide.type === "video" && (() => {
                        const videoMode = content.videoMode;
                        const avatarId = content.avatarId;
                        const speechText = content.speechText || "";
                        const captions = content.captions || "";

                        const avatarRoles = [
                          { id: "instructor", name: "Instructor", emoji: "👩‍🏫" },
                          { id: "student", name: "Student", emoji: "🧑‍💻" },
                        ];

                        const selectedAvatar = avatarRoles.find(av => av.id === avatarId) || avatarRoles[0];

                        const isGenerating = slide.assetStatus === "pending" || slide.assetStatus === "generating";
                        const isFailed = slide.assetStatus === "failed";

                        const handleRegenerateVideo = async () => {
                          if (!slide.id) return;
                          onUpdateSlideContent(index, {}, { assetStatus: "generating" });
                          try {
                            const res = await fetch(`/api/slides/${slide.id}/regenerate?asset=video`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ speechText: content.speechText || "" }),
                            });
                            if (!res.ok) {
                              const body = await res.json().catch(() => ({}));
                              throw new Error(body.error || `Server error ${res.status}`);
                            }
                            toast.success("HeyGen video generation triggered in background.");
                          } catch (err: any) {
                            toast.error("Failed to regenerate video: " + err.message);
                            onUpdateSlideContent(index, {}, { assetStatus: "failed" });
                          }
                        };

                        if (isGenerating) {
                          return (
                            <div className="flex-1 flex flex-col justify-center items-center text-center p-6 gap-3 min-h-0 w-full z-10 font-sans">
                              <Loader2 className="h-10 w-10 animate-spin text-[#C8D400]" />
                              <h3 className={`text-base font-bold ${titleColor}`}>Generating AI Video...</h3>
                              <p className={`text-xs max-w-[200px] leading-normal ${mutedTextColor}`}>
                                Your HeyGen avatar is being rendered. This may take a few minutes.
                              </p>
                            </div>
                          );
                        }

                        if (isFailed) {
                          return (
                            <div className="flex-1 flex flex-col justify-center items-center text-center p-6 gap-3 min-h-0 w-full z-10 font-sans">
                              <div className="p-3 bg-red-500/10 text-red-500 rounded-full border border-red-500/20">
                                <AlertTriangle className="h-8 w-8 text-red-500 animate-bounce" />
                              </div>
                              <h3 className="text-base font-bold text-red-500 font-sans">Video Generation Failed</h3>
                              <p className={`text-xs max-w-[200px] leading-normal ${mutedTextColor}`}>
                                We encountered an error while calling the HeyGen API.
                              </p>
                              {isActive && (
                                speechText ? (
                                  <button
                                    type="button"
                                    onClick={handleRegenerateVideo}
                                    className="mt-2 text-xs font-bold bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] py-2 px-5 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer no-swipe font-sans"
                                  >
                                    Retry Generation
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setIsVideoConfigOpen(true)}
                                    className="mt-2 text-xs font-bold bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] py-2 px-5 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer no-swipe font-sans"
                                  >
                                    Configure Avatar
                                  </button>
                                )
                              )}
                            </div>
                          );
                        }

                        // Mode 1: Already has a video URL (uploaded or generated)
                        if (content.url) {
                          return null;
                        }

                        // Mode 2: No videoMode selected yet (Upload vs Generate selector)
                        if (!videoMode) {
                          return (
                            <div className="flex-1 flex flex-col justify-center items-stretch gap-6 px-1 pt-6 pb-4 w-full z-10">
                              <div className="flex flex-col items-center text-center gap-1.5 mb-1 shrink-0">
                                <div className="p-3 rounded-2xl bg-[#C8D400]/10 border border-[#C8D400]/20 text-[#C8D400] animate-pulse">
                                  <Film className="h-7 w-7" />
                                </div>
                                <h3 className={`text-base md:text-lg font-bold tracking-tight ${titleColor}`}>Add Video Block</h3>
                                <p className={`text-xs max-w-[200px] leading-normal ${mutedTextColor}`}>
                                  Upload your own recording or generate an avatar speaking your script.
                                </p>
                              </div>

                              <div className="flex flex-col gap-3 w-full shrink-0">
                                {/* Upload Button Card */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateContent({ videoMode: "upload" });
                                    onOpenMediaPicker();
                                  }}
                                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer text-left no-swipe
                                    ${isDark
                                      ? "bg-white/5 border-white/10 hover:border-[#C8D400]/60 hover:bg-[#C8D400]/5 text-white shadow-md shadow-black/20"
                                      : "bg-white border-neutral-200 hover:border-[#C8D400]/60 hover:bg-[#C8D400]/5 text-[#0B1B4F] shadow-sm hover:shadow-md"
                                    }`}
                                >
                                  <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 shrink-0">
                                    <Upload className="h-5 w-5" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold uppercase tracking-wider">Upload Video</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">Import an MP4, WebM, or MOV file from your device</p>
                                  </div>
                                </button>

                                {/* Generate Button Card */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateContent({ videoMode: "generate", avatarId: "instructor" });
                                    setIsVideoConfigOpen(true); // Open configuration immediately when generate is chosen
                                  }}
                                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer text-left no-swipe
                                    ${isDark
                                      ? "bg-white/5 border-white/10 hover:border-[#C8D400]/60 hover:bg-[#C8D400]/5 text-white shadow-md shadow-black/20"
                                      : "bg-white border-neutral-200 hover:border-[#C8D400]/60 hover:bg-[#C8D400]/5 text-[#0B1B4F] shadow-sm hover:shadow-md"
                                    }`}
                                >
                                  <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500 shrink-0">
                                    <Sparkles className="h-5 w-5" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold uppercase tracking-wider">Generate with AI</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">Create an interactive HeyGen talking avatar speech</p>
                                  </div>
                                </button>
                              </div>
                            </div>
                          );
                        }

                        // Mode 3: Upload mode selected, but no URL yet
                        if (videoMode === "upload") {
                          return (
                            <div className="flex-1 flex flex-col justify-center items-stretch gap-4 px-1 py-4 w-full z-10">
                              <div
                                onClick={() => onOpenMediaPicker()}
                                className={`w-full aspect-video rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center p-6 gap-3 shrink-0 cursor-pointer transition-all hover:bg-neutral-100/5 hover:border-[#C8D400]/55
                                  ${isDark ? "bg-black/30 border-white/15" : "bg-black/5 border-black/10"}`}
                              >
                                <div className="p-3 rounded-full bg-blue-500/10 text-blue-500 animate-bounce">
                                  <Upload className="h-6 w-6" />
                                </div>
                                <div>
                                  <p className={`text-xs font-bold ${textColor}`}>Select Video File</p>
                                  <p className="text-[10px] text-muted-foreground mt-1">Supports MP4, WebM, MOV</p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => updateContent({ videoMode: undefined })}
                                className={`text-xs font-semibold flex items-center justify-center gap-1.5 self-center cursor-pointer hover:underline ${isDark ? "text-white/40 hover:text-white" : "text-[#0B1B4F]/40 hover:text-[#0B1B4F]"}`}
                              >
                                <ArrowLeft className="h-3.5 w-3.5" /> Back to Choice
                              </button>
                            </div>
                          );
                        }

                        // Mode 4: Generate mode selected, but no URL yet
                        return (
                          <div className="flex-1 flex flex-col justify-between py-1 min-h-0 gap-3">
                            {/* AI Video Preview Viewport Mockup */}
                            <div className={`w-full aspect-video rounded-2xl overflow-hidden shrink-0 relative border flex flex-col items-center justify-center bg-gradient-to-b from-neutral-800 to-neutral-950 shadow-inner group
                              ${isDark ? "border-white/10" : "border-black/5"}`}
                            >
                              {/* Pulsing AI Live Feed Studio indicators */}
                              <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/45 px-2 py-0.5 rounded-full backdrop-blur-xs select-none">
                                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                                <span className="text-[7px] font-black uppercase text-red-500 tracking-wider">AI Live Draft</span>
                              </div>

                              <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/45 px-2 py-0.5 rounded-full backdrop-blur-xs select-none">
                                <span className="text-[7.5px] font-bold text-white/80 uppercase tracking-widest">HeyGen</span>
                              </div>

                              {/* Styled Portrait Avatar viewport */}
                              <div className="flex flex-col items-center gap-2">
                                <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-[#C8D400]/20 to-purple-500/20 border border-white/20 flex items-center justify-center shadow-lg hover:scale-105 transition-transform duration-300">
                                  <span className="text-3xl leading-none">{selectedAvatar.emoji}</span>
                                </div>
                                <span className="text-[10px] font-black text-white/90 uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded-md backdrop-blur-xs">
                                  {selectedAvatar.name}
                                </span>
                              </div>

                              {/* Subtitle Caption Overlay */}
                              <div className="absolute bottom-2.5 inset-x-4 flex justify-center text-center">
                                <div className="max-w-[85%] bg-black/70 border border-white/10 px-3 py-1.5 rounded-xl shadow-lg backdrop-blur-md">
                                  <p className="text-[9.5px] text-white leading-normal font-sans font-medium">
                                    {captions || (speechText ? `"${speechText}"` : "Add speech script to auto-generate captions...")}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Options configuration summary and settings trigger */}
                            <div className="w-full flex flex-col gap-2">
                              <div className="text-left">
                                <span className={`text-[8.5px] font-bold uppercase tracking-wider select-none ${isDark ? "text-white/40" : "text-[#0B1B4F]/40"}`}>Speech script preview</span>
                                <p className={`text-xs mt-1 italic line-clamp-2 min-h-[32px] ${textColor}`}>
                                  {speechText ? `"${speechText}"` : "No speech script entered yet."}
                                </p>
                              </div>

                              <div className="flex gap-2 w-full mt-1.5">
                                <button
                                  type="button"
                                  onClick={() => updateContent({ videoMode: undefined, avatarId: undefined, speechText: undefined, captions: undefined })}
                                  className={`flex-1 py-2.5 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer no-swipe
                                    ${isDark
                                      ? "bg-white/5 border-white/10 text-white/60 hover:text-white hover:border-white/20"
                                      : "bg-black/5 border-black/10 text-[#0B1B4F]/60 hover:text-[#0B1B4F] hover:border-black/20"
                                    }`}
                                >
                                  <ArrowLeft className="h-3.5 w-3.5" /> Change Source
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setIsVideoConfigOpen(!isVideoConfigOpen)}
                                  className={`flex-1 py-2.5 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer no-swipe
                                    ${isVideoConfigOpen
                                      ? "bg-[#C8D400]/20 border-[#C8D400]/40 text-[#C8D400]"
                                      : (isDark
                                        ? "bg-[#C8D400]/10 border-[#C8D400]/25 text-[#C8D400] hover:bg-[#C8D400]/20"
                                        : "bg-[#0B1B4F]/5 border-[#C8D400]/20 text-[#1B2A6B] hover:bg-[#C8D400]/10"
                                      )
                                    }`}
                                >
                                  <SlidersHorizontal className="h-3.5 w-3.5" />
                                  {isVideoConfigOpen ? "Close AI Editor" : "Configure AI"}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      {/* slide type: QUIZ */}
                      {slide.type === "quiz" && (() => {
                        const questionText = content.heading || content.question || content.title || "";

                        let questionClass = `font-sans font-medium text-left resize-none bg-transparent focus:outline-none leading-relaxed shrink-0 w-full p-0 border-0 focus:ring-0 overflow-hidden text-sm md:text-base ${textColor}`;

                        return (
                          <div
                            style={{ marginLeft: "-28px", marginRight: "-28px", paddingLeft: "28px", paddingRight: "28px", width: "calc(100% + 56px)" }}
                            className="flex-1 flex flex-col justify-start items-stretch pt-9 pb-4 space-y-4 z-10 overflow-y-auto scrollbar-none"
                          >
                            {/* Clean, box-less premium Question Title just like in Standard Card */}
                            <div className="w-full flex flex-col items-start shrink-0">
                              <textarea
                                ref={(node) => {
                                  if (node) {
                                    node.style.height = "auto";
                                    node.style.height = `${node.scrollHeight}px`;
                                  }
                                }}
                                disabled={!isActive}
                                value={questionText}
                                onChange={(e) => updateContent({ heading: e.target.value, question: e.target.value, title: e.target.value })}
                                placeholder="Enter Quiz Question"
                                rows={1}
                                className={`${questionClass} ${placeholderColor}`}
                              />
                            </div>

                            {/* Options List */}
                            <div className="w-full space-y-2 px-0.5 shrink-0 flex flex-col items-center overflow-visible">
                              {(content.options || ["", ""]).map((option, optIdx) => {
                                const isCorrect = (content.correctIndex ?? 0) === optIdx;
                                const isDragged = isActive && draggedOptIdx === optIdx;
                                const isDragOver = isActive && dragOverOptIdx === optIdx;

                                const slideKey = slide.id || `slide-${index}`;
                                if (!optionKeysRef.current[slideKey]) {
                                  optionKeysRef.current[slideKey] = [];
                                }
                                const currentKeys = optionKeysRef.current[slideKey];
                                const optionsList = content.options || ["", ""];

                                // Ensure key array matches option list size
                                if (currentKeys.length !== optionsList.length) {
                                  const newKeys = [...currentKeys];
                                  if (newKeys.length < optionsList.length) {
                                    while (newKeys.length < optionsList.length) {
                                      newKeys.push(`opt-key-${Math.random().toString(36).substr(2, 9)}`);
                                    }
                                  } else {
                                    newKeys.splice(optionsList.length);
                                  }
                                  optionKeysRef.current[slideKey] = newKeys;
                                }

                                const optKey = optionKeysRef.current[slideKey][optIdx] || `opt-key-fallback-${optIdx}-${Math.random()}`;

                                return (
                                  <div
                                    key={optKey}
                                    data-opt-index={optIdx}
                                    onDragOver={isActive ? (e) => handleOptDragOver(optIdx, e, content.options || ["", ""], content.correctIndex ?? 0, updateContent, slideKey) : undefined}
                                    onDrop={isActive ? handleOptDrop : undefined}
                                    className={`w-full relative flex items-center group/opt-row overflow-visible transition-all duration-200
                                      ${isDragged ? "opacity-30 scale-[0.98]" : ""}
                                    `}
                                  >
                                    {/* Symmetrical Left Grip Handle Icon */}
                                    {isActive && (
                                      <div
                                        style={{ left: "-22px" }}
                                        draggable={isActive}
                                        onDragStart={(e) => handleOptDragStart(optIdx, e)}
                                        onDragEnd={handleOptDragEnd}
                                        onMouseDown={(e) => {
                                          e.stopPropagation();
                                          if (emblaApi) {
                                            emblaApi.reInit({ watchDrag: false });
                                          }
                                        }}
                                        onMouseUp={() => {
                                          if (draggedOptIdx === null && emblaApi) {
                                            emblaApi.reInit({ watchDrag: true });
                                          }
                                        }}
                                        onMouseLeave={() => {
                                          if (draggedOptIdx === null && emblaApi) {
                                            emblaApi.reInit({ watchDrag: true });
                                          }
                                        }}
                                        className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 flex items-center justify-center transition-all cursor-grab active:cursor-grabbing text-neutral-400 hover:text-[#0B1B4F]/75 z-20 hover:scale-115"
                                        title="Drag to reorder"
                                      >
                                        <GripVertical className="h-3.5 w-3.5 stroke-[2.5]" />
                                      </div>
                                    )}

                                    {/* The Plate */}
                                    <div
                                      className={`w-full p-3 rounded-xl border flex items-center gap-2.5 transition-all bg-white/90 backdrop-blur-xs text-[#0B1B4F] border-neutral-200/50 shadow-sm hover:bg-white
                                        ${isCorrect
                                          ? "ring-2 ring-[#C8D400] border-[#C8D400]"
                                          : "hover:border-neutral-300"
                                        }
                                        ${isDragOver && !isDragged
                                          ? "border-[#C8D400]/60 ring-2 ring-[#C8D400]/30 shadow-md scale-[1.01]"
                                          : ""
                                        }`}
                                    >
                                      {/* Correctness Checkbox Selector (empty circle/dot, visible in both active/inactive preview states) */}
                                      <button
                                        type="button"
                                        disabled={!isActive}
                                        onClick={() => {
                                          updateContent({
                                            correctIndex: optIdx,
                                            correctAnswer: option || `Option ${String.fromCharCode(65 + optIdx)}`,
                                          });
                                        }}
                                        className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 transition-colors border-2
                                          ${isCorrect
                                            ? "border-[#C8D400] bg-transparent"
                                            : "border-neutral-300 bg-transparent"
                                          }
                                          ${isActive ? "cursor-pointer hover:border-[#C8D400]" : "cursor-default"}`}
                                        title={isActive ? "Set as correct answer" : undefined}
                                      >
                                        {isCorrect && (
                                          <div className="h-2.5 w-2.5 rounded-full bg-[#C8D400]" />
                                        )}
                                      </button>

                                      {/* Answer Text Input */}
                                      <textarea
                                        ref={(node) => {
                                          if (node) {
                                            node.style.height = "auto";
                                            node.style.height = `${node.scrollHeight}px`;
                                          }
                                        }}
                                        disabled={!isActive}
                                        value={option}
                                        onChange={(e) => {
                                          const updatedOptions = [...(content.options || [])];
                                          updatedOptions[optIdx] = e.target.value;
                                          updateContent({ options: updatedOptions });
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            e.preventDefault();
                                            e.currentTarget.blur();
                                          }
                                        }}
                                        placeholder="Enter Quiz Answer"
                                        rows={1}
                                        className="bg-transparent border-none focus:outline-none text-xs md:text-sm font-medium text-[#0B1B4F] placeholder-[#0B1B4F]/40 flex-1 py-0 resize-none overflow-hidden leading-normal"
                                      />
                                    </div>

                                    {/* Delete choice option if count is greater than minimum 2 (perfectly centered and premium vector icon) */}
                                    {isActive && (content.options || []).length > 2 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updatedOptions = (content.options || []).filter((_, i) => i !== optIdx);

                                          // Keep stable keys in sync
                                          const slideKeys = optionKeysRef.current[slideKey];
                                          if (slideKeys) {
                                            optionKeysRef.current[slideKey] = slideKeys.filter((_, i) => i !== optIdx);
                                          }

                                          let nextCorrectIdx = content.correctIndex ?? 0;
                                          if (nextCorrectIdx >= updatedOptions.length) {
                                            nextCorrectIdx = 0;
                                          }
                                          updateContent({
                                            options: updatedOptions,
                                            correctIndex: nextCorrectIdx,
                                            correctAnswer: updatedOptions[nextCorrectIdx] || `Option ${String.fromCharCode(65 + nextCorrectIdx)}`
                                          });
                                        }}
                                        style={{ right: "-22px" }}
                                        className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full flex items-center justify-center transition-all cursor-pointer bg-red-500/5 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/10 hover:border-red-500 hover:scale-110 active:scale-90 z-20 shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
                                        title="Delete choice option"
                                      >
                                        <X className="h-2 w-2 stroke-[3]" />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}

                              {/* Spacious, beautiful 'Add New Option' button mirroring choices visual sizing */}
                              {isActive && (content.options || []).length < 6 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updatedOptions = [...(content.options || [])];
                                    updatedOptions.push("");

                                    // Add stable key in sync
                                    const slideKey = slide.id || `slide-${index}`;
                                    if (optionKeysRef.current[slideKey]) {
                                      optionKeysRef.current[slideKey].push(`opt-key-${Math.random().toString(36).substr(2, 9)}`);
                                    }

                                    updateContent({ options: updatedOptions });
                                  }}
                                  className={`w-full p-3 rounded-xl border border-dashed flex items-center justify-center gap-2.5 transition-all text-sm md:text-base font-bold shadow-xs cursor-pointer no-swipe shrink-0
                                    ${isDark
                                      ? "bg-[#C8D400]/10 border-[#C8D400]/30 hover:border-[#C8D400]/60 text-[#C8D400] hover:bg-[#C8D400]/20"
                                      : "bg-[#0B1B4F]/5 border-[#0B1B4F]/20 hover:border-[#0B1B4F]/40 text-[#0B1B4F] hover:bg-[#0B1B4F]/10"
                                    }`}
                                >
                                  + Add New Option
                                </button>
                              )}
                            </div>

                            {/* Commentary (optional) */}
                            <div className={`w-full flex flex-col items-start shrink-0 pt-3.5 border-t ${isDark ? "border-white/10" : "border-[#0B1B4F]/10"}`}>
                              <textarea
                                ref={(node) => {
                                  if (node) {
                                    node.style.height = "auto";
                                    node.style.height = `${node.scrollHeight}px`;
                                  }
                                }}
                                disabled={!isActive}
                                value={content.explanation || ""}
                                onChange={(e) => updateContent({ explanation: e.target.value })}
                                placeholder="Commentary (optional)"
                                rows={1}
                                className={`font-sans font-medium text-left resize-none bg-transparent focus:outline-none leading-relaxed shrink-0 w-full p-0 border-0 focus:ring-0 overflow-hidden text-sm md:text-base ${textColor} ${placeholderColor}`}
                              />
                              {!content.explanation && (
                                <span className={`text-[10px] md:text-xs font-normal leading-normal mt-1 block select-none ${isDark ? "text-white/40" : "text-[#0B1B4F]/40"}`}>
                                  Learners will see this comment after selecting any answer.
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })()}


                      {/* slide type: ROLEPLAY (dialogue) */}
                      {slide.type === "dialogue" && (() => {
                        const slideId = slide.id || `slide-${index}`;
                        const avatarA = content.avatarA || "👩‍💼";
                        const avatarB = content.avatarB || "👷‍♂️";
                        const labelA = content.labelA ?? "";
                        const labelB = content.labelB ?? "";
                        const isPickerOpenA = avatarPickerOpen?.slideId === slideId && avatarPickerOpen.side === "A";
                        const isPickerOpenB = avatarPickerOpen?.slideId === slideId && avatarPickerOpen.side === "B";
                        const pickerSide = avatarPickerOpen?.side;
                        const currentAvatarEmoji = pickerSide === "A" ? avatarA : avatarB;

                        const isGenerating = slide.assetStatus === "pending" || slide.assetStatus === "generating";
                        const isFailed = slide.assetStatus === "failed";

                        const handleRegenerateVideo = async () => {
                          if (!slide.id) return;
                          onUpdateSlideContent(index, {}, { assetStatus: "generating" });
                          try {
                            const res = await fetch(`/api/slides/${slide.id}/regenerate?asset=video`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ dialogueLines: content.dialogueLines }),
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

                        const dKey = `${slideId}-dialogue`;
                        if (!lineKeysRef.current[dKey]) {
                          lineKeysRef.current[dKey] = [];
                        }
                        const currentKeys = lineKeysRef.current[dKey];
                        const linesList = content.dialogueLines || [];
                        if (currentKeys.length !== linesList.length) {
                          const newKeys = [...currentKeys];
                          if (newKeys.length < linesList.length) {
                            while (newKeys.length < linesList.length) {
                              newKeys.push(`line-key-${Math.random().toString(36).substr(2, 9)}`);
                            }
                          } else {
                            newKeys.splice(linesList.length);
                          }
                          lineKeysRef.current[dKey] = newKeys;
                        }

                        if (isGenerating) {
                          return (
                            <div className="flex-1 flex flex-col justify-center items-center text-center p-6 gap-3 min-h-0 w-full z-10 font-sans">
                              <Loader2 className="h-10 w-10 animate-spin text-[#C8D400]" />
                              <h3 className={`text-base font-bold ${titleColor}`}>Generating Roleplay Video...</h3>
                              <p className={`text-xs max-w-[200px] leading-normal ${mutedTextColor}`}>
                                HeyGen is rendering your dialogue. This usually takes 2–5 minutes.
                              </p>
                            </div>
                          );
                        }

                        if (isFailed) {
                          return (
                            <div className="flex-1 flex flex-col justify-center items-center text-center p-6 gap-3 min-h-0 w-full z-10 font-sans">
                              <div className="p-3 bg-red-500/10 text-red-500 rounded-full border border-red-500/20">
                                <AlertTriangle className="h-8 w-8 text-red-500 animate-bounce" />
                              </div>
                              <h3 className="text-base font-bold text-red-500 font-sans">Video Generation Failed</h3>
                              <p className={`text-xs max-w-[200px] leading-normal ${mutedTextColor}`}>
                                We encountered an error while calling the HeyGen API.
                              </p>
                              {isActive && (
                                <button
                                  type="button"
                                  onClick={handleRegenerateVideo}
                                  className="mt-2 text-xs font-bold bg-[#C8D400] hover:bg-[#B6C200] text-[#1B2A6B] py-2 px-5 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer no-swipe font-sans"
                                >
                                  Retry Generation
                                </button>
                              )}
                            </div>
                          );
                        }

                        return (
                          <div
                            style={{ marginLeft: "-28px", marginRight: "-28px", paddingLeft: "28px", paddingRight: "28px", width: "calc(100% + 56px)" }}
                            className="flex-1 flex flex-col min-h-0 pt-1 overflow-y-auto scrollbar-none pb-4"
                          >
                            {/* Avatar Header */}
                            <div className="flex items-end justify-between shrink-0 py-3 px-[16px]">
                              {/* Avatar A */}
                              <div className="flex flex-col items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={!isActive}
                                  onClick={() => {
                                    if (!isActive) return;
                                    setAvatarPickerOpen(isPickerOpenA ? null : { slideId, side: "A" });
                                  }}
                                  className={`w-[120px] h-[120px] rounded-full border-[3px] border-[#C8D400] shadow-lg flex items-center justify-center relative group shrink-0 transition-all duration-200
                                    ${isDark ? "bg-neutral-800/80" : "bg-[#C8D400]/10"}
                                    ${isActive ? "cursor-pointer" : "cursor-default"}
                                    ${isPickerOpenA ? "ring-2 ring-offset-2 ring-[#C8D400]/60 scale-105" : isActive ? "hover:scale-105 hover:shadow-xl" : ""}
                                  `}
                                >
                                  <span className="text-[66px] leading-none select-none">{avatarA}</span>
                                  {isActive && (
                                    <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/25 flex items-center justify-center transition-all">
                                      <span className="text-white text-[9px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
                                    </div>
                                  )}
                                </button>
                                <input
                                  type="text"
                                  disabled={!isActive}
                                  value={labelA}
                                  onChange={(e) => updateContent({ labelA: e.target.value })}
                                  placeholder="Name..."
                                  className={`bg-transparent border-none text-sm font-semibold text-center focus:outline-none w-28 ${isDark ? "text-white/70 placeholder-white/30" : "text-[#0B1B4F]/70 placeholder-[#0B1B4F]/30"}`}
                                />
                              </div>

                              {/* Avatar B */}
                              <div className="flex flex-col items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={!isActive}
                                  onClick={() => {
                                    if (!isActive) return;
                                    setAvatarPickerOpen(isPickerOpenB ? null : { slideId, side: "B" });
                                  }}
                                  className={`w-[120px] h-[120px] rounded-full border-[3px] border-blue-500 shadow-lg flex items-center justify-center relative group shrink-0 transition-all duration-200
                                    ${isDark ? "bg-neutral-800/80" : "bg-blue-500/10"}
                                    ${isActive ? "cursor-pointer" : "cursor-default"}
                                    ${isPickerOpenB ? "ring-2 ring-offset-2 ring-blue-500/60 scale-105" : isActive ? "hover:scale-105 hover:shadow-xl" : ""}
                                  `}
                                >
                                  <span className="text-[66px] leading-none select-none">{avatarB}</span>
                                  {isActive && (
                                    <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/25 flex items-center justify-center transition-all">
                                      <span className="text-white text-[9px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
                                    </div>
                                  )}
                                </button>
                                <input
                                  type="text"
                                  disabled={!isActive}
                                  value={labelB}
                                  onChange={(e) => updateContent({ labelB: e.target.value })}
                                  placeholder="Name..."
                                  className={`bg-transparent border-none text-sm font-semibold text-center focus:outline-none w-28 ${isDark ? "text-white/70 placeholder-white/30" : "text-[#0B1B4F]/70 placeholder-[#0B1B4F]/30"}`}
                                />
                              </div>
                            </div>

                            {/* Avatar Picker Panel */}
                            {(isPickerOpenA || isPickerOpenB) && avatarPickerOpen?.slideId === slideId && (
                              <div className={`shrink-0 rounded-2xl border p-3 mb-3 relative ${isDark ? "bg-neutral-900/95 border-white/10 shadow-xl" : "bg-white/98 border-neutral-200/80 shadow-xl"}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#0B1B4F]/40"}`}>
                                    {pickerSide === "A" ? (labelA || "Character A") : (labelB || "Character B")}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setAvatarPickerOpen(null)}
                                    className={`h-5 w-5 rounded-full flex items-center justify-center transition-colors ${isDark ? "text-white/40 hover:text-white hover:bg-white/10" : "text-[#0B1B4F]/40 hover:text-[#0B1B4F] hover:bg-black/5"}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                                <div className="flex flex-wrap gap-1 mb-3">
                                  {DIALOGUE_AVATARS.map((emoji) => (
                                    <button
                                      key={emoji}
                                      type="button"
                                      onClick={() => updateContent(pickerSide === "A" ? { avatarA: emoji } : { avatarB: emoji })}
                                      className={`text-xl h-9 w-9 rounded-xl flex items-center justify-center transition-all leading-none
                                        ${emoji === currentAvatarEmoji
                                          ? "bg-[#C8D400]/20 ring-1 ring-[#C8D400] scale-110"
                                          : isDark ? "hover:bg-white/10 bg-white/5" : "hover:bg-[#0B1B4F]/8 bg-[#0B1B4F]/3"
                                        }`}
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Dialogue Lines Editor Section */}
                            <div className="shrink-0 mt-3 flex flex-col">
                              <div className={`text-[11px] font-extrabold uppercase tracking-wider mb-2.5 ${isDark ? "text-white/40" : "text-[#0B1B4F]/40"}`}>
                                Dialogue Lines
                              </div>
                              <div className="flex flex-col">
                                {linesList.map((line: any, lineIdx: number) => {
                                  const isLineDragged = isActive && draggedLineIdx === lineIdx;
                                  const lineKey = lineKeysRef.current[dKey][lineIdx] || `line-key-fallback-${lineIdx}-${Math.random()}`;
                                  return (
                                    <div
                                      key={lineKey}
                                      data-line-index={lineIdx}
                                      onDragOver={isActive ? (e) => handleLineDragOver(lineIdx, e, content.dialogueLines || [], updateContent, dKey) : undefined}
                                      onDrop={isActive ? handleLineDrop : undefined}
                                      className={`flex items-center gap-2 mb-2 relative group/line transition-all duration-200 ${isLineDragged ? "opacity-30 scale-[0.98]" : ""}`}
                                    >
                                      {/* Grip handle */}
                                      {isActive && (
                                        <div
                                          draggable={isActive}
                                          onDragStart={(e) => handleLineDragStart(lineIdx, e)}
                                          onDragEnd={handleLineDragEnd}
                                          onMouseDown={(e) => { e.stopPropagation(); if (emblaApi) emblaApi.reInit({ watchDrag: false }); }}
                                          onMouseUp={() => { if (draggedLineIdx === null && emblaApi) emblaApi.reInit({ watchDrag: true }); }}
                                          onMouseLeave={() => { if (draggedLineIdx === null && emblaApi) emblaApi.reInit({ watchDrag: true }); }}
                                          className="h-6 w-6 flex items-center justify-center cursor-grab active:cursor-grabbing text-neutral-400 hover:text-foreground shrink-0 transition-transform hover:scale-110"
                                          title="Drag to reorder"
                                        >
                                          <GripVertical className="h-4 w-4" />
                                        </div>
                                      )}

                                      {/* Character selector dropdown */}
                                      <select
                                        disabled={!isActive}
                                        value={line.character}
                                        onChange={(e) => {
                                          const updatedLines = [...linesList];
                                          updatedLines[lineIdx] = { ...line, character: e.target.value };
                                          updateContent({ dialogueLines: updatedLines });
                                        }}
                                        className={`rounded-lg border px-2 py-1.5 text-xs shrink-0 bg-transparent min-w-[110px] focus:outline-none focus:ring-1 focus:ring-[#C8D400]/50
                                          ${isDark 
                                            ? "border-white/10 bg-neutral-900 text-white" 
                                            : "border-neutral-200 bg-white text-[#0B1B4F]"
                                          }`}
                                      >
                                        <option value="instructor">{avatarA} {labelA || "Instructor"}</option>
                                        <option value="student">{avatarB} {labelB || "Student"}</option>
                                      </select>

                                      {/* Dialogue line text input */}
                                      <input
                                        type="text"
                                        disabled={!isActive}
                                        value={line.text}
                                        onChange={(e) => {
                                          const updatedLines = [...linesList];
                                          updatedLines[lineIdx] = { ...line, text: e.target.value };
                                          updateContent({ dialogueLines: updatedLines });
                                        }}
                                        placeholder="Enter dialogue text..."
                                        className={`flex-1 rounded-lg border px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#C8D400]/50 bg-transparent
                                          ${isDark 
                                            ? "border-white/10 text-white placeholder-white/20" 
                                            : "border-neutral-200 text-[#0B1B4F] placeholder-neutral-400"
                                          }`}
                                      />

                                      {/* Delete button */}
                                      {isActive && linesList.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updatedLines = linesList.filter((_, i) => i !== lineIdx);
                                            const keysList = lineKeysRef.current[dKey];
                                            if (keysList) {
                                              lineKeysRef.current[dKey] = keysList.filter((_, i) => i !== lineIdx);
                                            }
                                            updateContent({ dialogueLines: updatedLines });
                                          }}
                                          className="h-6 w-6 rounded-md flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0 cursor-pointer"
                                          title="Delete line"
                                        >
                                          <X className="h-4 w-4" />
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}

                                {/* Add Line Button */}
                                {isActive && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updatedLines = [...linesList];
                                      updatedLines.push({ character: "student", text: "" });
                                      const keysList = lineKeysRef.current[dKey];
                                      if (keysList) {
                                        keysList.push(`line-key-${Math.random().toString(36).substr(2, 9)}`);
                                      }
                                      updateContent({ dialogueLines: updatedLines });
                                    }}
                                    className={`w-full py-2 border border-dashed rounded-xl text-xs font-bold transition-all cursor-pointer no-swipe shrink-0 mt-1 flex items-center justify-center gap-1.5
                                      ${isDark
                                        ? "bg-[#C8D400]/10 border-[#C8D400]/25 hover:border-[#C8D400]/50 text-[#C8D400] hover:bg-[#C8D400]/15"
                                        : "bg-[#0B1B4F]/5 border-[#0B1B4F]/15 hover:border-[#0B1B4F]/30 text-[#0B1B4F] hover:bg-[#0B1B4F]/10"
                                      }`}
                                  >
                                    + Add Line
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Video Preview viewport */}
                            {(() => {
                              const videoUrl = content.assetUrl || content.url;

                              if (videoUrl) {
                                return (
                                  <div className="mt-4 shrink-0 rounded-xl overflow-hidden border border-neutral-200 dark:border-white/10 bg-black aspect-video flex items-center justify-center">
                                    <video
                                      src={videoUrl}
                                      controls
                                      className="w-full h-full object-contain"
                                    />
                                  </div>
                                );
                              }

                              return (
                                <div className={`mt-4 rounded-xl border border-dashed flex flex-col items-center justify-center text-center p-6 gap-2 shrink-0 relative min-h-[120px] ${isDark ? "bg-black/40 border-white/15 text-white/50" : "bg-black/5 border-black/10 text-neutral-400"}`}>
                                  <Video className="h-5 w-5 opacity-40" />
                                  <span className="text-[11px] font-medium">No video generated yet.</span>
                                </div>
                              );
                            })()}

                            {/* Manual Regenerate Button */}
                            {isActive && (
                              <button
                                type="button"
                                onClick={handleRegenerateVideo}
                                className={`mt-3 border rounded-lg py-1.5 px-3.5 text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm
                                  ${isDark 
                                    ? "border-white/10 bg-neutral-800 hover:bg-neutral-700 text-white" 
                                    : "border-neutral-200 bg-white hover:bg-neutral-50 text-[#0B1B4F]"
                                  }`}
                              >
                                <RefreshCw className="h-3.5 w-3.5" /> ↺ Regenerate Video
                              </button>
                            )}
                          </div>
                        );
                      })()}

                      {/* slide type: CHAT — Telegram-style, full-width, resizable */}
                      {slide.type === "chat" && (() => {
                        const chatVolume = content.chatVolume ?? 100;
                        const belowType = content.belowType || "none";
                        const hasBelow = chatVolume < 98;

                        return (
                          <div className="flex-1 flex flex-col min-h-0 -mx-7 -mb-4 overflow-hidden">
                            {/* Chat messages section */}
                            <div
                              className={`flex flex-col overflow-hidden relative ${hasBelow ? "shrink-0" : "flex-1 min-h-0"}`}
                              style={hasBelow ? { height: `${chatVolume}%` } : {}}
                            >
                              {/* Scrollable bubbles */}
                              <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 px-2.5 pt-4 pb-1 scrollbar-none min-h-0">
                                {(content.chatBubbles || []).map((bubble: any, bIdx: number) => {
                                  const isLeft = bubble.align === "left";
                                  return (
                                    <div
                                      key={bubble.id || bIdx}
                                      className={`flex flex-col max-w-[78%] relative group/chatbubble ${isLeft ? "self-start" : "self-end ml-auto"}`}
                                    >
                                      {/* Hover controls */}
                                      {isActive && (
                                        <div className={`absolute top-[-14px] ${isLeft ? "left-0" : "right-0"} flex items-center border rounded-md p-0.5 gap-1 opacity-0 group-hover/chatbubble:opacity-100 transition-opacity z-20 shadow-lg ${isDark ? "bg-neutral-900 border-neutral-800 text-white" : "bg-white border-neutral-200 text-[#0B1B4F]"}`}>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const updatedBubbles = [...(content.chatBubbles || [])];
                                              updatedBubbles[bIdx] = { ...updatedBubbles[bIdx], align: isLeft ? "right" : "left" };
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
                                              const updatedBubbles = (content.chatBubbles || []).filter((_: any, i: number) => i !== bIdx);
                                              updateContent({ chatBubbles: updatedBubbles });
                                            }}
                                            className="text-red-500 hover:scale-105 text-[6.5px] px-1 transition-transform"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      )}

                                      {bubble.type === "text" && (
                                        <textarea
                                          disabled={!isActive}
                                          value={bubble.text || ""}
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
                                          className={`px-3 py-2 text-[10px] md:text-xs leading-snug focus:outline-none resize-none overflow-hidden w-full shadow-sm
                                            ${isLeft
                                              ? "bg-white text-gray-900 rounded-tl-2xl rounded-tr-2xl rounded-br-2xl rounded-bl-sm placeholder-gray-400 focus:ring-1 focus:ring-blue-200"
                                              : isDark
                                                ? "bg-[#2B5278] text-white rounded-tl-2xl rounded-tr-2xl rounded-br-sm rounded-bl-2xl placeholder-white/40 focus:ring-1 focus:ring-blue-400/50"
                                                : "bg-[#DCFEC4] text-gray-900 rounded-tl-2xl rounded-tr-2xl rounded-br-sm rounded-bl-2xl placeholder-gray-400 focus:ring-1 focus:ring-green-300"
                                            }`}
                                        />
                                      )}

                                      {bubble.type === "image" && (
                                        <div className={`p-0.5 rounded-2xl overflow-hidden shadow-sm ${isLeft ? "bg-white" : isDark ? "bg-[#2B5278]" : "bg-[#DCFEC4]"}`}>
                                          {bubble.url ? (
                                            <img src={bubble.url} alt="chat image" className="w-[110px] aspect-video object-cover rounded-xl" />
                                          ) : (
                                            <div className="w-[110px] h-12 bg-neutral-200 rounded-xl flex items-center justify-center">
                                              <ImageIcon className="h-4 w-4 text-neutral-400" />
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
                                    className={`w-full border border-dashed text-[8px] py-1.5 rounded-xl gap-1 flex items-center justify-center shrink-0 cursor-pointer transition-colors mt-1 ${isDark
                                      ? "border-white/20 hover:border-[#C8D400]/40 text-white/50 hover:text-white bg-white/5"
                                      : "border-black/15 hover:border-[#C8D400]/40 text-black/40 hover:text-black bg-black/5"
                                    }`}
                                  >
                                    + Add message bubble
                                  </button>
                                )}
                              </div>

                              {/* Bottom drag-to-resize handle */}
                              {isActive && (
                                <div
                                  onMouseDown={(e) => handleChatResizeStart(e, index, chatVolume)}
                                  onTouchStart={(e) => handleChatResizeStart(e, index, chatVolume)}
                                  className="shrink-0 h-7 flex items-center justify-center cursor-ns-resize z-30 select-none no-swipe bg-gradient-to-t from-black/40 to-transparent hover:from-black/60 transition-all"
                                >
                                  <div className={`text-[7px] font-black tracking-wider px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 border ${isDark
                                    ? "bg-neutral-900/90 border-white/10 text-white/60"
                                    : "bg-white/90 border-neutral-200 text-neutral-700"
                                  }`}>
                                    <GripHorizontal className="h-2.5 w-2.5 shrink-0" />
                                    DRAG TO RESIZE
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Content zone below chat (appears when chat is resized shorter) */}
                            {hasBelow && (
                              <div className="flex-1 flex flex-col justify-center px-2 py-2 min-h-0">
                                {belowType === "image" && (
                                  <div className="w-full h-full flex flex-col min-h-0">
                                    {(content.imageUrl || content.url) ? (
                                      <div
                                        className="w-full relative shrink-0 group/belowimg overflow-hidden rounded-xl"
                                        style={{ height: `${content.imageVolume ?? 100}%` }}
                                      >
                                        <div className="w-full h-full overflow-hidden flex items-center justify-center bg-black/10 rounded-xl">
                                          <img
                                            src={content.imageUrl || content.url || ""}
                                            alt="below chat"
                                            style={{ transform: `scale(${content.imageScale ?? 1.0})` }}
                                            className="w-full h-full object-cover transition-transform duration-105"
                                          />
                                        </div>
                                      </div>
                                    ) : isActive ? (
                                      <button
                                        type="button"
                                        onClick={() => onOpenMediaPicker()}
                                        className={`flex-1 flex items-center justify-center gap-1.5 text-[9px] font-bold rounded-xl border border-dashed transition-colors ${isDark ? "border-white/20 hover:border-white/40 text-white/50 hover:text-white" : "border-black/15 hover:border-black/30 text-black/40 hover:text-black"}`}
                                      >
                                        <ImageIcon className="h-3.5 w-3.5" /> Add Image
                                      </button>
                                    ) : null}
                                  </div>
                                )}

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
                                    className={`font-sans font-medium text-left resize-none bg-transparent focus:outline-none leading-relaxed w-full p-0 border-0 focus:ring-0 overflow-y-auto scrollbar-none text-base md:text-lg ${isDark ? `text-white ${placeholderColor}` : `text-[#0B1B4F] ${placeholderColor}`}`}
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* slide type: RATE */}
                      {slide.type === "poll" && (() => {
                        // Initial picker screen — no rating type chosen yet
                        if (!content.pollType) {
                          return (
                            <div className="flex-1 flex flex-col justify-center items-stretch gap-6 px-1 pt-6 pb-4 w-full z-10">
                              <div className="flex flex-col items-center text-center gap-1.5 mb-1 shrink-0">
                                <div className="p-3 rounded-2xl bg-[#C8D400]/10 border border-[#C8D400]/20 text-[#C8D400] animate-pulse">
                                  <Star className="h-7 w-7" />
                                </div>
                                <h3 className={`text-base md:text-lg font-bold tracking-tight ${titleColor}`}>Add Rate Block</h3>
                                <p className={`text-xs max-w-[200px] leading-normal ${mutedTextColor}`}>
                                  Choose a rating format for your feedback question.
                                </p>
                              </div>

                              <div className="flex flex-col gap-3 w-full shrink-0">
                                {/* Stars button */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateContent({ pollType: "stars" });
                                  }}
                                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer text-left no-swipe
                                    ${isDark
                                      ? "bg-white/5 border-white/10 hover:border-[#C8D400]/60 hover:bg-[#C8D400]/5 text-white shadow-md shadow-black/20"
                                      : "bg-white border-neutral-200 hover:border-[#C8D400]/60 hover:bg-[#C8D400]/5 text-[#0B1B4F] shadow-sm hover:shadow-md"
                                    }`}
                                >
                                  <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 text-lg shrink-0 leading-none">
                                    ⭐
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold uppercase tracking-wider">Stars</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">5-star rating scale for satisfaction scores</p>
                                  </div>
                                </button>

                                {/* Emojis button */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateContent({ pollType: "emojis" });
                                  }}
                                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer text-left no-swipe
                                    ${isDark
                                      ? "bg-white/5 border-white/10 hover:border-[#C8D400]/60 hover:bg-[#C8D400]/5 text-white shadow-md shadow-black/20"
                                      : "bg-white border-neutral-200 hover:border-[#C8D400]/60 hover:bg-[#C8D400]/5 text-[#0B1B4F] shadow-sm hover:shadow-md"
                                    }`}
                                >
                                  <div className="p-2.5 rounded-xl bg-blue-500/10 text-lg shrink-0 leading-none">
                                    😐
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold uppercase tracking-wider">Emojis</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">Expressive emoji reactions from negative to positive</p>
                                  </div>
                                </button>

                                {/* Thumbs up/down button */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateContent({ pollType: "thumbs" });
                                  }}
                                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer text-left no-swipe
                                    ${isDark
                                      ? "bg-white/5 border-white/10 hover:border-[#C8D400]/60 hover:bg-[#C8D400]/5 text-white shadow-md shadow-black/20"
                                      : "bg-white border-neutral-200 hover:border-[#C8D400]/60 hover:bg-[#C8D400]/5 text-[#0B1B4F] shadow-sm hover:shadow-md"
                                    }`}
                                >
                                  <div className="p-2.5 rounded-xl bg-green-500/10 text-lg shrink-0 leading-none">
                                    👍
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold uppercase tracking-wider">Thumbs up/down</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">Simple binary yes / no feedback response</p>
                                  </div>
                                </button>
                              </div>
                            </div>
                          );
                        }

                        // Type selected — question · rating zone · response field
                        return (
                          <div className="flex-1 flex flex-col min-h-0 py-3 gap-3 px-1">

                            {/* 1. Question textarea — exact body style, centered */}
                            <div className="flex-1 flex flex-col justify-end items-center min-h-0 pb-1">
                              <textarea
                                ref={(node) => {
                                  if (node) {
                                    node.style.height = "auto";
                                    node.style.height = `${node.scrollHeight}px`;
                                  }
                                }}
                                disabled={!isActive}
                                value={content.heading || ""}
                                onChange={(e) => updateContent({ heading: e.target.value })}
                                placeholder="Enter a question or statement for learners to rate."
                                rows={1}
                                className={`font-sans font-medium text-center text-lg md:text-xl resize-none bg-transparent focus:outline-none leading-relaxed w-full p-0 border-0 focus:ring-0 overflow-y-auto scrollbar-none ${isDark ? "text-white placeholder-white/35" : "text-[#0B1B4F] placeholder-[#0B1B4F]/35"}`}
                              />
                            </div>

                            {/* 2. Rating zone — styled pill container, sits slightly above center */}
                            <div className={`w-full rounded-2xl flex items-center justify-center py-5 shrink-0 ${isDark ? "bg-white/8 border border-white/10" : "bg-black/8 border border-black/6"}`}>
                              {content.pollType === "stars" && (
                                <div className="flex gap-2 items-center">
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <Star
                                      key={s}
                                      className={`h-8 w-8 shrink-0 hover:scale-110 transition-transform cursor-pointer ${isDark ? "text-white/60 fill-white/20" : "text-[#0B1B4F]/40 fill-[#0B1B4F]/10"}`}
                                    />
                                  ))}
                                </div>
                              )}
                              {content.pollType === "emojis" && (
                                <div className="flex gap-4 items-center text-3xl">
                                  {["😢", "😐", "😍"].map((emoji) => (
                                    <span key={emoji} className="hover:scale-110 transition-transform cursor-pointer shrink-0 select-none">
                                      {emoji}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {content.pollType === "thumbs" && (
                                <div className="flex gap-6 items-center text-3xl">
                                  {["👎", "👍"].map((emoji) => (
                                    <span key={emoji} className="hover:scale-110 transition-transform cursor-pointer shrink-0 select-none">
                                      {emoji}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* 3. Response field preview — body font size, anchored to top of lower flex area */}
                            <div className="flex-[1.5] flex flex-col justify-start items-stretch pt-1">
                              <div className={`w-full rounded-2xl p-4 border ${isDark ? "bg-white/5 border-white/8" : "bg-white/90 border-black/6 shadow-sm"}`}>
                                <p className={`font-sans font-medium text-base md:text-lg leading-relaxed ${isDark ? "text-white/35" : "text-[#0B1B4F]/40"}`}>
                                  This is where your learners will type their responses.
                                </p>
                                <p className={`font-sans font-medium text-base md:text-lg leading-relaxed mt-2 ${isDark ? "text-white/25" : "text-[#0B1B4F]/30"}`}>
                                  You'll be able to view all responses in the course analytics.
                                </p>
                              </div>
                            </div>

                          </div>
                        );
                      })()}

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
                      onOpenMediaPicker();
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
                        onClick={() => onOpenMediaPicker()}
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

      {/* Video generate mode bottom toolbar */}
      {activeSlideIndex !== null && slidesList[activeSlideIndex]?.type === "video" && slidesList[activeSlideIndex]?.content?.videoMode === "generate" && !slidesList[activeSlideIndex]?.content?.url && isVideoConfigOpen && (() => {
        const slide = slidesList[activeSlideIndex];
        const content = slide.content || {};
        const avatarId = content.avatarId;
        const speechText = content.speechText || "";
        const captions = content.captions || "";
        const updateContent = (fields: any) => onUpdateSlideContent(activeSlideIndex, fields);

        const avatarRoles = [
          { id: "instructor", name: "Instructor", emoji: "👩‍🏫" },
          { id: "student", name: "Student", emoji: "🧑‍💻" },
        ];

        const panelBg = isDark
          ? "bg-neutral-950/95 border-neutral-800 text-white"
          : "bg-white/95 border-neutral-200 text-[#0B1B4F]";

        return (
          <div className="flex flex-col items-center gap-2 w-full z-20 mb-2 mt-[-16px] animate-fade-in no-swipe">
            <div className={`border rounded-2xl px-3 py-2.5 shadow-2xl flex flex-col gap-2.5 z-50 w-full max-w-xs backdrop-blur-md ${panelBg}`}>
              {/* Avatar row */}
              <div className="flex flex-col gap-1.5 text-left">
                <p className={`text-[7px] font-black uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#0B1B4F]/40"}`}>Select Role</p>
                <div className="flex gap-1.5">
                  {avatarRoles.map((av) => (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => updateContent({ avatarId: av.id })}
                      className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl border transition-all cursor-pointer text-[6.5px] font-black uppercase
                        ${avatarId === av.id
                          ? "border-[#C8D400] bg-[#C8D400]/10 text-[#C8D400]"
                          : (isDark
                            ? "border-white/10 bg-white/5 text-white/50 hover:border-white/30"
                            : "border-[#0B1B4F]/10 bg-black/5 text-[#0B1B4F]/50 hover:border-[#0B1B4F]/25"
                          )
                        }`}
                    >
                      <span className="text-base leading-none">{av.emoji}</span>
                      {av.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Speech & Captions quick-edit row */}
              <div className="flex gap-1.5 text-left">
                {/* Edit Speech */}
                <div className="flex-1 flex flex-col gap-1">
                  <p className={`text-[7px] font-black uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#0B1B4F]/40"}`}>
                    <Mic className="inline h-2.5 w-2.5 mr-0.5" />Speech
                  </p>
                  <textarea
                    value={speechText}
                    onChange={(e) => {
                      const newSpeech = e.target.value;
                      const fields: any = { speechText: newSpeech };
                      if (!captions || captions === speechText) {
                        fields.captions = newSpeech;
                      }
                      updateContent(fields);
                    }}
                    placeholder="Avatar speech script..."
                    rows={2}
                    className={`w-full rounded-xl border px-2 py-1.5 text-[9px] leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-[#C8D400] transition-colors
                      ${isDark
                        ? "bg-white/5 border-white/10 text-white placeholder-white/25"
                        : "bg-black/5 border-black/10 text-[#0B1B4F] placeholder-[#0B1B4F]/25"
                      }`}
                  />
                </div>
                {/* Edit Captions */}
                <div className="flex-1 flex flex-col gap-1">
                  <p className={`text-[7px] font-black uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#0B1B4F]/40"}`}>
                    <FileText className="inline h-2.5 w-2.5 mr-0.5" />Captions
                  </p>
                  <textarea
                    value={captions}
                    onChange={(e) => updateContent({ captions: e.target.value })}
                    placeholder="Edit captions..."
                    rows={2}
                    className={`w-full rounded-xl border px-2 py-1.5 text-[9px] leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-[#C8D400] transition-colors
                      ${isDark
                        ? "bg-white/5 border-white/10 text-white placeholder-white/25"
                        : "bg-black/5 border-black/10 text-[#0B1B4F] placeholder-[#0B1B4F]/25"
                      }`}
                  />
                </div>
              </div>

              {/* Generate Video button */}
              <button
                type="button"
                disabled={!speechText.trim()}
                onClick={async () => {
                  if (!speechText.trim()) return;
                  const slideId = slide.id;
                  onUpdateSlideContent(activeSlideIndex, {}, { assetStatus: "generating" });
                  setIsVideoConfigOpen(false);
                  try {
                    const res = await fetch(`/api/slides/${slideId}/regenerate?asset=video`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ speechText }),
                    });
                    if (!res.ok) {
                      const body = await res.json().catch(() => ({}));
                      throw new Error(body.error || `Server error ${res.status}`);
                    }
                    toast.success("HeyGen video generation triggered in background.");
                  } catch (err: any) {
                    onUpdateSlideContent(activeSlideIndex, {}, { assetStatus: "failed" });
                    toast.error("Failed to generate video: " + err.message);
                  }
                }}
                className={`w-full py-2.5 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer no-swipe mt-0.5
                  ${!speechText.trim()
                    ? "opacity-40 cursor-not-allowed border-[#C8D400]/20 bg-[#C8D400]/5 text-[#C8D400]"
                    : "border-[#C8D400]/60 bg-[#C8D400]/15 hover:bg-[#C8D400]/25 text-[#C8D400]"
                  }`}
              >
                <Sparkles className="h-3.5 w-3.5" /> Generate Video
              </button>
            </div>
          </div>
        );
      })()}

      {/* Unified Video Management Footer (For active video URL) */}
      {activeSlideIndex !== null && slidesList[activeSlideIndex]?.type === "video" && slidesList[activeSlideIndex]?.content?.url && (() => {
        const slide = slidesList[activeSlideIndex];
        const content = slide.content || {};
        const showHeading = content.showHeading !== false;
        const showBody = content.showBody !== false;
        const captions = content.captions || "";
        const forceCompletion = content.forceCompletion === true;
        const updateContent = (fields: any) => onUpdateSlideContent(activeSlideIndex, fields);

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
                onClick={() => {
                  setVideoToolsOpen(!videoToolsOpen);
                  setCaptionsToolsOpen(false);
                }}
                className={`${controlBtnClass} ${videoToolsOpen ? "bg-[#C8D400] text-black border-[#C8D400] hover:bg-[#C8D400]/90" : "border-[#C8D400] text-[#C8D400] bg-[#C8D400]/10"}`}
                title="Toggle Video Config Options"
              >
                <Film className="h-4.5 w-4.5 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setCaptionsToolsOpen(!captionsToolsOpen);
                  setVideoToolsOpen(false);
                }}
                className={`${controlBtnClass} ${captionsToolsOpen ? "bg-[#C8D400] text-black border-[#C8D400] hover:bg-[#C8D400]/90" : "border-[#C8D400] text-[#C8D400] bg-[#C8D400]/10"}`}
                title="Toggle Captions Options"
              >
                <MessageSquare className="h-4.5 w-4.5 shrink-0" />
              </button>
            </div>

            {/* Row 2: Video Tools Sub-panel */}
            {videoToolsOpen && (() => {
              const panelBg = isDark
                ? "bg-neutral-950/95 border-neutral-800 text-white"
                : "bg-white/95 border-neutral-200 text-[#0B1B4F]";
              const rowBg = isDark
                ? "bg-neutral-900/60 border-neutral-800/80"
                : "bg-neutral-50/80 border-neutral-200";
              const changeBtn = isDark
                ? "bg-neutral-900 hover:bg-[#C8D400]/10 border-neutral-800 hover:border-[#C8D400]/40 text-neutral-200 hover:text-white"
                : "bg-neutral-100 hover:bg-[#C8D400]/10 border-neutral-200 hover:border-[#C8D400]/40 text-[#0B1B4F]/70 hover:text-[#0B1B4F]";
              return (
                <div className={`w-full max-w-xs border rounded-2xl p-3 shadow-2xl z-20 gap-3 mt-1.5 animate-slide-up flex flex-col no-swipe backdrop-blur-md ${panelBg}`}>
                  <div className="flex items-center gap-2 justify-between w-full">
                    {/* Force Completion Toggle */}
                    <div className={`flex items-center gap-2 px-2 py-1 rounded-xl border text-[9px] font-black uppercase tracking-wider ${rowBg}`}>
                      <span className="mr-2.5">Force Completion</span>
                      <button
                        type="button"
                        onClick={() => updateContent({ forceCompletion: !forceCompletion })}
                        className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${forceCompletion ? "bg-[#C8D400]" : "bg-neutral-600"}`}
                      >
                        <span className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${forceCompletion ? "translate-x-3" : "translate-x-0"}`} />
                      </button>
                    </div>

                    {/* Actions: Replace and Remove */}
                    <div className="flex items-center gap-1.5 ml-auto">
                      <button
                        type="button"
                        onClick={() => onOpenMediaPicker()}
                        className={`p-1.5 border rounded-xl transition-all cursor-pointer ${changeBtn}`}
                        title="Replace Video"
                      >
                        <Upload className="h-4 w-4 shrink-0" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          updateContent({
                            url: undefined,
                            videoMode: undefined,
                            captions: undefined,
                            speechText: undefined,
                            avatarId: undefined,
                          });
                        }}
                        className="p-1.5 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 hover:border-red-500/40 rounded-xl text-red-400 hover:text-red-300 transition-all cursor-pointer"
                        title="Remove Video"
                      >
                        <Trash2 className="h-4 w-4 shrink-0" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Row 3: Captions Tools Sub-panel */}
            {captionsToolsOpen && (() => {
              const panelBg = isDark
                ? "bg-neutral-950/95 border-neutral-800 text-white"
                : "bg-white/95 border-neutral-200 text-[#0B1B4F]";
              const changeBtn = isDark
                ? "bg-neutral-900 hover:bg-[#C8D400]/10 border-neutral-800 hover:border-[#C8D400]/40 text-neutral-200 hover:text-white"
                : "bg-neutral-100 hover:bg-[#C8D400]/10 border-neutral-200 hover:border-[#C8D400]/40 text-[#0B1B4F]/70 hover:text-[#0B1B4F]";
              return (
                <div className={`w-full max-w-xs border rounded-2xl p-3 shadow-2xl z-20 gap-3 mt-1.5 animate-slide-up flex flex-row items-center no-swipe backdrop-blur-md ${panelBg}`}>
                  {/* Auto-Generate Button */}
                  <button
                    type="button"
                    disabled={isGeneratingCaptions}
                    onClick={() => {
                      setIsGeneratingCaptions(true);
                      setTimeout(() => {
                        setIsGeneratingCaptions(false);
                        const title = content.heading || slide.content?.heading || "Safety Procedure";
                        const generatedSub = `Welcome to the ${title} micro-learning video. Pay close attention to these guidelines to ensure active safety compliance.`;
                        updateContent({ captions: generatedSub });
                        toast.success("AI automatic subtitles generated successfully!");
                      }, 1200);
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer text-[8px] font-black uppercase shrink-0 ${isGeneratingCaptions ? "opacity-50" : ""} ${changeBtn}`}
                  >
                    {isGeneratingCaptions ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" /> Gen...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3 text-[#C8D400]" /> Auto-Gen
                      </>
                    )}
                  </button>

                  {/* Caption Editor textarea */}
                  <div className="flex-1 min-w-0">
                    <textarea
                      value={captions}
                      onChange={(e) => updateContent({ captions: e.target.value })}
                      placeholder="Type subtitles here..."
                      rows={1}
                      className={`w-full rounded-xl border px-2 py-1.5 text-[9px] leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-[#C8D400] transition-colors scrollbar-none h-8 ${isDark ? "bg-white/5 border-white/10 text-white" : "bg-black/5 border-black/10 text-[#0B1B4F]"}`}
                    />
                  </div>
                </div>
              );
            })()}

          </div>
        );
      })()}



      {/* Chat slide toolbar — body text & image below chat */}
      {activeSlideIndex !== null && slidesList[activeSlideIndex]?.type === "chat" && (() => {
        const slide = slidesList[activeSlideIndex];
        const content = slide.content || {};
        const chatVolume = content.chatVolume ?? 100;
        const belowType = content.belowType || "none";
        const hasBelow = chatVolume < 98;
        const hasImage = !!(content.imageUrl || content.url);
        const imageScale = content.imageScale ?? 1.0;

        const updateContent = (fields: any) => onUpdateSlideContent(activeSlideIndex, fields);

        const controlBtnClass = `p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center shrink-0 w-9 h-9 ${isDark
          ? "bg-black/40 hover:bg-black/60 border-white/10 text-white/60 hover:text-white hover:border-[#C8D400]"
          : "bg-white/80 hover:bg-white/95 border-neutral-200/50 text-[#0B1B4F]/60 hover:text-[#0B1B4F] hover:border-[#C8D400]"
        }`;

        const panelBg = isDark
          ? "bg-neutral-950/95 border-neutral-800 text-white"
          : "bg-white/95 border-neutral-200 text-[#0B1B4F]";
        const rowBg = isDark
          ? "bg-neutral-900/60 border-neutral-800/80"
          : "bg-neutral-50/80 border-neutral-200";
        const mutedIcon = isDark ? "text-neutral-400" : "text-[#0B1B4F]/50";
        const changeBtn = isDark
          ? "bg-neutral-900 hover:bg-[#C8D400]/10 border-neutral-800 hover:border-[#C8D400]/40 text-neutral-200 hover:text-white"
          : "bg-neutral-100 hover:bg-[#C8D400]/10 border-neutral-200 hover:border-[#C8D400]/40 text-[#0B1B4F]/70 hover:text-[#0B1B4F]";

        return (
          <div className="flex flex-col items-center justify-center w-full z-20 gap-2 mb-2 mt-[-16px] animate-fade-in no-swipe">
            <div className="flex gap-3 justify-center items-center py-1">
              <button
                type="button"
                onClick={() => {
                  if (belowType === "text") {
                    updateContent({ belowType: "none", chatVolume: 100, body: "", text: "" });
                  } else {
                    updateContent({ belowType: "text", chatVolume: hasBelow ? chatVolume : 65 });
                    setImageToolsOpen(false);
                  }
                }}
                className={`${controlBtnClass} ${belowType === "text" ? "border-[#C8D400] text-[#C8D400] bg-[#C8D400]/10" : ""}`}
                title={belowType === "text" ? "Remove text below chat" : "Add text below chat"}
              >
                <FileText className="h-4.5 w-4.5 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => {
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
                className={`${controlBtnClass} ${belowType === "image"
                  ? imageToolsOpen
                    ? "bg-[#C8D400] text-black border-[#C8D400] hover:bg-[#C8D400]/90"
                    : "border-[#C8D400] text-[#C8D400] bg-[#C8D400]/10"
                  : ""
                }`}
                title={belowType === "image" ? "Toggle image settings" : "Add image below chat"}
              >
                <ImageIcon className="h-4.5 w-4.5 shrink-0" />
              </button>
            </div>

            {/* Image tools sub-panel (same as Card) */}
            {belowType === "image" && hasImage && imageToolsOpen && (
              <div className={`w-full max-w-xs border rounded-2xl p-3 shadow-2xl z-20 gap-3 mt-1.5 animate-slide-up flex flex-col no-swipe backdrop-blur-md ${panelBg}`}>
                {/* Zoom slider */}
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

                {/* Change and Remove */}
                <div className="flex items-center gap-1.5 justify-end">
                  <button
                    type="button"
                    onClick={() => onOpenMediaPicker()}
                    className={`p-1.5 border rounded-xl transition-all cursor-pointer ${changeBtn}`}
                    title="Change Image"
                  >
                    <Upload className="h-4 w-4 shrink-0" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      updateContent({ belowType: "none", chatVolume: 100, imageUrl: undefined, url: undefined, imageScale: undefined });
                      setImageToolsOpen(false);
                    }}
                    className="p-1.5 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 hover:border-red-500/40 rounded-xl text-red-400 hover:text-red-300 transition-all cursor-pointer"
                    title="Remove Image"
                  >
                    <Trash2 className="h-4 w-4 shrink-0" />
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Unified Audio Management Footer (For active audio URL) */}
      {activeSlideIndex !== null && slidesList[activeSlideIndex]?.type === "audio" && slidesList[activeSlideIndex]?.content?.url && (() => {
        const slide = slidesList[activeSlideIndex];
        const content = slide.content || {};
        const captions = content.captions || "";
        const forceCompletion = content.forceCompletion === true;
        const updateContent = (fields: any) => onUpdateSlideContent(activeSlideIndex, fields);

        const handleRegenerateAudio = async () => {
          if (!slide.id) return;
          onUpdateSlideContent(activeSlideIndex, {}, { assetStatus: "generating" });
          try {
            const res = await fetch(`/api/slides/${slide.id}/regenerate?asset=audio`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ audioScript: content.audioScript || content.text || content.body || "" }),
            });
            if (!res.ok) {
              const body = await res.json().catch(() => ({}));
              throw new Error(body.error || `Server error ${res.status}`);
            }
            toast.success("AI audio generation triggered in background.");
          } catch (err: any) {
            toast.error("Failed to regenerate audio: " + err.message);
            onUpdateSlideContent(activeSlideIndex, {}, { assetStatus: "failed" });
          }
        };

        // Circular control button class - perfectly matching description of 'круглые маленькие иконки'
        const controlBtnClass = `p-2.5 rounded-full border transition-all cursor-pointer flex items-center justify-center shrink-0 w-9 h-9 ${isDark
          ? "bg-black/40 hover:bg-black/60 border-white/10 text-white/60 hover:text-white hover:border-[#C8D400]"
          : "bg-white/80 hover:bg-white/95 border-neutral-200/50 text-[#0B1B4F]/60 hover:text-[#0B1B4F] hover:border-[#C8D400]"
          }`;

        return (
          <div className="flex flex-col items-center justify-center w-full z-20 gap-2 mb-2 mt-[-16px] animate-fade-in no-swipe">

            {/* Row 1: Circular Toggle Action Buttons under the card */}
            <div className="flex gap-3 justify-center items-center py-1">
              <button
                type="button"
                onClick={() => {
                  setAudioToolsOpen(!audioToolsOpen);
                  setAudioTranscriptToolsOpen(false);
                }}
                className={`${controlBtnClass} ${audioToolsOpen ? "bg-[#C8D400] text-black border-[#C8D400] hover:bg-[#C8D400]/90" : "border-[#C8D400] text-[#C8D400] bg-[#C8D400]/10"}`}
                title="Audio Config Options"
              >
                <Music className="h-4.5 w-4.5 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setAudioTranscriptToolsOpen(!audioTranscriptToolsOpen);
                  setAudioToolsOpen(false);
                }}
                className={`${controlBtnClass} ${audioTranscriptToolsOpen ? "bg-[#C8D400] text-black border-[#C8D400] hover:bg-[#C8D400]/90" : "border-[#C8D400] text-[#C8D400] bg-[#C8D400]/10"}`}
                title="Transcript & Subtitle Options"
              >
                <FileText className="h-4.5 w-4.5 shrink-0" />
              </button>
            </div>

            {/* Row 2: Audio Settings Sub-panel */}
            {audioToolsOpen && (() => {
              const panelBg = isDark
                ? "bg-neutral-950/95 border-neutral-800 text-white"
                : "bg-white/95 border-neutral-200 text-[#0B1B4F]";
              const rowBg = isDark
                ? "bg-neutral-900/60 border-neutral-800/80"
                : "bg-neutral-50/80 border-neutral-200";
              const changeBtn = isDark
                ? "bg-neutral-900 hover:bg-[#C8D400]/10 border-neutral-800 hover:border-[#C8D400]/40 text-neutral-200 hover:text-white"
                : "bg-neutral-100 hover:bg-[#C8D400]/10 border-neutral-200 hover:border-[#C8D400]/40 text-[#0B1B4F]/70 hover:text-[#0B1B4F]";
              return (
                <div className={`w-full max-w-xs border rounded-2xl p-3 shadow-2xl z-20 gap-3 mt-1.5 animate-slide-up flex flex-col no-swipe backdrop-blur-md ${panelBg}`}>
                  <div className="flex items-center gap-2 justify-between w-full">
                    {/* Force Completion Toggle */}
                    <div className={`flex items-center gap-2 px-2 py-1 rounded-xl border text-[9px] font-black uppercase tracking-wider ${rowBg}`}>
                      <span className="mr-2.5">Force Completion</span>
                      <button
                        type="button"
                        onClick={() => updateContent({ forceCompletion: !forceCompletion })}
                        className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${forceCompletion ? "bg-[#C8D400]" : "bg-neutral-600"}`}
                      >
                        <span className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${forceCompletion ? "translate-x-3" : "translate-x-0"}`} />
                      </button>
                    </div>

                    {/* Actions: Replace, Regenerate and Remove */}
                    <div className="flex items-center gap-1.5 ml-auto">
                      <button
                        type="button"
                        onClick={handleRegenerateAudio}
                        className={`p-1.5 border rounded-xl transition-all cursor-pointer ${changeBtn}`}
                        title="Regenerate Audio"
                      >
                        <RefreshCw className="h-4 w-4 shrink-0" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenMediaPicker()}
                        className={`p-1.5 border rounded-xl transition-all cursor-pointer ${changeBtn}`}
                        title="Replace Audio"
                      >
                        <Upload className="h-4 w-4 shrink-0" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          updateContent({
                            url: undefined,
                            audioMode: undefined,
                            captions: undefined,
                            speechText: undefined,
                            voiceId: undefined,
                          });
                        }}
                        className="p-1.5 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 hover:border-red-500/40 rounded-xl text-red-400 hover:text-red-300 transition-all cursor-pointer"
                        title="Remove Audio"
                      >
                        <Trash2 className="h-4 w-4 shrink-0" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Row 3: Transcript/Subtitle Sub-panel */}
            {audioTranscriptToolsOpen && (() => {
              const panelBg = isDark
                ? "bg-neutral-950/95 border-neutral-800 text-white"
                : "bg-white/95 border-neutral-200 text-[#0B1B4F]";
              const changeBtn = isDark
                ? "bg-neutral-900 hover:bg-[#C8D400]/10 border-neutral-800 hover:border-[#C8D400]/40 text-neutral-200 hover:text-white"
                : "bg-neutral-100 hover:bg-[#C8D400]/10 border-neutral-200 hover:border-[#C8D400]/40 text-[#0B1B4F]/70 hover:text-[#0B1B4F]";
              return (
                <div className={`w-full max-w-xs border rounded-2xl p-3 shadow-2xl z-20 gap-3 mt-1.5 animate-slide-up flex flex-row items-center no-swipe backdrop-blur-md ${panelBg}`}>
                  {/* Auto-Generate Subtitles Button */}
                  <button
                    type="button"
                    disabled={isGeneratingCaptions}
                    onClick={() => {
                      setIsGeneratingCaptions(true);
                      setTimeout(() => {
                        setIsGeneratingCaptions(false);
                        const desc = content.body || "Safety Briefing Announcement";
                        const generatedSub = `Attention all employees. Please review this vital safety bulletin: "${desc}". Let's stay alert and work safely today.`;
                        updateContent({ captions: generatedSub });
                        toast.success("AI automatic subtitles generated successfully!");
                      }, 1200);
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer text-[8px] font-black uppercase shrink-0 ${isGeneratingCaptions ? "opacity-50" : ""} ${changeBtn}`}
                  >
                    {isGeneratingCaptions ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" /> Gen...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3 text-[#C8D400]" /> Auto-Gen
                      </>
                    )}
                  </button>

                  {/* Caption/Subtitle Editor textarea */}
                  <div className="flex-1 min-w-0">
                    <textarea
                      value={captions}
                      onChange={(e) => updateContent({ captions: e.target.value })}
                      placeholder="Type subtitles here..."
                      rows={1}
                      className={`w-full rounded-xl border px-2 py-1.5 text-[9px] leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-[#C8D400] transition-colors scrollbar-none h-8 ${isDark ? "bg-white/5 border-white/10 text-white" : "bg-black/5 border-black/10 text-[#0B1B4F]"}`}
                    />
                  </div>
                </div>
              );
            })()}

          </div>
        );
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
            const isMedia = slide.type === "audio" || slide.type === "image";

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
                  ${isActive
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
