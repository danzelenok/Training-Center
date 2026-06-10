"use client";

import React, { useEffect, useRef, useState } from "react";
import { Award, Sparkles, RotateCcw } from "lucide-react";
import { Slide } from "@/components/admin/course-editor/CardCanvas";
import { slideRegistry } from "@/components/admin/course-editor/SlideFactory";

const CARD_WIDTH = 350;
const CARD_HEIGHT = 620;

interface StoryPlayerProps {
  slides: Slide[];
  themeType?: string;
  themeValue?: string;
}

export function StoryPlayer({ slides, themeType, themeValue }: StoryPlayerProps) {
  const [safeTop, setSafeTop] = useState(0);
  const [safeBottom, setSafeBottom] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

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
  }, []);

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

  const [currentIndex, setCurrentIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [quizAnswered, setQuizAnswered] = useState(false);

  const slide = slides[currentIndex];

  const goNext = () => {
    if (currentIndex < slides.length - 1) {
      setCurrentIndex((i) => i + 1);
      setQuizAnswered(false);
    } else {
      setCompleted(true);
    }
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
      setCurrentIndex((i) => i - 1);
      setQuizAnswered(false);
    }
  };

  const safeAreaStyle: React.CSSProperties = {
    height: `calc(100dvh - ${safeTop - 5}px - ${safeBottom + (safeTop - 5)}px)`,
    marginTop: `${safeTop - 5}px`,
    marginBottom: `${safeBottom + (safeTop - 5)}px`,
    borderRadius: 12,
  };

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
        </div>
        <button
          onClick={() => { setCompleted(false); setCurrentIndex(0); }}
          className="flex items-center gap-2 px-6 py-3 bg-slate-900 border border-slate-800 text-slate-300 rounded-2xl text-xs font-bold uppercase tracking-wider"
        >
          <RotateCcw className="h-4 w-4" /> Restart
        </button>
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
      {/* Progress bar — above the scaled card, not scaled */}
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

      {/* Scale container — fills remaining space and centers the card */}
      <div
        ref={containerRef}
        className="flex-1 w-full flex items-center justify-center overflow-hidden cursor-pointer"
        onClick={handleTap}
      >
        {/* Card at native editor size (350×620), scaled uniformly to fit */}
        <div
          style={{
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: "center center",
            position: "relative",
            flexShrink: 0,
            marginTop: 23,
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
              onAnswered={() => setQuizAnswered(true)}
              onCompleted={() => setQuizAnswered(true)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
