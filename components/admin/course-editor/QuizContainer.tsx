import React, { useState, useRef, useEffect } from "react";
import { GripVertical, X, Check } from "lucide-react";

interface QuizContainerProps {
  questionText: string;
  options: string[];
  quizType?: "single" | "multiple";
  correctIndices?: number[];
  explanation: string;
  isActive: boolean;
  onUpdateContent: (fields: {
    heading?: string;
    question?: string;
    title?: string;
    options?: string[];
    quizType?: "single" | "multiple";
    correctIndices?: number[];
    correctAnswer?: string;
    explanation?: string;
  }) => void;
  onDisableDrag?: () => void;
  onEnableDrag?: () => void;
  mode?: "edit" | "play";
  onAnswered?: (selectedIndices: number[]) => void;
}

function correctAnswerLabel(options: string[], indices: number[]): string {
  return indices
    .map((i) => options[i] || `Option ${String.fromCharCode(65 + i)}`)
    .join(", ");
}

// Given a splice-move of one option from index `from` to index `to`, returns where
// `idx` ends up. Mirrors what Array.splice(from,1) + splice(to,0,item) does to indices.
function remapIndexOnMove(idx: number, from: number, to: number): number {
  if (idx === from) return to;
  if (from < idx && idx <= to) return idx - 1;
  if (to <= idx && idx < from) return idx + 1;
  return idx;
}

