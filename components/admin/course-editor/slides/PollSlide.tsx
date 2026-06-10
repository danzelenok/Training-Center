import React from "react";
import { Card } from "@/components/ui/card";
import { Star, Smile, ThumbsUp } from "lucide-react";
import { Slide } from "../CardCanvas";
import { SlideTypeSelector } from "./SlideTypeSelector";

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

  return (
    <Card
      style={cardStyle}
      className={`rounded-[24px] overflow-hidden flex flex-col px-7 py-4 ${mode === "play" ? "relative w-full h-full" : "absolute top-0 left-0 w-[300px] md:w-[330px] lg:w-[350px] h-[530px] md:h-[585px] lg:h-[620px]"} origin-top-left border-[0.11px] border-border/80 transition-all duration-300 z-0 ${
        !isActive && draggedIdx === null ? "pointer-events-none" : ""
      } ${draggedIdx !== null ? "scale-[0.37] pointer-events-none" : "scale-100"}`}
    >
      {!content.pollType ? (
        <SlideTypeSelector
          headerIcon={<Star className="h-7 w-7" />}
          title="Add Rate Block"
          description="Choose a rating format for your feedback question."
          options={[
            { value: "stars", label: "Stars", icon: <Star className="h-5 w-5 fill-amber-500/20" />, iconBg: "bg-amber-500/10 text-amber-500" },
            { value: "emojis", label: "Emojis", icon: <Smile className="h-5 w-5" />, iconBg: "bg-blue-500/10 text-blue-500" },
            { value: "thumbs", label: "Thumbs", icon: <ThumbsUp className="h-5 w-5" />, iconBg: "bg-green-500/10 text-green-500" },
          ]}
          onSelect={(value) => updateContent({ pollType: value })}
        />
      ) : (
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
      )}
    </Card>
  );
}
