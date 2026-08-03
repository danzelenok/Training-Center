import { useEffect, useState } from "react";
import { fetchAvatarsList, CHAD_FALLBACK_IMAGE, FLORIN_FALLBACK_IMAGE } from "./AvatarSelector";

/**
 * Resolves the real HeyGen preview images for the Chad/Florin avatars,
 * falling back to the static images until the list loads. Wraps the
 * already-shared fetchAvatarsList() — this hook just owns the effect +
 * fallback state that DialogueSlide and VideoSlide previously duplicated.
 */
export function useAvatarSelection() {
  const [chadImage, setChadImage] = useState(CHAD_FALLBACK_IMAGE);
  const [florinImage, setFlorinImage] = useState(FLORIN_FALLBACK_IMAGE);

  useEffect(() => {
    fetchAvatarsList().then((list) => {
      const chad = list.find((a: any) => a.name.toLowerCase() === "chad");
      const florin = list.find((a: any) => a.name.toLowerCase() === "florin");
      if (chad?.preview_image_url) setChadImage(chad.preview_image_url);
      if (florin?.preview_image_url) setFlorinImage(florin.preview_image_url);
    });
  }, []);

  return { chadImage, florinImage };
}
