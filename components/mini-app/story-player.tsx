"use client";

import React, { useEffect, useState } from "react";
import { Award, Sparkles, RotateCcw } from "lucide-react";
import { Slide } from "@/components/admin/course-editor/CardCanvas";
import { slideRegistry } from "@/components/admin/course-editor/SlideFactory";

interface StoryPlayerProps {
  slides: Slide[];
  themeType?: string;
  themeValue?: string;
}

export function StoryPlayer({ slides, themeType, themeValue }: StoryPlayerProps) {
  const [safeTop, setSafeTop] = useState(0);
  const [safeBottom, setSafeBottom] = useState(0);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      setSafeTop(tg.safeAreaInset?.top ?? 0);
      setSafeBottom(tg.contentSafeAreaInset?.bottom ?? 0);
    }
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
      (slide?.type === "quiz") ||
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
    height: `calc(100dvh - ${safeTop + 8}px - ${safeBottom + 8}px)`,
    marginTop: `${safeTop + 8}px`,
    marginBottom: `${safeBottom + 8}px`,
    borderRadius: "12px",
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
      className="w-full flex flex-col bg-slate-900 select-none overflow-hidden"
      style={safeAreaStyle}
    >
      <div
        onClick={handleTap}
        className="relative flex flex-col flex-1 w-full cursor-pointer overflow-hidden md:flex-none md:w-[350px] md:h-[620px] md:rounded-[24px] md:shadow-2xl md:mx-auto"
      >
        {/* Progress bar */}
        <div className="absolute top-0 inset-x-0 pt-3 px-4 z-50 pointer-events-none">
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

        {/* Slide card */}
        {SlideCard && (
          <div className="flex-1 w-full overflow-hidden">
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
          </div>
        )}
      </div>
    </div>
  );
}
