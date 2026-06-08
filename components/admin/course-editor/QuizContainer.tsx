import React, { useState, useRef, useEffect } from "react";
import { GripVertical, X } from "lucide-react";

interface QuizContainerProps {
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  isActive: boolean;
  onUpdateContent: (fields: {
    heading?: string;
    question?: string;
    title?: string;
    options?: string[];
    correctIndex?: number;
    correctAnswer?: string;
    explanation?: string;
  }) => void;
  onDisableDrag?: () => void;
  onEnableDrag?: () => void;
  mode?: "edit" | "play";
  onAnswered?: () => void;
}

export function QuizContainer({
  questionText,
  options,
  correctIndex,
  explanation,
  isActive,
  onUpdateContent,
  onDisableDrag,
  onEnableDrag,
  mode,
  onAnswered,
}: QuizContainerProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    setSelectedIdx(null);
    setAnswered(false);
  }, [questionText]);

  // Quiz Option Drag and Drop States
  const [draggedOptIdx, setDraggedOptIdx] = useState<number | null>(null);
  const [dragOverOptIdx, setDragOverOptIdx] = useState<number | null>(null);
  const draggedOptIdxRef = useRef<number | null>(null);

  const optionsList = options || ["", ""];
  const correctIdxValue = correctIndex ?? 0;

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

      let newCorrectIdx = correctIdxValue;
      if (correctIdxValue === currentDraggedIdx) {
        newCorrectIdx = idx;
      } else {
        if (currentDraggedIdx < correctIdxValue && correctIdxValue <= idx) {
          newCorrectIdx = correctIdxValue - 1;
        } else if (idx <= correctIdxValue && correctIdxValue < currentDraggedIdx) {
          newCorrectIdx = correctIdxValue + 1;
        }
      }

      onUpdateContent({
        options: updatedOptions,
        correctIndex: newCorrectIdx,
        correctAnswer: updatedOptions[newCorrectIdx] || `Option ${String.fromCharCode(65 + newCorrectIdx)}`,
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

  if (mode === "play") {
    return (
      <div className="flex-1 flex flex-col justify-center gap-4 pt-6 pb-4 px-1">
        <p className="font-sans font-semibold text-base md:text-lg text-foreground leading-relaxed">
          {questionText}
        </p>

        <div className="flex flex-col gap-2 w-full">
          {optionsList.map((option, idx) => {
            const isSelected = selectedIdx === idx;
            const isCorrect = correctIdxValue === idx;

            let btnClass = "border-border bg-card text-foreground hover:bg-accent";
            if (answered) {
              if (isCorrect) {
                btnClass = "border-green-500 bg-green-500/15 text-green-700 dark:text-green-400";
              } else if (isSelected && !isCorrect) {
                btnClass = "border-red-500 bg-red-500/15 text-red-700 dark:text-red-400";
              } else {
                btnClass = "border-border bg-card text-muted-foreground opacity-50";
              }
            }

            return (
              <button
                key={idx}
                type="button"
                disabled={answered}
                onClick={() => {
                  if (answered) return;
                  setSelectedIdx(idx);
                  setAnswered(true);
                  onAnswered?.();
                }}
                className={`w-full text-left px-4 py-3 rounded-2xl border text-sm font-medium transition-all duration-300 flex items-center gap-3 ${btnClass}`}
              >
                {answered && isCorrect && (
                  <span className="text-green-500 font-bold shrink-0">✓</span>
                )}
                {answered && isSelected && !isCorrect && (
                  <span className="text-red-500 font-bold shrink-0">✗</span>
                )}
                {(!answered || (!isCorrect && !isSelected)) && (
                  <span className="w-4 shrink-0" />
                )}
                {option}
              </button>
            );
          })}
        </div>

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

      <div className="w-full space-y-2 px-0.5 shrink-0 flex flex-col items-center overflow-visible">
        {optionsList.map((option, optIdx) => {
          const isCorrect = correctIdxValue === optIdx;
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
                  onClick={() => {
                    onUpdateContent({
                      correctIndex: optIdx,
                      correctAnswer: option || `Option ${String.fromCharCode(65 + optIdx)}`,
                    });
                  }}
                  className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 transition-colors border-2 ${
                    isCorrect ? "border-primary bg-transparent" : "border-muted-foreground/30 bg-transparent"
                  } ${isActive ? "cursor-pointer hover:border-primary" : "cursor-default"}`}
                  title={isActive ? "Set as correct answer" : undefined}
                >
                  {isCorrect && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
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
                    let nextCorrectIdx = correctIdxValue;
                    if (nextCorrectIdx >= updatedOptions.length) {
                      nextCorrectIdx = 0;
                    }
                    onUpdateContent({
                      options: updatedOptions,
                      correctIndex: nextCorrectIdx,
                      correctAnswer: updatedOptions[nextCorrectIdx] || `Option ${String.fromCharCode(65 + nextCorrectIdx)}`,
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
