import React from "react";
import { X } from "lucide-react";

export const CHAD_FALLBACK_IMAGE = "https://files2.heygen.ai/avatar/v3/ac048b34f66c4526a396842915c438c8_34900/preview_talk_2.webp";
export const FLORIN_FALLBACK_IMAGE = "https://files2.heygen.ai/avatar/v3/6010f06908ef489cbd83bbb25363e9c2_47220/preview_talk_1.webp";

let globalAvatars: any[] | null = null;
let globalAvatarsPromise: Promise<any[]> | null = null;

export function fetchAvatarsList() {
  if (globalAvatars) return Promise.resolve(globalAvatars);
  if (globalAvatarsPromise) return globalAvatarsPromise;

  globalAvatarsPromise = fetch("/api/avatars")
    .then((r) => r.json())
    .then((data) => {
      if (Array.isArray(data)) {
        globalAvatars = data;
        return data;
      }
      throw new Error("Invalid response");
    })
    .catch((err) => {
      console.error("Failed to load avatars in client:", err);
      return [];
    });
  return globalAvatarsPromise;
}

export interface AvatarSelectorProps {
  onSelect: (avatarType: "instructor" | "worker") => void;
  onClose: () => void;
  sideName: string;
  className?: string;
  chadImage?: string;
  florinImage?: string;
}

export function AvatarSelector({ onSelect, onClose, sideName, className = "", chadImage, florinImage }: AvatarSelectorProps) {
  return (
    <div className={`absolute border border-border p-3 rounded-2xl bg-popover/95 backdrop-blur-md text-popover-foreground shadow-2xl z-50 flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
          Select Avatar ({sideName})
        </span>
        <button
          type="button"
          onClick={onClose}
          className="h-4 w-4 rounded-full flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <div className="flex gap-3 mt-1">
        <button
          type="button"
          onClick={() => onSelect("instructor")}
          className="flex-1 flex flex-col items-center gap-1.5 p-2 rounded-xl border border-border bg-card hover:bg-accent/50 hover:border-primary transition-all cursor-pointer"
        >
          <div className="w-11 h-11 rounded-full border-2 border-primary bg-[#E2E5E9] text-[#7A8A00] flex items-center justify-center overflow-hidden">
            <img src={chadImage || CHAD_FALLBACK_IMAGE} className="w-full h-full object-cover" style={{ transform: "scale(2.1) translateY(5%)", transformOrigin: "center 15%" }} alt="Chad" />
          </div>
          <span className="text-[9px] font-bold uppercase tracking-wider">Chad</span>
        </button>

        <button
          type="button"
          onClick={() => onSelect("worker")}
          className="flex-1 flex flex-col items-center gap-1.5 p-2 rounded-xl border border-border bg-card hover:bg-accent/50 hover:border-blue-500 transition-all cursor-pointer"
        >
          <div className="w-11 h-11 rounded-full border-2 border-blue-500 bg-[#E2E5E9] text-[#1D4ED8] flex items-center justify-center overflow-hidden">
            <img src={florinImage || FLORIN_FALLBACK_IMAGE} className="w-full h-full object-cover" style={{ transform: "scale(2.1) translateY(-5%)", transformOrigin: "center 15%" }} alt="Florin" />
          </div>
          <span className="text-[9px] font-bold uppercase tracking-wider">Florin</span>
        </button>
      </div>
    </div>
  );
}
