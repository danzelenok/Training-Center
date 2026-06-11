import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Star, Smile, ThumbsUp, Send } from "lucide-react";
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
  onPollSubmitted?: (rating: string | null, comment: string) => void;
}

function StarRating({ selected, onSelect }: { selected: number | null; onSelect: (v: number) => void }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const active = hovered ?? selected;
  return (
    <div className="flex gap-2 items-center">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          onClick={() => onSelect(s)}
          onMouseEnter={() => setHovered(s)}
          onMouseLeave={() => setHovered(null)}
          className={`h-9 w-9 shrink-0 transition-all cursor-pointer ${
            active !== null && s <= active
              ? "text-amber-500 fill-amber-500/80 scale-110"
              : "text-muted-foreground/40 hover:text-amber-400"
          }`}
        />
      ))}
    </div>
  );
}

const EMOJI_OPTIONS = [
  { value: "bad", emoji: "😢" },
  { value: "neutral", emoji: "😐" },
  { value: "great", emoji: "😍" },
];

const THUMB_OPTIONS = [
  { value: "down", emoji: "👎" },
  { value: "up", emoji: "👍" },
];

export function PollCard({
  slide,
  index,
  isActive,
  onUpdateSlideContent,
  draggedIdx,
  cardStyle,
  mode,
  onPollSubmitted,
}: PollCardProps) {
  const content = slide.content || {};
  const isPlay = mode === "play";

  const [selectedRating, setSelectedRating] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const updateContent = (fields: any) => {
    onUpdateSlideContent(index, fields);
  };

  const handleSubmit = () => {
    onPollSubmitted?.(selectedRating, comment);
    setSubmitted(true);
  };


  return (
    <Card
      style={cardStyle}
      className={`rounded-[24px] overflow-hidden flex flex-col px-7 py-4 ${
        isPlay
          ? "relative w-full h-full"
          : "absolute top-0 left-0 w-[300px] md:w-[330px] lg:w-[350px] h-[530px] md:h-[585px] lg:h-[620px]"
      } origin-top-left border-[0.11px] border-border/80 transition-all duration-300 z-0 ${
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
      ) : isPlay ? (
        /* ── PLAY MODE ── */
        <div className="flex-1 flex flex-col min-h-0 py-3 gap-3 px-1">
          {/* Question */}
          <div onClick={(e) => e.stopPropagation()} className="flex-1 flex flex-col justify-end items-center min-h-0 pb-1">
            {content.heading ? (
              <p className="font-sans font-medium text-center text-lg md:text-xl leading-relaxed w-full text-foreground">
                {content.heading}
              </p>
            ) : (
              <p className="font-sans font-medium text-center text-lg leading-relaxed w-full text-muted-foreground/40">
                Rate your experience
              </p>
            )}
          </div>

          {/* Rating Zone */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded-2xl flex items-center justify-center py-5 shrink-0 bg-muted/50 border border-border"
          >
            {submitted ? (
              <p className="text-sm font-semibold text-emerald-500">Thanks for your feedback!</p>
            ) : content.pollType === "stars" ? (
              <StarRating
                selected={selectedRating ? parseInt(selectedRating) : null}
                onSelect={(v) => setSelectedRating(String(v))}
              />
            ) : content.pollType === "emojis" ? (
              <div className="flex gap-4 items-center text-3xl">
                {EMOJI_OPTIONS.map(({ value, emoji }) => (
                  <span
                    key={value}
                    onClick={() => setSelectedRating(selectedRating === value ? null : value)}
                    className={`transition-all cursor-pointer select-none ${
                      selectedRating === value ? "scale-125" : "opacity-60 hover:opacity-90 hover:scale-110"
                    }`}
                  >
                    {emoji}
                  </span>
                ))}
              </div>
            ) : content.pollType === "thumbs" ? (
              <div className="flex gap-6 items-center text-3xl">
                {THUMB_OPTIONS.map(({ value, emoji }) => (
                  <span
                    key={value}
                    onClick={() => setSelectedRating(selectedRating === value ? null : value)}
                    className={`transition-all cursor-pointer select-none ${
                      selectedRating === value ? "scale-125" : "opacity-60 hover:opacity-90 hover:scale-110"
                    }`}
                  >
                    {emoji}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {/* Comment field + Submit */}
          <div onClick={(e) => e.stopPropagation()} className="flex-[1.5] flex flex-col justify-start items-stretch pt-1 gap-2">
            {!submitted && (
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Leave a comment (optional)"
                rows={3}
                className="w-full rounded-2xl p-4 border border-border bg-card shadow-sm resize-none text-sm font-sans focus:outline-none focus:ring-1 focus:ring-border placeholder-muted-foreground/40 text-foreground"
              />
            )}
            {!submitted && selectedRating !== null && (
              <button
                onClick={handleSubmit}
                className="flex items-center justify-center gap-2 w-full rounded-2xl py-3 bg-foreground text-background text-sm font-bold transition-opacity hover:opacity-80"
              >
                <Send className="h-4 w-4" />
                Submit
              </button>
            )}
          </div>
        </div>
      ) : (
        /* ── EDIT MODE ── */
        <div className="flex-1 flex flex-col min-h-0 py-3 gap-3 px-1">
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
