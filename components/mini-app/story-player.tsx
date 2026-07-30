"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Award, Sparkles, RotateCcw, BookOpen } from "lucide-react";
import { Slide } from "@/components/admin/course-editor/CardCanvas";
import { slideRegistry } from "@/components/admin/course-editor/SlideFactory";
import { fetchAvatarsList, CHAD_FALLBACK_IMAGE, FLORIN_FALLBACK_IMAGE } from "@/components/admin/course-editor/AvatarSelector";

const CARD_WIDTH = 350;
const CARD_HEIGHT = 620;

interface StoryPlayerProps {
  slides: Slide[];
  courseId?: string;
  initData?: string;
  themeType?: string;
  themeValue?: string;
}

export function StoryPlayer({ slides, courseId, initData, themeType, themeValue }: StoryPlayerProps) {
  const [safeTop, setSafeTop] = useState(0);
  const [safeBottom, setSafeBottom] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const router = useRouter();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [progressLoaded, setProgressLoaded] = useState(false);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      setSafeTop(tg.safeAreaInset?.top ?? 0);
      setSafeBottom(tg.contentSafeAreaInset?.bottom ?? 0);
    }
  }, []);

  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const availW = containerRef.current.offsetWidth;
      const availH = containerRef.current.offsetHeight;
      setScale(Math.min(availW / CARD_WIDTH, availH / CARD_HEIGHT));
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [progressLoaded]);

  // Load saved progress on mount
  useEffect(() => {
    if (!courseId || !initData) {
      setProgressLoaded(true);
      return;
    }

    fetch(`/api/progress?courseId=${courseId}`, {
      headers: { "Telegram-Init-Data": initData },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          if (typeof data.quizScore === "number") setQuizScore(data.quizScore);
          if (data.status !== "completed") {
            setCurrentIndex(Math.min(data.currentSlideIndex ?? 0, slides.length - 1));
          }
        }
      })
      .catch(() => {})
      .finally(() => setProgressLoaded(true));
  }, [courseId, initData, slides.length]);

  // Extracts the image/video/audio URLs a slide needs, so we can warm the browser's
  // cache for the next slide ahead of time instead of only starting the fetch the
  // moment the user swipes to it (which is what causes the visible pop-in/empty-circle lag).
  const getSlideMedia = useCallback((s?: Slide) => {
    const images: string[] = [];
    const videos: string[] = [];
    const audios: string[] = [];
    if (!s) return { images, videos, audios };
    const c = s.content || {};
    if (s.type === "video") {
      if (c.url) videos.push(c.url);
    } else if (s.type === "audio") {
      if (c.url) audios.push(c.url);
    } else if (s.type === "dialogue") {
      if (c.instructorVideoUrl) videos.push(c.instructorVideoUrl);
      if (c.studentVideoUrl) videos.push(c.studentVideoUrl);
    } else if (s.type === "chat" || s.type === "text") {
      const img = c.imageUrl || c.url;
      if (img) images.push(img);
    }
    return { images, videos, audios };
  }, []);

  const preloadedUrlsRef = useRef<Set<string>>(new Set());

  // The Chad/Florin avatars are shared across every dialogue slide in the course (not
  // per-slide media), so warm them once up front rather than waiting for the first
  // dialogue slide's own component to fetch and swap them in.
  useEffect(() => {
    const preload = (url: string) => {
      if (!url || preloadedUrlsRef.current.has(url)) return;
      preloadedUrlsRef.current.add(url);
      const img = new Image();
      img.src = url;
    };
    preload(CHAD_FALLBACK_IMAGE);
    preload(FLORIN_FALLBACK_IMAGE);
    fetchAvatarsList().then((list) => {
      const chad = list.find((a: any) => a.name?.toLowerCase() === "chad");
      const florin = list.find((a: any) => a.name?.toLowerCase() === "florin");
      if (chad?.preview_image_url) preload(chad.preview_image_url);
      if (florin?.preview_image_url) preload(florin.preview_image_url);
    });
  }, []);

  // Warm the cache for the current slide and the next one every time the index moves,
  // so media is already (at least partially) downloaded before it's actually shown.
  useEffect(() => {
    if (!slides.length) return;
    for (const idx of [currentIndex, currentIndex + 1]) {
      const { images, videos, audios } = getSlideMedia(slides[idx]);
      for (const url of images) {
        if (preloadedUrlsRef.current.has(url)) continue;
        preloadedUrlsRef.current.add(url);
        const img = new Image();
        img.src = url;
      }
      for (const url of videos) {
        if (preloadedUrlsRef.current.has(url)) continue;
        preloadedUrlsRef.current.add(url);
        const video = document.createElement("video");
        video.preload = "auto";
        video.muted = true;
        video.src = url;
        video.load();
      }
      for (const url of audios) {
        if (preloadedUrlsRef.current.has(url)) continue;
        preloadedUrlsRef.current.add(url);
        const audio = new Audio();
        audio.preload = "auto";
        audio.src = url;
      }
    }
  }, [slides, currentIndex, getSlideMedia]);

  const saveProgress = useCallback(
    (
      slideIndex: number,
      status: "in_progress" | "completed",
      answer?: { slideId: string; selectedIndices: number[] }
    ) => {
      if (!courseId || !initData) return;
      fetch("/api/progress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Telegram-Init-Data": initData,
        },
        body: JSON.stringify({
          courseId,
          currentSlideIndex: slideIndex,
          status,
          ...(answer ? { slideId: answer.slideId, selectedIndices: answer.selectedIndices } : {}),
        }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && typeof data.quizScore === "number") setQuizScore(data.quizScore);
        })
        .catch(() => {});
    },
    [courseId, initData]
  );

  const getCardBgStyle = (): React.CSSProperties => {
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

  const slide = slides[currentIndex];

  const goNext = () => {
    // Poll slides are feedback-only; the last non-poll slide is where content ends
    const lastContentIndex = slides.reduce(
      (last, s, idx) => (s.type !== "poll" ? idx : last),
      slides.length - 1
    );

    if (currentIndex < slides.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      setQuizAnswered(false);
      // Mark completed as soon as the user reaches (or passes) the last content slide
      const newStatus = nextIndex >= lastContentIndex ? "completed" : "in_progress";
      saveProgress(nextIndex, newStatus);
    } else {
      setCompleted(true);
      saveProgress(currentIndex, "completed");
    }
  };

  const handleQuizAnswered = (selectedIndices: number[]) => {
    setQuizAnswered(true);
    if (slide?.id) {
      saveProgress(currentIndex, "in_progress", { slideId: slide.id, selectedIndices });
    }
  };

  const handlePollSubmitted = (rating: string | null, comment: string) => {
    if (courseId && initData) {
      fetch("/api/poll-responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Telegram-Init-Data": initData,
        },
        body: JSON.stringify({ courseId, slideIndex: currentIndex, rating, comment }),
      }).catch(() => {});
    }
    goNext();
  };

  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest("textarea") ||
      target.closest("audio") ||
      target.closest("video") ||
      target.closest("select")
    ) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const isRight = (e.clientX - rect.left) / rect.width >= 0.5;

    const isQuizGated =
      slide?.type === "quiz" ||
      (slide?.type === "dialogue" && slide?.content?.dialogueBelowType === "quiz");

    if (isRight) {
      if (isQuizGated && !quizAnswered) return;
      goNext();
    } else if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      setQuizAnswered(false);
    }
  };

  const safeAreaStyle: React.CSSProperties = {
    height: `calc(100dvh - ${safeTop - 5}px - ${safeBottom + (safeTop - 5)}px)`,
    marginTop: `${safeTop - 5}px`,
    marginBottom: `${safeBottom + (safeTop - 5)}px`,
    borderRadius: 12,
  };

  if (!progressLoaded) {
    return (
      <div
        className="flex flex-col w-full items-center justify-center bg-slate-950 text-slate-400 gap-3"
        style={safeAreaStyle}
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  if (completed) {
    return (
      <div
        className="flex flex-col w-full items-center justify-center bg-slate-950 text-white gap-6 p-8 text-center select-none overflow-hidden"
        style={safeAreaStyle}
      >
        <div className="h-24 w-24 rounded-full bg-gradient-to-tr from-[#C8D400] to-sky-400 flex items-center justify-center shadow-2xl relative">
          <Award className="h-12 w-12 text-[#1B2A6B]" />
          <Sparkles className="absolute -top-1 -right-1 h-6 w-6 text-yellow-300 animate-pulse" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black uppercase tracking-tight">Course Completed!</h1>
          <p className="text-sm text-slate-400">You've reviewed all slides.</p>
          {quizScore !== null && (
            <p className="text-lg font-bold text-[#C8D400]">
              Quiz Score: {quizScore}%
            </p>
          )}
          <p className="text-xs text-slate-500">This course is now in your Completed section — you can revisit it anytime.</p>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => router.push("/mini-app")}
            className="flex items-center justify-center gap-2 w-full px-6 py-3.5 bg-[#C8D400] text-[#1B2A6B] rounded-2xl text-sm font-bold"
          >
            <BookOpen className="h-4 w-4" /> View All Courses
          </button>
          <button
            onClick={() => {
              setCompleted(false);
              setCurrentIndex(0);
              saveProgress(0, "in_progress");
            }}
            className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-slate-900 border border-slate-800 text-slate-300 rounded-2xl text-xs font-bold uppercase tracking-wider"
          >
            <RotateCcw className="h-4 w-4" /> Restart
          </button>
        </div>
      </div>
    );
  }

  const cardStyle = getCardBgStyle();
  const SlideCard = slide ? slideRegistry[slide.type]?.Card : null;

  return (
    <div
      className="w-full flex flex-col bg-slate-950 select-none overflow-hidden"
      style={safeAreaStyle}
    >
      {/* Progress bar */}
      <div className="px-4 pt-[5px] pb-2 shrink-0">
        <div className="flex gap-1 w-full">
          {slides.map((_, idx) => (
            <div key={idx} className="h-[3px] flex-1 rounded-full overflow-hidden bg-white/30">
              <div
                className={`h-full bg-white transition-all duration-300 ${idx <= currentIndex ? "w-full" : "w-0"}`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Scale container */}
      <div
        ref={containerRef}
        className="flex-1 w-full flex items-center justify-center overflow-hidden cursor-pointer"
        onClick={handleTap}
      >
        <div
          style={{
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: "center center",
            position: "relative",
            flexShrink: 0,
            marginTop: 22,
          }}
        >
          {SlideCard && (
            <SlideCard
              slide={slide}
              index={currentIndex}
              isActive={true}
              onUpdateSlideContent={() => {}}
              onOpenMediaPicker={() => {}}
              draggedIdx={null}
              cardStyle={cardStyle}
              mode="play"
              onAnswered={handleQuizAnswered}
              onCompleted={() => setQuizAnswered(true)}
              onPollSubmitted={handlePollSubmitted}
            />
          )}
        </div>
      </div>
    </div>
  );
}
