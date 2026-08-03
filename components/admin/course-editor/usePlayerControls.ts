import { useCallback, useRef, useState } from "react";

const PLAYBACK_SPEEDS = [1, 1.25, 1.5, 2];

/**
 * Shared play/pause/scrub/speed/CC state for Audio and Video cards — the
 * part of their player state that was byte-for-byte identical. Deliberately
 * does NOT include isBuffering/isStalled/transcriptOpen (Video-only, tied to
 * the stall-guard autoplay mechanism which is out of scope for this pass)
 * — those stay local to VideoSlide.tsx.
 */
export function usePlayerControls<T extends HTMLMediaElement>() {
  const mediaRef = useRef<T | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0.1);
  const [speed, setSpeed] = useState(1);
  const [isCCActive, setIsCCActive] = useState(false);

  const setMediaRef = useCallback((node: T | null) => {
    mediaRef.current = node;
    if (node) {
      node.playbackRate = speed;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePlay = useCallback(() => {
    const el = mediaRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {});
      setIsPlaying(true);
    } else {
      el.pause();
      setIsPlaying(false);
    }
  }, []);

  const changeSpeed = useCallback(() => {
    setSpeed((prev) => {
      const next = PLAYBACK_SPEEDS[(PLAYBACK_SPEEDS.indexOf(prev) + 1) % PLAYBACK_SPEEDS.length];
      if (mediaRef.current) mediaRef.current.playbackRate = next;
      return next;
    });
  }, []);

  const handleScrub = useCallback((val: number) => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = val;
    }
    setCurrentTime(val);
  }, []);

  const toggleCC = useCallback(() => setIsCCActive((v) => !v), []);

  return {
    mediaRef,
    setMediaRef,
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    speed,
    isCCActive,
    togglePlay,
    changeSpeed,
    handleScrub,
    toggleCC,
  };
}
