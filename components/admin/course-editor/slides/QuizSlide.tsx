import React from "react";
import { Card } from "@/components/ui/card";
import { Slide } from "../CardCanvas";
import { QuizContainer } from "../QuizContainer";

interface QuizCardProps {
  slide: Slide;
  index: number;
  isActive: boolean;
  onUpdateSlideContent: (idx: number, updatedFields: any) => void;
  draggedIdx: number | null;
  cardStyle?: React.CSSProperties;
  onDisableDrag?: () => void;
  onEnableDrag?: () => void;
}

export function QuizCard({
  slide,
  index,
  isActive,
  onUpdateSlideContent,
  draggedIdx,
  cardStyle,
  onDisableDrag,
  onEnableDrag,
}: QuizCardProps) {
  const content = slide.content || {};

  return (
    <Card
      style={cardStyle}
      className={`rounded-[24px] overflow-hidden flex flex-col px-7 py-4 absolute top-0 left-0 w-[300px] md:w-[330px] lg:w-[350px] h-[530px] md:h-[585px] lg:h-[620px] origin-top-left border border-border/80 shadow-md transition-all duration-300 z-0 ${
        !isActive && draggedIdx === null ? "pointer-events-none" : ""
      } ${draggedIdx !== null ? "scale-[0.37] pointer-events-none" : "scale-100"}`}
    >
      <QuizContainer
        questionText={content.heading || content.question || content.title || ""}
        options={content.options || ["", ""]}
        correctIndex={content.correctIndex ?? 0}
        explanation={content.explanation || ""}
        isActive={isActive}
        onUpdateContent={(fields) => onUpdateSlideContent(index, fields)}
        onDisableDrag={onDisableDrag}
        onEnableDrag={onEnableDrag}
      />
    </Card>
  );
}
