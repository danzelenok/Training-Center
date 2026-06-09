import React from "react";
import { Card } from "@/components/ui/card";
import { Star, Smile, ThumbsUp } from "lucide-react";
import { Slide } from "../CardCanvas";

interface PollCardProps {
  slide: Slide;
  index: number;
  isActive: boolean;
  onUpdateSlideContent: (idx: number, updatedFields: any) => void;
  draggedIdx: number | null;
  cardStyle?: React.CSSProperties;
  mode?: "edit" | "play";
}

export function PollCard({
  slide,
  index,
  isActive,
  onUpdateSlideContent,
  draggedIdx,
  cardStyle,
  mode,
}: PollCardProps) {
  const content = slide.content || {};

  const updateContent = (fields: any) => {
    onUpdateSlideContent(index, fields);
  };

  // 1. Selector Choice screen if pollType not set
  if (!content.pollType) {
    return (
      <Card
        style={cardStyle}
        className={`rounded-[24px] overflow-hidden flex flex-col px-7 py-4 ${mode === "play" ? "relative w-full h-full" : "absolute top-0 left-0 w-[300px] md:w-[330px] lg:w-[350px] h-[530px] md:h-[585px] lg:h-[620px]"} origin-top-left border-[0.11px] border-border/80 transition-all duration-300 z-0 ${
          !isActive && draggedIdx === null ? "pointer-events-none" : ""
        } ${draggedIdx !== null ? "scale-[0.37] pointer-events-none" : "scale-100"}`}
      >
        <div className="flex-1 flex flex-col justify-center items-stretch gap-6 px-1 pt-6 pb-4 w-full z-10">
          <div className="flex flex-col items-center text-center gap-1.5 mb-1 shrink-0">
            <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 text-primary">
              <Star className="h-7 w-7" />
            </div>
            <h3 className="text-base md:text-lg font-bold tracking-tight text-foreground">Add Rate Block</h3>
            <p className="text-xs max-w-[200px] leading-normal text-muted-foreground">
              Choose a rating format for your feedback question.
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full shrink-0">
            {/* Stars Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                updateContent({ pollType: "stars" });
              }}
              className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:border-primary/60 hover:bg-accent text-card-foreground shadow-sm hover:shadow-md transition-all cursor-pointer text-left no-swipe"
            >
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 shrink-0">
                <Star className="h-5 w-5 fill-amber-500/20" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider">Stars</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">
                  5-star rating scale for satisfaction scores
                </p>
              </div>
            </button>

            {/* Emojis Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                updateContent({ pollType: "emojis" });
              }}
              className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:border-primary/60 hover:bg-accent text-card-foreground shadow-sm hover:shadow-md transition-all cursor-pointer text-left no-swipe"
            >
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 shrink-0">
                <Smile className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider">Emojis</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">
                  Expressive emoji reactions from negative to positive
                </p>
              </div>
            </button>

            {/* Thumbs Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                updateContent({ pollType: "thumbs" });
              }}
              className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:border-primary/60 hover:bg-accent text-card-foreground shadow-sm hover:shadow-md transition-all cursor-pointer text-left no-swipe"
            >
              <div className="p-2.5 rounded-xl bg-green-500/10 text-green-500 shrink-0">
                <ThumbsUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider">Thumbs up/down</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">
                  Simple binary yes / no feedback response
                </p>
              </div>
            </button>
          </div>
        </div>
      </Card>
    );
  }

  // 2. Selected Mode Layout editor screen
  return (
    <Card
      style={cardStyle}
      className={`rounded-[24px] overflow-hidden flex flex-col px-7 py-4 ${mode === "play" ? "relative w-full h-full" : "absolute top-0 left-0 w-[300px] md:w-[330px] lg:w-[350px] h-[530px] md:h-[585px] lg:h-[620px]"} origin-top-left border-[0.11px] border-border/80 transition-all duration-300 z-0 ${
        !isActive && draggedIdx === null ? "pointer-events-none" : ""
      } ${draggedIdx !== null ? "scale-[0.37] pointer-events-none" : "scale-100"}`}
    >
      <div className="flex-1 flex flex-col min-h-0 py-3 gap-3 px-1">
        {/* 1. Question Text Area */}
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
            className="font-sans font-medium text-center text-lg md:text-xl resize-none bg-transparent focus:outline-none leading-relaxed w-full p-0 border-0 focus:ring-0 overflow-y-auto scrollbar-none text-foreground placeholder-muted-foreground/35"
          />
        </div>

        {/* 2. Rating Zone */}
        <div className="w-full rounded-2xl flex items-center justify-center py-5 shrink-0 bg-muted/50 border border-border">
          {content.pollType === "stars" && (
            <div className="flex gap-2 items-center">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className="h-8 w-8 shrink-0 hover:scale-110 transition-transform cursor-pointer text-muted-foreground/40 hover:text-amber-500 hover:fill-amber-500/25"
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

        {/* 3. Response field preview */}
        <div className="flex-[1.5] flex flex-col justify-start items-stretch pt-1">
          <div className="w-full rounded-2xl p-4 border border-border bg-card shadow-sm">
            <p className="font-sans font-medium text-base md:text-lg leading-relaxed text-muted-foreground/60">
              This is where your learners will type their responses.
            </p>
            <p className="font-sans font-medium text-base md:text-lg leading-relaxed mt-2 text-muted-foreground/45">
              You&apos;ll be able to view all responses in the course analytics.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
