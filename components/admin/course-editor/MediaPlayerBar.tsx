"use client";

import React from "react";
import { FileText, Pause, Play } from "lucide-react";

interface MediaPlayerBarProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  speed: number;
  onTogglePlay: () => void;
  onScrub: (val: number) => void;
  onChangeSpeed: () => void;
  isCCActive?: boolean;
  onToggleCC?: () => void;
  transcriptOpen?: boolean;
  onToggleTranscript?: () => void;
}

export function MediaPlayerBar({
  isPlaying,
  currentTime,
  duration,
  speed,
  onTogglePlay,
  onScrub,
  onChangeSpeed,
  isCCActive = false,
  onToggleCC,
  transcriptOpen = false,
  onToggleTranscript,
}: MediaPlayerBarProps) {
  const percent = (currentTime / duration) * 100;

  return (
    <div className="w-full bg-[#030b35]/95 border border-white/10 rounded-2xl p-2.5 flex items-center justify-between gap-3 shadow-2xl backdrop-blur-md text-white no-swipe">
      <button
        type="button"
        onClick={onTogglePlay}
        className="h-8 w-8 rounded-lg border border-white/90 flex items-center justify-center bg-transparent transition-all hover:scale-105 active:scale-95 cursor-pointer shrink-0"
      >
        {isPlaying ? (
          <Pause className="h-4.5 w-4.5 fill-white text-white shrink-0" />
        ) : (
          <Play className="h-4.5 w-4.5 fill-white text-white shrink-0 translate-x-[1px]" />
        )}
      </button>

      <div className="flex-1 flex items-center min-w-0">
        <input
          type="range"
          min="0"
          max={duration}
          step="0.05"
          value={currentTime}
          onChange={(e) => onScrub(parseFloat(e.target.value))}
          className="w-full h-[3.5px] rounded-lg appearance-none cursor-pointer accent-white bg-white/20 hover:accent-primary transition-colors"
          style={{
            background: `linear-gradient(to right, #ffffff 0%, #ffffff ${percent}%, rgba(255,255,255,0.2) ${percent}%, rgba(255,255,255,0.2) 100%)`,
          }}
        />
      </div>

      <div className="flex items-center gap-2.5 shrink-0 pl-1 select-none">
        <button
          type="button"
          onClick={onChangeSpeed}
          className="text-[10px] font-black text-white hover:text-primary px-1 h-8 flex items-center justify-center min-w-[28px] cursor-pointer transition-colors shrink-0"
          title="Playback Speed"
        >
          {speed}x
        </button>
      </div>
    </div>
  );
}
