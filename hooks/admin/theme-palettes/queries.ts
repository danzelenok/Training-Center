import { useQuery } from "@tanstack/react-query";
import { themePalettesKeys, type ThemePalette } from "./types";

async function fetchThemePalettes(): Promise<ThemePalette[]> {
  const res = await fetch("/api/theme-palettes");
  if (!res.ok) throw new Error("Failed to fetch theme palettes");
  return res.json();
}

export function useThemePalettesQuery() {
  return useQuery({
    queryKey: themePalettesKeys.list(),
    queryFn: fetchThemePalettes,
  });
}