export function QuizContainer({
  questionText,
  options,
  quizType,
  correctIndices,
  explanation,
  isActive,
  onUpdateContent,
  onDisableDrag,
  onEnableDrag,
  mode,
  onAnswered,
}: QuizContainerProps) {
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    setSelectedIndices([]);
    setAnswered(false);
  }, [questionText]);

  // Quiz Option Drag and Drop States
  const [draggedOptIdx, setDraggedOptIdx] = useState<number | null>(null);
  const [dragOverOptIdx, setDragOverOptIdx] = useState<number | null>(null);
  const draggedOptIdxRef = useRef<number | null>(null);

  const optionsList = options || ["", ""];
  const quizTypeValue: "single" | "multiple" = quizType === "multiple" ? "multiple" : "single";
  const correctIndicesValue = correctIndices && correctIndices.length > 0 ? correctIndices : [0];

  // Option DND Handlers
  const handleOptDragStart = (idx: number, e: React.DragEvent) => {
    e.stopPropagation();
    setDraggedOptIdx(idx);
    draggedOptIdxRef.current = idx;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", idx.toString());

    const rowEl = e.currentTarget.closest("[data-opt-index]");
    if (rowEl) {
      rowEl.classList.add("shadow-2xl", "scale-[1.02]", "border-primary/80", "ring-2", "ring-primary/25");
      e.dataTransfer.setDragImage(rowEl, 20, 24);
      setTimeout(() => {
        rowEl.classList.remove("shadow-2xl", "scale-[1.02]", "border-primary/80", "ring-2", "ring-primary/25");
      }, 0);
    }
  };

  const handleOptDragOver = (idx: number, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const currentDraggedIdx = draggedOptIdxRef.current;
    if (currentDraggedIdx !== null && currentDraggedIdx !== idx) {
      const updatedOptions = [...optionsList];
      const [draggedItem] = updatedOptions.splice(currentDraggedIdx, 1);
      updatedOptions.splice(idx, 0, draggedItem);

      const newCorrectIndices = correctIndicesValue.map((ci) => remapIndexOnMove(ci, currentDraggedIdx, idx));

      onUpdateContent({
        options: updatedOptions,
        correctIndices: newCorrectIndices,
        correctAnswer: correctAnswerLabel(updatedOptions, newCorrectIndices),
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
    onEnableDrag?.();
  };

  const handleOptDragEnd = (e: React.DragEvent) => {
    e.stopPropagation();
    setDraggedOptIdx(null);
    draggedOptIdxRef.current = null;
    setDragOverOptIdx(null);
    onEnableDrag?.();
  };

  const handleSetCorrect = (optIdx: number) => {
    let nextIndices: number[];
    if (quizTypeValue === "multiple") {
      if (correctIndicesValue.includes(optIdx)) {
        if (correctIndicesValue.length === 1) return; // keep at least one correct answer
        nextIndices = correctIndicesValue.filter((i) => i !== optIdx);
      } else {
        nextIndices = [...correctIndicesValue, optIdx].sort((a, b) => a - b);
      }
    } else {
      nextIndices = [optIdx];
    }
    onUpdateContent({
      correctIndices: nextIndices,
      correctAnswer: correctAnswerLabel(optionsList, nextIndices),
    });
  };

  const handleSetQuizType = (nextType: "single" | "multiple") => {
    if (nextType === quizTypeValue) return;
    const nextIndices = nextType === "single" ? [correctIndicesValue[0] ?? 0] : correctIndicesValue;
    onUpdateContent({
      quizType: nextType,
      correctIndices: nextIndices,
      correctAnswer: correctAnswerLabel(optionsList, nextIndices),
    });
  };

  if (mode === "play") {
    const isMultiple = quizTypeValue === "multiple";

    return (
      <div className="flex-1 flex flex-col justify-center gap-4 pt-6 pb-4 px-1">
        <p className="font-sans font-semibold text-base md:text-lg text-foreground leading-relaxed">
          {questionText}
        </p>

        <div className="flex flex-col gap-2 w-full">
          {optionsList.map((option, idx) => {
            const isSelected = selectedIndices.includes(idx);
            const isCorrect = correctIndicesValue.includes(idx);

            let btnClass = "border-border bg-card text-foreground hover:bg-accent";
            if (answered) {
              if (isCorrect) {
                btnClass = "border-green-500 bg-green-500/15 text-green-700 dark:text-green-400";
              } else if (isSelected && !isCorrect) {
                btnClass = "border-red-500 bg-red-500/15 text-red-700 dark:text-red-400";
              } else {
                btnClass = "border-border bg-card text-muted-foreground opacity-50";
              }
            } else if (isMultiple && isSelected) {
              btnClass = "border-primary bg-primary/10 text-foreground";
            }

            return (
              <button
                key={idx}
                type="button"
                disabled={answered}
                onClick={() => {
                  if (answered) return;
                  if (isMultiple) {
                    setSelectedIndices((prev) =>
                      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
                    );
                  } else {
                    setSelectedIndices([idx]);
                    setAnswered(true);
                    onAnswered?.([idx]);
                  }
                }}
                className={`w-full text-left px-4 py-3 rounded-2xl border text-sm font-medium transition-all duration-300 relative flex items-center gap-2.5 ${btnClass}`}
              >
                {isMultiple && !answered && (
                  <span
                    className={`h-4 w-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                      isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3 text-primary-foreground stroke-[3]" />}
                  </span>
                )}
                <span className="flex-1">{option}</span>
                {answered && isCorrect && (
                  <span className="text-green-500 font-bold shrink-0">✓</span>
                )}
                {answered && isSelected && !isCorrect && (
                  <span className="text-red-500 font-bold shrink-0">✗</span>
                )}
              </button>
            );
          })}
        </div>

        {isMultiple && !answered && (
          <button
            type="button"
            disabled={selectedIndices.length === 0}
            onClick={() => {
              setAnswered(true);
              onAnswered?.(selectedIndices);
            }}
            className="w-full py-3 rounded-2xl text-sm font-bold transition-all bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirm
          </button>
        )}

        {answered && explanation && (
          <p className="font-sans font-medium text-base md:text-lg text-foreground leading-relaxed animate-fade-in border-t border-border pt-3.5">
            {explanation}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      style={{ marginLeft: "-28px", marginRight: "-28px", paddingLeft: "28px", paddingRight: "28px", width: "calc(100% + 56px)" }}
      className="flex-1 flex flex-col justify-start items-stretch pt-9 pb-4 space-y-4 z-10 overflow-y-auto scrollbar-none"
    >
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
          onChange={(e) => onUpdateContent({ heading: e.target.value, question: e.target.value, title: e.target.value })}
          placeholder="Enter Quiz Question"
          rows={1}
          className="font-sans font-medium text-left resize-none bg-transparent focus:outline-none leading-relaxed shrink-0 w-full p-0 border-0 focus:ring-0 overflow-hidden text-base md:text-lg text-foreground placeholder-muted-foreground/40"
        />
      </div>

      {isActive && (
        <div className="flex items-center gap-1.5 shrink-0 p-0.5 rounded-full bg-muted/60 border border-border w-fit">
          <button
            type="button"
            onClick={() => handleSetQuizType("single")}
            className={`px-3 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
              quizTypeValue === "single" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Single Answer
          </button>
          <button
            type="button"
            onClick={() => handleSetQuizType("multiple")}
            className={`px-3 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
              quizTypeValue === "multiple" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Multiple Answers
          </button>
        </div>
      )}

      <div className="w-full space-y-2 px-0.5 shrink-0 flex flex-col items-center overflow-visible">
        {optionsList.map((option, optIdx) => {
          const isCorrect = correctIndicesValue.includes(optIdx);
          const isDragged = isActive && draggedOptIdx === optIdx;
          const isDragOver = isActive && dragOverOptIdx === optIdx;
          const optKey = `opt-${optIdx}`;

          return (
            <div
              key={optKey}
              data-opt-index={optIdx}
              onDragOver={isActive ? (e) => handleOptDragOver(optIdx, e) : undefined}
              onDrop={isActive ? handleOptDrop : undefined}
              className={`w-full relative flex items-center group/opt-row overflow-visible transition-all duration-200 ${
                isDragged ? "opacity-30 scale-[0.98]" : ""
              }`}
            >
              {isActive && (
                <div
                  style={{ left: "-22px" }}
                  draggable={isActive}
                  onDragStart={(e) => handleOptDragStart(optIdx, e)}
                  onDragEnd={handleOptDragEnd}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    onDisableDrag?.();
                  }}
                  onMouseUp={() => {
                    if (draggedOptIdx === null) onEnableDrag?.();
                  }}
                  onMouseLeave={() => {
                    if (draggedOptIdx === null) onEnableDrag?.();
                  }}
                  className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 flex items-center justify-center transition-all cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground z-20 hover:scale-115"
                  title="Drag to reorder"
                >
                  <GripVertical className="h-3.5 w-3.5 stroke-[2.5]" />
                </div>
              )}

              <div
                className={`w-full p-3 rounded-xl border flex items-center gap-2.5 transition-all bg-card text-card-foreground border-border shadow-sm hover:bg-accent/5 ${
                  isCorrect ? "ring-2 ring-primary border-primary" : "hover:border-border/80"
                } ${isDragOver && !isDragged ? "border-primary/60 ring-2 ring-primary/30 shadow-md scale-[1.01]" : ""}`}
              >
                <button
                  type="button"
                  disabled={!isActive}
                  onClick={() => handleSetCorrect(optIdx)}
                  className={`h-5 w-5 flex items-center justify-center shrink-0 transition-colors border-2 ${
                    quizTypeValue === "multiple" ? "rounded-md" : "rounded-full"
                  } ${
                    isCorrect ? "border-primary bg-transparent" : "border-muted-foreground/30 bg-transparent"
                  } ${isActive ? "cursor-pointer hover:border-primary" : "cursor-default"}`}
                  title={isActive ? "Toggle correct answer" : undefined}
                >
                  {isCorrect && quizTypeValue === "multiple" && <Check className="h-3 w-3 text-primary stroke-[3]" />}
                  {isCorrect && quizTypeValue === "single" && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
                </button>

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
                    const updatedOptions = [...optionsList];
                    updatedOptions[optIdx] = e.target.value;
                    onUpdateContent({ options: updatedOptions });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.currentTarget.blur();
                    }
                  }}
                  placeholder="Enter Quiz Answer"
                  rows={1}
                  className="bg-transparent border-none focus:outline-none text-xs md:text-sm font-medium text-foreground placeholder-muted-foreground/40 flex-1 py-0 resize-none overflow-hidden leading-normal focus:ring-0"
                />
              </div>

              {isActive && optionsList.length > 2 && (
                <button
                  type="button"
                  onClick={() => {
                    const updatedOptions = optionsList.filter((_, i) => i !== optIdx);
                    let nextCorrectIndices = correctIndicesValue
                      .filter((ci) => ci !== optIdx)
                      .map((ci) => (ci > optIdx ? ci - 1 : ci));
                    if (nextCorrectIndices.length === 0) nextCorrectIndices = [0];
                    onUpdateContent({
                      options: updatedOptions,
                      correctIndices: nextCorrectIndices,
                      correctAnswer: correctAnswerLabel(updatedOptions, nextCorrectIndices),
                    });
                  }}
                  style={{ right: "-22px" }}
                  className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full flex items-center justify-center transition-all cursor-pointer bg-destructive/10 hover:bg-destructive text-destructive hover:text-destructive-foreground border border-destructive/20 hover:scale-110 active:scale-90 z-20 shadow-sm"
                  title="Delete choice option"
                >
                  <X className="h-2 w-2 stroke-[3]" />
                </button>
              )}
            </div>
          );
        })}

        {isActive && optionsList.length < 6 && (
          <button
            type="button"
            onClick={() => {
              const updatedOptions = [...optionsList];
              updatedOptions.push("");
              onUpdateContent({ options: updatedOptions });
            }}
            className="w-full p-3 rounded-xl border border-dashed border-border bg-card text-foreground hover:bg-accent/5 hover:border-primary/50 text-sm md:text-base font-bold shadow-xs cursor-pointer no-swipe shrink-0 transition-colors"
          >
            + Add New Option
          </button>
        )}
      </div>

      <div className="w-full flex flex-col items-start shrink-0 pt-3.5 border-t border-border">
        <textarea
          ref={(node) => {
            if (node) {
              node.style.height = "auto";
              node.style.height = `${node.scrollHeight}px`;
            }
          }}
          disabled={!isActive}
          value={explanation || ""}
          onChange={(e) => onUpdateContent({ explanation: e.target.value })}
          placeholder="Commentary (optional)"
          rows={1}
          className="font-sans font-medium text-left resize-none bg-transparent focus:outline-none leading-relaxed shrink-0 w-full p-0 border-0 focus:ring-0 overflow-hidden text-base md:text-lg text-foreground placeholder-muted-foreground/40"
        />
        {!explanation && (
          <span className="text-[10px] md:text-xs font-normal leading-normal mt-1 block select-none text-muted-foreground">
            Learners will see this comment after selecting any answer.
          </span>
        )}
      </div>
    </div>
  );
}
