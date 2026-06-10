import React from "react";

interface SlideSelectorOption {
  value: string;
  label: string;
  icon: React.ReactNode;
  iconBg?: string;
}

interface SlideTypeSelectorProps {
  headerIcon: React.ReactNode;
  title: string;
  description: string;
  options: SlideSelectorOption[];
  onSelect: (value: string) => void;
}

export function SlideTypeSelector({
  headerIcon,
  title,
  description,
  options,
  onSelect,
}: SlideTypeSelectorProps) {
  const compact = options.length >= 3;

  return (
    <div className="flex-1 flex flex-col justify-center items-center gap-4 px-4 py-8 text-center select-none">
      <div className="flex flex-col items-center gap-1.5 mb-1">
        <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 text-primary">
          {headerIcon}
        </div>
        <h3 className="text-base md:text-lg font-bold tracking-tight text-foreground">{title}</h3>
        <p className="text-xs max-w-[200px] leading-normal text-muted-foreground">{description}</p>
      </div>
      <div className={`flex w-full ${compact ? "gap-2" : "gap-3.5 max-w-[280px]"}`}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(option.value);
            }}
            className={`flex-1 flex flex-col items-center rounded-2xl border border-border bg-card hover:bg-accent/40 hover:border-primary/50 text-card-foreground shadow-sm hover:shadow-md transition-all cursor-pointer no-swipe ${compact ? "gap-1.5 p-3" : "gap-2 p-4"}`}
          >
            <div className={`rounded-xl ${compact ? "p-2" : "p-2.5"} ${option.iconBg ?? "bg-primary/10 text-primary"}`}>
              {option.icon}
            </div>
            <span className={`font-black uppercase tracking-wider whitespace-nowrap ${compact ? "text-[9.5px]" : "text-[11px]"}`}>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
